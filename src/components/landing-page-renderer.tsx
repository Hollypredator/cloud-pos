"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LandingContactCard } from "@/components/landing-contact-card";
import type { GeneralSettings } from "@/lib/app-settings";
import { defaultLandingContent, type LandingContent, type LandingSection, type LandingSectionStyle } from "@/lib/site-content";
import { getPublicCopy, translateLandingTextForLocale, type AppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

type LandingRendererEditorOptions = {
  activeSectionId?: string | null;
  onSelectSection?: (id: string) => void;
  previewMode?: boolean;
};

type HeaderNavKey = "pos" | "orders" | "business" | "corporate" | "pricing";

type HeaderMegaCard = {
  title: string;
  body: string;
  badge: string;
};

type HeaderMegaMenu = {
  title: string;
  cards: HeaderMegaCard[];
  ctaLabel: string;
};

type HeroShowcaseTab = {
  label: string;
  caption: string;
  href: string;
};

type LandingHeaderCopy = {
  menüLabel: string;
  solutionsLabel: string;
  requestDemoLabel: string;
  nav: {
    posSystems: string;
    orderSolutions: string;
    businessSolutions: string;
    corporate: string;
    pricing: string;
  };
  tabs: {
    allInOnePos: string;
    boşsApp: string;
    staffManagement: string;
    qrOrdering: string;
    kioskSolutions: string;
  };
  stats: {
    venuesLabel: string;
    venuesValue: string;
    uptimeLabel: string;
    uptimeValue: string;
    supportLabel: string;
    supportValue: string;
  };
};

function getLandingHeaderCopy(locale: AppLocale): LandingHeaderCopy {
  if (locale === "fr") {
    return {
      menüLabel: "Menü",
      solutionsLabel: "Solutions Produits",
      requestDemoLabel: "Demander une Demo",
      nav: {
        posSystems: "Solutions POS",
        orderSolutions: "Solutions de Commande",
        businessSolutions: "Solutions Business",
        corporate: "Entreprise",
        pricing: "Tarifs",
      },
      tabs: {
        allInOnePos: "Cloud POS Core",
        boşsApp: "Panel de Gestion",
        staffManagement: "Gestion Equipe",
        qrOrdering: "QR & Commande",
        kioskSolutions: "Libre-Service",
      },
      stats: {
        venuesLabel: "Operation",
        venuesValue: "Multi",
        uptimeLabel: "Infrastructure",
        uptimeValue: "Cloud",
        supportLabel: "Support",
        supportValue: "24/7",
      },
    };
  }

  if (locale === "en") {
    return {
      menüLabel: "Menü",
      solutionsLabel: "Product Solutions",
      requestDemoLabel: "Request Demo",
      nav: {
        posSystems: "POS Systems",
        orderSolutions: "Order Solutions",
        businessSolutions: "Business Solutions",
        corporate: "Corporate",
        pricing: "Pricing",
      },
      tabs: {
        allInOnePos: "Cloud POS Core",
        boşsApp: "Management Panel",
        staffManagement: "Staff Management",
        qrOrdering: "QR & Ordering",
        kioskSolutions: "Self-Service",
      },
      stats: {
        venuesLabel: "Operations",
        venuesValue: "Multi",
        uptimeLabel: "Infrastructure",
        uptimeValue: "Cloud",
        supportLabel: "Support",
        supportValue: "24/7",
      },
    };
  }

  return {
    menüLabel: "Menü",
    solutionsLabel: "Ürün Cozumleri",
    requestDemoLabel: "Demo Talep Et",
    nav: {
      posSystems: "POS Sistemleri",
      orderSolutions: "Sipariş Cozumleri",
      businessSolutions: "İşletme Cozumleri",
      corporate: "Kurumsal",
      pricing: "Fiyatlama",
    },
    tabs: {
      allInOnePos: "Cloud POS Core",
      boşsApp: "Yönetim Paneli",
      staffManagement: "Personel Yönetimi",
      qrOrdering: "QR ve Sipariş",
      kioskSolutions: "Self-Servis",
    },
    stats: {
      venuesLabel: "Operasyon",
      venuesValue: "Çoklu",
      uptimeLabel: "Altyapi",
      uptimeValue: "Bulut",
      supportLabel: "Destek",
      supportValue: "24/7",
    },
  };
}

function getHeaderMegaMenus(locale: AppLocale): Partial<Record<HeaderNavKey, HeaderMegaMenu>> {
  if (locale === "fr") {
    return {
      pos: {
        title: "Solutions POS",
        ctaLabel: "Voir l'Offre Equipement",
        cards: [
          { badge: "CF", title: "Cafe", body: "Flux de caisse et operation de salle." },
          { badge: "RS", title: "Restaurant", body: "Gestion de table, cuisine et service." },
          { badge: "DL", title: "Livraison", body: "Flux en salle et livraison sur le meme ecran." },
          { badge: "IN", title: "Integrations", body: "Connexions vers paiements et canaux externes." },
          { badge: "QR", title: "QR Menü", body: "Consultation menü et demande de service par QR." },
        ],
      },
      orders: {
        title: "Solutions de Commande",
        ctaLabel: "Voir les Flux de Commande",
        cards: [
          { badge: "MB", title: "Mobile POS", body: "Operation depuis tablette et mobile." },
          { badge: "QR", title: "QR Menü", body: "Consultation menü et suivi de commande." },
          { badge: "WB", title: "Web", body: "Gestion operationnelle depuis navigateur." },
          { badge: "KS", title: "Kiosque", body: "Libre-service avec suggestion panier." },
        ],
      },
      business: {
        title: "Solutions Business",
        ctaLabel: "Decouvrir les Modules",
        cards: [
          { badge: "HR", title: "Staff", body: "Roles, shifts, objectifs et suivi d'equipe." },
          { badge: "ST", title: "Stock", body: "Recettes, couts et mouvements de stock." },
          { badge: "RP", title: "Reports", body: "Rapports horaires, journaliers et multi-site." },
          { badge: "BR", title: "Branches", body: "Gestion centralisee des succursales." },
        ],
      },
    };
  }

  if (locale === "en") {
    return {
      pos: {
        title: "POS Systems",
        ctaLabel: "See Device Campaign",
        cards: [
          { badge: "CF", title: "Cafe", body: "Fast checkout flow and table operations." },
          { badge: "RS", title: "Restaurant", body: "Table, kitchen, and service orchestration." },
          { badge: "DL", title: "Delivery", body: "In-store and delivery flow on one screen." },
          { badge: "IN", title: "Integrations", body: "Connections to payments and external channels." },
          { badge: "QR", title: "QR Menü", body: "Menü browse and service request via QR." },
        ],
      },
      orders: {
        title: "Order Solutions",
        ctaLabel: "Explore Order Flows",
        cards: [
          { badge: "MB", title: "Mobile POS", body: "Operate from tablet and phone." },
          { badge: "QR", title: "QR Menü", body: "Menü viewing and order status tracking." },
          { badge: "WB", title: "Web Panel", body: "Operational control from browser." },
          { badge: "KS", title: "Kiosk", body: "Self-order flow with basket upsell." },
        ],
      },
      business: {
        title: "Business Solutions",
        ctaLabel: "Discover Modules",
        cards: [
          { badge: "HR", title: "Staff", body: "Roles, shifts, goals, and team tracking." },
          { badge: "ST", title: "Stock", body: "Recipe-based costs and stock movements." },
          { badge: "RP", title: "Reports", body: "Hourly, daily, and multi-branch reporting." },
          { badge: "BR", title: "Branch", body: "Centralized multi-branch management." },
        ],
      },
    };
  }

  return {
    pos: {
      title: "POS Sistemleri",
      ctaLabel: "Çözüm Paketlerini Incele",
      cards: [
        { badge: "CF", title: "Kafe", body: "Hızlı checkout ve masa operasyonu." },
        { badge: "RS", title: "Restoran", body: "Masa, mutfak ve servis orkestrasyonu." },
        { badge: "DL", title: "Paket-Sipariş", body: "Salon ve teslimat akışı tek ekranda." },
        { badge: "IN", title: "Entegrasyonlar", body: "Ödeme ve dis kanal bağlantılari." },
        { badge: "QR", title: "QR Menü", body: "QR ile menü görüntüleme ve servis talebi." },
      ],
    },
    orders: {
      title: "Sipariş Cozumleri",
      ctaLabel: "Sipariş Akışlarini Kesfet",
      cards: [
        { badge: "MB", title: "Mobil POS", body: "Tablet ve telefonla operasyon." },
        { badge: "QR", title: "QR Menü", body: "Menü görüntüleme ve sipariş durumu." },
        { badge: "WB", title: "Web Panel", body: "Tarayıcıdan operasyon yönetimi." },
        { badge: "KS", title: "Kiosk Sipariş", body: "Self-servis sipariş akışı." },
      ],
    },
    business: {
      title: "İşletme Cozumleri",
      ctaLabel: "Tüm Modülleri Incele",
      cards: [
        { badge: "HR", title: "Personel", body: "Rol, vardiya, hedef ve ekip takibi." },
        { badge: "ST", title: "Stok", body: "Reçete bazli maliyet ve stok yönetimi." },
        { badge: "RP", title: "Raporlar", body: "Saatlik, gunluk, şube bazli raporlama." },
        { badge: "BR", title: "Şube", body: "Merkezden Çoklu şube yönetimi." },
      ],
    },
  };
}

function getSectionHref(sections: LandingSection[], sectionType: LandingSection["type"]) {
  const section = sections.find((item) => item.type === sectionType);
  return section ? `#${section.id}` : "/";
}

function renderHeaderNavLink(
  item: { href: string; label: string },
  previewMode: boolean | undefined,
  className: string,
  onNavigate?: () => void,
) {
  if (previewMode) {
    return (
      <span key={item.label} className={className}>
        {item.label}
      </span>
    );
  }

  if (item.href.startsWith("#")) {
    return (
      <a key={item.label} href={item.href} className={className} onClick={onNavigate}>
        {item.label}
      </a>
    );
  }

  return (
    <Link key={item.label} href={item.href} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

function wrapEditableSection(
  section: LandingSection,
  content: React.ReactNode,
  editor?: LandingRendererEditorOptions,
) {
  const isActive = editor?.activeSectionId === section.id;
  const containerClass = editor?.previewMode
    ? section.style.containerWidth === "narrow"
      ? "mx-auto max-w-5xl"
      : section.style.containerWidth === "wide"
        ? "mx-auto max-w-[1760px]"
        : "mx-auto max-w-[1600px]"
    : section.style.containerWidth === "narrow"
      ? "mx-auto max-w-4xl"
      : section.style.containerWidth === "wide"
        ? "mx-auto max-w-[1400px]"
        : "mx-auto max-w-7xl";
  const surfaceClass = getSectionSurfaceClass(section.style);
  const borderClass = getSectionBorderClass(section.style);
  const shadowClass = getSectionShadowClass(section.style);
  const textAlignClass = section.style.textAlign === "center" ? "text-center" : "text-left";
  const inner = (
    <div
      className={`${containerClass} ${surfaceClass} ${borderClass} ${shadowClass} ${textAlignClass} overflow-hidden`}
      style={{
        paddingTop: section.style.paddingTop,
        paddingBottom: section.style.paddingBottom,
        paddingLeft: section.style.paddingX,
        paddingRight: section.style.paddingX,
        borderRadius: section.style.radius,
      }}
    >
      {content}
    </div>
  );

  if (!editor?.onSelectSection) {
    return (
      <div key={section.id} id={section.id} className="scroll-mt-32">
        {inner}
      </div>
    );
  }

  return (
    <div
      key={section.id}
      id={section.id}
      role="button"
      tabIndex={0}
      onClick={() => editor.onSelectSection?.(section.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editor.onSelectSection?.(section.id);
        }
      }}
      className={`group relative scroll-mt-32 rounded-[2.25rem] transition ${
        isActive
          ? "ring-4 ring-sky-500/45 ring-offset-4 ring-offset-transparent"
          : "hover:ring-2 hover:ring-sky-400/35 hover:ring-offset-2 hover:ring-offset-transparent"
      }`}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white shadow-lg">
        {section.type}
      </div>
      {inner}
    </div>
  );
}

function getSectionSurfaceClass(style: LandingSectionStyle) {
  if (style.surface === "white") {
    return "bg-white";
  }

  if (style.surface === "glass") {
    return "bg-white/60 backdrop-blur";
  }

  if (style.surface === "dark") {
    return "bg-slate-950 text-white";
  }

  return "";
}

function getSectionBorderClass(style: LandingSectionStyle) {
  if (style.border === "light") {
    return style.surface === "dark" ? "border border-white/10" : "border border-slate-200";
  }

  if (style.border === "strong") {
    return style.surface === "dark" ? "border-2 border-white/20" : "border-2 border-slate-300";
  }

  return "";
}

function getSectionShadowClass(style: LandingSectionStyle) {
  if (style.shadow === "soft") {
    return "shadow-[0_12px_35px_rgba(15,23,42,0.08)]";
  }

  if (style.shadow === "medium") {
    return "shadow-[0_20px_60px_rgba(15,23,42,0.12)]";
  }

  if (style.shadow === "strong") {
    return "shadow-[0_30px_90px_rgba(15,23,42,0.18)]";
  }

  return "";
}

function renderHeaderActions(
  content: LandingContent,
  requestDemoLabel: string,
  requestHref: string,
  previewMode?: boolean,
  onNavigate?: () => void,
) {
  if (previewMode) {
    return (
      <>
        <span className="px-3 py-2 text-xs font-semibold text-slate-700 sm:px-2 sm:text-sm">
          {content.topLoginLabel}
        </span>
        <span className="px-3 py-2 text-xs font-semibold text-slate-700 sm:px-2 sm:text-sm">
          {content.topDemoLabel}
        </span>
        <span className="rounded-full bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)] sm:px-5 sm:text-sm">
          {requestDemoLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <Link href="/login" onClick={onNavigate} className="w-full px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:text-slate-900 sm:w-auto sm:px-2 sm:text-sm">
        {content.topLoginLabel}
      </Link>
      <Link href="/demo" onClick={onNavigate} className="w-full px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:text-slate-900 sm:w-auto sm:px-2 sm:text-sm">
        {content.topDemoLabel}
      </Link>
      {requestHref.startsWith("#") ? (
        <a
          href={requestHref}
          onClick={onNavigate}
          className="w-full rounded-full bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-4 py-2 text-center text-xs font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)] sm:w-auto sm:px-5 sm:text-sm"
        >
          {requestDemoLabel}
        </a>
      ) : (
        <Link
          href={requestHref}
          onClick={onNavigate}
          className="w-full rounded-full bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-4 py-2 text-center text-xs font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)] sm:w-auto sm:px-5 sm:text-sm"
        >
          {requestDemoLabel}
        </Link>
      )}
    </>
  );
}

function localizeLandingSection(section: LandingSection, locale: AppLocale): LandingSection {
  if (locale === "tr") {
    return section;
  }

  if (section.type === "hero") {
    return {
      ...section,
      badge: translateLandingTextForLocale(section.badge, locale),
      title: translateLandingTextForLocale(section.title, locale),
      body: translateLandingTextForLocale(section.body, locale),
      primaryCtaLabel: translateLandingTextForLocale(section.primaryCtaLabel, locale),
      secondaryCtaLabel: translateLandingTextForLocale(section.secondaryCtaLabel, locale),
    };
  }

  if (section.type === "feature_grid" || section.type === "process_steps" || section.type === "faq_grid") {
    return {
      ...section,
      eyebrow: translateLandingTextForLocale(section.eyebrow, locale),
      items: section.items.map((item) => ({
        title: translateLandingTextForLocale(item.title, locale),
        body: translateLandingTextForLocale(item.body, locale),
      })),
    };
  }

  if (section.type === "pricing_grid") {
    return {
      ...section,
      eyebrow: translateLandingTextForLocale(section.eyebrow, locale),
      items: section.items.map((item) => ({
        name: translateLandingTextForLocale(item.name, locale),
        price: translateLandingTextForLocale(item.price, locale),
        summary: translateLandingTextForLocale(item.summary, locale),
      })),
    };
  }

  if (section.type === "credibility") {
    return {
      ...section,
      eyebrow: translateLandingTextForLocale(section.eyebrow, locale),
      title: translateLandingTextForLocale(section.title, locale),
      body: translateLandingTextForLocale(section.body, locale),
      references: section.references.map((item) => translateLandingTextForLocale(item, locale)),
    };
  }

  return {
    ...section,
    eyebrow: translateLandingTextForLocale(section.eyebrow, locale),
    title: translateLandingTextForLocale(section.title, locale),
    body: translateLandingTextForLocale(section.body, locale),
  };
}

function renderHeroActions(section: Extract<LandingSection, { type: "hero" }>, previewMode?: boolean) {
  const primaryHref = section.primaryCtaHref.trim() || "/login";
  const secondaryHref = section.secondaryCtaHref.trim() || "/demo";

  function renderActionLink(label: string, href: string, className: string) {
    const isExternal = /^https?:\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
    if (href.startsWith("#") || isExternal) {
      return (
        <a
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className={className}
        >
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  if (previewMode) {
    return (
      <>
        <span className="rounded-2xl bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-5 py-3 text-sm font-semibold text-white">
          {section.primaryCtaLabel}
        </span>
        <span className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
          {section.secondaryCtaLabel}
        </span>
      </>
    );
  }

  return (
    <>
      {renderActionLink(
        section.primaryCtaLabel,
        primaryHref,
        "w-full rounded-2xl bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.34)] sm:w-auto",
      )}
      {renderActionLink(
        section.secondaryCtaLabel,
        secondaryHref,
        "w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400 sm:w-auto",
      )}
    </>
  );
}

function renderSection(
  section: LandingSection,
  settings: GeneralSettings,
  content: LandingContent,
  leadStatus?: string,
  businessPhone?: string,
  locale: AppLocale = "tr",
  editor?: LandingRendererEditorOptions,
  heroShowcase?: {
    tabs: HeroShowcaseTab[];
    activeIndex: number;
    setActiveIndex: (index: number) => void;
  },
) {
  const copy = getPublicCopy(locale);
  const heroStats = getLandingHeaderCopy(locale).stats;
  if (section.type === "hero") {
    const activeTab = heroShowcase ? (heroShowcase.tabs[heroShowcase.activeIndex] ?? null) : null;
    const wantsHeroImage = section.heroVisualMode === "image";
    const hasHeroImage = wantsHeroImage && section.heroImageUrl.trim().length > 0;
    return wrapEditableSection(
      section,
      <section className="py-6 sm:py-8 lg:py-10">
        <div className="grid items-center gap-7 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
          <div className="px-1 sm:px-2">
            <p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-700">
              {section.badge}
            </p>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:mt-6 sm:text-5xl lg:text-[3.85rem]">
              {section.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{section.body}</p>
            <div className="mt-7 flex flex-wrap gap-3">{renderHeroActions(section, editor?.previewMode)}</div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 border-t border-slate-200 pt-5">
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xl font-bold text-slate-900">{heroStats.venuesValue}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{heroStats.venuesLabel}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xl font-bold text-slate-900">{heroStats.uptimeValue}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{heroStats.uptimeLabel}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xl font-bold text-slate-900">{heroStats.supportValue}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{heroStats.supportLabel}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-[#f8fafc] p-5 shadow-[0_22px_50px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="relative h-[320px] rounded-[1.4rem] border border-slate-200 bg-white p-4 sm:h-[360px]">
              {hasHeroImage ? (
                <div className="relative h-full w-full overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-50">
                  <img
                    src={section.heroImageUrl}
                    alt={section.heroImageAlt || section.title}
                    className={`h-full w-full ${section.heroImageFit === "cover" ? "object-cover" : "object-contain"}`}
                  />
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/60 bg-white/75 px-3 py-1 backdrop-blur">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">{activeTab?.label ?? copy.landing.heroAsideTitle}</p>
                  </div>
                </div>
              ) : wantsHeroImage ? (
                <div className="flex h-full items-center justify-center rounded-[1.1rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Hero gorseli bekleniyor</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">Studio icinde "Görsel URL" alanini doldurdugünüzda burada gösterilir.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute left-[12%] top-[10%] h-[56%] w-[70%] rounded-2xl border border-slate-300 bg-slate-50 shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                    <div className="border-b border-slate-200 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{activeTab?.label ?? copy.landing.heroAsideTitle}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 p-3">
                      {Array.from({ length: 12 }).map((_, index) => (
                        <div key={`wide-cell-${index}`} className="h-7 rounded-md bg-slate-200/75" />
                      ))}
                    </div>
                  </div>

                  <div className="absolute left-[6%] top-[38%] h-[42%] w-[38%] rounded-xl border border-slate-300 bg-white shadow-[0_16px_25px_rgba(15,23,42,0.16)]">
                    <div className="border-b border-slate-200 px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tablet</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 p-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={`tablet-cell-${index}`} className="h-5 rounded bg-slate-200/80" />
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-[12%] right-[8%] h-[44%] w-[18%] rounded-xl border border-slate-300 bg-white shadow-[0_16px_25px_rgba(15,23,42,0.16)]">
                    <div className="border-b border-slate-200 px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mobile</p>
                    </div>
                    <div className="space-y-1.5 p-2">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div key={`mobile-cell-${index}`} className="h-3 rounded bg-slate-200/80" />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {heroShowcase && heroShowcase.tabs.length > 0 ? (
          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3 lg:grid-cols-5">
            {heroShowcase.tabs.map((tab, index) => {
              const active = index === heroShowcase.activeIndex;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => heroShowcase.setActiveIndex(index)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-indigo-500 bg-white shadow-[0_12px_30px_rgba(79,70,229,0.16)]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-800"}`}>{tab.label}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{tab.caption}</p>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>,
      editor,
    );
  }

  if (section.type === "feature_grid") {
    return wrapEditableSection(
      section,
      <section className="grid gap-3 py-2 sm:gap-4 sm:py-4 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:rounded-[1.75rem] sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                0{index + 1}
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </article>
        ))}
      </section>,
      editor,
    );
  }

  if (section.type === "process_steps") {
    return wrapEditableSection(
      section,
      <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:rounded-[1.75rem] sm:p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {section.items.map((item, index) => (
            <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6a3d_0%,#f2b44f_100%)] text-xs font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>,
      editor,
    );
  }

  if (section.type === "pricing_grid") {
    return wrapEditableSection(
      section,
      <section className="grid gap-3 py-2 sm:gap-4 sm:py-4 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className={`rounded-[1.25rem] border p-4 backdrop-blur sm:rounded-[1.75rem] sm:p-6 ${
              index === 1
                ? "border-indigo-600 bg-[linear-gradient(130deg,#4338ca_0%,#7c3aed_100%)] text-white shadow-[0_20px_50px_rgba(79,70,229,0.30)]"
                : "border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className={`text-xs uppercase tracking-[0.28em] ${index === 1 ? "text-slate-300" : "text-slate-500"}`}>{item.name}</p>
              {index === 1 ? <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">{copy.landing.recommendedPlan}</span> : null}
            </div>
            <p className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${index === 1 ? "text-white" : "text-slate-900"}`}>{item.price}</p>
            <p className={`mt-3 text-sm leading-7 ${index === 1 ? "text-slate-300" : "text-slate-600"}`}>{item.summary}</p>
          </article>
        ))}
      </section>,
      editor,
    );
  }

  if (section.type === "credibility") {
    return wrapEditableSection(
      section,
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:rounded-[2rem] sm:p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] bg-[linear-gradient(155deg,#0f172a_0%,#1f2937_100%)] px-5 py-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{section.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{section.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.references.map((item, index) => (
              <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>,
      editor,
    );
  }

  if (section.type === "faq_grid") {
    return wrapEditableSection(
      section,
      <section className="grid gap-3 py-3 sm:gap-4 sm:py-6 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:rounded-[1.75rem] sm:p-6"
          >
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </article>
        ))}
      </section>,
      editor,
    );
  }

  return wrapEditableSection(
    section,
    <LandingContactCard
      businessPhone={businessPhone || settings.whatsappPhone || settings.contactPhone}
      leadStatus={leadStatus}
      supportEmail={settings.supportEmail}
      eyebrow={section.eyebrow}
      title={section.title}
      body={section.body}
      previewMode={editor?.previewMode}
      locale={locale}
    />,
    editor,
  );
}

export function LandingPageRenderer({
  content,
  settings,
  leadStatus,
  editor,
  locale = "tr",
}: {
  content: LandingContent;
  settings: GeneralSettings;
  leadStatus?: string;
  editor?: LandingRendererEditorOptions;
  locale?: AppLocale;
}) {
  const copy = getPublicCopy(locale);
  const isPreviewMode = Boolean(editor?.previewMode);
  const [activeNavKey, setActiveNavKey] = useState<HeaderNavKey | null>(null);
  const [activeHeroTab, setActiveHeroTab] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const safeContent: LandingContent = {
    ...defaultLandingContent,
    ...(content ?? defaultLandingContent),
    topLoginLabel: locale === "tr" ? (content?.topLoginLabel ?? defaultLandingContent.topLoginLabel) : copy.nav.staffLogin,
    topDemoLabel: locale === "tr" ? (content?.topDemoLabel ?? defaultLandingContent.topDemoLabel) : copy.nav.demo,
    sections: (Array.isArray(content?.sections) && content.sections.length > 0 ? content.sections : defaultLandingContent.sections).map((section) =>
      localizeLandingSection(section, locale),
    ),
  };
  const siteName = settings?.siteName || "Cloud POS";
  const siteTagline = locale === "tr" ? settings?.siteTagline || "Yeni nesil cafe ve restoran operasyonu" : copy.landing.siteTagline;
  const logoUrl = settings?.logoUrl;
  const footerNote = locale === "tr" ? settings?.footerNote || "Cloud POS" : copy.landing.footerFallback;
  const contactPhone = settings?.contactPhone || "";
  const supportEmail = settings?.supportEmail || "";
  const headerCopy = getLandingHeaderCopy(locale);
  const featureHref = getSectionHref(safeContent.sections, "feature_grid");
  const processHref = getSectionHref(safeContent.sections, "process_steps");
  const credibilityHref = getSectionHref(safeContent.sections, "credibility");
  const pricingHref = getSectionHref(safeContent.sections, "pricing_grid");
  const contactHref = getSectionHref(safeContent.sections, "contact_cta");
  const faqHref = getSectionHref(safeContent.sections, "faq_grid");
  const headerNavItems: Array<{ key: HeaderNavKey; href: string; label: string; hasMega: boolean }> = [
    { key: "pos", href: featureHref, label: headerCopy.nav.posSystems, hasMega: true },
    { key: "orders", href: processHref, label: headerCopy.nav.orderSolutions, hasMega: true },
    { key: "business", href: credibilityHref, label: headerCopy.nav.businessSolutions, hasMega: true },
    { key: "corporate", href: "/blog", label: headerCopy.nav.corporate, hasMega: false },
    { key: "pricing", href: pricingHref, label: headerCopy.nav.pricing, hasMega: false },
  ];
  const heroShowcaseTabs: HeroShowcaseTab[] = [
    { href: featureHref, label: headerCopy.tabs.allInOnePos, caption: locale === "tr" ? "CLOUD POS CORE" : "CLOUD POS CORE" },
    { href: credibilityHref, label: headerCopy.tabs.boşsApp, caption: locale === "tr" ? "YONETIM PANELI" : "MANAGEMENT PANEL" },
    { href: processHref, label: headerCopy.tabs.staffManagement, caption: locale === "tr" ? "PERSONEL YONETIMI" : "STAFF MANAGEMENT" },
    { href: featureHref, label: headerCopy.tabs.qrOrdering, caption: locale === "tr" ? "QR VE SİPARİŞ" : "QR & ORDERING" },
    { href: pricingHref, label: headerCopy.tabs.kioskSolutions, caption: locale === "tr" ? "KIOSK COZUMLERI" : "KIOSK SOLUTIONS" },
  ];
  const megaMenus = useMemo(() => getHeaderMegaMenus(locale), [locale]);
  const activeMegaMenu = activeNavKey ? megaMenus[activeNavKey] : undefined;
  const supportHref = faqHref === "/" ? contactHref : faqHref;
  const safeHeroTabIndex = heroShowcaseTabs.length > 0 ? Math.min(activeHeroTab, heroShowcaseTabs.length - 1) : 0;
  const mainClass = isPreviewMode
    ? "mx-auto flex w-full max-w-none flex-col px-2 py-3 sm:px-3 sm:py-4 md:px-4 lg:px-6"
    : "mx-auto min-h-screen flex w-full max-w-7xl flex-col px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-10";

  return (
    <div className={`${isPreviewMode ? "" : "min-h-screen "}bg-[#f5f6f8] text-slate-900`}>
      <main className={mainClass}>
        <header className={`${isPreviewMode ? "relative" : "sticky top-2 z-30"} mb-4`}>
          <div
            className="relative overflow-visible rounded-[1.55rem] border border-white/85 bg-white/94 shadow-[0_20px_55px_rgba(15,23,42,0.12)] backdrop-blur-xl"
            onMouseLeave={() => setActiveNavKey(null)}
          >
            <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain p-1" />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black uppercase tracking-[0.12em] text-white">
                    {siteName.slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{siteName}</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{siteTagline}</p>
                </div>
              </Link>

              <nav className="ml-2 hidden items-center gap-1 xl:flex">
                {headerNavItems.map((item) =>
                  item.hasMega ? (
                    <button
                      key={item.key}
                      type="button"
                      onMouseEnter={() => setActiveNavKey(item.key)}
                      className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
                        activeNavKey === item.key
                          ? "bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)]"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span key={item.key} onMouseEnter={() => setActiveNavKey(null)}>
                      {renderHeaderNavLink(
                        { href: item.href, label: item.label },
                        editor?.previewMode,
                        "rounded-full px-4 py-2 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950",
                      )}
                    </span>
                  ),
                )}
              </nav>

              <div className="ml-auto hidden items-center gap-2 lg:flex">
                <LanguageSwitcher locale={locale} label={copy.localeSwitcher.label} compact />
                {renderHeaderActions(safeContent, headerCopy.requestDemoLabel, contactHref, editor?.previewMode)}
              </div>

              <div className="ml-auto lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm"
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="landing-mobile-menü"
                >
                  {headerCopy.menüLabel}
                </button>
              </div>
            </div>

            {isMobileMenuOpen ? (
              <div
                id="landing-mobile-menü"
                className="z-40 max-h-[calc(100vh-7rem)] overflow-y-auto border-t border-slate-200 p-3 lg:hidden"
              >
                <nav className="grid gap-2">
                  {headerNavItems.map((item) =>
                    renderHeaderNavLink(
                      { href: item.href, label: item.label },
                      editor?.previewMode,
                      "rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700",
                      () => setIsMobileMenuOpen(false),
                    ),
                  )}
                </nav>
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{headerCopy.solutionsLabel}</p>
                  {heroShowcaseTabs.map((item) =>
                    renderHeaderNavLink(
                      item,
                      editor?.previewMode,
                      "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700",
                      () => setIsMobileMenuOpen(false),
                    ),
                  )}
                  {renderHeaderNavLink(
                    { href: supportHref, label: headerCopy.stats.supportLabel },
                    editor?.previewMode,
                    "rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700",
                    () => setIsMobileMenuOpen(false),
                  )}
                </div>
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                  {renderHeaderActions(safeContent, headerCopy.requestDemoLabel, contactHref, editor?.previewMode, () => setIsMobileMenuOpen(false))}
                </div>
              </div>
            ) : null}

            {activeMegaMenu && !editor?.previewMode ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 hidden rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.14)] xl:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{activeMegaMenu.title}</p>
                <div className={`mt-4 grid gap-3 ${activeMegaMenu.cards.length > 4 ? "grid-cols-5" : "grid-cols-4"}`}>
                  {activeMegaMenu.cards.map((card) => (
                    <article key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">
                        {card.badge}
                      </div>
                      <p className="text-[1.35rem] font-semibold text-slate-900">{card.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    className="rounded-full bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
                  >
                    {activeMegaMenu.ctaLabel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {safeContent.sections.map((section) =>
          renderSection(section, settings, safeContent, leadStatus, safeContent.businessPhone, locale, editor, {
            tabs: heroShowcaseTabs,
            activeIndex: safeHeroTabIndex,
            setActiveIndex: setActiveHeroTab,
          }),
        )}

        <footer className="mt-6 rounded-[2rem] border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600 shadow-[0_14px_35px_rgba(15,23,42,0.06)] sm:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>{footerNote}</p>
            <p className="break-words">
              {contactPhone} {supportEmail ? `| ${supportEmail}` : ""}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
