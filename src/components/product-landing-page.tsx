import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  PackageSearch,
  QrCode,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { GeneralSettings } from "@/lib/app-settings";
import type { AppLocale } from "@/lib/i18n";
import { primaryHomeSeoLandingPages } from "@/lib/seo-landing-pages";

type ProductLandingPageProps = {
  settings: GeneralSettings;
  leadStatus?: string;
  locale?: AppLocale;
};

const productModules = [
  {
    icon: Store,
    title: "Kafe ve restoran operasyonu",
    body: "Masa, adisyon, sipariş, mutfak, kasa ve servis taleplerini tek akışta yönetin.",
    color: "bg-orange-100 text-orange-700",
  },
  {
    icon: QrCode,
    title: "Self servis ve QR deneyimi",
    body: "Müşteri menü görüntüleme, QR akışı ve self servis sipariş senaryoları için güçlü temel.",
    color: "bg-cyan-100 text-cyan-700",
  },
  {
    icon: ChefHat,
    title: "Mutfak ekranı",
    body: "Hazırlanıyor, geciken, kritik ve servise hazır siparişleri mutfak ekibine net gösterir.",
    color: "bg-rose-100 text-rose-700",
  },
  {
    icon: CreditCard,
    title: "Kasa ve adisyon",
    body: "Açık hesaplar, ödeme akışı, gün işlemleri ve tahsilat süreçleri için hazır ekranlar.",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: PackageSearch,
    title: "Stok ve ürün yönetimi",
    body: "Ürün, kategori, reçete, maliyet ve kritik stok yönetimi için operasyönel yapı.",
    color: "bg-amber-100 text-amber-700",
  },
  {
    icon: BarChart3,
    title: "Raporlar ve analiz",
    body: "Ciro, sipariş, şube, ürün ve finans metriklerini yönetim panelinden takip edin.",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    icon: Building2,
    title: "Çoklu şube",
    body: "İşletme ve şube bazlı yapı ile merkezden yönetilebilen POS altyapısı.",
    color: "bg-violet-100 text-violet-700",
  },
  {
    icon: Users,
    title: "Personel ve roller",
    body: "Ekip erişimleri, rol bazlı paneller ve operasyon yetkileri için hazır mimari.",
    color: "bg-sky-100 text-sky-700",
  },
];

const screenshots = [
  {
    title: "Operasyon merkezi",
    body: "Anlık sipariş, masa, mutfak ve kasa durumunu tek yönetim ekranında görün.",
    image: "/landing-assets/operasyon-paneli-desktop.png",
    alt: "Cloud POS operasyon paneli gerçek ekran görüntüsü",
    width: 1440,
    height: 900,
    wide: true,
  },
  {
    title: "Mobil operasyon",
    body: "PWA uyumlu mobil ekranlarla personel sahada hızlı hareket eder.",
    image: "/landing-assets/operasyon-paneli-mobil.png",
    alt: "Cloud POS mobil operasyon gerçek ekran görüntüsü",
    width: 390,
    height: 844,
  },
  {
    title: "Mobil POS sipariş",
    body: "Ürün arama, kategori seçimi ve hızlı sipariş ekleme akışı.",
    image: "/landing-assets/mobil-pos-siparis.png",
    alt: "Cloud POS mobil sipariş gerçek ekran görüntüsü",
    width: 780,
    height: 1688,
  },
  {
    title: "Masa ve servis akışı",
    body: "Masa seçimi, adisyon açma ve servis süreci mobilde net ilerler.",
    image: "/landing-assets/mobil-masa-akisi-preview.png",
    alt: "Cloud POS mobil masa akışı gerçek ekran görüntüsü",
    width: 780,
    height: 1688,
  },
];

const included = [
  "Operasyon paneli",
  "POS sipariş ekranı",
  "Mutfak ekranı",
  "Kasa ve adisyon",
  "Masa yönetimi",
  "Self servis / QR altyapısı",
  "Mobil PWA ekranları",
  "Stok ve ürün yönetimi",
  "Raporlama",
  "Çoklu şube yapısı",
  "Personel rolleri",
  "Kurulum ve ortam dosyaları",
];

const faqs = [
  {
    q: "Bu ürün sadece restoranlar için mi?",
    a: "Hayır. Cloud POS hem kafe-restoran operasyon modülünü hem de self servis / QR tabanlı müşteri deneyimi altyapısını birlikte sunar.",
  },
  {
    q: "Operasyon paneline giriş devam ediyor mu?",
    a: "Evet. Landing page üzerinde Operasyon Paneli Giriş butonu korunur. Ürün tanıtımı yapılırken gerçek panele erişim kaybolmaz.",
  },
  {
    q: "Görseller gerçek ürün ekranı mı?",
    a: "Evet. Bu sayfada kullanılan görseller mevcut uygulamanın gerçek QA ekran görüntülerinden alınmıştır; sahte dashboard mockup kullanılmaz.",
  },
  {
    q: "Mobil kullanım var mı?",
    a: "Evet. Mobil operasyon, masa akışı, sipariş girişi, mutfak ve kasa gibi PWA odaklı ekranlar ürünün parçasıdır.",
  },
  {
    q: "Çoklu şube ve ekip yönetimi destekleniyor mu?",
    a: "Evet. İşletme, şube, personel rolleri ve operasyon ekranları çoklu lokasyon yönetimine uygun yapıdadır.",
  },
  {
    q: "Ürün geliştirilebilir mi?",
    a: "Evet. Modern Next.js, TypeScript ve Supabase tabanlı yapı, yeni modül ve entegrasyonların eklenmesine uygundur.",
  },
];

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-8 text-slate-600">{body}</p>
    </div>
  );
}

export function ProductLandingPage({ settings, leadStatus, locale = "tr" }: ProductLandingPageProps) {
  const siteName = settings.siteName || "Cloud POS";
  const supportEmail = settings.supportEmail || "";
  const phone = settings.contactPhone || settings.whatsappPhone || "";

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-orange-500/20">
              CP
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-950">{siteName}</p>
              <p className="hidden text-xs font-semibold text-slate-500 sm:block">Self servis + kafe restoran POS</p>
            </div>
          </Link>

          <nav className="ml-8 hidden items-center gap-6 text-sm font-bold text-slate-600 lg:flex">
            <a href="#ürün" className="transition hover:text-orange-600">Ürün</a>
            <a href="#moduller" className="transition hover:text-orange-600">Modüller</a>
            <a href="#gorseller" className="transition hover:text-orange-600">Ekranlar</a>
            <a href="#sss" className="transition hover:text-orange-600">SSS</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher locale={locale} label="Dil" compact />
            <Link
              href="/demo"
              className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-orange-300 hover:text-orange-700 sm:inline-flex"
            >
              Demo
            </Link>
            <Link
              href="/login"
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
            >
              Operasyon Paneli Giriş
            </Link>
          </div>
        </div>
      </header>

      <section id="ürün" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(79,70,229,0.14),transparent_30%),radial-gradient(circle_at_82%_76%,rgba(16,185,129,0.14),transparent_26%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="inline-flex w-fit rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
              Cloud POS Platformu
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Self servis ve kafe restoran operasyonu tek POS sisteminde.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
              Cloud POS; QR/self servis müşteri deneyimi ile masa, sipariş, mutfak, kasa, stok, personel, çoklu şube ve raporlama modüllerini tek bulut tabanlı üründe birleştirir.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:bg-slate-800"
              >
                Operasyon Paneli Giriş
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-950 shadow-sm transition hover:border-orange-300 hover:text-orange-700"
              >
                Demo Ekranları Gör
              </Link>
            </div>
            {leadStatus ? (
              <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                Talebiniz alındı. En kısa sürede dönüş yapılacak.
              </p>
            ) : null}
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["Self servis", "QR ve müşteri akışı"],
                ["Restoran POS", "Masa, mutfak, kasa"],
                ["Mobil PWA", "Telefon ve tablet uyumlu"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-3xl border border-white bg-white/75 p-4 shadow-lg shadow-slate-900/5 backdrop-blur">
                  <p className="text-sm font-bold text-slate-950">{title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white bg-white p-3 shadow-2xl shadow-slate-950/15">
              <Image
                src="/landing-assets/operasyon-paneli-desktop.png"
                alt="Cloud POS operasyon paneli gerçek ekran görüntüsü"
                width={1440}
                height={900}
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="aspect-[16/10] w-full rounded-[1.35rem] object-cover object-left-top"
              />
            </div>
            <div className="absolute -bottom-8 right-4 hidden w-48 rounded-[1.5rem] border border-white bg-white p-2 shadow-2xl shadow-slate-950/20 md:block lg:w-56">
              <Image
                src="/landing-assets/operasyon-paneli-mobil.png"
                alt="Cloud POS mobil operasyon gerçek ekran görüntüsü"
                width={390}
                height={844}
                sizes="224px"
                className="max-h-[360px] w-full rounded-[1rem] object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="moduller" className="border-y border-slate-200 bg-white py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            eyebrow="Ürün özellikleri"
            title="POS işi için gereken ana modüller hazır."
            body="Sayfa artık sadece yazılımı satmıyor; ürünün hangi operasyonları kapsadığını net biçimde anlatıyor. Kafe-restoran yönetimi ve self servis akışları aynı platformda konumlanıyor."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productModules.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-3xl border border-slate-200 bg-[#fbfcff] p-5 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/10">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="gorseller" className="py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            eyebrow="Gerçek ürün ekranları"
            title="Sahte mockup yok. Görseller gerçek uygulama ekranlarından."
            body="Landing page üzerindeki ekranlar, mevcut Cloud POS ürününün gerçek QA görüntülerinden hazırlanmıştır. Ziyaretçi ürünün nasıl çalıştığını doğrudan görür."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {screenshots.map((item) => (
              <article key={item.title} className={item.wide ? "lg:col-span-2" : ""}>
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-950/8">
                  <div className="flex items-center justify-between px-2 pb-3">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{item.body}</p>
                    </div>
                    <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
                      Gerçek ekran
                    </span>
                  </div>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    sizes={item.wide ? "(min-width: 1024px) 1184px, 100vw" : "(min-width: 1024px) 584px, 100vw"}
                    className={`${item.wide ? "aspect-[16/9]" : "aspect-[4/5]"} w-full rounded-[1.35rem] border border-slate-100 object-cover object-left-top`}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-18 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Platform kapsamı</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Restoran operasyonu kadar self servis kanalı da düşünülmüş bir yapı.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Ürün; personelin kullandığı operasyon ekranları ile müşterinin temas ettiği QR/self servis deneyimini aynı altyapıda birleştirir.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {included.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-100">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-18 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div className="rounded-[2rem] bg-gradient-to-br from-orange-500 via-rose-500 to-indigo-600 p-8 text-white shadow-2xl shadow-orange-500/20">
            <LayoutDashboard size={30} />
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Modern, renkli ve ticari görünümlü bir POS vitrini.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/85">
              Yeni landing; ürünün modüllerini, gerçek ekranlarını, mobil kullanımını ve operasyon kapsamını daha çekici bir sunumla anlatır.
            </p>
          </div>
          <div className="grid content-center gap-4">
            {[
              ["Bulut tabanlı yapı", "Şube ve ekip yönetimine uygun modern web mimarisi."],
              ["Güvenli operasyon", "Rol, erişim, route koruması ve operasyon odaklı kontrol yapıları."],
              ["Geliştirilebilir ürün", "Yeni entegrasyonlar, paketler ve marka uyarlamaları için uygun temel."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-3xl border border-slate-200 bg-[#f7f8fb] p-6">
                <div className="flex gap-4">
                  <ShieldCheck className="mt-1 shrink-0 text-emerald-600" size={22} />
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#f8fafc] py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">Çözüm sayfaları</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                POS, QR menü, self servis ve stok aramaları için detaylı sayfalar.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                Cloud POS modüllerini farklı işletme ihtiyaçlarına göre ayrı ayrı inceleyin.
              </p>
            </div>
            <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Demo sayfasına git
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primaryHomeSeoLandingPages.map((page) => (
              <Link key={page.slug} href={`/${page.slug}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10">
                <p className="text-base font-bold tracking-tight text-slate-950">{page.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{page.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="sss" className="py-18 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            eyebrow="Sık sorulan sorular"
            title="Ürün kapsamı net, erişim net, görseller gerçek."
            body="Landing page artık ziyaretçiye Cloud POS’un ne olduğunu, hangi modülleri kapsadığını ve nasıl bir operasyon ürünü sunduğunu doğrudan anlatır."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold tracking-tight text-slate-950">{item.q}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/20">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
            <div>
              <ClipboardList size={30} className="text-orange-300" />
              <h2 className="mt-6 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                Cloud POS’u gerçek ürün ekranlarıyla inceleyin.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Self servis, kafe-restoran operasyonu, mobil PWA, mutfak, kasa, stok, rapor ve çoklu şube modüllerini tek platformda görün.
              </p>
              <p className="mt-4 text-sm font-semibold text-slate-400">
                {phone ? `Telefon: ${phone}` : null}
                {phone && supportEmail ? " | " : ""}
                {supportEmail ? `E-posta: ${supportEmail}` : null}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-orange-50"
              >
                Operasyon Paneli Giriş
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Demo Sayfası
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
