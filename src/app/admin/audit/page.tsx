import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, SidebarPanel } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { listAuditLogs } from "@/lib/data";
import { getFeatureAccess } from "@/lib/plan-access";

export default async function AdminAuditPage() {
  await requireRole(["admin"], "/admin/audit");
  const featureAccess = await getFeatureAccess("audit_logs");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title="İşlem Loglari" description="Sistem hareketleri ve denetim kayıtları">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }
  const { logs, usingDemoData } = await listAuditLogs(250);

  return (
    <BackofficePage
      title="İşlem Loglari"
      description="Sistem hareketleri ve degisiklik gecmisi"
      sidebar={
        <SidebarPanel title="Filtreler">
          <div className="grid gap-3">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">İşlem Tipi</p>
              <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <option>Tumu</option>
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Kullanıcı</p>
              <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <option>Tumu</option>
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Arama</p>
              <input placeholder="Detay, ID veya kullanıcı ara..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            </div>
          </div>
        </SidebarPanel>
      }
      actions={
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">
            {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p className="text-sm text-slate-500">Son 250 kayıt</p>
        </div>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda audit kayıtları yok.
        </div>
      ) : null}

      <ContentCard title="Kayitlar">
        {logs.length === 0 ? (
          <EmptyPanel title="Kayıt Bulunamadi" description="Secili kriterlere uygun işlem bulunamadi." />
        ) : (
          <div className="responsive-table-shell rounded-[22px] border border-slate-200">
            <table className="responsive-table w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Tarih</th>
                  <th className="px-4 py-4 font-semibold">Entity</th>
                  <th className="px-4 py-4 font-semibold">Entity ID</th>
                  <th className="px-4 py-4 font-semibold">Aksiyon</th>
                  <th className="px-4 py-4 font-semibold">Detay</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 text-slate-700">{new Date(log.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{log.entity_type}</td>
                    <td className="px-4 py-4 text-slate-700">{log.entity_id}</td>
                    <td className="px-4 py-4 text-slate-700">{log.action}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      <pre className="whitespace-pre-wrap break-all font-mono">{JSON.stringify(log.details, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>
    </BackofficePage>
  );
}
