import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const { user, usingDemoData } = await getCurrentUserWithRole();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Cloud POS Cafe";
  if (usingDemoData) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f3efe5_0%,#d7e4ea_45%,#f7f8fb_100%)] px-4 py-10">
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="inline-flex rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Demo Mode
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Giris Devre Disi</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
              Supabase env degerleri tanimli olmadigi icin personel oturumu acilmiyor. Canli veri ve rol bazli erisim
              icin `.env.local` ayarlarinin eksiksiz olmasi gerekiyor.
            </p>
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Beklenen alanlar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
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

      <div className="relative mx-auto flex w-full max-w-6xl justify-end">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
          >
            Ana Sayfa
          </Link>
          <Link
            href="/blog"
            className="rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
          >
            Blog
          </Link>
          <Link
            href="/demo"
            className="rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
          >
            Demo
          </Link>
        </div>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
              Staff Access
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-cyan-200/80">Cloud POS</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {businessName} ekibine hizli ve net giris.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Kasa, mutfak, servis ve yonetim ekranlari tek sistemde. Personel hesabinizla giris yapin, rolunuze ait
              operasyon alanlari otomatik acilsin.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Kasa</p>
                <p className="mt-2 text-sm text-slate-200">Odeme, vardiya ve gun sonu islemleri.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Mutfak</p>
                <p className="mt-2 text-sm text-slate-200">Canli siparis sirasi ve hazirlama takibi.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Yonetim</p>
                <p className="mt-2 text-sm text-slate-200">Urun, masa, rol ve rapor kontrolu.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Personel Girisi</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Hesabinizla devam edin</h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Sistem</p>
                <p className="text-sm font-semibold text-slate-900">Aktif</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              E-posta ve sifrenizi girin. Giris sonrasinda yetkinize uygun ekranlar otomatik yuklenir.
            </p>

            <div className="mt-8">
              <form action="/auth/login" method="post" className="space-y-4">
                <input type="hidden" name="next" value={next ?? "/ops"} />
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    E-posta
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    placeholder="ornek@isletme.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Sifre
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
                  Giris Yap
                </button>
                {error ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
                ) : null}
              </form>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Guvenlik</p>
                <p className="mt-2 text-sm text-slate-700">Rol bazli erisim ve oturum kontrolu aktif.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Durum</p>
                <p className="mt-2 text-sm text-slate-700">Supabase ile canli veri baglantisi kullaniliyor.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
