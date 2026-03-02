import Link from "next/link";
import { BackofficePage, ContentCard, NoticeBanner, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getSetupChecklistSummary } from "@/lib/data";

export default async function AdminOnboardingPage() {
  await requireRole(["admin"], "/admin/onboarding");
  const { counts, usingDemoData } = await getSetupChecklistSummary();

  const steps = [
    {
      title: "Isletme ayarlarini tamamla",
      description: "Marka, iletisim ve paket ayarlarini netlestir.",
      done: counts.businesses > 0,
      href: "/admin/settings",
      cta: "Ayarlari ac",
    },
    {
      title: "Sube ve salon yapisini kur",
      description: "Subeleri, masalari ve QR akislarini hazirla.",
      done: counts.tables > 0,
      href: "/admin/tables",
      cta: "Masalari ac",
    },
    {
      title: "Urun katalugunu doldur",
      description: "Kategori, urun, modifier ve fiyatlari gir.",
      done: counts.products > 0,
      href: "/admin/products",
      cta: "Urunleri ac",
    },
    {
      title: "Ekibi tanimla",
      description: "Personel hesaplari, roller ve sube erisimlerini ata.",
      done: counts.staff >= 2,
      href: "/admin/roles",
      cta: "Personeli ac",
    },
    {
      title: "Ilk operasyon testini yap",
      description: "Siparis, mutfak, kasa ve teslimat akislarini dene.",
      done: false,
      href: "/admin/orders",
      cta: "Siparis gir",
    },
  ];

  const completed = steps.filter((step) => step.done).length;

  return (
    <BackofficePage
      title="Kurulum Merkezi"
      description="Ilk kez kuruluyorsa tum temel operasyon adimlarini tek yerden tamamla."
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Operasyona Don
        </Link>
      }
    >
      {usingDemoData ? (
        <NoticeBanner tone="warning" title="Demo mod aktif" description="Kurulum adimlari ornek veri uzerinden hesaplanir." />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Kurulum Ilerlemesi" value={`${completed}/${steps.length}`} hint="Tamamlanan setup adimi" tone="accent" />
        <SummaryCard label="Urunler" value={String(counts.products)} hint="Katalog hazirligi" />
        <SummaryCard label="Masalar" value={String(counts.tables)} hint="Salon kurulumu" tone="success" />
        <SummaryCard label="Personel" value={String(counts.staff)} hint="Hazir ekip sayisi" />
      </section>

      <WorkflowGuide
        title="Kurulum 3 Faz"
        description="Kurulum bir teknik proje gibi degil, acilisa hazirlik akisi gibi ilerlemeli."
        steps={[
          { title: "Yapiyi kur", description: "Isletme, sube ve masa yapisini once netlestir." },
          { title: "Operasyonu tanimla", description: "Urunler, personel ve teslimat akislarini ekle." },
          { title: "Canli prova yap", description: "Siparis al, mutfaga dusur, kasada kapat ve raporda kontrol et." },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {steps.map((step) => (
          <ContentCard key={step.title} title={step.title}>
            <div className="space-y-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {step.done ? "Hazir" : "Eksik"}
              </span>
              <p className="text-sm leading-7 text-slate-600">{step.description}</p>
              <Link href={step.href} className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {step.cta}
              </Link>
            </div>
          </ContentCard>
        ))}
      </section>
    </BackofficePage>
  );
}
