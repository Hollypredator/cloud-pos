import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { canAccessBranch, getSyncActorContext } from "@/lib/sync/access";
import { listSyncEvents, parseSyncCursor } from "@/lib/sync/events";
import type { SyncPullResponse } from "@/lib/types";

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const branchId = url.searchParams.get("branch_id") ?? actor.value.branchId;
    const businessId = url.searchParams.get("business_id") ?? actor.value.businessId;
    const cursor = parseSyncCursor(url.searchParams.get("cursor"));
    const limit = Number(url.searchParams.get("limit") ?? "100");

    if (!branchId) {
      return json({ ok: false, message: "branch_id zorunlu." }, { status: 400 });
    }

    if (!canAccessBranch({ actor: actor.value, branchId })) {
      return json({ ok: false, message: "Bu şube için pull yetkiniz yok." }, { status: 403 });
    }

    const result = await listSyncEvents({
      businessId,
      branchId,
      cursor,
      limit: Number.isFinite(limit) ? limit : 100,
    });

    if (!result.ok) {
      return json({ ok: false, message: result.error }, { status: 503 });
    }

    const response: SyncPullResponse = {
      ok: true,
      next_cursor: result.nextCursor,
      events: result.events,
    };

    return json(response);
  } catch (error) {
    logApiEvent("error", "sync.pull.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Pull senkronu sırasında beklenmeyen hata oluştu." }, { status: 500 });
  }
}
