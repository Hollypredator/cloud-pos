"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  MonitorSmartphone,
  PackageSearch,
  QrCode,
  Store,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DashboardMock, PhoneMock } from "@/components/marketing-mocks";
import type { DemoPageContent } from "@/lib/demo";
import { getPublicCopy, type AppLocale } from "@/lib/i18n";

type DemoRendererEditorOptions = {
  activeSectionId?: string | null;
  onSelectSection?: (id: string) => void;
  previewMode?: boolean;
};

const demoSteps = [
  {
    icon: Store,
    title: "Operasyon merkezini inceleyin",
    body: "Canlı sipariş, masa, mutfak, kasa ve stok durumunu yönetim ekranında görün.",
  },
  {
    icon: QrCode,
    title: "Self servis akışını değerlendirin",
    body: "QR ve müşteri teması için ürünün sunduğu altyapıyı ürün türünda konumlandırın.",
  },
  {
    icon: ChefHat,
    title: "Mutfak ve kasa akışını görün",
    body: "Sipariş hazırlama, servis, adısyon ve tahsilat ekranlarının birbiriyle nasıl bağlandığını izleyin.",
  },
  {
    icon: MonitorSmartphone,
    title: "Mobil PWA deneyimini kontrol edin",
    body: "Masa seçimi, sipariş ekleme ve operasyon takibi telefon ekranında nasıl ilerliyor görün.",
  },
];

const demoModules = [
  { icon: ClipboardList, title: "Sipariş", body: "Masa ve self servis senaryolarını tek sipariş omurgasında toplayın." },
  { icon: ChefHat, title: "Mutfak", body: "Hazırlanıyor, kritik, geciken ve servise hazır işleri ayırın." },
  { icon: CreditCard, title: "Kasa", body: "Açık adısyon, ödeme, gün işlemleri ve tahsilat akışını yönetin." },
  { icon: PackageSearch, title: "Stok", body: "Ürün, kategori, maliyet ve kritik stok alanlarını takip edin." },
  { icon: BarChart3, title: "Rapor", body: "Ciro, sipariş, şube ve operasyon metriklerini tek panelden okuyun." },
];

const demoScreens = [
  {
    title: "Operasyon paneli",
    body: "QUAPOS’un ana yönetim ekranı.",
    kind: "dashboard" as const,
    className: "lg:col-span-2",
  },
  {
    title: "Mobil operasyon",
    body: "Telefon ekranında canlı operasyon takibi.",
    kind: "phone" as const,
    phoneRows: [
      ["Masa 2", "Boş"],
      ["Masa 4", "Dolu"],
      ["Masa 7", "Hesap İstendi"],
    ] as Array<[string, string]>,
    accentLabel: "Masa Operasyonunu Aç",
    className: "",
  },
  {
    title: "Mobil sipariş",
    body: "Kategori, ürün arama ve hızlı ekleme akışı.",
    kind: "phone" as const,
    phoneRows: [
      ["Latte", "₺120"],
      ["Filtre Kahve", "₺95"],
      ["Cheesecake", "₺140"],
    ] as Array<[string, string]>,
    accentLabel: "Sepeti Onayla · ₺355",
    className: "",
  },
];

export function DemoPageRenderer({
  content,
  editor,
  locale = "tr",
}: {
  content: DemoPageContent;
  editor?: DemoRendererEditorOptions;
  locale?: AppLocale;
}) {
  const copy = getPublicCopy(locale);

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-orange-500/20">
              Q
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-950">QUAPOS Demo</p>
              <p className="hidden text-xs font-semibold text-slate-500 sm:block">Modül modül ürün turu</p>
            </div>
          </Link>
          <nav className="ml-8 hidden items-center gap-6 text-sm font-bold text-slate-600 lg:flex">
            <a href="#akış" className="transition hover:text-orange-600">Akış</a>
            <a href="#ekranlar" className="transition hover:text-orange-600">Ekranlar</a>
            <a href="#moduller" className="transition hover:text-orange-600">Modüller</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher locale={locale} label={copy.localeSwitcher.label} compact />
            <Link href="/" className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-orange-300 hover:text-orange-700 sm:inline-flex">
              Ana sayfa
            </Link>
            <Link href="/login" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800">
              Operasyon Paneli Giriş
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(79,70,229,0.14),transparent_30%),radial-gradient(circle_at_80%_78%,rgba(16,185,129,0.13),transparent_26%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
              {content.previewBadge || "Canlı ürün demosu"}
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              QUAPOS’u modül modül deneyimleyin.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
              Self servis / QR akışı, kafe-restoran POS modülü, mutfak, kasa, stok, raporlama ve mobil PWA deneyimini tek ürün türünda görün.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:bg-slate-800">
                Operasyon Paneli Giriş
                <ArrowRight size={18} />
              </Link>
              <Link href="/" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-950 shadow-sm transition hover:border-orange-300 hover:text-orange-700">
                Ürün sayfasına dön
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white bg-white p-3 shadow-2xl shadow-slate-950/15">
            <DashboardMock />
          </div>
        </div>
      </section>

      <section id="akış" className="border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Demo akışı</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Ürünü modül modül inceleyin.</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">Demo sayfası artık sadece örnek veri değil, ürünün hangi problemi çözdüğünü anlatan kısa bir tur.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {demoSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-3xl border border-slate-200 bg-[#fbfcff] p-5 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="ekranlar" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Ekranlar</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Demo, ürünün gerçek akışını gösterir.</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">Aşağıdaki paneller temsili örnek verilerle ürünün akışını gösterir. Gerçek ekranları görmek için operasyon paneline giriş yapabilirsiniz.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {demoScreens.map((screen) => (
              <article key={screen.title} className={screen.className}>
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-950/8">
                  <div className="px-2 pb-3">
                    <h3 className="text-xl font-bold tracking-tight text-slate-950">{screen.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{screen.body}</p>
                  </div>
                  {screen.kind === "dashboard" ? (
                    <DashboardMock />
                  ) : (
                    <div className="mx-auto max-w-[280px]">
                      <PhoneMock title={screen.title} rows={screen.phoneRows} accentLabel={screen.accentLabel} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="moduller" className="bg-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Modül kapsamı</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Demo turu, satıştan operasyona tüm ürünü anlatır.</h2>
              <p className="mt-4 text-base leading-8 text-slate-300">Self servis ve restoran operasyonu aynı platform içinde nasıl birleşiyor, demo sayfasında net görünür.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {demoModules.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Icon size={22} className="text-orange-300" />
                    <h3 className="mt-4 text-lg font-bold">{module.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{module.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
