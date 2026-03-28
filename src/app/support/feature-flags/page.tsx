import { FEATURE_META, getPlanLabel } from "@/lib/features";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportFeatureFlagOverrides } from "@/lib/domains/support";

export default async function SupportFeatureFlagsPage() {
  await requireSupportAccess("/support/feature-flags", ["support_admin"]);
  const { overrides } = await listSupportFeatureFlagOverrides();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Feature Flags</p>
        <h1 className="text-3xl font-semibold text-slate-900">Tenant bazli modül governance</h1>
      </header>

      <section className="space-y-4">
        {overrides.map((override) => (
          <article key={override.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{override.business_name || override.business_id}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {FEATURE_META[override.feature_key as keyof typeof FEATURE_META]?.title || override.feature_key}
                </p>
                <p className="mt-2 text-sm text-slate-600">{override.note || "Not girilmedi."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${override.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                {override.enabled ? "Açık" : "Kapali"}
              </span>
            </div>
          </article>
        ))}
        {overrides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
            Henüz feature override tanimlanmamis. Plan varsayilanlari kullaniliyor.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Plan varsayilanlari</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(FEATURE_META).map(([featureKey, meta]) => (
            <div key={featureKey} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
              <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
              <p className="mt-2 text-xs text-slate-400">Varsayilan plan: {getPlanLabel(meta.requiredPlan)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

