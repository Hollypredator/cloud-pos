import Link from "next/link";
import { LandingContactCard } from "@/components/landing-contact-card";
import type { GeneralSettings } from "@/lib/app-settings";
import type { LandingContent, LandingSection, LandingSectionStyle } from "@/lib/site-content";

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
        <span className="rounded-2xl border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700">
          {content.topLoginLabel}
        </span>
        <span className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          {content.topDemoLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="rounded-2xl border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700">
        {content.topLoginLabel}
      </Link>
      <Link href="/demo" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
        {content.topDemoLabel}
      </Link>
    </>
  );
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
      <Link href="/login" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
        {section.primaryCtaLabel}
      </Link>
      <Link href="/demo" className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white">
        {section.secondaryCtaLabel}
      </Link>
    </>
  );
}

function renderSection(
  section: LandingSection,
  settings: GeneralSettings,
  leadStatus?: string,
  businessPhone?: string,
  editor?: LandingRendererEditorOptions,
) {
  if (section.type === "hero") {
    return wrapEditableSection(
      section,
      <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_35px_90px_rgba(15,23,42,0.18)]">
          <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
            {section.badge}
          </p>
          <h2 className="mt-6 max-w-2xl text-5xl font-semibold leading-tight tracking-tight">{section.title}</h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">{section.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">{renderHeroActions(section, editor?.previewMode)}</div>
        </div>
      </section>,
      editor,
    );
  }

  if (section.type === "feature_grid") {
    return wrapEditableSection(
      section,
      <section className="grid gap-4 py-4 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{item.title}</p>
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
      <section className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {section.items.map((item, index) => (
            <div key={`${section.id}-${index}`} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
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
      <section className="grid gap-4 py-4 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className="rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)] backdrop-blur"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{item.name}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.price}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.summary}</p>
          </article>
        ))}
      </section>,
      editor,
    );
  }

  if (section.type === "credibility") {
    return wrapEditableSection(
      section,
      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{section.eyebrow}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h3 className="text-3xl font-semibold tracking-tight text-slate-900">{section.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{section.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.references.map((item, index) => (
              <div key={`${section.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
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
      <section className="grid gap-4 py-6 lg:grid-cols-3">
        {section.items.map((item, index) => (
          <article
            key={`${section.id}-${index}`}
            className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
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
    />,
    editor,
  );
}

export function LandingPageRenderer({
  content,
  settings,
  leadStatus,
  editor,
}: {
  content: LandingContent;
  settings: GeneralSettings;
  leadStatus?: string;
  editor?: LandingRendererEditorOptions;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f4efe3_0%,#dbe8f0_46%,#fbfbf8_100%)] text-slate-900">
      <div className="absolute left-[-7rem] top-[-6rem] h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="absolute bottom-[-7rem] right-[-5rem] h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 py-4">
          <div>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="mb-3 h-10 w-auto rounded-lg object-contain" />
            ) : null}
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{settings.siteName}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{settings.siteTagline}</h1>
          </div>
          <div className="flex items-center gap-3">{renderHeaderActions(content, editor?.previewMode)}</div>
        </header>

        {content.sections.map((section) => renderSection(section, settings, leadStatus, content.businessPhone, editor))}

        <footer className="border-t border-white/70 py-6 text-sm text-slate-600">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>{settings.footerNote}</p>
            <p>
              {settings.contactPhone} {settings.supportEmail ? `| ${settings.supportEmail}` : ""}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
