"use client";

import { useEffect, useState } from "react";
import { Coffee, Sparkles, QrCode } from "lucide-react";
import { readCustomerDisplaySnapshot, resolveCustomerDisplaySessionByPairCode, subscribeCustomerDisplay } from "@/lib/customer-display";
import type { CustomerDisplaySnapshot } from "@/lib/types";

export type CustomerDisplayClientProps = {
  /** Aktif işletme adı. Verilmezse nötr başlığa düşer — eskiden her işletmede
      "Holy Cup Coffee" yazıyordu. */
  businessName?: string;
  /** Sadece tanıtım ekranlarında true. Üretimde asla örnek sepet gösterilmez. */
  showSampleCart?: boolean;
};

export function CustomerDisplayClient({
  businessName = "Hoş Geldiniz",
  showSampleCart = false,
}: CustomerDisplayClientProps = {}) {
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot | null>(null);

  // Yalnızca tanıtım için. Üretimde kasa oturumu yokken müşteri ekranı boş
  // bekleme durumunu gösterir — kendi siparişi olmayan bir listeyi müşteriye
  // göstermek ödemesinin karıştığını düşündürür (tasarım kararı 3=A).
  const sampleItems = [
    { name: "Caffe Latte (Medium)", quantity: 2, lineTotal: 170.0 },
    { name: "Iced Americano (Large)", quantity: 1, lineTotal: 90.0 },
    { name: "San Sebastian Cheesecake", quantity: 1, lineTotal: 135.0 },
  ];

  const demoItems = showSampleCart ? sampleItems : [];
  const demoTotal = demoItems.reduce((acc, i) => acc + i.lineTotal, 0);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code") || "HOLY-CUP-POS-1";

    const session = resolveCustomerDisplaySessionByPairCode(code);
    if (session) {
      const snap = readCustomerDisplaySnapshot(session.sessionId);
      if (snap) {
        setSnapshot(snap);
      }

      const unsubscribe = subscribeCustomerDisplay(session.sessionId, (event) => {
        if (event.type === "snapshot" && event.snapshot) {
          setSnapshot(event.snapshot);
        }
      });
      return unsubscribe;
    }
  }, []);

  const itemsToRender = snapshot?.items && snapshot.items.length > 0
    ? snapshot.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      }))
    : demoItems;

  const totalToRender = snapshot ? snapshot.total : demoTotal;
  const customerName = snapshot?.customerName || "Hoş Geldiniz!";

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-between select-none font-sans border-8 border-red-950/40">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center shadow-xl shadow-red-950/60 border border-red-500/40">
            <Coffee className="h-8 w-8 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">{businessName}</h1>
            <p className="text-xs text-red-400 font-bold tracking-widest uppercase">Çift Ekran Müşteri Sipariş Özeti</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-zinc-300">Canlı Kasa Bağlantısı</span>
          </div>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="my-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
        {/* Left Side: Order Items List (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-red-500" />
                <h2 className="text-sm font-black uppercase text-zinc-300 tracking-wider">Sipariş Kalemleriniz</h2>
              </div>
              <span className="text-xs font-bold text-red-400 bg-red-950/80 px-3 py-1 rounded-full border border-red-800">
                {customerName}
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {itemsToRender.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-black border border-zinc-800/80 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-red-950 text-red-400 text-xs font-black flex items-center justify-center border border-red-800/50">
                      {item.quantity}x
                    </span>
                    <p className="text-base font-extrabold text-white">{item.name}</p>
                  </div>
                  <p className="text-lg font-black text-white">{item.lineTotal.toFixed(2)} TL</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Live Total Box */}
          <div className="mt-6 pt-5 border-t border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ara Toplam:</span>
              <span className="text-sm font-bold text-zinc-300">{(totalToRender * 0.9).toFixed(2)} TL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">KDV (%10):</span>
              <span className="text-sm font-bold text-zinc-300">{(totalToRender * 0.1).toFixed(2)} TL</span>
            </div>
            <div className="flex justify-between items-center text-3xl sm:text-4xl font-black text-white pt-2 border-t border-zinc-800">
              <span className="uppercase tracking-tight text-zinc-200">GENEL TOPLAM:</span>
              <span className="text-red-500 tracking-tight">{totalToRender.toFixed(2)} TL</span>
            </div>
          </div>
        </div>

        {/* Right Side: QR Payment & Branding Promo (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-red-600/30 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400 shadow-lg shadow-red-950">
              <QrCode className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Hızlı QR Ödeme</h3>
              <p className="text-xs text-zinc-400 mt-1">Banka veya Yemek Kartı QR ile temassız ödeyin</p>
            </div>
          </div>

          {/* Dummy QR Graphic */}
          <div className="mx-auto p-4 bg-white rounded-2xl shadow-2xl border-4 border-red-600">
            <div className="w-48 h-48 bg-zinc-950 rounded-xl p-3 flex flex-col items-center justify-center text-center space-y-2">
              <div className="grid grid-cols-4 gap-1.5 w-full h-full p-2 bg-black rounded-lg border border-zinc-800">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`rounded ${i % 3 === 0 ? "bg-red-600" : i % 2 === 0 ? "bg-white" : "bg-zinc-900"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Sadakat kampanyası henüz veriye bağlı değil; uydurma bir kampanyayı
              müşteriye vaat etmemek için yalnızca tanıtım modunda gösteriliyor. */}
          {showSampleCart ? (
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center space-y-1">
              <p className="text-xs font-bold text-white uppercase">{businessName} Sadakat Kulübü</p>
              <p className="text-[11px] text-zinc-400">Her 5 Kahvede 1 Kahve Hediye!</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
