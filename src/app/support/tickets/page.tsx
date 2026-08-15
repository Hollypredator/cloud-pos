import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSupportAccess } from "@/lib/auth";
import { assignSupportTicket, getPlatformAccessByEmail, listSupportAccessUsers, listSupportTickets, setSupportTicketStatus } from "@/lib/domains/support";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";
import type { SupportTicketStatus } from "@/lib/types";
import { SupportEmptyState, SupportFilterBar } from "@/components/support-ui";

async function updateTicketStatusAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/tickets", ["support_admin", "support_agent"]);
  await setSupportTicketStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? "open") as SupportTicketStatus);
  revalidatePath("/support/tickets");
  revalidatePath("/support/audit");
}

async function assignTicketAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/tickets", ["support_admin", "support_agent"]);
  const value = String(formData.get("supportUserId") ?? "");
  await assignSupportTicket(String(formData.get("id") ?? ""), value || null);
  revalidatePath("/support/tickets");
  revalidatePath(`/support/tickets/${String(formData.get("id") ?? "")}`);
  revalidatePath("/support/audit");
}

export default async function SupportTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; type?: string; queue?: string }>;
}) {
  const locale = await getCurrentLocale();
  const access = await requireSupportAccess("/support/tickets");
  const [{ tickets }, { users }, platformAccess] = await Promise.all([
    listSupportTickets(),
    listSupportAccessUsers(),
    getPlatformAccessByEmail(access.email ?? ""),
  ]);
  const filters = (await searchParams) ?? {};
  const q = (filters.q ?? "").trim().toLowerCase();
  const statusFilter = (filters.status ?? "all").trim().toLowerCase();
  const typeFilter = (filters.type ?? "all").trim().toLowerCase();
  const queueFilter = (filters.queue ?? "all").trim().toLowerCase();
  const currentSupportUserId =
    users.find((user) => user.email.toLowerCase() === access.email)?.id ??
    (platformAccess.role && (platformAccess.role === "platform_owner" || platformAccess.role === "platform_admin") ? null : null);
  const filteredTickets = tickets.filter((ticket) => {
    const matchesQuery =
      !q ||
      ticket.subject.toLowerCase().includes(q) ||
      ticket.description.toLowerCase().includes(q) ||
      (ticket.business_name ?? ticket.business_id).toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesType = typeFilter === "all" || ticket.type === typeFilter;
    const matchesQueue =
      queueFilter === "all" ||
      (queueFilter === "mine" && currentSupportUserId && ticket.assigned_to_support_user_id === currentSupportUserId) ||
      (queueFilter === "breached" && ticket.sla_status === "breached") ||
      (queueFilter === "urgent" && (ticket.priority === "urgent" || ticket.sla_status === "due_soon")) ||
      (queueFilter === "unassigned" && !ticket.assigned_to_support_user_id);
    return matchesQuery && matchesStatus && matchesType && matchesQueue;
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Support Tickets", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Destek ve paket talepleri", locale)}</h1>
      </header>

      <SupportFilterBar
        queryDefaultValue={filters.q ?? ""}
        queryPlaceholder={translateUiText("Konu, açıklama veya tenant ara", locale)}
        selects={[
          {
            name: "status",
            defaultValue: statusFilter || "all",
            options: [
              { value: "all", label: translateUiText("Tüm durumlar", locale) },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In Progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ],
          },
          {
            name: "type",
            defaultValue: typeFilter || "all",
            options: [
              { value: "all", label: translateUiText("Tüm tipler", locale) },
              { value: "support", label: "Support" },
              { value: "plan_change", label: "Plan Change" },
              { value: "billing", label: "Billing" },
              { value: "onboarding", label: "Onboarding" },
              { value: "incident", label: "Incident" },
            ],
          },
          {
            name: "queue",
            defaultValue: queueFilter || "all",
            options: [
              { value: "all", label: translateUiText("Tüm kuyruklar", locale) },
              { value: "mine", label: translateUiText("Benim ticketlarim", locale) },
              { value: "breached", label: translateUiText("SLA ihlali", locale) },
              { value: "urgent", label: translateUiText("Acil kuyruk", locale) },
              { value: "unassigned", label: translateUiText("Atanmamis", locale) },
            ],
          },
        ]}
        submitLabel={translateUiText("Filtrele", locale)}
      />

      <section className="space-y-4">
        {filteredTickets.map((ticket) => (
          <article key={ticket.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{ticket.type}</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  <Link href={`/support/tickets/${ticket.id}`} className="hover:text-[#ff6a3d]">
                    {ticket.subject}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-slate-500">{ticket.business_name || ticket.business_id}</p>
                <p className="mt-2 text-sm text-slate-600">{ticket.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ticket.priority}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{ticket.status}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  ticket.sla_status === "breached"
                    ? "bg-rose-100 text-rose-700"
                    : ticket.sla_status === "due_soon"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700"
                }`}>
                  SLA {ticket.sla_status}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <form action={assignTicketAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={ticket.id} />
                <select name="supportUserId" defaultValue={ticket.assigned_to_support_user_id ?? ""} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="">{translateUiText("Atanmamis", locale)}</option>
                  {users.filter((user) => user.is_active).map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{translateUiText("Ata", locale)}</button>
              </form>
              <form action={updateTicketStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={ticket.id} />
                <select name="status" defaultValue={ticket.status} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{translateUiText("Güncelle", locale)}</button>
              </form>
            </div>
          </article>
        ))}
        {filteredTickets.length === 0 ? (
          <SupportEmptyState>{translateUiText("Filtreye uygun ticket bulunamadı.", locale)}</SupportEmptyState>
        ) : null}
      </section>
    </main>
  );
}

