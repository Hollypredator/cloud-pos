import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { requireStudioAccess } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/lib/data";

export default async function AdminOnboardingPage() {
  await requireStudioAccess("/studio/onboarding");
  const snapshot = await getOnboardingSnapshot();
  const completed = snapshot.checklist.filter((item) => item.done).length;
  const total = snapshot.checklist.length || 1;
  const progress = Math.round((completed / total) * 100);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Studio Wizard</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Müşteri kurulum akışı</h1>
            <p className="mt-5 max-w-2xl text-base leadıng-8 text-slate-300">
              Marka, SEO, landing, medya, blog ve operasyon kurulumunu tek listeden takip edin.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">İlerleme</p>
            <p className="mt-4 text-5xl font-bold">{completed}/{snapshot.checklist.length}</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-emerald-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {snapshot.checklist.map((item) => {
          const Icon = item.done ? CheckCircle2 : CircleDashed;
          return (
            <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon size={22} className={item.done ? "mt-0.5 shrink-0 text-emerald-600" : "mt-0.5 shrink-0 text-orange-500"} />
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-950">{item.title}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">{item.done ? "Hazır" : "Tamamlanması gerekiyor"}</p>
                  </div>
                </div>
                <Link href={item.href} className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  Aç
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
