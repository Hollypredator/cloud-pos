import { revalidatePath } from "next/cache";
import { AlertTriangle } from "lucide-react";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { MobileKitchenUi } from "@/components/mobile-kitchen-ui";
import { requireRole } from "@/lib/auth";
import { getKitchenPageSnapshot } from "@/lib/data";
import { getDelayLevel, resolveStationStatus, type KitchenStation } from "@/lib/kitchen-station";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { Order, OrderItem } from "@/lib/types";

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

function resolveStationFromCategory(category?: { name: string; prep_station?: string | null }): KitchenStation {
  if (category?.prep_station === "bar" || category?.prep_station === "dessert" || category?.prep_station === "kitchen") {
    return category.prep_station;
  }
  return inferStationByName(category?.name);
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

  return (
    <>
      <LiveOpsBridge tables={["orders"]} enableSound fallbackIntervalMs={900} />
      <LiveRouteRefresh tables={["orders"]} debounceMs={120} minIntervalMs={700} />

      {usingDemoData && (
        <div className="border border-amber-250 rounded-2xl bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800 font-sans">Demo veri modu aktif.</p>
        </div>
      )}

      <MobileKitchenUi
        orders={orders}
        activeStation={activeStation}
        stationBoards={stationBoards}
        stationGroupsByOrder={stationGroupsByOrder}
        moveMobileOrder={moveMobileOrder}
      />
    </>
  );
}
