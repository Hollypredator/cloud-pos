import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { MobileCashierUi } from "@/components/mobile-cashier-ui";
import { requireRole } from "@/lib/auth";
import { getCashierPageSnapshot } from "@/lib/domains/orders";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { Order, PaymentMethod } from "@/lib/types";

type MobileCashierSearchParams = {
  order?: string;
  feedback?: string;
  tone?: "success" | "error";
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function feedbackHref(tone: "success" | "error", message: string, orderId?: string) {
  const params = new URLSearchParams();
  params.set("tone", tone);
  params.set("feedback", message);
  if (orderId) {
    params.set("order", orderId);
  }
  return `/m/cashier?${params.toString()}`;
}

function resolveReturnOrderId(formData: FormData) {
  const value = formData.get("returnOrderId");
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function totals(orders: Order[]) {
  return orders.reduce(
    (acc, order) => {
      acc.final += Number(order.final_price ?? order.total_price);
      acc.paid += Number(order.amount_paid ?? 0);
      acc.remaining += Number(order.remaining_balance ?? order.final_price ?? order.total_price);
      return acc;
    },
    { final: 0, paid: 0, remaining: 0 },
  );
}

async function completeMobilePaymentAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/cashier");

  const orderId = formData.get("orderId");
  const method = formData.get("method");
  const amount = Number(formData.get("amount"));
  const note = formData.get("note");
  const requestKey = formData.get("requestKey");
  const returnOrderId = resolveReturnOrderId(formData);

  if (typeof orderId !== "string" || typeof method !== "string") {
    redirect(feedbackHref("error", "Ödeme bilgileri geçersiz.", returnOrderId));
  }

  let result: Awaited<ReturnType<typeof executeWebOpsCommand>>;
  try {
    result = await executeWebOpsCommand({
      type: "PAYMENT_SALE_CASH",
      idempotencyKey: typeof requestKey === "string" ? requestKey : undefined,
      payload: {
        order_id: orderId,
        method: method as PaymentMethod,
        amount: Number.isFinite(amount) ? amount : undefined,
        note: typeof note === "string" ? note : undefined,
      },
    });
  } catch {
    redirect(feedbackHref("error", "Ödeme alınamadı.", returnOrderId ?? orderId));
  }

  if (result.status !== "ACK") {
    redirect(feedbackHref("error", result.message ?? "Ödeme alınamadı.", returnOrderId ?? orderId));
  }

  revalidatePath("/m/cashier");
  revalidatePath("/cashier");
  revalidatePath("/m/ops");

  const remaining = typeof result.data?.remaining === "number" ? result.data.remaining : 0;
  const message =
    result.data?.idempotent === true
      ? `Aynı ödeme daha önce kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`
      : `Ödeme başarıyla kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`;
  redirect(feedbackHref("success", message, returnOrderId ?? orderId));
}

async function closePaidOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/cashier");

  const orderId = formData.get("orderId");
  const returnOrderId = resolveReturnOrderId(formData);
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Sipariş bulunamadı.", returnOrderId));
  }

  let result: Awaited<ReturnType<typeof executeWebOpsCommand>>;
  try {
    result = await executeWebOpsCommand({
      type: "ORDER_STATUS_SET",
      payload: {
        order_id: orderId,
        status: "paid",
      },
    });
  } catch {
    redirect(feedbackHref("error", "Adisyon kapatılamadı.", returnOrderId ?? orderId));
  }

  if (result.status !== "ACK") {
    redirect(feedbackHref("error", result.message ?? "Adisyon kapatılamadı.", returnOrderId ?? orderId));
  }

  revalidatePath("/m/cashier");
  revalidatePath("/cashier");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Adisyon başarıyla kapatıldı.", undefined));
}

export default async function MobileCashierPage({
  searchParams,
}: {
  searchParams: Promise<MobileCashierSearchParams>;
}) {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "cashier", "waiter"], "/m/cashier");
  const { order: selectedOrderId, feedback, tone } = await searchParams;
  const snapshotResult = await measureAsync("m_cashier_snapshot", () => getCashierPageSnapshot(selectedOrderId));
  logServerPerf("/m/cashier", [snapshotResult]);

  const { servedOrders, paidOrders, selectedOrder, usingDemoData } = snapshotResult.value;
  const servedTotals = totals(servedOrders);
  const paidTotals = totals(paidOrders);

  return (
    <>
      <LiveOpsBridge tables={["orders", "order_items", "payments", "cash_register_sessions"]} fallbackIntervalMs={1400} />
      <LiveRouteRefresh tables={["orders", "order_items", "payments", "cash_register_sessions"]} debounceMs={240} minIntervalMs={1200} />

      {feedback && (
        <div className={`border rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-3.5 ${
          tone === "error" 
            ? "border-rose-200 bg-rose-50 text-rose-800" 
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          {tone === "error" ? <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
          <p className="text-xs font-bold">{feedback}</p>
        </div>
      )}

      {usingDemoData && (
        <div className="border border-amber-250 rounded-2xl bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Demo veri modu aktif.</p>
        </div>
      )}

      <MobileCashierUi 
        servedOrders={servedOrders}
        paidOrders={paidOrders}
        selectedOrder={selectedOrder}
        servedTotals={servedTotals}
        paidTotals={paidTotals}
        completeMobilePaymentAction={completeMobilePaymentAction}
        closePaidOrderAction={closePaidOrderAction}
      />
    </>
  );
}
