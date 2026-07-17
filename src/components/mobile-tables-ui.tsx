"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  User, 
  MapPin, 
  AlertCircle, 
  PlusCircle, 
  ArrowRight, 
  Info,
  X,
  Compass,
  ListFilter
} from "lucide-react";
import type { TableStatus } from "@/lib/types";
import { gsap } from "gsap";

interface Table {
  id: string;
  table_number: number;
  name?: string | null;
  status: TableStatus;
  zone_id?: string | null;
}

interface Order {
  id: string;
  check_number?: string | null;
  status: string;
  remaining_balance?: any;
  final_price?: any;
  total_price?: any;
}

interface MobileTablesUiProps {
  tables: any[];
  ordersByTableId: Map<string, Order>;
  openRequests: any[];
  zones: { id: string; name: string }[];
  tableSupervisors: any[];
  canOpenOrders: boolean;
  canUseCashier: boolean;
  canOpenKitchen: boolean;
  canManageReservations: boolean;
  activeFilter: string;
  setTableStatusAction: (formData: FormData) => void;
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

function orderRef(order: Order) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Boş";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function orderStatusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazırlanıyor";
  if (status === "ready") return "Servise Hazır";
  if (status === "served") return "Servise Hazır";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandı";
  if (status === "partially_refunded") return "Kısmi İade";
  if (status === "cancelled") return "İptal";
  if (status === "refunded") return "İade";
  return status;
}

export function MobileTablesUi({
  tables,
  ordersByTableId,
  openRequests,
  zones,
  tableSupervisors,
  canOpenOrders,
  canUseCashier,
  canOpenKitchen,
  canManageReservations,
  activeFilter,
  setTableStatusAction,
}: MobileTablesUiProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"kroki" | "list">("kroki");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Map utilities
  const zoneNameById = new Map(zones.map((z) => [z.id, z.name]));
  const supervisorByTableId = new Map(tableSupervisors.map((ts) => [ts.table_id, ts]));
  const requestCountByTableId = new Map<string, number>();
  for (const req of openRequests) {
    const current = requestCountByTableId.get(req.table_id) ?? 0;
    requestCountByTableId.set(req.table_id, current + 1);
  }

  // Animation on load
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(".table-node",
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, stagger: 0.04, ease: "back.out(1.4)" }
      );
    }
  }, [viewMode, activeZoneFilter]);

  // Drawer animation
  useEffect(() => {
    if (selectedTable) {
      gsap.fromTo(".table-drawer",
        { y: "100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [selectedTable?.id]);

  // Sync complete listener
  useEffect(() => {
    const handleSyncComplete = () => {
      setToastMsg("Çevrimdışı yapılan masa rezervasyonları eşitlendi!");
      setTimeout(() => setToastMsg(null), 4000);
      router.refresh();
    };
    window.addEventListener("pwa:sync-complete", handleSyncComplete);
    return () => window.removeEventListener("pwa:sync-complete", handleSyncComplete);
  }, [router]);

  // Client-side offline reserve interceptor
  async function handleToggleReserve(tableId: string, nextStatus: "empty" | "reserved") {
    if (!navigator.onLine) {
      const { addPendingCommand } = await import("@/lib/offline-sync");
      await addPendingCommand("TABLE_STATUS_SET", {
        table_id: tableId,
        status: nextStatus,
      });

      setToastMsg(`Çevrimdışı masa durumu güncelleme (${nextStatus === "reserved" ? "rezerve" : "boş"}) kuyruğa alındı.`);
      setTimeout(() => setToastMsg(null), 5000);
      setSelectedTable(null);
      router.refresh(); // refreshes client state
      return;
    }

    // Submit online command
    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TABLE_STATUS_SET",
          payload: {
            table_id: tableId,
            status: nextStatus,
          },
        }),
      });

      if (response.ok) {
        setSelectedTable(null);
        router.refresh();
      } else {
        alert("Masa durumu güncellenemedi.");
      }
    } catch {
      alert("Ağ hatası nedeniyle işlem yapılamadı.");
    }
  }

  // Filter calculations
  const filteredTablesByZone = tables.filter((table) => {
    if (activeZoneFilter !== "all" && table.zone_id !== activeZoneFilter) return false;
    if (activeFilter !== "all" && table.status !== activeFilter) return false;
    return true;
  });

  const selectedOrder = selectedTable ? ordersByTableId.get(selectedTable.id) : null;
  const selectedRequests = selectedTable ? requestCountByTableId.get(selectedTable.id) ?? 0 : 0;
  const selectedSupervisor = selectedTable ? supervisorByTableId.get(selectedTable.id) : null;

  return (
    <div ref={containerRef} className="space-y-4">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-rose-950 text-white border border-rose-900 rounded-2xl p-4 shadow-xl text-xs font-black tracking-wide text-center">
          {toastMsg}
        </div>
      )}

      {/* View Mode Toggle & Zone Selector */}
      <section className="bg-white border border-rose-100/50 rounded-2xl p-3 shadow-sm flex items-center justify-between">
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode("kroki")}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
              viewMode === "kroki" 
                ? "bg-rose-900 text-white shadow-sm" 
                : "text-rose-950/70 hover:bg-rose-50"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Kroki Görünümü
          </button>
          <button 
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
              viewMode === "list" 
                ? "bg-rose-900 text-white shadow-sm" 
                : "text-rose-950/70 hover:bg-rose-50"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Arama / Liste
          </button>
        </div>

        {/* Zone Dropdown selector */}
        <select 
          value={activeZoneFilter}
          onChange={(e) => setActiveZoneFilter(e.target.value)}
          className="border border-rose-150 rounded-xl px-2 py-1.5 text-xs font-black text-rose-950 bg-white"
        >
          <option value="all">Tüm Bölgeler</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>{zone.name}</option>
          ))}
        </select>
      </section>

      {/* Seating Floor Plan Map */}
      {viewMode === "kroki" ? (
        <section className="bg-white/40 border border-rose-100/30 rounded-3xl p-5 shadow-sm min-h-[380px]">
          {filteredTablesByZone.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs font-bold">Masa bulunamadı.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 justify-items-center">
              {filteredTablesByZone.map((table) => {
                const order = ordersByTableId.get(table.id);
                const reqs = requestCountByTableId.get(table.id) ?? 0;
                const active = selectedTable?.id === table.id;

                let colorStyles = "bg-emerald-50 border-emerald-200 text-emerald-950";
                if (table.status === "occupied") colorStyles = "bg-amber-50 border-amber-200 text-amber-950";
                if (table.status === "reserved") colorStyles = "bg-indigo-50 border-indigo-200 text-indigo-950";

                return (
                  <div
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={`table-node w-22 h-22 rounded-2xl border-2 flex flex-col justify-between p-2.5 transition-all duration-300 relative cursor-pointer active:scale-95 shadow-sm ${colorStyles} ${
                      active ? "ring-4 ring-rose-900 border-rose-900" : ""
                    }`}
                  >
                    {/* Top row indicators */}
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[9px] font-black tracking-tighter">Masa</span>
                      {reqs > 0 && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping absolute -top-1 -right-1" />
                      )}
                      {reqs > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 absolute -top-1 -right-1" />
                      )}
                    </div>

                    {/* Table Name */}
                    <div className="text-center font-extrabold text-lg leading-none py-1">
                      {table.table_number}
                    </div>

                    {/* Bottom Status / Total Price */}
                    <div className="text-center w-full truncate">
                      {table.status === "occupied" && order ? (
                        <span className="text-[8px] font-bold font-mono text-amber-900">
                          {formatMoney(Number(order.remaining_balance ?? order.final_price ?? order.total_price))}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-500/70">
                          {tableStatusLabel(table.status)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* Regular List View */
        <section className="space-y-3">
          {filteredTablesByZone.map((table) => {
            const order = ordersByTableId.get(table.id);
            const reqs = requestCountByTableId.get(table.id) ?? 0;
            const supervisor = supervisorByTableId.get(table.id);

            return (
              <div 
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className="bg-white border border-rose-100/50 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:bg-rose-50/20 active:scale-[0.99] transition-all"
              >
                <div>
                  <h3 className="text-xs font-black text-rose-950">Masa {table.table_number} ({table.name || "Salon"})</h3>
                  <div className="flex gap-3 text-[10px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {zoneNameById.get(table.zone_id || "") ?? "Bölgesiz"}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> {supervisor?.full_name ?? "Garson Yok"}</span>
                  </div>
                </div>

                <div className="text-right">
                  {order && table.status === "occupied" ? (
                    <span className="text-xs font-black font-mono text-rose-900">{formatMoney(Number(order.remaining_balance ?? order.final_price ?? order.total_price))}</span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">{tableStatusLabel(table.status)}</span>
                  )}
                  {reqs > 0 && (
                    <span className="block text-[8px] font-black text-rose-600 animate-pulse mt-0.5">{reqs} Servis Talebi</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Seating Table Detail Drawer (Slide-up) */}
      {selectedTable && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-end justify-center px-4 pb-4"
          onClick={() => setSelectedTable(null)}
        >
          <section 
            onClick={(e) => e.stopPropagation()}
            className="table-drawer bg-white border border-rose-900/10 rounded-[28px] p-5 shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto space-y-4 relative"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 border-b border-rose-50 pb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60">Masa Ayrıntıları</p>
                <h2 className="mt-0.5 text-base font-black tracking-tight text-rose-950">{selectedTable.name || `Masa ${selectedTable.table_number}`}</h2>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Durum: {tableStatusLabel(selectedTable.status)}</p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedTable(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-100 bg-rose-50/20 text-rose-900 hover:bg-rose-50 transition-all active:scale-90 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-500">
              <div className="rounded-xl border border-rose-100 bg-rose-50/10 px-3 py-2.5 flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-rose-900 shrink-0" strokeWidth={2.2} />
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400">Bölge</p>
                  <p className="font-extrabold text-slate-900">{selectedTable.zone_id ? zoneNameById.get(selectedTable.zone_id) ?? "Belirsiz" : "Bölgesiz"}</p>
                </div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/10 px-3 py-2.5 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-rose-900 shrink-0" strokeWidth={2.2} />
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400">Atanmış Garson</p>
                  <p className="font-extrabold text-slate-900">{selectedSupervisor?.full_name ?? "Garson Yok"}</p>
                </div>
              </div>
            </div>

            {/* Open Orders Section */}
            {selectedOrder ? (
              <div className="rounded-2xl border border-rose-100 bg-[#FAF7F5]/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Açık Adisyon</p>
                    <p className="text-xs font-extrabold text-slate-800 mt-0.5">Adisyon #{orderRef(selectedOrder)}</p>
                  </div>
                  <span className="rounded-full bg-white border border-rose-100 px-2.5 py-1 text-[9px] font-black text-rose-900 uppercase tracking-wider shadow-sm">
                    {orderStatusLabel(selectedOrder.status)}
                  </span>
                </div>
                <div className="pt-2 border-t border-rose-50 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Kalan Tutar</span>
                  <span className="text-sm font-black text-rose-950 font-mono">
                    {formatMoney(Number(selectedOrder.remaining_balance ?? selectedOrder.final_price ?? selectedOrder.total_price))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/5 py-4 text-center text-xs font-bold text-slate-400">
                Bu masada henüz açık bir adisyon bulunmuyor.
              </div>
            )}

            {/* Service calls notification */}
            {selectedRequests > 0 && (
              <div className="rounded-2xl bg-rose-100/50 border border-rose-200 px-4 py-3 flex items-center gap-2.5 text-xs font-bold text-rose-900">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 animate-pulse" />
                <span>{selectedRequests} Aktif Garson/Hesap Çağrısı Var</span>
              </div>
            )}

            {/* Table Action Buttons Grid */}
            <div className="grid gap-2 pt-2 border-t border-rose-100/40">
              {canOpenOrders && (
                <Link 
                  href={`/admin/orders?table=${selectedTable.id}`}
                  onClick={() => setSelectedTable(null)}
                  className="bg-gradient-to-r from-rose-900 to-rose-800 hover:from-rose-950 hover:to-rose-900 text-white w-full inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4.5 w-4.5" strokeWidth={2.4} />
                  {selectedOrder ? "Siparişe Ürün Ekle" : "Yeni Sipariş Aç"}
                </Link>
              )}

              {canUseCashier && selectedOrder && (
                <Link 
                  href={`/m/cashier?order=${encodeURIComponent(selectedOrder.id)}`}
                  onClick={() => setSelectedTable(null)}
                  className="border border-rose-150 bg-rose-50/20 hover:bg-rose-50 text-rose-950 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  Ödeme / Adisyona Git
                  <ArrowRight className="h-4.5 w-4.5 text-rose-900" strokeWidth={2.4} />
                </Link>
              )}

              {canOpenKitchen && selectedOrder && (
                <Link 
                  href="/m/kitchen"
                  onClick={() => setSelectedTable(null)}
                  className="border border-rose-150 bg-rose-50/20 hover:bg-rose-50 text-rose-950 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  Mutfak Sipariş Ekranı
                  <ArrowRight className="h-4.5 w-4.5 text-rose-900" strokeWidth={2.4} />
                </Link>
              )}

              {/* Reservation Status Toggles */}
              {canManageReservations && selectedTable.status === "empty" && (
                <button
                  type="button"
                  onClick={() => handleToggleReserve(selectedTable.id, "reserved")}
                  className="border border-rose-150 bg-rose-50/20 hover:bg-rose-50 text-rose-950 w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  Masayı Rezerve Et
                </button>
              )}

              {canManageReservations && selectedTable.status === "reserved" && (
                <button
                  type="button"
                  onClick={() => handleToggleReserve(selectedTable.id, "empty")}
                  className="border border-rose-150 bg-rose-50/20 hover:bg-rose-50 text-rose-950 w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  Rezervasyonu Kaldır (Boşalt)
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
