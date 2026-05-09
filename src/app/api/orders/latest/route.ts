import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getLatestOrderByTableId, getTableByQr } from "@/lib/domains/orders";
import { getQrAccessFailurePayload, verifyQrAccessToken } from "@/lib/qr-access";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

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
  if (!qrCodeIdentifier) {
    logApiEvent("warn", "orders.latest.missing_qr", { correlationId });
    return json({ ok: false, code: "MISSING_QR", message: "qr parametresi gerekli." }, { status: 400 });
  }

  const tokenCheck = verifyQrAccessToken({ token: accessToken, qrCodeIdentifier, businessSlug });
  if (!tokenCheck.ok) {
    const failure = getQrAccessFailurePayload(tokenCheck.reason);
    logApiEvent(failure.status >= 500 ? "error" : "warn", "orders.latest.qr_token_invalid", {
      correlationId,
      reason: tokenCheck.reason,
      qrCodeIdentifier,
      businessSlug: businessSlug ?? null,
    });
    return json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
  }

  const table = await getTableByQr(qrCodeIdentifier, businessSlug);
  if (!table) {
    logApiEvent("warn", "orders.latest.table_not_found", {
      correlationId,
      qrCodeIdentifier,
      businessSlug: businessSlug ?? null,
    });
    return json({ ok: false, code: "TABLE_NOT_FOUND", message: "Masa bulunamadi." }, { status: 404 });
  }

  const { order } = await getLatestOrderByTableId(table.id);
  if (!order) {
    logApiEvent("info", "orders.latest.empty", {
      correlationId,
      qrCodeIdentifier,
      tableId: table.id,
      operationMs: Math.round(performance.now() - startedAt),
    });
    return json(
      { ok: true, order: null },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const delayLevel =
    order.status === "pending" && elapsedMin >= 25
      ? "critical"
      : order.status === "preparing" && elapsedMin >= 35
        ? "critical"
        : order.status === "pending" && elapsedMin >= 15
          ? "warning"
          : order.status === "preparing" && elapsedMin >= 20
            ? "warning"
            : "normal";

  if (delayLevel !== "normal") {
    logApiEvent(delayLevel === "critical" ? "error" : "warn", "orders.latest.delay_alert", {
      correlationId,
      orderId: order.id,
      tableId: table.id,
      status: order.status,
      delayLevel,
      elapsedMin,
    });
  }

  logApiEvent("info", "orders.latest.success", {
    correlationId,
    orderId: order.id,
    tableId: table.id,
    status: order.status,
    delayLevel,
    operationMs: Math.round(performance.now() - startedAt),
  });

  return json(
    {
      ok: true,
      order: {
        id: order.id,
        checkNumber: order.check_number ?? null,
        status: order.status,
        totalPrice: order.total_price,
        finalPrice: order.final_price ?? order.total_price,
        createdAt: order.created_at,
        items: order.items.map((item) => ({
          productId: item.product_id,
          name: item.name,
          quantity: item.quantity,
        })),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
