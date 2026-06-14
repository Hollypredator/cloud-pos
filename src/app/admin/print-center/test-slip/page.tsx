import { PrintActions } from "@/components/print-actions";
import { requireRole } from "@/lib/auth";

export default async function TestSlipPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  await requireRole(["admin", "cashier"], "/admin/print-center/test-slip");
  const { layout } = await searchParams;
  const thermal = layout === "thermal";

  return (
    <div className="print-root bg-slate-100 px-4 py-8">
      <main
        className={`print-card mx-auto rounded-2xl bg-white shadow-sm ${
          thermal ? "max-w-[340px] p-4" : "max-w-2xl p-6"
        }`}
      >
        <header className="border-b border-slate-200 pb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Print Test</p>
          <h1 className={`mt-2 font-semibold text-slate-900 ${thermal ? "text-2xl" : "text-3xl"}`}>Cloud POS Test Fisi</h1>
          <p className="mt-2 text-xs text-slate-500">01.03.2026 15:40 - Masa 4</p>
        </header>

        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span>2x Latte</span>
            <span>250.00 TL</span>
          </li>
          <li className="flex items-center justify-between">
            <span>1x San Sebastian</span>
            <span>135.00 TL</span>
          </li>
          <li className="flex items-center justify-between">
            <span>1x Soda</span>
            <span>35.00 TL</span>
          </li>
        </ul>

        <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
          <p className="flex justify-between"><span>Ara Toplam</span><span>420.00 TL</span></p>
          <p className="mt-1 flex justify-between"><span>İndirim</span><span>-20.00 TL</span></p>
          <p className="mt-1 flex justify-between"><span>Servis Ucreti</span><span>+30.00 TL</span></p>
          <p className="mt-2 flex justify-between text-base font-semibold text-slate-900"><span>Toplam</span><span>430.00 TL</span></p>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Bu sayfa yazıcı olmadan satır aralığı, font boyutu ve bosluk kontrol? için kullanılır.
        </p>

        <PrintActions baseHref="/admin/print-center/test-slip" />
      </main>
    </div>
  );
}
