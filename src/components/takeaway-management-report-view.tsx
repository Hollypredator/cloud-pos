"use client";

import { useState } from "react";
import { 
  TrendingUp, 
  Coffee, 
  AlertTriangle, 
  FileSpreadsheet, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  ArrowUpRight,
  Store,
  RefreshCw
} from "lucide-react";
import { exportEndOfDayToExcel } from "@/lib/excel-export";

export type TakeawayManagementReportProps = {
  businessName?: string;
  branchName?: string;
};

export function TakeawayManagementReportView({
  // Nötr varsayılan: prop geçilmeyen ekranlarda başka bir markanın adı görünmesin.
  businessName = "İşletme",
  branchName = "Takeaway Merkez Şube",
}: TakeawayManagementReportProps) {
  const [downloading, setDownloading] = useState(false);

  // Demodaki canlı satış verileri
  const stats = {
    todayTotalRevenue: 14850.0,
    todayOrderCount: 168,
    averageBasketSize: 88.39,
    cashTotal: 4850.0,
    creditCardTotal: 8500.0,
    mealCardTotal: 1500.0,
    peakHour: "12:00 - 14:00 (42 Sipariş)",
    topCategory: "Sıcak Kahveler (%54)",
  };

  const lowStockAlerts = [
    { name: "Espresso Kahve Çekirdeği", remaining: "850 g", alertLevel: "1000 g", status: "kritik" },
    { name: "Yulaf Sütü", remaining: "900 ml", alertLevel: "1000 ml", status: "kritik" },
    { name: "Medium Karton Bardak", remaining: "120 Adet", alertLevel: "100 Adet", status: "normal" },
  ];

  const handleDownloadExcel = () => {
    setDownloading(true);
    exportEndOfDayToExcel({
      date: new Date().toLocaleDateString("tr-TR"),
      businessName,
      totalSalesCount: stats.todayOrderCount,
      totalRevenue: stats.todayTotalRevenue,
      cashTotal: stats.cashTotal,
      creditCardTotal: stats.creditCardTotal,
      mealCardTotal: stats.mealCardTotal,
      vat1Total: 148.5,
      vat10Total: 1188.0,
      vat20Total: 297.0,
      cancelTotal: 120.0,
      discountTotal: 250.0,
      categories: [
        { name: "Sıcak Kahveler", qty: 90, revenue: 7900.0 },
        { name: "Soğuk Kahveler", qty: 52, revenue: 4950.0 },
        { name: "Tatlılar & Atıştırmalık", qty: 26, revenue: 2000.0 },
      ],
      items: [
        { name: "Latte Medium", category: "Sıcak Kahveler", qty: 50, revenue: 3750.0 },
        { name: "Iced Americano", category: "Soğuk Kahveler", qty: 35, revenue: 2625.0 },
        { name: "San Sebastian Cheesecake", category: "Tatlılar", qty: 18, revenue: 2000.0 },
      ],
    });
    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 space-y-6 selection:bg-red-600 selection:text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center border border-red-500/30 shadow-lg shadow-red-950/50">
            <Store className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">{businessName}</h1>
              <span className="rounded-full bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold px-2.5 py-0.5 uppercase">
                Yönetim Rapor Modülü
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {branchName} • Canlı İç Mobil Raporlama Paneli
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="pos-btn-red flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>{downloading ? "İndiriliyor..." : "Z-Raporu Excel İndir (.xlsx)"}</span>
        </button>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-red-600/30 space-y-2 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bugünkü Toplam Ciro</span>
            <div className="p-2 rounded-xl bg-red-950 text-red-400 border border-red-800/60">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {stats.todayTotalRevenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Düne göre +%18.4 artış</span>
          </div>
        </div>

        {/* Order Count & Basket */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Toplam Sipariş</span>
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{stats.todayOrderCount} Adet</p>
          <p className="text-xs text-zinc-400">Ortalama Sepet: <span className="text-white font-bold">{stats.averageBasketSize.toFixed(2)} TL</span></p>
        </div>

        {/* Peak Hours */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">En Yoğun Saat Aralığı</span>
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-white tracking-tight">{stats.peakHour}</p>
          <p className="text-xs text-zinc-400">En çok satan: <span className="text-white font-bold">{stats.topCategory}</span></p>
        </div>

        {/* Payment Type Breakdown */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ödeme Kırılımı</span>
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Nakit:</span>
              <span className="font-bold text-white">{stats.cashTotal.toFixed(2)} TL (%32)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Kredi Kartı / POS:</span>
              <span className="font-bold text-red-400">{stats.creditCardTotal.toFixed(2)} TL (%58)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Yemek Kartı:</span>
              <span className="font-bold text-white">{stats.mealCardTotal.toFixed(2)} TL (%10)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Stock & Raw Materials Alarm Section */}
      <div className="p-6 rounded-2xl bg-zinc-900/90 border border-red-900/40 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">Kritik Reçeteli Hammadde Uyarısı</h2>
          </div>
          <span className="text-xs text-zinc-400">Otomatik Stok Düşüm Sistemi</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {lowStockAlerts.map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">{item.name}</p>
                <p className="text-[11px] text-zinc-400">Eşik: {item.alertLevel}</p>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${item.status === "kritik" ? "bg-red-950 text-red-400 border border-red-800" : "bg-zinc-800 text-zinc-300"}`}>
                Kalan: {item.remaining}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
