import Link from "next/link";
import { PrintActions } from "@/components/print-actions";
import { requireRole } from "@/lib/auth";
import { getCurrentCashSession, getPaymentOverview } from "@/lib/domains/finance";

export default async function SessionReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string; logo?: string }>;
}) {
  await requireRole(["admin", "cashier"], "/admin/print-center/session-report");
  const { layout } = await searchParams;
  const compact = layout === "thermal58";
  const thermal = layout === "thermal" || compact;
  const [{ session }, { today }] = await Promise.all([getCurrentCashSession(), getPaymentOverview()]);

  const openingCash = Number(session?.opening_cash ?? 0);
  const expectedCash = openingCash + Number(today.cashSale) - Number(today.refunds);

  return (
    <div className="print-root bg-slate-100 px-4 py-8">
      <main
        className={`print-card mx-auto rounded-2xl bg-white shadow-sm ${
          compact ? "max-w-[280px] p-3" : thermal ? "max-w-[340px] p-4" : "max-w-2xl p-6"
        }`}
      >
        <header className="border-b border-slate-200 pb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Kasa Kapanis Raporu</p>
          <h1 className={`mt-2 font-semibold text-slate-900 ${thermal ? "text-xl" : "text-3xl"}`}>
            {session ? "Acilik Oturum Özeti" : "Bugün Özeti"}
          </h1>
          <p className="mt-2 text-xs text-slate-500">{new Date().toLocaleString("tr-TR")}</p>
        </header>

        <div className="mt-4 space-y-2 text-sm">
          <p className="flex justify-between"><span>Acilis Nakit</span><span>{openingCash.toFixed(2)} TL</span></p>
          <p className="flex justify-between"><span>Nakit Satis</span><span>{Number(today.cashSale).toFixed(2)} TL</span></p>
          <p className="flex justify-between"><span>Kart Satis</span><span>{Number(today.cardSale).toFixed(2)} TL</span></p>
          <p className="flex justify-between"><span>Karma Satis</span><span>{Number(today.mixedSale).toFixed(2)} TL</span></p>
          <p className="flex justify-between"><span>Iade</span><span>{Number(today.refunds).toFixed(2)} TL</span></p>
          <p className="mt-3 border-t border-slate-200 pt-3 flex justify-between font-semibold text-slate-900"><span>Beklenen Nakit</span><span>{expectedCash.toFixed(2)} TL</span></p>
          <p className="flex justify-between font-semibold text-slate-900"><span>Net Ciro</span><span>{Number(today.net).toFixed(2)} TL</span></p>
          {session?.note ? <p className="mt-3 text-xs text-slate-500">Not: {session.note}</p> : null}
        </div>

        <div className={`mt-6 grid gap-3 ${thermal ? "grid-cols-1" : "md:grid-cols-2"}`}>
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Teslim Eden</p>
            <div className="mt-8 border-b border-slate-300" />
            <p className="mt-2 text-[11px] text-slate-400">Ad Soyad / Imza</p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Teslim Alan</p>
            <div className="mt-8 border-b border-slate-300" />
            <p className="mt-2 text-[11px] text-slate-400">Ad Soyad / Imza</p>
          </div>
        </div>

        <PrintActions baseHref="/admin/print-center/session-report" />

        <div className="no-print mt-4">
          <Link href="/cashier/session" className="text-sm font-medium text-slate-700 underline">
            Gun Islemlerine Don
          </Link>
        </div>
      </main>
    </div>
  );
}
