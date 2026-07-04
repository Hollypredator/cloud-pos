import Link from "next/link";
import { 
  TrendingUp, 
  ShoppingBag, 
  ChefHat, 
  ReceiptText, 
  BellRing, 
  Table2, 
  Zap, 
  AlertTriangle, 
  ChevronRight, 
  History 
} from "lucide-react";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { requireRole } from "@/lib/auth";
import { getOpsPageSnapshot } from "@/lib/data";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { formatOrderSourceLabel } from "@/lib/order-label";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";

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
  if (status === "preparing") return "Hazırlanıyor";
  if (status === "ready") return "Servise Hazır";
  if (status === "served") return "Servise Hazır";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandı";
  return status;
}

function toneClass(value: number, critical = false) {
  if (critical && value > 0) return "m-tone-critical uupm-glow-danger";
  if (value > 0) return "m-tone-warning uupm-glow-warning";
  return "m-tone-neutral";
}

export default async function MobileOpsPage() {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

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
      description: `${ops.criticalKitchenOrders} kritik sipariş bekliyor`,
      href: "/m/kitchen",
      cta: "Mutfak Board",
      icon: ChefHat,
      tone: toneClass(ops.delayedKitchenOrders, true),
    },
    {
      title: isSelfServiceCoffee ? "Sipariş Yönetimi Kuyruğu" : "Kasa Kuyruğu",
      value: ops.servedOrders,
      description: isSelfServiceCoffee ? "Durum güncellemesi bekleyen teslimatlar" : "Ödeme bekleyen aktif adisyonlar",
      href: "/m/cashier",
      cta: isSelfServiceCoffee ? "Sipariş Yönetimi" : "Tahsilat Paneli",
      icon: ReceiptText,
      tone: toneClass(ops.servedOrders),
    },
    {
      title: "Masa Talepleri",
      value: ops.openServiceRequests,
      description: "Servis veya hesap çağıran masalar",
      href: "/m/service-requests",
      cta: "Talepleri Gör",
      icon: BellRing,
      tone: toneClass(ops.openServiceRequests),
    },
    {
      title: "Masa Akışı",
      value: metrics.occupiedTables,
      description: `${metrics.emptyTables} boş masa servise hazır`,
      href: "/m/tables",
      cta: "Masaları Aç",
      icon: Table2,
      tone: metrics.occupiedTables > metrics.emptyTables ? "m-tone-warning" : "m-tone-success",
    },
  ];

  const quickActions = [
    { href: "/admin/orders", label: "Sipariş Aç", icon: Zap },
    { href: "/m/cashier", label: isSelfServiceCoffee ? "Sipariş Yönetimi" : "Tahsilat", icon: ReceiptText },
    { href: "/m/kitchen", label: "Mutfak Ekranı", icon: ChefHat },
    { href: "/m/delivery", label: "Kurye/Teslimat", icon: ShoppingBag },
  ];

  return (
    <>
      <LiveOpsBridge tables={["orders", "tables", "table_requests", "payments"]} />
      <LiveRouteRefresh tables={["orders", "table_requests", "payments", "tables"]} debounceMs={260} minIntervalMs={1500} />

      {usingDemoData ? (
        <div className="m-card m-banner-warning flex items-center gap-3 border border-amber-300 rounded-[20px] bg-amber-50 p-4 shadow-sm mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">
            Demo veri modu aktif. Mobil operasyon akışları deneme verisiyle çalışıyor.
          </p>
        </div>
      ) : null}

      {/* Main KPIs Stats Grid */}
      <section className="grid grid-cols-2 gap-3.5">
        <article className="uupm-card-interactive rounded-[24px] border border-slate-200/60 bg-gradient-to-br from-indigo-500 to-indigo-700 p-4.5 text-white shadow-md shadow-indigo-500/10">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-100">Günlük Ciro</p>
            <TrendingUp className="h-4.5 w-4.5 text-indigo-200" />
          </div>
          <p className="mt-2.5 text-xl font-black tracking-tight uupm-monospace-num">{formatMoney(metrics.todayRevenue)}</p>
          <p className="mt-1 text-[10px] font-bold text-indigo-200">Net tahsilat toplamı</p>
        </article>

        <article className="uupm-card-interactive rounded-[24px] border border-slate-200/60 bg-gradient-to-br from-slate-900 to-slate-800 p-4.5 text-white shadow-md shadow-slate-950/15">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Açık Sipariş</p>
            <ShoppingBag className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <p className="mt-2.5 text-2xl font-black tracking-tight uupm-monospace-num">{metrics.openOrders}</p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">Aktif hazırlanan siparişler</p>
        </article>
      </section>

      {/* Queue Cards */}
      <section className="grid gap-3.5 mt-4">
        {queueCards.map((item) => {
          const Icon = item.icon;
          const isCritical = item.tone.includes("m-tone-critical");
          return (
            <article 
              key={item.title} 
              className={`m-card uupm-card-interactive rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm transition-all duration-300 ${
                isCritical ? "uupm-pulsing-critical" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 shrink-0`}>
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{item.title}</h3>
                    <p className="text-2xl font-black text-slate-900 mt-1 uupm-monospace-num">{item.value}</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-1">{item.description}</p>
                  </div>
                </div>
                <span className={`m-pill px-3 py-1 text-xs font-bold rounded-full ${item.tone}`}>{item.value}</span>
              </div>
              <Link 
                href={item.href} 
                className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-900 hover:to-slate-900 text-white mt-4 inline-flex w-full items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-xs font-bold shadow-md tracking-wider uppercase transition-all duration-200 active:scale-98"
              >
                {item.cta}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>

      {/* Quick Launch Actions */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500 mb-3.5">Hızlı Başlat</p>
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Link 
                key={action.href} 
                href={action.href} 
                className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 inline-flex items-center justify-center gap-2 px-3 py-3.5 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                <ActionIcon className="h-4 w-4 text-slate-600 shrink-0" strokeWidth={2.4} />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Orders List */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-4">
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-600 shrink-0" strokeWidth={2.4} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Son Siparişler</p>
          </div>
          <Link href="/m/tables" className="text-xs font-extrabold text-slate-800 hover:underline">
            Tümünü Gör
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500 mt-2 py-4 text-center">Son sipariş kaydı bulunmuyor.</p>
        ) : (
          <div className="space-y-2.5">
            {recentOrders.slice(0, 5).map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 p-3.5 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Sipariş #{orderRef(order)}</p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{orderSourceLabel(order)}</p>
                  </div>
                  <span className="rounded-full bg-white border border-slate-200/80 px-3 py-1.5 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider shadow-sm">
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400">Toplam Tutar</span>
                  <p className="text-sm font-black text-emerald-700 uupm-monospace-num">{formatMoney(Number(order.final_price ?? order.total_price))}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Critical Stock list */}
      {lowStockProducts.length > 0 ? (
        <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-4">
          <div className="flex items-center gap-2 mb-3.5">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0" strokeWidth={2.4} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Kritik Stok Uyarısı</p>
          </div>
          <div className="space-y-2">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/20 px-3.5 py-3">
                <span className="text-xs font-bold text-slate-800">{product.name}</span>
                <span className="rounded-full bg-rose-500 text-white px-3 py-1 text-xs font-black uupm-monospace-num shadow-sm shadow-rose-500/10">
                  {Number(product.stock_count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="h-4" aria-hidden="true" />
    </>
  );
}
