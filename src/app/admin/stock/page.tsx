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
