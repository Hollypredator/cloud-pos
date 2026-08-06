"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  TrendingUp,
  Monitor,
  Coffee, 
  Megaphone, 
  Package, 
  FileSpreadsheet, 
  Printer, 
  Settings, 
  Store, 
  ReceiptText, 
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { exportEndOfDayToExcel } from "@/lib/excel-export";
import { printToLocalDaemon } from "@/lib/offline-sync";
import { triggerOkcZReport } from "@/lib/okc-integration";

export type TakeawayAppLauncherProps = {
  businessName?: string;
  cashierName?: string;
  branchName?: string;
};

import { TakeawayManagementReportView } from "@/components/takeaway-management-report-view";

export function TakeawayAppLauncher({
  // Nötr varsayılanlar. Eskiden "Holy Cup Coffee" sabit gelirdi ve prop
  // geçilmeyen her ekranda başka bir markanın adı görünüyordu.
  businessName = "İşletme",
  cashierName = "Kasa Görevlisi",
  branchName = "Şube",
}: TakeawayAppLauncherProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"launcher" | "management">("launcher");

  if (activeTab === "management") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-black border-b border-zinc-800 flex justify-between items-center">
          <button
            type="button"
            onClick={() => setActiveTab("launcher")}
            className="pos-btn-red text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer"
          >
            <span>← Ana Menüye Dön</span>
          </button>
        </div>
        <TakeawayManagementReportView businessName={businessName} branchName={branchName} />
      </div>
    );
  }


  // Demo Z Raporu Excel İndirme
  const handleExportZReport = () => {
    exportEndOfDayToExcel({
      date: new Date().toLocaleDateString("tr-TR"),
      businessName,
      totalSalesCount: 142,
      totalRevenue: 12450.0,
      cashTotal: 4200.0,
      creditCardTotal: 7250.0,
      mealCardTotal: 1000.0,
      vat1Total: 120.0,
      vat10Total: 980.0,
      vat20Total: 215.0,
      cancelTotal: 150.0,
      discountTotal: 200.0,
      categories: [
        { name: "Sıcak Kahveler", qty: 78, revenue: 5460.0 },
        { name: "Soğuk Kahveler", qty: 44, revenue: 3960.0 },
        { name: "Tatlılar", qty: 20, revenue: 3030.0 },
      ],
      items: [
        { name: "Caffe Latte Medium", category: "Sıcak Kahveler", qty: 45, revenue: 3150.0 },
        { name: "Iced Americano", category: "Soğuk Kahveler", qty: 30, revenue: 2100.0 },
        { name: "San Sebastian", category: "Tatlılar", qty: 15, revenue: 2475.0 },
      ],
    });
    setStatusMessage("Z-Raporu Excel dosyası başarıyla indirildi.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Fiş Yazıcı Testi
  const handleTestPrinter = async () => {
    setIsPrinting(true);
    setStatusMessage("Yazıcıya test çıktısı gönderiliyor...");
    const success = await printToLocalDaemon({
      businessName,
      headerNote: "TEST ADİSYON FİŞİ",
      orderId: "TEST-99",
      customerName: "Kasa Test",
      items: [
        { name: "Iced Latte", qty: 1, price: 95.0, modifiers: ["Yulaf Sütü (+15 TL)", "Ekstra Shot (+20 TL)"] },
      ],
      total: 130.0,
    });

    if (success) {
      setStatusMessage("✅ Yazıcıya test fişi gönderildi (0.1s)");
    } else {
      setStatusMessage("⚠️ Yerel yazıcı servisine ulaşılamadı. (Local Print Daemon kapalı)");
    }
    setIsPrinting(false);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // ÖKC Z-Raporu Tetikleyici
  const handleTriggerOkc = async () => {
    setStatusMessage("ÖKC Cihazından Z-Raporu alınıyor...");
    const res = await triggerOkcZReport();
    if (res.success) {
      setStatusMessage(`✅ ÖKC Mali Z-Raporu Alındı: No #${res.zNo}`);
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const appGrid = [
    {
      id: "fast-cashier",
      title: "Hızlı Kasa POS",
      subtitle: "Kahve & Sipariş Alma",
      href: "/m/cashier",
      icon: Coffee,
      badge: "CANLI KASA",
      badgeColor: "bg-red-600 text-white",
      cardStyle: "border-red-600/40 bg-zinc-900/90 hover:border-red-500 hover:shadow-red-900/40",
      iconColor: "text-red-500",
    },
    {
      id: "pickup-board",
      title: "Müşteri Çağrı Ekranı",
      subtitle: "Buzzer / TV Monitör",
      href: "/pickup-board",
      icon: Megaphone,
      badge: "TV/MONİTÖR",
      badgeColor: "bg-zinc-800 text-red-400 border border-red-500/30",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-red-600/50",
      iconColor: "text-red-400",
    },
    {
      id: "stock-workbench",
      title: "Reçeteli Stok & Fire",
      subtitle: "Hammadde Takibi",
      href: "/studio/stock",
      icon: Package,
      badge: "STOK",
      badgeColor: "bg-zinc-800 text-zinc-300",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-zinc-700",
      iconColor: "text-white",
    },
    {
      id: "excel-report",
      title: "Gün Sonu & Z-Raporu",
      subtitle: "Excel (.xlsx) Döküm",
      onClick: handleExportZReport,
      icon: FileSpreadsheet,
      badge: "EXCEL RAPOR",
      badgeColor: "bg-emerald-900/60 text-emerald-300 border border-emerald-500/30",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-emerald-500/50",
      iconColor: "text-emerald-400",
    },
    {
      id: "printer-test",
      title: "Fiş & ÖKC Yazıcı",
      subtitle: "0.1s Fiş Basım Testi",
      onClick: handleTestPrinter,
      icon: Printer,
      badge: isPrinting ? "BASILIYOR..." : "YAZICI TESTİ",
      badgeColor: "bg-amber-900/60 text-amber-300 border border-amber-500/30",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-amber-500/50",
      iconColor: "text-amber-400",
    },
    {
      id: "customer-display",
      title: "Çift Ekran Müşteri Özeti",
      subtitle: "2. Ekran Canlı Sipariş & QR",
      href: "/customer-display",
      icon: Monitor,
      badge: "ÇİFT EKRAN",
      badgeColor: "bg-sky-900 text-sky-200 border border-sky-500/40",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-sky-500/60",
      iconColor: "text-sky-400",
    },
    {
      id: "management-report",
      title: "Patron & Yönetim Raporları",
      subtitle: "Mobil Canlı Ciro & Analiz",
      onClick: () => setActiveTab("management"),
      icon: TrendingUp,
      badge: "YÖNETİM PWA",
      badgeColor: "bg-red-900 text-white font-black border border-red-500",
      cardStyle: "border-red-600 bg-zinc-900/90 hover:border-red-500 hover:shadow-red-900/50",
      iconColor: "text-red-500",
    },
    {
      id: "okc-zreport",
      title: "ÖKC Mali Z-Raporu",
      subtitle: "Yazarkasa POS İletişimi",
      onClick: handleTriggerOkc,
      icon: ReceiptText,
      badge: "ÖKC POS",
      badgeColor: "bg-red-950 text-red-300 border border-red-800",
      cardStyle: "border-zinc-800 bg-zinc-900/90 hover:border-red-600/50",
      iconColor: "text-red-500",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col justify-between selection:bg-red-600 selection:text-white">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-500/30">
            <Store className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">{businessName}</h1>
              <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-800/60 uppercase">
                Takeaway Coffee
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {branchName} • Kasa: <span className="text-white font-medium">{cashierName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-1.5 border border-zinc-800 text-xs text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Çevrimiçi / İnternetsiz Uyumlu</span>
          </div>
          <Link
            href="/studio/settings"
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
            title="Marka Ayarları"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="p-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-900/60 text-red-300 hover:text-white transition"
            title="Çıkış Yap"
          >
            <LogOut className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className="my-4 p-4 rounded-xl bg-zinc-900 border border-red-600/40 text-red-200 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* App Grid Launcher */}
      <main className="my-8 flex-1">
        <div className="mb-4">
          <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">Uygulama Menüsü (App Launcher)</h2>
          <p className="text-xs text-zinc-500">Dokunmatik ekran için hızlı uygulama kartları.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {appGrid.map((app) => {
            const Icon = app.icon;
            const content = (
              <div
                className={`relative flex flex-col justify-between p-6 rounded-2xl border ${app.cardStyle} transition-all duration-200 shadow-xl cursor-pointer group hover:-translate-y-1 min-h-[160px]`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3.5 rounded-2xl bg-black/60 border border-zinc-800 ${app.iconColor} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className={`text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full ${app.badgeColor}`}>
                    {app.badge}
                  </span>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                    {app.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">{app.subtitle}</p>
                </div>
              </div>
            );

            if (app.href) {
              return (
                <Link key={app.id} href={app.href}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={app.id} type="button" onClick={app.onClick} className="text-left w-full">
                {content}
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer System Info */}
      <footer className="border-t border-zinc-900 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
        <div>
          <span>Cloud POS & Takeaway System v2.0 • </span>
          <span className="text-zinc-400">White-Label Ready</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <span>ESC/POS Print Engine: Active (Port 9100)</span>
          <span>•</span>
          <span>IndexedDB Sync: Enabled</span>
        </div>
      </footer>
    </div>
  );
}
