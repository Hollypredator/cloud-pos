import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, NoticeBanner, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { requireRole } from "@/lib/auth";
import {
  assignOrderCourier,
  createCourier,
  deleteCourier,
  getOrderReceipt,
  listCouriers,
  listOrders,
  markDeliveryCompleted,
  updateCourier,
} from "@/lib/data";
import { getFeatureAccess } from "@/lib/plan-access";
import type { Order } from "@/lib/types";

function feedbackHref(tone: "success" | "error", message: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    tone,
    feedback: message,
    ...(extra ?? {}),
  });
  return `/delivery?${params.toString()}`;
}

async function createCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier", "waiter"], "/delivery");

  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  if (typeof fullName !== "string" || !fullName.trim()) {
    redirect(feedbackHref("error", "Kurye adi zorunludur."));
  }

  const result = await createCourier({
    fullName,
    phone: typeof phone === "string" ? phone : undefined,
  });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Kurye kaydi olusturulamadi."));
  }
  revalidatePath("/delivery");
  redirect(feedbackHref("success", "Yeni kurye olusturuldu."));
}

async function assignCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier", "waiter"], "/delivery");

  const orderId = formData.get("orderId");
  const courierValue = formData.get("courierValue");
  if (typeof orderId !== "string" || typeof courierValue !== "string") {
    redirect(feedbackHref("error", "Siparis ve kurye secimi zorunludur."));
  }

  const [courierId, courierName, courierPhone] = courierValue.split("||");
  if (!courierId || !courierName) {
    redirect(feedbackHref("error", "Gecerli bir kurye secin."));
  }

  try {
    await assignOrderCourier({
      orderId,
      courierId,
      courierName,
      courierPhone: courierPhone || null,
    });
    revalidatePath("/delivery");
    revalidatePath("/ops");
    revalidatePath("/kitchen");
    redirect(feedbackHref("success", "Siparis kuryeye atandi."));
  } catch {
    redirect(feedbackHref("error", "Kurye atamasi tamamlanamadi."));
  }
}

async function updateCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier", "waiter"], "/delivery");

  const courierId = formData.get("courierId");
  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  const isActive = formData.get("isActive") === "on";
  if (typeof courierId !== "string" || typeof fullName !== "string") {
    redirect(feedbackHref("error", "Guncellenecek kurye bulunamadi."));
  }

  const result = await updateCourier({
    courierId,
    fullName,
    phone: typeof phone === "string" ? phone : undefined,
    isActive,
  });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Kurye guncellenemedi.", { courier: courierId }));
  }

  revalidatePath("/delivery");
  redirect(feedbackHref("success", "Kurye bilgileri guncellendi.", { courier: courierId }));
}

async function deleteCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier", "waiter"], "/delivery");

  const courierId = formData.get("courierId");
  if (typeof courierId !== "string") {
    redirect(feedbackHref("error", "Silinecek kurye bulunamadi."));
  }

  const result = await deleteCourier(courierId);
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Kurye silinemedi.", { courier: courierId }));
  }

  revalidatePath("/delivery");
  redirect(feedbackHref("success", "Kurye silindi."));
}

async function completeDeliveryAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier", "waiter"], "/delivery");

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Teslimat kapatilacak siparis bulunamadi."));
  }

  try {
    await markDeliveryCompleted(orderId);
    revalidatePath("/delivery");
    revalidatePath("/cashier");
    revalidatePath("/ops");
    redirect(feedbackHref("success", "Teslimat tamamlandi olarak isaretlendi."));
  } catch {
    redirect(feedbackHref("error", "Teslimat kapanisi yapilamadi."));
  }
}

function cardTone(kind: "awaiting" | "travel" | "done") {
  if (kind === "awaiting") return "bg-[#fff2ee] text-[#ff5a34]";
  if (kind === "travel") return "bg-sky-100 text-sky-700";
  return "bg-emerald-100 text-emerald-700";
}

function timelineLabel(order: Order) {
  if (order.fulfillment_status === "completed") return "Teslim tamamlandi";
  if (order.fulfillment_status === "out_for_delivery") return "Kurye yolda";
  return "Kurye atamasi bekliyor";
}

function renderOrderCard(
  order: Order,
  kind: "awaiting" | "travel" | "done",
  couriers: Array<{ id: string; full_name: string; phone: string | null }>,
) {
  return (
    <article key={order.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Delivery Order</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
          <p className="mt-1 text-sm text-slate-500">{order.customer_name ?? "Musteri belirtilmedi"}</p>
          {order.customer_phone ? <p className="mt-1 text-sm text-slate-500">{order.customer_phone}</p> : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cardTone(kind)}`}>{timelineLabel(order)}</span>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
        {order.delivery_address ?? "Adres belirtilmedi"}
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
          <span>Tutar</span>
          <span className="font-semibold text-emerald-700">{Number(order.final_price ?? order.total_price).toFixed(2)} TL</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
          <span>Kurye</span>
          <span>{order.courier_name ?? "Atanmadi"}</span>
        </div>
      </div>

      {kind === "awaiting" ? (
        <form action={assignCourierAction} className="mt-4 grid gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <select
            name="courierValue"
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Kurye sec
            </option>
            {couriers.map((courier) => (
              <option key={courier.id} value={`${courier.id}||${courier.full_name}||${courier.phone ?? ""}`}>
                {courier.full_name}
                {courier.phone ? ` - ${courier.phone}` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
          >
            Kuryeye Ata
          </button>
        </form>
      ) : null}

      {kind === "travel" ? (
        <form action={completeDeliveryAction} className="mt-4">
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
            Teslim Edildi
          </button>
        </form>
      ) : null}
    </article>
  );
}

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string; tone?: "success" | "error"; order?: string; courier?: string }>;
}) {
  await requireRole(["admin", "cashier", "waiter"], "/delivery");
  const featureAccess = await getFeatureAccess("delivery_dispatch");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title="Teslimat" description="Kurye atama ve dispatch yonetimi">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }
  const { feedback, tone, order: selectedOrderId, courier: selectedCourierId } = await searchParams;
  const [{ orders, usingDemoData: usingOrdersDemo }, { couriers, usingDemoData: usingCouriersDemo }, selectedOrderResult] = await Promise.all([
    listOrders(["pending", "preparing", "served"], { includeItems: false }),
    listCouriers(),
    typeof selectedOrderId === "string" ? getOrderReceipt(selectedOrderId) : Promise.resolve({ order: null, usingDemoData: false }),
  ]);

  const deliveryOrders = orders.filter((order) => order.channel === "delivery");
  const awaitingDispatch = deliveryOrders.filter((order) => order.fulfillment_status === "awaiting_dispatch");
  const outForDelivery = deliveryOrders.filter((order) => order.fulfillment_status === "out_for_delivery");
  const completed = deliveryOrders.filter((order) => order.fulfillment_status === "completed");
  const selectedOrder = selectedOrderResult.order;
  const selectedCourier = selectedCourierId ? couriers.find((courier) => courier.id === selectedCourierId) ?? null : null;

  return (
    <BackofficePage
      title="Teslimat Board"
      description="Dispatch, kurye atama ve teslimat takibini tek operasyonda yonet"
      actions={
        <>
          <LiveOpsBridge tables={["orders", "couriers"]} />
          <Link href="/ops" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
            Panele Don
          </Link>
        </>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Islem tamamlanamadi" : "Islem tamamlandi"}
          description={feedback}
        />
      ) : null}

      {usingOrdersDemo || usingCouriersDemo ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif. Dispatch, kurye atama ve teslim akisini bu board uzerinden test edebilirsin.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Dispatch" value={String(awaitingDispatch.length)} hint="Kurye bekleyen siparis" tone="accent" />
        <SummaryCard label="Yolda" value={String(outForDelivery.length)} hint="Aktif dagitim" tone="neutral" />
        <SummaryCard label="Tamamlanan" value={String(completed.length)} hint="Bugun kapanan teslimat" tone="success" />
        <SummaryCard label="Aktif Kurye" value={String(couriers.length)} hint="Kullanilabilir kurye" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ContentCard title="Dispatch Board">
          {deliveryOrders.length === 0 ? (
            <EmptyPanel title="Teslimat Yok" description="Aktif delivery siparisi bulunmuyor." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded-[24px] border border-slate-200 bg-[#f7f8fa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Asama</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dispatch</h2>
                    <p className="mt-1 text-sm text-slate-500">Kurye atamasi bekleyen siparisler</p>
                  </div>
                  <span className="rounded-full bg-[#fff2ee] px-3 py-1 text-xs font-semibold text-[#ff5a34]">{awaitingDispatch.length}</span>
                </div>
                <div className="mt-4 space-y-4">
                  {awaitingDispatch.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Dispatch bekleyen siparis yok.
                    </div>
                  ) : (
                    awaitingDispatch.map((order) => (
                      <div key={order.id}>
                        {renderOrderCard(order, "awaiting", couriers)}
                        <Link
                          href={`/delivery?order=${order.id}`}
                          className="mt-2 block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
                        >
                          Detayi Ac
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-[#f7f8fa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Asama</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Yolda</h2>
                    <p className="mt-1 text-sm text-slate-500">Kurye tarafinda dagitima cikan siparisler</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{outForDelivery.length}</span>
                </div>
                <div className="mt-4 space-y-4">
                  {outForDelivery.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Yolda siparis yok.
                    </div>
                  ) : (
                    outForDelivery.map((order) => (
                      <div key={order.id}>
                        {renderOrderCard(order, "travel", couriers)}
                        <Link
                          href={`/delivery?order=${order.id}`}
                          className="mt-2 block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
                        >
                          Detayi Ac
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-[#f7f8fa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Asama</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Tamamlanan</h2>
                    <p className="mt-1 text-sm text-slate-500">Teslimi kapanmis siparisler</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{completed.length}</span>
                </div>
                <div className="mt-4 space-y-4">
                  {completed.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Tamamlanan teslimat yok.
                    </div>
                  ) : (
                    completed.map((order) => (
                      <div key={order.id}>
                        {renderOrderCard(order, "done", couriers)}
                        <Link
                          href={`/delivery?order=${order.id}`}
                          className="mt-2 block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
                        >
                          Detayi Ac
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </ContentCard>

        <div className="space-y-5">
          <WorkflowGuide
            title="Teslimatta 3 Adim"
            description="Kurye operasyonunu bilmeyen biri de dispatch akisini rahat kullansin."
            steps={[
              { title: "Dispatch kolonunu kontrol et", description: "Kurye bekleyen siparis varsa once o siparise uygun kuryeyi sec ve ata." },
              { title: "Yolda durumunu izle", description: "Kurye ataninca siparis Yolda kolonuna gecer; aktif dagitimi buradan takip et." },
              { title: "Teslim edilince kapat", description: "Teslim Edildi butonu ile siparisi kapat; kasa ve raporlar aninda guncellenir." },
            ]}
          />

          <ContentCard title="Kurye Olustur">
            <form action={createCourierAction} className="grid gap-3">
              <input
                name="fullName"
                placeholder="Kurye adi"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                required
              />
              <input
                name="phone"
                placeholder="Telefon"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Kurye Olustur
              </button>
            </form>
          </ContentCard>

          <ContentCard title="Kurye Kartlari">
            {couriers.length === 0 ? (
              <EmptyPanel title="Kurye Yok" description="Ilk kuryeyi ekleyince teslimat board ile baglayabilirsin." />
            ) : (
              <div className="space-y-3">
                {couriers.map((courier) => {
                  const activeOrders = outForDelivery.filter((order) => order.courier_id === courier.id).length;
                  const assignedOrders = deliveryOrders.filter((order) => order.courier_id === courier.id).length;
                  return (
                    <div key={courier.id} className="rounded-[22px] border border-slate-200 bg-[#fbfbfc] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-slate-900">{courier.full_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{courier.phone ?? "Telefon yok"}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {!courier.is_active ? "Pasif" : activeOrders > 0 ? "Aktif" : "Musait"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-white px-3 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Atanan</p>
                          <p className="mt-1 text-xl font-semibold text-slate-900">{assignedOrders}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Yolda</p>
                          <p className="mt-1 text-xl font-semibold text-slate-900">{activeOrders}</p>
                        </div>
                      </div>
                      <Link
                        href={`/delivery?courier=${courier.id}`}
                        className="mt-3 block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
                      >
                        Kurye Detayi
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </ContentCard>
        </div>
      </section>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-4xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Teslimat Detayi</p>
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  Siparis #{selectedOrder.id.slice(0, 8)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Adres, not, urunler ve teslim akisini ayni sayfada yonet.</p>
              </div>
              <Link href="/delivery" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Kapat
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Musteri</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{selectedOrder.customer_name ?? "Musteri yok"}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedOrder.customer_phone ?? "Telefon yok"}</p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kurye</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{selectedOrder.courier_name ?? "Atanmadi"}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedOrder.courier_phone ?? "Telefon yok"}</p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Tutar</p>
                <p className="font-display font-numeric mt-3 text-2xl font-semibold text-emerald-700">
                  {Number(selectedOrder.final_price ?? selectedOrder.total_price).toFixed(2)} TL
                </p>
                <p className="mt-1 text-sm text-slate-500">{timelineLabel(selectedOrder)}</p>
              </article>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Siparis Icerigi</h3>
                <div className="mt-4 space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <article key={`${selectedOrder.id}-${item.product_id}-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{item.quantity}x {item.name}</p>
                          {item.modifiers?.length ? (
                            <p className="mt-1 text-sm text-slate-500">
                              {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" • ")}
                            </p>
                          ) : null}
                        </div>
                        <p className="font-display font-numeric text-lg font-semibold text-slate-900">{Number(item.line_total).toFixed(2)} TL</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="space-y-5">
                <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Adres ve Not</h3>
                  <div className="mt-4 rounded-[22px] bg-slate-50 p-4 text-sm text-slate-700">
                    {selectedOrder.delivery_address ?? "Adres belirtilmedi"}
                  </div>
                  <div className="mt-3 rounded-[22px] bg-slate-50 p-4 text-sm text-slate-700">
                    {selectedOrder.delivery_note ?? "Teslim notu yok"}
                  </div>
                </article>
                <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Hizli Aksiyonlar</h3>
                  <div className="mt-4 grid gap-3">
                    <Link href="/cashier" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                      Kasada Kontrol Et
                    </Link>
                    <Link href={`/delivery?courier=${selectedOrder.courier_id ?? ""}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                      Kuryeyi Gor
                    </Link>
                  </div>
                </article>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCourier ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-4xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kurye Detayi</p>
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">{selectedCourier.full_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedCourier.phone ?? "Telefon yok"}</p>
              </div>
              <Link href="/delivery" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Kapat
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Atanan Siparis"
                value={String(deliveryOrders.filter((order) => order.courier_id === selectedCourier.id).length)}
                hint="Bu kuryeye bagli toplam delivery"
              />
              <SummaryCard
                label="Yolda"
                value={String(outForDelivery.filter((order) => order.courier_id === selectedCourier.id).length)}
                hint="Aktif dagitim"
                tone="accent"
              />
              <SummaryCard
                label="Tamamlanan"
                value={String(completed.filter((order) => order.courier_id === selectedCourier.id).length)}
                hint="Kapanan teslimat"
                tone="success"
              />
            </div>

            <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="mb-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Kurye Bilgileri</h3>
                  <form action={updateCourierAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="courierId" value={selectedCourier.id} />
                    <input
                      name="fullName"
                      defaultValue={selectedCourier.full_name}
                      placeholder="Kurye adi"
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                      required
                    />
                    <input
                      name="phone"
                      defaultValue={selectedCourier.phone ?? ""}
                      placeholder="Telefon"
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked={selectedCourier.is_active} className="h-4 w-4 rounded border-slate-300" />
                      Kurye aktif olarak kullanilsin
                    </label>
                    <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                      Kurye Bilgilerini Kaydet
                    </button>
                  </form>
                </article>

                <article className="rounded-[24px] border border-rose-200 bg-rose-50/60 p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Kurye Kaldir</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Aktif teslimati olmayan kuryeleri kaldirabilirsin. Aktif siparisi varsa sistem silmeye izin vermez.
                  </p>
                  <form action={deleteCourierAction} className="mt-4">
                    <input type="hidden" name="courierId" value={selectedCourier.id} />
                    <button type="submit" className="rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700">
                      Kuryeyi Sil
                    </button>
                  </form>
                </article>
              </div>

              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Kurye Siparisleri</h3>
              <div className="mt-4 space-y-3">
                {deliveryOrders.filter((order) => order.courier_id === selectedCourier.id).length === 0 ? (
                  <EmptyPanel title="Atanan Siparis Yok" description="Bu kurye icin atanmis delivery siparisi bulunmuyor." />
                ) : (
                  deliveryOrders
                    .filter((order) => order.courier_id === selectedCourier.id)
                    .map((order) => (
                      <article key={order.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">Siparis #{order.id.slice(0, 8)}</p>
                            <p className="mt-1 text-sm text-slate-500">{order.customer_name ?? "Musteri yok"}</p>
                            <p className="mt-1 text-sm text-slate-500">{order.delivery_address ?? "Adres yok"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cardTone(order.fulfillment_status === "completed" ? "done" : order.fulfillment_status === "out_for_delivery" ? "travel" : "awaiting")}`}>
                            {timelineLabel(order)}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/delivery?order=${order.id}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                            Siparisi Ac
                          </Link>
                          <Link href="/cashier" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                            Kasaya Git
                          </Link>
                        </div>
                      </article>
                    ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </BackofficePage>
  );
}
