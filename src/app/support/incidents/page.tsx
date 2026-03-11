import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireSupportAccess } from "@/lib/auth";
import { createSupportIncident, listSupportIncidents, listSupportTenantSummaries, setSupportIncidentStatus } from "@/lib/domains/support";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import type { SupportIncidentSeverity, SupportIncidentStatus } from "@/lib/types";

async function createIncidentAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/incidents", ["support_admin", "support_agent"]);
  await createSupportIncident({
    businessId: String(formData.get("businessId") ?? "") || null,
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    severity: String(formData.get("severity") ?? "major") as SupportIncidentSeverity,
  });
  revalidatePath("/support/incidents");
  revalidatePath("/support");
  revalidatePath("/support/audit");
}

async function updateIncidentStatusAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/incidents", ["support_admin", "support_agent"]);
  await setSupportIncidentStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? "open") as SupportIncidentStatus);
  revalidatePath("/support/incidents");
  revalidatePath("/support");
  revalidatePath("/support/audit");
}

export default async function SupportIncidentsPage() {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/incidents");
  const [{ incidents }, { tenants }] = await Promise.all([listSupportIncidents(), listSupportTenantSummaries()]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Incidents", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Incident governance", locale)}</h1>
      </header>

      <form action={createIncidentAction} className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <select name="businessId" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">
            <option value="">{translateUiText("Global incident", locale)}</option>
            {tenants.map((tenant) => (
              <option key={tenant.business_id} value={tenant.business_id}>{tenant.business_name}</option>
            ))}
          </select>
          <select name="severity" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">
            <option value="minor">{translateUiText("Minor", locale)}</option>
            <option value="major">{translateUiText("Major", locale)}</option>
            <option value="critical">{translateUiText("Critical", locale)}</option>
          </select>
          <input name="title" placeholder={translateUiText("Incident basligi", locale)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
          <textarea name="summary" rows={4} placeholder={translateUiText("Etkisi ve ozetini yazin", locale)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">{translateUiText("Incident Ac", locale)}</button>
        </div>
      </form>

      <section className="space-y-4">
        {incidents.map((incident) => (
          <article key={incident.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{incident.severity}</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  <Link href={`/support/incidents/${incident.id}`} className="hover:text-[#ff6a3d]">
                    {incident.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-slate-500">{incident.business_name || "Global"} · {incident.owner_support_name || "Atanmamis"}</p>
                <p className="mt-2 text-sm text-slate-600">{incident.summary}</p>
              </div>
              <form action={updateIncidentStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={incident.id} />
                <select name="status" defaultValue={incident.status} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="open">{translateUiText("Open", locale)}</option>
                  <option value="monitoring">{translateUiText("Monitoring", locale)}</option>
                  <option value="resolved">{translateUiText("Resolved", locale)}</option>
                  <option value="closed">{translateUiText("Closed", locale)}</option>
                </select>
                <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{translateUiText("Guncelle", locale)}</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

