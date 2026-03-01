import Link from "next/link";
import { requireStudioAccess } from "@/lib/auth";
import { getOnboardingSnapshot } from "@/lib/data";

export default async function AdminOnboardingPage() {
  await requireStudioAccess("/studio/onboarding");
  const snapshot = await getOnboardingSnapshot();
  const completed = snapshot.checklist.filter((item) => item.done).length;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <p className="text-sm text-slate-500">Studio Wizard</p>
          <h1 className="text-3xl font-semibold text-slate-900">Musteri kurulum akisi</h1>
        </header>

        <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Ilerleme</p>
          <p className="mt-3 text-5xl font-semibold">{completed}/{snapshot.checklist.length}</p>
          <p className="mt-3 text-sm text-slate-300">Marka, SEO, landing, medya, blog ve operasyon kurulumunu tek yerden takip et.</p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {snapshot.checklist.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.done ? "Hazir" : "Eksik"}</p>
                </div>
                <Link href={item.href} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Ac
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
