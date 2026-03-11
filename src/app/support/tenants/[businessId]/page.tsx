import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_META, getPlanLabel, hasFeature, type FeatureKey } from "@/lib/features";
import { requireSupportAccess } from "@/lib/auth";
import { getSupportTenantDetail, updateSupportTenantProfile, upsertSupportFeatureFlagOverride } from "@/lib/domains/support";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import type { SupportBillingStatus, SupportRiskLevel, TenantLifecycleStage } from "@/lib/types";

async function updateTenantProfileAction(formData: FormData) {
  "use server";
  const businessId = String(formData.get("businessId") ?? "");
  await requireSupportAccess(`/support/tenants/${businessId}`, ["support_admin", "support_agent", "billing_agent"]);
  await updateSupportTenantProfile({
    businessId,
    lifecycleStage: String(formData.get("lifecycleStage") ?? "active") as TenantLifecycleStage,
    ownerName: String(formData.get("ownerName") ?? ""),
    ownerEmail: String(formData.get("ownerEmail") ?? ""),
    accountManagerName: String(formData.get("accountManagerName") ?? ""),
    renewalDate: String(formData.get("renewalDate") ?? ""),
    billingStatus: String(formData.get("billingStatus") ?? "healthy") as SupportBillingStatus,
    riskLevel: String(formData.get("riskLevel") ?? "low") as SupportRiskLevel,
    accountNotes: String(formData.get("accountNotes") ?? ""),
  });
  revalidatePath(`/support/tenants/${businessId}`);
  revalidatePath("/support/billing");
  revalidatePath("/support/health");
}

async function updateFeatureFlagAction(formData: FormData) {
  "use server";
  const businessId = String(formData.get("businessId") ?? "");
  await requireSupportAccess(`/support/tenants/${businessId}`, ["support_admin"]);
  await upsertSupportFeatureFlagOverride({
    businessId,
    featureKey: String(formData.get("featureKey") ?? "") as FeatureKey,
    enabled: String(formData.get("enabled") ?? "false") === "true",
    note: String(formData.get("note") ?? ""),
  });
  revalidatePath(`/support/tenants/${businessId}`);
  revalidatePath("/support/feature-flags");
}

export default async function SupportTenantDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/tenants");
  const { businessId } = await params;
  const { tenant } = await getSupportTenantDetail(businessId);

  if (!tenant) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Tenant Cockpit", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{tenant.name}</h1>
        <p className="mt-2 text-sm text-slate-500">/{tenant.slug}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Paket", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{getPlanLabel(tenant.plan)}</p></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Sube", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{tenant.branch_count}</p></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Acik Ticket", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{tenant.open_ticket_count}</p></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Durum", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{tenant.is_active ? translateUiText("Aktif", locale) : translateUiText("Pasif", locale)}</p></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Lifecycle", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{tenant.profile.lifecycle_stage}</p></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{translateUiText("Billing", locale)}</p><p className="mt-3 text-2xl font-semibold text-slate-900">{tenant.profile.billing_status}</p></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={updateTenantProfileAction} className="rounded-2xl bg-white p-6 shadow-sm">
          <input type="hidden" name="businessId" value={businessId} />
          <p className="text-sm font-semibold text-slate-900">{translateUiText("Account Management", locale)}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Lifecycle", locale)}</span>
              <select name="lifecycleStage" defaultValue={tenant.profile.lifecycle_stage} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="lead">Lead</option>
                <option value="demo">Demo</option>
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="at_risk">At Risk</option>
                <option value="churned">Churned</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Billing status", locale)}</span>
              <select name="billingStatus" defaultValue={tenant.profile.billing_status} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="healthy">Healthy</option>
                <option value="attention">Attention</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Risk level", locale)}</span>
              <select name="riskLevel" defaultValue={tenant.profile.risk_level} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Renewal date", locale)}</span>
              <input type="date" name="renewalDate" defaultValue={tenant.profile.renewal_date ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Owner name", locale)}</span>
              <input name="ownerName" defaultValue={tenant.profile.owner_name ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Owner email", locale)}</span>
              <input name="ownerEmail" defaultValue={tenant.profile.owner_email ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Account manager", locale)}</span>
              <input name="accountManagerName" defaultValue={tenant.profile.account_manager_name ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{translateUiText("Account notes", locale)}</span>
              <textarea name="accountNotes" rows={5} defaultValue={tenant.profile.account_notes ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">{translateUiText("Tenant Profilini Kaydet", locale)}</button>
          </div>
        </form>

        <div className="space-y-4">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{translateUiText("Safe Diagnostics", locale)}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Son siparis: {tenant.diagnostics.last_order_at ? new Date(tenant.diagnostics.last_order_at).toLocaleString("tr-TR") : "-"}</p>
              <p>Son odeme: {tenant.diagnostics.last_payment_at ? new Date(tenant.diagnostics.last_payment_at).toLocaleString("tr-TR") : "-"}</p>
              <p>Open incident: {tenant.diagnostics.open_incident_count}</p>
              <p>Feature override: {tenant.diagnostics.feature_flag_count}</p>
              <p>Open ticket: {tenant.diagnostics.open_ticket_count}</p>
            </div>
          </article>
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{translateUiText("Sinirlar", locale)}</p>
            <p className="mt-4 text-sm text-slate-600">
              Bu cockpit tenant metadata, lifecycle, billing, support ve feature governance icindir. Siparis satiri, musteri verisi ve odeme detay icerigi acilmaz.
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{translateUiText("Feature Governance", locale)}</p>
          <div className="mt-4 space-y-3">
            {Object.entries(FEATURE_META).map(([featureKey, meta]) => {
              const override = (tenant.feature_flags ?? []).find((item: { feature_key: string }) => item.feature_key === featureKey);
              return (
                <form key={featureKey} action={updateFeatureFlagAction} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <input type="hidden" name="businessId" value={businessId} />
                  <input type="hidden" name="featureKey" value={featureKey} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                      <p className="mt-1 text-xs text-slate-400">{translateUiText("Plan default:", locale)} {hasFeature(tenant.plan, featureKey as FeatureKey) ? translateUiText("Acik", locale) : getPlanLabel(meta.requiredPlan)}</p>
                    </div>
                    <select name="enabled" defaultValue={String(override?.enabled ?? hasFeature(tenant.plan, featureKey as FeatureKey))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="true">{translateUiText("Acik", locale)}</option>
                      <option value="false">{translateUiText("Kapali", locale)}</option>
                    </select>
                  </div>
                  <input name="note" defaultValue={override?.note ?? ""} placeholder={translateUiText("Override notu", locale)} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{translateUiText("Flag Guncelle", locale)}</button>
                  </div>
                </form>
              );
            })}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{translateUiText("Incidentler", locale)}</p>
            <div className="mt-4 space-y-3">
              {(tenant.incidents ?? []).map((incident: { id: string; title: string; severity: string; status: string; owner_support_name?: string | null }) => (
                <Link key={incident.id} href={`/support/incidents/${incident.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{incident.severity} · {incident.status} · {incident.owner_support_name || "Atanmamis"}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{translateUiText("Son Ticketlar", locale)}</p>
              <Link href={`/support/tickets?q=${encodeURIComponent(tenant.name)}`} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                {translateUiText("Tumunu gor", locale)}
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {(tenant.recent_tickets ?? []).map((ticket: { id: string; subject: string; status: string; priority: string; sla_status?: string; assigned_support_name?: string | null }) => (
                <Link key={ticket.id} href={`/support/tickets/${ticket.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.priority} {" - "} {ticket.status} {" - "} SLA {ticket.sla_status ?? "on_track"} {" - "} {ticket.assigned_support_name || "Atanmamis"}</p>
                </Link>
              ))}
              {!(tenant.recent_tickets ?? []).length ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {translateUiText("Bu tenant icin support ticketi yok.", locale)}
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{translateUiText("Son Paket Talepleri", locale)}</p>
            <div className="mt-4 space-y-3">
              {(tenant.plan_requests ?? []).map((request: { id: string; current_plan: string; requested_plan: string; status: string }) => (
                <Link key={request.id} href="/support/plan-requests" className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{request.current_plan} {"->"} {request.requested_plan}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.status}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{translateUiText("Son Support Islemleri", locale)}</p>
            <div className="mt-4 space-y-3">
              {(tenant.recent_audit_logs ?? []).map((log: { id: string; action: string; actor_name?: string | null; created_at: string }) => (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                  <p className="mt-1 text-xs text-slate-500">{log.actor_name || "Sistem"} · {new Date(log.created_at).toLocaleString("tr-TR")}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
