import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getOpsMetricsSnapshot } from "@/lib/domains/finance";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);

  try {
    const auth = await getCurrentUserWithRole();
    if (!auth.user || !hasRoleAccess(auth.role, ["admin"])) {
      logApiEvent("warn", "metrics.ops.unauthorized", { correlationId });
      return json({ ok: false, message: "Yetkisiz" }, { status: 401 });
    }

    const metrics = await getOpsMetricsSnapshot();
    logApiEvent("info", "metrics.ops.success", { correlationId });
    return json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        metrics,
      },
      { status: 200 },
    );
  } catch (error) {
    logApiEvent("error", "metrics.ops.failure", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Ops metrikleri alinamadi." }, { status: 500 });
  }
}
