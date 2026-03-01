import Link from "next/link";
import { BackofficePage, FeatureLockedState } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { listStockMovements } from "@/lib/data";
import { getFeatureAccess } from "@/lib/plan-access";

export default async function AdminStockPage() {
  await requireRole(["admin"], "/admin/stock");
  const featureAccess = await getFeatureAccess("inventory_management");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title="Stok Hareketleri" description="Stok ve recete izleme">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }
  const { movements, usingDemoData } = await listStockMovements(150);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Admin</p>
            <h1 className="text-3xl font-semibold text-slate-900">Stok Hareketleri</h1>
          </div>
          <Link href="/ops" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Panele Don
          </Link>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Demo modda stok hareket gecmisi yok.
          </p>
        ) : null}

        <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Tarih</th>
                <th className="py-2">Urun</th>
                <th className="py-2">Degisim</th>
                <th className="py-2">Onceki</th>
                <th className="py-2">Yeni</th>
                <th className="py-2">Neden</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-700">
                    {new Date(row.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-2 font-medium text-slate-900">{row.product_name ?? row.product_id}</td>
                  <td
                    className={`py-2 font-semibold ${
                      row.change_amount >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {row.change_amount >= 0 ? `+${row.change_amount}` : row.change_amount}
                  </td>
                  <td className="py-2 text-slate-700">{row.previous_stock}</td>
                  <td className="py-2 text-slate-700">{row.new_stock}</td>
                  <td className="py-2 text-slate-700">{row.reason}</td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Kayit bulunamadi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
