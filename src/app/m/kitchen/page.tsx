import { revalidatePath } from "next/cache";
import Link from "next/link";
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

function stationLabel(station: KitchenStation) {
  if (station === "bar") return "Bar";
  if (station === "dessert") return "Tatli";
  return "Mutfak";
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
  if (status === "served" || status === "ready") return "Servise Hazir";
  if (status === "preparing") return "Hazirlaniyor";
  return "Bekliyor";
}

function statusTone(status: string) {
  if (status === "served" || status === "ready") return "m-tone-success";
  if (status === "preparing") return "m-tone-neutral";
  return "m-tone-warning";
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
      <section className="m-card mt-3">
        <p className="m-label">Mutfak</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">{featureAccess.title}</h2>
        <p className="m-muted mt-1">{featureAccess.description}</p>
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

      {usingDemoData ? <div className="m-card m-banner-warning">Demo veri modu aktif.</div> : null}

      <section className="m-grid-3 mt-3">
        <article className="m-card text-center">
          <p className="m-label">Aktif</p>
          <p className="m-value text-orange-700">{orders.length}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Hazirlanan</p>
          <p className="m-value text-sky-700">{totalPreparing}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Kritik</p>
          <p className="m-value text-rose-700">{totalCritical}</p>
        </article>
      </section>

      <section className="m-card m-segment-wrap mt-3">
        <div className="m-segment-row">
          {stationBoards.map((board) => (
            <Link key={board.key} href={stationHref(board.key)} data-active={activeBoard.key === board.key} className="m-segment-pill">
              {stationLabel(board.key)} ({board.orders.length})
            </Link>
          ))}
        </div>
      </section>

      <section className="m-card mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-label">Aktif Istasyon</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{stationLabel(activeBoard.key)}</h2>
            <p className="m-muted mt-1">
              {activeBoard.pending} bekleyen - {activeBoard.preparing} hazirlanan - {activeBoard.served} hazir
            </p>
          </div>
          <span className={`m-pill ${activeBoard.critical > 0 ? "m-tone-critical" : activeBoard.delayed > 0 ? "m-tone-warning" : "m-tone-neutral"}`}>
            {activeBoard.critical > 0 ? `${activeBoard.critical} kritik` : `${activeBoard.orders.length} is`}
          </span>
        </div>
      </section>

      <section className="m-stack mt-3">
        {activeBoard.orders.length === 0 ? (
          <article className="m-card">
            <p className="m-value-sm">Bu istasyonda aktif siparis yok.</p>
            <p className="m-muted mt-1">Yeni siparis geldiginde burada gorunur.</p>
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
                className={`m-card ${delay.critical ? "border-rose-300" : delay.delayed ? "border-amber-300" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-label">{orderSourceLabel(order)}</p>
                    <p className="m-value-sm truncate">Siparis #{orderRef(order)}</p>
                    <p className="m-muted mt-1">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                  </div>
                  <span className={`m-pill ${statusTone(stationStatus)}`}>{statusLabel(stationStatus)}</span>
                </div>

                {delay.delayed ? (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${delay.critical ? "mobile-tone-critical" : "mobile-tone-warning"}`}>
                    {delay.critical ? "Kritik gecikme" : "Gecikme"} - {delay.elapsedMin} dk
                  </p>
                ) : null}

                <div className="mt-3 space-y-2">
                  {items.map((item, index) => (
                    <div key={`${order.id}-${item.product_id}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.quantity}x {item.name}
                      </p>
                      {item.modifiers?.length ? (
                        <p className="m-muted mt-1">
                          {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <form action={moveMobileOrder} className="mt-3">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="station" value={activeBoard.key} />
                  <input type="hidden" name="nextStatus" value={nextStatus} />
                  <PendingSubmitButton
                    idleLabel={stationStatus === "pending" ? "Hazirlanmaya Al" : stationStatus === "preparing" ? "Servise Hazir" : "Geri Al"}
                    pendingLabel="Guncelleniyor..."
                    showToastOnClick={true}
                    className="m-btn-primary w-full"
                  />
                </form>
              </article>
            );
          })
        )}
      </section>

      <div className="h-2" aria-hidden="true" />
    </>
  );
}
