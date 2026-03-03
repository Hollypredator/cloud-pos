import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireSupportAccess } from "@/lib/auth";
import { createSupportIncidentUpdate, getSupportIncidentDetail } from "@/lib/data";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import type { SupportIncidentStatus } from "@/lib/types";

async function addIncidentUpdateAction(formData: FormData) {
  "use server";
  const incidentId = String(formData.get("incidentId") ?? "");
  await requireSupportAccess(`/support/incidents/${incidentId}`, ["support_admin", "support_agent"]);
  const statusValue = String(formData.get("status") ?? "");
  await createSupportIncidentUpdate({
    incidentId,
    message: String(formData.get("message") ?? ""),
    status: (statusValue || undefined) as SupportIncidentStatus | undefined,
  });
  revalidatePath(`/support/incidents/${incidentId}`);
  revalidatePath("/support/incidents");
  revalidatePath("/support/audit");
}

export default async function SupportIncidentDetailPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const locale = await getCurrentLocale();
  await requireSupportAccess(`/support/incidents/${incidentId}`);
  const { incident, updates } = await getSupportIncidentDetail(incidentId);

  if (!incident) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{incident.severity}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{incident.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{incident.business_name || "Global"} · {incident.status}</p>
        <p className="mt-4 text-sm text-slate-600">{incident.summary}</p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{translateUiText("Timeline", locale)}</p>
          <div className="mt-4 space-y-3">
            {updates.map((update) => (
              <div key={update.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{update.author_name || translateUiText("Support", locale)}</p>
                  <span className="text-xs text-slate-500">{new Date(update.created_at).toLocaleString("tr-TR")}</span>
                </div>
                {update.status ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{update.status}</p> : null}
                <p className="mt-2 text-sm text-slate-600">{update.message}</p>
              </div>
            ))}
          </div>
        </article>

        <form action={addIncidentUpdateAction} className="rounded-2xl bg-white p-6 shadow-sm">
          <input type="hidden" name="incidentId" value={incident.id} />
          <p className="text-sm font-semibold text-slate-900">{translateUiText("Update / Postmortem Notu", locale)}</p>
          <select name="status" defaultValue="" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">{translateUiText("Durum degistirme", locale)}</option>
            <option value="open">{translateUiText("Open", locale)}</option>
            <option value="monitoring">{translateUiText("Monitoring", locale)}</option>
            <option value="resolved">{translateUiText("Resolved", locale)}</option>
            <option value="closed">{translateUiText("Closed", locale)}</option>
          </select>
          <textarea name="message" rows={8} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={translateUiText("Update, aksiyon veya postmortem notu ekleyin", locale)} />
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">{translateUiText("Update Kaydet", locale)}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
