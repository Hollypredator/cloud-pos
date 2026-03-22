import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { executeOpsCommand } from "@/lib/ops/command-executor";
import { parseSyncPushRequest } from "@/lib/ops/contracts";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { canAccessBranch, getSyncActorContext } from "@/lib/sync/access";
import { getBranchLockState, validateLockForDevice } from "@/lib/sync/branch-lock";
import { recordCommandAttempt } from "@/lib/sync/events";
import type { OpsCommandResult, SyncPushResponse } from "@/lib/types";

const MAX_BATCH = 200;

function summarize(results: OpsCommandResult[]): SyncPushResponse {
  let accepted = 0;
  let rejected = 0;
  let conflict = 0;
  let retry = 0;

  for (const result of results) {
    if (result.status === "ACK") {
      accepted += 1;
    } else if (result.status === "CONFLICT") {
      conflict += 1;
    } else if (result.status === "RETRY") {
      retry += 1;
    } else {
      rejected += 1;
    }
  }

  return {
    ok: rejected === 0 && conflict === 0,
    accepted_count: accepted,
    rejected_count: rejected,
    conflict_count: conflict,
    retry_count: retry,
    results,
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
    const actor = await getSyncActorContext();
    if (!actor.ok) {
      return json({ ok: false, message: actor.error }, { status: actor.status });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const parsed = parseSyncPushRequest(rawBody);
    if (!parsed.ok) {
      return json({ ok: false, message: parsed.error }, { status: 400 });
    }

    if (!parsed.value.lock_token) {
      return json({ ok: false, message: "Push icin lock_token zorunlu." }, { status: 400 });
    }

    if (!canAccessBranch({ actor: actor.value, branchId: parsed.value.branch_id })) {
      return json({ ok: false, message: "Bu sube icin sync push yetkiniz yok." }, { status: 403 });
    }

    const lockStateResult = await getBranchLockState(parsed.value.branch_id);
    if (!lockStateResult.ok) {
      return json({ ok: false, message: lockStateResult.error }, { status: 503 });
    }

    const lockValidation = validateLockForDevice({
      state: lockStateResult.state,
      deviceId: parsed.value.device_id,
      lockToken: parsed.value.lock_token,
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

    if (parsed.value.commands.length > MAX_BATCH) {
      return json({ ok: false, message: `Batch boyutu en fazla ${MAX_BATCH} olabilir.` }, { status: 413 });
    }

    const normalizedCommands = parsed.value.commands.map((command) => ({
      ...command,
      branch_id: command.branch_id ?? parsed.value.branch_id,
      business_id: command.business_id ?? parsed.value.business_id ?? actor.value.businessId,
      actor_id: command.actor_id ?? actor.value.actorId,
      device_id: parsed.value.device_id,
    }));

    const results: OpsCommandResult[] = [];
    for (const command of normalizedCommands) {
      if (command.branch_id !== parsed.value.branch_id) {
        const mismatchResult: OpsCommandResult = {
          command_id: command.command_id,
          idempotency_key: command.idempotency_key,
          status: "REJECT",
          message: "Komut branch_id ile push branch_id uyusmuyor.",
        };
        results.push(mismatchResult);
        await recordCommandAttempt({
          commandId: command.command_id,
          idempotencyKey: command.idempotency_key,
          deviceId: parsed.value.device_id,
          branchId: command.branch_id,
          businessId: command.business_id,
          result: mismatchResult,
        });
        continue;
      }

      const commandResult = await executeOpsCommand(command, { enforceCashOnly: true });
      results.push(commandResult);
      await recordCommandAttempt({
        commandId: command.command_id,
        idempotencyKey: command.idempotency_key,
        deviceId: parsed.value.device_id,
        branchId: command.branch_id,
        businessId: command.business_id,
        result: commandResult,
      });
    }

    const summary = summarize(results);

    logApiEvent("info", "sync.push.completed", {
      correlationId,
      branchId: parsed.value.branch_id,
      deviceId: parsed.value.device_id,
      acceptedCount: summary.accepted_count,
      rejectedCount: summary.rejected_count,
      conflictCount: summary.conflict_count,
      retryCount: summary.retry_count,
    });

    const status = summary.ok ? 200 : summary.conflict_count > 0 ? 409 : summary.retry_count > 0 ? 503 : 207;
    return json(summary, { status });
  } catch (error) {
    logApiEvent("error", "sync.push.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Push senkronu sirasinda beklenmeyen hata olustu." }, { status: 500 });
  }
}
