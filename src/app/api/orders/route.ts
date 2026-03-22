import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { canUseDemoModeBypass, getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getBusinessContextBySlug, getTableById, getTableByQr } from "@/lib/domains/orders";
import { executeOpsCommand, makeOpsCommandEnvelope } from "@/lib/ops/command-executor";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import { getBusinessScopeContext } from "@/lib/server/app-context";
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
  const startedAt = performance.now();
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = withCorrelationId(NextResponse.json(body, init), correlationId);
    response.headers.set("x-operation-ms", Math.round(performance.now() - startedAt).toString());
    return response;
  };

  try {
    const auth = await getCurrentUserWithRole();
    const allowDemoBypass = canUseDemoModeBypass(auth.usingDemoData);
    const canCreateOrders =
      allowDemoBypass || (!!auth.user && hasRoleAccess(auth.role, ["admin", "waiter", "cashier"]));
    if (!canCreateOrders) {
      logApiEvent("warn", "orders.create.forbidden", { correlationId });
      return json({ ok: false, message: "Siparis olusturma yetkiniz yok." }, { status: 403 });
    }
    const businessScope = allowDemoBypass ? null : await getBusinessScopeContext();

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

    const targetBusinessId = table?.business_id ?? businessContext.businessId ?? null;
    const targetBranchId = table?.branch_id ?? null;
    if (businessScope && !businessScope.useLegacySchema) {
      if (!businessScope.businessId) {
        logApiEvent("warn", "orders.create.no_business_scope", { correlationId });
        return json({ ok: false, message: "Aktif isletme secilmedi." }, { status: 403 });
      }
      if (targetBusinessId && targetBusinessId !== businessScope.businessId) {
        logApiEvent("warn", "orders.create.cross_business_forbidden", {
          correlationId,
          requestedBusinessId: targetBusinessId,
          activeBusinessId: businessScope.businessId,
        });
        return json({ ok: false, message: "Bu isletme icin siparis olusturma yetkiniz yok." }, { status: 403 });
      }
    }
    if (businessScope && auth.accessScope === "branch") {
      const allowedBranchIds = new Set<string>();
      for (const branchId of auth.branchAccessIds ?? []) {
        if (branchId) {
          allowedBranchIds.add(branchId);
        }
      }
      if (auth.primaryBranchId) {
        allowedBranchIds.add(auth.primaryBranchId);
      }

      const candidateBranchId = targetBranchId ?? businessScope.branchId ?? auth.primaryBranchId ?? null;
      if (!candidateBranchId || !allowedBranchIds.has(candidateBranchId)) {
        logApiEvent("warn", "orders.create.cross_branch_forbidden", {
          correlationId,
          candidateBranchId,
          allowedBranchIds: [...allowedBranchIds],
        });
        return json({ ok: false, message: "Bu sube icin siparis olusturma yetkiniz yok." }, { status: 403 });
      }
    }

    const deviceId = request.headers.get("x-device-id")?.trim() || "web-online";
    const command = makeOpsCommandEnvelope({
      type: "ORDER_CREATE",
      deviceId,
      actorId: auth.user?.id ?? null,
      businessId: table?.business_id ?? businessContext.businessId ?? null,
      branchId: targetBranchId ?? null,
      payload: {
        table_id: table?.id ?? null,
        business_id: table?.business_id ?? businessContext.businessId ?? null,
        branch_id: targetBranchId ?? null,
        items: body.items,
        total_price: body.totalPrice,
        channel,
        customer_name: body.customerName ?? null,
        customer_phone: body.customerPhone ?? null,
        delivery_address: body.deliveryAddress ?? null,
        delivery_note: body.deliveryNote ?? null,
        courier_name: body.courierName ?? null,
        courier_phone: body.courierPhone ?? null,
        fulfillment_status: body.fulfillmentStatus ?? null,
      },
      idempotencyKey: request.headers.get("x-idempotency-key")?.trim() || undefined,
      commandId: request.headers.get("x-command-id")?.trim() || undefined,
    });

    const result = await executeOpsCommand(command, { enforceCashOnly: false });
    if (result.status !== "ACK") {
      logApiEvent("error", "orders.create.failed", {
        correlationId,
        channel,
        error: result.message ?? null,
        commandStatus: result.status,
      });
      return json(
        {
          ok: false,
          message: result.message ?? "Siparis kaydedilemedi.",
          resultStatus: result.status,
        },
        { status: result.status === "CONFLICT" ? 409 : result.status === "RETRY" ? 503 : 422 },
      );
    }

    logApiEvent("info", "orders.create.success", {
      correlationId,
      orderId: typeof result.data?.order_id === "string" ? result.data.order_id : null,
      channel,
      commandId: result.command_id,
    });
    return json({
      ok: true,
      orderId: typeof result.data?.order_id === "string" ? result.data.order_id : null,
      commandId: result.command_id,
    });
  } catch (error) {
    logApiEvent("error", "orders.create.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Siparis islemi sirasinda beklenmeyen hata olustu." }, { status: 500 });
  }
}
