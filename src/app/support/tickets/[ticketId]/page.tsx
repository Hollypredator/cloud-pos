import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireSupportAccess } from "@/lib/auth";
import {
  assignSupportTicket,
  createSupportTicketMessage,
  getSupportTicketDetail,
  listSupportAccessUsers,
  setSupportTicketStatus,
} from "@/lib/data";
import type { SupportTicketStatus } from "@/lib/types";

async function updateTicketStatusAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId") ?? "");
  await requireSupportAccess(`/support/tickets/${ticketId}`, ["support_admin", "support_agent"]);
  await setSupportTicketStatus(ticketId, String(formData.get("status") ?? "open") as SupportTicketStatus);
  revalidatePath("/support/tickets");
  revalidatePath(`/support/tickets/${ticketId}`);
}

async function assignTicketAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId") ?? "");
  await requireSupportAccess(`/support/tickets/${ticketId}`, ["support_admin", "support_agent"]);
  const supportUserId = String(formData.get("supportUserId") ?? "");
  await assignSupportTicket(ticketId, supportUserId || null);
  revalidatePath("/support/tickets");
  revalidatePath(`/support/tickets/${ticketId}`);
}

async function addInternalNoteAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId") ?? "");
  await requireSupportAccess(`/support/tickets/${ticketId}`, ["support_admin", "support_agent", "billing_agent"]);
  await createSupportTicketMessage({
    ticketId,
    message: String(formData.get("message") ?? ""),
    isInternalNote: true,
  });
  revalidatePath(`/support/tickets/${ticketId}`);
  revalidatePath("/support/audit");
}

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  await requireSupportAccess(`/support/tickets/${ticketId}`);

  const [{ ticket, messages, auditLogs }, { users }] = await Promise.all([
    getSupportTicketDetail(ticketId),
    listSupportAccessUsers(),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{ticket.type}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{ticket.subject}</h1>
        <p className="mt-2 text-sm text-slate-500">{ticket.business_name || ticket.business_id}</p>
        <p className="mt-4 text-sm text-slate-600">{ticket.description}</p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Iletisim ve Notlar</p>
            <div className="mt-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{message.author_name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {message.is_internal_note ? <span className="rounded-full bg-slate-900 px-2 py-1 text-white">Internal</span> : null}
                      <span>{new Date(message.created_at).toLocaleString("tr-TR")}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{message.message}</p>
                </div>
              ))}
            </div>
          </article>

          <form action={addInternalNoteAction} className="rounded-2xl bg-white p-6 shadow-sm">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <p className="text-sm font-semibold text-slate-900">Ic Not Ekle</p>
            <textarea
              name="message"
              rows={5}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              placeholder="Support ici not ekleyin"
            />
            <div className="mt-4 flex justify-end">
              <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                Ic Not Kaydet
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Ticket Yonetimi</p>
            <div className="mt-4 grid gap-3">
              <form action={assignTicketAction} className="space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <label className="block text-sm font-medium text-slate-700">Atanan support kullanicisi</label>
                <select name="supportUserId" defaultValue={ticket.assigned_to_support_user_id ?? ""} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Atanmamis</option>
                  {users.filter((user) => user.is_active).map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Ata</button>
              </form>

              <form action={updateTicketStatusAction} className="space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <label className="block text-sm font-medium text-slate-700">Durum</label>
                <select name="status" defaultValue={ticket.status} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Durumu Guncelle</button>
              </form>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Audit</p>
            <div className="mt-4 space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                    <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString("tr-TR")}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{log.actor_name || "Sistem"}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
