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

function wrapEditableSection(
  section: LandingSection,
  content: React.ReactNode,
  editor?: LandingRendererEditorOptions,
) {
  const isActive = editor?.activeSectionId === section.id;
  const containerClass =
    section.style.containerWidth === "narrow"
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
    return <div key={section.id}>{inner}</div>;
  }

  return (
    <div
      key={section.id}
      role="button"
      tabIndex={0}
      onClick={() => editor.onSelectSection?.(section.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editor.onSelectSection?.(section.id);
        }
      }}
      className={`group relative rounded-[2.25rem] transition ${
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

function renderHeaderActions(content: LandingContent, previewMode?: boolean) {
  if (previewMode) {
    return (
      <>
        <span className="rounded-2xl border border-slate-300 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 sm:px-4 sm:text-sm">
          {content.topLoginLabel}
        </span>
        <span className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">
          {content.topDemoLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="w-full rounded-2xl border border-slate-300 bg-white/70 px-3 py-2 text-center text-xs font-semibold text-slate-700 sm:w-auto sm:px-4 sm:text-sm">
        {content.topLoginLabel}
      </Link>
      <Link href="/demo" className="w-full rounded-2xl bg-slate-950 px-3 py-2 text-center text-xs font-semibold text-white sm:w-auto sm:px-4 sm:text-sm">
        {content.topDemoLabel}
      </Link>
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
  if (previewMode) {
    return (
      <>
        <span className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
          {section.primaryCtaLabel}
        </span>
        <span className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white">
          {section.secondaryCtaLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="w-full rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 sm:w-auto">
        {section.primaryCtaLabel}
      </Link>
      <Link href="/demo" className="w-full rounded-2xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white sm:w-auto">
        {section.secondaryCtaLabel}
      </Link>
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
) {
  const copy = getPublicCopy(locale);
  if (section.type === "hero") {
    return wrapEditableSection(
      section,
      <section className="grid flex-1 items-center gap-5 py-4 sm:py-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-10">
        <div className="rounded-[1.5rem] border border-[#1d1f2a] bg-[linear-gradient(160deg,#07111f_0%,#121f2f_44%,#231713_100%)] px-5 py-6 text-white shadow-[0_35px_90px_rgba(15,23,42,0.24)] sm:rounded-[2rem] sm:px-8 sm:py-10">
          <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
            {section.badge}
          </p>
          <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:mt-6 sm:text-4xl lg:text-5xl">{section.title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:mt-5 sm:text-base sm:leading-8">{section.body}</p>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">{renderHeroActions(section, editor?.previewMode)}</div>
        </div>
        <div className="grid gap-4">
          <div className="rounded-[1.5rem] border border-white/70 bg-white/82 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{copy.landing.heroAsideTitle}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {copy.landing.heroAsideBody}
            </p>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff8ee_0%,#f8fbfd_100%)] px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">{copy.landing.heroAsidePointA}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.landing.heroAsidePointABody}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff8ee_0%,#f8fbfd_100%)] px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">{copy.landing.heroAsidePointB}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.landing.heroAsidePointBBody}</p>
              </div>
            </div>
          </div>
        </div>
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
            className="rounded-[1.25rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.82)_100%)] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:rounded-[1.75rem] sm:p-6"
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
      <section className="rounded-[1.25rem] border border-slate-200 bg-white/88 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:rounded-[1.75rem] sm:p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {section.items.map((item, index) => (
            <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff9f1_0%,#f8fbfd_100%)] p-4">
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
                ? "border-slate-950 bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
                : "border-white/70 bg-white/82 shadow-[0_20px_60px_rgba(15,23,42,0.10)]"
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
      <section className="rounded-[1.5rem] border border-white/70 bg-white/78 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[2rem] sm:p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] bg-[linear-gradient(155deg,#0f172a_0%,#1f2937_100%)] px-5 py-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{section.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{section.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.references.map((item, index) => (
              <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_100%)] px-4 py-4 text-sm font-semibold text-slate-700">
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
            className="rounded-[1.25rem] border border-slate-200 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:rounded-[1.75rem] sm:p-6"
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f4efe3_0%,#dbe8f0_46%,#fbfbf8_100%)] text-slate-900">
      <div className="absolute left-[-7rem] top-[-6rem] h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="absolute bottom-[-7rem] right-[-5rem] h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_58%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-10">
        <header className="sticky top-0 z-20 -mx-3 mb-3 border-b border-white/50 bg-white/55 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:mx-0 md:flex md:items-center md:justify-between md:rounded-[2rem] md:border md:px-6">
          <div className="min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="mb-3 h-10 max-w-full rounded-lg object-contain" />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{siteName}</p>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{siteTagline}</h1>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <LanguageSwitcher locale={locale} label={copy.localeSwitcher.label} compact />
            {renderHeaderActions(safeContent, editor?.previewMode)}
          </div>
        </header>

        {safeContent.sections.map((section) => renderSection(section, settings, safeContent, leadStatus, safeContent.businessPhone, locale, editor))}

        <footer className="mt-6 rounded-[2rem] border border-white/70 bg-white/70 px-5 py-6 text-sm text-slate-600 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
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
