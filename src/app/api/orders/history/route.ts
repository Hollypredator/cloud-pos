import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getOrderHistoryByTableId, getTableByQr } from "@/lib/domains/orders";
import { getQrAccessFailurePayload, verifyQrAccessToken } from "@/lib/qr-access";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRequestedOrderIds(searchParams: URLSearchParams) {
  if (!searchParams.has("ids")) {
    return null;
  }
  const raw = searchParams.get("ids") ?? "";
  const parsed = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID_REGEX.test(id));
  return new Set(parsed);
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", Math.round(performance.now() - startedAt).toString());
    return response;
  };

  const { searchParams } = new URL(request.url);
  const qrCodeIdentifier = searchParams.get("qr");
  const businessSlug = searchParams.get("b") ?? undefined;
  const accessToken = searchParams.get("t");
  const requestedOrderIds = parseRequestedOrderIds(searchParams);
  if (!qrCodeIdentifier) {
    logApiEvent("warn", "orders.history.missing_qr", { correlationId });
    return json({ ok: false, code: "MISSING_QR", message: "qr parametresi gerekli." }, { status: 400 });
  }

  const tokenCheck = verifyQrAccessToken({ token: accessToken, qrCodeIdentifier, businessSlug });
  if (!tokenCheck.ok) {
    const failure = getQrAccessFailurePayload(tokenCheck.reason);
    logApiEvent(failure.status >= 500 ? "error" : "warn", "orders.history.qr_token_invalid", {
      correlationId,
      reason: tokenCheck.reason,
      qrCodeIdentifier,
      businessSlug: businessSlug ?? null,
    });
    return json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }

  const table = await getTableByQr(qrCodeIdentifier, businessSlug);
  if (!table) {
    logApiEvent("warn", "orders.history.table_not_found", {
      correlationId,
      qrCodeIdentifier,
      businessSlug: businessSlug ?? null,
    });
    return json({ ok: false, code: "TABLE_NOT_FOUND", message: "Masa bulunamadi." }, { status: 404 });
  }

  const { orders } = await getOrderHistoryByTableId(table.id, 8);
  const filteredOrders = requestedOrderIds
    ? orders.filter((order) => requestedOrderIds.has(order.id))
    : orders;
  logApiEvent("info", "orders.history.success", {
    correlationId,
    tableId: table.id,
    qrCodeIdentifier,
    orderCount: filteredOrders.length,
    requestedOrderFilterCount: requestedOrderIds ? requestedOrderIds.size : null,
    operationMs: Math.round(performance.now() - startedAt),
  });

  return json(
    {
      ok: true,
      orders: filteredOrders.map((order) => ({
        id: order.id,
        checkNumber: order.check_number ?? null,
        status: order.status,
        totalPrice: order.total_price,
        finalPrice: order.final_price ?? order.total_price,
        createdAt: order.created_at,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
