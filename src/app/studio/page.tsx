import Link from "next/link";
import { 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Image as ImageIcon, 
  Palette, 
  Settings, 
  Sparkles, 
  Users, 
  Activity, 
  Sparkle 
} from "lucide-react";
import { requireStudioAccess } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/lib/data";

const studioAreas = [
  { 
    href: "/studio/content", 
    title: "Landing İçerikleri", 
    body: "Ana sayfa metinleri, etkileyici CTA butonları ve ürün hikayesini yönetin.", 
    icon: FileText,
    accent: "orange" 
  },
  { 
    href: "/studio/demo", 
    title: "Canlı Demo Sayfası", 
    body: "Demo akış senaryoları, örnek POS hesapları ve interaktif rehberler.", 
    icon: Sparkles,
    accent: "amber" 
  },
  { 
    href: "/studio/settings", 
    title: "Marka & Kurumsal Ayarlar", 
    body: "Logolar, iletişim kanalları, favicon, site başlığı ve kurumsal kimlik.", 
    icon: Settings,
    accent: "indigo" 
  },
  { 
    href: "/studio/media", 
    title: "Medya & Görsel Havuzu", 
    body: "Yüksek kaliteli ürün görselleri, ekran görüntüleri ve site varlıkları.", 
    icon: ImageIcon,
    accent: "emerald" 
  },
  { 
    href: "/studio/seo", 
    title: "Arama Görünürlüğü (SEO)", 
    body: "Sayfa meta etiketleri, sitemap ayarları ve sosyal medya paylaşım kartları.", 
    icon: Palette,
    accent: "cyan" 
  },
  { 
    href: "/studio/leads", 
    title: "Lead & Talep Takibi", 
    body: "Gelen demo istekleri, kurumsal teklifler ve müşteri iletişim kayıtları.", 
    icon: Users,
    accent: "rose" 
  },
];

export default async function StudioIndexPage() {
  await requireStudioAccess("/studio");
  const snapshot = await getOnboardingSnapshot();
  const completed = snapshot.checklist.filter((item) => item.done).length;
  const total = snapshot.checklist.length || 1;
  const progress = Math.round((completed / total) * 100);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-8">
      
      {/* Studio Header Cockpit */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-2xl shadow-slate-950/20">
        {/* Decorative Grid Mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
              <Sparkle size={12} className="animate-spin text-orange-400" />
              Cloud POS Studio
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              Marka ve Dijital Vitrin Yönetimi
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
              Landing page içerikleri, interaktif demo adımları, marka varlıkları, SEO ve lead operasyonlarını modern Cloud POS standartlarıyla tek merkezden yönetin.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link 
                href="/studio/content" 
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition-all duration-300 hover:bg-orange-50 hover:shadow-lg hover:shadow-white/10"
              >
                İçerikleri Düzenle
                <ArrowRight size={16} />
              </Link>
              <Link 
                href="/" 
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:bg-white/10 hover:border-white/20"
              >
                Vitrini Görüntüle
              </Link>
            </div>
          </div>
          
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 block">Kurulum İlerlemesi</span>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-5xl font-black text-white tracking-tight">{completed}</p>
              <span className="text-slate-400 text-lg font-bold">/ {snapshot.checklist.length} Adım</span>
            </div>
            <div className="mt-6 h-3.5 overflow-hidden rounded-full bg-white/10 p-0.5 border border-white/5">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Marka kimliği, içerikler, SEO ve operasyonel modüllerin canlıya geçiş hazırlık skoru.
            </p>
          </div>
        </div>
      </section>

      {/* Studio Areas Grid */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {studioAreas.map((area) => {
          const Icon = area.icon;
          const colorStyles = {
            orange: { bg: "bg-orange-50 text-orange-600 border-orange-100", hover: "hover:border-orange-300 hover:shadow-orange-100/30" },
            amber: { bg: "bg-amber-50 text-amber-600 border-amber-100", hover: "hover:border-amber-300 hover:shadow-amber-100/30" },
            indigo: { bg: "bg-indigo-50 text-indigo-600 border-indigo-100", hover: "hover:border-indigo-300 hover:shadow-indigo-100/30" },
            emerald: { bg: "bg-emerald-50 text-emerald-600 border-emerald-100", hover: "hover:border-emerald-300 hover:shadow-emerald-100/30" },
            cyan: { bg: "bg-cyan-50 text-cyan-600 border-cyan-100", hover: "hover:border-cyan-300 hover:shadow-cyan-100/30" },
            rose: { bg: "bg-rose-50 text-rose-600 border-rose-100", hover: "hover:border-rose-300 hover:shadow-rose-100/30" },
          }[area.accent as "orange" | "amber" | "indigo" | "emerald" | "cyan" | "rose"];

          return (
            <Link 
              key={area.href} 
              href={area.href} 
              className={`group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${colorStyles.hover}`}
            >
              <div>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 ${colorStyles.bg}`}>
                  <Icon size={24} />
                </span>
                <h2 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-slate-950 transition-colors duration-300">
                  {area.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {area.body}
                </p>
              </div>
              <span className="mt-6 flex items-center gap-1.5 text-xs font-bold text-slate-700 transition-colors duration-300 group-hover:text-slate-950">
                Yöneticiyi Aç
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </section>

      {/* Onboarding Checklist Section */}
      <section className="rounded-[2.5rem] border border-slate-200/80 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <Activity size={24} />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Onboarding checklist</span>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Eksik Adımları Tamamlayın</h2>
            </div>
          </div>
          <Link 
            href="/studio/onboarding" 
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-xs font-bold text-white transition-all duration-300 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-950/10"
          >
            Kurulum Sihirbazına Git
          </Link>
        </div>
        
        <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
          {snapshot.checklist.slice(0, 6).map((item) => (
            <Link 
              key={item.id} 
              href={item.href} 
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-300 hover:border-orange-200 hover:bg-orange-50/10"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 
                  size={18} 
                  className={`shrink-0 transition-colors duration-300 ${item.done ? "text-emerald-500" : "text-slate-300"}`} 
                />
                <span className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-300">
                  {item.title}
                </span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                item.done 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                  : "bg-orange-50 text-orange-700 border border-orange-100 animate-pulse"
              }`}>
                {item.done ? "Tamamlandı" : "Bekliyor"}
              </span>
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
