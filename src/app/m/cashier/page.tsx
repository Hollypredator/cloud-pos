import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  Clock, 
  X, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  CalendarDays 
} from "lucide-react";
import { CashierPaymentPanel } from "@/components/cashier-payment-panel";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { requireRole } from "@/lib/auth";
import { getCashierPageSnapshot } from "@/lib/domains/orders";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";
import { ThemeForcer } from "@/components/theme-forcer";

type MobileCashierSearchParams = {
  order?: string;
  feedback?: string;
  tone?: "success" | "error";
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function formatOrderTableLabel(order: {
  table_number?: number;
  table_name?: string | null;
}) {
  const normalizedName = typeof order.table_name === "string" ? order.table_name.trim() : "";
  if (normalizedName) {
    return normalizedName;
  }
  if (typeof order.table_number === "number") {
    return `Masa ${order.table_number}`;
  }
  return "Masa -";
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  table_name?: string | null;
  customer_name?: string | null;
}) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket servis - ${order.customer_name}` : "Paket Servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al - ${order.customer_name}` : "Gel-Al";
  }
  return formatOrderTableLabel(order);
}

function statusLabel(status: string) {
  if (status === "served") return "Ödeme Bekliyor";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandı";
  if (status === "ready") return "Hazır";
  return status;
}

function statusTone(status: string) {
  if (status === "paid") return "bg-emerald-500 text-white uupm-glow-success";
  if (status === "partially_paid") return "bg-amber-500 text-white uupm-glow-warning";
  if (status === "served" || status === "ready") return "bg-amber-500 text-white uupm-glow-warning";
  return "m-tone-neutral";
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
  const selectedItems = selectedOrder && Array.isArray(selectedOrder.items) ? (selectedOrder.items as OrderItem[]) : [];
  const selectedRemaining = selectedOrder
    ? Number(selectedOrder.remaining_balance ?? selectedOrder.final_price ?? selectedOrder.total_price)
    : 0;
  const selectedPaid = selectedOrder ? Number(selectedOrder.amount_paid ?? 0) : 0;
  const selectedFinal = selectedOrder ? Number(selectedOrder.final_price ?? selectedOrder.total_price) : 0;

  return (
    <>
      <ThemeForcer theme="cashier-light" />
      <LiveOpsBridge tables={["orders", "order_items", "payments", "cash_register_sessions"]} fallbackIntervalMs={1400} />
      <LiveRouteRefresh tables={["orders", "order_items", "payments", "cash_register_sessions"]} debounceMs={240} minIntervalMs={1200} />

      {feedback ? (
        <div className={`m-card border rounded-[22px] p-4 shadow-sm mb-4 flex items-center gap-3.5 ${
          tone === "error" 
            ? "border-rose-200 bg-rose-50 text-rose-800" 
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          {tone === "error" ? <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
          <p className="text-xs font-bold">{feedback}</p>
        </div>
      ) : null}

      {usingDemoData ? (
        <div className="m-card m-banner-warning border border-amber-300 rounded-[20px] bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Demo veri modu aktif.</p>
        </div>
      ) : null}

      {/* Cashier Stats Board */}
      <section className="m-grid-3">
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Bekleyen</p>
          <p className="mt-1.5 text-2xl font-black text-amber-600 uupm-monospace-num">{servedOrders.length}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Açık Kalan</p>
          <p className="mt-1.5 text-xs font-black text-rose-600 uupm-monospace-num truncate">{formatMoney(servedTotals.remaining)}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Top. Kasa</p>
          <p className="mt-1.5 text-xs font-black text-emerald-600 uupm-monospace-num truncate">{formatMoney(paidTotals.paid)}</p>
        </article>
      </section>

      {/* Header and Day Session Controller */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Tahsilat Kuyrugu</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Adisyon seçip ödeme detaylarını tamamlayın.</p>
          </div>
          <Link 
            href="/m/cashier/session" 
            className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 inline-flex min-h-[42px] items-center justify-center gap-1.5 px-4.5 rounded-xl text-xs font-extrabold shadow-sm transition-all active:scale-95"
          >
            <CalendarDays className="h-4.5 w-4.5 text-slate-600 shrink-0" strokeWidth={2.4} />
            Gün Sonu
          </Link>
        </div>
      </section>

      {/* Bills Queue List */}
      <section className="m-stack mt-3.5">
        {servedOrders.length === 0 ? (
          <article className="m-card border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center rounded-[24px]">
            <p className="text-sm font-bold text-slate-800">Bekleyen adisyon yok.</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Servise hazır veya kısmi ödemeli adisyonlar burada görünür.</p>
          </article>
        ) : (
          servedOrders.map((order) => {
            const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
            const isActive = selectedOrder?.id === order.id;
            return (
              <article 
                key={order.id} 
                className={`m-card uupm-card-interactive rounded-[24px] border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                  isActive ? "border-slate-900 shadow-md ring-2 ring-slate-900/5" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                    <p className="text-sm font-black text-slate-900 mt-1 truncate">Adisyon #{orderRef(order)}</p>
                    <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                      <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">{new Date(order.created_at).toLocaleTimeString("tr-TR", {hour: "2-digit", minute:"2-digit"})}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest shadow-sm ${statusTone(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Kalan Tutar</p>
                    <p className="text-lg font-black text-rose-600 mt-1 uupm-monospace-num">{formatMoney(remaining)}</p>
                  </div>
                  <Link 
                    href={`/m/cashier?order=${order.id}`} 
                    className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 text-white inline-flex items-center justify-center gap-1.5 px-4.5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95"
                  >
                    {isActive ? "Seçildi" : "Tahsilata Gec"}
                    <ChevronRight className="h-4.5 w-4.5" />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Selected Order Detail and Payment Drawer */}
      {selectedOrder ? (
        <section className="m-card rounded-[24px] border border-slate-900/20 bg-slate-50/50 p-4.5 shadow-md mt-4">
          <div className="flex items-start justify-between gap-3 mb-4.5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Adisyon Detayı</p>
              <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">{orderSourceLabel(selectedOrder)}</h2>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">Sipariş #{orderRef(selectedOrder)}</p>
            </div>
            <Link 
              href="/m/cashier" 
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-all active:scale-90 shadow-sm"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.4} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Toplam</p>
              <p className="mt-1 text-xs font-black text-slate-900 uupm-monospace-num">{formatMoney(selectedFinal)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 shadow-sm">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">Ödenen</p>
              <p className="mt-1 text-xs font-black text-emerald-800 uupm-monospace-num">{formatMoney(selectedPaid)}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 shadow-sm">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-rose-600">Kalan</p>
              <p className="mt-1 text-xs font-black text-rose-800 uupm-monospace-num">{formatMoney(selectedRemaining)}</p>
            </div>
          </div>

          {/* Items detailed breakdown list */}
          <div className="mt-4.5 space-y-2.5">
            {selectedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3.5 py-3 text-xs font-semibold text-slate-400">
                Kalem detayı bulunmuyor.
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {item.quantity}x {item.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uupm-monospace-num">
                      {item.quantity > 1 ? `${formatMoney(Number(item.line_total) / item.quantity)} x ${item.quantity}` : formatMoney(Number(item.line_total))}
                    </p>
                  </div>
                  <p className="text-xs font-black text-slate-800 uupm-monospace-num shrink-0">{formatMoney(Number(item.line_total))}</p>
                </div>
              ))
            )}
          </div>

          {/* Payment execution panel */}
          <div className="mt-4.5 pt-4.5 border-t border-slate-200">
            {selectedRemaining > 0 ? (
              <CashierPaymentPanel
                orderId={selectedOrder.id}
                returnOrderId={selectedOrder.id}
                defaultAmount={selectedRemaining}
                items={selectedItems}
                requestKey={crypto.randomUUID()}
                action={completeMobilePaymentAction}
                submitIdleLabel="Ödemeyi Tamamla"
                submitPendingLabel="İşlem Yapılıyor..."
              />
            ) : (
              <form action={closePaidOrderAction}>
                <input type="hidden" name="orderId" value={selectedOrder.id} />
                <input type="hidden" name="returnOrderId" value={selectedOrder.id} />
                <button 
                  type="submit" 
                  className="mobile-cta-primary bg-gradient-to-r from-emerald-600 to-emerald-700 text-white w-full inline-flex items-center justify-center py-4 rounded-2xl text-sm font-bold uppercase tracking-wider shadow-md active:scale-98 transition-all"
                >
                  Adisyonu Kapat
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}

      <div className="h-4" aria-hidden="true" />
    </>
  );
}
