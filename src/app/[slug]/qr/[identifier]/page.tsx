import { notFound } from "next/navigation";
import { getBusinessContextBySlug, getMenu, getTableByQr } from "@/lib/domains/orders";
import { getApplicationSettings } from "@/lib/data";
import { normalizeBusinessSlug } from "@/lib/business";
import { QrOrderingClient } from "@/components/qr-ordering-client";
import { createQrAccessToken } from "@/lib/qr-access";
import { isQrConfirmationEnabledForBusinessSlug } from "@/lib/qr-confirmation";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { verifyQrSignature } from "@/lib/qr-security";

type QrSearchParams = {
  sig?: string;
  t?: string;
};

function QrMenuUnavailable({ tableLabel }: { tableLabel: string }) {
  return (
    <main className="min-h-screen bg-[#f7f3ec] px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-between rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur">
        <div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            QR Menü
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">Menü şu anda kapalı</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {tableLabel} için QR menü işletme tarafından geçici olarak durduruldu. Menü veya sipariş için lütfen personele danışın.
          </p>
        </div>
        <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Masa erişimi doğrulandı</p>
          <p className="mt-1 text-sm text-slate-500">Bu ekran sadece QR menü özelliği yeniden açıldığında ürünleri gösterir.</p>
        </div>
      </section>
    </main>
  );
}

function InvalidQrCode() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-between rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur animate-fade-in">
        <div>
          <div className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-rose-600">
            Güvenlik Koruması
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">Geçersiz Masa QR Bağlantısı</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Masa tahrifatı (başka bir masanın QR kod URL'sini tahmin etme/değiştirme) yoluyla sipariş verilmesini engellemek amacıyla QR kodlarımız dijital olarak imzalanmaktadır.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Lütfen masanızda bulunan orijinal QR kodu tekrar taratarak siparişinizi güvenle verin.
          </p>
        </div>
        <div className="mt-8 rounded-[24px] border border-rose-100 bg-rose-50/20 p-5">
          <p className="text-xs font-black text-rose-950">Masalar Arası Yetkisiz Sipariş Koruması Aktif</p>
          <p className="mt-1 text-xs text-rose-700/60 leading-normal">
            URL parametreleri değiştirilerek diğer masaların adisyonlarına ürün eklenmesi güvenlik gerekçesiyle sunucu tarafından reddedilmiştir.
          </p>
        </div>
      </section>
    </main>
  );
}

export default async function BusinessQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; identifier: string }>;
  searchParams: Promise<QrSearchParams>;
}) {
  const { slug, identifier } = await params;
  const { sig, t } = await searchParams;
  
  const businessSlug = normalizeBusinessSlug(slug);
  const table = await getTableByQr(identifier, businessSlug);
  if (!table) {
    notFound();
  }

  const [{ settings: applicationSettings }, businessContext] = await Promise.all([
    getApplicationSettings(),
    getBusinessContextBySlug(businessSlug),
  ]);
  const operatingProfile = resolveOperatingProfile(businessContext.business?.business_type);

  // Secure validation check:
  // Enforce signature verification ONLY in production mode (usingDemoData is false).
  // If sig is invalid and usingDemoData is false, block access to prevent table URL tampering!
  const isDemo = !businessContext.business; // Fallback to demo check if context is empty
  const isSignatureValid = verifyQrSignature(identifier, t || "", sig || "");
  
  if (!isSignatureValid && !isDemo) {
    return <InvalidQrCode />;
  }

  if (!applicationSettings.qrMenuEnabled) {
    return <QrMenuUnavailable tableLabel={table.name || `Masa ${table.table_number}`} />;
  }

  const { categories, products, modifierGroups, modifierOptions, usingDemoData } = await getMenu(businessSlug);
  const qrConfirmationEnabled = isQrConfirmationEnabledForBusinessSlug(businessSlug);
  const qrAccessToken = createQrAccessToken({
    qrCodeIdentifier: identifier,
    businessSlug,
  });

  return (
    <div className={operatingProfile === "coffee_self_service"
      ? "min-h-screen bg-[radial-gradient(circle_at_top,#3a1d0f_0%,#1f130d_48%,#120d09_100%)]"
      : "min-h-screen bg-[radial-gradient(circle_at_top,#1f2c56_0%,#0b1224_52%,#090f1f_100%)]"}
    >
      {usingDemoData ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo veri modu aktif. Supabase env degiskenlerini ekleyince canli veriye gecer.
        </div>
      ) : null}
      <QrOrderingClient
        categories={categories}
        products={products}
        modifierGroups={modifierGroups}
        modifierOptions={modifierOptions}
        businessSlug={businessSlug}
        qrCodeIdentifier={identifier}
        qrAccessToken={qrAccessToken ?? undefined}
        qrConfirmationEnabled={qrConfirmationEnabled}
        qrOrderingEnabled={applicationSettings.qrOrderingEnabled}
        operatingProfile={operatingProfile}
      />
    </div>
  );
}
