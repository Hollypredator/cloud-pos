import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BackofficePage, FeatureLockedState } from "@/components/backoffice-ui";
import { AdminStockWorkbench } from "@/components/admin-stock-workbench";
import { IngredientStockPanel } from "@/components/ingredient-stock-panel";
import { requireRole } from "@/lib/auth";
import {
  bulkAdjustStocks,
  getIngredientStockOverview,
  getProductManagementData,
  listStockMovements,
  saveIngredientCount,
  saveIngredientPurchase,
} from "@/lib/data";
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

  async function saveIngredientCountAction(input: {
    startedAt: string;
    reason: string;
    items: Array<{ ingredientId: string; countedQuantity: number }>;
  }) {
    "use server";
    await requireRole(["admin"], "/admin/stock");
    const result = await saveIngredientCount(input);
    revalidatePath("/admin/stock");
    return result;
  }

  async function saveIngredientPurchaseAction(input: {
    note: string;
    items: Array<{ ingredientId: string; quantity: number; unitCost: number }>;
  }) {
    "use server";
    await requireRole(["admin"], "/admin/stock");
    const result = await saveIngredientPurchase(input);
    revalidatePath("/admin/stock");
    return result;
  }

  const [{ movements, usingDemoData }, { products, categories, productIngredients }, businessScope, ingredientStock] =
    await Promise.all([
      listStockMovements(200),
      getProductManagementData(),
      getBusinessScopeContext(),
      getIngredientStockOverview(),
    ]);

  // Ürün Stoğu bölümü yalnızca reçetesiz ürünleri gösterir (bkz. başlık:
  // "Reçetesi olmayan, doğrudan satılan ürünler"). Filtre olmadan reçeteli
  // her ürün (Latte vb.) İKİ panelde birden görünürdü: malzeme panelinde
  // doğru şekilde (reçetesinden), ürün panelinde ise yanıltıcı şekilde
  // (sanki elle sayılan bağımsız bir stoğu varmış gibi). Tam da tek liste
  // kararının (D13) önlemeye çalıştığı çift sayım.
  const productIdsWithRecipe = new Set(productIngredients.map((row) => row.product_id));
  const stockableProducts = products.filter((product) => !productIdsWithRecipe.has(product.id));

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

        {/* Malzeme sayimi ayni ekranda: personel tek yerde sayar. Iki ayri
            ekran, iki ayri sayim ve iki kaynakli fark raporu demekti. */}
        <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
          <header className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Malzeme Stoğu</h2>
            <p className="mt-1 text-sm text-slate-600">
              Reçeteye bağlı hammaddeler. Satış bunlardan düşer; sayım farkı zayiatı gösterir.
            </p>
          </header>
          <IngredientStockPanel
            rows={ingredientStock.rows}
            schemaReady={ingredientStock.schemaReady}
            onSaveCount={saveIngredientCountAction}
            onSavePurchase={saveIngredientPurchaseAction}
          />
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
          <header className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Ürün Stoğu</h2>
            <p className="mt-1 text-sm text-slate-600">
              Reçetesi olmayan, doğrudan satılan ürünler: şişe su, hazır tatlı, paketli ürün.
            </p>
          </header>
        <AdminStockWorkbench
          locale={locale}
          products={stockableProducts}
          categories={categories}
          movements={movements}
          activeBusinessType={businessScope.activeBusinessType}
          initialQuery={initialQuery}
          initialLowOnly={initialLowOnly}
          initialRemainingOnly={initialRemainingOnly}
          onBulkAdjust={bulkAdjustStocksAction}
        />
        </section>
      </main>
    </div>
  );
}
