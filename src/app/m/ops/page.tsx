import Link from "next/link";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { requireRole } from "@/lib/auth";
import { getOpsPageSnapshot } from "@/lib/data";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { formatOrderSourceLabel } from "@/lib/order-label";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  table_name?: string | null;
  table_zone_name?: string | null;
  customer_name?: string | null;
}) {
  return formatOrderSourceLabel(order, { customerSeparator: " / " });
}

function statusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "ready") return "Servise Hazır";
  if (status === "served") return "Servise Hazır";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandi";
  return status;
}

function toneClass(value: number, critical = false) {
  if (critical && value > 0) return "m-tone-critical";
  if (value > 0) return "m-tone-warning";
  return "m-tone-neutral";
}

export default async function MobileOpsPage() {
  await requireRole(["admin", "cashier", "kitchen"], "/m/ops");
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = resolveOperatingProfile(businessScope?.activeBusinessType) === "coffee_self_service";
  const snapshotResult = await measureAsync("m_ops_snapshot", () => getOpsPageSnapshot({ includeSetup: false }));
  logServerPerf("/m/ops", [snapshotResult]);

  const {
    dashboard: { metrics, recentOrders, lowStockProducts, usingDemoData },
    ops,
  } = snapshotResult.value;

  const queueCards = [
    {
      title: "Mutfak Gecikme",
      value: ops.delayedKitchenOrders,
      description: `${ops.criticalKitchenOrders} kritik sipariş`,
      href: "/m/kitchen",
      cta: "Mutfaga Git",
      tone: toneClass(ops.delayedKitchenOrders, true),
    },
    {
      title: isSelfServiceCoffee ? "Siparis Yonetimi Kuyrugu" : "Kasa Kuyrugu",
      value: ops.servedOrders,
      description: isSelfServiceCoffee ? "Durum guncelleme bekleyen pickup siparisler" : "Tahsilat bekleyen adisyon",
      href: "/m/cashier",
      cta: isSelfServiceCoffee ? "Siparis Yonetimi" : "Kasa Ekrani",
      tone: toneClass(ops.servedOrders),
    },
    {
      title: "Masa Talepleri",
      value: ops.openServiceRequests,
      description: "Acil servis islemleri",
      href: "/m/service-requests",
      cta: "Taleplere Git",
      tone: toneClass(ops.openServiceRequests),
    },
    {
      title: "Masa Akışı",
      value: metrics.occupiedTables,
      description: `${metrics.emptyTables} boş masa hazır`,
      href: "/m/tables",
      cta: "Masalari Ac",
      tone: metrics.occupiedTables > metrics.emptyTables ? "m-tone-warning" : "m-tone-success",
    },
  ];

  const quickActions = [
    { href: "/m/tables?flow=new-order", label: "Siparis Ac" },
    { href: "/m/cashier", label: isSelfServiceCoffee ? "Siparis Yonetimi" : "Tahsilat" },
    { href: "/m/kitchen", label: "Mutfak" },
    { href: "/m/delivery", label: "Teslimat" },
  ];

  return (
    <>
      <LiveOpsBridge tables={["orders", "tables", "table_requests", "payments"]} />
      <LiveRouteRefresh tables={["orders", "table_requests", "payments", "tables"]} minIntervalMs={3200} />

      {usingDemoData ? (
        <div className="m-card m-banner-warning">
          Demo veri modu aktif. Mobil operasyon akışları deneme verisiyle calisiyor.
        </div>
      ) : null}

      <section className="m-grid-2">
        <article className="m-card">
          <p className="m-label">Gunluk Ciro</p>
          <p className="m-value">{formatMoney(metrics.todayRevenue)}</p>
          <p className="m-muted">Canli tahsilat toplam net tutar</p>
        </article>
        <article className="m-card">
          <p className="m-label">Açık Sipariş</p>
          <p className="m-value">{metrics.openOrders}</p>
          <p className="m-muted">Bekleyen + hazirlanan + servis hazır</p>
        </article>
      </section>

      <section className="m-stack mt-3">
        {queueCards.map((item) => (
          <article key={item.title} className="m-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-label">{item.title}</p>
                <p className="m-value">{item.value}</p>
                <p className="m-muted mt-1">{item.description}</p>
              </div>
              <span className={`m-pill ${item.tone}`}>{item.value}</span>
            </div>
            <Link href={item.href} className="m-btn-primary mt-3 inline-flex w-full items-center justify-center">
              {item.cta}
            </Link>
          </article>
        ))}
      </section>

      <section className="m-card mt-3">
        <p className="m-label">Hızlı Baslat</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="m-btn-secondary inline-flex items-center justify-center">
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="m-card mt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="m-label">Son Siparisler</p>
          <Link href="/m/tables" className="text-xs font-semibold text-slate-700">
            Tumunu gör
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="m-muted mt-2">Son sipariş kaydı bulunmuyor.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {recentOrders.slice(0, 8).map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">#{orderRef(order)}</p>
                    <p className="text-xs text-slate-500">{orderSourceLabel(order)}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-emerald-700">{formatMoney(Number(order.final_price ?? order.total_price))}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {lowStockProducts.length > 0 ? (
        <section className="m-card mt-3">
          <p className="m-label">Kritik Stok</p>
          <div className="mt-2 space-y-2">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-medium text-slate-800">{product.name}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {Number(product.stock_count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="h-2" aria-hidden="true" />
    </>
  );
}

