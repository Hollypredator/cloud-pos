import {
  applyOrderFinancials,
  assignOrderCourier,
  cancelOrder,
  cancelOrderItem,
  completeOrderPayment,
  createOrder,
  markDeliveryCompleted,
  refundOrder,
  updateOrderStationStatus,
  updateOrderStatus,
} from "@/lib/domains/orders";
import { closeCashSession, openCashSession } from "@/lib/domains/finance";
import { resolveTableRequest, updateTableStatus } from "@/lib/domains/tables";
import type {
  FulfillmentStatus,
  OpsCommand,
  OpsCommandResult,
  OpsCommandResultStatus,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PrepStation,
  TableStatus,
} from "@/lib/types";

type ExecuteCommandOptions = {
  enforceCashOnly?: boolean;
};

function asString(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function asNumber(input: unknown) {
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function asRecord(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function classifyFailure(message?: string | null): OpsCommandResultStatus {
  const normalized = (message ?? "").toLowerCase();
  if (
    normalized.includes("conflict") ||
    normalized.includes("baska bir kullanıcı") ||
    normalized.includes("lock") ||
    normalized.includes("kilit")
  ) {
    return "CONFLICT";
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("tempor") ||
    normalized.includes("tekrar deneyin") ||
    normalized.includes("unavailable")
  ) {
    return "RETRY";
  }
  return "REJECT";
}

function commandResult(
  command: OpsCommand,
  status: OpsCommandResultStatus,
  extras?: Partial<Omit<OpsCommandResult, "command_id" | "idempotency_key" | "status">>,
): OpsCommandResult {
  return {
    command_id: command.command_id,
    idempotency_key: command.idempotency_key,
    status,
    applied_at: status === "ACK" ? new Date().toISOString() : undefined,
    ...extras,
  };
}

function toOrderItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) {
    return [] as OrderItem[];
  }

  const normalizedItems: OrderItem[] = [];
  for (const rawItem of rawItems) {
    const item = asRecord(rawItem);
    if (!item) {
      continue;
    }

    const productId = asString(item.product_id);
    const name = asString(item.name);
    const quantity = asNumber(item.quantity);
    const unitPrice = asNumber(item.unit_price);
    const lineTotal = asNumber(item.line_total);
    if (!productId || !name || quantity === null || unitPrice === null || lineTotal === null) {
      continue;
    }

    normalizedItems.push({
      product_id: productId,
      name,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      modifiers: Array.isArray(item.modifiers)
        ? item.modifiers
            .map((modifier) => {
              const normalized = asRecord(modifier);
              if (!normalized) {
                return null;
              }
              const groupName = asString(normalized.group_name);
              const optionName = asString(normalized.option_name);
              const priceDelta = asNumber(normalized.price_delta);
              if (!groupName || !optionName || priceDelta === null) {
                return null;
              }
              return {
                group_id: asString(normalized.group_id) ?? undefined,
                group_name: groupName,
                option_id: asString(normalized.option_id) ?? undefined,
                option_name: optionName,
                price_delta: priceDelta,
                quantity: asNumber(normalized.quantity) ?? undefined,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        : undefined,
    });
  }

  return normalizedItems;
}

function isValidTableStatus(value: unknown): value is TableStatus {
  return value === "empty" || value === "occupied" || value === "reserved";
}

function isValidOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending" ||
    value === "preparing" ||
    value === "ready" ||
    value === "served" ||
    value === "partially_paid" ||
    value === "paid" ||
    value === "partially_refunded" ||
    value === "cancelled" ||
    value === "refunded"
  );
}

function isValidStation(value: unknown): value is PrepStation {
  return value === "kitchen" || value === "bar" || value === "dessert";
}

function isValidOrderChannel(value: unknown): value is OrderChannel {
  return value === "dine_in" || value === "pickup" || value === "delivery";
}

function isValidFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return value === "not_applicable" || value === "awaiting_dispatch" || value === "out_for_delivery" || value === "completed";
}

function flattenResultData(result: Record<string, unknown>) {
  const data = { ...result };
  delete data.ok;
  delete data.error;
  return Object.keys(data).length > 0 ? data : undefined;
}

function ensureCashMethod(payload: Record<string, unknown>, enforceCashOnly: boolean) {
  const method = asString(payload.method) as PaymentMethod | null;
  if (!enforceCashOnly) {
    return method ?? "cash";
  }
  if (method && method !== "cash") {
    return null;
  }
  return "cash";
}

function ensureOrderCreateInput(command: OpsCommand, payload: Record<string, unknown>) {
  const items = toOrderItems(payload.items);
  const totalPrice = asNumber(payload.total_price ?? payload.totalPrice);
  const channelRaw = payload.channel;
  const channel = isValidOrderChannel(channelRaw) ? channelRaw : "dine_in";

  if (items.length === 0 || totalPrice === null) {
    return { ok: false as const, error: "ORDER_CREATE için items ve total_price zorunlu." };
  }

  return {
    ok: true as const,
    input: {
      tableId: asString(payload.table_id),
      businessId: command.business_id ?? asString(payload.business_id) ?? undefined,
      branchId: command.branch_id ?? asString(payload.branch_id) ?? undefined,
      items,
      totalPrice,
      channel,
      customerName: asString(payload.customer_name) ?? undefined,
      customerPhone: asString(payload.customer_phone) ?? undefined,
      deliveryAddress: asString(payload.delivery_address) ?? undefined,
      deliveryNote: asString(payload.delivery_note) ?? undefined,
      courierName: asString(payload.courier_name) ?? undefined,
      courierPhone: asString(payload.courier_phone) ?? undefined,
      courierId: asString(payload.courier_id) ?? undefined,
      fulfillmentStatus: isValidFulfillmentStatus(payload.fulfillment_status)
        ? payload.fulfillment_status
        : undefined,
    },
  };
}

export async function executeOpsCommand(command: OpsCommand, options?: ExecuteCommandOptions): Promise<OpsCommandResult> {
  const payload = asRecord(command.payload);
  if (!payload) {
    return commandResult(command, "REJECT", { message: "payload gecerli bir obje olmali." });
  }

  const cashOnly = options?.enforceCashOnly ?? false;

  try {
    switch (command.type) {
      case "ORDER_CREATE": {
        const parsed = ensureOrderCreateInput(command, payload);
        if (!parsed.ok) {
          return commandResult(command, "REJECT", { message: parsed.error });
        }
        const result = await createOrder(parsed.input);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Sipariş oluşturulamadı." });
        }
        return commandResult(command, "ACK", {
          data: {
            order_id: result.id ?? null,
            using_demo_data: result.usingDemoData ?? false,
          },
        });
      }

      case "ORDER_STATUS_SET": {
        const orderId = asString(payload.order_id);
        if (!orderId || !isValidOrderStatus(payload.status)) {
          return commandResult(command, "REJECT", { message: "ORDER_STATUS_SET için order_id ve status zorunlu." });
        }
        const station = payload.station;
        const result =
          isValidStation(station) && (payload.status === "pending" || payload.status === "preparing" || payload.status === "served")
            ? await updateOrderStationStatus(orderId, station, payload.status)
            : await updateOrderStatus(orderId, payload.status);
        if (!result.ok) {
          const errorMessage = "error" in result && typeof result.error === "string" ? result.error : "Sipariş durumu güncellenemedi.";
          return commandResult(command, classifyFailure(errorMessage), { message: errorMessage });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "ORDER_FINANCIALS_SET": {
        const orderId = asString(payload.order_id);
        const discountAmount = asNumber(payload.discount_amount);
        const serviceFee = asNumber(payload.service_fee);
        if (!orderId || discountAmount === null || serviceFee === null) {
          return commandResult(command, "REJECT", { message: "ORDER_FINANCIALS_SET için order_id, discount_amount ve service_fee zorunlu." });
        }
        const result = await applyOrderFinancials({ orderId, discountAmount, serviceFee });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Finansal güncelleme başarısız." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "ORDER_ITEM_CANCEL": {
        const orderId = asString(payload.order_id);
        const productId = asString(payload.product_id);
        if (!orderId || !productId) {
          return commandResult(command, "REJECT", { message: "ORDER_ITEM_CANCEL için order_id ve product_id zorunlu." });
        }
        const result = await cancelOrderItem(orderId, productId);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Kalem iptal edilemedi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "PAYMENT_SALE_CASH": {
        const orderId = asString(payload.order_id);
        const method = ensureCashMethod(payload, cashOnly);
        const amount = asNumber(payload.amount);
        if (!orderId) {
          return commandResult(command, "REJECT", { message: "PAYMENT_SALE_CASH için order_id zorunlu." });
        }
        if (!method || method !== "cash") {
          return commandResult(command, "REJECT", { message: "Offline modda sadece cash ödeme kabul edilir." });
        }
        const result = await completeOrderPayment({
          orderId,
          method,
          amount: amount ?? undefined,
          note: asString(payload.note) ?? undefined,
          createdBy: command.actor_id ?? undefined,
          requestKey: command.idempotency_key,
        });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Nakit tahsilat başarısız." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "ORDER_CANCEL": {
        const orderId = asString(payload.order_id);
        if (!orderId) {
          return commandResult(command, "REJECT", { message: "ORDER_CANCEL için order_id zorunlu." });
        }
        const result = await cancelOrder(orderId, asString(payload.note) ?? undefined, command.idempotency_key);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Sipariş iptal edilemedi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "ORDER_REFUND_CASH": {
        const orderId = asString(payload.order_id);
        const method = ensureCashMethod(payload, cashOnly);
        const amount = asNumber(payload.amount);
        if (!orderId) {
          return commandResult(command, "REJECT", { message: "ORDER_REFUND_CASH için order_id zorunlu." });
        }
        if (!method || method !== "cash") {
          return commandResult(command, "REJECT", { message: "Offline modda sadece cash iade kabul edilir." });
        }
        const result = await refundOrder({
          orderId,
          method,
          amount: amount ?? undefined,
          note: asString(payload.note) ?? undefined,
          createdBy: command.actor_id ?? undefined,
          requestKey: command.idempotency_key,
        });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Nakit iade başarısız." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "DELIVERY_ASSIGN": {
        const orderId = asString(payload.order_id);
        const courierId = asString(payload.courier_id);
        const courierName = asString(payload.courier_name);
        if (!orderId || !courierId || !courierName) {
          return commandResult(command, "REJECT", { message: "DELIVERY_ASSIGN için order_id, courier_id ve courier_name zorunlu." });
        }
        const result = await assignOrderCourier({
          orderId,
          courierId,
          courierName,
          courierPhone: asString(payload.courier_phone),
        });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Kurye atama başarısız." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "DELIVERY_COMPLETE": {
        const orderId = asString(payload.order_id);
        if (!orderId) {
          return commandResult(command, "REJECT", { message: "DELIVERY_COMPLETE için order_id zorunlu." });
        }
        const result = await markDeliveryCompleted(orderId);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Teslimat tamamlanamadi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "TABLE_STATUS_SET": {
        const tableId = asString(payload.table_id);
        if (!tableId || !isValidTableStatus(payload.status)) {
          return commandResult(command, "REJECT", { message: "TABLE_STATUS_SET için table_id ve status zorunlu." });
        }
        const result = await updateTableStatus({ tableId, status: payload.status });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Masa durumu güncellenemedi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "TABLE_REQUEST_RESOLVE": {
        const requestId = asString(payload.request_id);
        if (!requestId) {
          return commandResult(command, "REJECT", { message: "TABLE_REQUEST_RESOLVE için request_id zorunlu." });
        }
        const result = await resolveTableRequest(requestId);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Servis talebi cozulmedi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "CASH_SESSION_OPEN": {
        const openingCash = asNumber(payload.opening_cash);
        if (openingCash === null) {
          return commandResult(command, "REJECT", { message: "CASH_SESSION_OPEN için opening_cash zorunlu." });
        }
        const result = await openCashSession(openingCash, asString(payload.note) ?? undefined, command.actor_id ?? undefined);
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Kasa acilamadi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      case "CASH_SESSION_CLOSE": {
        const sessionId = asString(payload.session_id);
        const closingCash = asNumber(payload.closing_cash);
        if (!sessionId || closingCash === null) {
          return commandResult(command, "REJECT", { message: "CASH_SESSION_CLOSE için session_id ve closing_cash zorunlu." });
        }
        const result = await closeCashSession({
          sessionId,
          closingCash,
          note: asString(payload.note) ?? undefined,
          closedBy: command.actor_id ?? undefined,
        });
        if (!result.ok) {
          return commandResult(command, classifyFailure(result.error), { message: result.error ?? "Kasa kapatilamadi." });
        }
        return commandResult(command, "ACK", { data: flattenResultData(result as unknown as Record<string, unknown>) });
      }

      default:
        return commandResult(command, "REJECT", { message: "Desteklenmeyen komut tipi." });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return commandResult(command, classifyFailure(message), { message });
  }
}

export function makeOpsCommandEnvelope(input: {
  type: OpsCommand["type"];
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  commandId?: string;
  businessId?: string | null;
  branchId?: string | null;
  actorId?: string | null;
  deviceId: string;
}): OpsCommand {
  const commandId = input.commandId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? commandId;

  return {
    command_id: commandId,
    idempotency_key: idempotencyKey,
    type: input.type,
    business_id: input.businessId ?? null,
    branch_id: input.branchId ?? null,
    actor_id: input.actorId ?? null,
    device_id: input.deviceId,
    created_at: new Date().toISOString(),
    payload: input.payload,
  };
}
