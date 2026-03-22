import Link from "next/link";

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
  return <section className={cn("app-mobile-only space-y-2.5", className)}>{children}</section>;
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
      ? "border-rose-300 bg-rose-50"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white";

  return (
    <article className={cn("mobile-task-card rounded-[18px] border p-3.5", toneClass, className)}>
      {title ? <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p> : null}
      {subtitle ? <p className="mt-1 text-[0.98rem] font-semibold tracking-tight text-slate-900">{subtitle}</p> : null}
      <div className={cn(title || subtitle ? "mt-3" : "")}>{children}</div>
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
    <div className={cn("mobile-task-tabs", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} data-active={item.active} className="mobile-task-tab">
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
    <div className="app-mobile-only fixed inset-0 z-[70] bg-slate-950/35">
      <div className="absolute inset-0 overflow-y-auto bg-[#eef1f5] px-3 pb-[calc(96px+var(--safe-area-bottom))] pt-[calc(72px+var(--safe-area-top))]">
        <header className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Task Flow</p>
              <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-slate-900">{title}</h2>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            <Link
              href={closeHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
            >
              Kapat
            </Link>
          </div>
        </header>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}
