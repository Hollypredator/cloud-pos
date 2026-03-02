import Link from "next/link";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { requireRole } from "@/lib/auth";
import { getKitchenPageSnapshot, updateOrderStatus } from "@/lib/data";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import type { Order, OrderItem } from "@/lib/types";

async function moveOrder(formData: FormData) {
  "use server";
  await requireRole(["admin", "kitchen"], "/kitchen");

  const orderId = formData.get("orderId");
  const nextStatus = formData.get("nextStatus");
  if (typeof orderId !== "string" || typeof nextStatus !== "string") {
    return;
  }

  await updateOrderStatus(orderId, nextStatus as "pending" | "preparing" | "served");
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

function inferStationLabel(categoryName?: string) {
  const normalized = normalizeLabel(categoryName ?? "");
  if (
    normalized.includes("icecek") ||
    normalized.includes("kahve") ||
    normalized.includes("bar") ||
    normalized.includes("kokteyl")
  ) {
    return "Bar";
  }
  if (normalized.includes("tatli") || normalized.includes("firin") || normalized.includes("dessert")) {
    return "Tatli";
  }
  return "Mutfak";
}

function stationTone(station: string) {
  if (station === "Bar") return "bg-sky-100 text-sky-700";
  if (station === "Tatli") return "bg-amber-100 text-amber-700";
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

function buildStationGroups(order: Order, productCategoryMap: Map<string, string>, categoryNameMap: Map<string, string>) {
  const stationGroups = new Map<string, OrderItem[]>();
  for (const item of order.items as OrderItem[]) {
    const categoryId = productCategoryMap.get(item.product_id);
    const categoryName = categoryId ? categoryNameMap.get(categoryId) : undefined;
    const station = inferStationLabel(categoryName);
    if (!stationGroups.has(station)) {
      stationGroups.set(station, []);
    }
    stationGroups.get(station)?.push(item);
  }
  return stationGroups;
}

export default async function KitchenPage() {
  await requireRole(["admin", "kitchen"], "/kitchen");
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
  const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]));
  const stationGroupsByOrder = new Map(orders.map((order) => [order.id, buildStationGroups(order, productCategoryMap, categoryNameMap)]));
  const delayMap = new Map(orders.map((order) => [order.id, getDelayLevel(order.status, order.created_at)]));

  const stationBoards = ["Mutfak", "Bar", "Tatli"].map((station) => {
    const stationOrders = orders.filter((order) => {
      const groups = stationGroupsByOrder.get(order.id);
      return groups?.has(station) ?? false;
    });

    return {
      label: station,
      orders: stationOrders,
      pending: stationOrders.filter((order) => order.status === "pending").length,
      preparing: stationOrders.filter((order) => order.status === "preparing").length,
      served: stationOrders.filter((order) => order.status === "served").length,
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
              <section key={board.label} className="rounded-[24px] border border-slate-200 bg-[#f7f8fa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Istasyon</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{board.label}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {board.pending} bekleyen - {board.preparing} hazirlanan - {board.served} hazir
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${board.tone}`}>{board.orders.length} siparis</span>
                </div>

                <div className="mt-4 space-y-4">
                  {board.orders.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Bu istasyonda aktif siparis yok.
                    </div>
                  ) : (
                    board.orders.map((order) => {
                      const delay = delayMap.get(order.id)!;
                      const stationGroups = stationGroupsByOrder.get(order.id)!;
                      const items = stationGroups.get(board.label) ?? [];

                      return (
                        <article
                          key={`${board.label}-${order.id}`}
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
                              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
                              <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleTimeString("tr-TR")}</p>
                            </div>
                            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${board.tone}`}>{board.label}</span>
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
                            <div key={`${order.id}-${board.label}-${item.product_id}`} className="rounded-2xl bg-slate-50 px-3 py-3">
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
                                href={`/admin/print-center/kitchen/${order.id}?layout=thermal&station=${encodeURIComponent(board.label)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto"
                              >
                                Fis Yazdir
                              </Link>
                              <form action={moveOrder}>
                                <input type="hidden" name="orderId" value={order.id} />
                                <input
                                  type="hidden"
                                  name="nextStatus"
                                  value={order.status === "pending" ? "preparing" : order.status === "preparing" ? "served" : "preparing"}
                                />
                                <button
                                  type="submit"
                                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white sm:w-auto ${
                                    order.status === "pending"
                                      ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
                                      : order.status === "preparing"
                                        ? "bg-slate-900"
                                        : "bg-emerald-700"
                                  }`}
                                >
                                  {order.status === "pending" ? "Hazirlanmaya Al" : order.status === "preparing" ? "Servise Hazir" : "Geri Al"}
                                </button>
                              </form>
                            </div>
                          </div>
                          {order.status === "served" ? (
                            <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-emerald-900">Siparis tampon alanda tutuluyor</p>
                                <p className="mt-1 text-emerald-700">Yanlis basim veya son dakika duzeltmesi icin mutfaktan geri alinabilir.</p>
                              </div>
                              <Link href="/cashier" className="rounded-xl border border-emerald-200 bg-white px-3 py-2 font-semibold text-emerald-800">
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
