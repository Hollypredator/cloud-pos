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
  Clock,
  CheckCircle2,
  TrendingUp,
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
  const config = {
    slate: {
      badge: "bg-slate-100 text-slate-700 border-slate-200/60",
      border: "hover:border-slate-300 hover:shadow-slate-200/50",
      dot: "bg-slate-400",
      glow: "group-hover:bg-slate-500",
    },
    orange: {
      badge: "bg-orange-50 text-orange-700 border-orange-200/40",
      border: "hover:border-orange-300 hover:shadow-orange-200/30",
      dot: "bg-orange-500 animate-pulse",
      glow: "group-hover:bg-orange-600",
    },
    rose: {
      badge: "bg-rose-50 text-rose-700 border-rose-200/40",
      border: "hover:border-rose-300 hover:shadow-rose-200/30",
      dot: "bg-rose-500 animate-pulse",
      glow: "group-hover:bg-rose-600",
    },
    emerald: {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
      border: "hover:border-emerald-300 hover:shadow-emerald-200/30",
      dot: "bg-emerald-500",
      glow: "group-hover:bg-emerald-600",
    },
    cyan: {
      badge: "bg-cyan-50 text-cyan-700 border-cyan-200/40",
      border: "hover:border-cyan-300 hover:shadow-cyan-200/30",
      dot: "bg-cyan-500",
      glow: "group-hover:bg-cyan-600",
    },
  }[tone];

  return (
    <article className={`group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${config.border}`}>
      {/* Decorative background glow */}
      <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-slate-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${config.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {label}
        </span>
        <TrendingUp size={14} className="text-slate-300 transition-colors duration-300 group-hover:text-slate-400" />
      </div>
      
      <div className="mt-5 flex items-baseline gap-2">
        <p className="text-5xl font-black tracking-tight text-slate-950 transition-colors duration-300">
          {value}
        </p>
      </div>
    </article>
  );
}

export default async function SupportHomePage() {
  const access = await requireSupportAccess("/support");
  const snapshot = await getSupportDashboardSnapshot();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-8">
      
      {/* Support Cockpit Hero */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-2xl shadow-slate-950/20">
        {/* Subtle mesh background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Support Cockpit
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              Müşteri Riskleri & Operasyon Kontrolü
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
              QUAPOS support paneli, müşteri sağlığı, aktif ticket yükleri, SLA riskleri ve faturalama operasyonlarını gerçek zamanlı optimize eder.
            </p>
          </div>
          
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 block">Aktif Oturum Rolü</span>
            <p className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
              {access.supportRole ?? "-"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link 
                href="/support/tickets?queue=mine" 
                className="flex items-center justify-center rounded-2xl bg-white px-4 py-3.5 text-xs font-bold text-slate-950 transition-all duration-300 hover:bg-cyan-50 hover:shadow-lg hover:shadow-white/10 text-center"
              >
                Benim Taleplerim
              </Link>
              <Link 
                href="/support/tickets?queue=urgent" 
                className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-bold text-white transition-all duration-300 hover:bg-white/10 text-center hover:border-white/20"
              >
                Acil Kuyruk
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Aktif İşletme" value={snapshot.metrics.activeBusinesses} tone="cyan" />
        <MetricCard label="Açık Ticket" value={snapshot.metrics.openTickets} tone="orange" />
        <MetricCard label="Kritik Tenant" value={snapshot.metrics.criticalTenants} tone="rose" />
        <MetricCard label="SLA İhlali" value={snapshot.metrics.breachedTickets} tone="rose" />
        <MetricCard label="Destek Personeli" value={snapshot.metrics.activeSupportUsers} tone="slate" />
        <MetricCard label="Paket Talebi" value={snapshot.metrics.openPlanRequests} tone="emerald" />
        <MetricCard label="Açık Incident" value={snapshot.metrics.openIncidents} tone="orange" />
        <MetricCard label="Geciken Billing" value={snapshot.metrics.overdueBilling} tone="rose" />
      </section>

      {/* Lists Grid */}
      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        
        {/* Ticket Queue Card */}
        <article className="rounded-[2.5rem] border border-slate-200/80 bg-white p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100">
                  <Ticket size={24} />
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Queue Monitor</span>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">En Son Destek Talepleri</h2>
                </div>
              </div>
              <Link 
                href="/support/tickets" 
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-bold text-white transition-all duration-300 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-950/10 w-fit"
              >
                Tümünü Yönet
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
            
            <div className="mt-8 space-y-3.5">
              {snapshot.recentTickets.length > 0 ? (
                snapshot.recentTickets.map((ticket) => (
                  <Link 
                    key={ticket.id} 
                    href={`/support/tickets/${ticket.id}`} 
                    className="group block rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-300 hover:border-orange-200 hover:bg-orange-50/10 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-slate-950 transition-colors duration-300">
                        {ticket.subject}
                      </p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        ticket.sla_status === "breached" 
                          ? "bg-rose-50 text-rose-700 border border-rose-100" 
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}>
                        <Clock size={12} />
                        SLA {ticket.sla_status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">
                        {ticket.business_name || ticket.business_id}
                      </p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        ticket.priority === "high" || ticket.priority === "urgent"
                          ? "text-rose-600 bg-rose-50/50"
                          : "text-slate-500 bg-slate-100"
                      }`}>
                        {ticket.priority} Priority
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 text-center">
                  <CheckCircle2 className="text-emerald-500" size={32} />
                  <p className="mt-3 text-sm font-semibold text-slate-500">Aktif/bekleyen destek talebi bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Plan & Incident column */}
        <div className="space-y-8">
          
          {/* Plan Requests */}
          <article className="rounded-[2.5rem] border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CircleDollarSign size={24} />
              </span>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Upgrade Pipeline</span>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">Paket Değişiklik Talepleri</h2>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              {snapshot.recentPlanRequests.length > 0 ? (
                snapshot.recentPlanRequests.map((request) => (
                  <Link 
                    key={request.id} 
                    href="/support/plan-requests" 
                    className="group block rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-300 hover:border-emerald-200 hover:bg-emerald-50/10"
                  >
                    <p className="text-sm font-bold text-slate-900 group-hover:text-slate-950 transition-colors duration-300">
                      {request.business_name || request.business_id}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{request.current_plan}</span>
                      <span>&rarr;</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{request.requested_plan}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 text-center">
                  <p className="text-xs font-semibold text-slate-400">Bekleyen paket yükseltme talebi yok.</p>
                </div>
              )}
            </div>
          </article>

          {/* Incidents */}
          <article className="rounded-[2.5rem] border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <ShieldAlert size={24} />
              </span>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">System Outages</span>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">Sistem Incident Durumu</h2>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              {snapshot.recentIncidents.length > 0 ? (
                snapshot.recentIncidents.map((incident) => (
                  <Link 
                    key={incident.id} 
                    href={`/support/incidents/${incident.id}`} 
                    className="group block rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-300 hover:border-rose-200 hover:bg-rose-50/10"
                  >
                    <p className="text-sm font-bold text-slate-900 group-hover:text-slate-950 transition-colors duration-300">
                      {incident.title}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">{incident.business_name || "Global Etki"}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        {incident.severity}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 text-center">
                  <p className="text-xs font-semibold text-slate-400">Herhangi bir kesinti ya da incident kaydı yok.</p>
                </div>
              )}
            </div>
          </article>

        </div>
      </section>

      {/* Quick Nav Links */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/support/tenants", title: "Tenant Sağlık Durumu", icon: Building2, desc: "Müşteri panelleri ve sistem yükleri." },
          { href: "/support/team", title: "Support Ekip Yönetimi", icon: Users, desc: "Temsilci kuyrukları ve atamalar." },
          { href: "/support/health", title: "Sistem Sağlığı / Metrikler", icon: LifeBuoy, desc: "API gecikmeleri ve işlem hacimleri." },
          { href: "/support/tickets?queue=urgent", title: "Acil Aksiyon Planları", icon: AlertTriangle, desc: "SLA aşımı kritik durum odası.", urgent: true },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`group flex flex-col justify-between rounded-3xl border p-6 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                item.urgent 
                  ? "border-rose-100 hover:border-rose-300 hover:shadow-rose-100/30" 
                  : "border-slate-200 hover:border-cyan-300 hover:shadow-cyan-100/30"
              }`}
            >
              <div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 ${
                  item.urgent 
                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                    : "bg-cyan-50 text-cyan-600 border border-cyan-100"
                }`}>
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-slate-950">{item.title}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
              <span className="mt-6 flex items-center gap-1.5 text-xs font-bold text-slate-700 transition-colors duration-300 group-hover:text-slate-950">
                Detayları İncele
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </section>

      {snapshot.usingDemoData ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-center gap-3 text-sm font-semibold text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p>Demo veri modu aktif. Canlı support personeli atama veya kalıcı kayıt özellikleri şu an sınırlıdır.</p>
        </div>
      ) : null}

    </main>
  );
}
