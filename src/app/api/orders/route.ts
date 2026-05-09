import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { canUseDemoModeBypass, getCurrentUserWithRole, hasRoleAccess } from "@/lib/auth";
import { getBusinessContextBySlug, getTableById, getTableByQr } from "@/lib/domains/orders";
import { executeOpsCommand, makeOpsCommandEnvelope } from "@/lib/ops/command-executor";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";
import {
  isQrConfirmationEnabledForBusinessSlug,
  QR_CONFIRMATION_UI_VERSION,
  QR_CONFIRMATION_WINDOW_SECONDS,
} from "@/lib/qr-confirmation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { getQrAccessFailurePayload, verifyQrAccessToken } from "@/lib/qr-access";
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
  qrConfirmation?: {
    confirmedAtClient?: string;
    uiVersion?: string;
    cartItemCount?: number;
    cartTotal?: number;
    cartSnapshotHash?: string;
  };
};

function resolveOrderCreateFailureMessage(commandStatus: "ACK" | "RETRY" | "CONFLICT" | "REJECT", message?: string | null) {
  if (commandStatus === "CONFLICT") {
    return message ?? "Ayni siparis istegi zaten islenmis. Lutfen siparis durumunu kontrol edin.";
  }
  if (commandStatus === "RETRY") {
    return message ?? "Siparis gecici olarak islenemedi. Lutfen tekrar deneyin.";
  }
  if (commandStatus === "REJECT") {
    return message ?? "Siparis dogrulanamadi. Lutfen sepeti kontrol edin.";
  }
  return message ?? "Siparis kaydedilemedi.";
}

function parseQrConfirmation(input: Body["qrConfirmation"]) {
  if (!input) {
    return null;
  }

  const confirmedAtClient = typeof input.confirmedAtClient === "string" ? input.confirmedAtClient.trim() : "";
  const uiVersion = typeof input.uiVersion === "string" ? input.uiVersion.trim() : "";
  const cartSnapshotHash = typeof input.cartSnapshotHash === "string" ? input.cartSnapshotHash.trim() : "";
  const cartItemCount = Number(input.cartItemCount);
  const cartTotal = Number(input.cartTotal);

  if (!confirmedAtClient || Number.isNaN(Date.parse(confirmedAtClient))) {
    return null;
  }
  if (!uiVersion || !cartSnapshotHash) {
    return null;
  }
  if (!Number.isFinite(cartItemCount) || cartItemCount < 0) {
    return null;
  }
  if (!Number.isFinite(cartTotal) || cartTotal < 0) {
    return null;
  }

  return {
    confirmedAtClient,
    uiVersion,
    cartSnapshotHash,
    cartItemCount,
    cartTotal,
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
    const auth = await getCurrentUserWithRole();
    const allowDemoBypass = canUseDemoModeBypass(auth.usingDemoData);
    let canCreateOrders =
      allowDemoBypass || (!!auth.user && hasRoleAccess(auth.role, ["admin", "waiter", "cashier"]));
    let isQrOrder = false;

    let body: Body & { qrAccessToken?: string };
    try {
      body = (await request.json()) as Body & { qrAccessToken?: string };
    } catch {
      logApiEvent("warn", "orders.create.invalid_body", { correlationId });
      return json({ ok: false, code: "INVALID_BODY", message: "Gecersiz istek govdesi." }, { status: 400 });
    }

    if (!canCreateOrders && body.qrAccessToken && body.qrCodeIdentifier) {
      const tokenCheck = verifyQrAccessToken({
        token: body.qrAccessToken,
        qrCodeIdentifier: body.qrCodeIdentifier,
        businessSlug: body.businessSlug,
      });
      if (tokenCheck.ok) {
        canCreateOrders = true;
        isQrOrder = true;
      } else {
        const failure = getQrAccessFailurePayload(tokenCheck.reason);
        logApiEvent(failure.status >= 500 ? "error" : "warn", "orders.create.qr_token_invalid", {
          correlationId,
          reason: tokenCheck.reason,
          qrCodeIdentifier: body.qrCodeIdentifier,
          businessSlug: body.businessSlug ?? null,
        });
        return json({ ok: false, code: failure.code, message: failure.message }, { status: failure.status });
      }
    }

    if (!canCreateOrders) {
      logApiEvent("warn", "orders.create.forbidden", { correlationId });
      return json({ ok: false, code: "FORBIDDEN", message: "Siparis olusturma yetkiniz yok." }, { status: 403 });
    }

    const businessScope = allowDemoBypass ? null : await getBusinessScopeContext();
    const operatingProfile = resolveOperatingProfile(businessScope?.activeBusinessType);

    let channel = isQrOrder ? "dine_in" : (body.channel ?? "dine_in");
    if (operatingProfile === "coffee_self_service") {
      channel = "pickup";
    }
    const qrConfirmationRequired = isQrOrder && isQrConfirmationEnabledForBusinessSlug(body.businessSlug);
    const parsedQrConfirmation = parseQrConfirmation(body.qrConfirmation);
    if (qrConfirmationRequired && !parsedQrConfirmation) {
      logApiEvent("warn", "orders.create.qr_confirmation_invalid", {
        correlationId,
        businessSlug: body.businessSlug ?? null,
        qrCodeIdentifier: body.qrCodeIdentifier ?? null,
      });
      return json(
        {
          ok: false,
          code: "QR_CONFIRMATION_REQUIRED",
          message: "Siparis onayi eksik veya gecersiz. Lutfen siparis onay ekranini tamamlayin.",
        },
        { status: 400 },
      );
    }
    if (!body.items?.length || typeof body.totalPrice !== "number") {
      logApiEvent("warn", "orders.create.missing_fields", { correlationId, channel });
      return json({ ok: false, code: "MISSING_FIELDS", message: "Eksik siparis alanlari var." }, { status: 400 });
    }

    if (channel === "dine_in" && !body.qrCodeIdentifier && !body.tableId) {
      logApiEvent("warn", "orders.create.missing_qr", { correlationId });
      return json({ ok: false, code: "MISSING_TABLE", message: "Masa siparisi icin masa secimi gerekli." }, { status: 400 });
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
      return json({ ok: false, code: "TABLE_NOT_FOUND", message: "Masa bulunamadi." }, { status: 404 });
    }

    if (channel === "dine_in" && table && body.tableId && table.id !== body.tableId) {
      logApiEvent("warn", "orders.create.table_mismatch", {
        correlationId,
        tableId: body.tableId,
        resolvedTableId: table.id,
      });
      return json({ ok: false, code: "TABLE_MISMATCH", message: "Masa secimi dogrulanamadi." }, { status: 400 });
    }

    if (channel === "dine_in" && table && body.qrCodeIdentifier && table.qr_code_identifier !== body.qrCodeIdentifier) {
      logApiEvent("warn", "orders.create.qr_mismatch", {
        correlationId,
        qrCodeIdentifier: body.qrCodeIdentifier,
        resolvedQr: table.qr_code_identifier,
      });
      return json({ ok: false, code: "QR_MISMATCH", message: "Masa QR bilgisi dogrulanamadi." }, { status: 400 });
    }

    const businessContext = table
      ? { businessId: table.business_id, branchId: table.branch_id }
      : await getBusinessContextBySlug(body.businessSlug);

    const targetBusinessId = table?.business_id ?? businessContext.businessId ?? null;
    const targetBranchId = table?.branch_id ?? null;

    if (operatingProfile === "coffee_self_service" && !table && targetBusinessId && targetBranchId) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: virtualTable } = await supabase
          .from("tables")
          .select("id, business_id, branch_id")
          .eq("business_id", targetBusinessId)
          .eq("branch_id", targetBranchId)
          .eq("name", "Pickup Counter")
          .limit(1)
          .maybeSingle();
        if (virtualTable) {
          table = virtualTable as any;
        }
      }
    }

    if (businessScope && !businessScope.useLegacySchema) {
      if (!businessScope.businessId) {
        logApiEvent("warn", "orders.create.no_business_scope", { correlationId });
        return json({ ok: false, code: "NO_BUSINESS_SCOPE", message: "Aktif isletme secilmedi." }, { status: 403 });
      }
      if (targetBusinessId && targetBusinessId !== businessScope.businessId) {
        logApiEvent("warn", "orders.create.cross_business_forbidden", {
          correlationId,
          requestedBusinessId: targetBusinessId,
          activeBusinessId: businessScope.businessId,
        });
        return json({ ok: false, code: "CROSS_BUSINESS_FORBIDDEN", message: "Bu isletme icin siparis olusturma yetkiniz yok." }, { status: 403 });
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
        return json({ ok: false, code: "CROSS_BRANCH_FORBIDDEN", message: "Bu sube icin siparis olusturma yetkiniz yok." }, { status: 403 });
      }
    }

    const deviceId = isQrOrder ? "QR_MENU" : (request.headers.get("x-device-id")?.trim() || "web-online");
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
        customer_name: isQrOrder ? "QR Siparis" : (body.customerName ?? null),
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
      const statusCode = result.status === "CONFLICT" ? 409 : result.status === "RETRY" ? 503 : 422;
      const message = resolveOrderCreateFailureMessage(result.status, result.message);
      logApiEvent("error", "orders.create.failed", {
        correlationId,
        channel,
        error: result.message ?? null,
        commandStatus: result.status,
        operationMs: Math.round(performance.now() - startedAt),
      });
      return json(
        {
          ok: false,
          code: `ORDER_CREATE_${result.status}`,
          message,
          resultStatus: result.status,
        },
        { status: statusCode },
      );
    }

    const createdOrderId = typeof result.data?.order_id === "string" ? result.data.order_id : null;
    let confirmationPayload:
      | {
          confirmationId: string;
          confirmedAt: string;
          cancelUntil: string;
          cancelWindowSeconds: number;
        }
      | null = null;

    if (isQrOrder && createdOrderId && table && parsedQrConfirmation) {
      const confirmedAt = new Date().toISOString();
      const cancelUntil = new Date(Date.now() + QR_CONFIRMATION_WINDOW_SECONDS * 1000).toISOString();
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const snapshotPayload = {
          confirmedAtClient: parsedQrConfirmation.confirmedAtClient,
          confirmedAtServer: confirmedAt,
          cartItemCount: parsedQrConfirmation.cartItemCount,
          cartTotal: parsedQrConfirmation.cartTotal,
          payloadTotal: body.totalPrice ?? null,
          payloadItemCount: body.items?.length ?? null,
          items: body.items ?? [],
        };
        const insertResult = await supabase
          .from("order_confirmation_snapshots")
          .insert({
            order_id: createdOrderId,
            business_id: table.business_id ?? null,
            branch_id: table.branch_id ?? null,
            table_id: table.id,
            qr_code_identifier: table.qr_code_identifier,
            confirmed_at: confirmedAt,
            cancel_until: cancelUntil,
            snapshot_json: snapshotPayload,
            snapshot_hash: parsedQrConfirmation.cartSnapshotHash,
            ui_version: parsedQrConfirmation.uiVersion || QR_CONFIRMATION_UI_VERSION,
          })
          .select("id")
          .maybeSingle();

        if (!insertResult.error && insertResult.data?.id) {
          confirmationPayload = {
            confirmationId: insertResult.data.id,
            confirmedAt,
            cancelUntil,
            cancelWindowSeconds: QR_CONFIRMATION_WINDOW_SECONDS,
          };
          logApiEvent("info", "qr.confirmation.accepted", {
            correlationId,
            orderId: createdOrderId,
            confirmationId: insertResult.data.id,
            businessSlug: body.businessSlug ?? null,
            qrCodeIdentifier: body.qrCodeIdentifier ?? null,
          });
        } else {
          logApiEvent("error", "qr.confirmation.insert_failed", {
            correlationId,
            orderId: createdOrderId,
            error: insertResult.error?.message ?? "unknown",
            businessSlug: body.businessSlug ?? null,
            qrCodeIdentifier: body.qrCodeIdentifier ?? null,
          });
        }
      }
    }

    logApiEvent("info", "orders.create.success", {
      correlationId,
      orderId: createdOrderId,
      channel,
      commandId: result.command_id,
      isQrOrder,
      operationMs: Math.round(performance.now() - startedAt),
    });
    return json({
      ok: true,
      orderId: createdOrderId,
      commandId: result.command_id,
      confirmation: confirmationPayload,
    });
  } catch (error) {
    logApiEvent("error", "orders.create.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, code: "UNHANDLED", message: "Siparis islemi sirasinda beklenmeyen hata olustu." }, { status: 500 });
  }
}
