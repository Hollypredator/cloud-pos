import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Headphones,
  LifeBuoy,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react";
import { requireSupportAccess } from "@/lib/auth";
import { getSupportDashboardSnapshot } from "@/lib/domains/support";

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "orange" | "rose" | "emerald" | "cyan";
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700",
    orange: "bg-orange-100 text-orange-700",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    cyan: "bg-cyan-100 text-cyan-700",
  }[tone];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${toneClass}`}>{label}</div>
      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

export default async function SupportHomePage() {
  const access = await requireSupportAccess("/support");
  const snapshot = await getSupportDashboardSnapshot();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Support cockpit</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Tenant, ticket, incident ve billing risklerini tek ekrandan yönetin.
            </h1>
            <p className="mt-5 max-w-2xl text-base leadıng-8 text-slate-300">
              Cloud POS support paneli, müşteri sağlığı ve operasyon risklerini ekiplerin hızlı aksiyon alacağı şekilde öne çıkarır.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Rol</p>
            <p className="mt-3 text-3xl font-bold">{access.supportRole ?? "-"}</p>
            <div className="mt-5 grid gap-2">
              <Link href="/support/tickets?queue=mine" className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950">
                Benim ticketlarım
              </Link>
              <Link href="/support/tickets?queue=urgent" className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white">
                Acil kuyruk
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Aktif işletme" value={snapshot.metrics.activeBusinesses} tone="cyan" />
        <MetricCard label="Açık ticket" value={snapshot.metrics.openTickets} tone="orange" />
        <MetricCard label="Kritik tenant" value={snapshot.metrics.criticalTenants} tone="rose" />
        <MetricCard label="SLA ihlali" value={snapshot.metrics.breachedTickets} tone="rose" />
        <MetricCard label="Support kullanıcı" value={snapshot.metrics.activeSupportUsers} />
        <MetricCard label="Paket talebi" value={snapshot.metrics.openPlanRequests} tone="emerald" />
        <MetricCard label="Açık incident" value={snapshot.metrics.openIncidents} tone="orange" />
        <MetricCard label="Geciken billing" value={snapshot.metrics.overdueBilling} tone="rose" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                  <Ticket size={22} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ticket kuyruğu</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Son talepler</h2>
                </div>
              </div>
            </div>
            <Link href="/support/tickets" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              Tüm talepler
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {snapshot.recentTickets.length > 0 ? (
              snapshot.recentTickets.map((ticket) => (
                <Link key={ticket.id} href={`/support/tickets/${ticket.id}`} className="block rounded-2xl border border-slate-200 bg-[#f7f8fb] px-4 py-3 transition hover:border-orange-200 hover:bg-orange-50/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-bold text-slate-950">{ticket.subject}</p>
                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      SLA {ticket.sla_status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {ticket.business_name || ticket.business_id} | {ticket.priority}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl bg-[#f7f8fb] px-4 py-5 text-sm font-semibold text-slate-500">Açık son ticket yok.</p>
            )}
          </div>
        </article>

        <div className="grid gap-6">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CircleDollarSign size={22} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Plan ve billing</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Paket talepleri</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.recentPlanRequests.length > 0 ? (
                snapshot.recentPlanRequests.map((request) => (
                  <Link key={request.id} href="/support/plan-requests" className="block rounded-2xl border border-slate-200 bg-[#f7f8fb] px-4 py-3">
                    <p className="text-sm font-bold text-slate-950">{request.business_name || request.business_id}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{request.current_plan} -&gt; {request.requested_plan}</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f7f8fb] px-4 py-5 text-sm font-semibold text-slate-500">Bekleyen paket talebi yok.</p>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <ShieldAlert size={22} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Incident</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Son incidentler</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.recentIncidents.length > 0 ? (
                snapshot.recentIncidents.map((incident) => (
                  <Link key={incident.id} href={`/support/incidents/${incident.id}`} className="block rounded-2xl border border-slate-200 bg-[#f7f8fb] px-4 py-3">
                    <p className="text-sm font-bold text-slate-950">{incident.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{incident.business_name || "Global"} | {incident.severity}</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f7f8fb] px-4 py-5 text-sm font-semibold text-slate-500">Aktif incident yok.</p>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/support/tenants", title: "Tenant sağlığı", icon: Building2 },
          { href: "/support/team", title: "Support ekibi", icon: Users },
          { href: "/support/health", title: "Sistem sağlığı", icon: LifeBuoy },
          { href: "/support/tickets?queue=urgent", title: "Acil aksiyonlar", icon: AlertTriangle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-500/10">
              <Icon size={24} className="text-cyan-700" />
              <p className="mt-4 text-lg font-bold tracking-tight text-slate-950">{item.title}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                Aç
                <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </section>

      {snapshot.usingDemoData ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Demo modda support kullanıcıları kaydedilemez.
        </p>
      ) : null}
    </main>
  );
}
