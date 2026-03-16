import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireRole } from "@/lib/auth";
import { getKitchenPageSnapshot, updateOrderStationStatus } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import type { Order, OrderItem } from "@/lib/types";

type KitchenStation = "kitchen" | "bar" | "dessert";
type StationProgress = "pending" | "preparing" | "served";

async function moveOrder(formData: FormData) {
  "use server";
  await requireRole(["admin", "kitchen"], "/kitchen");

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

  await updateOrderStationStatus(orderId, station, nextStatus);
  revalidatePath("/kitchen");
  revalidatePath("/ops");
}

function getDelayLevel(status: string, createdAt: string) {
  const elapsedMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (status === "pending" && elapsedMin >= 15) return { delayed: true, critical: elapsedMin >= 25, elapsedMin };
  if (status === "preparing" && elapsedMin >= 20) return { delayed: true, critical: elapsedMin >= 35, elapsedMin };
  return { delayed: false, critical: false, elapsedMin };
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

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g");
}

function inferStationByName(categoryName?: string): KitchenStation {
  const normalized = normalizeLabel(categoryName ?? "");
  if (
    normalized.includes("icecek") ||
    normalized.includes("kahve") ||
    normalized.includes("bar") ||
    normalized.includes("kokteyl")
  ) {
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
  if (station === "bar") return "Bar";
  if (station === "dessert") return "Tatli";
  return "Mutfak";
}

function stationTone(station: KitchenStation) {
  if (station === "bar") return "bg-sky-100 text-sky-700";
  if (station === "dessert") return "bg-amber-100 text-amber-700";
  return "bg-[#fff2ee] text-[#ff5a34]";
}

function statusTone(status: string) {
  if (status === "served") return "bg-emerald-100 text-emerald-700";
  if (status === "preparing") return "bg-sky-100 text-sky-700";
  return "bg-[#fff2ee] text-[#ff5a34]";
}

function statusLabel(status: string) {
  if (status === "served") return "Servise Hazir";
  if (status === "preparing") return "Hazirlaniyor";
  return "Bekliyor";
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
  if (order.status === "pending" || order.status === "preparing" || order.status === "served") {
    return order.status;
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

export default async function KitchenPage() {
  await requireRole(["admin", "kitchen"], "/kitchen");
  const locale = await getCurrentLocale();
  const localeCode = locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : "tr-TR";
  const featureAccessResult = await measureAsync("feature_access", () => getFeatureAccess("kitchen_display"));
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    logServerPerf("/kitchen", [featureAccessResult]);
    return (
      <BackofficePage title="Mutfak" description="Istasyon bazli hazirlama akisi">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
      );
  }
  const kitchenSnapshotResult = await measureAsync("kitchen_snapshot", () => getKitchenPageSnapshot());
  logServerPerf("/kitchen", [featureAccessResult, kitchenSnapshotResult]);
  const { orders, products, categories, usingDemoData } = kitchenSnapshotResult.value;

  const delayedCount = orders.filter((order) => getDelayLevel(order.status, order.created_at).delayed).length;
  const criticalCount = orders.filter((order) => getDelayLevel(order.status, order.created_at).critical).length;
  const preparingCount = orders.filter((order) => order.status === "preparing").length;
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const servedCount = orders.filter((order) => order.status === "served").length;

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
      tone: stationTone(station),
    };
  });

  return (
    <BackofficePage
      title="Mutfak Board"
      description="Istasyon bazli hazirlama kuyrugu, gecikmeler ve servis cikislari"
      actions={
        <>
          <LiveOpsBridge tables={["orders"]} enableSound />
          <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            Panele Don
          </Link>
        </>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif. Bekleyen, hazirlanan ve servis cikisi akisini bu board uzerinden test edebilirsin.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Bekleyen" value={String(pendingCount)} hint="Yeni giren siparisler" tone="accent" />
        <SummaryCard label="Hazirlaniyor" value={String(preparingCount)} hint="Istasyonda islenen siparis" tone="neutral" />
        <SummaryCard label="Servise Hazir" value={String(servedCount)} hint="Tamamlandi ama kasaya devredilmedi" tone="success" />
        <SummaryCard label="Kritik" value={String(criticalCount || delayedCount)} hint="Gecikme ve mudahale ihtiyaci" tone="danger" />
      </section>

      <WorkflowGuide
        title="Mutfakta 3 Adim"
        description="Istasyonu ilk kez acan personel ne yapacagini hemen gorsun."
        steps={[
          { title: "Bekleyen siparisi al", description: "Yeni gelen sipariste once Hazirlanmaya Al butonuna bas; boylece ekip hangi isin aktif oldugunu gorur." },
          { title: "Hazir oldugunda servise cikar", description: "Hazirlaniyor durumundaki siparisi Servise Hazir yap; kasa ve salon tarafina haber gider." },
          { title: "Yanlis basim varsa geri al", description: "Servise Hazir asamasi tampon alandir. Hata varsa Geri Al ile mutfaga geri don." },
        ]}
      />

      <ContentCard title="Istasyon Board">
        {orders.length === 0 ? (
          <EmptyPanel title="Kuyruk Bos" description="Mutfakta islenecek siparis bulunmuyor." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {stationBoards.map((board) => (
              <section key={board.key} className="rounded-[24px] border border-slate-200 bg-[#f7f8fa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Istasyon</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{stationLabel(board.key)}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {board.pending} bekleyen - {board.preparing} hazirlanan - {board.served} hazir
                    </p>
                  </div>
                  <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${board.tone}`}>{board.orders.length} siparis</span>
                </div>

                <div className="mt-4 space-y-4">
                  {board.orders.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Bu istasyonda aktif siparis yok.
                    </div>
                  ) : (
                    board.orders.map((order) => {
                      const stationStatus = resolveStationStatus(order, board.key);
                      const delay = getDelayLevel(stationStatus, order.created_at);
                      const stationGroups = stationGroupsByOrder.get(order.id)!;
                      const items = stationGroups.get(board.key) ?? [];

                      return (
                        <article
                          key={`${board.key}-${order.id}`}
                          className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] ${
                            delay.critical
                              ? "border-rose-300 shadow-[0_12px_24px_rgba(244,63,94,0.16)]"
                              : delay.delayed
                                ? "border-amber-300 shadow-[0_12px_24px_rgba(245,158,11,0.14)]"
                                : "border-slate-200"
                          }`}
                        >
                          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{orderRef(order)}</h3>
                              <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString(localeCode)}</p>
                            </div>
                            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                              <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase sm:w-auto ${statusTone(stationStatus)}`}>{statusLabel(stationStatus)}</span>
                              <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${board.tone}`}>{stationLabel(board.key)}</span>
                            </div>
                          </div>

                          {order.delivery_address ? (
                            <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">{order.delivery_address}</div>
                          ) : null}

                          {delay.delayed ? (
                            <div
                              className={`mt-3 rounded-2xl px-3 py-3 text-sm font-semibold ${
                                delay.critical ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {delay.critical ? "Kritik gecikme" : "Gecikme"} - {delay.elapsedMin} dk
                            </div>
                          ) : null}

                          <div className="mt-3 space-y-2">
                            {items.map((item) => (
                            <div key={`${order.id}-${board.key}-${item.product_id}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="min-w-0 break-words font-semibold text-slate-900">
                                    {item.quantity}x {item.name}
                                  </span>
                                  <span className="shrink-0 text-sm text-slate-500">{Number(item.line_total).toFixed(2)} TL</span>
                                </div>
                                {item.modifiers?.length ? (
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Istasyon Tutari</p>
                              <p className="mt-1 text-xl font-semibold tracking-tight text-emerald-700">
                                {items.reduce((sum, item) => sum + Number(item.line_total), 0).toFixed(2)} TL
                              </p>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                              <Link
                                href={`/admin/print-center/kitchen/${order.id}?layout=thermal&station=${encodeURIComponent(stationLabel(board.key))}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto"
                              >
                                Fis Yazdir
                              </Link>
                              <form action={moveOrder}>
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="station" value={board.key} />
                                <input
                                  type="hidden"
                                  name="nextStatus"
                                  value={stationStatus === "pending" ? "preparing" : stationStatus === "preparing" ? "served" : "preparing"}
                                />
                                <PendingSubmitButton
                                  idleLabel={stationStatus === "pending" ? "Hazirlanmaya Al" : stationStatus === "preparing" ? "Servise Hazir" : "Geri Al"}
                                  pendingLabel="Guncelleniyor..."
                                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white sm:w-auto ${
                                    stationStatus === "pending"
                                      ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
                                      : stationStatus === "preparing"
                                        ? "bg-slate-900"
                                        : "bg-emerald-700"
                                  }`}
                                />
                              </form>
                            </div>
                          </div>
                          {stationStatus === "served" ? (
                            <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-emerald-900">Siparis tampon alanda tutuluyor</p>
                                <p className="mt-1 text-emerald-700">Yanlis basim veya son dakika duzeltmesi icin mutfaktan geri alinabilir.</p>
                              </div>
                              <Link href="/cashier" className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-center font-semibold text-emerald-800 sm:w-auto">
                                Kasaya Git
                              </Link>
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </ContentCard>
    </BackofficePage>
  );
}
