import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  CashierCancelOrderQueueForm,
  CashierFinancialsQueueForm,
  CashierOrderItemCancelQueueButton,
  CashierPaymentQueuePanel,
  CashierRefundQueueForm,
} from "@/components/cashier-queue-controls";
import { CashierPaymentPanel } from "@/components/cashier-payment-panel";
import {
  BackofficePage,
  ContentCard,
  EmptyPanel,
  NoticeBanner,
  SummaryCard,
  WorkflowGuide,
} from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { OptimisticVisibility } from "@/components/optimistic-visibility";
import { OptimisticMoney } from "@/components/optimistic-money";
import { QuerySnapshotSeed } from "@/components/query-snapshot-seed";
import { ReceiptPreviewLauncher } from "@/components/receipt-preview-launcher";
import { getAppBaseUrl } from "@/lib/app-url";
import { requireRole } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getCashierPageSnapshot } from "@/lib/domains/orders";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { POS_CLIENT_QUEUE_CASHIER_ENABLED } from "@/lib/pos/feature-flags";
import { posQueryKeys } from "@/lib/pos/query-keys";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getWebPerfProfile } from "@/lib/web-perf-profile";
import { isLikelyMobileUserAgent } from "@/lib/device";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";

function buildReceiptLink(orderId: string) {
  const base = getAppBaseUrl();
  return `${base}/receipt/${orderId}`;
}

function buildReceiptQr(orderId: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(buildReceiptLink(orderId))}`;
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

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function statusTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "partially_paid") return "bg-blue-100 text-blue-700";
  if (status === "partially_refunded") return "bg-rose-100 text-rose-700";
  if (status === "ready") return "bg-[#fff2ee] text-[#ff5a34]";
  if (status === "served") return "bg-[#fff2ee] text-[#ff5a34]";
  if (status === "preparing") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function feedbackHref(tone: "success" | "error", message: string, orderId?: string) {
  const params = new URLSearchParams();
  params.set("tone", tone);
  params.set("feedback", message);
  if (orderId) {
    params.set("order", orderId);
  }
  return `/cashier?${params.toString()}`;
}

function resolveReturnOrderId(formData: FormData) {
  const returnOrderId = formData.get("returnOrderId");
  if (typeof returnOrderId !== "string") {
    return undefined;
  }
  const normalized = returnOrderId.trim();
  return normalized || undefined;
}

async function applyFinancialsAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const discountAmount = Number(formData.get("discountAmount"));
  const serviceFee = Number(formData.get("serviceFee"));
  const returnOrderId = resolveReturnOrderId(formData);
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Sipariş bulunamadi.", returnOrderId));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "ORDER_FINANCIALS_SET",
      payload: {
        order_id: orderId,
        discount_amount: Number.isFinite(discountAmount) ? discountAmount : 0,
        service_fee: Number.isFinite(serviceFee) ? serviceFee : 0,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Finans güncellenemedi.", returnOrderId ?? orderId));
    }
    const finalPrice = typeof result.data?.finalPrice === "number" ? result.data.finalPrice : 0;
    redirect(feedbackHref("success", `Finans güncellendi. Yeni toplam: ${finalPrice.toFixed(2)} TL.`, returnOrderId ?? orderId));
  } catch {
    redirect(feedbackHref("error", "Finans güncellenemedi.", returnOrderId ?? orderId));
  }
}

async function completePaymentAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const method = formData.get("method");
  const amount = Number(formData.get("amount"));
  const note = formData.get("note");
  const requestKey = formData.get("requestKey");
  const returnOrderId = resolveReturnOrderId(formData);
  if (typeof orderId !== "string" || typeof method !== "string") {
    redirect(feedbackHref("error", "Ödeme bilgileri geçersiz.", returnOrderId));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "PAYMENT_SALE_CASH",
      idempotencyKey: typeof requestKey === "string" ? requestKey : undefined,
      payload: {
        order_id: orderId,
        method: method as PaymentMethod,
        amount: Number.isFinite(amount) ? amount : undefined,
        note: typeof note === "string" ? note : undefined,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Ödeme alinamadi.", returnOrderId ?? orderId));
    }
    if (result.data?.idempotent === true) {
      const remaining = typeof result.data?.remaining === "number" ? result.data.remaining : 0;
      redirect(feedbackHref("success", `Ayni ödeme daha önce kaydedilmis. Kalan bakiye: ${remaining.toFixed(2)} TL.`, returnOrderId ?? orderId));
    }
    const remaining = typeof result.data?.remaining === "number" ? result.data.remaining : 0;
    redirect(feedbackHref("success", `Ödeme kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`, returnOrderId ?? orderId));
  } catch {
    redirect(feedbackHref("error", "Ödeme alinamadi.", returnOrderId ?? orderId));
  }
}

async function cancelOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const note = formData.get("note");
  const requestKey = formData.get("requestKey");
  const returnOrderId = resolveReturnOrderId(formData);
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Sipariş bulunamadi.", returnOrderId));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "ORDER_CANCEL",
      idempotencyKey: typeof requestKey === "string" ? requestKey : undefined,
      payload: {
        order_id: orderId,
        note: typeof note === "string" ? note : undefined,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Sipariş iptal edilemedi.", returnOrderId ?? orderId));
    }
    redirect(
      feedbackHref(
        "success",
        result.data?.idempotent === true ? "Iptal işlemi daha önce kaydedilmis." : "Sipariş iptal edildi.",
        returnOrderId ?? orderId,
      ),
    );
  } catch {
    redirect(feedbackHref("error", "Sipariş iptal edilemedi.", returnOrderId ?? orderId));
  }
}

async function cancelOrderItemAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const productId = formData.get("productId");
  const returnOrderId = resolveReturnOrderId(formData);
  
  if (typeof orderId !== "string" || typeof productId !== "string") {
    redirect(feedbackHref("error", "İşlem bilgileri geçersiz.", returnOrderId));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "ORDER_ITEM_CANCEL",
      payload: {
        order_id: orderId,
        product_id: productId,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Ürün iptal edilemedi.", returnOrderId ?? orderId));
    }
    redirect(feedbackHref("success", "Ürün basariyla iptal edildi/dusuruldu.", returnOrderId ?? orderId));
  } catch {
    redirect(feedbackHref("error", "Ürün iptal edilemedi.", returnOrderId ?? orderId));
  }
}

async function refundOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const method = formData.get("method");
  const amount = Number(formData.get("amount"));
  const note = formData.get("note");
  const requestKey = formData.get("requestKey");
  const returnOrderId = resolveReturnOrderId(formData);
  if (typeof orderId !== "string" || typeof method !== "string") {
    redirect(feedbackHref("error", "Iade bilgileri geçersiz.", returnOrderId));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "ORDER_REFUND_CASH",
      idempotencyKey: typeof requestKey === "string" ? requestKey : undefined,
      payload: {
        order_id: orderId,
        method: method as PaymentMethod,
        amount: Number.isFinite(amount) ? amount : undefined,
        note: typeof note === "string" ? note : undefined,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Iade tamamlanamadi.", returnOrderId ?? orderId));
    }
    if (result.data?.idempotent === true) {
      redirect(feedbackHref("success", "Ayni iade daha önce kaydedilmis.", returnOrderId ?? orderId));
    }
    redirect(feedbackHref("success", "Iade işlemi kaydedildi.", returnOrderId ?? orderId));
  } catch {
    redirect(feedbackHref("error", "Iade tamamlanamadi.", returnOrderId ?? orderId));
  }
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

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; feedback?: string; tone?: "success" | "error" }>;
}) {
  await requireRole(["admin", "cashier"], "/cashier");
  const requestHeaders = await headers();
  const renderMobileMarkup = isLikelyMobileUserAgent(requestHeaders.get("user-agent"));
  const locale = await getCurrentLocale();
  const localeCode = locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : "tr-TR";
  const { order: selectedOrderId, feedback, tone } = await searchParams;
  const perfProfile = getWebPerfProfile("/cashier");
  const cashierSnapshotResult = await measureAsync("cashier_snapshot", () => getCashierPageSnapshot(selectedOrderId));
  logServerPerf(`/cashier profile=${perfProfile.mode}:${perfProfile.bucket}`, [cashierSnapshotResult]);
  const { servedOrders, paidOrders, selectedOrder, usingDemoData } = cashierSnapshotResult.value;

  const servedTotals = totals(servedOrders);
  const paidTotals = totals(paidOrders);
  const cashierSnapshotSeed = {
    served_order_ids: servedOrders.map((order) => order.id),
    paid_order_ids: paidOrders.map((order) => order.id),
    selected_order_id: selectedOrder?.id ?? null,
  };

  return (
    <BackofficePage
      title="Kasa Ekrani"
      description="Tahsilat, split bill, iade ve adisyon kapanış operasyonu"
      actions={
        <>
          <LiveOpsBridge tables={["orders", "tables", "payments", "cash_register_sessions"]} fallbackIntervalMs={900} />
          <LiveRouteRefresh tables={["orders", "payments", "cash_register_sessions"]} debounceMs={120} minIntervalMs={700} />
          <Link href="/cashier/session" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            Gun Islemleri
          </Link>
          <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            Panele Don
          </Link>
        </>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Kasa işlemi tamamlanamadi" : "Kasa işlemi tamamlandı"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif. Split, ödeme ve iade akislarini bu ekran uzerinden test edebilirsin.
        </div>
      ) : null}

      <QuerySnapshotSeed queryKey={posQueryKeys.cashierSnapshot} data={cashierSnapshotSeed} />

      {!renderMobileMarkup ? (
        <section className="app-mobile-hide grid gap-4 xl:grid-cols-4">
          <SummaryCard label="Bekleyen Adisyon" value={String(servedOrders.length)} hint="Acilikta bekleyen tüm hesaplar" tone="accent" className="bg-[linear-gradient(130deg,rgba(255,106,61,0.14),rgba(255,255,255,0.9)_65%)]" />
          <SummaryCard label="Bekleyen Bakiye" value={`${servedTotals.remaining.toFixed(2)} TL`} hint="Tahsil edilmemis toplam tutar" tone="danger" className="bg-[linear-gradient(130deg,rgba(251,113,133,0.12),rgba(255,255,255,0.9)_65%)]" />
          <SummaryCard label="Bugün Tahsil" value={`${paidTotals.paid.toFixed(2)} TL`} hint={`${paidOrders.length} kapanan adisyon`} tone="success" className="bg-[linear-gradient(130deg,rgba(16,185,129,0.12),rgba(255,255,255,0.9)_65%)]" />
          <SummaryCard label="Açık Ciro" value={`${servedTotals.final.toFixed(2)} TL`} hint="Acilikta kalan adisyon hacmi" className="bg-[linear-gradient(130deg,rgba(59,130,246,0.1),rgba(255,255,255,0.9)_65%)]" />
        </section>
      ) : null}

      {renderMobileMarkup ? (
        <section className="app-mobile-only space-y-3">
        <article className="mobile-task-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Tahsilat Kuyrugu</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Listeyi sec, tam ekranda tamamla</h2>
          <p className="mt-1 text-sm text-slate-500">Ödeme, split ve iade adimlari secilen adisyon detayinda ilerler.</p>
        </article>
        {servedOrders.length === 0 ? (
          <article className="mobile-task-card">
            <p className="text-sm font-semibold text-slate-800">Bekleyen adisyon yok.</p>
          </article>
        ) : (
          <div className="grid gap-2">
            {servedOrders.map((order) => {
              const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
              const active = selectedOrder?.id === order.id;
              return (
                <OptimisticVisibility key={`mobile-queue-${order.id}`} orderId={order.id}>
                  <article className="mobile-task-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{orderSourceLabel(order)}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">Sipariş #{orderRef(order)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>{order.status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Kalan</p>
                        <p className="text-xl font-semibold text-emerald-700">
                          <OptimisticMoney orderId={order.id} baseAmount={remaining} field="remaining" />
                        </p>
                      </div>
                      <Link
                        href={`/cashier?order=${order.id}`}
                        className={`mobile-cta-primary inline-flex items-center justify-center px-4 py-3 text-sm ${active ? "opacity-90" : ""}`}
                      >
                        {active ? "Açık Detay" : "Tahsilata Gec"}
                      </Link>
                    </div>
                  </article>
                </OptimisticVisibility>
              );
            })}
          </div>
        )}
        </section>
      ) : null}

      {!renderMobileMarkup ? (
        <WorkflowGuide
          title="Kasada 3 Adim"
          description="Yeni gelen biri egitim almadan tahsilat akisini izleyebilir."
          className="app-mobile-hide bg-[linear-gradient(125deg,rgba(15,23,42,0.03),rgba(255,255,255,0.92)_45%,rgba(255,106,61,0.08))]"
          steps={[
            { title: "Masayi veya adisyonu sec", description: "Ustteki masa kartlarindan ödeme bekleyen adisyonu sec ve popup olarak buyut." },
            { title: "Tutari kontrol et", description: "Gerekirse indirim veya servis ucreti güncelle; kalan bakiyeyi kontrol et." },
            { title: "Ödeme al veya bol", description: "Nakit, kart, karma ödeme al; esit paylastir veya ürün bazli bol ile tahsilati tamamla." },
          ]}
        />
      ) : null}

      {!renderMobileMarkup ? (
        <ContentCard title="Masa ve Adisyon Secimi" className="app-mobile-hide bg-[linear-gradient(140deg,rgba(255,255,255,0.96),rgba(255,255,255,0.84))]">
          {servedOrders.length === 0 ? (
            <EmptyPanel title="Secilecek Adisyon Yok" description="Açık adisyon bulunmuyor." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {servedOrders.map((order) => {
                const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
                const active = selectedOrder?.id === order.id;
                return (
                  <OptimisticVisibility key={order.id} orderId={order.id}>
                  <Link
                    href={`/cashier?order=${order.id}`}
                    className={`panel-hover rounded-[24px] border p-4 ${
                      active
                        ? "border-[#ff8b73] bg-[linear-gradient(135deg,rgba(255,106,61,0.10)_0%,rgba(255,255,255,0.92)_60%)] shadow-[0_18px_32px_rgba(255,106,61,0.14)]"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                        <p className="font-display mt-2 text-xl font-semibold tracking-tight text-slate-900">
                          {order.channel === "dine_in" ? formatOrderTableLabel(order) : order.customer_name ?? "Adisyon"}
                        </p>
                      </div>
                      <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>{order.status}</span>
                    </div>
                    <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Kalan</p>
                        <p className="font-display font-numeric mt-1 text-2xl font-semibold text-emerald-700">
                          <OptimisticMoney orderId={order.id} baseAmount={remaining} field="remaining" />
                        </p>
                      </div>
                        <span className="inline-flex w-full justify-center rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto">Popup Ac</span>
                    </div>
                  </Link>
                  </OptimisticVisibility>
                );
              })}
            </div>
          )}
        </ContentCard>
      ) : null}

      {!renderMobileMarkup ? (
        <section className="app-mobile-hide grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ContentCard title="Ödeme Bekleyen Adisyonlar" className="bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))]">
          {servedOrders.length === 0 ? (
            <EmptyPanel title="Adisyon Yok" description="Açık sipariş bulunmuyor." />
          ) : (
            <div className="space-y-4">
              {servedOrders.map((order) => {
                const subtotal = Number(order.total_price);
                const final = Number(order.final_price ?? subtotal);
                const remaining = Number(order.remaining_balance ?? final);

                return (
                  <OptimisticVisibility key={order.id} orderId={order.id}>
                  <article className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Sipariş #{orderRef(order)}</h3>
                        <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                        {order.delivery_address ? <p className="mt-1 break-words text-sm text-slate-500">{order.delivery_address}</p> : null}
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                        <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>{order.status}</span>
                        <p className="text-2xl font-semibold tracking-tight text-emerald-700">
                          <OptimisticMoney orderId={order.id} baseAmount={remaining} field="remaining" />
                        </p>
                        <p className="text-xs text-slate-500">Kalan bakiye</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-stretch gap-2">
                      <Link
                        href={`/cashier?order=${order.id}`}
                        className="w-full rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.22)] sm:w-auto"
                      >
                        Buyut ve Tahsilata Gec
                      </Link>
                      <div className="w-full sm:w-auto">
                        <ReceiptPreviewLauncher
                          order={order}
                          receiptLink={buildReceiptLink(order.id)}
                          showShareLink={false}
                          compactButtons
                        />
                      </div>
                    </div>
                  </article>
                  </OptimisticVisibility>
                );
              })}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Son Kapanan Adisyonlar" className="bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(245,252,248,0.86))]">
          {paidOrders.length === 0 ? (
            <EmptyPanel title="Kayıt Yok" description="Bugün kapanan adisyon bulunmuyor." />
          ) : (
            <div className="space-y-4">
              {paidOrders.slice(0, 8).map((order) => (
                <article key={order.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Sipariş #{orderRef(order)}</h3>
                      <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                    </div>
                    <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>{order.status}</span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-white px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Net Tahsilat</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {Number(order.amount_paid ?? order.final_price ?? order.total_price).toFixed(2)} TL
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Adisyon Paylasimi</p>
                      <ReceiptPreviewLauncher order={order} receiptLink={buildReceiptLink(order.id)} />
                      <div className="mt-4 flex justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4">
                        <Image
                          src={buildReceiptQr(order.id)}
                          alt="Adisyon QR"
                          className="h-24 w-24 rounded-xl border border-slate-200 bg-white"
                          width={96}
                          height={96}
                          unoptimized
                        />
                      </div>
                    </div>

                    {POS_CLIENT_QUEUE_CASHIER_ENABLED ? (
                      <CashierRefundQueueForm
                        orderId={order.id}
                        returnOrderId={selectedOrder?.id}
                        defaultAmount={Number(order.final_price ?? order.total_price)}
                        className="grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4"
                      />
                    ) : (
                      <form action={refundOrderAction} className="grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="requestKey" value={crypto.randomUUID()} />
                        <select name="method" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
                          <option value="cash">Nakit</option>
                          <option value="card">Kart</option>
                          <option value="mixed">Karma</option>
                        </select>
                        <input
                          name="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(order.final_price ?? order.total_price)}
                          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                        />
                        <input
                          name="note"
                          placeholder="Iade notu"
                          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                        />
                        <button type="submit" className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700">
                          Iade Baslat
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </ContentCard>
        </section>
      ) : null}

      {selectedOrder ? (
        <OptimisticVisibility orderId={selectedOrder.id}>
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface cashier-detail-sheet h-[100dvh] w-full max-w-[1320px] overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(selectedOrder)}</p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {selectedOrder.channel === "dine_in"
                    ? `${formatOrderTableLabel(selectedOrder)} Adisyonu`
                    : `Sipariş #${orderRef(selectedOrder)}`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Popup tahsilat akışı. Ekrandan ayrilmadan ödeme, split ve iptal yap.</p>
                {renderMobileMarkup ? (
                  <div className="app-mobile-only mt-3 flex gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-white">1 Liste</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">2 Ödeme</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">3 Kapat</span>
                  </div>
                ) : null}
              </div>
              <Link href="/cashier" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto">
                Kapat
              </Link>
            </div>
            {feedback ? (
              <NoticeBanner
                tone={tone === "error" ? "error" : "success"}
                title={tone === "error" ? "Islemde hata oluştu" : "İşlem kaydedildi"}
                description={feedback}
              />
            ) : null}

            {(() => {
              const order = selectedOrder;
              const subtotal = Number(order.total_price);
              const discount = Number(order.discount_amount ?? 0);
              const service = Number(order.service_fee ?? 0);
              const final = Number(order.final_price ?? subtotal);
              const paid = Number(order.amount_paid ?? 0);
              const remaining = Number(order.remaining_balance ?? final);
              const paymentRequestKey = crypto.randomUUID();
              const cancelRequestKey = crypto.randomUUID();

              return (
                <div className="space-y-4">
                  {renderMobileMarkup ? (
                    <div className="app-mobile-only mobile-wizard-nav">
                      <a href="#wizard-finance" className="mobile-wizard-step">
                        1 Finans
                      </a>
                      <a href="#wizard-payment" className="mobile-wizard-step">
                        2 Ödeme
                      </a>
                      <a href="#wizard-close" className="mobile-wizard-step">
                        3 Kapat
                      </a>
                    </div>
                  ) : null}

                  <section id="wizard-finance" className="scroll-mt-[130px] grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sipariş Bilgisi</p>
                            <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900">Sipariş #{orderRef(order)}</p>
                            <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                            {order.delivery_address ? <p className="mt-1 break-words text-sm text-slate-500">{order.delivery_address}</p> : null}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{order.status}</span>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sipariş Kalemleri</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                                    {(order.items as OrderItem[]).map((item, index) => (
                            <li key={`${order.id}-${item.product_id}-${index}`} className="group rounded-2xl bg-slate-50 px-3 py-3 hover:bg-slate-100 transition">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 break-words">
                                  <span className="font-semibold text-slate-900">
                                    {item.quantity}x {item.name}
                                  </span>
                                  {item.modifiers?.length ? (
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <span className="font-numeric pt-1">{Number(item.line_total).toFixed(2)} TL</span>
                                  {POS_CLIENT_QUEUE_CASHIER_ENABLED ? (
                                    <CashierOrderItemCancelQueueButton
                                      orderId={order.id}
                                      returnOrderId={order.id}
                                      productId={item.product_id}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 opacity-20 transition hover:bg-rose-50 hover:border-rose-200 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    />
                                  ) : (
                                    <form action={cancelOrderItemAction}>
                                      <input type="hidden" name="orderId" value={order.id} />
                                      <input type="hidden" name="returnOrderId" value={order.id} />
                                      <input type="hidden" name="productId" value={item.product_id} />
                                      <button
                                        type="submit"
                                        title="Urunu dus veya iptal et"
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 opacity-20 transition hover:bg-rose-50 hover:border-rose-200 group-hover:opacity-100 focus:opacity-100"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                                        </svg>
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Finans Özet</p>
                          <div className="mt-3 grid gap-2 text-sm">
                            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-3">
                              <span>Ara Toplam</span>
                              <span className="font-numeric">{subtotal.toFixed(2)} TL</span>
                            </div>
                            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-3">
                              <span>Indirim</span>
                              <span className="font-numeric">-{discount.toFixed(2)} TL</span>
                            </div>
                            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-3">
                              <span>Servis Ucreti</span>
                              <span className="font-numeric">+{service.toFixed(2)} TL</span>
                            </div>
                            <div className="flex justify-between rounded-xl bg-[#fff2ee] px-3 py-3 font-semibold text-slate-900">
                              <span>Toplam</span>
                              <span className="font-display font-numeric">{final.toFixed(2)} TL</span>
                            </div>
                            <div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-3">
                              <span>Odenen</span>
                              <span className="font-display font-numeric">{paid.toFixed(2)} TL</span>
                            </div>
                            <div className="flex justify-between rounded-xl bg-amber-50 px-3 py-3">
                              <span>Kalan</span>
                              <span className="font-display font-numeric text-amber-800">{remaining.toFixed(2)} TL</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Adisyon Paylasimi</p>
                          <ReceiptPreviewLauncher order={order} receiptLink={buildReceiptLink(order.id)} />
                          <div className="mt-4 flex justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4">
                            <Image
                              src={buildReceiptQr(order.id)}
                              alt="Adisyon QR"
                              className="h-24 w-24 rounded-xl border border-slate-200 bg-white sm:h-28 sm:w-28"
                              width={112}
                              height={112}
                              unoptimized
                            />
                          </div>
                        </div>
                      </div>

                      {POS_CLIENT_QUEUE_CASHIER_ENABLED ? (
                        <CashierFinancialsQueueForm
                          orderId={order.id}
                          returnOrderId={order.id}
                          defaultDiscountAmount={discount}
                          defaultServiceFee={service}
                          className="grid gap-2 rounded-[20px] border border-slate-200 bg-white p-4 md:grid-cols-3"
                        />
                      ) : (
                        <form action={applyFinancialsAction} className="grid gap-2 rounded-[20px] border border-slate-200 bg-white p-4 md:grid-cols-3">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnOrderId" value={order.id} />
                          <input
                            name="discountAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={discount}
                            placeholder="Indirim"
                            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                          />
                          <input
                            name="serviceFee"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={service}
                            placeholder="Servis"
                            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                          >
                            Finans Güncelle
                          </button>
                        </form>
                      )}
                    </div>
                  </section>

                  <section id="wizard-payment" className="scroll-mt-[130px] grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    {POS_CLIENT_QUEUE_CASHIER_ENABLED ? (
                      <CashierPaymentQueuePanel
                        orderId={order.id}
                        returnOrderId={order.id}
                        defaultAmount={remaining}
                        items={order.items as OrderItem[]}
                      />
                    ) : (
                      <CashierPaymentPanel
                        orderId={order.id}
                        returnOrderId={order.id}
                        defaultAmount={remaining}
                        items={order.items as OrderItem[]}
                        requestKey={paymentRequestKey}
                        action={completePaymentAction}
                      />
                    )}

                    {POS_CLIENT_QUEUE_CASHIER_ENABLED ? (
                      <CashierCancelOrderQueueForm
                        id="wizard-close"
                        orderId={order.id}
                        returnOrderId={order.id}
                        className="scroll-mt-[130px] grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4 content-start"
                      />
                    ) : (
                      <form id="wizard-close" action={cancelOrderAction} className="scroll-mt-[130px] grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4 content-start">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="returnOrderId" value={order.id} />
                        <input type="hidden" name="requestKey" value={cancelRequestKey} />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Adisyon Iptal</p>
                        <input
                          name="note"
                          placeholder="Iptal nedeni"
                          className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm"
                        />
                        <button type="submit" className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700">
                          Iptal
                        </button>
                      </form>
                    )}
                  </section>
                </div>
              );
            })()}
          </div>
        </div>
        </OptimisticVisibility>
      ) : null}
    </BackofficePage>
  );
}

