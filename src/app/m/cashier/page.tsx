import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    return order.customer_name ? `Paket servis - ${order.customer_name}` : "Paket servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al - ${order.customer_name}` : "Gel-al";
  }
  return formatOrderTableLabel(order);
}

function statusLabel(status: string) {
  if (status === "served") return "Tahsilat";
  if (status === "partially_paid") return "Kismi Ödeme";
  if (status === "paid") return "Kapandı";
  if (status === "ready") return "Hazır";
  return status;
}

function statusTone(status: string) {
  if (status === "paid") return "m-tone-success";
  if (status === "partially_paid") return "m-tone-warning";
  if (status === "served" || status === "ready") return "m-tone-warning";
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
    redirect(feedbackHref("error", "Ödeme alinamadi.", returnOrderId ?? orderId));
  }

  if (result.status !== "ACK") {
    redirect(feedbackHref("error", result.message ?? "Ödeme alinamadi.", returnOrderId ?? orderId));
  }

  revalidatePath("/m/cashier");
  revalidatePath("/cashier");
  revalidatePath("/m/ops");

  const remaining = typeof result.data?.remaining === "number" ? result.data.remaining : 0;
  const message =
    result.data?.idempotent === true
      ? `Aynı Ödeme daha once kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`
      : `Ödeme kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`;
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
    redirect(feedbackHref("error", "Adisyon kapatilamadi.", returnOrderId ?? orderId));
  }

  if (result.status !== "ACK") {
    redirect(feedbackHref("error", result.message ?? "Adisyon kapatilamadi.", returnOrderId ?? orderId));
  }

  revalidatePath("/m/cashier");
  revalidatePath("/cashier");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Adisyon kapatildi.", undefined));
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
        <div className={`m-card ${tone === "error" ? "m-banner-error" : "m-banner-success"}`}>
          {feedback}
        </div>
      ) : null}

      {usingDemoData ? <div className="m-card m-banner-warning">Demo veri modu aktif.</div> : null}

      <section className="m-grid-3 mt-3">
        <article className="m-card text-center">
          <p className="m-label">Bekleyen</p>
          <p className="m-value text-orange-700">{servedOrders.length}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Kalan</p>
          <p className="m-value-sm text-rose-700">{formatMoney(servedTotals.remaining)}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Tahsil</p>
          <p className="m-value-sm text-emerald-700">{formatMoney(paidTotals.paid)}</p>
        </article>
      </section>

      <section className="m-card mt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="m-label">Tahsilat Kuyrugu</p>
            <p className="m-muted mt-1">Adisyon seç, Ödemeyi tam ekranda tamamla.</p>
          </div>
          <Link href="/m/cashier/session" className="m-btn-secondary inline-flex min-h-[40px] items-center justify-center px-3 text-xs">
            Gun
          </Link>
        </div>
      </section>

      <section className="m-stack mt-3">
        {servedOrders.length === 0 ? (
          <article className="m-card">
            <p className="m-value-sm">Bekleyen adisyon yok.</p>
            <p className="m-muted mt-1">Servise hazır veya kismi Ödemeli adisyonlar burada görünur.</p>
          </article>
        ) : (
          servedOrders.map((order) => {
            const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
            const isActive = selectedOrder?.id === order.id;
            return (
              <article key={order.id} className={`m-card ${isActive ? "border-slate-950" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-label">{orderSourceLabel(order)}</p>
                    <p className="m-value-sm truncate">#{orderRef(order)}</p>
                    <p className="m-muted mt-1">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                  </div>
                  <span className={`m-pill ${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="m-muted">Kalan</p>
                    <p className="text-xl font-semibold text-emerald-700">{formatMoney(remaining)}</p>
                  </div>
                  <Link href={`/m/cashier?order=${order.id}`} className="m-btn-primary inline-flex items-center justify-center px-4">
                    {isActive ? "Açık" : "Tahsilata Gec"}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      {selectedOrder ? (
        <section className="m-card mt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-label">Adisyon Detayi</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{orderSourceLabel(selectedOrder)}</h2>
              <p className="m-muted mt-1">Sipariş #{orderRef(selectedOrder)}</p>
            </div>
            <Link href="/m/cashier" className="m-btn-secondary inline-flex min-h-[40px] items-center justify-center px-3 text-xs">
              Kapat
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="m-label">Toplam</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(selectedFinal)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-3 py-3">
              <p className="m-label">Ödenen</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">{formatMoney(selectedPaid)}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-3">
              <p className="m-label">Kalan</p>
              <p className="mt-1 text-sm font-semibold text-rose-700">{formatMoney(selectedRemaining)}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {selectedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Kalem detayi bulunmuyor.
              </div>
            ) : (
              selectedItems.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.quantity}x {item.name}
                    </p>
                    <p className="m-muted">{formatMoney(Number(item.line_total))}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedRemaining > 0 ? (
            <CashierPaymentPanel
              orderId={selectedOrder.id}
              returnOrderId={selectedOrder.id}
              defaultAmount={selectedRemaining}
              items={selectedItems}
              requestKey={crypto.randomUUID()}
              action={completeMobilePaymentAction}
              submitIdleLabel="Ödemeyi Kaydet"
              submitPendingLabel="Ödeme Isleniyor..."
            />
          ) : (
            <form action={closePaidOrderAction} className="mt-4">
              <input type="hidden" name="orderId" value={selectedOrder.id} />
              <input type="hidden" name="returnOrderId" value={selectedOrder.id} />
              <button type="submit" className="m-btn-primary w-full">
                Adisyonu Kapat
              </button>
            </form>
          )}
        </section>
      ) : null}

      <div className="h-2" aria-hidden="true" />
    </>
  );
}
