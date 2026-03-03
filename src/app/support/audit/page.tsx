import { requireSupportAccess } from "@/lib/auth";
import { listSupportAuditLogs } from "@/lib/data";

export default async function SupportAuditPage() {
  await requireSupportAccess("/support/audit", ["support_admin", "support_agent", "billing_agent"]);
  const { logs } = await listSupportAuditLogs({ limit: 100 });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Support Audit</p>
        <h1 className="text-3xl font-semibold text-slate-900">Merkez ekip islem kayitlari</h1>
      </header>

      <section className="space-y-4">
        {logs.map((log) => (
          <article key={log.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{log.entity_type}</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{log.action}</h2>
                <p className="mt-1 text-sm text-slate-500">{log.business_name || "Global"}</p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{log.actor_name || "Sistem"}</p>
                <p>{new Date(log.created_at).toLocaleString("tr-TR")}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
