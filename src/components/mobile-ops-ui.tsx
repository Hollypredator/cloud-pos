import Link from "next/link";
import { type ReactNode } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function MobileTaskList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("app-mobile-only space-y-3.5", className)}>{children}</section>;
}

export function MobileTaskCard({
  title,
  subtitle,
  children,
  className,
  tone = "neutral",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/30 text-rose-950 uupm-glow-danger"
      : tone === "warning"
        ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/30 text-amber-950 uupm-glow-warning"
        : tone === "success"
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/30 text-emerald-950 uupm-glow-success"
          : "border-white/20 uupm-liquid-glass shadow-sm";

  return (
    <article className={cn("mobile-task-card uupm-card-interactive rounded-3xl border p-4.5", toneClass, className)}>
      {title ? <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">{title}</p> : null}
      {subtitle ? <p className="mt-1 text-[1.05rem] font-bold tracking-tight text-slate-900">{subtitle}</p> : null}
      <div className={cn(title || subtitle ? "mt-3.5" : "")}>{children}</div>
    </article>
  );
}

export type MobileSegmentItem = {
  href: string;
  label: string;
  active: boolean;
  badge?: string;
};

export function MobileStickySegment({
  items,
  className,
}: {
  items: MobileSegmentItem[];
  className?: string;
}) {
  return (
    <div className={cn("mobile-task-tabs uupm-liquid-glass border-white/20 p-1.5 rounded-2xl shadow-sm", className)}>
      {items.map((item) => (
        <Link 
          key={item.href} 
          href={item.href} 
          data-active={item.active} 
          className="mobile-task-tab rounded-xl transition-all duration-200 active:scale-95 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2.5"
        >
          {item.label}
          {item.badge ? ` (${item.badge})` : ""}
        </Link>
      ))}
    </div>
  );
}

export function MobileFullScreenFlow({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description?: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-mobile-only fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-y-auto bg-slate-50 px-3 pb-[calc(106px+var(--safe-area-bottom))] pt-[calc(82px+var(--safe-area-top))]">
        <header className="sticky top-0 z-10 uupm-liquid-glass rounded-2xl border border-white/40 px-4.5 py-4 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-400">Flow Yönetimi</p>
              <h2 className="mt-1 text-[1.15rem] font-extrabold tracking-tight text-slate-900">{title}</h2>
              {description ? <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-normal">{description}</p> : null}
            </div>
            <Link
              href={closeHref}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-900 text-white px-4 text-xs font-bold transition-all active:scale-95 shadow-md shadow-slate-950/15"
            >
              Kapat
            </Link>
          </div>
        </header>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function MobileEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1.5 text-xs font-medium text-slate-400 leading-relaxed max-w-[240px]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function MobileSkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="mobile-task-card rounded-3xl border border-white/20 uupm-liquid-glass p-4.5 space-y-3">
      <div className="skeleton h-3 w-16" />
      <div className="skeleton h-4 w-3/4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3 w-full" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function MobileSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <MobileSkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

export function MobileSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mobile-task-card rounded-3xl border border-white/20 uupm-liquid-glass p-3.5 space-y-2.5">
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="skeleton h-3 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

