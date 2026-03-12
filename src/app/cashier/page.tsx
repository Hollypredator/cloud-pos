import { revalidatePath } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { ReceiptPreviewLauncher } from "@/components/receipt-preview-launcher";
import { getAppBaseUrl } from "@/lib/app-url";
import { requireRole } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/i18n-server";
import {
  applyOrderFinancials,
  cancelOrder,
  completeOrderPayment,
  getCashierPageSnapshot,
  refundOrder,
} from "@/lib/domains/orders";
import { logServerPerf, measureAsync } from "@/lib/perf";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";

function buildReceiptLink(orderId: string) {
  const base = getAppBaseUrl();
  return `${base}/receipt/${orderId}`;
}

function buildReceiptQr(orderId: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(buildReceiptLink(orderId))}`;
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  customer_name?: string | null;
}) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket servis - ${order.customer_name}` : "Paket servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al - ${order.customer_name}` : "Gel-al";
  }
  return `Masa ${order.table_number ?? "-"}`;
}

function statusTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "served") return "bg-[#fff2ee] text-[#ff5a34]";
  if (status === "preparing") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function feedbackHref(tone: "success" | "error", message: string) {
  return `/cashier?tone=${encodeURIComponent(tone)}&feedback=${encodeURIComponent(message)}`;
}

async function applyFinancialsAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const discountAmount = Number(formData.get("discountAmount"));
  const serviceFee = Number(formData.get("serviceFee"));
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Siparis bulunamadi."));
  }

  try {
    const result = await applyOrderFinancials({
      orderId,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      serviceFee: Number.isFinite(serviceFee) ? serviceFee : 0,
    });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Finans guncellenemedi."));
    }
    revalidatePath("/cashier");
    const finalPrice = typeof result.finalPrice === "number" ? result.finalPrice : 0;
    redirect(feedbackHref("success", `Finans guncellendi. Yeni toplam: ${finalPrice.toFixed(2)} TL.`));
  } catch {
    redirect(feedbackHref("error", "Finans guncellenemedi."));
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
  if (typeof orderId !== "string" || typeof method !== "string") {
    redirect(feedbackHref("error", "Odeme bilgileri gecersiz."));
  }

  try {
    const result = await completeOrderPayment({
      orderId,
      method: method as PaymentMethod,
      amount: Number.isFinite(amount) ? amount : undefined,
      note: typeof note === "string" ? note : undefined,
      requestKey: typeof requestKey === "string" ? requestKey : undefined,
    });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Odeme alinamadi."));
    }
    revalidatePath("/cashier");
    if (result.idempotent) {
      const remaining = typeof result.remaining === "number" ? result.remaining : 0;
      redirect(feedbackHref("success", `Ayni odeme daha once kaydedilmis. Kalan bakiye: ${remaining.toFixed(2)} TL.`));
    }
    const remaining = typeof result.remaining === "number" ? result.remaining : 0;
    redirect(feedbackHref("success", `Odeme kaydedildi. Kalan bakiye: ${remaining.toFixed(2)} TL.`));
  } catch {
    redirect(feedbackHref("error", "Odeme alinamadi."));
  }
}

async function cancelOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const note = formData.get("note");
  const requestKey = formData.get("requestKey");
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Siparis bulunamadi."));
  }

  try {
    const result = await cancelOrder(
      orderId,
      typeof note === "string" ? note : undefined,
      typeof requestKey === "string" ? requestKey : undefined,
    );
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Siparis iptal edilemedi."));
    }
    revalidatePath("/cashier");
    redirect(feedbackHref("success", result.idempotent ? "Iptal islemi daha once kaydedilmis." : "Siparis iptal edildi."));
  } catch {
    redirect(feedbackHref("error", "Siparis iptal edilemedi."));
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
  if (typeof orderId !== "string" || typeof method !== "string") {
    redirect(feedbackHref("error", "Iade bilgileri gecersiz."));
  }

  try {
    const result = await refundOrder({
      orderId,
      method: method as PaymentMethod,
      amount: Number.isFinite(amount) ? amount : undefined,
      note: typeof note === "string" ? note : undefined,
      requestKey: typeof requestKey === "string" ? requestKey : undefined,
    });
    if (!result.ok) {
      redirect(feedbackHref("error", result.error ?? "Iade tamamlanamadi."));
    }
    revalidatePath("/cashier");
    if (result.idempotent) {
      redirect(feedbackHref("success", "Ayni iade daha once kaydedilmis."));
    }
    redirect(feedbackHref("success", "Iade islemi kaydedildi."));
  } catch {
    redirect(feedbackHref("error", "Iade tamamlanamadi."));
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
  const locale = await getCurrentLocale();
  const localeCode = locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : "tr-TR";
  const { order: selectedOrderId, feedback, tone } = await searchParams;
  const cashierSnapshotResult = await measureAsync("cashier_snapshot", () => getCashierPageSnapshot(selectedOrderId));
  logServerPerf("/cashier", [cashierSnapshotResult]);
  const { servedOrders, paidOrders, selectedOrder, usingDemoData } = cashierSnapshotResult.value;

  const servedTotals = totals(servedOrders);
  const paidTotals = totals(paidOrders);

  return (
    <BackofficePage
      title="Kasa Ekrani"
      description="Tahsilat, split bill, iade ve adisyon kapanis operasyonu"
      actions={
        <>
          <LiveOpsBridge tables={["orders", "tables", "payments", "cash_register_sessions"]} />
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
          title={tone === "error" ? "Kasa islemi tamamlanamadi" : "Kasa islemi tamamlandi"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif. Split, odeme ve iade akislarini bu ekran uzerinden test edebilirsin.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Bekleyen Adisyon" value={String(servedOrders.length)} hint="Acilikta bekleyen tum hesaplar" tone="accent" className="bg-[linear-gradient(130deg,rgba(255,106,61,0.14),rgba(255,255,255,0.9)_65%)]" />
        <SummaryCard label="Bekleyen Bakiye" value={`${servedTotals.remaining.toFixed(2)} TL`} hint="Tahsil edilmemis toplam tutar" tone="danger" className="bg-[linear-gradient(130deg,rgba(251,113,133,0.12),rgba(255,255,255,0.9)_65%)]" />
        <SummaryCard label="Bugun Tahsil" value={`${paidTotals.paid.toFixed(2)} TL`} hint={`${paidOrders.length} kapanan adisyon`} tone="success" className="bg-[linear-gradient(130deg,rgba(16,185,129,0.12),rgba(255,255,255,0.9)_65%)]" />
        <SummaryCard label="Acik Ciro" value={`${servedTotals.final.toFixed(2)} TL`} hint="Acilikta kalan adisyon hacmi" className="bg-[linear-gradient(130deg,rgba(59,130,246,0.1),rgba(255,255,255,0.9)_65%)]" />
      </section>

      <WorkflowGuide
        title="Kasada 3 Adim"
        description="Yeni gelen biri egitim almadan tahsilat akisini izleyebilir."
        className="bg-[linear-gradient(125deg,rgba(15,23,42,0.03),rgba(255,255,255,0.92)_45%,rgba(255,106,61,0.08))]"
        steps={[
          { title: "Masayi veya adisyonu sec", description: "Ustteki masa kartlarindan odeme bekleyen adisyonu sec ve popup olarak buyut." },
          { title: "Tutari kontrol et", description: "Gerekirse indirim veya servis ucreti guncelle; kalan bakiyeyi kontrol et." },
          { title: "Odeme al veya bol", description: "Nakit, kart, karma odeme al; esit paylastir veya urun bazli bol ile tahsilati tamamla." },
        ]}
      />

      <ContentCard title="Masa ve Adisyon Secimi" className="bg-[linear-gradient(140deg,rgba(255,255,255,0.96),rgba(255,255,255,0.84))]">
        {servedOrders.length === 0 ? (
          <EmptyPanel title="Secilecek Adisyon Yok" description="Acik adisyon bulunmuyor." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {servedOrders.map((order) => {
              const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
              const active = selectedOrder?.id === order.id;
              return (
                <Link
                  key={order.id}
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
                        {order.table_number ? `Masa ${order.table_number}` : order.customer_name ?? "Adisyon"}
                      </p>
                    </div>
                    <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Kalan</p>
                      <p className="font-display font-numeric mt-1 text-2xl font-semibold text-emerald-700">{remaining.toFixed(2)} TL</p>
                    </div>
                      <span className="inline-flex w-full justify-center rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto">Popup Ac</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </ContentCard>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ContentCard title="Odeme Bekleyen Adisyonlar" className="bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))]">
          {servedOrders.length === 0 ? (
            <EmptyPanel title="Adisyon Yok" description="Acik siparis bulunmuyor." />
          ) : (
            <div className="space-y-4">
              {servedOrders.map((order) => {
                const subtotal = Number(order.total_price);
                const final = Number(order.final_price ?? subtotal);
                const remaining = Number(order.remaining_balance ?? final);

                return (
                  <article key={order.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
                        <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                        {order.delivery_address ? <p className="mt-1 break-words text-sm text-slate-500">{order.delivery_address}</p> : null}
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                        <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>{order.status}</span>
                        <p className="text-2xl font-semibold tracking-tight text-emerald-700">{remaining.toFixed(2)} TL</p>
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
                );
              })}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Son Kapanan Adisyonlar" className="bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(245,252,248,0.86))]">
          {paidOrders.length === 0 ? (
            <EmptyPanel title="Kayit Yok" description="Bugun kapanan adisyon bulunmuyor." />
          ) : (
            <div className="space-y-4">
              {paidOrders.slice(0, 8).map((order) => (
                <article key={order.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
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
                  </div>
                </article>
              ))}
            </div>
          )}
        </ContentCard>
      </section>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-[1320px] overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(selectedOrder)}</p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {selectedOrder.table_number ? `Masa ${selectedOrder.table_number} Adisyonu` : `Siparis #${selectedOrder.id.slice(0, 8)}`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Popup tahsilat akisi. Ekrandan ayrilmadan odeme, split ve iptal yap.</p>
              </div>
              <Link href="/cashier" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto">
                Kapat
              </Link>
            </div>

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
                  <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Bilgisi</p>
                            <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</p>
                            <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                            {order.delivery_address ? <p className="mt-1 break-words text-sm text-slate-500">{order.delivery_address}</p> : null}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{order.status}</span>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Kalemleri</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {(order.items as OrderItem[]).map((item, index) => (
                            <li key={`${order.id}-${item.product_id}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <span className="min-w-0 break-words font-semibold text-slate-900">
                                  {item.quantity}x {item.name}
                                </span>
                                <span className="shrink-0 font-numeric">{Number(item.line_total).toFixed(2)} TL</span>
                              </div>
                              {item.modifiers?.length ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Finans Ozet</p>
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

                      <form action={applyFinancialsAction} className="grid gap-2 rounded-[20px] border border-slate-200 bg-white p-4 md:grid-cols-3">
                        <input type="hidden" name="orderId" value={order.id} />
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
                          Finans Guncelle
                        </button>
                      </form>
                    </div>
                  </section>

                  <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <CashierPaymentPanel
                      orderId={order.id}
                      defaultAmount={remaining}
                      items={order.items as OrderItem[]}
                      requestKey={paymentRequestKey}
                      action={completePaymentAction}
                    />

                    <form action={cancelOrderAction} className="grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4 content-start">
                      <input type="hidden" name="orderId" value={order.id} />
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
                  </section>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </BackofficePage>
  );
}
