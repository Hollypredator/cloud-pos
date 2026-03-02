"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPlanLabel } from "@/lib/features";
import type { BusinessPlan } from "@/lib/types";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function BackofficePage({
  title,
  description,
  sidebar,
  children,
  actions,
}: {
  title: string;
  description?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#e9eaee] px-3 py-4 md:px-6">
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 xl:flex-row">
        {sidebar ? <aside className="min-w-0 w-full xl:w-[320px]">{sidebar}</aside> : null}
        <section className="min-w-0 flex-1 space-y-5">
          <div className="panel-surface mesh-accent rounded-[24px] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{description}</p>
                <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
              </div>
              {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">{actions}</div> : null}
            </div>
          </div>
          {children}
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
  return (
    <section className="panel-surface panel-hover rounded-[28px] p-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-display text-[1.45rem] font-semibold tracking-tight text-slate-900">{title}</h2>
        {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="space-y-4 pt-4">{children}</div>
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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "danger" | "accent";
}) {
  const toneStyles = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-rose-100 text-rose-700",
    accent: "bg-orange-100 text-orange-700",
  };

  return (
    <article className="panel-surface panel-hover mesh-accent rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="font-display font-numeric mt-4 text-[1.8rem] font-semibold tracking-tight text-slate-900 sm:mt-5 sm:text-[2rem]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
        </div>
        <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold", toneStyles[tone])}>
          {label.slice(0, 2).toUpperCase()}
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
  return (
    <div className="flex snap-x gap-3 overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_10px_20px_rgba(15,23,42,0.04)] md:grid md:grid-cols-4 md:overflow-visible">
      {tabs.map((tab) => {
        const className = cn(
          "min-w-[220px] snap-start rounded-2xl px-4 py-4 text-center text-base font-semibold transition md:min-w-0",
          tab.active
            ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        );

        return tab.href ? (
          <Link key={tab.label} href={tab.href} className={className}>
            {tab.label}
          </Link>
        ) : (
          <div key={tab.label} className={className}>
            {tab.label}
          </div>
        );
      })}
    </div>
  );
}

export function ContentCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-surface panel-hover rounded-[28px] p-5">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      <div className="pt-4">{children}</div>
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
  const toneStyles = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-rose-200 bg-rose-50 text-rose-950",
  };

  return (
    <div className={cn("rounded-[24px] border px-5 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]", toneStyles[tone])}>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
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
  return (
    <ContentCard title={`${title} Kilitli`}>
      <div className="space-y-4">
        <NoticeBanner
          tone="warning"
          title={`${getPlanLabel(requiredPlan)} paket gerekiyor`}
          description={description}
        />
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
          Mevcut paket: <span className="font-semibold text-slate-900">{getPlanLabel(currentPlan)}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={actionHref}
            className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white"
          >
            Paket Bilgisini Gor
          </Link>
          <Link
            href="/ops"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
          >
            Operasyona Don
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
}: {
  title: string;
  description?: string;
  steps: Array<{ title: string; description: string }>;
}) {
  return (
    <section className="panel-surface panel-hover rounded-[28px] p-5">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h3>
        {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="space-y-3 pt-4">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="font-display inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-sm font-semibold text-white shadow-[0_10px_18px_rgba(255,106,61,0.18)]">
                {index + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-500">{step.description}</p>
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
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600">
        --
      </div>
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{title}</p>
      <p className="mt-3 max-w-xl text-base text-slate-500">{description}</p>
    </div>
  );
}

export function WorkspaceTabs({
  tabs,
}: {
  tabs: Array<{ href?: string; label: string; active?: boolean }>;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-slate-200 px-2 sm:gap-6">
      {tabs.map((tab) => {
        const className = cn(
          "shrink-0 whitespace-nowrap border-b-2 px-2 pb-4 pt-1 text-base font-medium transition sm:text-[1.1rem]",
          tab.active ? "border-[#ff5a34] text-[#ff5a34]" : "border-transparent text-slate-500 hover:text-slate-900",
        );

        return tab.href ? (
          <Link key={tab.label} href={tab.href} className={className}>
            {tab.label}
          </Link>
        ) : (
          <div key={tab.label} className={className}>
            {tab.label}
          </div>
        );
      })}
    </div>
  );
}

export function AppShellHeader() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700">
        {"<-"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{pathname}</p>
        <p className="text-lg font-semibold tracking-tight text-slate-900">Operasyon paneli</p>
      </div>
    </div>
  );
}
