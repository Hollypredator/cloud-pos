import { requireSupportAccess } from "@/lib/auth";
import { listSupportOnboardingSummaries } from "@/lib/domains/support";

export default async function SupportOnboardingPage() {
  await requireSupportAccess("/support/onboarding");
  const { tenants } = await listSupportOnboardingSummaries();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Onboarding</p>
        <h1 className="text-3xl font-semibold text-slate-900">Tenant hazirlik durumu</h1>
      </header>

      <section className="space-y-4">
        {tenants.map((tenant) => (
          <article key={tenant.business_id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{tenant.business_name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {tenant.business_type === "self_service_coffee" ? "Self-Service Coffee" : "Restaurant / Cafe"}
                </p>
                <p className="mt-1 text-sm text-slate-500">Tamamlama: %{tenant.completion_score}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                %{tenant.completion_score}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Ürün: {tenant.products}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Masa: {tenant.tables}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Personel: {tenant.staff}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Şube: {tenant.branches}</div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

