import Link from "next/link";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { requireRole } from "@/lib/auth";
import { getOpsPageSnapshot } from "@/lib/data";
import { logServerPerf, measureAsync } from "@/lib/perf";

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function orderSourceLabel(order: { channel?: string; table_number?: number; customer_name?: string | null }) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket servis / ${order.customer_name}` : "Paket servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al / ${order.customer_name}` : "Gel-al";
  }
  return `Masa ${order.table_number ?? "-"}`;
}

function statusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "ready") return "Servise Hazir";
  if (status === "served") return "Servise Hazir";
  if (status === "partially_paid") return "Kismi Odeme";
  if (status === "paid") return "Kapandi";
  return status;
}

function toneClass(value: number, critical = false) {
  if (critical && value > 0) return "m-tone-critical";
  if (value > 0) return "m-tone-warning";
  return "m-tone-neutral";
}

export default async function MobileOpsPage() {
  await requireRole(["admin", "waiter", "cashier", "kitchen"], "/m/ops");
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
      description: `${ops.criticalKitchenOrders} kritik siparis`,
      href: "/m/kitchen",
      cta: "Mutfaga Git",
      tone: toneClass(ops.delayedKitchenOrders, true),
    },
    {
      title: "Kasa Kuyrugu",
      value: ops.servedOrders,
      description: "Tahsilat bekleyen adisyon",
      href: "/m/cashier",
      cta: "Kasa Ekrani",
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
      title: "Masa Akisi",
      value: metrics.occupiedTables,
      description: `${metrics.emptyTables} bos masa hazir`,
      href: "/m/tables",
      cta: "Masalari Ac",
      tone: metrics.occupiedTables > metrics.emptyTables ? "m-tone-warning" : "m-tone-success",
    },
  ];

  const quickActions = [
    { href: "/m/tables?flow=new-order", label: "Siparis Ac" },
    { href: "/m/cashier", label: "Tahsilat" },
    { href: "/m/kitchen", label: "Mutfak" },
    { href: "/m/delivery", label: "Teslimat" },
  ];

  return (
    <>
      <LiveOpsBridge tables={["orders", "tables", "table_requests", "payments"]} />
      <LiveRouteRefresh tables={["orders", "table_requests", "payments", "tables"]} minIntervalMs={3200} />

      {usingDemoData ? (
        <div className="m-card m-banner-warning">
          Demo veri modu aktif. Mobil operasyon akislari deneme verisiyle calisiyor.
        </div>
      ) : null}

      <section className="m-grid-2">
        <article className="m-card">
          <p className="m-label">Gunluk Ciro</p>
          <p className="m-value">{formatMoney(metrics.todayRevenue)}</p>
          <p className="m-muted">Canli tahsilat toplam net tutar</p>
        </article>
        <article className="m-card">
          <p className="m-label">Acik Siparis</p>
          <p className="m-value">{metrics.openOrders}</p>
          <p className="m-muted">Bekleyen + hazirlanan + servis hazir</p>
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
        <p className="m-label">Hizli Baslat</p>
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
            Tumunu gor
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="m-muted mt-2">Son siparis kaydi bulunmuyor.</p>
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
