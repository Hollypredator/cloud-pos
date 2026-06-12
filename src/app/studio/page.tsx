import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Image, Palette, Settings, Sparkles, Users } from "lucide-react";
import { requireStudioAccess } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/lib/data";

const studioAreas = [
  { href: "/studio/content", title: "Landing içerikleri", body: "Ana sayfa metinleri, CTA ve ürün anlatımını düzenleyin.", icon: FileText },
  { href: "/studio/demo", title: "Demo sayfası", body: "Demo akışı, örnek hesaplar ve ürün turu içeriklerini yönetin.", icon: Sparkles },
  { href: "/studio/settings", title: "Marka ayarları", body: "Logo, iletişim, site başlığı ve genel marka ayarları.", icon: Settings },
  { href: "/studio/media", title: "Medya kütüphanesi", body: "Gerçek ürün görselleri ve site medyalarını düzenleyin.", icon: Image },
  { href: "/studio/seo", title: "SEO", body: "Arama görünürlüğü ve sosyal paylaşım bilgileri.", icon: Palette },
  { href: "/studio/leads", title: "Lead takibi", body: "Demo ve iletişim taleplerini tek yerden izleyin.", icon: Users },
];

export default async function StudioIndexPage() {
  await requireStudioAccess("/studio");
  const snapshot = await getOnboardingSnapshot();
  const completed = snapshot.checklist.filter((item) => item.done).length;
  const total = snapshot.checklist.length || 1;
  const progress = Math.round((completed / total) * 100);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Cloud POS Studio</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Ürün vitrini, demo ve marka yönetimi için kontrol merkezi.
            </h1>
            <p className="mt-5 max-w-2xl text-base leadıng-8 text-slate-300">
              Landing page, demo sayfası, medya, SEO, lead ve marka ayarlarını yeni Cloud POS ürün diliyle aynı yerden yönetin.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/studio/content" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-50">
                İçerikleri düzenle
                <ArrowRight size={18} />
              </Link>
              <Link href="/" className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                Landing’i görüntüle
              </Link>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Kurulum ilerlemesi</p>
            <p className="mt-4 text-5xl font-bold">{completed}/{snapshot.checklist.length}</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-emerald-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-sm leadıng-6 text-slate-300">Marka, SEO, medya, demo ve operasyon kurulum adımlarının durumu.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {studioAreas.map((area) => {
          const Icon = area.icon;
          return (
            <Link key={area.href} href={area.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <Icon size={22} />
              </div>
              <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-950">{area.title}</h2>
              <p className="mt-3 text-sm leadıng-7 text-slate-600">{area.body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-950 group-hover:text-orange-700">
                Aç
                <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Kurulum listesi</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Eksik alanları tamamlayın.</h2>
          </div>
          <Link href="/studio/onboarding" className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
            Wizard’a git
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {snapshot.checklist.slice(0, 6).map((item) => (
            <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#f7f8fb] px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className={item.done ? "text-emerald-600" : "text-slate-400"} />
                <span className="text-sm font-bold text-slate-800">{item.title}</span>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
                {item.done ? "Hazır" : "Eksik"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
