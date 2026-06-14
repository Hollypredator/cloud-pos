import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { getTableByQr } from "@/lib/domains/orders";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { getQrAccessFailurePayload, verifyQrAccessToken } from "@/lib/qr-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  qrCodeIdentifier?: string;
  businessSlug?: string;
  qrAccessToken?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const startedAt = performance.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", Math.round(performance.now() - startedAt).toString());
    return response;
  };

  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return json({ ok: false, code: "MISSING_ORDER_ID", message: "Sipariş kimligi geçersiz." }, { status: 400 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ ok: false, code: "INVALID_BODY", message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const qrCodeIdentifier = body.qrCodeIdentifier?.trim();
    if (!qrCodeIdentifier) {
      return json({ ok: false, code: "MISSING_QR", message: "qrCodeIdentifier zorunlu." }, { status: 400 });
    }

    const tokenCheck = verifyQrAccessToken({
      token: body.qrAccessToken,
      qrCodeIdentifier,
      businessSlug: body.businessSlug,
    });
    if (!tokenCheck.ok) {
      const failure = getQrAccessFailurePayload(tokenCheck.reason);
      logApiEvent(failure.status >= 500 ? "error" : "warn", "qr.cancel.rejected", {
        correlationId,
        reason: tokenCheck.reason,
        orderId,
        qrCodeIdentifier,
        businessSlug: body.businessSlug ?? null,
      });
      return json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
    }

    const table = await getTableByQr(qrCodeIdentifier, body.businessSlug);
    if (!table) {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "TABLE_NOT_FOUND",
        orderId,
        qrCodeIdentifier,
        businessSlug: body.businessSlug ?? null,
      });
      return json({ ok: false, code: "TABLE_NOT_FOUND", message: "Masa bulunamadı." }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return json({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Servis gecici olarak kullanilamiyor." }, { status: 503 });
    }

    logApiEvent("info", "qr.cancel.request", {
      correlationId,
      orderId,
      qrCodeIdentifier,
      businessSlug: body.businessSlug ?? null,
    });

    let orderQuery = supabase
      .from("orders")
      .select("id, table_id, status, business_id, branch_id")
      .eq("id", orderId)
      .eq("table_id", table.id);

    if (table.business_id) {
      orderQuery = orderQuery.eq("business_id", table.business_id);
    }
    if (table.branch_id) {
      orderQuery = orderQuery.eq("branch_id", table.branch_id);
    }

    const { data: orderRow, error: orderError } = await orderQuery.maybeSingle();
    if (orderError || !orderRow) {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "ORDER_NOT_FOUND_FOR_TABLE",
        orderId,
        tableId: table.id,
      });
      return json({ ok: false, code: "ORDER_NOT_FOUND", message: "Sipariş bulunamadı." }, { status: 404 });
    }

    if (orderRow.status === "cancelled") {
      return json({ ok: true, alreadyCancelled: true });
    }

    if (orderRow.status !== "pending") {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "ORDER_NOT_PENDING",
        orderId,
        status: orderRow.status,
      });
      return json({ ok: false, code: "ORDER_NOT_CANCELLABLE", message: "Sipariş artik iptal edilemez durumda." }, { status: 409 });
    }

    const snapshotResult = await supabase
      .from("order_confirmation_snapshots")
      .select("id, cancel_until")
      .eq("order_id", orderId)
      .eq("table_id", table.id)
      .eq("qr_code_identifier", qrCodeIdentifier)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotResult.error || !snapshotResult.data) {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "CONFIRMATION_NOT_FOUND",
        orderId,
        tableId: table.id,
      });
      return json({ ok: false, code: "CONFIRMATION_NOT_FOUND", message: "Bu sipariş icin iptal penceresi bulunamadı." }, { status: 409 });
    }

    const cancelUntil = new Date(snapshotResult.data.cancel_until);
    if (Number.isNaN(cancelUntil.getTime()) || cancelUntil.getTime() <= Date.now()) {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "CANCEL_WINDOW_EXPIRED",
        orderId,
        cancelUntil: snapshotResult.data.cancel_until,
      });
      return json({ ok: false, code: "CANCEL_WINDOW_EXPIRED", message: "İptal süresi doldu." }, { status: 409 });
    }

    const { data: paymentRows, error: paymentError } = await supabase
      .from("payments")
      .select("payment_type, amount")
      .eq("order_id", orderId);

    if (paymentError) {
      return json({ ok: false, code: "PAYMENT_CHECK_FAILED", message: "Ödeme kontrolü yapilamadi." }, { status: 503 });
    }

    const netPayment = (paymentRows ?? []).reduce((acc, row) => {
      const amount = Number((row as { amount?: number }).amount ?? 0);
      const paymentType = (row as { payment_type?: string }).payment_type;
      return paymentType === "refund" ? acc - amount : acc + amount;
    }, 0);
    if (netPayment > 0) {
      logApiEvent("warn", "qr.cancel.rejected", {
        correlationId,
        reason: "PAYMENT_EXISTS",
        orderId,
        netPayment,
      });
      return json({ ok: false, code: "PAYMENT_EXISTS", message: "Tahsilat alinan sipariş iptal edilemez." }, { status: 409 });
    }

    let cancelUpdate = supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("table_id", table.id);
    if (table.business_id) {
      cancelUpdate = cancelUpdate.eq("business_id", table.business_id);
    }
    if (table.branch_id) {
      cancelUpdate = cancelUpdate.eq("branch_id", table.branch_id);
    }
    const cancelResult = await cancelUpdate;
    if (cancelResult.error) {
      return json({ ok: false, code: "ORDER_CANCEL_FAILED", message: "Sipariş iptal edilirken hata olustu." }, { status: 500 });
    }

    await supabase.from("tables").update({ status: "empty" }).eq("id", table.id);

    logApiEvent("info", "qr.cancel.accepted", {
      correlationId,
      orderId,
      confirmationId: snapshotResult.data.id,
      tableId: table.id,
      qrCodeIdentifier,
      operationMs: Math.round(performance.now() - startedAt),
    });

    return json({ ok: true });
  } catch (error) {
    logApiEvent("error", "qr.cancel.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, code: "UNHANDLED", message: "Beklenmeyen bir hata olustu." }, { status: 500 });
  }
}
