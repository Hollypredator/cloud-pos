/**
 * Pazarlama sayfalarinda (ana sayfa, login, demo) kullanilan, kodla cizilmis
 * temsili ekran panelleri. Ekran goruntusu degil — statik PNG'ler marka adi
 * degisince (Cloud POS -> QUAPOS gibi) pikselde eski yaziyla kalirdi, bu
 * bilesenler her zaman guncel metni render eder. gopos.com.tr gibi sektor
 * emsallerinde de gercek ekran yerine illustrasyon kullanimi yaygin.
 */

export function DashboardMock() {
  const stats: Array<[string, string]> = [
    ["Günlük Ciro", "₺18.240"],
    ["Açık Sipariş", "7"],
    ["Dolu Masa", "12/20"],
  ];
  const rows: Array<[string, string, string, string]> = [
    ["Masa 4", "Amerikano x2", "₺240", "Hazır"],
    ["Masa 7", "Burger Menü", "₺390", "Hazırlanıyor"],
    ["Paket #128", "Karışık Pizza", "₺310", "Yolda"],
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Canlı
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-sora)] text-xl font-bold text-zinc-950">{value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 px-6 pb-6">
        {rows.map(([table, item, price, status]) => (
          <div key={table} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-zinc-900">{table}</p>
              <p className="text-xs text-zinc-500">{item}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900">{price}</p>
              <p className="text-[11px] font-semibold text-[#b3410c]">{status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhoneMock({
  title,
  rows,
  accentLabel,
}: {
  title: string;
  rows: Array<[string, string]>;
  accentLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border-8 border-white bg-white">
      <div className="bg-zinc-950 px-4 py-3.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">QUAPOS</p>
        <p className="mt-0.5 text-sm font-bold text-white">{title}</p>
      </div>
      <div className="space-y-2 p-3">
        {rows.map(([name, price]) => (
          <div key={name} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
            <span className="text-xs font-semibold text-zinc-800">{name}</span>
            <span className="text-xs font-bold text-zinc-950">{price}</span>
          </div>
        ))}
        <div className="mt-2 rounded-xl bg-[#b3410c] px-3 py-2.5 text-center text-xs font-bold text-white">
          {accentLabel}
        </div>
      </div>
    </div>
  );
}
