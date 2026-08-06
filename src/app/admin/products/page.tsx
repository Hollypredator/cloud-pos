import Link from "next/link";
import {
  getApplicationSettings,
  getProductManagementData,
} from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { BackofficePage, ContentCard, EmptyPanel, NoticeBanner, SummaryCard, WorkspaceTabs } from "@/components/backoffice-ui";
import { CategorySortManager } from "@/components/category-sort-manager";
import { FileDropInput } from "@/components/file-drop-input";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import type { ProductDepartment, ProductKind, ProductProfileScope, ProductUnit } from "@/lib/types";
import {
  addCategoryAction,
  updateCategoryStationAction,
  reorderCategoriesAction,
  deleteCategoryAction,
  addProductAction,
  updateProductAction,
  deleteProductAction,
  bulkPriceAction,
  marketImportDryRunAction,
  marketImportCommitAction,
  updateDemoCatalogFallbackAction,
  seedRestaurantDemoCatalogAction,
  addIngredientAction,
  updateIngredientAction,
  deleteIngredientAction,
  attachIngredientAction,
  detachIngredientAction,
  copyRecipeAction,
  addModifierGroupAction,
  addModifierOptionAction,
  deleteModifierGroupAction,
  deleteModifierOptionAction,
  resolveProductsFeedbackPath,
  resolveProductsReturnPath,
} from "./actions";
import { prepStationLabel } from "./action-helpers";



export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    categoryId?: string;
    productId?: string;
    q?: string;
    feedback?: string;
    tone?: "success" | "error";
  }>;
}) {
  const locale = await getCurrentLocale();
  await requireRole(["admin"], "/admin/products");
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = businessScope.activeBusinessType === "self_service_coffee";
  const { tab: tabParam, categoryId: categoryIdParam, productId: productIdParam, q: qParam, feedback, tone } = await searchParams;
  const allowedTabs: string[] = isSelfServiceCoffee
    ? ["catalog", "menü", "categories"]
    : ["catalog", "menü", "categories", "bulk", "features", "import", "recipe", "ingredients"];
  const activeTab = (allowedTabs.includes(tabParam ?? "") ? (tabParam ?? "catalog") : "catalog") as
    | "catalog"
    | "menü"
    | "categories"
    | "bulk"
    | "features"
    | "import"
    | "recipe"
    | "ingredients";
  const { settings: applicationSettings } = await getApplicationSettings();
  const dataTab = activeTab === "ingredients" ? "recipe" : activeTab;
  const productManagementResult = await measureAsync("product_management", () => getProductManagementData({ tab: dataTab }));
  const {
    categories,
    products,
    ingredients,
    modifierGroups,
    modifierOptions,
    productIngredients,
    usingDemoData,
    activeProfileScope,
  } =
    productManagementResult.value;
  logServerPerf("/admin/products", [productManagementResult]);
  const isMarketScope = activeProfileScope === "enterprise_market";

  const orderedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const productCountMap = new Map<string, number>();
  for (const product of products) {
    productCountMap.set(product.category_id, (productCountMap.get(product.category_id) ?? 0) + 1);
  }

  const ingredientsByProduct = new Map<
    string,
    Array<{ ingredient_id: string; quantity: number; ingredientName: string; unit: string }>
  >();
  for (const row of productIngredients) {
    if (!row.ingredient) continue;
    if (!ingredientsByProduct.has(row.product_id)) {
      ingredientsByProduct.set(row.product_id, []);
    }
    ingredientsByProduct.get(row.product_id)?.push({
      ingredient_id: row.ingredient_id,
      quantity: row.quantity,
      ingredientName: row.ingredient.name,
      unit: row.ingredient.unit,
    });
  }

  const groupsByProduct = new Map<string, typeof modifierGroups>();
  for (const group of modifierGroups) {
    if (!groupsByProduct.has(group.product_id)) {
      groupsByProduct.set(group.product_id, []);
    }
    groupsByProduct.get(group.product_id)?.push(group);
  }

  const optionsByGroup = new Map<string, typeof modifierOptions>();
  for (const option of modifierOptions) {
    if (!optionsByGroup.has(option.group_id)) {
      optionsByGroup.set(option.group_id, []);
    }
    optionsByGroup.get(option.group_id)?.push(option);
  }

  const firstCategoryId = orderedCategories[0]?.id ?? "";
  const selectedCategoryId = orderedCategories.some((category) => category.id === categoryIdParam) ? categoryIdParam ?? firstCategoryId : firstCategoryId;
  const selectedCategory = orderedCategories.find((category) => category.id === selectedCategoryId) ?? orderedCategories[0];
  const visibleProducts = products.filter((product) => product.category_id === selectedCategoryId);
  const availableProducts = products.filter((product) => product.is_available).length;
  const lowStockProducts = products.filter((product) => product.stock_count <= 10).length;
  const recipeQuery = (qParam ?? "").trim();
  const normalizedRecipeQuery = recipeQuery.toLocaleLowerCase("tr-TR");
  const recipeProducts = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
    .filter((product) =>
      normalizedRecipeQuery
        ? product.name.toLocaleLowerCase("tr-TR").includes(normalizedRecipeQuery)
        : true,
    );
  const selectedRecipeProductId = recipeProducts.some((product) => product.id === productIdParam)
    ? productIdParam ?? recipeProducts[0]?.id ?? ""
    : recipeProducts[0]?.id ?? "";
  const selectedRecipeProduct = products.find((product) => product.id === selectedRecipeProductId) ?? null;
  const selectedRecipeRows = selectedRecipeProduct
    ? (ingredientsByProduct.get(selectedRecipeProduct.id) ?? [])
    : [];
  const selectedRecipeTotalCost = selectedRecipeRows.reduce(
    (sum, item) => sum + item.quantity * (ingredients.find((ingredient) => ingredient.id === item.ingredient_id)?.cost ?? 0),
    0,
  );
  const selectedRecipeOverheadCost = Number(selectedRecipeProduct?.cost ?? 0);
  const selectedRecipeTotalUnitCost = selectedRecipeTotalCost + selectedRecipeOverheadCost;
  const selectedRecipePrice = Number(selectedRecipeProduct?.price ?? 0);
  const selectedRecipeProfit = selectedRecipePrice - selectedRecipeTotalUnitCost;
  const selectedRecipeMargin = selectedRecipePrice > 0 ? (selectedRecipeProfit / selectedRecipePrice) * 100 : 0;
  const sourceRecipeCandidates = recipeProducts.filter((product) => product.id !== selectedRecipeProductId);

  function buildRecipeHref(productId: string) {
    const params = new URLSearchParams();
    params.set("tab", "recipe");
    params.set("productId", productId);
    if (recipeQuery) {
      params.set("q", recipeQuery);
    }
    return `/admin/products?${params.toString()}`;
  }

  return (
    <BackofficePage
      title={isSelfServiceCoffee ? "Self Servis Ürün Yönetimi" : translateUiText("Ürün ve Kategori Yönetimi", locale)}
      description={isSelfServiceCoffee ? "Self servis menüsü ve Ürün fiyatlarini yönet." : translateUiText("Katalog, modifier, reçete ve stok temel ayarlari", locale)}
      actions={
        <form action={addProductAction} className="flex flex-wrap items-stretch gap-3">
          <input type="hidden" name="profileScope" value={activeProfileScope} />
          <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:w-auto">
            {orderedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input name="name" required placeholder={translateUiText("Yeni Ürün", locale)} className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-1" />
          <input name="price" type="number" min="0" step="0.01" required placeholder="Fiyat" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <input name="stockCount" type="number" min="0" required placeholder="Stok" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <input name="calories" type="number" min="0" placeholder="Kalori (kcal)" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <input name="calories" type="number" min="0" placeholder="Kalori (kcal)" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          {isMarketScope ? (
            <>
              <input name="barcode" placeholder="Barkod" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-36" />
              <input name="pluCode" placeholder="PLU" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-32" />
              <select name="productKind" defaultValue="standard" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-36">
                <option value="standard">Standart</option>
                <option value="weighted">Tartili</option>
                <option value="service">Servis</option>
              </select>
              <select name="unit" defaultValue="adet" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-32">
                <option value="adet">Adet</option>
                <option value="kg">Kg</option>
                <option value="gram">Gram</option>
                <option value="litre">Litre</option>
                <option value="ml">Ml</option>
                <option value="paket">Paket</option>
              </select>
              <select name="department" defaultValue="general" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-40">
                <option value="general">Genel</option>
                <option value="butcher">Kasap</option>
                <option value="delicatessen">Sarkuteri</option>
                <option value="bakery">Firin</option>
                <option value="produce">Manav</option>
                <option value="beverage">Icecek</option>
                <option value="frozen">Donuk</option>
                <option value="non_food">Gida Disi</option>
              </select>
            </>
          ) : null}
          <FileDropInput
            name="imageFile"
            label="Ürün gorseli"
            helper="Masaüstünden sürükle bırak ile ekleyebilirsin."
            className="w-full sm:min-w-[280px] sm:flex-1"
          />
          <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
            {translateUiText("Yeni Ürün", locale)}
          </button>
        </form>
      }
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs
          tabs={
            isSelfServiceCoffee
              ? [
                  { label: "Self Servis Katalog", active: activeTab === "catalog", href: "/admin/products?tab=catalog" },
                  { label: "Self Servis Menu", active: activeTab === "menü", href: "/admin/products?tab=menü" },
                  { label: "Kategoriler", active: activeTab === "categories", href: "/admin/products?tab=categories" },
                ]
              : [
                  { label: translateUiText("Ürün & Kategori Yönetimi", locale), active: activeTab === "catalog", href: "/admin/products?tab=catalog" },
                  { label: translateUiText("Menü Yönetimi", locale), active: activeTab === "menü", href: "/admin/products?tab=menü" },
                  { label: "Ana Kategoriler", active: activeTab === "categories", href: "/admin/products?tab=categories" },
                  { label: "Toplu Islemler", active: activeTab === "bulk", href: "/admin/products?tab=bulk" },
                  { label: "Recipe Studio", active: activeTab === "recipe", href: "/admin/products?tab=recipe" },
                  { label: "Malzeme Kutuphanesi", active: activeTab === "ingredients", href: "/admin/products?tab=ingredients" },
                  { label: "Market Import", active: activeTab === "import", href: "/admin/products?tab=import" },
                  { label: "Ürün Özellikleri", active: activeTab === "features", href: "/admin/products?tab=features" },
                ]
          }
        />

        <form action={updateDemoCatalogFallbackAction} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Demo menüyü otomatik kullan</p>
              <p className="mt-1 text-xs text-slate-500">
                Açıksa Ürün/kategori bosken gomulu demo katalog otomatik devreye girer.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                name="embeddedDemoCatalogEnabled"
                defaultChecked={applicationSettings.embeddedDemoCatalogEnabled}
                className="peer sr-only"
              />
              <span className="h-8 w-14 rounded-full bg-slate-300 transition peer-checked:bg-[#dc2626]" />
              <span className="absolute left-1 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-6" />
            </label>
          </div>
          <input type="hidden" name="embeddedDemoCatalogEnabled_present" value="1" />
          <div className="mt-3 flex justify-end">
            <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              Kaydet
            </button>
          </div>
        </form>

        {!isSelfServiceCoffee ? (
          <form action={seedRestaurantDemoCatalogAction} className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Hazır restoran kataloğu yükle</p>
                <p className="mt-1 text-xs text-slate-500">
                  Kahve, soguk icecek, firindan, tatli ve atistirmalik Ürünleri aktif işletmeye ekler.
                </p>
              </div>
              <button type="submit" className="rounded-xl bg-[#dc2626] px-4 py-2 text-xs font-semibold text-white">
                Hazır kataloğu yükle
              </button>
            </div>
          </form>
        ) : null}

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {translateUiText("Demo veride kalici ürün ve kategori aksiyonlari sinirlidir.", locale)}
          </div>
        ) : null}
        {feedback ? (
          <div className="mt-4">
            <NoticeBanner
              tone={tone === "error" ? "error" : "success"}
              title={tone === "error" ? "İşlem tamamlanamadi" : "İşlem tamamlandı"}
              description={feedback}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label={translateUiText("Kategori", locale)} value={String(orderedCategories.length)} hint={translateUiText("Toplam ana kategori", locale)} tone="accent" />
          <SummaryCard label={translateUiText("Ürün", locale)} value={String(products.length)} hint={translateUiText("Tüm kayitli ürünler", locale)} />
          <SummaryCard label={translateUiText("Satışta", locale)} value={String(availableProducts)} hint={translateUiText("Aktif ve görünen ürünler", locale)} tone="success" />
          <SummaryCard label={translateUiText("Kritik Stok", locale)} value={String(lowStockProducts)} hint={translateUiText("10 ve alti stoklu ürün", locale)} tone={lowStockProducts > 0 ? "danger" : "neutral"} />
        </div>

        {activeTab === "catalog" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Kategoriler</h2>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                {orderedCategories.length}
              </span>
            </div>

            <form action={addCategoryAction} className="mt-4 grid gap-3">
              <input type="hidden" name="profileScope" value={activeProfileScope} />
              <input name="name" required placeholder="Yeni kategori" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              {isSelfServiceCoffee ? (
                <input type="hidden" name="prepStation" value="bar" />
              ) : (
                <select name="prepStation" defaultValue="kitchen" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="kitchen">Mutfak Istasyonu</option>
                  <option value="bar">Bar Istasyonu</option>
                  <option value="dessert">Tatli Istasyonu</option>
                </select>
              )}
              <input
                name="sortOrder"
                type="number"
                defaultValue={orderedCategories.length + 1}
                required
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
                Yeni Kategori
              </button>
            </form>

            <div className="mt-4">
              <CategorySortManager
                categories={orderedCategories.map((category) => ({
                  ...category,
                  productCount: productCountMap.get(category.id) ?? 0,
                }))}
                onReorder={reorderCategoriesAction}
                onDelete={deleteCategoryAction}
                onStationUpdate={updateCategoryStationAction}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Ürünler</h2>
                  <p className="text-sm text-slate-500">Seçili kategori: {selectedCategory?.name ?? "Kategori yok"}</p>
                </div>
                <form action={bulkPriceAction} className="flex w-full flex-wrap items-stretch gap-3 lg:w-auto">
                  <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-auto">
                    {orderedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input name="percent" type="number" step="0.1" placeholder="Yuzde" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-28" />
                  <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 sm:w-auto">
                    Toplu Güncelle
                  </button>
                </form>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {orderedCategories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <Link
                      key={category.id}
                      href={`/admin/products?tab=catalog&categoryId=${category.id}`}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {category.name} ({productCountMap.get(category.id) ?? 0})
                    </Link>
                  );
                })}
              </div>

              {visibleProducts.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(() => {
                    const stats = visibleProducts.reduce((acc, p) => {
                      const recipeCost = (ingredientsByProduct.get(p.id) ?? []).reduce(
                        (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                        0
                      );
                      const totalCost = Number(p.cost ?? 0) + recipeCost;
                      const profit = Number(p.price) - totalCost;
                      const margin = Number(p.price) > 0 ? (profit / Number(p.price)) * 100 : 0;
                      
                      acc.totalProfit += profit;
                      acc.totalRevenue += Number(p.price);
                      acc.avgMarginSum += margin;
                      if (profit < 0) acc.lossCount++;
                      if (margin < 15 && profit >= 0) acc.warningCount++;
                      return acc;
                    }, { totalProfit: 0, totalRevenue: 0, avgMarginSum: 0, lossCount: 0, warningCount: 0 });

                    const avgMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;

                    return (
                      <>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ort. Kâr Marjı</p>
                          <p className={`mt-2 text-2xl font-bold ${avgMargin > 30 ? 'text-emerald-600' : avgMargin > 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                            %{avgMargin.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Potansiyel Kâr</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.totalProfit.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kritik Ürünler</p>
                          <p className={`mt-2 text-2xl font-bold ${stats.lossCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{stats.lossCount} Zarar</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Düşük Marj</p>
                          <p className={`mt-2 text-2xl font-bold ${stats.warningCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.warningCount} İncele</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Ürün Yok" description="Seçili kategori için ürün kaydı bulunmuyor." />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="relative min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                    <form action={updateProductAction} className="absolute right-4 top-4 z-10">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="profileScope" value={activeProfileScope} />
                      <input type="hidden" name="categoryId" value={product.category_id} />
                      <input type="hidden" name="name" value={product.name} />
                      <input type="hidden" name="price" value={String(product.price)} />
                      <input type="hidden" name="stockCount" value={String(product.stock_count)} />
                      <input type="hidden" name="barcode" value={product.barcode ?? ""} />
                      <input type="hidden" name="pluCode" value={product.plu_code ?? ""} />
                      <input type="hidden" name="productKind" value={product.product_kind ?? "standard"} />
                      <input type="hidden" name="unit" value={product.unit ?? "adet"} />
                      <input type="hidden" name="department" value={product.department ?? "general"} />
                      <input type="hidden" name="description" value={product.description ?? ""} />
                      <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                      <input type="hidden" name="cost" value={String(product.cost ?? 0)} />
                      <input type="hidden" name="calories" value={product.calories ? String(product.calories) : ""} />
                      <input type="hidden" name="isAvailable" value={product.is_available ? "off" : "on"} />
                      <button
                        type="submit"
                        className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                          product.is_available
                            ? "border-emerald-400 bg-emerald-500 hover:bg-emerald-400"
                            : "border-slate-300 bg-slate-200 hover:bg-slate-300"
                        }`}
                        aria-label={product.is_available ? `${product.name} pasif yap` : `${product.name} aktif yap`}
                        title={product.is_available ? "Kapat" : "Ac"}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            product.is_available ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                        <span className="sr-only">{product.is_available ? "Aktif" : "Pasif"}</span>
                      </button>
                    </form>
                    <details>
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                              </p>
                              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{product.name}</h3>
                              <p className="mt-2 line-clamp-1 text-sm text-slate-500">{product.description ?? "Açıklama girilmedi."}</p>
                              
                              {(() => {
                                const recipeCost = (ingredientsByProduct.get(product.id) ?? []).reduce(
                                  (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                                  0
                                );
                                const totalCost = Number(product.cost ?? 0) + recipeCost;
                                const totalRevenue = Number(product.price);
                                const profit = totalRevenue - totalCost;
                                const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
                                
                                const isCritical = profit < 0;
                                const isWarning = margin < 15 && profit >= 0;
                                
                                return (
                                  <div className="mt-4 space-y-3">
                                    <div className="flex items-end justify-between gap-4">
                                       <div className="flex flex-col">
                                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Satış Fiyatı</span>
                                         <span className="text-lg font-bold text-slate-900">{totalRevenue.toFixed(2)} TL</span>
                                       </div>
                                       <div className="flex flex-col text-right">
                                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tahmini Kâr</span>
                                         <span className={`text-lg font-bold ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                                           {profit.toFixed(2)} TL
                                         </span>
                                       </div>
                                    </div>
                                    
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                      <div 
                                        className={`absolute left-0 top-0 h-full transition-all duration-500 ${isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
                                      />
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                       <span className="text-slate-500">Maliyet: %{(100 - margin).toFixed(0)}</span>
                                       <span className={isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}>
                                         Marj: %{margin.toFixed(0)}
                                       </span>
                                    </div>

                                    {isCritical && (
                                      <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2 text-[10px] font-bold text-rose-700">
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-200">!</span>
                                        ZARAR EDİSİYOR: Fiyatı veya reçeteyi gözden geçirin.
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {product.is_available ? "Aktif" : "Pasif"}
                            </span>
                          </div>
                        </summary>

                        <div className="mt-4">
                          <form action={deleteProductAction} className="mb-4 w-full sm:w-auto">
                            <input type="hidden" name="productId" value={product.id} />
                            <button type="submit" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:w-auto">
                              Sil
                            </button>
                          </form>

                          <form action={updateProductAction} className="space-y-3">
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="profileScope" value={activeProfileScope} />
                            <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                            <select name="categoryId" defaultValue={product.category_id} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                              {orderedCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                            <input name="name" defaultValue={product.name} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input name="price" type="number" step="0.01" min="0" defaultValue={product.price} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              <input name="stockCount" type="number" min="0" defaultValue={product.stock_count} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Doğrudan Ek Maliyet / Overhead</label>
                                <input name="cost" type="number" step="0.01" min="0" defaultValue={product.cost ?? 0} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              </div>
                              <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Kalori (kcal)</label>
                                <input name="calories" type="number" min="0" defaultValue={product.calories ?? ""} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                              </div>
                            </div>
                            {isMarketScope ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <input name="barcode" defaultValue={product.barcode ?? ""} placeholder="Barkod" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                                <input name="pluCode" defaultValue={product.plu_code ?? ""} placeholder="PLU" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                                <select name="productKind" defaultValue={product.product_kind ?? "standard"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                  <option value="standard">Standart</option>
                                  <option value="weighted">Tartili</option>
                                  <option value="service">Servis</option>
                                </select>
                                <select name="unit" defaultValue={product.unit ?? "adet"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                                  <option value="adet">Adet</option>
                                  <option value="kg">Kg</option>
                                  <option value="gram">Gram</option>
                                  <option value="litre">Litre</option>
                                  <option value="ml">Ml</option>
                                  <option value="paket">Paket</option>
                                </select>
                                <select name="department" defaultValue={product.department ?? "general"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm md:col-span-2">
                                  <option value="general">Genel</option>
                                  <option value="butcher">Kasap</option>
                                  <option value="delicatessen">Sarkuteri</option>
                                  <option value="bakery">Firin</option>
                                  <option value="produce">Manav</option>
                                  <option value="beverage">Icecek</option>
                                  <option value="frozen">Donuk</option>
                                  <option value="non_food">Gida Disi</option>
                                </select>
                              </div>
                            ) : null}
                            <FileDropInput
                              name="imageFile"
                              label="Ürün gorseli"
                              helper={product.image_url ? "Yeni dosya birakirsan mevcut gorselin uzerine yazilir." : "Masaüstünden sürükle bırak ile görsel ekle."}
                            />
                            {product.image_url ? (
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input name="clearImage" type="checkbox" />
                                Mevcut gorseli kaldir
                              </label>
                            ) : null}
                            <textarea name="description" rows={2} defaultValue={product.description ?? ""} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input name="isAvailable" type="checkbox" defaultChecked={product.is_available} />
                              Satışa açık
                            </label>
                            <button type="submit" className="w-full rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white sm:w-auto">
                              Kaydet
                            </button>
                          </form>

                          <div className="mt-4 space-y-3 rounded-[20px] bg-slate-50 p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ürün Reçete Detayı</h4>
                            
                            <div className="mt-2 divide-y divide-slate-200">
                              {(ingredientsByProduct.get(product.id) ?? []).length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-500">Bu ürünün henüz bir reçetesi yok.</p>
                              ) : (
                                (ingredientsByProduct.get(product.id) ?? []).map((item) => {
                                  const ingredientDetail = ingredients.find(i => i.id === item.ingredient_id);
                                  const itemCost = (ingredientDetail?.cost ?? 0) * item.quantity;
                                  
                                  return (
                                    <div key={`${product.id}-${item.ingredient_id}`} className="grid grid-cols-[1fr_80px_100px_40px] items-center gap-3 py-3 text-sm">
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900">{item.ingredientName}</span>
                                        <span className="text-[10px] text-slate-500">Birim: {ingredientDetail?.cost.toFixed(2)} TL/{item.unit}</span>
                                      </div>
                                      <div className="text-right text-slate-600">
                                        {item.quantity} {item.unit}
                                      </div>
                                      <div className="text-right font-bold text-slate-900">
                                        {itemCost.toFixed(2)} TL
                                      </div>
                                      <form action={detachIngredientAction} className="flex justify-end">
                                        <input type="hidden" name="productId" value={product.id} />
                                        <input type="hidden" name="ingredientId" value={item.ingredient_id} />
                                        <button type="submit" className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100">
                                          &times;
                                        </button>
                                      </form>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {(ingredientsByProduct.get(product.id) ?? []).length > 0 && (
                              <div className="mt-2 border-t border-slate-200 pt-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                                  <span>Toplam Reçete Maliyeti</span>
                                  <span className="text-slate-900">
                                    {(ingredientsByProduct.get(product.id) ?? []).reduce(
                                      (sum, item) => sum + (item.quantity * (ingredients.find(i => i.id === item.ingredient_id)?.cost ?? 0)),
                                      0
                                    ).toFixed(2)} TL
                                  </span>
                                </div>
                              </div>
                            )}
                            <form action={attachIngredientAction} className="grid gap-2">
                              <input type="hidden" name="productId" value={product.id} />
                              <select name="ingredientId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                <option value="">Malzeme seç</option>
                                {ingredients.map((ingredient) => (
                                  <option key={ingredient.id} value={ingredient.id}>
                                    {ingredient.name} ({ingredient.unit})
                                  </option>
                                ))}
                              </select>
                              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input name="quantity" type="number" min="0.01" step="0.01" required placeholder="Miktar" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                                  Ekle
                                </button>
                              </div>
                            </form>
                          </div>

                          <div className="mt-4 space-y-3 rounded-[20px] bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">Modifier Gruplari</p>
                            {(groupsByProduct.get(product.id) ?? []).map((group) => (
                              <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">{group.name}</p>
                                    <p className="text-xs text-slate-500">
                                      min {group.min_select} / max {group.max_select} {group.is_required ? "- zorunlu" : ""}
                                    </p>
                                  </div>
                                  <form action={deleteModifierGroupAction} className="w-full sm:w-auto">
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <button type="submit" className="w-full text-left text-xs font-semibold text-rose-700 sm:w-auto sm:text-right">
                                      Sil
                                    </button>
                                  </form>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {(optionsByGroup.get(group.id) ?? []).map((option) => (
                                    <div key={option.id} className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center">
                                      <span className="min-w-0 break-words">
                                        {option.name} {Number(option.price_delta) > 0 ? `(+${Number(option.price_delta).toFixed(2)} TL)` : ""}
                                      </span>
                                      <form action={deleteModifierOptionAction} className="w-full sm:w-auto">
                                        <input type="hidden" name="optionId" value={option.id} />
                                        <button type="submit" className="w-full text-left text-xs font-semibold text-rose-700 sm:w-auto sm:text-right">
                                          Sil
                                        </button>
                                      </form>
                                    </div>
                                  ))}
                                </div>
                                <form action={addModifierOptionAction} className="mt-3 grid gap-2">
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <input name="name" required placeholder="Opsiyon adi" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                    <input name="priceDelta" type="number" step="0.01" defaultValue={0} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                                      <input name="isDefault" type="checkbox" />
                                      Varsayilan
                                    </label>
                                  </div>
                                  <button type="submit" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 sm:w-auto">
                                    Opsiyon Ekle
                                  </button>
                                </form>
                              </div>
                            ))}
                            <form action={addModifierGroupAction} className="grid gap-2">
                              <input type="hidden" name="productId" value={product.id} />
                              <input name="name" required placeholder="Yeni grup" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                              <div className="grid gap-2 md:grid-cols-3">
                                <input name="minSelect" type="number" min="0" defaultValue={0} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <input name="maxSelect" type="number" min="1" defaultValue={1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                                  <input name="isRequired" type="checkbox" />
                                  Zorunlu
                                </label>
                              </div>
                              <button type="submit" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 sm:w-auto">
                                Grup Ekle
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-1">
              <ContentCard title="Katalog Durumu">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam kategori</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{orderedCategories.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam ürün</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{products.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Modifier gruplari</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{modifierGroups.length}</p>
                  </div>
                </div>
              </ContentCard>
            </div>
          </section>
        </div>
        ) : null}

        {activeTab === "menü" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menü Kategorileri</h2>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                  {orderedCategories.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {orderedCategories.map((category) => (
                  <div key={category.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-lg font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{productCountMap.get(category.id) ?? 0} menü ürünü</p>
                    {!isSelfServiceCoffee ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{prepStationLabel(category.prep_station)} Istasyonu</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menü Akışı</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderedCategories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <Link
                      key={category.id}
                      href={`/admin/products?tab=menü&categoryId=${category.id}`}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {category.name}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article key={product.id} className="relative min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                    <form action={updateProductAction} className="absolute right-3 top-3 z-10">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="profileScope" value={activeProfileScope} />
                      <input type="hidden" name="categoryId" value={product.category_id} />
                      <input type="hidden" name="name" value={product.name} />
                      <input type="hidden" name="price" value={String(product.price)} />
                      <input type="hidden" name="stockCount" value={String(product.stock_count)} />
                      <input type="hidden" name="barcode" value={product.barcode ?? ""} />
                      <input type="hidden" name="pluCode" value={product.plu_code ?? ""} />
                      <input type="hidden" name="productKind" value={product.product_kind ?? "standard"} />
                      <input type="hidden" name="unit" value={product.unit ?? "adet"} />
                      <input type="hidden" name="department" value={product.department ?? "general"} />
                      <input type="hidden" name="description" value={product.description ?? ""} />
                      <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                      <input type="hidden" name="cost" value={String(product.cost ?? 0)} />
                      <input type="hidden" name="calories" value={product.calories ? String(product.calories) : ""} />
                      <input type="hidden" name="isAvailable" value={product.is_available ? "off" : "on"} />
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                          product.is_available
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        aria-label={product.is_available ? `${product.name} pasif yap` : `${product.name} aktif yap`}
                        title={product.is_available ? "Hızlı Pasif Yap" : "Hızlı Aktif Yap"}
                      >
                        {product.is_available ? "Aktif" : "Pasif"}
                      </button>
                    </form>
                    <div className="flex items-start gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                          Görsel Yok
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{product.description ?? "Açıklama girilmedi."}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col items-start justify-between gap-3 text-sm sm:flex-row sm:items-center">
                      <span className="font-semibold text-slate-900">{Number(product.price).toFixed(2)} TL</span>
                      <span className={`inline-flex w-full justify-center rounded-full px-3 py-1 text-xs font-semibold sm:w-auto ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {product.is_available ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <form action={updateProductAction} className="mt-4 grid gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="profileScope" value={activeProfileScope} />
                      <input type="hidden" name="categoryId" value={product.category_id} />
                      <input type="hidden" name="name" value={product.name} />
                      <input type="hidden" name="price" value={String(product.price)} />
                      <input type="hidden" name="stockCount" value={String(product.stock_count)} />
                      <input type="hidden" name="barcode" value={product.barcode ?? ""} />
                      <input type="hidden" name="pluCode" value={product.plu_code ?? ""} />
                      <input type="hidden" name="productKind" value={product.product_kind ?? "standard"} />
                      <input type="hidden" name="unit" value={product.unit ?? "adet"} />
                      <input type="hidden" name="department" value={product.department ?? "general"} />
                      <input type="hidden" name="description" value={product.description ?? ""} />
                      <input type="hidden" name="currentImageUrl" value={product.image_url ?? ""} />
                      <input type="hidden" name="calories" value={product.calories ? String(product.calories) : ""} />
                      <input type="hidden" name="isAvailable" value={product.is_available ? "on" : "off"} />
                      <FileDropInput name="imageFile" label="Ürün gorseli" helper="Dosyayi surukleyip bırak veya seç." />
                      {product.image_url ? (
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input name="clearImage" type="checkbox" />
                          Mevcut gorseli kaldir
                        </label>
                      ) : null}
                      <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                        Görseli Kaydet
                      </button>
                    </form>
                  </article>
                ))}
              </div>
              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Menü ürünü yok" description="Seçilen kategori altinda gösterilecek ürün bulunmuyor." />
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === "categories" ? (
          <div className="mt-6">
            <ContentCard title="Ana Kategori Yönetimi">
              <CategorySortManager
                categories={orderedCategories.map((category) => ({
                  ...category,
                  productCount: productCountMap.get(category.id) ?? 0,
                }))}
                onReorder={reorderCategoriesAction}
                onDelete={deleteCategoryAction}
                onStationUpdate={updateCategoryStationAction}
              />
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "bulk" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[420px_1fr]">
            <ContentCard title="Toplu Islemler">
              <form action={bulkPriceAction} className="grid gap-3">
                <select name="categoryId" required defaultValue={selectedCategoryId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {orderedCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <input name="percent" type="number" step="0.1" required placeholder="Yuzde degisim" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">Toplu Fiyat Güncelle</button>
              </form>
            </ContentCard>
            <ContentCard title="Stok ve Fiyat Listesi">
              <div className="responsive-table-shell rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Ürün</th>
                      <th className="px-4 py-4 font-semibold">Kategori</th>
                      <th className="px-4 py-4 font-semibold">Stok</th>
                      <th className="px-4 py-4 font-semibold">Fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-t border-slate-100">
                        <td className="px-4 py-4 font-semibold text-slate-900">{product.name}</td>
                        <td className="px-4 py-4 text-slate-700">{orderedCategories.find((category) => category.id === product.category_id)?.name ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-700">{product.stock_count}</td>
                        <td className="px-4 py-4 text-slate-700">{Number(product.price).toFixed(2)} TL</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "recipe" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <ContentCard title="Ürün Seçimi">
              <form method="get" className="mb-4 grid gap-2">
                <input type="hidden" name="tab" value="recipe" />
                <input
                  name="q"
                  defaultValue={recipeQuery}
                  placeholder="Ürün ara..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
                <button type="submit" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Filtrele
                </button>
              </form>
              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {recipeProducts.map((product) => {
                  const recipeCost = (ingredientsByProduct.get(product.id) ?? []).reduce(
                    (sum, item) => sum + item.quantity * (ingredients.find((ingredient) => ingredient.id === item.ingredient_id)?.cost ?? 0),
                    0,
                  );
                  const totalUnitCost = Number(product.cost ?? 0) + recipeCost;
                  const margin = Number(product.price) > 0 ? ((Number(product.price) - totalUnitCost) / Number(product.price)) * 100 : 0;
                  const isActive = product.id === selectedRecipeProductId;
                  return (
                    <Link
                      key={product.id}
                      href={buildRecipeHref(product.id)}
                      className={`block rounded-2xl border px-3 py-3 transition ${
                        isActive
                          ? "border-[#ff5a34] bg-[#fff2ee]"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Fiyat: {Number(product.price).toFixed(2)} TL</span>
                        <span className={margin < 15 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                          %{margin.toFixed(0)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ContentCard>

            <ContentCard title="Reçete Editoru">
              {!selectedRecipeProduct ? (
                <EmptyPanel title="Ürün seçilmedi" description="Soldaki listeden bir Ürün seçerek reçete duzenlemeye baslayin." />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-900">{selectedRecipeProduct.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {orderedCategories.find((category) => category.id === selectedRecipeProduct.category_id)?.name ?? "Kategori"}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fiyat</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipePrice.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reçete</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipeTotalCost.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toplam Maliyet</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedRecipeTotalUnitCost.toFixed(2)} TL</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marj</p>
                        <p className={`mt-1 text-sm font-semibold ${selectedRecipeMargin < 15 ? "text-amber-700" : "text-emerald-700"}`}>
                          %{selectedRecipeMargin.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Reçete Kalemleri</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedRecipeRows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">Bu ürünün henuz reçetesi yok.</p>
                      ) : (
                        selectedRecipeRows.map((item) => {
                          const ingredientDetail = ingredients.find((ingredient) => ingredient.id === item.ingredient_id);
                          const ingredientUnitCost = Number(ingredientDetail?.cost ?? 0);
                          return (
                            <form key={`${selectedRecipeProduct.id}-${item.ingredient_id}`} action={attachIngredientAction} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_120px_110px_auto_auto] sm:items-center">
                              <input type="hidden" name="productId" value={selectedRecipeProduct.id} />
                              <input type="hidden" name="ingredientId" value={item.ingredient_id} />
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.ingredientName}</p>
                                <p className="text-xs text-slate-500">{ingredientUnitCost.toFixed(2)} TL / {item.unit}</p>
                              </div>
                              <input
                                name="quantity"
                                type="number"
                                min="0.01"
                                step="0.01"
                                defaultValue={item.quantity}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                              />
                              <p className="text-right text-sm font-semibold text-slate-900">
                                {(ingredientUnitCost * item.quantity).toFixed(2)} TL
                              </p>
                              <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                Güncelle
                              </button>
                              <button formAction={detachIngredientAction} type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                Çıkar
                              </button>
                            </form>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <form action={attachIngredientAction} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                    <input type="hidden" name="productId" value={selectedRecipeProduct.id} />
                    <select name="ingredientId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="">Malzeme seç</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} ({ingredient.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      name="quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="Miktar"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-xl bg-[#ff5a34] px-4 py-2 text-sm font-semibold text-white">
                      Kalem Ekle
                    </button>
                  </form>

                  <form action={copyRecipeAction} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <input type="hidden" name="targetProductId" value={selectedRecipeProduct.id} />
                    <select name="sourceProductId" required className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <option value="">Reçete kopyalanacak ürünü seç</option>
                      {sourceRecipeCandidates.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                      Reçeteyi Kopyala
                    </button>
                  </form>
                </div>
              )}
            </ContentCard>

            <ContentCard title="Hızlı Maliyet Yönetimi">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Malzeme birim maliyetini hizli güncelleyin. Reçete maliyeti aninda yansir.
                </div>
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {ingredients.map((ingredient) => (
                    <form key={ingredient.id} action={updateIngredientAction} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input type="hidden" name="ingredientId" value={ingredient.id} />
                      <input type="hidden" name="name" value={ingredient.name} />
                      <input type="hidden" name="unit" value={ingredient.unit} />
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{ingredient.name}</p>
                          <p className="text-xs text-slate-500">{ingredient.unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            name="cost"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={Number(ingredient.cost ?? 0).toFixed(2)}
                            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                          <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "import" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <ContentCard title="Market Import">
              {isMarketScope ? (
                <form action={marketImportDryRunAction} className="grid gap-3">
                  <textarea
                    name="importPayload"
                    required
                    rows={14}
                    placeholder='[{"category_name":"Kasap","name":"Dana Kiyma","price":420,"stock_count":25}]'
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input name="replaceScope" type="checkbox" />
                    Sadece market scope kayıtlarını temizleyip yeniden yükle
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                      Dry-run Calistir
                    </button>
                    <button formAction={marketImportCommitAction} type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
                      Commit Import
                    </button>
                  </div>
                </form>
              ) : (
                <EmptyPanel
                  title="Market profile gerekli"
                  description="Market import yalnızca enterprise_market scope aktifken kullanilabilir."
                />
              )}
            </ContentCard>

            <ContentCard title="Import Kurallari">
              <div className="space-y-3 text-sm text-slate-600">
                <p>JSON array formatinda satirlar beklenir.</p>
                <p>Zorunlu alanlar: <code>category_name</code> ve <code>name</code>.</p>
                <p>Opsiyonel alanlar: <code>price</code>, <code>stock_count</code>, <code>barcode</code>, <code>plu_code</code>, <code>product_kind</code>, <code>unit</code>, <code>department</code>, <code>image_url</code>, <code>description</code>, <code>is_available</code>.</p>
                <p>Dry-run sonucu cakışma/hata varsa commit engellenir.</p>
                <p>Commit işlemi transaction ile calisir; hata durumunda rollback olur.</p>
              </div>
            </ContentCard>
          </div>
        ) : null}

        {activeTab === "features" ? (
          <div className="mt-6">
            <ContentCard title="Ürün Özellikleri">
              <div className="space-y-3">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{(groupsByProduct.get(product.id) ?? []).length} modifier grubu - {(ingredientsByProduct.get(product.id) ?? []).length} malzeme</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </div>
        ) : null}
        {activeTab === "ingredients" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
            <ContentCard title="Malzeme Kutuphanesi">
              <form action={addIngredientAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                <input name="name" required placeholder="Yeni malzeme (orn: Mozzarella)" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input name="unit" required placeholder="Birim" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input name="cost" type="number" step="0.01" required placeholder="Maliyet" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <button type="submit" className="rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white">Ekle</button>
              </form>
              <div className="mt-4 space-y-3">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <form action={updateIngredientAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_auto_auto] md:items-center">
                      <input type="hidden" name="ingredientId" value={ingredient.id} />
                      <input name="name" defaultValue={ingredient.name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900" />
                      <input name="unit" defaultValue={ingredient.unit} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
                      <input name="cost" type="number" step="0.01" defaultValue={Number(ingredient.cost ?? 0).toFixed(2)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Güncelle</button>
                      <button formAction={deleteIngredientAction} type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Sil</button>
                    </form>
                  </div>
                ))}
              </div>
            </ContentCard>

            <ContentCard title="Malzeme Ozeti">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Toplam malzeme</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ingredients.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Reçetede kullanilan Ürün</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {products.filter((product) => (ingredientsByProduct.get(product.id) ?? []).length > 0).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Bu sekme yalnızca malzeme kartlarini yönetmek icindir. Reçete baglama ve Ürün bazli maliyet akışı icin Recipe Studio tabini kullanin.
                </div>
              </div>
            </ContentCard>
          </div>
        ) : null}
      </div>
    </BackofficePage>
  );
}