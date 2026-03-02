import Link from "next/link";
import { BackofficePage, ContentCard, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";

const qaScenarios = [
  {
    title: "Masa ve QR",
    description: "Masa ac, QR goruntule, musteri siparisini masa bazli olustur.",
    href: "/admin/tables",
  },
  {
    title: "Siparis ve Mutfak",
    description: "Siparisi mutfaga dusur, hazirla, servise hazir ve geri al akisini dene.",
    href: "/kitchen",
  },
  {
    title: "Kasa ve Bolunmus Odeme",
    description: "Nakit, kart, karma ve split payment akislarini tamamla.",
    href: "/cashier",
  },
  {
    title: "Teslimat",
    description: "Kurye ekle, siparisi ata, teslimi tamamla.",
    href: "/delivery",
  },
  {
    title: "Rapor ve Finans",
    description: "Aktif sube ve tum subeler filtreleriyle ozetleri kontrol et.",
    href: "/admin/reports",
  },
  {
    title: "Personel ve Sube Erisimi",
    description: "Tek sube personeli ile patron hesabinin gordugu alanlari ayri ayri test et.",
    href: "/admin/roles",
  },
];

export default async function AdminSetupPage() {
  await requireRole(["admin"], "/admin/setup");

  return (
    <BackofficePage
      title="Product Ready Kontrol"
      description="Canliya cikmadan once kritik akislari tek tek dogrula."
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Operasyona Don
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Kritik Senaryo" value={String(qaScenarios.length)} hint="Canli oncesi tamamlanacak akış" tone="accent" />
        <SummaryCard label="Kapsam" value="Uctan Uca" hint="Siparis, mutfak, kasa, teslimat" />
        <SummaryCard label="Hedef" value="Stabil Yayın" hint="Sessiz fail ve yetki sizintisi kalmasin" tone="success" />
      </section>

      <WorkflowGuide
        title="QA 3 Asama"
        description="Tek tek ekran bakmak yerine butun operasyon hikayesini test et."
        steps={[
          { title: "Akisi tetikle", description: "Masa, siparis, mutfak veya teslimat verisini olustur." },
          { title: "Sonucu dogrula", description: "Karsilik gelen ekranda branch, rol ve durum akislarini izle." },
          { title: "Raporu kontrol et", description: "Islem sonunda kasa, rapor ve finans ozetlerinin dogru guncellendigini gor." },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {qaScenarios.map((scenario) => (
          <ContentCard key={scenario.title} title={scenario.title}>
            <div className="space-y-4">
              <p className="text-sm leading-7 text-slate-600">{scenario.description}</p>
              <Link href={scenario.href} className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Senaryoyu Ac
              </Link>
            </div>
          </ContentCard>
        ))}
      </section>
    </BackofficePage>
  );
}
