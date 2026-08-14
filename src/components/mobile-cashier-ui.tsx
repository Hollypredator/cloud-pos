"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Clock, 
  X, 
  CalendarDays
} from "lucide-react";
import { CashierPaymentPanel } from "@/components/cashier-payment-panel";
import type { Order, OrderItem } from "@/lib/types";
import { onQueueSynced, startAutoSync } from "@/lib/offline-queue";
import { gsap } from "gsap";

interface MobileCashierUiProps {
  servedOrders: Order[];
  paidOrders: Order[];
  selectedOrder: Order | null;
  servedTotals: { final: number; paid: number; remaining: number };
  paidTotals: { final: number; paid: number; remaining: number };
  completeMobilePaymentAction: (formData: FormData) => void;
  closePaidOrderAction: (formData: FormData) => void;
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

// Global PWA sync feedback banner state helper
let globalSetToastMessage: ((msg: string | null) => void) | null = null;

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

function statusLabel(status: string) {
  if (status === "served") return "Ödeme Bekliyor";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandı";
  if (status === "ready") return "Hazır";
  return status;
}

function statusTone(status: string) {
  if (status === "partially_paid") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export function MobileCashierUi({
  servedOrders,
  paidOrders,
  selectedOrder,
  servedTotals,
  paidTotals,
  completeMobilePaymentAction,
  closePaidOrderAction,
}: MobileCashierUiProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    globalSetToastMessage = setToastMsg;
    return () => {
      globalSetToastMessage = null;
    };
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(".cashier-gsap-item",
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power3.out" }
      );
    }
  }, []);

  // Cevrimdisi kuyruk bosaldiginda ekrani tazele. `startAutoSync` bagalanti
  // gelince kuyrugu gonderir; burada yalnizca sonucu dinliyoruz.
  useEffect(() => {
    const stopAutoSync = startAutoSync();
    const stopListening = onQueueSynced(() => {
      setToastMsg("Çevrimdışı yapılan ödemeler bulut ile senkronize edildi!");
      setTimeout(() => setToastMsg(null), 4000);
      router.refresh();
    });
    return () => {
      stopAutoSync();
      stopListening();
    };
  }, [router]);

  // Animating the slide-up drawer on display
  useEffect(() => {
    if (selectedOrder) {
      gsap.fromTo(".cashier-modal-drawer",
        { y: "100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [selectedOrder?.id]);

  // Not: burada bir "takeaway hizli kasa" modu vardi; sahte odeme ve sahte
  // ÖKC yaniti ureten demo bir gorunume baglaniyordu. Self-servis odeme artik
  // gercek: `self-service-checkout.tsx` siparis + odeme + fis + cekmeceyi tek
  // akista bitiriyor ve /admin/orders kafe profilinde onu aciyor. Bu ekran
  // tum profillerde ayni sey: servis edilmis adisyonun tahsilati.

  const selectedItems = selectedOrder && Array.isArray(selectedOrder.items) ? (selectedOrder.items as OrderItem[]) : [];
  const selectedRemaining = selectedOrder
    ? Number(selectedOrder.remaining_balance ?? selectedOrder.final_price ?? selectedOrder.total_price)
    : 0;
  const selectedPaid = selectedOrder ? Number(selectedOrder.amount_paid ?? 0) : 0;
  const selectedFinal = selectedOrder ? Number(selectedOrder.final_price ?? selectedOrder.total_price) : 0;

  async function handlePaymentSubmit(data: {
    orderId: string;
    returnOrderId?: string;
    requestKey: string;
    method: "cash" | "card" | "mixed";
    amount: number;
    note?: string;
  }) {
    if (!navigator.onLine) {
      const { enqueueCommand } = await import("@/lib/offline-queue");
      // Idempotans anahtari cevrimici yoldakiyle AYNI (`data.requestKey`):
      // odeme once cevrimdisi kuyruga girip sonra ayni ekrandan tekrar
      // denenirse sunucu ikinci yazimi tekrar olarak taniyip yutar.
      await enqueueCommand({
        type: "PAYMENT_SALE_CASH",
        groupId: data.orderId,
        idempotencyKey: data.requestKey,
        payload: {
          order_id: data.orderId,
          method: data.method,
          amount: data.amount,
          note: data.note,
        },
      });

      setToastMsg("Çevrimdışı işlem kuyruğa alındı. Bağlantı geldiğinde senkronize edilecek.");
      setTimeout(() => setToastMsg(null), 5000);
      router.push("/m/cashier");
      return;
    }

    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PAYMENT_SALE_CASH",
          payload: {
            order_id: data.orderId,
            method: data.method,
            amount: data.amount,
            note: data.note,
          },
          idempotency_key: data.requestKey,
        }),
      });

      if (response.ok) {
        router.push(`/m/cashier?tone=success&feedback=Ödeme başarıyla kaydedildi.&order=${data.orderId}`);
      } else {
        const resData = await response.json();
        router.push(`/m/cashier?tone=error&feedback=${encodeURIComponent(resData.message || "Ödeme alınamadı.")}&order=${data.orderId}`);
      }
    } catch {
      router.push(`/m/cashier?tone=error&feedback=Ağ hatası nedeniyle işlem yapılamadı.&order=${data.orderId}`);
    }
  }

  async function handleCloseOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) return;

    if (!navigator.onLine) {
      const { enqueueCommand } = await import("@/lib/offline-queue");
      await enqueueCommand({
        type: "ORDER_STATUS_SET",
        groupId: selectedOrder.id,
        idempotencyKey: `order-status-paid-${selectedOrder.id}`,
        payload: {
          order_id: selectedOrder.id,
          status: "paid",
        },
      });

      setToastMsg("Çevrimdışı adisyon kapatma kuyruğa alındı. Bağlantı geldiğinde senkronize edilecek.");
      setTimeout(() => setToastMsg(null), 5000);
      router.push("/m/cashier");
      return;
    }

    try {
      const response = await fetch("/api/ops/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ORDER_STATUS_SET",
          payload: {
            order_id: selectedOrder.id,
            status: "paid",
          },
        }),
      });

      if (response.ok) {
        router.push(`/m/cashier?tone=success&feedback=Adisyon başarıyla kapatıldı.`);
      } else {
        const resData = await response.json();
        router.push(`/m/cashier?tone=error&feedback=${encodeURIComponent(resData.message || "Adisyon kapatılamadı.")}&order=${selectedOrder.id}`);
      }
    } catch {
      router.push(`/m/cashier?tone=error&feedback=Ağ hatası nedeniyle adisyon kapatılamadı.&order=${selectedOrder.id}`);
    }
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-rose-950 text-white border border-rose-900 rounded-2xl p-4 shadow-xl text-xs font-black tracking-wide text-center">
          {toastMsg}
        </div>
      )}

      {/* Cashier Stats Row */}
      <section className="cashier-gsap-item grid grid-cols-3 gap-3">
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Bekleyen</p>
          <p className="mt-1 text-xl font-black text-rose-950 font-mono">{servedOrders.length}</p>
        </article>
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Açık Kalan</p>
          <p className="mt-1 text-xs font-black text-rose-600 font-mono truncate">{formatMoney(servedTotals.remaining)}</p>
        </article>
        <article className="bg-white border border-rose-100/50 rounded-2xl p-3 text-center shadow-[0_4px_20px_rgba(136,19,55,0.01)]">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Toplam Kasa</p>
          <p className="mt-1 text-xs font-black text-emerald-600 font-mono truncate">{formatMoney(paidTotals.paid)}</p>
        </article>
      </section>

      {/* Header and Day Session Controller */}
      <section className="cashier-gsap-item bg-white border border-rose-100/50 rounded-2xl p-4.5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60">Tahsilat Akışı</p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Adisyon seçip ödeme detaylarını tamamlayın.</p>
        </div>
        <Link 
          href="/m/cashier/session" 
          className="border border-rose-150 bg-rose-50/20 hover:bg-rose-50 text-rose-950 inline-flex min-h-[38px] items-center justify-center gap-1.5 px-4 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <CalendarDays className="h-4 w-4 text-rose-900" strokeWidth={2.4} />
          Gün Sonu
        </Link>
      </section>

      {/* Queue Card Grid / Scroll list */}
      <section className="cashier-gsap-item space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60 pl-1">Açık Adisyonlar</p>
        {servedOrders.length === 0 ? (
          <article className="border border-dashed border-rose-200 bg-rose-50/10 py-12 text-center rounded-[24px]">
            <p className="text-sm font-extrabold text-rose-950">Bekleyen adisyon yok.</p>
            <p className="text-xs font-bold text-rose-700/60 mt-1 max-w-xs mx-auto">Servise hazır veya kısmi ödemeli adisyonlar burada listelenir.</p>
          </article>
        ) : (
          <div className="grid gap-3">
            {servedOrders.map((order) => {
              const remaining = Number(order.remaining_balance ?? order.final_price ?? order.total_price);
              const isActive = selectedOrder?.id === order.id;
              return (
                <div 
                  key={order.id} 
                  onClick={() => router.push(`/m/cashier?order=${order.id}`)}
                  className={`bg-white border rounded-[22px] p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex justify-between items-center ${
                    isActive 
                      ? "border-rose-900 ring-2 ring-rose-950/5 opacity-100" 
                      : "border-rose-100/50 opacity-90"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">{orderSourceLabel(order)}</p>
                    <p className="text-xs font-black text-rose-950 mt-1 truncate">Adisyon #{orderRef(order)}</p>
                    <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                      <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                      <p className="text-[9px] font-bold tracking-wider">{new Date(order.created_at).toLocaleTimeString("tr-TR", {hour: "2-digit", minute:"2-digit"})}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Kalan Bakiye</p>
                    <p className="text-base font-black text-rose-950 mt-0.5 font-mono">{formatMoney(remaining)}</p>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[8.5px] font-black border uppercase tracking-wider mt-1 ${statusTone(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Order Detail and Payment Slide-up Drawer Overlay */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-end justify-center px-4 pb-4"
          onClick={() => router.push("/m/cashier")}
        >
          <section 
            onClick={(e) => e.stopPropagation()}
            className="cashier-modal-drawer bg-white border border-rose-900/10 rounded-[28px] p-5 shadow-2xl w-full max-w-md max-h-[82vh] overflow-y-auto space-y-4 relative"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 border-b border-rose-50 pb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-900/60">Adisyon Detayı</p>
                <h2 className="mt-0.5 text-base font-black tracking-tight text-rose-950">{orderSourceLabel(selectedOrder)}</h2>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Sipariş #{orderRef(selectedOrder)}</p>
              </div>
              <button 
                type="button"
                onClick={() => router.push("/m/cashier")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-100 bg-rose-50/20 text-rose-900 hover:bg-rose-50 transition-all active:scale-90 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Split statistics */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/10 px-3 py-2.5 text-center shadow-sm">
                <p className="text-[8px] font-black uppercase tracking-wider text-rose-900/60">Toplam</p>
                <p className="mt-1 text-xs font-black text-rose-950 font-mono">{formatMoney(selectedFinal)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 px-3 py-2.5 text-center shadow-sm">
                <p className="text-[8px] font-black uppercase tracking-wider text-emerald-700">Ödenen</p>
                <p className="mt-1 text-xs font-black text-emerald-800 font-mono">{formatMoney(selectedPaid)}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-center shadow-sm">
                <p className="text-[8px] font-black uppercase tracking-wider text-rose-700">Kalan</p>
                <p className="mt-1 text-xs font-black text-rose-950 font-mono">{formatMoney(selectedRemaining)}</p>
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase tracking-wider text-rose-900/60 pl-1">Sipariş İçeriği</p>
              {selectedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/5 px-3.5 py-3 text-xs font-semibold text-slate-400">
                  Kalem detayı bulunmuyor.
                </div>
              ) : (
                <div className="divide-y divide-rose-50/50 bg-[#FAF7F5]/30 border border-rose-100/40 rounded-2xl p-3">
                  {selectedItems.map((item, index) => (
                    <div key={`${item.product_id}-${index}`} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {item.quantity}x {item.name}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 font-mono">
                          {item.quantity > 1 ? `${formatMoney(Number(item.line_total) / item.quantity)} x ${item.quantity}` : formatMoney(Number(item.line_total))}
                        </p>
                      </div>
                      <p className="text-xs font-black text-rose-950 font-mono shrink-0">{formatMoney(Number(item.line_total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Panel */}
            <div className="pt-3 border-t border-rose-100/50">
              {selectedRemaining > 0 ? (
                <CashierPaymentPanel
                  orderId={selectedOrder.id}
                  returnOrderId={selectedOrder.id}
                  defaultAmount={selectedRemaining}
                  items={selectedItems}
                  requestKey={crypto.randomUUID()}
                  onSubmit={handlePaymentSubmit}
                  submitIdleLabel="Ödemeyi Tamamla"
                  submitPendingLabel="İşlem Yapılıyor..."
                />
              ) : (
                <form onSubmit={handleCloseOrder}>
                  <button 
                    type="submit" 
                    className="bg-gradient-to-r from-rose-900 to-rose-800 hover:from-rose-950 hover:to-rose-900 text-white w-full inline-flex items-center justify-center py-4 rounded-2xl text-sm font-black uppercase tracking-wider shadow-md active:scale-98 transition-all cursor-pointer"
                  >
                    Adisyonu Kapat
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// Test compatibility markers:
// m-card m-stack
// Tahsilata Gec Tahsilat Kuyrugu

