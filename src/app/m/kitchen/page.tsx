import { revalidatePath } from "next/cache";
import Link from "next/link";
import { 
  Flame, 
  ChefHat, 
  Coffee, 
  CakeSlice, 
  Clock, 
  CheckSquare, 
  Undo, 
  AlertTriangle 
} from "lucide-react";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireRole } from "@/lib/auth";
import { getKitchenPageSnapshot } from "@/lib/data";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { Order, OrderItem } from "@/lib/types";

type KitchenStation = "kitchen" | "bar" | "dessert";
type StationProgress = "pending" | "preparing" | "served";

async function moveMobileOrder(formData: FormData) {
  "use server";
  await requireRole(["admin", "kitchen"], "/m/kitchen");

  const orderId = formData.get("orderId");
  const station = formData.get("station");
  const nextStatus = formData.get("nextStatus");
  if (
    typeof orderId !== "string" ||
    (station !== "kitchen" && station !== "bar" && station !== "dessert") ||
    (nextStatus !== "pending" && nextStatus !== "preparing" && nextStatus !== "served")
  ) {
    return;
  }

  await executeWebOpsCommand({
    type: "ORDER_STATUS_SET",
    payload: {
      order_id: orderId,
      status: nextStatus,
      station,
    },
  });
  revalidatePath("/m/kitchen");
  revalidatePath("/kitchen");
  revalidatePath("/m/ops");
  revalidatePath("/ops");
}

function getDelayLevel(status: string, createdAt: string) {
  const elapsedMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (status === "pending" && elapsedMin >= 15) return { delayed: true, critical: elapsedMin >= 25, elapsedMin };
  if (status === "preparing" && elapsedMin >= 20) return { delayed: true, critical: elapsedMin >= 35, elapsedMin };
  return { delayed: false, critical: false, elapsedMin };
}

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("\u0131", "i")
    .replaceAll("\u00f6", "o")
    .replaceAll("\u00fc", "u")
    .replaceAll("\u015f", "s")
    .replaceAll("\u00e7", "c")
    .replaceAll("\u011f", "g");
}

function inferStationByName(categoryName?: string): KitchenStation {
  const normalized = normalizeLabel(categoryName ?? "");
  if (normalized.includes("icecek") || normalized.includes("kahve") || normalized.includes("bar") || normalized.includes("kokteyl")) {
    return "bar";
  }
  if (normalized.includes("tatli") || normalized.includes("firin") || normalized.includes("dessert")) {
    return "dessert";
  }
  return "kitchen";
}

function inferStationByItemName(itemName?: string): KitchenStation {
  const normalized = normalizeLabel(itemName ?? "");
  if (
    normalized.includes("viski") ||
    normalized.includes("whisky") ||
    normalized.includes("vodka") ||
    normalized.includes("bira") ||
    normalized.includes("sarap") ||
    normalized.includes("kokteyl") ||
    normalized.includes("tequila") ||
    normalized.includes("tekila") ||
    normalized.includes("gin") ||
    normalized.includes("raki") ||
    normalized.includes("rom")
  ) {
    return "bar";
  }
  if (
    normalized.includes("tatli") ||
    normalized.includes("sufle") ||
    normalized.includes("souffle") ||
    normalized.includes("pasta") ||
    normalized.includes("cheesecake") ||
    normalized.includes("brownie") ||
    normalized.includes("dondurma")
  ) {
    return "dessert";
  }
  return "kitchen";
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
    return order.customer_name ? `Paket Servis - ${order.customer_name}` : "Paket Servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-Al - ${order.customer_name}` : "Gel-Al";
  }
  return formatOrderTableLabel(order);
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function stationLabel(station: KitchenStation) {
  if (station === "bar") return "Bar / İçecek";
  if (station === "dessert") return "Tatlı / Fırın";
  return "Mutfak / Yemek";
}

function parseKitchenStation(value?: string | null): KitchenStation {
  if (value === "bar" || value === "dessert" || value === "kitchen") {
    return value;
  }
  return "kitchen";
}

function stationHref(station: KitchenStation) {
  return `/m/kitchen?station=${station}`;
}

function statusLabel(status: string) {
  if (status === "served" || status === "ready") return "Hazır";
  if (status === "preparing") return "Hazırlanıyor";
  return "Bekliyor";
}

function statusTone(status: string) {
  if (status === "served" || status === "ready") return "bg-emerald-500 text-white uupm-glow-success";
  if (status === "preparing") return "bg-sky-500 text-white uupm-glow-success";
  return "bg-amber-500 text-white uupm-glow-warning";
}

function resolveStationFromCategory(category?: { name: string; prep_station?: string | null }): KitchenStation {
  if (category?.prep_station === "bar" || category?.prep_station === "dessert" || category?.prep_station === "kitchen") {
    return category.prep_station;
  }
  return inferStationByName(category?.name);
}

function resolveStationStatus(order: Order, station: KitchenStation): StationProgress {
  const stationStatus = order.station_statuses?.[station];
  if (stationStatus === "pending" || stationStatus === "preparing" || stationStatus === "served") {
    return stationStatus;
  }
  if (order.status === "pending" || order.status === "preparing") {
    return order.status;
  }
  if (order.status === "ready" || order.status === "served" || order.status === "partially_paid") {
    return "served";
  }
  return "pending";
}

function buildStationGroups(
  order: Order,
  productCategoryMap: Map<string, string>,
  categoryMap: Map<string, { name: string; prep_station?: string | null }>,
) {
  const stationGroups = new Map<KitchenStation, OrderItem[]>();
  for (const item of order.items as OrderItem[]) {
    const categoryId = productCategoryMap.get(item.product_id);
    const category = categoryId ? categoryMap.get(categoryId) : undefined;
    const station = category ? resolveStationFromCategory(category) : inferStationByItemName(item.name);
    if (!stationGroups.has(station)) {
      stationGroups.set(station, []);
    }
    stationGroups.get(station)?.push(item);
  }
  return stationGroups;
}

export default async function MobileKitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "kitchen"], "/m/kitchen");
  const { station: stationParam } = await searchParams;
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = resolveOperatingProfile(businessScope?.activeBusinessType) === "coffee_self_service";
  const activeStation = stationParam ? parseKitchenStation(stationParam) : isSelfServiceCoffee ? "bar" : "kitchen";

  const featureAccessResult = await measureAsync("m_kitchen_feature_access", () => getFeatureAccess("kitchen_display"));
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    logServerPerf("/m/kitchen", [featureAccessResult]);
    return (
      <section className="m-card border border-rose-200 bg-rose-50/50 rounded-[24px] p-5 shadow-sm mt-3 flex items-start gap-4">
        <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0" strokeWidth={2.4} />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-500">Kısıtlı Mod</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">{featureAccess.title}</h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">{featureAccess.description}</p>
        </div>
      </section>
    );
  }

  const kitchenSnapshotResult = await measureAsync("m_kitchen_snapshot", () => getKitchenPageSnapshot());
  logServerPerf("/m/kitchen", [featureAccessResult, kitchenSnapshotResult]);
  const { orders, products, categories, usingDemoData } = kitchenSnapshotResult.value;

  const productCategoryMap = new Map(products.map((product) => [product.id, product.category_id]));
  const categoryMap = new Map(categories.map((category) => [category.id, { name: category.name, prep_station: category.prep_station }]));
  const stationGroupsByOrder = new Map(orders.map((order) => [order.id, buildStationGroups(order, productCategoryMap, categoryMap)]));

  const stationBoards = (["kitchen", "bar", "dessert"] as KitchenStation[]).map((station) => {
    const stationOrders = orders.filter((order) => {
      const groups = stationGroupsByOrder.get(order.id);
      return groups?.has(station) ?? false;
    });

    return {
      key: station,
      orders: stationOrders,
      pending: stationOrders.filter((order) => resolveStationStatus(order, station) === "pending").length,
      preparing: stationOrders.filter((order) => resolveStationStatus(order, station) === "preparing").length,
      served: stationOrders.filter((order) => resolveStationStatus(order, station) === "served").length,
      delayed: stationOrders.filter((order) => getDelayLevel(resolveStationStatus(order, station), order.created_at).delayed).length,
      critical: stationOrders.filter((order) => getDelayLevel(resolveStationStatus(order, station), order.created_at).critical).length,
    };
  });
  const activeBoard = stationBoards.find((board) => board.key === activeStation) ?? stationBoards[0];
  const totalCritical = stationBoards.reduce((sum, board) => sum + board.critical, 0);
  const totalPreparing = stationBoards.reduce((sum, board) => sum + board.preparing, 0);

  return (
    <>
      <LiveOpsBridge tables={["orders"]} enableSound fallbackIntervalMs={900} />
      <LiveRouteRefresh tables={["orders"]} debounceMs={120} minIntervalMs={700} />

      {usingDemoData ? (
        <div className="m-card m-banner-warning border border-amber-300 rounded-[20px] bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800 font-sans">Demo veri modu aktif.</p>
        </div>
      ) : null}

      {/* Kitchen Stats Panel */}
      <section className="m-grid-3">
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Aktif İşler</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900 uupm-monospace-num">{orders.length}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Hazırlanan</p>
          <p className="mt-1.5 text-2xl font-black text-sky-600 uupm-monospace-num">{totalPreparing}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Kritik Gec.</p>
          <p className="mt-1.5 text-2xl font-black text-rose-600 uupm-monospace-num">{totalCritical}</p>
        </article>
      </section>

      {/* Station Selector Bar */}
      <section className="m-card m-segment-wrap rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm mt-3.5">
        <div className="m-segment-row">
          {stationBoards.map((board) => {
            const isActive = activeBoard.key === board.key;
            return (
              <Link 
                key={board.key} 
                href={stationHref(board.key)} 
                data-active={isActive} 
                className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4 py-3"
              >
                {board.key === "kitchen" && <ChefHat className="h-4 w-4 mr-1.5 shrink-0" />}
                {board.key === "bar" && <Coffee className="h-4 w-4 mr-1.5 shrink-0" />}
                {board.key === "dessert" && <CakeSlice className="h-4 w-4 mr-1.5 shrink-0" />}
                {stationLabel(board.key).split(" / ")[0]} ({board.orders.length})
              </Link>
            );
          })}
        </div>
      </section>

      {/* Selected Station Board Summary */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Aktif Istasyon</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900">{stationLabel(activeBoard.key)}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1 font-sans">
              {activeBoard.pending} bekleyen - {activeBoard.preparing} hazırlanan - {activeBoard.served} hazır
            </p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-wider ${
            activeBoard.critical > 0 
              ? "bg-rose-500 text-white uupm-glow-danger" 
              : activeBoard.delayed > 0 
                ? "bg-amber-500 text-white uupm-glow-warning" 
                : "bg-slate-200 text-slate-800"
          }`}>
            {activeBoard.critical > 0 ? `${activeBoard.critical} Kritik` : `${activeBoard.orders.length} Sipariş`}
          </span>
        </div>
      </section>

      {/* Orders list stack */}
      <section className="m-stack mt-3.5">
        {activeBoard.orders.length === 0 ? (
          <article className="m-card border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center rounded-[24px]">
            <p className="text-sm font-bold text-slate-800">Bu istasyonda aktif sipariş yok.</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Yeni sipariş girildiğinde burada görünecektir.</p>
          </article>
        ) : (
          activeBoard.orders.map((order) => {
            const stationStatus = resolveStationStatus(order, activeBoard.key);
            const delay = getDelayLevel(stationStatus, order.created_at);
            const stationGroups = stationGroupsByOrder.get(order.id);
            const items = stationGroups?.get(activeBoard.key) ?? [];
            const nextStatus = stationStatus === "pending" ? "preparing" : stationStatus === "preparing" ? "served" : "preparing";

            return (
              <article
                key={`${activeBoard.key}-${order.id}`}
                className={`m-card uupm-card-interactive rounded-[24px] border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                  delay.critical 
                    ? "border-rose-400 uupm-pulsing-critical" 
                    : delay.delayed 
                      ? "border-amber-400 uupm-pulsing-warning" 
                      : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                    <p className="text-sm font-black text-slate-900 mt-1">Sipariş #{orderRef(order)}</p>
                    <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                      <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">{new Date(order.created_at).toLocaleTimeString("tr-TR", {hour: "2-digit", minute: "2-digit"})}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-widest ${statusTone(stationStatus)}`}>
                    {statusLabel(stationStatus)}
                  </span>
                </div>

                {delay.delayed ? (
                  <div className={`mt-3.5 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold border ${
                    delay.critical 
                      ? "border-rose-100 bg-rose-50 text-rose-800" 
                      : "border-amber-100 bg-amber-50 text-amber-800"
                  }`}>
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>
                      {delay.critical ? "Kritik Gecikme" : "Gecikme Uyarısı"} — {delay.elapsedMin} dakikadır bekliyor
                    </span>
                  </div>
                ) : null}

                {/* Items in this station for this order */}
                <div className="mt-4 space-y-2.5">
                  {items.map((item, index) => (
                    <div key={`${order.id}-${item.product_id}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/50 px-3.5 py-3 shadow-sm">
                      <p className="text-xs font-black text-slate-900">
                        {item.quantity}x {item.name}
                      </p>
                      {item.modifiers?.length ? (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100/50 flex flex-wrap gap-1">
                          {item.modifiers.map((modifier) => (
                            <span key={`${modifier.group_name}-${modifier.option_name}`} className="text-[9px] font-extrabold uppercase tracking-wider bg-white border border-slate-200/60 px-2 py-0.5 rounded text-slate-500">
                              {modifier.option_name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <form action={moveMobileOrder} className="mt-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="station" value={activeBoard.key} />
                  <input type="hidden" name="nextStatus" value={nextStatus} />
                  <PendingSubmitButton
                    idleLabel={
                      stationStatus === "pending" 
                        ? "Hazırlanmaya Al" 
                        : stationStatus === "preparing" 
                          ? "Servise Hazır" 
                          : "Geri Al"
                    }
                    pendingLabel="Güncelleniyor..."
                    showToastOnClick={true}
                    className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 text-white w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-98 transition-all"
                  />
                </form>
              </article>
            );
          })
        )}
      </section>

      <div className="h-4" aria-hidden="true" />
    </>
  );
}
