import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  attachIngredientToProduct,
  bulkUpdateCategoryPrices,
  createCategory,
  createIngredient,
  createProduct,
  createProductModifierGroup,
  createProductModifierOption,
  deleteCategory,
  deleteIngredient,
  deleteProduct,
  deleteProductModifierGroup,
  deleteProductModifierOption,
  detachIngredientFromProduct,
  getProductManagementData,
  reorderCategories,
  updateProduct,
} from "@/lib/data";
import { requireRole } from "@/lib/auth";
import { BackofficePage, ContentCard, EmptyPanel, SummaryCard, WorkspaceTabs } from "@/components/backoffice-ui";
import { CategorySortManager } from "@/components/category-sort-manager";
import { logServerPerf, measureAsync } from "@/lib/perf";

async function addCategoryAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const name = formData.get("name");
  const sortOrder = Number(formData.get("sortOrder"));
  if (typeof name !== "string" || !Number.isFinite(sortOrder)) {
    return;
  }

  await createCategory(name, sortOrder);
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
}

async function reorderCategoriesAction(ids: string[]) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  await reorderCategories(ids);
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
}

async function deleteCategoryAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string") {
    return;
  }

  await deleteCategory(categoryId);
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
}

async function addProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const imageUrl = formData.get("imageUrl");

  if (typeof categoryId !== "string" || typeof name !== "string" || !Number.isFinite(price) || !Number.isFinite(stockCount)) {
    return;
  }

  await createProduct({
    categoryId,
    name,
    price,
    stockCount,
    description: typeof description === "string" ? description : undefined,
    imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
    isAvailable: true,
  });
  revalidatePath("/admin/products");
}

async function updateProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const imageUrl = formData.get("imageUrl");
  const isAvailable = formData.get("isAvailable") === "on";

  if (
    typeof productId !== "string" ||
    typeof categoryId !== "string" ||
    typeof name !== "string" ||
    !Number.isFinite(price) ||
    !Number.isFinite(stockCount)
  ) {
    return;
  }

  await updateProduct({
    productId,
    categoryId,
    name,
    price,
    stockCount,
    description: typeof description === "string" ? description : undefined,
    imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
    isAvailable,
  });
  revalidatePath("/admin/products");
}

async function deleteProductAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  if (typeof productId !== "string") {
    return;
  }

  await deleteProduct(productId);
  revalidatePath("/admin/products");
}

async function bulkPriceAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const percent = Number(formData.get("percent"));
  if (typeof categoryId !== "string" || !Number.isFinite(percent)) {
    return;
  }

  await bulkUpdateCategoryPrices(categoryId, percent);
  revalidatePath("/admin/products");
}

async function addIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const name = formData.get("name");
  const unit = formData.get("unit");
  if (typeof name !== "string" || typeof unit !== "string") {
    return;
  }
  await createIngredient(name, unit);
  revalidatePath("/admin/products");
}

async function deleteIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const ingredientId = formData.get("ingredientId");
  if (typeof ingredientId !== "string") {
    return;
  }
  await deleteIngredient(ingredientId);
  revalidatePath("/admin/products");
}

async function attachIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  const quantity = Number(formData.get("quantity"));
  if (typeof productId !== "string" || typeof ingredientId !== "string" || !Number.isFinite(quantity) || quantity <= 0) {
    return;
  }
  await attachIngredientToProduct({ productId, ingredientId, quantity });
  revalidatePath("/admin/products");
}

async function detachIngredientAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  if (typeof productId !== "string" || typeof ingredientId !== "string") {
    return;
  }
  await detachIngredientFromProduct(productId, ingredientId);
  revalidatePath("/admin/products");
}

async function addModifierGroupAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const name = formData.get("name");
  const minSelect = Number(formData.get("minSelect"));
  const maxSelect = Number(formData.get("maxSelect"));
  const isRequired = formData.get("isRequired") === "on";
  if (typeof productId !== "string" || typeof name !== "string") {
    return;
  }
  await createProductModifierGroup({ productId, name, minSelect, maxSelect, isRequired });
  revalidatePath("/admin/products");
}

async function addModifierOptionAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  const name = formData.get("name");
  const priceDelta = Number(formData.get("priceDelta"));
  const isDefault = formData.get("isDefault") === "on";
  if (typeof groupId !== "string" || typeof name !== "string") {
    return;
  }
  await createProductModifierOption({ groupId, name, priceDelta, isDefault });
  revalidatePath("/admin/products");
}

async function deleteModifierGroupAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  if (typeof groupId !== "string") {
    return;
  }
  await deleteProductModifierGroup(groupId);
  revalidatePath("/admin/products");
}

async function deleteModifierOptionAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/products");
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string") {
    return;
  }
  await deleteProductModifierOption(optionId);
  revalidatePath("/admin/products");
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; categoryId?: string }>;
}) {
  await requireRole(["admin"], "/admin/products");
  const { tab: tabParam, categoryId: categoryIdParam } = await searchParams;
  const activeTab = ["catalog", "menu", "categories", "bulk", "features"].includes(tabParam ?? "")
    ? (tabParam as "catalog" | "menu" | "categories" | "bulk" | "features")
    : "catalog";
  const productManagementResult = await measureAsync("product_management", () => getProductManagementData({ tab: activeTab }));
  const { categories, products, ingredients, modifierGroups, modifierOptions, productIngredients, usingDemoData } =
    productManagementResult.value;
  logServerPerf("/admin/products", [productManagementResult]);

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

  return (
    <BackofficePage
      title="Urun ve Kategori Yonetimi"
      description="Katalog, modifier, recete ve stok temel ayarlari"
      actions={
        <form action={addProductAction} className="flex flex-wrap items-center gap-3">
          <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:w-auto">
            {orderedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input name="name" required placeholder="Yeni urun" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-1" />
          <input name="price" type="number" min="0" step="0.01" required placeholder="Fiyat" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <input name="stockCount" type="number" min="0" required placeholder="Stok" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-28" />
          <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
            Yeni Urun
          </button>
        </form>
      }
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs
          tabs={[
            { label: "Urun & Kategori Yonetimi", active: activeTab === "catalog", href: "/admin/products?tab=catalog" },
            { label: "Menu Yonetimi", active: activeTab === "menu", href: "/admin/products?tab=menu" },
            { label: "Ana Kategoriler", active: activeTab === "categories", href: "/admin/products?tab=categories" },
            { label: "Toplu Islemler", active: activeTab === "bulk", href: "/admin/products?tab=bulk" },
            { label: "Urun Ozellikleri", active: activeTab === "features", href: "/admin/products?tab=features" },
          ]}
        />

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo veride kalici urun ve kategori aksiyonlari sinirlidir.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Kategori" value={String(orderedCategories.length)} hint="Toplam ana kategori" tone="accent" />
          <SummaryCard label="Urun" value={String(products.length)} hint="Tum kayitli urunler" />
          <SummaryCard label="Satista" value={String(availableProducts)} hint="Aktif ve gorunen urunler" tone="success" />
          <SummaryCard label="Kritik Stok" value={String(lowStockProducts)} hint="10 ve alti stoklu urun" tone={lowStockProducts > 0 ? "danger" : "neutral"} />
        </div>

        {activeTab === "catalog" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Kategoriler</h2>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                {orderedCategories.length}
              </span>
            </div>

            <form action={addCategoryAction} className="mt-4 grid gap-3">
              <input name="name" required placeholder="Yeni kategori" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
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
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Urunler</h2>
                  <p className="text-sm text-slate-500">Secili kategori: {selectedCategory?.name ?? "Kategori yok"}</p>
                </div>
                <form action={bulkPriceAction} className="flex flex-wrap items-center gap-3">
                  <select name="categoryId" required defaultValue={selectedCategoryId} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-auto">
                    {orderedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input name="percent" type="number" step="0.1" placeholder="Yuzde" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm sm:w-28" />
                  <button type="submit" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 sm:w-auto">
                    Toplu Guncelle
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

              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Urun Yok" description="Secili kategori icin urun kaydi bulunmuyor." />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <article key={product.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{product.name}</h3>
                          <p className="mt-2 text-sm text-slate-500">{product.description ?? "Aciklama girilmedi."}</p>
                        </div>
                        <form action={deleteProductAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <button type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            Sil
                          </button>
                        </form>
                      </div>

                      <form action={updateProductAction} className="mt-4 space-y-3">
                        <input type="hidden" name="productId" value={product.id} />
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
                        </div>
                        <input name="imageUrl" defaultValue={product.image_url ?? ""} placeholder="Gorsel URL" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                        <textarea name="description" rows={2} defaultValue={product.description ?? ""} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input name="isAvailable" type="checkbox" defaultChecked={product.is_available} />
                          Satisa acik
                        </label>
                        <button type="submit" className="rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white">
                          Kaydet
                        </button>
                      </form>

                      <div className="mt-4 space-y-3 rounded-[20px] bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">Recete</p>
                        {(ingredientsByProduct.get(product.id) ?? []).length === 0 ? <p className="text-sm text-slate-500">Malzeme baglanmamis.</p> : null}
                        {(ingredientsByProduct.get(product.id) ?? []).map((item) => (
                          <div key={`${product.id}-${item.ingredient_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                            <span className="text-slate-700">
                              {item.ingredientName} - {item.quantity} {item.unit}
                            </span>
                            <form action={detachIngredientAction}>
                              <input type="hidden" name="productId" value={product.id} />
                              <input type="hidden" name="ingredientId" value={item.ingredient_id} />
                              <button type="submit" className="text-xs font-semibold text-rose-700">
                                Cikar
                              </button>
                            </form>
                          </div>
                        ))}
                        <form action={attachIngredientAction} className="grid gap-2">
                          <input type="hidden" name="productId" value={product.id} />
                          <select name="ingredientId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                            <option value="">Malzeme sec</option>
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
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{group.name}</p>
                                <p className="text-xs text-slate-500">
                                  min {group.min_select} / max {group.max_select} {group.is_required ? "- zorunlu" : ""}
                                </p>
                              </div>
                              <form action={deleteModifierGroupAction}>
                                <input type="hidden" name="groupId" value={group.id} />
                                <button type="submit" className="text-xs font-semibold text-rose-700">
                                  Sil
                                </button>
                              </form>
                            </div>
                            <div className="mt-3 space-y-2">
                              {(optionsByGroup.get(group.id) ?? []).map((option) => (
                                <div key={option.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                  <span>
                                    {option.name} {Number(option.price_delta) > 0 ? `(+${Number(option.price_delta).toFixed(2)} TL)` : ""}
                                  </span>
                                  <form action={deleteModifierOptionAction}>
                                    <input type="hidden" name="optionId" value={option.id} />
                                    <button type="submit" className="text-xs font-semibold text-rose-700">
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
                              <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
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
                          <button type="submit" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                            Grup Ekle
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ContentCard title="Malzeme Kutuphanesi">
                <form action={addIngredientAction} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <input name="name" required placeholder="Yeni malzeme" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <input name="unit" required placeholder="Birim" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <button type="submit" className="rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white">
                    Ekle
                  </button>
                </form>
                <div className="mt-4 space-y-2">
                  {ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{ingredient.name}</p>
                        <p className="text-sm text-slate-500">{ingredient.unit}</p>
                      </div>
                      <form action={deleteIngredientAction}>
                        <input type="hidden" name="ingredientId" value={ingredient.id} />
                        <button type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                          Sil
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </ContentCard>

              <ContentCard title="Katalog Durumu">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam kategori</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{orderedCategories.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Toplam urun</p>
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

        {activeTab === "menu" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menu Kategorileri</h2>
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                  {orderedCategories.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {orderedCategories.map((category) => (
                  <div key={category.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-lg font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{productCountMap.get(category.id) ?? 0} menu urunu</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Menu Akisi</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {orderedCategories.map((category) => {
                  const isActive = category.id === selectedCategoryId;
                  return (
                    <Link
                      key={category.id}
                      href={`/admin/products?tab=menu&categoryId=${category.id}`}
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
                  <article key={product.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {orderedCategories.find((category) => category.id === product.category_id)?.name ?? "Kategori"}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-2 text-sm text-slate-500">{product.description ?? "Aciklama girilmedi."}</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{Number(product.price).toFixed(2)} TL</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {product.is_available ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
              {visibleProducts.length === 0 ? (
                <div className="mt-4">
                  <EmptyPanel title="Menu urunu yok" description="Secilen kategori altinda gosterilecek urun bulunmuyor." />
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === "categories" ? (
          <div className="mt-6">
            <ContentCard title="Ana Kategori Yonetimi">
              <CategorySortManager
                categories={orderedCategories.map((category) => ({
                  ...category,
                  productCount: productCountMap.get(category.id) ?? 0,
                }))}
                onReorder={reorderCategoriesAction}
                onDelete={deleteCategoryAction}
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
                <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">Toplu Fiyat Guncelle</button>
              </form>
            </ContentCard>
            <ContentCard title="Stok ve Fiyat Listesi">
              <div className="responsive-table-shell rounded-[22px] border border-slate-200">
                <table className="responsive-table w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Urun</th>
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

        {activeTab === "features" ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <ContentCard title="Malzeme Kutuphanesi">
              <form action={addIngredientAction} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <input name="name" required placeholder="Yeni malzeme" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <input name="unit" required placeholder="Birim" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <button type="submit" className="rounded-2xl bg-[#ff5a34] px-4 py-3 text-sm font-semibold text-white">Ekle</button>
              </form>
              <div className="mt-4 space-y-2">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{ingredient.name}</p>
                      <p className="text-sm text-slate-500">{ingredient.unit}</p>
                    </div>
                    <form action={deleteIngredientAction}>
                      <input type="hidden" name="ingredientId" value={ingredient.id} />
                      <button type="submit" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Sil</button>
                    </form>
                  </div>
                ))}
              </div>
            </ContentCard>
            <ContentCard title="Urun Ozellikleri">
              <div className="space-y-3">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-lg font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{(groupsByProduct.get(product.id) ?? []).length} modifier grubu • {(ingredientsByProduct.get(product.id) ?? []).length} malzeme</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </div>
        ) : null}
      </div>
    </BackofficePage>
  );
}
