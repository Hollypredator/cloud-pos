import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowRight, LockKeyhole, MonitorSmartphone, ShieldCheck, Store } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DashboardMock } from "@/components/marketing-mocks";
import { StaffLoginForm } from "@/components/staff-login-form";
import { getCurrentUserWithRole } from "@/lib/auth";
import { isLikelyMobileUserAgent } from "@/lib/device";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getPublicCopy } from "@/lib/i18n";

const LOGIN_AUTH_CHECK_BUDGET_MS = 500;

async function getCurrentUserWithLoginBudget() {
  try {
    return await Promise.race([
      getCurrentUserWithRole(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), LOGIN_AUTH_CHECK_BUDGET_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; force?: string }>;
}) {
  const { next, error, force } = await searchParams;
  const headerStore = await headers();
  const defaultNext = isLikelyMobileUserAgent(headerStore.get("user-agent")) ? "/m/ops" : "/ops";
  const resolvedNext = next?.startsWith("/") ? next : defaultNext;
  const locale = await getCurrentLocale();
  const copy = getPublicCopy(locale);
  const authContext = await getCurrentUserWithLoginBudget();
  const user = authContext?.user ?? null;
  const usingDemoData = Boolean(authContext?.usingDemoData);

  if (usingDemoData) {
    return (
      <main className="min-h-screen bg-[#f7f8fb] px-4 py-10 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
          <section className="rounded-[2rem] border border-orange-200 bg-white p-7 shadow-2xl shadow-orange-500/10 sm:p-10">
            <p className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
              Demo modu
            </p>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Giriş geçici olarak kapalı.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Canlı rol bazlı erişim için Supabase ortam değişkenleri tamamlanmalı.
            </p>
            <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-950">
              Beklenen alanlar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (user && force !== "1") {
    redirect(resolvedNext);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8fb] text-slate-950">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_18%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(79,70,229,0.14),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(16,185,129,0.12),transparent_26%)]" />

      <header className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-orange-500/20">
              Q
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-950">QUAPOS</p>
              <p className="hidden text-xs font-semibold text-slate-500 sm:block">Operasyon paneli girişi</p>
            </div>
          </Link>
          <nav className="ml-8 hidden items-center gap-6 text-sm font-bold text-slate-600 lg:flex">
            <Link href="/" className="transition hover:text-orange-600">Ürün</Link>
            <Link href="/demo" className="transition hover:text-orange-600">Demo</Link>
            <Link href="/blog" className="transition hover:text-orange-600">Blog</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher locale={locale} label={copy.localeSwitcher.label} compact />
            <Link href="/demo" className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-orange-300 hover:text-orange-700 sm:inline-flex">
              Demo
            </Link>
            <Link href="/" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800">
              Ürün sayfası
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <p className="inline-flex w-fit rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
            Güvenli personel erişimi
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Operasyon paneline hızlı ve güvenli giriş.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
            QUAPOS; self servis, kafe-restoran operasyonu, mutfak, kasa, stok, rapor ve mobil PWA ekranlarını rol bazlı girişten sonra açar.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Store, title: "Restoran POS", body: "Masa, sipariş, kasa" },
              { icon: MonitorSmartphone, title: "Mobil PWA", body: "Saha ekipleri için" },
              { icon: ShieldCheck, title: "Rol bazlı", body: "Yetkili ekranlar" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl border border-white bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur">
                  <Icon size={22} className="text-orange-600" />
                  <p className="mt-3 text-sm font-bold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{item.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 hidden lg:block">
            <DashboardMock />
          </div>
        </div>

        <div className="flex items-center">
          <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/12 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <LockKeyhole size={22} />
                </div>
                <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-orange-600">Operasyon Paneli</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Hesabınızla giriş yapın.</h2>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-left sm:text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Sistem</p>
                <p className="text-sm font-bold text-emerald-800">Aktif</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-600">
              E-posta ve şifrenizi girin. Girişten sonra rolünüze uygun operasyon ekranı otomatik açılır.
            </p>

            <div className="mt-8">
              <StaffLoginForm
                next={resolvedNext}
                error={error}
                labels={{
                  email: "E-posta",
                  emailPlaceholder: "Örnek@quapos.com",
                  password: "Şifre",
                  loginCta: "Operasyon Paneli Giriş",
                  pendingCta: "Giriş yapılıyor...",
                }}
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-[#f7f8fb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Güvenlik</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Oturum, rol ve yönlendirme kontrolleri sunucu tarafında korunur.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f7f8fb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Hedef</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Mobil kullanıcılar PWA operasyonuna, masaüstü kullanıcılar yönetim paneline gider.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
