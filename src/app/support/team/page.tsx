import { requireSupportAccess } from "@/lib/auth";
import { listSupportTeamSummaries } from "@/lib/domains/support";

export default async function SupportTeamPage() {
  await requireSupportAccess("/support/team", ["support_admin"]);
  const { members } = await listSupportTeamSummaries();
  const activeMembers = members.filter((member) => member.is_active).length;
  const openTickets = members.reduce((total, member) => total + member.open_ticket_count, 0);
  const openIncidents = members.reduce((total, member) => total + member.open_incident_count, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Team</p>
        <h1 className="text-3xl font-semibold text-slate-900">Platform ekip kapasitesi</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Aktif Uye</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeMembers}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Takim Açık Ticket</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{openTickets}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Takim Açık Incident</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{openIncidents}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <article key={member.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{member.full_name || member.email}</p>
                <p className="mt-1 text-sm text-slate-500">{member.email}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${member.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                {member.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Rol: {member.role}</p>
              <p>Açık ticket: {member.open_ticket_count}</p>
              <p>Açık incident: {member.open_incident_count}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  member.open_ticket_count + member.open_incident_count >= 8
                    ? "bg-rose-500"
                    : member.open_ticket_count + member.open_incident_count >= 4
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (member.open_ticket_count * 10) + (member.open_incident_count * 20))}%` }}
              />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

