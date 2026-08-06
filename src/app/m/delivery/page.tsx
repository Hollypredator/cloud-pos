import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  User, 
  MapPin, 
  CreditCard, 
  Bike, 
  Clock, 
  PlusCircle, 
  X, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
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
  if (order.fulfillment_status === "completed") return "Teslim Edildi";
  if (order.fulfillment_status === "out_for_delivery") return "Yolda";
  return "Kurye Bekliyor";
}

function stageTone(stage: DeliveryStage) {
  if (stage === "done") return "bg-emerald-500 text-white uupm-glow-success";
  if (stage === "travel") return "bg-sky-500 text-white uupm-glow-success";
  return "bg-amber-500 text-white uupm-glow-warning";
}

async function createMobileCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  if (typeof fullName !== "string" || !fullName.trim()) {
    redirect(feedbackHref("error", "Kurye adı zorunludur."));
  }

  const result = await createCourier({
    fullName,
    phone: typeof phone === "string" ? phone : undefined,
  });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Kurye oluşturulamadı."));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  redirect(feedbackHref("success", "Yeni kurye başarıyla oluşturuldu."));
}

async function assignMobileCourierAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

  const orderId = formData.get("orderId");
  const courierValue = formData.get("courierValue");
  const stage = parseDeliveryStage(typeof formData.get("stage") === "string" ? String(formData.get("stage")) : undefined);
  if (typeof orderId !== "string" || typeof courierValue !== "string") {
    redirect(feedbackHref("error", "Sipariş ve kurye seçimi zorunludur.", { stage }));
  }

  const [courierId, courierName, courierPhone] = courierValue.split("||");
  if (!courierId || !courierName) {
    redirect(feedbackHref("error", "Geçerli bir kurye seçin.", { stage }));
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
      redirect(feedbackHref("error", result.message ?? "Kurye ataması tamamlanamadı.", { stage }));
    }
  } catch {
    redirect(feedbackHref("error", "Kurye ataması tamamlanamadı.", { stage }));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Sipariş kuryeye atandı.", { stage: "travel" }));
}

async function completeMobileDeliveryAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/delivery");

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string") {
    redirect(feedbackHref("error", "Teslimat kapatılacak sipariş bulunamadı.", { stage: "travel" }));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "DELIVERY_COMPLETE",
      payload: { order_id: orderId },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Teslimat kapanışı yapılamadı.", { stage: "travel" }));
    }
  } catch {
    redirect(feedbackHref("error", "Teslimat kapanışı yapılamadı.", { stage: "travel" }));
  }

  revalidatePath("/m/delivery");
  revalidatePath("/delivery");
  revalidatePath("/m/ops");
  redirect(feedbackHref("success", "Teslimat tamamlandı.", { stage: "done" }));
}

function mobileOrderCard(
  order: Order,
  stage: DeliveryStage,
  couriers: Array<{ id: string; full_name: string; phone: string | null }>,
) {
  const total = Number(order.final_price ?? order.total_price);
  const address = order.delivery_address?.trim() || "Adres belirtilmedi";

  return (
    <article key={order.id} className="m-card uupm-card-interactive rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Sipariş #{orderRef(order)}</p>
          <h2 className="mt-1 truncate text-base font-black text-slate-900">{order.customer_name ?? "İsimsiz Müşteri"}</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">{order.customer_phone ?? "Telefon Yok"}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest ${stageTone(stage)}`}>
          {timelineLabel(order)}
        </span>
      </div>

      <div className="mt-3.5 rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs font-semibold text-slate-700 flex items-start gap-2">
        <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0" strokeWidth={2.2} />
        <span>{address}</span>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Tutar</p>
          <p className="mt-1 text-sm font-black text-emerald-700 uupm-monospace-num">{formatMoney(total)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 shadow-sm">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Atanan Kurye</p>
          <p className="mt-1 truncate text-xs font-black text-slate-900 flex items-center gap-1">
            <Bike className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            {order.courier_name ?? "Atanmadı"}
          </p>
        </div>
      </div>

      {stage === "dispatch" ? (
        <form action={assignMobileCourierAction} className="mt-4 grid gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="stage" value={stage} />
          <select
            name="courierValue"
            defaultValue=""
            disabled={couriers.length === 0}
            required
            className="min-h-[46px] rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none"
          >
            <option value="" disabled>
              {couriers.length === 0 ? "Kurye bulunamadı (Önce kurye ekleyin)" : "Kurye Seçin"}
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
            pendingLabel="Atanıyor..."
            disabled={couriers.length === 0}
            className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 text-white w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-98 transition-all"
          />
        </form>
      ) : null}

      {stage === "travel" ? (
        <form action={completeMobileDeliveryAction} className="mt-4">
          <input type="hidden" name="orderId" value={order.id} />
          <PendingSubmitButton 
            idleLabel="Teslim Edildi (Kapat)" 
            pendingLabel="İşleniyor..." 
            className="mobile-cta-primary bg-gradient-to-r from-emerald-600 to-emerald-700 text-white w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-98 transition-all" 
          />
        </form>
      ) : null}

      <Link 
        href={`/m/delivery?stage=${stage}&order=${order.id}`} 
        className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 inline-flex w-full items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider mt-2.5 transition-all active:scale-95"
      >
        Detayı Göster
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
      <section className="m-card border border-rose-200 bg-rose-50/50 rounded-[24px] p-5 shadow-sm mt-3 flex items-start gap-4">
        <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" strokeWidth={2.4} />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-500">Kısıtlı Mod</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">{featureAccess.title}</h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">{featureAccess.description}</p>
        </div>
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

      {/* Delivery Stats board */}
      <section className="m-grid-3">
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Dispatch</p>
          <p className="mt-1.5 text-2xl font-black text-amber-600 uupm-monospace-num">{awaitingDispatch.length}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Yoldakiler</p>
          <p className="mt-1.5 text-2xl font-black text-sky-600 uupm-monospace-num">{outForDelivery.length}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 font-sans">Kurye</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900 uupm-monospace-num">{couriers.length}</p>
        </article>
      </section>

      {/* Stage Selector Pills */}
      <section className="m-card m-segment-wrap rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm mt-3.5">
        <div className="m-segment-row">
          <Link href={stageHref("dispatch")} data-active={activeStage === "dispatch"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Dispatch ({awaitingDispatch.length})
          </Link>
          <Link href={stageHref("travel")} data-active={activeStage === "travel"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Yolda ({outForDelivery.length})
          </Link>
          <Link href={stageHref("done")} data-active={activeStage === "done"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Biten ({completed.length})
          </Link>
        </div>
      </section>

      {/* Selected stage header description */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Kurye Operasyonu</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 font-sans">
              {activeStage === "dispatch" ? "Kurye Atama Ekranı" : activeStage === "travel" ? "Yoldaki Siparişler" : "Tamamlanan Teslimatlar"}
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-1 font-sans">
              {activeStage === "dispatch"
                ? "Hazırlanan siparişleri aktif kuryelere atayın."
                : activeStage === "travel"
                  ? "Teslimatı gerçekleşen siparişleri kapatın."
                  : "Bugün tamamlanan teslimat geçmişini inceleyin."}
            </p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${stageTone(activeStage)}`}>
            {activeOrders.length} İş
          </span>
        </div>
      </section>

      {/* Active Orders List stack */}
      <section className="m-stack mt-3.5">
        {activeOrders.length === 0 ? (
          <article className="m-card border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center rounded-[24px]">
            <p className="text-sm font-bold text-slate-800">Bu aşamada sipariş bulunmuyor.</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Paket servis siparişi eklendiğinde burada görünür.</p>
          </article>
        ) : (
          activeOrders.map((order) => mobileOrderCard(order, activeStage, couriers))
        )}
      </section>

      {/* Courier addition form */}
      {activeStage === "dispatch" ? (
        <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-3.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 mb-3">Yeni Kurye Ekle</p>
          <form action={createMobileCourierAction} className="grid gap-2.5">
            <input 
              name="fullName" 
              placeholder="Kurye Adı Soyadı" 
              required 
              className="min-h-[46px] rounded-2xl border border-slate-200 px-3.5 text-xs font-semibold placeholder:text-slate-400 bg-white focus:outline-none" 
            />
            <input 
              name="phone" 
              placeholder="Telefon Numarası" 
              className="min-h-[46px] rounded-2xl border border-slate-200 px-3.5 text-xs font-semibold placeholder:text-slate-400 bg-white focus:outline-none" 
            />
            <PendingSubmitButton 
              idleLabel="Kurye Oluştur" 
              pendingLabel="Oluşturuluyor..." 
              className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 min-h-[46px] w-full text-xs font-bold uppercase tracking-wider rounded-2xl shadow-sm" 
            />
          </form>
        </section>
      ) : null}

      {/* Selected Order Drawer Details */}
      {selectedOrder ? (
        <section className="m-card rounded-[24px] border border-slate-900 bg-slate-50 p-4.5 shadow-md mt-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Teslimat Detayı</p>
              <h2 className="mt-1 text-base font-extrabold text-slate-900">Sipariş #{orderRef(selectedOrder)}</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{timelineLabel(selectedOrder)}</p>
            </div>
            <Link 
              href={stageHref(activeStage)} 
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-all active:scale-90 shadow-sm"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.4} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Müşteri</p>
              <p className="mt-1 truncate text-xs font-black text-slate-900">{selectedOrder.customer_name ?? "Belirtilmedi"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Tutar</p>
              <p className="mt-1 text-xs font-black text-emerald-800 uupm-monospace-num">
                {formatMoney(Number(selectedOrder.final_price ?? selectedOrder.total_price))}
              </p>
            </div>
          </div>

          <div className="mt-3.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-xs font-semibold text-slate-700 flex items-start gap-2 shadow-sm">
            <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0" strokeWidth={2.2} />
            <span>{selectedOrder.delivery_address ?? "Adres belirtilmedi"}</span>
          </div>

          {selectedOrder.delivery_note ? (
            <div className="mt-2.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-xs font-semibold text-slate-500 flex items-start gap-2 shadow-sm">
              <AlertCircle className="h-4.5 w-4.5 text-slate-400 shrink-0" strokeWidth={2.2} />
              <span>{selectedOrder.delivery_note}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="h-4" aria-hidden="true" />
    </>
  );
}
