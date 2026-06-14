import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BackofficePage, FeatureLockedState } from "@/components/backoffice-ui";
import { AdminStockWorkbench } from "@/components/admin-stock-workbench";
import { requireRole } from "@/lib/auth";
import { bulkAdjustStocks, getProductManagementData, listStockMovements } from "@/lib/data";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { getFeatureAccess } from "@/lib/plan-access";
import { getBusinessScopeContext } from "@/lib/server/app-context";

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; lowOnly?: string; remainingOnly?: string }>;
}) {
  const locale = await getCurrentLocale();
  const params = (await searchParams) ?? {};
  const initialQuery = String(params.q ?? "");
  const initialLowOnly = params.lowOnly === "1" || params.lowOnly === "true";
  const initialRemainingOnly = params.remainingOnly === "1" || params.remainingOnly === "true";

  await requireRole(["admin"], "/admin/stock");
  const featureAccess = await getFeatureAccess("inventory_management");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title={translateUiText("Stok Hareketleri", locale)} description={translateUiText("Stok ve reçete izleme", locale)}>
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }

  async function bulkAdjustStocksAction(input: { reason: string; items: Array<{ productId: string; newStock: number }> }) {
    "use server";
    const result = await bulkAdjustStocks(input);
    revalidatePath("/admin/stock");
    return result;
  }

  const [{ movements, usingDemoData }, { products, categories }, businessScope] = await Promise.all([
    listStockMovements(200),
    getProductManagementData(),
    getBusinessScopeContext(),
  ]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef2f7_0%,#f8fafc_42%,#ffffff_100%)] px-4 py-6 md:px-10 md:py-8">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Admin</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{translateUiText("Stok Sayım ve Hareketleri", locale)}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {translateUiText("Ürün stoklarını vardiya öncesi sayın, düşük stok risklerini görün ve son hareketleri tek ekranda takip edin.", locale)}
              </p>
            </div>
            <Link href="/ops" className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto">
              {translateUiText("Panele Dön", locale)}
            </Link>
          </div>
        </header>

        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            {translateUiText("Demo modda stok hareket geçmişi yok.", locale)}
          </p>
        ) : null}

        <AdminStockWorkbench
          locale={locale}
          products={products}
          categories={categories}
          movements={movements}
          activeBusinessType={businessScope.activeBusinessType}
          initialQuery={initialQuery}
          initialLowOnly={initialLowOnly}
          initialRemainingOnly={initialRemainingOnly}
          onBulkAdjust={bulkAdjustStocksAction}
        />
      </main>
    </div>
  );
}
