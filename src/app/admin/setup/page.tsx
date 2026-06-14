import Link from "next/link";
import { BackofficePage, ContentCard, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";

const qaScenarios = [
  {
    title: "Masa ve QR",
    description: "Masa ac, QR görüntüle, müşteri siparişini masa bazli oluştur.",
    href: "/admin/tables",
  },
  {
    title: "Sipariş ve Mutfak",
    description: "Siparişi mutfaga dusur, hazırla, servise hazır ve geri al akışını dene.",
    href: "/kitchen",
  },
  {
    title: "Kasa ve Bolunmus Ödeme",
    description: "Nakit, kart, karma ve split payment akışlarini tamamla.",
    href: "/cashier",
  },
  {
    title: "Teslimat",
    description: "Kurye ekle, siparişi ata, teslimi tamamla.",
    href: "/delivery",
  },
  {
    title: "Rapor ve Finans",
    description: "Aktif şube ve tüm şubeler filtreleriyle ozetleri kontrol et.",
    href: "/admin/reports",
  },
  {
    title: "Personel ve Şube Erisimi",
    description: "Tek şube personeli ile patron hesabinin gordugu alanlari ayri ayri test et.",
    href: "/admin/roles",
  },
];

export default async function AdminSetupPage() {
  await requireRole(["admin"], "/admin/setup");

  return (
    <BackofficePage
      title="Product Ready Kontrol"
      description="Canlıya cikmadan önce kritik akışları tek tek doğrula."
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Operasyona Dön
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Kritik Senaryo" value={String(qaScenarios.length)} hint="Canlı oncesi tamamlanacak akış" tone="accent" />
        <SummaryCard label="Kapsam" value="Uctan Uca" hint="Sipariş, mutfak, kasa, teslimat" />
        <SummaryCard label="Hedef" value="Stabil Yayın" hint="Sessiz fail ve yetki sizintisi kalmasin" tone="success" />
      </section>

      <WorkflowGuide
        title="QA 3 Asama"
        description="Tek tek ekran bakmak yerine butun operasyon hikayesini test et."
        steps={[
          { title: "Akışı tetikle", description: "Masa, sipariş, mutfak veya teslimat verisini oluştur." },
          { title: "Sonucu doğrula", description: "Karsilik gelen ekranda branch, rol ve durum akışlarini izle." },
          { title: "Raporu kontrol et", description: "İşlem sonunda kasa, rapor ve finans ozetlerinin doğru güncellendigini gör." },
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
