"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  History,
  Plus
} from "lucide-react";
import { gsap } from "gsap";

interface Order {
  id: string;
  check_number?: string | null;
  channel?: string;
  table_number?: number;
  table_name?: string | null;
  table_zone_name?: string | null;
  customer_name?: string | null;
  status: string;
  final_price?: any;
  total_price?: any;
}

interface Product {
  id: string;
  name: string;
  stock_count: any;
}

interface MobileOpsDashboardProps {
  metrics: {
    todayRevenue: number;
    openOrders: number;
    occupiedTables: number;
    emptyTables: number;
  };
  recentOrders: Order[];
  lowStockProducts: Product[];
  usingDemoData: boolean;
  ops: {
    delayedKitchenOrders: number;
    criticalKitchenOrders: number;
    servedOrders: number;
    openServiceRequests: number;
  };
  /** Kart ve kisayol etiketlerini takeaway diline cevirir. */
  isSelfServiceCoffee: boolean;
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: Order) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function orderSourceLabel(order: Order) {
  const parts: string[] = [];
  if (order.customer_name?.trim()) {
    parts.push(order.customer_name.trim());
  }
  if (order.table_name?.trim()) {
    parts.push(order.table_name.trim());
  }
  if (order.channel) {
    parts.push(order.channel === "delivery" ? "Paket" : "Masa");
  }
  return parts.length > 0 ? parts.join(" / ") : "Bilinmeyen";
}

function statusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazırlanıyor";
  if (status === "ready") return "Hazır";
  if (status === "served") return "Teslim Edildi";
  if (status === "paid") return "Ödendi";
  return status;
}

export function MobileOpsDashboard({
  metrics,
  recentOrders,
  lowStockProducts,
  usingDemoData,
  ops,
  isSelfServiceCoffee,
}: MobileOpsDashboardProps) {
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dashboardRef.current) {
      gsap.fromTo(".gsap-fade-item",
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power3.out" }
      );
    }
  }, []);

  // Not: takeaway profili burada ayri bir "uygulama baslatici" ekrani
  // goruyordu; sahte odeme ve sahte ÖKC yaniti ureten demo bilesenlere
  // baglaniyordu. Ayni panel her iki profilde kullanilir; takeaway'e ozgu
  // fark yalnizca kart ve kisayol etiketleri (`isSelfServiceCoffee`).

  const totalTables = metrics.occupiedTables + metrics.emptyTables;
  const occupancyPercent = totalTables > 0 ? Math.round((metrics.occupiedTables / totalTables) * 100) : 0;

  const queueItems = [
    {
      title: "Mutfak Gecikme",
      value: ops.delayedKitchenOrders,
      subtitle: `${ops.criticalKitchenOrders} kritik sipariş`,
      href: "/m/kitchen",
      icon: ChefHat,
      colorClass: ops.delayedKitchenOrders > 0 ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-50",
      statusText: ops.delayedKitchenOrders > 0 ? "Gecikme Var" : "Normal",
      statusColor: ops.delayedKitchenOrders > 0 ? "bg-rose-500" : "bg-slate-300"
    },
    {
      title: isSelfServiceCoffee ? "Sipariş Kuyruğu" : "Tahsilat Bekleyen",
      value: ops.servedOrders,
      subtitle: isSelfServiceCoffee ? "Teslimat bekleyenler" : "Ödeme bekleyen adisyonlar",
      href: "/m/cashier",
      icon: ReceiptText,
      colorClass: ops.servedOrders > 0 ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50",
      statusText: ops.servedOrders > 0 ? "Bekleyen Var" : "Temiz",
      statusColor: ops.servedOrders > 0 ? "bg-amber-500" : "bg-slate-300"
    },
    {
      title: "Masa Talepleri",
      value: ops.openServiceRequests,
      subtitle: "Çağrılar & Hesaplar",
      href: "/m/service-requests",
      icon: BellRing,
      colorClass: ops.openServiceRequests > 0 ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-50",
      statusText: ops.openServiceRequests > 0 ? "Aktif Talep" : "Talep Yok",
      statusColor: ops.openServiceRequests > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-300"
    },
    {
      title: "Masa Doluluk",
      value: `${occupancyPercent}%`,
      subtitle: `${metrics.occupiedTables} / ${totalTables} Masa Dolu`,
      href: "/m/tables",
      icon: Table2,
      colorClass: "text-emerald-700 bg-emerald-50",
      statusText: "Aktif Akış",
      statusColor: "bg-emerald-500"
    },
  ];

  const quickActions = [
    { href: "/admin/orders", label: "Sipariş Aç", icon: Plus, color: "bg-rose-900 text-white" },
    { href: "/m/cashier", label: isSelfServiceCoffee ? "Siparişler" : "Tahsilat", icon: ReceiptText, color: "bg-rose-50 text-rose-900" },
    { href: "/m/kitchen", label: "Mutfak", icon: ChefHat, color: "bg-rose-50 text-rose-900" },
    { href: "/m/delivery", label: "Kurye", icon: ShoppingBag, color: "bg-rose-50 text-rose-900" },
  ];

  return (
    <div ref={dashboardRef} className="space-y-6">
      {usingDemoData && (
        <div className="gsap-fade-item flex items-center gap-3 border border-amber-250 rounded-2xl bg-amber-50/70 p-3.5 shadow-sm">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
          <p className="text-[10px] font-bold text-amber-800">
            Demo veri modu aktif. Mobil operasyon akışları deneme verisiyle çalışıyor.
          </p>
        </div>
      )}

      {/* Premium Fintech Card style Daily Revenue container */}
      <section className="gsap-fade-item relative rounded-[28px] border border-rose-950/40 bg-gradient-to-br from-rose-950 to-rose-900 text-white p-6 shadow-xl shadow-rose-950/20 overflow-hidden">
        {/* Background abstract SVG overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,50 Q25,70 50,50 T100,50 L100,100 L0,100 Z" fill="white" />
            <path d="M0,60 Q30,40 60,70 T100,60 L100,100 L0,100 Z" fill="white" />
          </svg>
        </div>

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-200/80">Günlük Net Ciro</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight font-mono">{formatMoney(metrics.todayRevenue)}</h3>
            <p className="mt-3 text-[9px] font-bold text-rose-200/90 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Bulut veritabanı anlık eşitlendi
            </p>
          </div>
          
          <div className="text-right">
            <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-wider border border-white/10">
              <ShoppingBag className="w-3 h-3 text-rose-300" />
              {metrics.openOrders} Açık
            </span>
            <p className="text-[9px] font-bold text-rose-200/70 mt-1.5">Adisyon hazırlanıyor</p>
          </div>
        </div>
      </section>

      {/* Modern Quick Launch app-grid (No clunky full-width cards) */}
      <section className="gsap-fade-item space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60 pl-1">Hızlı İş Akışları</p>
        <div className="grid grid-cols-4 gap-3 bg-white border border-rose-100/40 shadow-sm p-4 rounded-3xl">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link 
                key={i} 
                href={action.href}
                className="flex flex-col items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${action.color}`}>
                  <Icon className="w-5 h-5" strokeWidth={2.4} />
                </div>
                <span className="text-[9px] font-black text-slate-800 text-center tracking-tight leading-tight">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 2x2 Tactile Status grid (Tapping the card opens the page. ZERO clunky buttons!) */}
      <section className="gsap-fade-item space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60 pl-1">İstasyon Durumu</p>
        <div className="grid grid-cols-2 gap-3.5">
          {queueItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                onClick={() => router.push(item.href)}
                className="bg-white border border-rose-100/50 rounded-3xl p-4.5 shadow-[0_4px_24px_rgba(136,19,55,0.01)] hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36"
              >
                <div className="flex justify-between items-start">
                  <div className={`p-2.5 rounded-xl shrink-0 ${item.colorClass}`}>
                    <Icon className="h-4.5 w-4.5" strokeWidth={2.4} />
                  </div>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.statusColor}`}></span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{item.statusText}</span>
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-2.5xl font-black text-slate-900 tracking-tight leading-none font-mono">{item.value}</p>
                  <h4 className="text-[10px] font-black text-slate-800 tracking-tight mt-1.5 leading-tight">{item.title}</h4>
                  <p className="text-[8px] font-bold text-slate-400 mt-0.5 leading-tight">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Clean borderless Recent Orders Feed */}
      <section className="gsap-fade-item bg-white border border-rose-100/40 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-rose-50 pb-3">
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-rose-900" strokeWidth={2.4} />
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-900">Son İşlemler</p>
          </div>
          <Link href="/m/tables" className="text-[9px] font-black text-rose-900 hover:underline uppercase tracking-wider">
            Tümünü Gör
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-4 text-center">İşlem kaydı bulunmuyor.</p>
        ) : (
          <div className="divide-y divide-rose-50/50">
            {recentOrders.slice(0, 4).map((order) => (
              <div 
                key={order.id} 
                onClick={() => router.push(`/m/tables?tableId=${order.id}`)}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/20 px-1 rounded-xl transition-colors"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Sipariş #{orderRef(order)}</p>
                  <p className="text-[9px] font-bold text-slate-500 mt-0.5">{orderSourceLabel(order)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-950 font-mono">{formatMoney(Number(order.final_price ?? order.total_price))}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider mt-1 border ${
                    order.status === "paid" 
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                      : "bg-amber-50 border-amber-100 text-amber-800"
                  }`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Critical Stock list */}
      {lowStockProducts.length > 0 && (
        <section className="gsap-fade-item bg-white border border-rose-100/40 rounded-3xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" strokeWidth={2.4} />
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-900">Kritik Stok Uyarısı</p>
          </div>
          <div className="space-y-2">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/10 px-3.5 py-2.5">
                <span className="text-xs font-bold text-slate-800">{product.name}</span>
                <span className="rounded-full bg-rose-900 text-white px-2.5 py-0.5 text-[10px] font-black font-mono">
                  {Number(product.stock_count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
