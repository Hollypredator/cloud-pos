import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { canAccessBranch, getSyncActorContext } from "@/lib/sync/access";
import { acquireBranchLock, getBranchLockState, releaseBranchLock, renewBranchLock } from "@/lib/sync/branch-lock";

type LockAction = "acquire" | "renew" | "release" | "state";

type LockRequestBody = {
  action?: LockAction;
  branch_id?: string;
  business_id?: string | null;
  device_id?: string;
  lock_token?: string;
  ttl_seconds?: number;
};

function asString(input: unknown) {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : null;
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

    let body: LockRequestBody;
    try {
      body = (await request.json()) as LockRequestBody;
    } catch {
      return json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const action = (body.action ?? "state") as LockAction;
    const branchId = asString(body.branch_id) ?? actor.value.branchId;
    const businessId = asString(body.business_id) ?? actor.value.businessId;
    const deviceId = asString(body.device_id) ?? request.headers.get("x-device-id")?.trim() ?? "web-online";
    const lockToken = asString(body.lock_token);
    const ttlSeconds = Number(body.ttl_seconds);

    if (!branchId) {
      return json({ ok: false, message: "branch_id zorunlu." }, { status: 400 });
    }

    if (!canAccessBranch({ actor: actor.value, branchId })) {
      return json({ ok: false, message: "Bu sube icin lock yetkiniz yok." }, { status: 403 });
    }

    if (action === "state") {
      const stateResult = await getBranchLockState(branchId);
      if (!stateResult.ok) {
        return json({ ok: false, message: stateResult.error }, { status: 503 });
      }
      return json({ ok: true, state: stateResult.state ?? null });
    }

    if (action === "acquire") {
      const result = await acquireBranchLock({
        branchId,
        businessId,
        deviceId,
        actorId: actor.value.actorId,
        ttlSeconds: Number.isFinite(ttlSeconds) ? ttlSeconds : undefined,
      });
      if (!result.ok) {
        const status = result.conflict ? 409 : 503;
        return json(
          {
            ok: false,
            message: result.error,
            conflict: result.conflict ?? null,
          },
          { status },
        );
      }
      logApiEvent("info", "sync.lock.acquired", {
        correlationId,
        branchId,
        deviceId,
      });
      return json({ ok: true, state: result.state });
    }

    if (action === "renew") {
      if (!lockToken) {
        return json({ ok: false, message: "renew icin lock_token zorunlu." }, { status: 400 });
      }
      const result = await renewBranchLock({
        branchId,
        deviceId,
        lockToken,
        actorId: actor.value.actorId,
        ttlSeconds: Number.isFinite(ttlSeconds) ? ttlSeconds : undefined,
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            message: result.error,
            conflict: result.conflict ?? null,
          },
          { status: result.conflict ? 409 : 503 },
        );
      }
      return json({ ok: true, state: result.state });
    }

    if (action === "release") {
      if (!lockToken) {
        return json({ ok: false, message: "release icin lock_token zorunlu." }, { status: 400 });
      }

      const result = await releaseBranchLock({
        branchId,
        deviceId,
        lockToken,
        actorId: actor.value.actorId,
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            message: result.error,
            conflict: result.conflict ?? null,
          },
          { status: result.conflict ? 409 : 503 },
        );
      }
      return json({ ok: true, state: result.state ?? null });
    }

    return json({ ok: false, message: "Desteklenmeyen lock action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logApiEvent("error", "sync.lock.unhandled", {
      correlationId,
      error: message,
    });
    return json({ ok: false, message: "Lock islemi sirasinda beklenmeyen hata olustu." }, { status: 500 });
  }
}
