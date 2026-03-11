import { NextResponse } from "next/server";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const response = withCorrelationId(
    NextResponse.json(
      {
        ok: true,
        service: "cloud-pos",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    ),
    correlationId,
  );
  logApiEvent("info", "health.check", { correlationId, status: 200 });
  return response;
}
