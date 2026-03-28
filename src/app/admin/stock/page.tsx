import Link from "next/link";
import { BackofficePage, FeatureLockedState } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { listStockMovements } from "@/lib/data";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getFeatureAccess } from "@/lib/plan-access";

export default async function AdminStockPage() {
  const locale = await getCurrentLocale();
  await requireRole(["admin"], "/admin/stock");
  const featureAccess = await getFeatureAccess("inventory_management");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title={translateUiText("Stok Hareketleri", locale)} description={translateUiText("Stok ve recete izleme", locale)}>
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
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-10 md:py-8">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Admin</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{translateUiText("Stok Hareketleri", locale)}</h1>
          </div>
          <Link href="/ops" className="w-full rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white sm:w-auto">
            {translateUiText("Panele Don", locale)}
          </Link>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            {translateUiText("Demo modda stok hareket gecmisi yok.", locale)}
          </p>
        ) : null}

        <section className="responsive-table-shell rounded-2xl bg-white p-4 shadow-sm">
          <table className="responsive-table w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">{translateUiText("Tarih", locale)}</th>
                <th className="py-2">{translateUiText("Ürün", locale)}</th>
                <th className="py-2">{translateUiText("Degisim", locale)}</th>
                <th className="py-2">{translateUiText("Onceki", locale)}</th>
                <th className="py-2">{translateUiText("Yeni", locale)}</th>
                <th className="py-2">{translateUiText("Neden", locale)}</th>
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
                    {translateUiText("Kayıt bulunamadi.", locale)}
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
