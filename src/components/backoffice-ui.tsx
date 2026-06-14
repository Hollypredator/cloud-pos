"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPlanLabel } from "@/lib/features";
import { normalizeLocale, translateUiText } from "@/lib/i18n";
import type { BusinessPlan } from "@/lib/types";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getLocale() {
  return normalizeLocale(typeof document !== "undefined" ? document.documentElement.lang : "tr");
}

export function BackofficePage({
  title,
  description,
  sidebar,
  children,
  actions,
  minimal = false,
}: {
  title: string;
  description?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  minimal?: boolean;
}) {
  const locale = getLocale();
  return (
    <div className={cn(
      "backoffice-page-shell relative min-h-screen overflow-x-clip bg-[#f3f5f8]",
      minimal ? "px-0 py-0" : "px-3 py-4 md:px-6"
    )}>
      <main className={cn(
        "backoffice-page-main relative z-10 mx-auto flex w-full flex-col gap-5",
        minimal ? "max-w-full" : "max-w-[1600px] xl:flex-row"
      )}>
        {sidebar && !minimal ? <aside className="backoffice-page-sidebar min-w-0 w-full xl:w-[320px]">{sidebar}</aside> : null}
        <section className={cn("backoffice-page-content min-w-0 flex-1", minimal ? "" : "space-y-5")}>
          {!minimal && (
            <div className="backoffice-page-hero rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{description ? translateUiText(description, locale) : description}</p>
                  <h1 className="font-display mt-1 text-[1.55rem] font-semibold tracking-tight text-slate-950 sm:text-[1.8rem]">{translateUiText(title, locale)}</h1>
                </div>
                {actions ? <div className="backoffice-page-actions flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">{actions}</div> : null}
              </div>
            </div>
          )}
          {minimal ? <div className="space-y-5 p-3 md:p-6">{children}</div> : children}
        </section>
      </main>
    </div>
  );
}

export function SidebarPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const locale = getLocale();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-display text-[1.15rem] font-semibold tracking-tight text-slate-950">{translateUiText(title, locale)}</h2>
        {description ? <p className="mt-2 text-sm text-slate-500">{translateUiText(description, locale)}</p> : null}
      </div>
      <div className="space-y-3 pt-3">{children}</div>
    </section>
  );
}

export function FilterButton({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-orange-300 bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

export function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "danger" | "accent";
  className?: string;
}) {
  const locale = getLocale();
  const toneStyles = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-rose-100 text-rose-700",
    accent: "bg-orange-100 text-orange-700",
  };

  return (
    <article className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText(label, locale)}</p>
          <p className="font-display font-numeric mt-3 text-[1.65rem] font-semibold tracking-tight text-slate-950 sm:text-[1.9rem]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-500">{translateUiText(hint, locale)}</p> : null}
        </div>
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold", toneStyles[tone])}>
          {translateUiText(label, locale).slice(0, 2).toUpperCase()}
        </span>
      </div>
    </article>
  );
}

export function SegmentedTabs({
  tabs,
}: {
  tabs: Array<{ href?: string; label: string; active?: boolean }>;
}) {
  const locale = getLocale();
  return (
    <div className="flex flex-wrap gap-3 rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
      {tabs.map((tab) => {
        const className = cn(
          "rounded-2xl px-6 py-4 text-center text-sm sm:text-base font-semibold transition flex-1 sm:flex-none",
          tab.active
            ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        );

        return tab.href ? (
          <Link key={tab.label} href={tab.href} prefetch scroll={false} className={className}>
            {translateUiText(tab.label, locale)}
          </Link>
        ) : (
          <div key={tab.label} className={className}>
            {translateUiText(tab.label, locale)}
          </div>
        );
      })}
    </div>
  );
}

export function ContentCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const locale = getLocale();
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="border-b border-slate-100 pb-3">
        <h3 className="font-display text-[1.35rem] font-semibold tracking-tight text-slate-950">{translateUiText(title, locale)}</h3>
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

export function NoticeBanner({
  tone = "info",
  title,
  description,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
}) {
  const locale = getLocale();
  const toneStyles = {
    info: "border-sky-200/60 bg-sky-50/70 text-sky-950",
    success: "border-emerald-200/60 bg-emerald-50/70 text-emerald-950",
    warning: "border-amber-200/60 bg-amber-50/70 text-amber-950",
    error: "border-rose-200/60 bg-rose-50/70 text-rose-950",
  };

  return (
    <div className={cn("rounded-[24px] border px-5 py-4 shadow-[0_8px_20px_rgb(0,0,0,0.03)] backdrop-blur-md transition-all duration-300", toneStyles[tone])}>
      <p className="text-base font-semibold tracking-tight">{translateUiText(title, locale)}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{translateUiText(description, locale)}</p> : null}
    </div>
  );
}

export function FeatureLockedState({
  title,
  description,
  currentPlan,
  requiredPlan,
  actionHref = "/admin/settings",
}: {
  title: string;
  description: string;
  currentPlan: BusinessPlan;
  requiredPlan: BusinessPlan;
  actionHref?: string;
}) {
  const locale = getLocale();
  return (
    <ContentCard title={`${translateUiText(title, locale)} ${translateUiText("Kilitli", locale)}`}>
      <div className="space-y-4">
        <NoticeBanner
          tone="warning"
          title={`${getPlanLabel(requiredPlan)} ${translateUiText("paket gerekiyor", locale)}`}
          description={description}
        />
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
          {translateUiText("Mevcut paket:", locale)} <span className="font-semibold text-slate-900">{getPlanLabel(currentPlan)}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={actionHref}
            className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white"
          >
            {translateUiText("Paket Bilgisini Gör", locale)}
          </Link>
          <Link
            href="/ops"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
          >
            {translateUiText("Operasyona Dön", locale)}
          </Link>
        </div>
      </div>
    </ContentCard>
  );
}

export function WorkflowGuide({
  title,
  description,
  steps,
  className,
}: {
  title: string;
  description?: string;
  steps: Array<{ title: string; description: string }>;
  className?: string;
}) {
  const locale = getLocale();
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="border-b border-slate-100 pb-3">
        <h3 className="font-display text-[1.25rem] font-semibold tracking-tight text-slate-950">{translateUiText(title, locale)}</h3>
        {description ? <p className="mt-2 text-sm text-slate-500">{translateUiText(description, locale)}</p> : null}
      </div>
      <div className="space-y-2.5 pt-3">
        {steps.map((step, index) => (
          <div key={step.title} className="group rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-white">
            <div className="flex items-start gap-3">
              <span className="font-display inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{translateUiText(step.title, locale)}</p>
                <p className="mt-1 text-sm text-slate-500">{translateUiText(step.description, locale)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const locale = getLocale();
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300/60 bg-white/40 px-6 py-10 text-center backdrop-blur-md">
      <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600">
        --
      </div>
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{translateUiText(title, locale)}</p>
      <p className="mt-3 max-w-xl text-base text-slate-500">{translateUiText(description, locale)}</p>
    </div>
  );
}

export function WorkspaceTabs({
  tabs,
}: {
  tabs: Array<{ href?: string; label: string; active?: boolean }>;
}) {
  const locale = getLocale();
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 px-2 sm:gap-6">
      {tabs.map((tab) => {
        const className = cn(
          "shrink-0 whitespace-nowrap border-b-2 px-2 pb-4 pt-1 text-base font-medium transition sm:text-[1.1rem]",
          tab.active ? "border-[#ff5a34] text-[#ff5a34]" : "border-transparent text-slate-500 hover:text-slate-900",
        );

        return tab.href ? (
          <Link key={tab.label} href={tab.href} prefetch scroll={false} className={className}>
            {translateUiText(tab.label, locale)}
          </Link>
        ) : (
          <div key={tab.label} className={className}>
            {translateUiText(tab.label, locale)}
          </div>
        );
      })}
    </div>
  );
}

export function AppShellHeader() {
  const pathname = usePathname();
  const locale = getLocale();

  return (
    <div className="flex items-center gap-3 rounded-[24px] border border-white/60 bg-white/70 px-5 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:bg-white/90 hover:shadow-[0_10px_40px_rgb(0,0,0,0.06)]">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/50 bg-white/60 text-lg font-semibold text-slate-700 shadow-sm">
        {"<-"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{pathname}</p>
        <p className="text-lg font-semibold tracking-tight text-slate-900">{translateUiText("Operasyon Paneli", locale)}</p>
      </div>
    </div>
  );
}
