"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChefHat,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Mail,
  Network,
  Package,
  QrCode,
  Receipt,
  ShoppingCart,
  Smartphone,
  Store,
  Table2,
  UserSquare2,
  UtensilsCrossed,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { GeneralSettings } from "@/lib/app-settings";
import type { AppLocale } from "@/lib/i18n";
import { primaryHomeSeoLandingPages } from "@/lib/seo-landing-pages";

/**
 * Ekran goruntusu degil, kodla cizilmis illustrasyon panelleri kullanilir
 * (gopos.com.tr gibi sektor emsallerinde de bu yaklasim var). Eski surum
 * once oturum-bagimli sahte Google Stitch URL'leri, sonra gercek PNG
 * ekran goruntuleri icermisti; ikisi de terk edildi — ilki kalici degildi,
 * ikincisi ise "kaldirilsin" talimatiyla degistirildi. DashboardMock ve
 * PhoneMock bilesenleri gercek veriye degil, temsili ornek veriye dayanir.
 */
function DashboardMock() {
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

function PhoneMock({
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
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Cloud POS</p>
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

type ProductLandingPageProps = {
  settings: GeneralSettings;
  leadStatus?: string;
  locale?: AppLocale;
};

const NAV_LINKS = [
  { href: "#urun", label: "Ürün" },
  { href: "#moduller", label: "Modüller" },
  { href: "#ekranlar", label: "Nasıl Çalışır" },
  { href: "#sss", label: "SSS" },
];

const FEATURE_MODULES = [
  {
    icon: Store,
    title: "Kafe ve restoran operasyonu",
    body: "Masa, adisyon, sipariş, mutfak, kasa ve servis taleplerini tek akışta yönetin.",
    span: "md:col-span-4",
    featured: true,
  },
  {
    icon: QrCode,
    title: "Self servis ve QR deneyimi",
    body: "Müşteri menü görüntüleme, QR akışı ve self servis sipariş senaryoları için hazır altyapı.",
    span: "md:col-span-2",
  },
  {
    icon: ChefHat,
    title: "Mutfak ekranı",
    body: "Hazırlanıyor, geciken, kritik ve servise hazır siparişleri mutfak ekibine net gösterir.",
    span: "md:col-span-2",
  },
  {
    icon: CreditCard,
    title: "Kasa ve adisyon",
    body: "Açık hesaplar, ödeme akışı, gün işlemleri ve tahsilat süreçleri için hazır ekranlar.",
    span: "md:col-span-4",
  },
  {
    icon: Package,
    title: "Stok ve ürün yönetimi",
    body: "Ürün, kategori, reçete, maliyet ve kritik stok takibi tek yerde.",
    span: "md:col-span-3",
  },
  {
    icon: BarChart3,
    title: "Raporlar ve analiz",
    body: "Ciro, sipariş, şube, ürün ve finans metriklerini yönetim panelinden takip edin.",
    span: "md:col-span-3",
  },
];

const CAPABILITY_TAGS = [
  { icon: LayoutDashboard, label: "Operasyon paneli" },
  { icon: ShoppingCart, label: "POS sipariş ekranı" },
  { icon: UtensilsCrossed, label: "Mutfak ekranı" },
  { icon: Receipt, label: "Kasa ve adisyon" },
  { icon: Table2, label: "Masa yönetimi" },
  { icon: QrCode, label: "Self servis / QR altyapısı" },
  { icon: Smartphone, label: "Mobil PWA ekranları" },
  { icon: Package, label: "Stok ve ürün yönetimi" },
  { icon: BarChart3, label: "Raporlama" },
  { icon: Network, label: "Çoklu şube yapısı" },
  { icon: UserSquare2, label: "Personel rolleri" },
];

const FAQS = [
  {
    q: "Bu ürün sadece restoranlar için mi?",
    a: "Hayır. Cloud POS hem kafe-restoran operasyon modülünü hem de self servis / QR tabanlı müşteri deneyimi altyapısını birlikte sunar.",
  },
  {
    q: "Operasyon paneline giriş devam ediyor mu?",
    a: "Evet. Sayfadaki Operasyon Paneli Giriş butonu korunur. Ürün tanıtımı yapılırken gerçek panele erişim kaybolmaz.",
  },
  {
    q: "Bu sayfadaki ekran görselleri neye dayanıyor?",
    a: "Bu sayfadaki paneller ürünün gerçek akışını temsili örnek verilerle gösterir. Gerçek ekranları görmek için Demo sayfasını inceleyebilir veya operasyon paneline giriş yapabilirsiniz.",
  },
  {
    q: "Mobil kullanım var mı?",
    a: "Evet. Mobil operasyon, masa akışı, sipariş girişi, mutfak ve kasa gibi PWA odaklı ekranlar ürünün parçasıdır.",
  },
  {
    q: "Çoklu şube ve ekip yönetimi destekleniyor mu?",
    a: "Evet. İşletme, şube, personel rolleri ve operasyon ekranları çoklu lokasyon yönetimine uygun yapıdadır.",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function ProductLandingPage({ settings, leadStatus, locale = "tr" }: ProductLandingPageProps) {
  const siteName = settings.siteName || "Quapos Cloud POS";
  const supportEmail = settings.supportEmail || "info@cloudpos.local";
  const phone = settings.contactPhone || settings.whatsappPhone || "+90 555 000 00 00";

  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0);

  return (
    <div className="min-h-[100dvh] bg-white font-sans text-zinc-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-4 md:px-10">
          <div className="flex min-w-0 items-center gap-10">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#b3410c] text-sm font-bold text-white">
                {siteName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate whitespace-nowrap font-[family-name:var(--font-sora)] text-lg font-bold tracking-tight text-zinc-950">
                {siteName}
              </span>
            </Link>
            <div className="hidden items-center gap-7 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSwitcher locale={locale} label="Dil" compact />
            <Link
              href="/demo"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 sm:block"
            >
              Demo
            </Link>
            <Link
              href="/login"
              className="whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.97] sm:px-5"
            >
              <span className="sm:hidden">Giriş</span>
              <span className="hidden sm:inline">Operasyon Paneli Giriş</span>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero: asimetrik split, merkezlenmis basliklar yok */}
        <section id="urun" className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 top-20 h-96 w-96 rounded-full bg-[#b3410c]/10 blur-[120px]" />
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-4 py-16 md:px-10 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              custom={0}
              className="max-w-xl"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fdece1] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#b3410c]">
                Cloud POS Platformu
              </span>
              <h1 className="mt-6 font-[family-name:var(--font-sora)] text-4xl font-bold leading-[0.98] tracking-tighter text-zinc-950 md:text-6xl">
                Self servis ve kafe restoran operasyonu, tek POS sisteminde.
              </h1>
              <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-zinc-600">
                Masa, sipariş, mutfak, kasa, stok, personel, çoklu şube ve raporlama modüllerini QR / self servis müşteri deneyimiyle birlikte tek bulut tabanlı üründe topluyor.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#b3410c] px-7 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
                >
                  Operasyon Paneli Giriş
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex h-12 items-center rounded-full border border-zinc-300 px-7 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                >
                  Demo Ekranları Gör
                </Link>
              </div>

              {leadStatus && (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Talebiniz alındı. En kısa sürede dönüş yapılacak.
                </p>
              )}

              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-zinc-200 pt-6">
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-2xl font-bold text-zinc-950">Self servis</p>
                  <p className="mt-1 text-xs text-zinc-500">QR ve müşteri akışı</p>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-2xl font-bold text-zinc-950">Restoran</p>
                  <p className="mt-1 text-xs text-zinc-500">Masa, mutfak, kasa</p>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-2xl font-bold text-zinc-950">Mobil</p>
                  <p className="mt-1 text-xs text-zinc-500">PWA, telefon ve tablet</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              custom={1}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-3xl border border-zinc-200 shadow-[0_30px_70px_-25px_rgba(24,24,27,0.35)]">
                <DashboardMock />
              </div>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-2xl md:flex"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-zinc-950">Sipariş #128 mutfağa iletildi</p>
                  <p className="text-[11px] text-zinc-400">2 saniye önce</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Modules: bento, asimetrik — 3 esit kart yok */}
        <section id="moduller" className="border-t border-zinc-200 bg-zinc-50 py-20 md:py-28">
          <div className="mx-auto max-w-[1400px] px-4 md:px-10">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3410c]">Ürün özellikleri</span>
              <h2 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                POS işi için gereken ana modüller hazır.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-600">
                Sayfa yazılımı satmakla kalmıyor, ürünün hangi operasyonları kapsadığını gösteriyor. Kafe-restoran yönetimi ve self servis akışları aynı platformda.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
              {FEATURE_MODULES.map((mod, index) => {
                const Icon = mod.icon;
                return (
                  <motion.div
                    key={mod.title}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={fadeUp}
                    custom={index}
                    className={`group rounded-3xl border p-8 transition-colors ${mod.span} ${
                      mod.featured
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
                        mod.featured ? "bg-white/10 text-white" : "bg-[#fdece1] text-[#b3410c]"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className={`mt-6 font-[family-name:var(--font-sora)] text-xl font-bold tracking-tight ${
                        mod.featured ? "text-white" : "text-zinc-950"
                      }`}
                    >
                      {mod.title}
                    </h3>
                    <p className={`mt-2.5 text-sm leading-relaxed ${mod.featured ? "text-zinc-300" : "text-zinc-600"}`}>
                      {mod.body}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Nasıl çalışır */}
        <section id="ekranlar" className="border-t border-zinc-200 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[1400px] px-4 md:px-10">
            <div className="mb-14 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3410c]">Nasıl çalışır</span>
              <h2 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                Operasyon merkezinden mutfağa, tek akış.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-600">
                Sipariş açılır açılmaz mutfağa düşer, masa durumu anında güncellenir, kasa tahsilatı bekleyen adisyonu görür. Aşağıdaki paneller akışın temsili bir örneğidir.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-7">
                <h4 className="mb-4 font-[family-name:var(--font-sora)] text-lg font-bold text-zinc-950">Operasyon merkezi</h4>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-[0_20px_50px_-20px_rgba(24,24,27,0.25)]">
                  <DashboardMock />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 lg:col-span-5">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-950">Mutfak ekranı</h4>
                    <p className="mt-1 text-xs leading-tight text-zinc-500">Sipariş anında mutfak ekibine düşer, gecikenler renkle işaretlenir.</p>
                  </div>
                  <div className="overflow-hidden rounded-3xl border-4 border-white shadow-xl ring-1 ring-zinc-200">
                    <PhoneMock
                      title="Mutfak"
                      rows={[
                        ["Masa 4 · Amerikano x2", "3dk"],
                        ["Masa 7 · Burger Menü", "9dk"],
                        ["Paket #128 · Pizza", "12dk"],
                      ]}
                      accentLabel="Hazır olarak işaretle"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-10">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-950">Self servis sipariş</h4>
                    <p className="mt-1 text-xs leading-tight text-zinc-500">QR menüden ürün seçimi, kategori filtresi ve hızlı sepet akışı.</p>
                  </div>
                  <div className="overflow-hidden rounded-3xl border-4 border-white shadow-xl ring-1 ring-zinc-200">
                    <PhoneMock
                      title="Self Servis · Masa 5"
                      rows={[
                        ["Latte", "₺120"],
                        ["Filtre Kahve", "₺95"],
                        ["Cheesecake", "₺140"],
                      ]}
                      accentLabel="Sepeti Onayla · ₺355"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform capability marquee */}
        <section className="border-t border-zinc-200 bg-zinc-950 py-20 md:py-24">
          <div className="mx-auto max-w-[1400px] px-4 md:px-10">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a4c]">Platform kapsamı</span>
              <h2 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold tracking-tight text-white md:text-4xl">
                Restoran operasyonu kadar self servis kanalı da düşünülmüş.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400">
                Ürün; personelin kullandığı operasyon ekranları ile müşterinin temas ettiği QR/self servis deneyimini aynı altyapıda birleştirir.
              </p>
            </div>
          </div>

          <div className="relative mt-14 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-zinc-950 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-zinc-950 to-transparent" />
            <motion.div
              className="flex w-max gap-4"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 34, ease: "linear", repeat: Infinity }}
            >
              {[...CAPABILITY_TAGS, ...CAPABILITY_TAGS].map((tag, index) => {
                const Icon = tag.icon;
                return (
                  <div
                    key={`${tag.label}-${index}`}
                    className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"
                  >
                    <Icon className="h-4 w-4 text-[#ff8a4c]" strokeWidth={1.75} />
                    <span className="whitespace-nowrap text-sm font-semibold text-white">{tag.label}</span>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Solution pages — yatay kaydirma, 3 esit kart degil */}
        <section className="border-t border-zinc-200 bg-white py-20 md:py-24">
          <div className="mx-auto max-w-[1400px] px-4 md:px-10">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3410c]">Çözüm sayfaları</span>
                <h2 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                  Detaylı çözüm modülleri.
                </h2>
              </div>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
              >
                Demo sayfasına git
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="scrollbar-none flex gap-5 overflow-x-auto px-4 pb-4 md:px-10">
            {primaryHomeSeoLandingPages.map((page) => (
              <Link
                key={page.slug}
                href={`/${page.slug}`}
                className="group w-[280px] shrink-0 rounded-3xl border border-zinc-200 bg-zinc-50 p-7 transition-colors hover:border-[#b3410c]/40 hover:bg-[#fdece1]/40"
              >
                <h4 className="font-[family-name:var(--font-sora)] text-lg font-bold text-zinc-950">{page.title}</h4>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{page.description}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b3410c]">
                  İncele
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="sss" className="border-t border-zinc-200 bg-zinc-50 py-20 md:py-28">
          <div className="mx-auto max-w-[1400px] px-4 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3410c]">Sık sorulan sorular</span>
              <h2 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                Ürün kapsamı net, erişim net.
              </h2>
            </div>
            <div className="mx-auto mt-12 max-w-3xl space-y-3">
              {FAQS.map((faq, index) => {
                const isActive = activeFaqIndex === index;
                return (
                  <div
                    key={faq.q}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaqIndex(isActive ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-transform active:scale-[0.995]"
                      aria-expanded={isActive}
                    >
                      <span className="text-sm font-bold text-zinc-950 md:text-base">{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${isActive ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-300 ${isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 pb-6 text-sm leading-relaxed text-zinc-600">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden border-t border-zinc-200 bg-zinc-950 py-20 md:py-28">
          <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#b3410c]/20 blur-[120px]" />
          <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-4 md:px-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--font-sora)] text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Cloud POS&apos;u operasyon panelinden inceleyin.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-zinc-400">
                Self servis, kafe-restoran operasyonu, mobil PWA, mutfak, kasa, stok, rapor ve çoklu şube modüllerini tek platformda görün.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#b3410c] px-7 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
                >
                  Operasyon Paneli Giriş
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                >
                  Demo Sayfası
                </Link>
              </div>
              <div className="mt-10 border-t border-white/10 pt-6 text-sm text-zinc-500">
                Telefon: {phone} · E-posta: {supportEmail}
              </div>
            </div>
            <div className="relative mx-auto w-56 md:w-64">
              <div className="overflow-hidden rounded-[2rem] border-8 border-white/10 shadow-2xl">
                <PhoneMock
                  title="Masa Akışı"
                  rows={[
                    ["Masa 2", "Boş"],
                    ["Masa 4", "Dolu"],
                    ["Masa 7", "Hesap İstendi"],
                  ]}
                  accentLabel="Masa Operasyonunu Aç"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-16">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 md:grid-cols-4 md:px-10">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b3410c] text-xs font-bold text-white">
                {siteName.charAt(0).toUpperCase()}
              </span>
              <span className="font-[family-name:var(--font-sora)] text-base font-bold text-zinc-950">{siteName}</span>
            </Link>
            <p className="max-w-[32ch] text-sm leading-relaxed text-zinc-500">
              Restoran ve kafe işletim sistemi. Tek panelden tüm operasyonunuzu yönetin.
            </p>
          </div>
          <div>
            <h5 className="text-sm font-bold text-zinc-950">Kurumsal</h5>
            <ul className="mt-5 space-y-3">
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Hakkımızda</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">İletişim</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Kariyer</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-bold text-zinc-950">Yasal</h5>
            <ul className="mt-5 space-y-3">
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Kullanım Koşulları</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Gizlilik Politikası</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Çerez Politikası</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-bold text-zinc-950">Yardım</h5>
            <ul className="mt-5 space-y-3">
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Destek</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#">Dokümantasyon</a></li>
              <li><a className="text-sm text-zinc-500 transition-colors hover:text-zinc-950" href="#sss">SSS</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-14 flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-zinc-200 px-4 pt-8 md:flex-row md:px-10">
          <p className="text-xs text-zinc-400">© {new Date().getFullYear()} {siteName}. Tüm hakları saklıdır.</p>
          <a
            href={`mailto:${supportEmail}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-950 hover:text-white"
          >
            <Mail className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}
