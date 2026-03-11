import { requireSupportAccess } from "@/lib/auth";
import { listSupportBillingSummaries } from "@/lib/domains/support";
import { getPlanLabel } from "@/lib/features";

export default async function SupportBillingPage() {
  await requireSupportAccess("/support/billing", ["support_admin", "billing_agent"]);
  const { tenants } = await listSupportBillingSummaries();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Billing Governance</p>
        <h1 className="text-3xl font-semibold text-slate-900">Billing ve renewal gorunumu</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tenants.map((tenant) => (
          <article key={tenant.business_id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{tenant.business_name}</p>
                <p className="mt-1 text-sm text-slate-500">{getPlanLabel(tenant.plan)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{tenant.billing_status}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Lifecycle: {tenant.lifecycle_stage}</p>
              <p>Risk: {tenant.risk_level}</p>
              <p>Renewal: {tenant.renewal_date ? new Date(tenant.renewal_date).toLocaleDateString("tr-TR") : "-"}</p>
              <p>Account manager: {tenant.account_manager_name || "-"}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

