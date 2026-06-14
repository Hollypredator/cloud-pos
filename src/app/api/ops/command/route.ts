import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { executeOpsCommand, makeOpsCommandEnvelope } from "@/lib/ops/command-executor";
import { parseOpsCommand } from "@/lib/ops/contracts";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { canAccessBranch, getSyncActorContext, type SyncActorContext } from "@/lib/sync/access";
import { getBranchLockState, validateLockForDevice } from "@/lib/sync/branch-lock";
import { recordCommandAttempt } from "@/lib/sync/events";
import type { OpsCommand, OpsCommandResult } from "@/lib/types";

type CommandRequestBody = {
  command?: unknown;
  type?: OpsCommand["type"];
  payload?: Record<string, unknown>;
  command_id?: string;
  idempotency_key?: string;
  device_id?: string;
  business_id?: string | null;
  branch_id?: string | null;
  actor_id?: string | null;
  offline_mode?: boolean;
  lock_token?: string;
};

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function mapCommandHttpStatus(result: OpsCommandResult) {
  if (result.status === "ACK") {
    return 200;
  }
  if (result.status === "CONFLICT") {
    return 409;
  }
  if (result.status === "RETRY") {
    return 503;
  }
  return 422;
}

function normalizeDeviceId(request: Request, body: CommandRequestBody) {
  return (
    (typeof body.device_id === "string" && body.device_id.trim() ? body.device_id.trim() : null) ??
    request.headers.get("x-device-id")?.trim() ??
    "web-online"
  );
}

function normalizeCommandFromBody(body: CommandRequestBody, actor: SyncActorContext, deviceId: string) {
  if (isRecord(body.command)) {
    const parsed = parseOpsCommand(body.command);
    if (!parsed.ok) {
      return parsed;
    }

    return {
      ok: true as const,
      value: {
        ...parsed.value,
        business_id: parsed.value.business_id ?? actor.businessId,
        branch_id: parsed.value.branch_id ?? actor.branchId,
        actor_id: parsed.value.actor_id ?? actor.actorId,
        device_id: parsed.value.device_id || deviceId,
      },
    };
  }

  if (!body.type || !isRecord(body.payload)) {
    return { ok: false as const, error: "Komut govdesi geçersiz. command veya type+payload günderin." };
  }

  const command = makeOpsCommandEnvelope({
    type: body.type,
    payload: body.payload,
    commandId: typeof body.command_id === "string" ? body.command_id : undefined,
    idempotencyKey: typeof body.idempotency_key === "string" ? body.idempotency_key : undefined,
    businessId: (typeof body.business_id === "string" ? body.business_id : null) ?? actor.businessId,
    branchId: (typeof body.branch_id === "string" ? body.branch_id : null) ?? actor.branchId,
    actorId: actor.actorId,
    deviceId,
  });

  return {
    ok: true as const,
    value: command,
  };
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", Math.round(performance.now() - startedAt).toString());
    return response;
  };

  try {
    const actorResult = await getSyncActorContext();
    if (!actorResult.ok) {
      logApiEvent("warn", "ops.command.forbidden", { correlationId });
      return json({ ok: false, message: actorResult.error }, { status: actorResult.status });
    }

    let body: CommandRequestBody;
    try {
      body = (await request.json()) as CommandRequestBody;
    } catch {
      return json({ ok: false, message: "Geçersiz istek govdesi." }, { status: 400 });
    }

    const deviceId = normalizeDeviceId(request, body);
    const normalizedCommand = normalizeCommandFromBody(body, actorResult.value, deviceId);
    if (!normalizedCommand.ok) {
      return json({ ok: false, message: normalizedCommand.error }, { status: 400 });
    }

    const command = normalizedCommand.value;

    if (command.branch_id && !canAccessBranch({ actor: actorResult.value, branchId: command.branch_id })) {
      return json({ ok: false, message: "Bu şube için komut yazma yetkiniz yok." }, { status: 403 });
    }

    const lockToken = typeof body.lock_token === "string" ? body.lock_token.trim() : "";
    const offlineMode = body.offline_mode === true || lockToken.length > 0;
    if (offlineMode) {
      if (!command.branch_id) {
        return json({ ok: false, message: "Offline komutlar branch_id gerektirir." }, { status: 400 });
      }
      if (!lockToken) {
        return json({ ok: false, message: "Offline komutlar lock_token gerektirir." }, { status: 400 });
      }

      const lockStateResult = await getBranchLockState(command.branch_id);
      if (!lockStateResult.ok) {
        return json({ ok: false, message: lockStateResult.error }, { status: 503 });
      }

      const lockValidation = validateLockForDevice({
        state: lockStateResult.state,
        deviceId: command.device_id,
        lockToken,
      });
      if (!lockValidation.ok) {
        return json(
          {
            ok: false,
            message: lockValidation.error,
            lock: lockStateResult.state ?? null,
          },
          { status: 409 },
        );
      }
    }

    const result = await executeOpsCommand(command, {
      enforceCashOnly: offlineMode,
    });

    await recordCommandAttempt({
      commandId: command.command_id,
      idempotencyKey: command.idempotency_key,
      deviceId: command.device_id,
      branchId: command.branch_id,
      businessId: command.business_id,
      result,
    });

    const statusCode = mapCommandHttpStatus(result);
    if (result.status !== "ACK") {
      logApiEvent("warn", "ops.command.rejected", {
        correlationId,
        commandId: command.command_id,
        type: command.type,
        status: result.status,
        reason: result.message ?? null,
      });
    } else {
      logApiEvent("info", "ops.command.ack", {
        correlationId,
        commandId: command.command_id,
        type: command.type,
      });
    }

    return json({ ok: result.status === "ACK", result }, { status: statusCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logApiEvent("error", "ops.command.unhandled", { correlationId, error: message });
    return json({ ok: false, message: "Komut çalıştırılırken beklenmeyen hata oluştu." }, { status: 500 });
  }
}
