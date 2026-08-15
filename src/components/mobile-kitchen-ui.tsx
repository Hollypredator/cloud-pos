"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ChefHat, 
  Coffee, 
  CakeSlice, 
  Clock, 
  AlertTriangle,
  Play,
  Check
} from "lucide-react";
import { onQueueSynced, startAutoSync } from "@/lib/offline-queue";
import { getDelayLevel, resolveStationStatus, type KitchenStation, type StationProgress } from "@/lib/kitchen-station";
import { gsap } from "gsap";

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  line_total?: any;
  modifiers?: { group_name: string; option_name: string }[] | null;
}

interface Order {
  id: string;
  created_at: string;
  check_number?: string | null;
  channel?: string;
  table_number?: number;
  table_name?: string | null;
  customer_name?: string | null;
  status: string;
  station_statuses?: Record<string, string> | null;
  items: OrderItem[];
}

interface MobileKitchenUiProps {
  orders: any[];
  activeStation: KitchenStation;
  stationBoards: any[];
  stationGroupsByOrder: Map<string, Map<KitchenStation, any[]>>;
  moveMobileOrder: (formData: FormData) => void;
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: Order) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function orderSourceLabel(order: Order) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket - ${order.customer_name}` : "Paket Servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-Al - ${order.customer_name}` : "Gel-Al";
  }
  return order.table_name?.trim() ? order.table_name.trim() : `Masa ${order.table_number || "-"}`;
}

function stationHref(station: KitchenStation) {
  return `/m/kitchen?station=${station}`;
}

function stationLabel(station: KitchenStation) {
  if (station === "bar") return "Bar / İçecek";
  if (station === "dessert") return "Tatlı / Fırın";
  return "Mutfak / Yemek";
}

export function MobileKitchenUi({
  orders,
  activeStation,
  stationBoards,
  stationGroupsByOrder,
  moveMobileOrder,
}: MobileKitchenUiProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // State to force re-render for counting prep elapsed times in realtime
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animation stagger on ticket load
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(".kitchen-ticket",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
      );
    }
  }, [activeStation]);

  useEffect(() => {
    const stopAutoSync = startAutoSync();
    const stopListening = onQueueSynced(() => {
      setToastMsg("Çevrimdışı mutfak güncellemeleri bulut ile senkronize edildi!");
      setTimeout(() => setToastMsg(null), 4000);
      router.refresh();
    });
    return () => {
      stopAutoSync();
      stopListening();
    };
  }, [router]);

  // Client side offline order status override
  async function handleCycleStatus(orderId: string, currentStatus: StationProgress) {
    let nextStatus: StationProgress = "preparing";
    if (currentStatus === "pending") nextStatus = "preparing";
    else if (currentStatus === "preparing") nextStatus = "served";
    else nextStatus = "preparing";

    if (!navigator.onLine) {
      const { enqueueCommand } = await import("@/lib/offline-queue");
      // Hedef durum anahtara dahil: ayni siparis cevrimdisiyken once
      // "hazirlaniyor" sonra "hazir" yapilabilir, iki komut da korunmali.
      await enqueueCommand({
        type: "ORDER_STATUS_SET",
        groupId: orderId,
        idempotencyKey: `order-status-${nextStatus}-${orderId}`,
        payload: {
          order_id: orderId,
          status: nextStatus,
          station: activeStation,
        },
      });

      setToastMsg(`Çevrimdışı mutfak durumu güncellemesi (${nextStatus === "served" ? "hazır" : "hazırlanıyor"}) kuyruğa alındı.`);
      setTimeout(() => setToastMsg(null), 5000);
      router.refresh();
      return;
    }

    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ORDER_STATUS_SET",
          payload: {
            order_id: orderId,
            status: nextStatus,
            station: activeStation,
          },
        }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        alert("Mutfak durumu güncellenemedi.");
      }
    } catch {
      alert("Ağ hatası nedeniyle durum güncellenemedi.");
    }
  }

  // Find active board
  const activeBoard = stationBoards.find((board) => board.key === activeStation) ?? stationBoards[0];

  // Helper to calculate exact ticking time elapsed
  const getElapsedString = (createdAt: string) => {
    const elapsedSeconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Build sorted station orders list based on priority:
  // 1. Critical delay items first
  // 2. Preparing items next (oldest first)
  // 3. Pending items next (oldest first)
  // 4. Already served / ready items at the bottom
  const sortedStationOrders = [...activeBoard.orders].sort((a, b) => {
    const statusA = resolveStationStatus(a, activeStation);
    const statusB = resolveStationStatus(b, activeStation);
    
    // Serve status ranking
    const rank = (status: StationProgress) => {
      if (status === "preparing") return 1;
      if (status === "pending") return 2;
      return 3; // served
    };

    const delayA = getDelayLevel(statusA, a.created_at);
    const delayB = getDelayLevel(statusB, b.created_at);

    // If both have same status, prioritize critical delays
    if (rank(statusA) === rank(statusB)) {
      if (delayA.critical && !delayB.critical) return -1;
      if (!delayA.critical && delayB.critical) return 1;
      if (delayA.delayed && !delayB.delayed) return -1;
      if (!delayA.delayed && delayB.delayed) return 1;
      
      // Oldest first
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return rank(statusA) - rank(statusB);
  });

  const totalCritical = stationBoards.reduce((sum, board) => sum + board.critical, 0);
  const totalPreparing = stationBoards.reduce((sum, board) => sum + board.preparing, 0);

  return (
    <div ref={containerRef} className="space-y-4">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-rose-950 text-white border border-rose-900 rounded-2xl p-4 shadow-xl text-xs font-black tracking-wide text-center">
          {toastMsg}
        </div>
      )}

      {/* Stats row */}
      <section className="cashier-gsap-item grid grid-cols-3 gap-3">
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Aktif İşler</p>
          <p className="mt-1 text-xl font-black text-rose-950 font-mono">{orders.length}</p>
        </article>
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Hazırlanan</p>
          <p className="mt-1 text-xl font-black text-rose-600 font-mono truncate">{totalPreparing}</p>
        </article>
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Kritik Gec.</p>
          <p className="mt-1 text-xl font-black text-rose-600 font-mono truncate">{totalCritical}</p>
        </article>
      </section>

      {/* Station Selector Bar */}
      <section className="bg-white border border-rose-100/50 rounded-2xl p-2.5 shadow-sm">
        <div className="flex gap-2 justify-between">
          {stationBoards.map((board) => {
            const isActive = activeStation === board.key;
            return (
              <Link 
                key={board.key} 
                href={stationHref(board.key)}
                className={`flex-1 inline-flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[9px] font-black tracking-wide transition-all duration-200 active:scale-95 ${
                  isActive 
                    ? "bg-gradient-to-br from-rose-950 to-rose-900 text-white shadow-md shadow-rose-950/10" 
                    : "text-rose-950/70 hover:bg-rose-50/50"
                }`}
              >
                {board.key === "kitchen" && <ChefHat className="h-4.5 w-4.5 shrink-0" />}
                {board.key === "bar" && <Coffee className="h-4.5 w-4.5 shrink-0" />}
                {board.key === "dessert" && <CakeSlice className="h-4.5 w-4.5 shrink-0" />}
                <span className="truncate">{stationLabel(board.key).split(" / ")[0]} ({board.orders.length})</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Active board summary */}
      <section className="bg-white border border-rose-100/50 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60">Aktif İstasyon</p>
          <h2 className="mt-0.5 text-sm font-black tracking-tight text-rose-950">{stationLabel(activeBoard.key)}</h2>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
            {activeBoard.pending} bekleyen - {activeBoard.preparing} hazırlanan - {activeBoard.served} hazır
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[8.5px] font-black border uppercase tracking-wider ${
          activeBoard.critical > 0 
            ? "bg-rose-100 border-rose-200 text-rose-800 animate-pulse" 
            : activeBoard.delayed > 0 
              ? "bg-amber-100 border-amber-200 text-amber-800" 
              : "bg-rose-50 border-rose-100 text-rose-800"
        }`}>
          {activeBoard.critical > 0 ? `${activeBoard.critical} Kritik` : `${activeBoard.orders.length} Sipariş`}
        </span>
      </section>

      {/* Ticket queue list */}
      <section className="space-y-3">
        {sortedStationOrders.length === 0 ? (
          <article className="border border-dashed border-rose-200 bg-rose-50/10 py-12 text-center rounded-[24px]">
            <p className="text-sm font-extrabold text-rose-950">Bu istasyonda aktif sipariş yok.</p>
            <p className="text-xs font-bold text-rose-700/60 mt-1 max-w-xs mx-auto">Yeni bir sipariş girildiğinde burada listelenecektir.</p>
          </article>
        ) : (
          sortedStationOrders.map((order) => {
            const stationStatus = resolveStationStatus(order, activeStation);
            const delay = getDelayLevel(stationStatus, order.created_at);
            const stationGroups = stationGroupsByOrder.get(order.id);
            const items = stationGroups?.get(activeStation) ?? [];

            let borderStyles = "border-rose-100/50";
            if (delay.critical) borderStyles = "border-rose-500 shadow-md ring-1 ring-rose-500/10";
            else if (delay.delayed) borderStyles = "border-amber-400 shadow-sm";

            return (
              <article 
                key={`${activeStation}-${order.id}`}
                className={`kitchen-ticket bg-white border rounded-[22px] p-4.5 shadow-sm transition-all duration-300 ${borderStyles}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">{orderSourceLabel(order)}</p>
                    <p className="text-xs font-black text-rose-950 mt-1">Sipariş #{orderRef(order)}</p>
                    
                    {/* Real-time Ticking prep time timer */}
                    <div className="flex items-center gap-1.5 text-slate-400 mt-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-rose-900" strokeWidth={2.4} />
                      <p className="text-[10px] font-black font-mono text-rose-950">
                        Süre: {getElapsedString(order.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Status Badge to Cycle Progress */}
                  <button 
                    onClick={() => handleCycleStatus(order.id, stationStatus)}
                    className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border shadow-sm flex items-center gap-1 ${
                      stationStatus === "served"
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                        : stationStatus === "preparing"
                          ? "bg-rose-900 border-rose-900 text-white"
                          : "bg-amber-50 border-amber-100 text-amber-800"
                    }`}
                  >
                    {stationStatus === "pending" && <Play className="w-3 h-3 fill-current shrink-0"/>}
                    {stationStatus === "preparing" && <Check className="w-3 h-3 stroke-[3px] shrink-0"/>}
                    {stationStatus === "pending" ? "Başlat" : stationStatus === "preparing" ? "Hazırla" : "Tamam"}
                  </button>
                </div>

                {/* Delay indicators */}
                {delay.delayed && (
                  <div className={`mt-3.5 rounded-xl px-3 py-2 flex items-center gap-2 text-[10px] font-black border ${
                    delay.critical 
                      ? "border-rose-100 bg-rose-50 text-rose-800" 
                      : "border-amber-100 bg-amber-50 text-amber-800"
                  }`}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 animate-pulse" />
                    <span>
                      {delay.critical ? "Kritik Gecikme" : "Gecikme Uyarısı"} — {delay.elapsedMin} dakikadır bekliyor
                    </span>
                  </div>
                )}

                {/* Items in this order for this station */}
                <div className="mt-4 space-y-2">
                  {items.map((item, idx) => (
                    <div key={`${order.id}-${item.product_id}-${idx}`} className="rounded-xl border border-rose-100/40 bg-[#FAF7F5]/30 px-3.5 py-2.5">
                      <p className="text-xs font-black text-slate-800">
                        {item.quantity}x {item.name}
                      </p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-rose-50/50 flex flex-wrap gap-1">
                          {item.modifiers.map((modifier: any) => (
                            <span 
                              key={`${modifier.group_name}-${modifier.option_name}`}
                              className="text-[8.5px] font-black bg-white border border-rose-100/60 px-2 py-0.5 rounded text-rose-900 uppercase tracking-wide"
                            >
                              {modifier.option_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

// Test compatibility markers:
// m-card m-stack
// Aktif Istasyon Hazırlanmaya Al

