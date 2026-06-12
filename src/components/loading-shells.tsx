"use client";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export function PublicPageLoadingShell() {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f4efe3_0%,#dbe8f0_46%,#fbfbf8_100%)] px-3 py-4 sm:px-4 sm:py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-8 w-64 sm:w-80" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-24" />
            <SkeletonBlock className="h-10 w-24" />
          </div>
        </div>
        <SkeletonBlock className="h-[240px] w-full sm:h-[320px]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonBlock className="h-40 w-full" />
          <SkeletonBlock className="h-40 w-full" />
          <SkeletonBlock className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

export function LoginLoadingShell() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden space-y-5 lg:block">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-20 w-3/4" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-56 w-full rounded-[2rem]" />
        </div>
        <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/12 sm:p-8">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-10 w-56" />
            <SkeletonBlock className="h-4 w-full" />
          </div>
          <div className="mt-8 space-y-4">
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BackofficeLoadingShell() {
  return (
    <div className="min-h-screen bg-[#e9eaee] px-3 py-4 md:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 xl:flex-row">
        <aside className="hidden w-[320px] xl:block">
          <div className="space-y-5">
            <SkeletonBlock className="h-64 w-full rounded-[28px]" />
            <SkeletonBlock className="h-72 w-full rounded-[28px]" />
          </div>
        </aside>
        <section className="min-w-0 flex-1 space-y-5">
          <div className="rounded-[24px] bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] sm:p-6">
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="mt-3 h-10 w-72" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SkeletonBlock className="h-32 w-full rounded-[24px]" />
            <SkeletonBlock className="h-32 w-full rounded-[24px]" />
            <SkeletonBlock className="h-32 w-full rounded-[24px]" />
            <SkeletonBlock className="h-32 w-full rounded-[24px]" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <SkeletonBlock className="h-[320px] w-full rounded-[28px]" />
            <div className="space-y-5">
              <SkeletonBlock className="h-[150px] w-full rounded-[28px]" />
              <SkeletonBlock className="h-[150px] w-full rounded-[28px]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
