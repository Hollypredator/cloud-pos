import { NextResponse } from "next/server";
import { getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { createOrder, getBusinessContextBySlug, getTableById, getTableByQr } from "@/lib/domains/orders";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import type { FulfillmentStatus, OrderChannel } from "@/lib/types";

type Body = {
  tableId?: string;
  businessSlug?: string;
  qrCodeIdentifier?: string;
  channel?: OrderChannel;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNote?: string;
  courierName?: string;
  courierPhone?: string;
  fulfillmentStatus?: FulfillmentStatus;
  items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    modifiers?: Array<{
      group_id?: string;
      group_name: string;
      option_id?: string;
      option_name: string;
      price_delta: number;
      quantity?: number;
    }>;
  }>;
  totalPrice?: number;
};

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);

  try {
    const auth = await getCurrentUserWithRole();
    const canCreateOrders =
      auth.usingDemoData || (!!auth.user && hasRoleAccess(auth.role, ["admin", "waiter", "cashier"]));
    if (!canCreateOrders) {
      logApiEvent("warn", "orders.create.forbidden", { correlationId });
      return json({ ok: false, message: "Siparis olusturma yetkiniz yok." }, { status: 403 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      logApiEvent("warn", "orders.create.invalid_body", { correlationId });
      return json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const channel = body.channel ?? "dine_in";
    if (!body.items?.length || typeof body.totalPrice !== "number") {
      logApiEvent("warn", "orders.create.missing_fields", { correlationId, channel });
      return json({ ok: false, message: "Eksik siparis alanlari var." }, { status: 400 });
    }

    if (channel === "dine_in" && !body.qrCodeIdentifier && !body.tableId) {
      logApiEvent("warn", "orders.create.missing_qr", { correlationId });
      return json({ ok: false, message: "Masa siparisi icin masa secimi gerekli." }, { status: 400 });
    }

    let table = null;
    if (body.qrCodeIdentifier) {
      table = await getTableByQr(body.qrCodeIdentifier, body.businessSlug);
    } else if (body.tableId) {
      table = await getTableById(body.tableId, body.businessSlug);
    }

    if (!table && body.tableId) {
      table = await getTableById(body.tableId, body.businessSlug);
    }

    if (!table && body.qrCodeIdentifier) {
      table = await getTableByQr(body.qrCodeIdentifier, body.businessSlug);
    }

    if (channel === "dine_in" && !table) {
      logApiEvent("warn", "orders.create.table_not_found", {
        correlationId,
        tableId: body.tableId ?? null,
        qrCodeIdentifier: body.qrCodeIdentifier ?? null,
      });
      return json({ ok: false, message: "Masa bulunamadi." }, { status: 404 });
    }

    if (channel === "dine_in" && table && body.tableId && table.id !== body.tableId) {
      logApiEvent("warn", "orders.create.table_mismatch", {
        correlationId,
        tableId: body.tableId,
        resolvedTableId: table.id,
      });
      return json({ ok: false, message: "Masa secimi dogrulanamadi." }, { status: 400 });
    }

    if (channel === "dine_in" && table && body.qrCodeIdentifier && table.qr_code_identifier !== body.qrCodeIdentifier) {
      logApiEvent("warn", "orders.create.qr_mismatch", {
        correlationId,
        qrCodeIdentifier: body.qrCodeIdentifier,
        resolvedQr: table.qr_code_identifier,
      });
      return json({ ok: false, message: "Masa QR bilgisi dogrulanamadi." }, { status: 400 });
    }

    const businessContext = table
      ? { businessId: table.business_id, branchId: table.branch_id }
      : await getBusinessContextBySlug(body.businessSlug);
    const result = await createOrder({
      tableId: table?.id ?? null,
      businessId: table?.business_id ?? businessContext.businessId ?? undefined,
      branchId: table?.branch_id ?? undefined,
      items: body.items,
      totalPrice: body.totalPrice,
      channel,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      deliveryAddress: body.deliveryAddress,
      deliveryNote: body.deliveryNote,
      courierName: body.courierName,
      courierPhone: body.courierPhone,
      fulfillmentStatus: body.fulfillmentStatus,
    });

    if (!result.ok) {
      logApiEvent("error", "orders.create.failed", {
        correlationId,
        channel,
        error: result.error ?? null,
      });
      return json(
        {
          ok: false,
          message: result.error ?? "Siparis kaydedilemedi.",
        },
        { status: 500 },
      );
    }

    logApiEvent("info", "orders.create.success", {
      correlationId,
      orderId: result.id ?? null,
      channel,
    });
    return json({ ok: true, orderId: result.id });
  } catch (error) {
    logApiEvent("error", "orders.create.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Siparis islemi sirasinda beklenmeyen hata olustu." }, { status: 500 });
  }
}
