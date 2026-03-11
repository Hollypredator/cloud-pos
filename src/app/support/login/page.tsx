import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";
import { getSupportAccessByEmail } from "@/lib/domains/support";

export default async function SupportLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const { user, usingDemoData } = await getCurrentUserWithRole();

  if (usingDemoData) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Support Access</p>
          <h1 className="mt-4 text-4xl font-semibold">Supabase baglantisi olmadan support acilmaz</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">Support console canli auth ve tenant metadata ile calisir.</p>
        </div>
      </div>
    );
  }

  if (user?.email && (await getSupportAccessByEmail(user.email)).hasAccess) {
    redirect(next && next.startsWith("/") ? next : "/support");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#0f172a_0%,#101827_45%,#1f2937_100%)] px-4 py-10 text-white">
      <div className="absolute left-[-5rem] top-12 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
              Support
            </p>
            <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight">Musteri ve tenant destek konsolu</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
              Bu alan support ekiplerine aciktir. Tenant metadata, destek akisi ve erisim yonetimi burada toplanir.
            </p>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white p-8 text-slate-900 shadow-[0_25px_70px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Support Login</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Backoffice hesabinizla girin</h2>
              </div>
              <Link href="/" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
                Siteye Don
              </Link>
            </div>
            <form action="/auth/login" method="post" className="mt-8 space-y-4">
              <input type="hidden" name="next" value={next ?? "/support"} />
              <div className="space-y-2">
                <label htmlFor="support-email" className="text-sm font-medium text-slate-700">E-posta</label>
                <input id="support-email" type="email" name="email" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="support-password" className="text-sm font-medium text-slate-700">Sifre</label>
                <input id="support-password" type="password" name="password" required className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                Support Girisi
              </button>
              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}


