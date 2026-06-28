import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/auth";
import { createLeadNote, listLeadNotes, listSalesLeads, updateSalesLeadStatus } from "@/lib/data";
import type { SalesLeadStatus } from "@/lib/types";

const statuses: SalesLeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

async function updateLeadStatusAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/leads");

  const leadId = formData.get("leadId");
  const status = formData.get("status");
  if (typeof leadId !== "string" || typeof status !== "string") {
    return;
  }

  if (!statuses.includes(status as SalesLeadStatus)) {
    return;
  }

  await updateSalesLeadStatus(leadId, status as SalesLeadStatus);
  revalidatePath("/studio/leads");
}

async function addLeadNoteAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/leads");

  const leadId = formData.get("leadId");
  const note = formData.get("note");
  if (typeof leadId !== "string" || typeof note !== "string" || !note.trim()) {
    return;
  }

  await createLeadNote({ leadId, note });
  revalidatePath("/studio/leads");
}

function statusTone(status: SalesLeadStatus) {
  if (status === "new") return "bg-sky-100 text-sky-700";
  if (status === "contacted") return "bg-amber-100 text-amber-800";
  if (status === "qualified") return "bg-violet-100 text-violet-700";
  if (status === "won") return "bg-emerald-100 text-emerald-700";
  return "bg-rose-100 text-rose-700";
}

export default async function AdminLeadsPage() {
  await requireStudioAccess("/studio/leads");
  const { leads, usingDemoData } = await listSalesLeads();
  const notesByLead = new Map(
    await Promise.all(leads.map(async (lead) => [lead.id, (await listLeadNotes(lead.id)).notes] as const)),
  );

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio CRM</p>
            <h1 className="text-3xl font-semibold text-slate-900">Satış Leadleri</h1>
          </div>
          <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Siteyi Ac</Link>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Demo modda Örnek lead listesi gösteriliyor.
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-5">
          {statuses.map((status) => (
            <article key={status} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">{status}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {leads.filter((lead) => lead.status === status).length}
              </p>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">{lead.company_name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{lead.contact_name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {lead.phone ?? "-"} {lead.email ? `| ${lead.email}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Şube: {lead.branch_count} | Kaynak: {lead.source ?? "-"}
                  </p>
                  {lead.note ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{lead.note}</p> : null}
                  {(notesByLead.get(lead.id) ?? []).length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {(notesByLead.get(lead.id) ?? []).map((note) => (
                        <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          <p>{note.note}</p>
                          <p className="mt-2 text-xs text-slate-400">{new Date(note.created_at).toLocaleString("tr-TR")}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <form action={updateLeadStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <select name="status" defaultValue={lead.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                      Güncelle
                    </button>
                  </form>
                  <form action={addLeadNoteAction} className="grid gap-2">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <textarea
                      name="note"
                      rows={3}
                      placeholder="Yeni gorusme notu ekle"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                      Not Ekle
                    </button>
                  </form>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-400">{new Date(lead.created_at).toLocaleString("tr-TR")}</p>
            </article>
          ))}
          {leads.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Henüz lead kaydı yok.</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
