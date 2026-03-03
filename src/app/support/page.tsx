import Link from "next/link";
import { requireSupportAccess } from "@/lib/auth";
import { getSupportDashboardSnapshot } from "@/lib/data";

export default async function SupportHomePage() {
  const access = await requireSupportAccess("/support");
  const snapshot = await getSupportDashboardSnapshot();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-11">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Aktif Isletme</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.activeBusinesses}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Support Kullanici</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.activeSupportUsers}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acik Ticket</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.openTickets}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acik Paket Talebi</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.openPlanRequests}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Kritik Tenant</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.criticalTenants}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acik Incident</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.openIncidents}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Riskli Tenant</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.atRiskTenants}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Geciken Billing</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.overdueBilling}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Benim Ticketlarim</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.myOpenTickets}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">SLA Ihlali</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.breachedTickets}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acil Kuyruk</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{snapshot.metrics.urgentTickets}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Rol</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{access.supportRole ?? "-"}</h2>
          <div className="mt-5 space-y-3">
            {snapshot.recentTickets.map((ticket) => (
              <Link key={ticket.id} href={`/support/tickets/${ticket.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{ticket.business_name || ticket.business_id}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Son Paket Talepleri</p>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {snapshot.recentPlanRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{request.business_name || request.business_id}</p>
                <p className="mt-1 text-xs text-slate-500">{request.current_plan} {"->"} {request.requested_plan}</p>
              </div>
            ))}
          </div>
          {snapshot.usingDemoData ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Demo modda support kullanicilari kaydedilemez.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Son Incidentler</p>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {snapshot.recentIncidents.map((incident) => (
              <div key={incident.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{incident.title}</p>
                <p className="mt-1 text-xs text-slate-500">{incident.business_name || "Global"} · {incident.severity}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
