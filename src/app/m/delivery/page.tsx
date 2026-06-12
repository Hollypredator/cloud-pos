import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireRole } from "@/lib/auth";
import { createCourier, getDeliveryPageSnapshot } from "@/lib/data";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { Order } from "@/lib/types";

type DeliveryStage = "dispatch" | "travel" | "done";

type MobileDeliverySearchParams = {
  stage?: string;
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

function parseDeliveryStage(value?: string | null): DeliveryStage {
  if (value === "travel" || value === "done" || value === "dispatch") {
    return value;
  }
  return "dispatch";
}

function stageHref(stage: DeliveryStage) {
  return `/m/delivery?stage=${stage}`;
}

function feedbackHref(tone: "success" | "error", message: string, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ tone, feedback: message });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  return `/m/delivery?${params.toString()}`;
}

function timelineLabel(order: Order) {
  if (order.fulfillment_status === "completed") return "Teslim edildi";
  if (order.fulfillment_status === "out_for_delivery") return "Kurye yolda";
  return "Kurye bekliyor";
}

function stageTone(stage: DeliveryStage) {
  if (stage === "done") return "m-tone-success";
  if (stage === "travel") return "m-tone-neutral";
  return "m-tone-warning";
}

async function createMobileCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

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
    redirect(feedbackHref("error", result.error ?? "Kurye olusturulamadi."));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  redirect(feedbackHref("success", "Yeni kurye olusturuldu."));
}

async function assignMobileCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

  const orderId = formData.get("orderId");
  const courierValue = formData.get("courierValue");
  const stage = parseDeliveryStage(typeof formData.get("stage") === "string" ? String(formData.get("stage")) : undefined);
  if (typeof orderId !== "string" || typeof courierValue !== "string") {
    redirect(feedbackHref("error", "Siparis ve kurye secimi zorunludur.", { stage }));
  }

  const [courierId, courierName, courierPhone] = courierValue.split("||");
  if (!courierId || !courierName) {
    redirect(feedbackHref("error", "Gecerli bir kurye secin.", { stage }));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "DELIVERY_ASSIGN",
      payload: {
        order_id: orderId,
        courier_id: courierId,
        courier_name: courierName,
        courier_phone: courierPhone || null,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Kurye atamasi tamamlanamadi.", { stage }));
    }
  } catch {
    redirect(feedbackHref("error", "Kurye atamasi tamamlanamadi.", { stage }));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Siparis kuryeye atandi.", { stage: "travel" }));
}

async function completeMobileDeliveryAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Teslimat kapatilacak siparis bulunamadi.", { stage: "travel" }));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "DELIVERY_COMPLETE",
      payload: { order_id: orderId },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Teslimat kapanisi yapilamadi.", { stage: "travel" }));
    }
  } catch {
    redirect(feedbackHref("error", "Teslimat kapanisi yapilamadi.", { stage: "travel" }));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Teslimat tamamlandi.", { stage: "done" }));
}

function mobileOrderCard(
  order: Order,
  stage: DeliveryStage,
  couriers: Array<{ id: string; full_name: string; phone: string | null }>,
) {
  const total = Number(order.final_price ?? order.total_price);
  const address = order.delivery_address?.trim() || "Adres belirtilmedi";

  return (
    <article key={order.id} className="m-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-label">Siparis #{orderRef(order)}</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">{order.customer_name ?? "Musteri yok"}</h2>
          <p className="m-muted mt-1">{order.customer_phone ?? "Telefon yok"}</p>
        </div>
        <span className={`m-pill ${stageTone(stage)}`}>{timelineLabel(order)}</span>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-700">{address}</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="m-label">Tutar</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">{formatMoney(total)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="m-label">Kurye</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{order.courier_name ?? "Atanmadi"}</p>
        </div>
      </div>

      {stage === "dispatch" ? (
        <form action={assignMobileCourierAction} className="mt-3 grid gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="stage" value={stage} />
          <select
            name="courierValue"
            defaultValue=""
            disabled={couriers.length === 0}
            required
            className="min-h-[48px] rounded-2xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="" disabled>
              {couriers.length === 0 ? "Once kurye ekle" : "Kurye sec"}
            </option>
            {couriers.map((courier) => (
              <option key={courier.id} value={`${courier.id}||${courier.full_name}||${courier.phone ?? ""}`}>
                {courier.full_name}
                {courier.phone ? ` - ${courier.phone}` : ""}
              </option>
            ))}
          </select>
          <PendingSubmitButton
            idleLabel="Kuryeye Ata"
            pendingLabel="Ataniyor..."
            disabled={couriers.length === 0}
            className="m-btn-primary w-full"
          />
        </form>
      ) : null}

      {stage === "travel" ? (
        <form action={completeMobileDeliveryAction} className="mt-3">
          <input type="hidden" name="orderId" value={order.id} />
          <PendingSubmitButton idleLabel="Teslim Edildi" pendingLabel="Kapatiliyor..." className="m-btn-primary w-full" />
        </form>
      ) : null}

      <Link href={`/m/delivery?stage=${stage}&order=${order.id}`} className="m-btn-secondary mt-2 inline-flex w-full items-center justify-center">
        Detayi Ac
      </Link>
    </article>
  );
}

export default async function MobileDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<MobileDeliverySearchParams>;
}) {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "cashier"], "/m/delivery");
  const { stage: stageParam, order: selectedOrderId, feedback, tone } = await searchParams;
  const activeStage = parseDeliveryStage(stageParam);

  const featureAccessResult = await measureAsync("m_delivery_feature_access", () => getFeatureAccess("delivery_dispatch"));
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    logServerPerf("/m/delivery", [featureAccessResult]);
    return (
      <section className="m-card mt-3">
        <p className="m-label">Teslimat</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">{featureAccess.title}</h2>
        <p className="m-muted mt-1">{featureAccess.description}</p>
      </section>
    );
  }

  const snapshotResult = await measureAsync("m_delivery_snapshot", () => getDeliveryPageSnapshot(selectedOrderId));
  logServerPerf("/m/delivery", [featureAccessResult, snapshotResult]);
  const { orders, couriers, selectedOrder, usingDemoData } = snapshotResult.value;

  const awaitingDispatch = orders.filter((order) => order.fulfillment_status === "awaiting_dispatch");
  const outForDelivery = orders.filter((order) => order.fulfillment_status === "out_for_delivery");
  const completed = orders.filter((order) => order.fulfillment_status === "completed");
  const activeOrders = activeStage === "dispatch" ? awaitingDispatch : activeStage === "travel" ? outForDelivery : completed;

  return (
    <>
      <LiveOpsBridge tables={["orders", "couriers"]} fallbackIntervalMs={1400} />
      <LiveRouteRefresh tables={["orders", "couriers"]} debounceMs={240} minIntervalMs={1200} />

      {feedback ? <div className={`m-card ${tone === "error" ? "m-banner-error" : "m-banner-success"}`}>{feedback}</div> : null}
      {usingDemoData ? <div className="m-card m-banner-warning">Demo veri modu aktif.</div> : null}

      <section className="m-grid-3 mt-3">
        <article className="m-card text-center">
          <p className="m-label">Dispatch</p>
          <p className="m-value text-orange-700">{awaitingDispatch.length}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Yolda</p>
          <p className="m-value text-sky-700">{outForDelivery.length}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Kurye</p>
          <p className="m-value text-slate-900">{couriers.length}</p>
        </article>
      </section>

      <section className="m-card m-segment-wrap mt-3">
        <div className="m-segment-row">
          <Link href={stageHref("dispatch")} data-active={activeStage === "dispatch"} className="m-segment-pill">
            Dispatch ({awaitingDispatch.length})
          </Link>
          <Link href={stageHref("travel")} data-active={activeStage === "travel"} className="m-segment-pill">
            Yolda ({outForDelivery.length})
          </Link>
          <Link href={stageHref("done")} data-active={activeStage === "done"} className="m-segment-pill">
            Biten ({completed.length})
          </Link>
        </div>
      </section>

      <section className="m-card mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-label">Aktif Akis</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {activeStage === "dispatch" ? "Kurye Atama" : activeStage === "travel" ? "Yoldaki Siparisler" : "Kapanan Teslimatlar"}
            </h2>
            <p className="m-muted mt-1">
              {activeStage === "dispatch"
                ? "Siparisi uygun kuryeye ata."
                : activeStage === "travel"
                  ? "Teslim edilen siparisi tek dokunusla kapat."
                  : "Bugun kapanan teslimatlari kontrol et."}
            </p>
          </div>
          <span className={`m-pill ${stageTone(activeStage)}`}>{activeOrders.length} is</span>
        </div>
      </section>

      <section className="m-stack mt-3">
        {activeOrders.length === 0 ? (
          <article className="m-card">
            <p className="m-value-sm">Bu asamada siparis yok.</p>
            <p className="m-muted mt-1">Yeni delivery siparisi geldiginde burada gorunur.</p>
          </article>
        ) : (
          activeOrders.map((order) => mobileOrderCard(order, activeStage, couriers))
        )}
      </section>

      {activeStage === "dispatch" ? (
        <section className="m-card mt-3">
          <p className="m-label">Kurye Ekle</p>
          <form action={createMobileCourierAction} className="mt-3 grid gap-2">
            <input name="fullName" placeholder="Kurye adi" required className="min-h-[48px] rounded-2xl border border-slate-300 px-3 text-sm" />
            <input name="phone" placeholder="Telefon" className="min-h-[48px] rounded-2xl border border-slate-300 px-3 text-sm" />
            <PendingSubmitButton idleLabel="Kurye Olustur" pendingLabel="Olusturuluyor..." className="m-btn-secondary w-full" />
          </form>
        </section>
      ) : null}

      {selectedOrder ? (
        <section className="m-card mt-3 border-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-label">Teslimat Detayi</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Siparis #{orderRef(selectedOrder)}</h2>
              <p className="m-muted mt-1">{timelineLabel(selectedOrder)}</p>
            </div>
            <Link href={stageHref(activeStage)} className="m-btn-secondary inline-flex min-h-[40px] items-center justify-center px-3 text-xs">
              Kapat
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="m-label">Musteri</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedOrder.customer_name ?? "Yok"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="m-label">Tutar</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {formatMoney(Number(selectedOrder.final_price ?? selectedOrder.total_price))}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-700">
            {selectedOrder.delivery_address ?? "Adres belirtilmedi"}
          </div>
          <div className="mt-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-700">
            {selectedOrder.delivery_note ?? "Teslim notu yok"}
          </div>
        </section>
      ) : null}

      <div className="h-2" aria-hidden="true" />
    </>
  );
}
