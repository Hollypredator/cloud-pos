import { revalidatePath } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { CashierPaymentPanel } from "@/components/cashier-payment-panel";
import {
  BackofficePage,
  ContentCard,
  EmptyPanel,
  SummaryCard,
  WorkflowGuide,
} from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { requireRole } from "@/lib/auth";
import {
  applyOrderFinancials,
  cancelOrder,
  completeOrderPayment,
  getOrderReceipt,
  listOrders,
  refundOrder,
} from "@/lib/data";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";

function buildReceiptLink(orderId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
  return "bg-slate-100 text-slate-700";
}

async function applyFinancialsAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const discountAmount = Number(formData.get("discountAmount"));
  const serviceFee = Number(formData.get("serviceFee"));
  if (typeof orderId !== "string") {
    return;
  }

  await applyOrderFinancials({
    orderId,
    discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
    serviceFee: Number.isFinite(serviceFee) ? serviceFee : 0,
  });
  revalidatePath("/cashier");
  revalidatePath("/");
}

async function completePaymentAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const method = formData.get("method");
  const amount = Number(formData.get("amount"));
  const note = formData.get("note");
  if (typeof orderId !== "string" || typeof method !== "string") {
    return;
  }

  await completeOrderPayment({
    orderId,
    method: method as PaymentMethod,
    amount: Number.isFinite(amount) ? amount : undefined,
    note: typeof note === "string" ? note : undefined,
  });
  revalidatePath("/cashier");
  revalidatePath("/tables");
  revalidatePath("/");
}

async function cancelOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const note = formData.get("note");
  if (typeof orderId !== "string") {
    return;
  }

  await cancelOrder(orderId, typeof note === "string" ? note : undefined);
  revalidatePath("/cashier");
  revalidatePath("/tables");
  revalidatePath("/");
}

async function refundOrderAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier");

  const orderId = formData.get("orderId");
  const method = formData.get("method");
  const amount = Number(formData.get("amount"));
  const note = formData.get("note");
  if (typeof orderId !== "string" || typeof method !== "string") {
    return;
  }

  await refundOrder({
    orderId,
    method: method as PaymentMethod,
    amount: Number.isFinite(amount) ? amount : undefined,
    note: typeof note === "string" ? note : undefined,
  });
  revalidatePath("/cashier");
  revalidatePath("/");
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
  searchParams: Promise<{ order?: string }>;
}) {
  await requireRole(["admin", "cashier"], "/cashier");
  const { order: selectedOrderId } = await searchParams;
  const [{ orders: servedOrders, usingDemoData }, { orders: paidOrders }, selectedOrderResult] = await Promise.all([
    listOrders(["served"], { includeItems: false }),
    listOrders(["paid"], { includeItems: false, limit: 8, ascending: false }),
    typeof selectedOrderId === "string" ? getOrderReceipt(selectedOrderId) : Promise.resolve({ order: null, usingDemoData: false }),
  ]);

  const servedTotals = totals(servedOrders);
  const paidTotals = totals(paidOrders);
  const selectedOrder = selectedOrderResult.order;

  return (
    <BackofficePage
      title="Kasa Ekrani"
      description="Tahsilat, split bill, iade ve adisyon kapanis operasyonu"
      actions={
        <>
          <LiveOpsBridge tables={["orders", "tables", "payments", "cash_register_sessions"]} />
          <Link href="/cashier/session" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
            Gun Islemleri
          </Link>
          <Link href="/ops" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
            Panele Don
          </Link>
        </>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif. Split, odeme ve iade akislarini bu ekran uzerinden test edebilirsin.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Bekleyen Adisyon" value={String(servedOrders.length)} hint="Tahsilat bekleyen siparis" tone="accent" />
        <SummaryCard label="Bekleyen Bakiye" value={`${servedTotals.remaining.toFixed(2)} TL`} hint="Henuz kapanmamis tutar" tone="danger" />
        <SummaryCard label="Bugun Tahsil" value={`${paidTotals.paid.toFixed(2)} TL`} hint={`${paidOrders.length} kapali siparis`} tone="success" />
        <SummaryCard label="Acik Ciro" value={`${servedTotals.final.toFixed(2)} TL`} hint="Served durumundaki adisyonlar" />
      </section>

      <WorkflowGuide
        title="Kasada 3 Adim"
        description="Yeni gelen biri egitim almadan tahsilat akisini izleyebilir."
        steps={[
          { title: "Masayi veya adisyonu sec", description: "Ustteki masa kartlarindan odeme bekleyen adisyonu sec ve popup olarak buyut." },
          { title: "Tutari kontrol et", description: "Gerekirse indirim veya servis ucreti guncelle; kalan bakiyeyi kontrol et." },
          { title: "Odeme al veya bol", description: "Nakit, kart, karma odeme al; esit paylastir veya urun bazli bol ile tahsilati tamamla." },
        ]}
      />

      <ContentCard title="Masa ve Adisyon Secimi">
        {servedOrders.length === 0 ? (
          <EmptyPanel title="Secilecek Adisyon Yok" description="Servise hazir ve tahsilat bekleyen masa bulunmuyor." />
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                      <p className="font-display mt-2 text-xl font-semibold tracking-tight text-slate-900">
                        {order.table_number ? `Masa ${order.table_number}` : order.customer_name ?? "Adisyon"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>Acik</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Kalan</p>
                      <p className="font-display font-numeric mt-1 text-2xl font-semibold text-emerald-700">{remaining.toFixed(2)} TL</p>
                    </div>
                    <span className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">Popup Ac</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </ContentCard>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ContentCard title="Odeme Bekleyen Adisyonlar">
          {servedOrders.length === 0 ? (
            <EmptyPanel title="Adisyon Yok" description="Tahsilat bekleyen siparis bulunmuyor." />
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
                        <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                        {order.delivery_address ? <p className="mt-1 text-sm text-slate-500">{order.delivery_address}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{order.status}</span>
                        <p className="text-2xl font-semibold tracking-tight text-emerald-700">{remaining.toFixed(2)} TL</p>
                        <p className="text-xs text-slate-500">Kalan bakiye</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/cashier?order=${order.id}`}
                        className="rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.22)]"
                      >
                        Buyut ve Tahsilata Gec
                      </Link>
                      <Link href={`/receipt/${order.id}?layout=a4`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        Adisyon Yazdir
                      </Link>
                      <Link href={`/receipt/${order.id}?layout=thermal`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        Fis Yazdir
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ContentCard>

        <ContentCard title="Son Kapanan Adisyonlar">
          {paidOrders.length === 0 ? (
            <EmptyPanel title="Kayit Yok" description="Bugun kapanan adisyon bulunmuyor." />
          ) : (
            <div className="space-y-4">
              {paidOrders.slice(0, 8).map((order) => (
                <article key={order.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
                      <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{order.status}</span>
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
                      <a
                        href={buildReceiptLink(order.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Linki Ac / Paylas
                      </a>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Link href={`/receipt/${order.id}?layout=a4`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Adisyon Yazdir
                        </Link>
                        <Link href={`/receipt/${order.id}?layout=thermal`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Fis Yazdir
                        </Link>
                      </div>
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
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {selectedOrder.table_number ? `Masa ${selectedOrder.table_number} Adisyonu` : `Siparis #${selectedOrder.id.slice(0, 8)}`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Popup tahsilat akisi. Ekrandan ayrilmadan odeme, split ve iptal yap.</p>
              </div>
              <Link href="/cashier" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
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

              return (
                <div className="space-y-4">
                  <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Bilgisi</p>
                            <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</p>
                            <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                            {order.delivery_address ? <p className="mt-1 text-sm text-slate-500">{order.delivery_address}</p> : null}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{order.status}</span>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Kalemleri</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {(order.items as OrderItem[]).map((item, index) => (
                            <li key={`${order.id}-${item.product_id}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-slate-900">
                                  {item.quantity}x {item.name}
                                </span>
                                <span className="font-numeric">{Number(item.line_total).toFixed(2)} TL</span>
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
                          <a
                            href={buildReceiptLink(order.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                          >
                            Linki Ac / Paylas
                          </a>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Link href={`/receipt/${order.id}?layout=a4`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
                              Adisyon Yazdir
                            </Link>
                            <Link href={`/receipt/${order.id}?layout=thermal`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
                              Fis Yazdir
                            </Link>
                          </div>
                          <div className="mt-4 flex justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4">
                            <Image
                              src={buildReceiptQr(order.id)}
                              alt="Adisyon QR"
                              className="h-28 w-28 rounded-xl border border-slate-200 bg-white"
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
                      action={completePaymentAction}
                    />

                    <form action={cancelOrderAction} className="grid gap-2 rounded-[20px] border border-rose-200 bg-rose-50/60 p-4 content-start">
                      <input type="hidden" name="orderId" value={order.id} />
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
