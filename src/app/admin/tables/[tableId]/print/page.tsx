import Image from "next/image";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getTableMap } from "@/lib/domains/tables";
import { buildQrTarget } from "../../qr-helpers-server";

// Hedef URL'i disaridan alir: `buildQrTarget` her cagrida yeni zaman damgasi
// ve yeni imza uretir. Burada tekrar cagirsaydik sayfada yazan adres ile
// karekodun icindeki adres farkli olurdu.
function buildQrImage(prebuiltTarget: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(prebuiltTarget)}`;
}

export default async function PrintTableQrPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  await requireRole(["admin"], "/admin/tables");
  const { tableId } = await params;
  const { tables } = await getTableMap();
  const table = tables.find((item) => item.id === tableId);

  if (!table) {
    notFound();
  }

  const qrTarget = await buildQrTarget(table.qr_code_identifier);
  const qrImage = buildQrImage(qrTarget);

  return (
    <div className="min-h-screen bg-white p-8 text-slate-900 print:p-0">
      <div className="mx-auto max-w-[720px] rounded-[28px] border border-slate-300 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-10 print:shadow-none">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">QR Sipariş</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">{table.name || `Masa ${table.table_number}`}</h1>
          <p className="mt-3 text-xl text-slate-500">Masa {table.table_number}</p>
        </div>

        <div className="mt-8 flex justify-center">
          <Image src={qrImage} alt={`${table.name || `Masa ${table.table_number}`} QR`} width={360} height={360} className="h-[360px] w-[360px] rounded-[28px] border border-slate-200 object-cover" unoptimized />
        </div>

        <div className="mt-8 rounded-[24px] bg-slate-50 p-5 text-center">
          <p className="text-lg font-semibold">Telefonunuzla QR kodu okutun</p>
          <p className="mt-2 text-sm text-slate-500">Menuyu görüntuleyin, sipariş verin ve masa taleplerini iletin.</p>
          <p className="mt-4 break-all text-xs text-slate-400">{qrTarget}</p>
        </div>

        <div className="mt-8 flex justify-center gap-3 print:hidden">
          <a href={qrImage} download={`masa-${table.table_number}-qr.png`} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
            PNG İndir
          </a>
          <button type="button" onClick={() => window.print()} className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white">
            Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
