import { requireSupportAccess } from "@/lib/auth";
import { listSupportTeamSummaries } from "@/lib/data";

export default async function SupportTeamPage() {
  await requireSupportAccess("/support/team", ["support_admin"]);
  const { members } = await listSupportTeamSummaries();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Team</p>
        <h1 className="text-3xl font-semibold text-slate-900">Platform ekip kapasitesi</h1>
      </header>

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
              <p>Acik ticket: {member.open_ticket_count}</p>
              <p>Acik incident: {member.open_incident_count}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
