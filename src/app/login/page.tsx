import { redirect } from "next/navigation";
import { PublicTopNav } from "@/components/public-top-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentUserWithRole } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getPublicCopy } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const locale = await getCurrentLocale();
  const copy = getPublicCopy(locale);
  const { user, usingDemoData } = await getCurrentUserWithRole();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Cloud POS Cafe";
  if (usingDemoData) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f3efe5_0%,#d7e4ea_45%,#f7f8fb_100%)] px-4 py-10">
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
            <div className="inline-flex rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {copy.login.demoMode}
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.login.accessDisabled}</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
              {copy.login.accessDisabledBody}
            </p>
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              {copy.login.expectedFields}: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
              `SUPABASE_SERVICE_ROLE_KEY`
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    redirect("/ops");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#f5f1e8_0%,#e4edf4_40%,#fafaf8_100%)] px-4 py-10">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,#fff6d7_0%,transparent_65%)]" />
      <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="absolute bottom-[-4rem] right-[-4rem] h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LanguageSwitcher locale={locale} label={copy.localeSwitcher.label} />
        <PublicTopNav items={[{ href: "/", label: copy.login.home }, { href: "/blog", label: copy.login.blog }, { href: "/demo", label: copy.login.demo }]} locale={locale} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="hidden rounded-[2rem] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] lg:block">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
              {copy.login.staffAccess}
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-cyan-200/80">Cloud POS</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {businessName} {copy.login.leftTitleSuffix}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              {copy.login.leftBody}
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{copy.login.cashier}</p>
                <p className="mt-2 text-sm text-slate-200">{copy.login.cashierBody}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{copy.login.kitchen}</p>
                <p className="mt-2 text-sm text-slate-200">{copy.login.kitchenBody}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{copy.login.management}</p>
                <p className="mt-2 text-sm text-slate-200">{copy.login.managementBody}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/92 p-5 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:rounded-[2rem] sm:p-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">{copy.login.panelTitle}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{copy.login.panelHeading}</h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-left sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{copy.login.system}</p>
                <p className="text-sm font-semibold text-slate-900">{copy.login.active}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {copy.login.panelBody}
            </p>

            <div className="mt-8">
              <form action="/auth/login" method="post" className="space-y-4">
                <input type="hidden" name="next" value={next ?? "/ops"} />
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    {copy.login.email}
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    placeholder={copy.login.emailPlaceholder}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    {copy.login.password}
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {copy.login.loginCta}
                </button>
                {error ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
                ) : null}
              </form>
            </div>

            <div className="mt-8 hidden gap-3 sm:grid-cols-2 lg:grid">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{copy.login.security}</p>
                <p className="mt-2 text-sm text-slate-700">{copy.login.securityBody}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{copy.login.status}</p>
                <p className="mt-2 text-sm text-slate-700">{copy.login.statusBody}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
