"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  attachIngredientToProduct,
  bulkUpdateCategoryPrices,
  commitEnterpriseMarketImport,
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
  dryRunEnterpriseMarketImport,
  getApplicationSettings,
  getProductManagementData,
  reorderCategories,
  uploadMediaFile,
  updateCategoryPrepStation,
  updateApplicationSettings,
  updateIngredient,
  updateProduct,
} from "@/lib/data";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Category,
  Product,
  BusinessType,
  ProductModifierGroup,
  ProductModifierOption,
  SiteContent
} from "@/lib/types";
import {
  normalizePrepStation,
  normalizeProfileScope,
  normalizeOptionalText,
  normalizeProductKind,
  normalizeProductUnit,
  normalizeProductDepartment,
  isUuidLike,
  normalizeCatalogName,
  isDuplicateError,
  restaurantDemoCatalogSeed,
  restaurantDemoIngredientsSeed,
  buildRestaurantDemoRecipe,
  formatDryRunSummary,
  actionErrorMessage,
} from "./action-helpers";


export async function resolveProductsReturnPath() {
  const headerStore = await headers();
  const referer = headerStore.get("referer");
  if (!referer) {
    return "/admin/products";
  }

  try {
    const url = new URL(referer);
    if (url.pathname.startsWith("/admin/products")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/admin/products";
  }

  return "/admin/products";
}

export async function resolveProductsFeedbackPath(tone: "success" | "error", feedback: string) {
  const basePath = await resolveProductsReturnPath();
  const url = new URL(basePath, "http://localhost");
  url.searchParams.set("tone", tone);
  url.searchParams.set("feedback", feedback);
  return `${url.pathname}${url.search}`;
}

export async function resolveProductImageUrl(input: {
  formData: FormData;
  currentImageUrl?: string;
}) {
  const clearImage = input.formData.get("clearImage") === "on";
  let imageUrl = input.currentImageUrl?.trim() || undefined;
  if (clearImage) {
    imageUrl = undefined;
  }

  const imageFile = input.formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploadResult = await uploadMediaFile(imageFile);
    if (!uploadResult.ok) {
      return { ok: false as const, error: uploadResult.error };
    }
    imageUrl = uploadResult.fileUrl;
  }

  return { ok: true as const, imageUrl };
}

// Server Actions
export async function addCategoryAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const name = formData.get("name");
  const sortOrder = Number(formData.get("sortOrder"));
  const prepStation = normalizePrepStation(formData.get("prepStation"));
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  if (typeof name !== "string" || !Number.isFinite(sortOrder)) {
    redirect(await resolveProductsFeedbackPath("error", "Kategori bilgisi geçersiz."));
  }

  const result = await createCategory(name, sortOrder, prepStation, profileScope);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function updateCategoryStationAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const prepStation = normalizePrepStation(formData.get("prepStation"));
  if (typeof categoryId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Kategori seçimi geçersiz."));
  }

  const result = await updateCategoryPrepStation(categoryId, prepStation);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Istasyon güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function reorderCategoriesAction(ids: string[]) {
  await requireRole(["admin"], "/admin/products");
  const result = await reorderCategories(ids);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori sırası güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function deleteCategoryAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Kategori seçimi geçersiz."));
  }

  const result = await deleteCategory(categoryId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Kategori silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function addProductAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  const barcode = normalizeOptionalText(formData.get("barcode"));
  const pluCode = normalizeOptionalText(formData.get("pluCode"));
  const productKind = normalizeProductKind(formData.get("productKind"));
  const unit = normalizeProductUnit(formData.get("unit"));
  const department = normalizeProductDepartment(formData.get("department"));
  const caloriesVal = formData.get("calories");
  const calories = caloriesVal ? Number(caloriesVal) : null;

  if (typeof categoryId !== "string" || typeof name !== "string" || !Number.isFinite(price) || !Number.isFinite(stockCount)) {
    redirect(await resolveProductsFeedbackPath("error", "Ürün bilgileri geçersiz."));
  }

  const imageResult = await resolveProductImageUrl({ formData });
  if (!imageResult.ok) {
    redirect(await resolveProductsFeedbackPath("error", imageResult.error || "Görsel yüklenemedi."));
  }

  const result = await createProduct({
    categoryId,
    name,
    price,
    stockCount,
    profileScope,
    description: typeof description === "string" ? description : undefined,
    imageUrl: imageResult.imageUrl,
    isAvailable: true,
    barcode,
    pluCode,
    productKind,
    unit,
    department,
    cost: Number(formData.get("cost") ?? 0),
    calories: Number.isFinite(calories) ? calories : null,
  });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function updateProductAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockCount = Number(formData.get("stockCount"));
  const description = formData.get("description");
  const currentImageUrl = String(formData.get("currentImageUrl") ?? "");
  const isAvailable = formData.get("isAvailable") === "on";
  const profileScope = normalizeProfileScope(formData.get("profileScope"));
  const barcode = normalizeOptionalText(formData.get("barcode"));
  const pluCode = normalizeOptionalText(formData.get("pluCode"));
  const productKind = normalizeProductKind(formData.get("productKind"));
  const unit = normalizeProductUnit(formData.get("unit"));
  const department = normalizeProductDepartment(formData.get("department"));
  const caloriesVal = formData.get("calories");
  const calories = caloriesVal ? Number(caloriesVal) : null;

  if (
    typeof productId !== "string" ||
    typeof categoryId !== "string" ||
    typeof name !== "string" ||
    !Number.isFinite(price) ||
    !Number.isFinite(stockCount)
  ) {
    redirect(await resolveProductsFeedbackPath("error", "Ürün güncelleme bilgileri geçersiz."));
  }

  if (!isUuidLike(productId)) {
    redirect(await resolveProductsFeedbackPath("error", "Bu ürün demo kaydı. Canlı veri olmadan aktif/pasif değiştirilemez."));
  }

  const imageResult = await resolveProductImageUrl({ formData, currentImageUrl });
  if (!imageResult.ok) {
    redirect(await resolveProductsFeedbackPath("error", imageResult.error || "Görsel yüklenemedi."));
  }

  const result = await updateProduct({
    productId,
    categoryId,
    name,
    price,
    stockCount,
    profileScope,
    description: typeof description === "string" ? description : undefined,
    imageUrl: imageResult.imageUrl,
    isAvailable,
    barcode,
    pluCode,
    productKind,
    unit,
    department,
    cost: Number(formData.get("cost") ?? 0),
    calories: Number.isFinite(calories) ? calories : null,
  });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function deleteProductAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const productId = formData.get("productId");
  if (typeof productId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Ürün seçimi geçersiz."));
  }

  const result = await deleteProduct(productId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Ürün silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function bulkPriceAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const categoryId = formData.get("categoryId");
  const percent = Number(formData.get("percent"));
  if (typeof categoryId !== "string" || !Number.isFinite(percent)) {
    redirect(await resolveProductsFeedbackPath("error", "Toplu fiyat bilgileri geçersiz."));
  }

  const result = await bulkUpdateCategoryPrices(categoryId, percent);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Toplu fiyat güncelleme başarısız.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function marketImportDryRunAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const payload = formData.get("importPayload");
  const replaceScope = formData.get("replaceScope") === "on";
  if (typeof payload !== "string" || !payload.trim()) {
    redirect(await resolveProductsFeedbackPath("error", "Import JSON alani bos olamaz."));
  }

  const result = await dryRunEnterpriseMarketImport({
    jsonText: payload,
    replaceScope,
  });
  if (!result.ok) {
    const summary = result.summary
      ? formatDryRunSummary(result.summary)
      : result.error ?? "Dry-run tamamlanamadi.";
    redirect(await resolveProductsFeedbackPath("error", summary));
  }

  redirect(await resolveProductsFeedbackPath("success", formatDryRunSummary(result.summary)));
}

export async function marketImportCommitAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const payload = formData.get("importPayload");
  const replaceScope = formData.get("replaceScope") === "on";
  if (typeof payload !== "string" || !payload.trim()) {
    redirect(await resolveProductsFeedbackPath("error", "Import JSON alani bos olamaz."));
  }

  const result = await commitEnterpriseMarketImport({
    jsonText: payload,
    replaceScope,
  });
  if (!result.ok) {
    const summary = result.summary
      ? formatDryRunSummary(result.summary)
      : result.error ?? "Import commit başarısız.";
    redirect(await resolveProductsFeedbackPath("error", summary));
  }

  redirect(await resolveProductsFeedbackPath("success", `Import tamamlandi. ${formatDryRunSummary(result.summary)}`));
}

export async function updateDemoCatalogFallbackAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const { settings: currentSettings } = await getApplicationSettings();
  const hasField =
    formData.has("embeddedDemoCatalogEnabled_present") || formData.has("embeddedDemoCatalogEnabled");
  const nextSettings = {
    ...currentSettings,
    embeddedDemoCatalogEnabled: hasField
      ? formData.get("embeddedDemoCatalogEnabled") === "on"
      : currentSettings.embeddedDemoCatalogEnabled,
  };
  await updateApplicationSettings(nextSettings);
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders");
}

export async function seedRestaurantDemoCatalogAction() {
  await requireRole(["admin"], "/admin/products");

  const scope = await getBusinessScopeContext();
  if (scope.activeBusinessType !== "restaurant_cafe") {
    redirect(await resolveProductsFeedbackPath("error", "Bu aksiyon sadece restaurant/cafe profili icin kullanilabilir."));
  }
  if (!scope.businessId) {
    redirect(await resolveProductsFeedbackPath("error", "Aktif işletme bulunamadı."));
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    redirect(await resolveProductsFeedbackPath("error", "Servis bağlantısı bulunamadı."));
  }

  let categoryRows:
    | Array<{ id: string; name: string }>
    | null = null;
  let productRows:
    | Array<{ id: string; name: string; category_id: string }>
    | null = null;

  const categoryWithScope = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (categoryWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const categoryFallback = await supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", scope.businessId);
    if (categoryFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: categoryFallback.error.message }, "Kategori listesi okunamadi.")));
    }
    categoryRows = (categoryFallback.data ?? []) as Array<{ id: string; name: string }>;
  } else if (categoryWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: categoryWithScope.error.message }, "Kategori listesi okunamadi.")));
  } else {
    categoryRows = (categoryWithScope.data ?? []) as Array<{ id: string; name: string }>;
  }

  const productWithScope = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (productWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const productFallback = await supabase
      .from("products")
      .select("id, name, category_id")
      .eq("business_id", scope.businessId);
    if (productFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: productFallback.error.message }, "Ürün listesi okunamadi.")));
    }
    productRows = (productFallback.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  } else if (productWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: productWithScope.error.message }, "Ürün listesi okunamadi.")));
  } else {
    productRows = (productWithScope.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  }

  const categoryByName = new Map<string, { id: string; name: string }>(
    (categoryRows ?? []).map((row) => [normalizeCatalogName(row.name), row]),
  );

  let createdCategoryCount = 0;
  for (const category of restaurantDemoCatalogSeed.categories) {
    const key = normalizeCatalogName(category.name);
    if (categoryByName.has(key)) {
      continue;
    }
    const created = await createCategory(category.name, category.sortOrder, category.prepStation, "restaurant");
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Hazır kategori yüklenemedi.")));
    }
    if (created.ok) {
      if (created.id) {
        categoryByName.set(key, { id: created.id, name: category.name });
      }
      createdCategoryCount += 1;
    }
  }

  const latestCategories = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (!latestCategories.error) {
    for (const row of (latestCategories.data ?? []) as Array<{ id: string; name: string }>) {
      categoryByName.set(normalizeCatalogName(row.name), row);
    }
  }

  const existingProductKeys = new Set(
    (productRows ?? []).map((row) => `${row.category_id}::${normalizeCatalogName(row.name)}`),
  );

  let createdProductCount = 0;
  for (const product of restaurantDemoCatalogSeed.products) {
    const category = categoryByName.get(normalizeCatalogName(product.categoryName));
    if (!category) {
      continue;
    }
    const key = `${category.id}::${normalizeCatalogName(product.name)}`;
    if (existingProductKeys.has(key)) {
      continue;
    }
    const created = await createProduct({
      categoryId: category.id,
      name: product.name,
      price: product.price,
      stockCount: product.stockCount,
      profileScope: "restaurant",
      description: product.description,
      isAvailable: true,
    });
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Hazır Ürünler yüklenemedi.")));
    }
    if (created.ok) {
      existingProductKeys.add(key);
      createdProductCount += 1;
    }
  }

  let ingredientRows: Array<{ id: string; name: string }> = [];
  const ingredientScoped = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("business_id", scope.businessId);
  if (ingredientScoped.error?.message?.toLowerCase().includes("business_id")) {
    const ingredientFallback = await supabase
      .from("ingredients")
      .select("id, name");
    if (ingredientFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: ingredientFallback.error.message }, "Malzeme listesi okunamadi.")));
    }
    ingredientRows = (ingredientFallback.data ?? []) as Array<{ id: string; name: string }>;
  } else if (ingredientScoped.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: ingredientScoped.error.message }, "Malzeme listesi okunamadi.")));
  } else {
    ingredientRows = (ingredientScoped.data ?? []) as Array<{ id: string; name: string }>;
  }

  const ingredientByName = new Map<string, { id: string; name: string }>(
    ingredientRows.map((row) => [normalizeCatalogName(row.name), row]),
  );

  let createdIngredientCount = 0;
  for (const ingredient of restaurantDemoIngredientsSeed) {
    const key = normalizeCatalogName(ingredient.name);
    if (ingredientByName.has(key)) {
      continue;
    }
    const created = await createIngredient(ingredient.name, ingredient.unit, ingredient.cost);
    if (!created.ok && !isDuplicateError(created.error)) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(created, "Malzeme seed tamamlanamadi.")));
    }
    if (created.ok && created.id) {
      ingredientByName.set(key, { id: created.id, name: ingredient.name });
      createdIngredientCount += 1;
    }
  }

  const latestIngredientsScoped = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("business_id", scope.businessId);
  if (latestIngredientsScoped.error?.message?.toLowerCase().includes("business_id")) {
    const latestIngredientsFallback = await supabase.from("ingredients").select("id, name");
    if (!latestIngredientsFallback.error) {
      for (const row of (latestIngredientsFallback.data ?? []) as Array<{ id: string; name: string }>) {
        ingredientByName.set(normalizeCatalogName(row.name), row);
      }
    }
  } else if (!latestIngredientsScoped.error) {
    for (const row of (latestIngredientsScoped.data ?? []) as Array<{ id: string; name: string }>) {
      ingredientByName.set(normalizeCatalogName(row.name), row);
    }
  }

  let latestProductRows: Array<{ id: string; name: string; category_id: string }> = [];
  const latestProductsWithScope = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("business_id", scope.businessId)
    .eq("profile_scope", "restaurant");
  if (latestProductsWithScope.error?.message?.toLowerCase().includes("profile_scope")) {
    const latestProductsFallback = await supabase
      .from("products")
      .select("id, name, category_id")
      .eq("business_id", scope.businessId);
    if (latestProductsFallback.error) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: latestProductsFallback.error.message }, "Reçete icin Ürün listesi okunamadi.")));
    }
    latestProductRows = (latestProductsFallback.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  } else if (latestProductsWithScope.error) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage({ ok: false, error: latestProductsWithScope.error.message }, "Reçete icin Ürün listesi okunamadi.")));
  } else {
    latestProductRows = (latestProductsWithScope.data ?? []) as Array<{ id: string; name: string; category_id: string }>;
  }

  const categoryNameById = new Map<string, string>();
  for (const category of categoryByName.values()) {
    categoryNameById.set(category.id, category.name);
  }
  const targetCategoryNames = new Set(restaurantDemoCatalogSeed.categories.map((item) => normalizeCatalogName(item.name)));
  const targetProducts = latestProductRows.filter((product) => {
    const categoryName = categoryNameById.get(product.category_id);
    return Boolean(categoryName && targetCategoryNames.has(normalizeCatalogName(categoryName)));
  });

  const recipeRowMap = new Map<string, { product_id: string; ingredient_id: string; quantity: number }>();
  let recipeProductCount = 0;
  for (const product of targetProducts) {
    const categoryName = categoryNameById.get(product.category_id);
    if (!categoryName) {
      continue;
    }
    const plan = buildRestaurantDemoRecipe(categoryName, product.name);
    if (plan.lines.length === 0) {
      continue;
    }
    recipeProductCount += 1;
    for (const line of plan.lines) {
      const ingredient = ingredientByName.get(normalizeCatalogName(line.ingredientName));
      if (!ingredient) {
        continue;
      }
      const key = `${product.id}::${ingredient.id}`;
      const current = recipeRowMap.get(key);
      recipeRowMap.set(key, {
        product_id: product.id,
        ingredient_id: ingredient.id,
        quantity: (current?.quantity ?? 0) + line.quantity,
      });
    }
  }

  const recipeRows = [...recipeRowMap.values()];
  let recipeLineCount = 0;
  if (recipeRows.length > 0) {
    const upsertResult = await supabase
      .from("product_ingredients")
      .upsert(recipeRows, { onConflict: "product_id,ingredient_id" });
    if (upsertResult.error) {
      for (const row of recipeRows) {
        const result = await attachIngredientToProduct({
          productId: row.product_id,
          ingredientId: row.ingredient_id,
          quantity: row.quantity,
        });
        if (!result.ok) {
          redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Reçete satirlari yazilamadi.")));
        }
      }
      recipeLineCount = recipeRows.length;
    } else {
      recipeLineCount = recipeRows.length;
    }
  }

  redirect(
    await resolveProductsFeedbackPath(
      "success",
      `Hazır restoran kataloğu yüklendi. Yeni kategori: ${createdCategoryCount}, yeni Ürün: ${createdProductCount}, yeni malzeme: ${createdIngredientCount}, reçete ürünü: ${recipeProductCount}, reçete satiri: ${recipeLineCount}.`,
    ),
  );
}

export async function addIngredientAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const name = formData.get("name");
  const unit = formData.get("unit");
  if (typeof name !== "string" || typeof unit !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme bilgileri geçersiz."));
  }
  const cost = Number(formData.get("cost") ?? 0);
  const result = await createIngredient(name, unit, cost);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function updateIngredientAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const ingredientId = formData.get("ingredientId");
  const name = formData.get("name");
  const unit = formData.get("unit");
  const cost = Number(formData.get("cost") ?? 0);
  if (typeof ingredientId !== "string" || typeof name !== "string" || typeof unit !== "string" || !Number.isFinite(cost)) {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme güncelleme bilgileri geçersiz."));
  }
  const result = await updateIngredient(ingredientId, name, unit, cost);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme güncellenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function deleteIngredientAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const ingredientId = formData.get("ingredientId");
  if (typeof ingredientId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme seçimi geçersiz."));
  }
  const result = await deleteIngredient(ingredientId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function attachIngredientAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  const quantity = Number(formData.get("quantity"));
  if (typeof productId !== "string" || typeof ingredientId !== "string" || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme baglama bilgileri geçersiz."));
  }
  const result = await attachIngredientToProduct({ productId, ingredientId, quantity });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme ürüne baglanamadi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function detachIngredientAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const ingredientId = formData.get("ingredientId");
  if (typeof productId !== "string" || typeof ingredientId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Malzeme ayirma bilgileri geçersiz."));
  }
  const result = await detachIngredientFromProduct(productId, ingredientId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Malzeme üründen ayrilamadi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function copyRecipeAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");

  const targetProductId = formData.get("targetProductId");
  const sourceProductId = formData.get("sourceProductId");
  if (typeof targetProductId !== "string" || typeof sourceProductId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Reçete kopyalama bilgileri geçersiz."));
  }
  if (targetProductId === sourceProductId) {
    redirect(await resolveProductsFeedbackPath("error", "Kaynak ve hedef Ürün ayn? olamaz."));
  }

  const data = await getProductManagementData({ tab: "catalog" });
  const sourceRows = data.productIngredients.filter((row) => row.product_id === sourceProductId);
  if (sourceRows.length === 0) {
    redirect(await resolveProductsFeedbackPath("error", "Kaynak üründe kopyalanacak reçete bulunamadı."));
  }

  for (const row of sourceRows) {
    const result = await attachIngredientToProduct({
      productId: targetProductId,
      ingredientId: row.ingredient_id,
      quantity: row.quantity,
    });
    if (!result.ok) {
      redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Reçete kopyalanamadi.")));
    }
  }

  redirect(await resolveProductsFeedbackPath("success", "Reçete hedef ürüne kopyalandi."));
}

export async function addModifierGroupAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const productId = formData.get("productId");
  const name = formData.get("name");
  const minSelect = Number(formData.get("minSelect"));
  const maxSelect = Number(formData.get("maxSelect"));
  const isRequired = formData.get("isRequired") === "on";
  if (typeof productId !== "string" || typeof name !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier grup bilgileri geçersiz."));
  }
  const result = await createProductModifierGroup({ productId, name, minSelect, maxSelect, isRequired });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier grubu eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function addModifierOptionAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  const name = formData.get("name");
  const priceDelta = Number(formData.get("priceDelta"));
  const isDefault = formData.get("isDefault") === "on";
  if (typeof groupId !== "string" || typeof name !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier opsiyon bilgileri geçersiz."));
  }
  const result = await createProductModifierOption({ groupId, name, priceDelta, isDefault });
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier opsiyonu eklenemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function deleteModifierGroupAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const groupId = formData.get("groupId");
  if (typeof groupId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier grubu seçimi geçersiz."));
  }
  const result = await deleteProductModifierGroup(groupId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier grubu silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

export async function deleteModifierOptionAction(formData: FormData) {
  await requireRole(["admin"], "/admin/products");
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string") {
    redirect(await resolveProductsFeedbackPath("error", "Modifier opsiyonu seçimi geçersiz."));
  }
  const result = await deleteProductModifierOption(optionId);
  if (!result.ok) {
    redirect(await resolveProductsFeedbackPath("error", actionErrorMessage(result, "Modifier opsiyonu silinemedi.")));
  }
  redirect(await resolveProductsReturnPath());
}

// Types for Recipes
export type RestaurantDemoRecipeLine = {
  ingredientName: string;
  quantity: number;
};

export type RestaurantDemoRecipePlan = {
  lines: RestaurantDemoRecipeLine[];
};
