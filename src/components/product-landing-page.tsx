"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { GeneralSettings } from "@/lib/app-settings";
import type { AppLocale } from "@/lib/i18n";
import { primaryHomeSeoLandingPages } from "@/lib/seo-landing-pages";

type ProductLandingPageProps = {
  settings: GeneralSettings;
  leadStatus?: string;
  locale?: AppLocale;
};

export function ProductLandingPage({ settings, leadStatus, locale = "tr" }: ProductLandingPageProps) {
  const siteName = settings.siteName || "Quapos Cloud POS";
  const supportEmail = settings.supportEmail || "info@cloudpos.local";
  const phone = settings.contactPhone || settings.whatsappPhone || "+90 555 000 00 00";

  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

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
  ];

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 border-b border-outline-variant/30">
        <nav className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="flex items-center gap-8">
            <Link className="font-headline-md text-headline-md font-bold text-primary" href="/">
              {siteName}
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a className="font-label-lg text-label-lg text-primary border-b-2 border-secondary pb-1" href="#urun">
                Ürün
              </a>
              <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors" href="#moduller">
                Modüller
              </a>
              <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors" href="#ekranlar">
                Ekranlar
              </a>
              <a className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary transition-colors" href="#sss">
                SSS
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher locale={locale} label="Dil" compact />
            <Link className="hidden sm:block font-label-lg text-label-lg text-primary hover:bg-surface-container-low px-4 py-2 rounded-lg transition-all" href="/demo">
              Demo
            </Link>
            <Link className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-label-lg text-label-lg hover:opacity-90 transition-all" href="/login">
              Operasyon Paneli Giriş
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32" id="urun">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="w-full lg:w-1/2 space-y-8 text-left">
                <span className="inline-block px-4 py-1.5 bg-secondary-container/10 text-secondary-container font-label-md text-label-md rounded-full">
                  CLOUD POS PLATFORMU
                </span>
                <h1 className="font-headline-xl text-headline-xl text-primary leading-tight">
                  Self servis ve kafe restoran operasyonu tek POS sisteminde.
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                  Cloud POS; QR/self servis müşteri deneyimi ile masa, sipariş, mutfak, kasa, stok, personel, çoklu şube ve raporlama modüllerini tek bulut tabanlı üründe birleştirir.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Link className="h-12 flex items-center bg-primary text-on-primary px-8 rounded-lg font-label-lg text-label-lg hover:opacity-90 transition-all shadow-lg shadow-primary/10" href="/login">
                    Operasyon Paneli Giriş
                  </Link>
                  <Link className="h-12 flex items-center border border-primary text-primary px-8 rounded-lg font-label-lg text-label-lg hover:bg-surface-container-low transition-all" href="/demo">
                    Demo Ekranları Gör
                  </Link>
                </div>
                
                {leadStatus && (
                  <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                    Talebiniz alındı. En kısa sürede dönüş yapılacak.
                  </p>
                )}

                {/* Quick Stats Chips */}
                <div className="flex flex-wrap gap-4 pt-8">
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-outline-variant/30 shadow-sm">
                    <span className="material-symbols-outlined text-secondary">qr_code_2</span>
                    <div>
                      <p className="font-label-lg text-label-lg text-primary">Self servis</p>
                      <p className="font-label-md text-label-md text-on-surface-variant">QR ve müşteri akışı</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-outline-variant/30 shadow-sm">
                    <span className="material-symbols-outlined text-secondary">restaurant</span>
                    <div>
                      <p className="font-label-lg text-label-lg text-primary">Restoran POS</p>
                      <p className="font-label-md text-label-md text-on-surface-variant">Masa, mutfak, kasa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-outline-variant/30 shadow-sm">
                    <span className="material-symbols-outlined text-secondary">smartphone</span>
                    <div>
                      <p className="font-label-lg text-label-lg text-primary">Mobil PWA</p>
                      <p className="font-label-md text-label-md text-on-surface-variant">Telefon ve tablet uyumlu</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-full lg:w-1/2 relative">
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  <Image 
                    className="w-full h-auto" 
                    alt="A high-fidelity desktop view of the Quapos Cloud POS operation dashboard"
                    src="https://lh3.googleusercontent.com/aida/AP1WRLs3CeEFn7-kKzKZ6oC4kGNcFvfBUlbY8j9GbF5VQHcRzOhZg4K3OmzwMMhOBz0xZoucmuV6x2FwCs4iacVUqKzj0bvm1JtfjcjKjpXoALFzh7eWa7X6Db1XTNoep5hOVTlOB8rD3MHbMCe6FG27SFrTtACxQ7ewU8QPvLZDois5SnQ7PI-9We87UqEpoAc8dRUdlEEQRvtKPLnzrwz9JVyNJqvA6BLU494TEGrKqI3QYQak788D1qsCgg0"
                    width={1440}
                    height={900}
                    priority
                  />
                </div>
                <div className="absolute -bottom-10 -right-10 w-48 h-auto z-20 hidden md:block rounded-xl overflow-hidden shadow-xl border-4 border-white rotate-2 transition-transform hover:rotate-0">
                  <Image 
                    className="w-full h-auto" 
                    alt="A portrait view of the mobile-optimized PWA version of the Quapos operation panel"
                    src="https://lh3.googleusercontent.com/aida/AP1WRLtRffyDmeuXbtL0lHlXio4ZBq9Z9F-dwK_5k2Livx4ls41mk2TfN7LSlvq9jFNPr0StlRjIi6azSP2U-HysFLPbSQoOjeiwsqGYlrvS91ssuSaS02PzrrtgGUBIS0ydzjeCxl48ZliVwgnFyJlf8wRW1za35gMbPVjKipwvMYXs_oCxGqwXTjrJYKYibt7s2XgM7HXhX7-8_J1saBniRGaUHjZEMq_4x83nZBDB6t5Ivq-rbVGiCUjH9rpL"
                    width={390}
                    height={844}
                  />
                </div>
                {/* Atmospheric effect */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 blur-[100px] rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-surface-container-lowest" id="moduller">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop text-center mb-16">
            <span className="font-label-lg text-label-lg text-secondary tracking-widest uppercase">ÜRÜN ÖZELLİKLERİ</span>
            <h2 className="font-headline-lg text-headline-lg text-primary mt-4 max-w-2xl mx-auto">POS işi için gereken ana modüller hazır.</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-4 max-w-3xl mx-auto">Sayfa artık sadece yazılımı satmıyor; ürünün hangi operasyonları kapsadığını net biçimde anlatıyor. Kafe-restoran yönetimi ve self servis akışları aynı platformda konumlanıyor.</p>
          </div>
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Module Card 1 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Kafe ve restoran operasyonu</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Masa, adisyon, sipariş, mutfak, kasa ve servis taleplerini tek akışta yönetin.</p>
            </div>
            {/* Module Card 2 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">qr_code</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Self servis ve QR deneyimi</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Müşteri menü görüntüleme, QR akışı ve self servis sipariş senaryoları için güçlü temel.</p>
            </div>
            {/* Module Card 3 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">soup_kitchen</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Mutfak ekranı</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Hazırlanıyor, geciken, kritik ve servise hazır siparişleri mutfak ekibine net gösterir.</p>
            </div>
            {/* Module Card 4 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Kasa ve adisyon</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Açık hesaplar, ödeme akışı, gün işlemleri ve tahsilat süreçleri için hazır ekranlar.</p>
            </div>
            {/* Module Card 5 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">inventory</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Stok ve ürün yönetimi</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Ürün, kategori, reçete, maliyet ve kritik stok yönetimi için operasyonel yapı.</p>
            </div>
            {/* Module Card 6 */}
            <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 hover:shadow-xl transition-all group">
              <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">monitoring</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-3">Raporlar ve analiz</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Ciro, sipariş, şube, ürün ve finans metriklerini yönetim panelinden takip edin.</p>
            </div>
          </div>
        </section>

        {/* Real Screens Section */}
        <section className="py-24 bg-surface overflow-hidden" id="ekranlar">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="mb-16">
              <span className="font-label-lg text-label-lg text-secondary tracking-widest uppercase">GERÇEK ÜRÜN EKRANLARI</span>
              <h2 className="font-headline-lg text-headline-lg text-primary mt-4">Sahte mockup yok. Görseller gerçek uygulama ekranlarından.</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-4">Landing page üzerindeki ekranlar, mevcut Cloud POS ürününün gerçek QA görüntülerinden hazırlanmıştır. Ziyaretçi ürünün nasıl çalıştığını doğrudan görür.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Dashboard Detail */}
              <div className="lg:col-span-7 space-y-12">
                <div className="group relative">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-headline-md text-headline-md text-primary">Operasyon merkezi</h4>
                    <span className="bg-status-success/10 text-status-success px-3 py-1 rounded-full text-label-md font-label-md">Gerçek ekran</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6">Anlık sipariş, masa, mutfak ve kasa durumunu tek yönetim ekranında görün.</p>
                  <div className="rounded-xl overflow-hidden shadow-lg border border-outline-variant/30 bg-white p-2">
                    <Image 
                      className="w-full h-auto rounded-lg" 
                      alt="A panoramic high-resolution capture of the Quapos operational dashboard"
                      src="https://lh3.googleusercontent.com/aida/AP1WRLs3CeEFn7-kKzKZ6oC4kGNcFvfBUlbY8j9GbF5VQHcRzOhZg4K3OmzwMMhOBz0xZoucmuV6x2FwCs4iacVUqKzj0bvm1JtfjcjKjpXoALFzh7eWa7X6Db1XTNoep5hOVTlOB8rD3MHbMCe6FG27SFrTtACxQ7ewU8QPvLZDois5SnQ7PI-9We87UqEpoAc8dRUdlEEQRvtKPLnzrwz9JVyNJqvA6BLU494TEGrKqI3QYQak788D1qsCgg0"
                      width={1440}
                      height={900}
                    />
                  </div>
                </div>
              </div>
              {/* Mobile Details */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="flex flex-col">
                    <span className="bg-status-success/10 text-status-success w-fit px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 uppercase tracking-tighter">Gerçek ekran</span>
                    <h4 className="font-label-lg text-label-lg text-primary">Mobil operasyon</h4>
                    <p className="text-[12px] text-on-surface-variant leading-tight mb-4">PWA uyumlu mobil ekranlarla personel sahada hızlı hareket eder.</p>
                  </div>
                  <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white">
                    <Image 
                      className="w-full h-auto" 
                      alt="Close-up of the mobile operation panel for Quapos"
                      src="https://lh3.googleusercontent.com/aida/AP1WRLtRffyDmeuXbtL0lHlXio4ZBq9Z9F-dwK_5k2Livx4ls41mk2TfN7LSlvq9jFNPr0StlRjIi6azSP2U-HysFLPbSQoOjeiwsqGYlrvS91ssuSaS02PzrrtgGUBIS0ydzjeCxl48ZliVwgnFyJlf8wRW1za35gMbPVjKipwvMYXs_oCxGqwXTjrJYKYibt7s2XgM7HXhX7-8_J1saBniRGaUHjZEMq_4x83nZBDB6t5Ivq-rbVGiCUjH9rpL"
                      width={390}
                      height={844}
                    />
                  </div>
                </div>
                <div className="space-y-6 pt-12">
                  <div className="flex flex-col">
                    <span className="bg-status-success/10 text-status-success w-fit px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 uppercase tracking-tighter">Gerçek ekran</span>
                    <h4 className="font-label-lg text-label-lg text-primary">Mobil POS sipariş</h4>
                    <p className="text-[12px] text-on-surface-variant leading-tight mb-4">Ürün arama, kategori seçimi ve hızlı sipariş ekleme akışı.</p>
                  </div>
                  <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white">
                    <Image 
                      className="w-full h-auto" 
                      alt="Detailed view of the Quapos mobile ordering interface"
                      src="https://lh3.googleusercontent.com/aida/AP1WRLtbwSAWMQApSs2qj9adQKw15375_idjUUBfO8QztCGZMGbQ-KrhUBwwWgdLb6xd4jw1H1N97Nj0D_u9lzctN-49RZhyrypbNYLC7dxQmFMlgAGZcgCFneg5EU77PjLaFIzqrnzHNgI7BCjZxy-Gy1zrrnQB2CTlrFoqKTTxCqk5rmHUzLXQGggkZqFikVvXkGCvks92zg3LkL8mEU8uxs63D21zbmtRXBZ7PhPszqu_EiQxRNplH6nR89fZ"
                      width={390}
                      height={844}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Capability List */}
        <section className="py-24 bg-primary text-on-primary">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex flex-col lg:flex-row items-end justify-between gap-8 mb-16">
              <div className="max-w-2xl">
                <span className="font-label-lg text-label-lg text-secondary-fixed tracking-widest uppercase">PLATFORM KAPSAMI</span>
                <h2 className="font-headline-lg text-headline-lg mt-4">Restoran operasyonu kadar self servis kanalı da düşünülmüş bir yapı.</h2>
                <p className="font-body-md text-body-md text-primary-container mt-4 opacity-80">Ürün; personelin kullandığı operasyon ekranları ile müşterinin temas ettiği QR/self servis deneyimini aynı altyapıda birleştirir.</p>
              </div>
              <div className="hidden lg:block w-32 h-1 bg-secondary rounded-full mb-4"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">dashboard</span>
                <span className="font-label-lg text-label-lg">Operasyon paneli</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">point_of_sale</span>
                <span className="font-label-lg text-label-lg">POS sipariş ekranı</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">outdoor_grill</span>
                <span className="font-label-lg text-label-lg">Mutfak ekranı</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">receipt_long</span>
                <span className="font-label-lg text-label-lg">Kasa ve adisyon</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">table_restaurant</span>
                <span className="font-label-lg text-label-lg">Masa yönetimi</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">qr_code</span>
                <span className="font-label-lg text-label-lg">Self servis / QR altyapısı</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">devices</span>
                <span className="font-label-lg text-label-lg">Mobil PWA ekranları</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">inventory_2</span>
                <span className="font-label-lg text-label-lg">Stok ve ürün yönetimi</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">analytics</span>
                <span className="font-label-lg text-label-lg">Raporlama</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">hub</span>
                <span className="font-label-lg text-label-lg">Çoklu şube yapısı</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">badge</span>
                <span className="font-label-lg text-label-lg">Personel rolleri</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-secondary-fixed">folder_managed</span>
                <span className="font-label-lg text-label-lg">Kurulum ve ortam dosyaları</span>
              </div>
            </div>
          </div>
        </section>

        {/* Solutions Pages */}
        <section className="py-24 bg-white">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex justify-between items-end mb-12">
              <div>
                <span className="font-label-lg text-label-lg text-secondary tracking-widest uppercase">ÇÖZÜM SAYFALARI</span>
                <h2 className="font-headline-lg text-headline-lg text-primary mt-4">Detaylı çözüm modülleri.</h2>
              </div>
              <Link className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-lg text-label-lg hover:opacity-90 transition-all" href="/demo">
                Demo sayfasına git
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {primaryHomeSeoLandingPages.map((page) => (
                <Link key={page.slug} href={`/${page.slug}`} className="group p-8 bg-surface-container-low rounded-2xl border border-outline-variant/30 hover:bg-primary hover:text-on-primary transition-all cursor-pointer">
                  <h4 className="font-headline-md text-headline-md mb-4 group-hover:text-secondary-fixed">{page.title}</h4>
                  <p className="font-body-sm text-body-sm opacity-70">{page.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-surface" id="sss">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-16">
              <span className="font-label-lg text-label-lg text-secondary tracking-widest uppercase">SIK SORULAN SORULAR</span>
              <h2 className="font-headline-lg text-headline-lg text-primary mt-4">Ürün kapsamı net, erişim net, görseller gerçek.</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-4">Landing page artık ziyaretçiye Cloud POS’un ne olduğunu doğrudan anlatır.</p>
            </div>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, index) => {
                const isActive = activeFaqIndex === index;
                return (
                  <div key={index} className="faq-item bg-white rounded-xl border border-outline-variant/30 overflow-hidden transition-all">
                    <button 
                      className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-surface-container-low transition-colors"
                      onClick={() => setActiveFaqIndex(isActive ? null : index)}
                    >
                      <span className="font-label-lg text-label-lg text-primary">{faq.q}</span>
                      <span className={`material-symbols-outlined transform transition-transform ${isActive ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                    <div className={`faq-content px-6 overflow-hidden transition-all duration-300 bg-white ${isActive ? 'max-h-[200px] py-4' : 'max-h-0 py-0'}`}>
                      <p className="pb-6 font-body-md text-body-md text-on-surface-variant">{faq.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 bg-primary text-on-primary overflow-hidden relative">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 space-y-8">
                <h2 className="font-headline-xl text-headline-xl">Cloud POS’u gerçek ürün ekranlarıyla inceleyin.</h2>
                <p className="font-body-lg text-body-lg opacity-80">Self servis, kafe-restoran operasyonu, mobil PWA, mutfak, kasa, stok, rapor ve çoklu şube modüllerini tek platformda görün.</p>
                <div className="flex flex-wrap gap-4">
                  <Link className="bg-secondary text-on-secondary px-8 py-4 rounded-lg font-label-lg text-label-lg hover:opacity-90 transition-all flex items-center gap-2" href="/login">
                    Operasyon Paneli Giriş
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                  <Link className="border border-white/20 hover:bg-white/10 px-8 py-4 rounded-lg font-label-lg text-label-lg transition-all" href="/demo">Demo Sayfası</Link>
                </div>
                <div className="pt-8 border-t border-white/10 text-label-md text-label-md opacity-60">
                  Telefon: {phone} | E-posta: {supportEmail}
                </div>
              </div>
              <div className="lg:w-1/2">
                <div className="relative">
                  <Image 
                    className="w-64 h-auto mx-auto rounded-[32px] shadow-2xl border-[8px] border-white/10 relative z-10" 
                    alt="A portrait-oriented mobile view of the Quapos table and service flow interface"
                    src="https://lh3.googleusercontent.com/aida/AP1WRLvxtmNnwfPN6XXbx4jjqhvXFjjB3hXqjfUHFHc_i-QuHLCOvy5lgzeqtIlkzPh8MJe1z1cr8JguAZarCCTM6iUVOlRc0rC1YiVtgbf6CFfkuwwSHs41MXGU68MJW1qv2oIkPkIomuZj0gGJKo9b7Aqn3SODa4B8RhXwLBdfY5msmwSylfsY0ULSInacfHjpRL90wy-e4Crbn0wqNsfs0NxjRgUXE1vlnh_0lChN1LvBzbGMMb2GgDSaWIs"
                    width={390}
                    height={844}
                  />
                  {/* Background glow */}
                  <div className="absolute inset-0 bg-secondary/20 blur-[80px] rounded-full scale-150"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-highest py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto text-left">
          <div className="space-y-6">
            <Link className="font-headline-md text-headline-md font-extrabold text-primary" href="/">
              {siteName}
            </Link>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Yeni nesil restoran ve kafe işletim sistemi. Tek panelden tüm operasyonunuzu yönetin.</p>
          </div>
          <div>
            <h5 className="font-label-lg text-label-lg text-primary mb-6">Kurumsal</h5>
            <ul className="space-y-4">
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Hakkımızda</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">İletişim</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Kariyer</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-lg text-label-lg text-primary mb-6">Yasal</h5>
            <ul className="space-y-4">
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Kullanım Koşulları</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Gizlilik Politikası</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Çerez Politikası</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-lg text-label-lg text-primary mb-6">Yardım</h5>
            <ul className="space-y-4">
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Destek</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">Dokümantasyon</Link></li>
              <li><Link className="font-label-md text-label-md text-on-surface-variant hover:text-secondary transition-colors underline-offset-4 hover:underline" href="#">SSS</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-16 pt-8 border-t border-outline-variant/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">© 2024 {siteName}. Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <a className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-all" href="#">
              <span className="material-symbols-outlined text-[20px]">public</span>
            </a>
            <a className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-secondary hover:text-white transition-all" href="#">
              <span className="material-symbols-outlined text-[20px]">mail</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
