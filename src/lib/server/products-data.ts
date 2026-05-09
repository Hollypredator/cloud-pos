import { unstable_cache } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Category,
  Ingredient,
  PrepStation,
  Product,
  ProductDepartment,
  ProductIngredient,
  ProductKind,
  ProductModifierGroup,
  ProductModifierOption,
  ProductProfileScope,
  ProductUnit,
} from "@/lib/types";

type Scope = {
  businessId: string | null;
  useLegacySchema: boolean;
  activeBranchProfile?: ProductProfileScope;
};

type ProductIngredientRow = {
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredients: { id: string; name: string; unit: string } | { id: string; name: string; unit: string }[] | null;
};

type ProductDeps = {
  getDefaultBusinessScope: () => Promise<Scope>;
  isDemoCatalogFallbackEnabled?: () => Promise<boolean>;
  logAuditEvent: (input: {
    entityType: string;
    entityId: string;
    action: string;
    details?: Record<string, unknown>;
  }) => Promise<void>;
  revalidateProductManagementCaches: () => void;
  demoCategories: Category[];
  demoProducts: Product[];
  demoIngredients: Ingredient[];
  demoModifierGroups: ProductModifierGroup[];
  demoModifierOptions: ProductModifierOption[];
  demoProductIngredients: ProductIngredient[];
};

function fireAndForgetProductAudit(
  deps: ProductDeps,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    details?: Record<string, unknown>;
  },
) {
  void deps.logAuditEvent(input).catch(() => {});
}

export type ProductManagementTab = "catalog" | "menu" | "categories" | "bulk" | "features" | "import" | "recipe";

function getProductManagementIncludes(tab: ProductManagementTab) {
  if (tab === "catalog" || tab === "features" || tab === "recipe") {
    return {
      includeIngredients: true,
      includeModifiers: true,
    };
  }

  return {
    includeIngredients: false,
    includeModifiers: false,
  };
}

async function getCachedProductManagementRow(input: {
  businessId: string | null;
  useLegacySchema: boolean;
  profileScope: ProductProfileScope;
  tab: ProductManagementTab;
}) {
  const cacheKey = `product-management:${input.businessId ?? "none"}:${input.useLegacySchema ? "legacy" : "scoped"}:${input.profileScope}:${input.tab}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const includes = getProductManagementIncludes(input.tab);
      const categoriesQuery = input.useLegacySchema
        ? supabase.from("categories").select("*").order("sort_order", { ascending: true })
        : supabase
            .from("categories")
            .select("*")
            .eq("business_id", input.businessId!)
            .or(`profile_scope.eq.${input.profileScope},profile_scope.is.null`)
            .order("sort_order", { ascending: true });

      const [
        { data: categories },
        { data: products },
        { data: ingredients },
        { data: productIngredients, error: productIngredientsError },
        { data: modifierGroups, error: modifierGroupError },
        { data: modifierOptions, error: modifierOptionError },
      ] = await Promise.all([
        categoriesQuery,
        (input.useLegacySchema
          ? supabase.from("products").select(
              "id, category_id, name, price, stock_count, image_url, description, is_available, profile_scope, barcode, plu_code, product_kind, unit, department, cost",
            )
          : supabase
              .from("products")
              .select(
                "id, business_id, category_id, name, price, stock_count, image_url, description, is_available, profile_scope, barcode, plu_code, product_kind, unit, department, cost",
              )
              .eq("business_id", input.businessId!)
              .or(`profile_scope.eq.${input.profileScope},profile_scope.is.null`))
          .order("created_at", { ascending: false }),
        includes.includeIngredients
          ? (
              input.useLegacySchema
                ? supabase.from("ingredients").select("id, name, unit, cost").order("name", { ascending: true })
                : supabase
                    .from("ingredients")
                    .select("id, name, unit, cost")
                    .eq("business_id", input.businessId!)
                    .order("name", { ascending: true })
            )
          : Promise.resolve({ data: [], error: null }),
        includes.includeIngredients
          ? (
              input.useLegacySchema
                ? supabase.from("product_ingredients").select("product_id, ingredient_id, quantity, ingredients(id, name, unit, cost)")
                : supabase
                    .from("product_ingredients")
                    .select("product_id, ingredient_id, quantity, ingredients(id, name, unit, cost), products!inner(business_id)")
                    .eq("products.business_id", input.businessId!)
            )
          : Promise.resolve({ data: [], error: null }),
        includes.includeModifiers
          ? supabase
              .from("product_modifier_groups")
              .select("id, product_id, name, min_select, max_select, is_required, sort_order")
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        includes.includeModifiers
          ? supabase
              .from("product_modifier_options")
              .select("id, group_id, name, price_delta, is_default, sort_order")
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      return {
        categories: (categories ?? []) as Category[],
        products: (products ?? []) as Product[],
        ingredients: (ingredients ?? []) as Ingredient[],
        modifierGroups: (modifierGroups ?? []) as ProductModifierGroup[],
        modifierOptions: (modifierOptions ?? []) as ProductModifierOption[],
        productIngredients: ((productIngredients ?? []) as ProductIngredientRow[]).map((row) => ({
          product_id: row.product_id,
          ingredient_id: row.ingredient_id,
          quantity: Number(row.quantity),
          ingredient: Array.isArray(row.ingredients) ? row.ingredients[0] ?? null : row.ingredients,
        })),
        hasError: Boolean(productIngredientsError || modifierGroupError || modifierOptionError),
      };
    },
    [cacheKey],
    { revalidate: 30, tags: ["product-management"] },
  );

  return reader();
}

export async function getProductManagementDataImpl(
  deps: ProductDeps,
  options?: {
    tab?: ProductManagementTab;
  },
) {
  const supabase = getSupabaseServerClient();
  const scope = await deps.getDefaultBusinessScope();
  const demoCatalogFallbackEnabled = deps.isDemoCatalogFallbackEnabled
    ? await deps.isDemoCatalogFallbackEnabled()
    : true;
  const activeBusinessType = (scope as { activeBusinessType?: string | null }).activeBusinessType;
  const isSelfServiceBusiness = activeBusinessType === "self_service_coffee";
  const isRestaurantBusiness = activeBusinessType === "restaurant_cafe";
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  if (!supabase) {
    if (!demoCatalogFallbackEnabled) {
      return {
        categories: [] as Category[],
        products: [] as Product[],
        ingredients: [] as Ingredient[],
        modifierGroups: [] as ProductModifierGroup[],
        modifierOptions: [] as ProductModifierOption[],
        productIngredients: [] as Array<{
          product_id: string;
          ingredient_id: string;
          quantity: number;
          ingredient: Ingredient | null;
        }>,
        activeProfileScope,
        usingDemoData: false,
      };
    }
    const categories = deps.demoCategories.filter(
      (category) => (category.profile_scope ?? "restaurant") === activeProfileScope,
    );
    const products = deps.demoProducts.filter(
      (product) => (product.profile_scope ?? "restaurant") === activeProfileScope,
    );
    return {
      categories,
      products,
      ingredients: deps.demoIngredients,
      modifierGroups: deps.demoModifierGroups,
      modifierOptions: deps.demoModifierOptions,
      productIngredients: deps.demoProductIngredients.map((row) => ({
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        ingredient: deps.demoIngredients.find((item) => item.id === row.ingredient_id) ?? null,
      })),
      activeProfileScope,
      usingDemoData: true,
    };
  }

  if (!scope.useLegacySchema && !scope.businessId) {
    return {
      categories: [] as Category[],
      products: [] as Product[],
      ingredients: [] as Ingredient[],
      modifierGroups: [] as ProductModifierGroup[],
      modifierOptions: [] as ProductModifierOption[],
      productIngredients: [] as Array<{
        product_id: string;
        ingredient_id: string;
        quantity: number;
        ingredient: Ingredient | null;
      }>,
      activeProfileScope,
      usingDemoData: false,
    };
  }

  const tab = options?.tab ?? "catalog";
  const cached = await getCachedProductManagementRow({
    businessId: scope.businessId,
    useLegacySchema: scope.useLegacySchema,
    profileScope: activeProfileScope,
    tab,
  });

  if (!cached || cached.hasError) {
    if (!demoCatalogFallbackEnabled) {
      return {
        categories: [] as Category[],
        products: [] as Product[],
        ingredients: [] as Ingredient[],
        modifierGroups: [] as ProductModifierGroup[],
        modifierOptions: [] as ProductModifierOption[],
        productIngredients: [] as Array<{
          product_id: string;
          ingredient_id: string;
          quantity: number;
          ingredient: Ingredient | null;
        }>,
        activeProfileScope,
        usingDemoData: false,
      };
    }
    return {
      categories: deps.demoCategories.filter((category) => (category.profile_scope ?? "restaurant") === activeProfileScope),
      products: deps.demoProducts.filter((product) => (product.profile_scope ?? "restaurant") === activeProfileScope),
      ingredients: deps.demoIngredients,
      modifierGroups: deps.demoModifierGroups,
      modifierOptions: deps.demoModifierOptions,
      productIngredients: deps.demoProductIngredients.map((row) => ({
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        ingredient: deps.demoIngredients.find((item) => item.id === row.ingredient_id) ?? null,
      })),
      activeProfileScope,
      usingDemoData: true,
    };
  }

  const scopedCategories = cached.categories.filter(
    (category) => (category.profile_scope ?? "restaurant") === activeProfileScope,
  );
  const scopedProducts = cached.products.filter(
    (product) => (product.profile_scope ?? "restaurant") === activeProfileScope,
  );
  const scopedProductIds = new Set(scopedProducts.map((product) => product.id));
  const scopedModifierGroups = cached.modifierGroups.filter((group) => scopedProductIds.has(group.product_id));
  const scopedModifierGroupIds = new Set(scopedModifierGroups.map((group) => group.id));
  const scopedModifierOptions = cached.modifierOptions.filter((option) => scopedModifierGroupIds.has(option.group_id));
  const scopedProductIngredients = cached.productIngredients.filter((row) => scopedProductIds.has(row.product_id));
  const shouldUseDemoForEmptyCatalog =
    demoCatalogFallbackEnabled &&
    ((isSelfServiceBusiness && (scopedCategories.length === 0 || scopedProducts.length === 0)) ||
      (isRestaurantBusiness && scopedCategories.length === 0 && scopedProducts.length === 0));
  if (shouldUseDemoForEmptyCatalog) {
    return {
      categories: deps.demoCategories.filter((category) => (category.profile_scope ?? "restaurant") === activeProfileScope),
      products: deps.demoProducts.filter((product) => (product.profile_scope ?? "restaurant") === activeProfileScope),
      ingredients: deps.demoIngredients,
      modifierGroups: deps.demoModifierGroups,
      modifierOptions: deps.demoModifierOptions,
      productIngredients: deps.demoProductIngredients.map((row) => ({
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        ingredient: deps.demoIngredients.find((item) => item.id === row.ingredient_id) ?? null,
      })),
      activeProfileScope,
      usingDemoData: true,
    };
  }

  return {
    categories: scopedCategories,
    products: scopedProducts,
    ingredients: cached.ingredients,
    modifierGroups: scopedModifierGroups,
    modifierOptions: scopedModifierOptions,
    productIngredients: scopedProductIngredients,
    activeProfileScope,
    usingDemoData: false,
  };
}

export async function createProductImpl(
  input: {
    categoryId: string;
    name: string;
    price: number;
    stockCount: number;
    profileScope: ProductProfileScope;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    barcode?: string;
    pluCode?: string;
    productKind?: ProductKind;
    unit?: ProductUnit;
    department?: ProductDepartment;
    cost?: number;
  },
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda ürün ekleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const withBusinessPayload = {
    business_id: scope.businessId,
    category_id: input.categoryId,
    profile_scope: input.profileScope,
    name: input.name,
    price: input.price,
    stock_count: input.stockCount,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    is_available: input.isAvailable ?? true,
    barcode: input.barcode?.trim() || null,
    plu_code: input.pluCode?.trim() || null,
    product_kind: input.productKind ?? "standard",
    unit: input.unit ?? "adet",
    department: input.department ?? "general",
    cost: input.cost ?? 0,
  };
  const fallbackPayload = {
    category_id: input.categoryId,
    name: input.name,
    price: input.price,
    stock_count: input.stockCount,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    is_available: input.isAvailable ?? true,
  };

  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  const firstInsert = await supabase.from("products").insert(withBusinessPayload).select("id").single();
  data = firstInsert.data as { id: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (
    error?.message?.toLowerCase().includes("business_id") ||
    error?.message?.toLowerCase().includes("profile_scope") ||
    error?.message?.toLowerCase().includes("product_kind") ||
    error?.message?.toLowerCase().includes("plu_code") ||
    error?.message?.toLowerCase().includes("barcode")
  ) {
    const secondInsert = await supabase.from("products").insert(fallbackPayload).select("id").single();
    data = secondInsert.data as { id: string } | null;
    error = secondInsert.error as { message: string } | null;
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Ürün oluşturulamadı." };
  }

  fireAndForgetProductAudit(deps, {
    entityType: "product",
    entityId: data.id,
    action: "create",
    details: {
      name: input.name,
      categoryId: input.categoryId,
      profileScope: input.profileScope,
      price: input.price,
      stockCount: input.stockCount,
      barcode: input.barcode?.trim() || null,
      pluCode: input.pluCode?.trim() || null,
      productKind: input.productKind ?? "standard",
      unit: input.unit ?? "adet",
      department: input.department ?? "general",
      cost: input.cost ?? 0,
    },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true, id: data.id };
}

export async function updateProductImpl(
  input: {
    productId: string;
    categoryId: string;
    name: string;
    price: number;
    stockCount: number;
    profileScope: ProductProfileScope;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
    barcode?: string;
    pluCode?: string;
    productKind?: ProductKind;
    unit?: ProductUnit;
    department?: ProductDepartment;
    cost?: number;
  },
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda ürün guncelleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  let query = supabase
    .from("products")
    .update({
      category_id: input.categoryId,
      profile_scope: input.profileScope,
      name: input.name,
      price: input.price,
      stock_count: input.stockCount,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      is_available: input.isAvailable,
      barcode: input.barcode?.trim() || null,
      plu_code: input.pluCode?.trim() || null,
      product_kind: input.productKind ?? "standard",
      unit: input.unit ?? "adet",
      department: input.department ?? "general",
      cost: input.cost ?? 0,
    })
    .eq("id", input.productId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }

  let { error } = await query;
  if (
    error?.message?.toLowerCase().includes("profile_scope") ||
    error?.message?.toLowerCase().includes("product_kind") ||
    error?.message?.toLowerCase().includes("plu_code") ||
    error?.message?.toLowerCase().includes("barcode")
  ) {
    let fallbackQuery = supabase
      .from("products")
      .update({
        category_id: input.categoryId,
        name: input.name,
        price: input.price,
        stock_count: input.stockCount,
        description: input.description ?? null,
        image_url: input.imageUrl ?? null,
        is_available: input.isAvailable,
      })
      .eq("id", input.productId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
    }
    const fallbackResult = await fallbackQuery;
    error = fallbackResult.error;
  }
  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetProductAudit(deps, {
    entityType: "product",
    entityId: input.productId,
    action: "update",
    details: {
      categoryId: input.categoryId,
      profileScope: input.profileScope,
      name: input.name,
      price: input.price,
      stockCount: input.stockCount,
      isAvailable: input.isAvailable,
      barcode: input.barcode?.trim() || null,
      pluCode: input.pluCode?.trim() || null,
      productKind: input.productKind ?? "standard",
      unit: input.unit ?? "adet",
      department: input.department ?? "general",
      cost: input.cost ?? 0,
    },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteProductImpl(productId: string, deps: ProductDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda ürün silme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  let query = supabase.from("products").delete().eq("id", productId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
  }
  let { error } = await query;
  if (error?.message?.toLowerCase().includes("profile_scope")) {
    let fallbackQuery = supabase.from("products").delete().eq("id", productId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
    }
    const fallback = await fallbackQuery;
    error = fallback.error;
  }
  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetProductAudit(deps, { entityType: "product", entityId: productId, action: "delete" });
  deps.revalidateProductManagementCaches();
  return { ok: true };
}

export async function createCategoryImpl(
  name: string,
  sortOrder: number,
  prepStation: PrepStation,
  profileScope: ProductProfileScope,
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori ekleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const withBusinessPayload = {
    business_id: scope.businessId,
    name,
    sort_order: sortOrder,
    prep_station: prepStation,
    profile_scope: profileScope,
  };
  const fallbackPayload = { name, sort_order: sortOrder, prep_station: prepStation };

  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  const firstInsert = await supabase.from("categories").insert(withBusinessPayload).select("id").single();
  data = firstInsert.data as { id: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (error?.message?.toLowerCase().includes("business_id") || error?.message?.toLowerCase().includes("profile_scope")) {
    const secondInsert = await supabase.from("categories").insert(fallbackPayload).select("id").single();
    data = secondInsert.data as { id: string } | null;
    error = secondInsert.error as { message: string } | null;
  }
  if (error?.message?.toLowerCase().includes("prep_station")) {
    return { ok: false, error: "Istasyon yönlendirmesi için veritabani migrasyonunu çalıştırın." };
  }
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Kategori oluşturulamadı." };
  }

  fireAndForgetProductAudit(deps, {
    entityType: "category",
    entityId: data.id,
    action: "create",
    details: { name, sortOrder, prepStation, profileScope },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true, id: data.id };
}

export async function updateCategoryPrepStationImpl(
  input: { categoryId: string; prepStation: PrepStation },
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori istasyon guncelleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  const { data: categoryRow, error: categoryError } = await supabase
    .from("categories")
    .select("id, business_id, profile_scope")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (categoryError) {
    return { ok: false, error: categoryError.message };
  }
  if (!categoryRow) {
    return { ok: false, error: "Kategori bulunamadi." };
  }

  const categoryBusinessId = (categoryRow as { business_id?: string | null }).business_id ?? null;
  const categoryProfileScope = (categoryRow as { profile_scope?: ProductProfileScope | null }).profile_scope ?? "restaurant";
  if (!scope.useLegacySchema && scope.businessId && categoryBusinessId && categoryBusinessId !== scope.businessId) {
    return { ok: false, error: "Bu kategori icin istasyon guncelleme yetkin yok." };
  }
  if (!scope.useLegacySchema && categoryProfileScope !== activeProfileScope) {
    return { ok: false, error: "Aktif sube profili disindaki kategori guncellenemez." };
  }

  const { error } = await supabase
    .from("categories")
    .update({ prep_station: input.prepStation })
    .eq("id", input.categoryId);
  if (error?.message?.toLowerCase().includes("prep_station")) {
    return { ok: false, error: "Istasyon yonlendirmesi icin veritabani migrasyonunu calistirin." };
  }
  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetProductAudit(deps, {
    entityType: "category",
    entityId: input.categoryId,
    action: "prep_station_update",
    details: { prepStation: input.prepStation, profileScope: activeProfileScope },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true };
}
export async function deleteCategoryImpl(categoryId: string, deps: ProductDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori silme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  let linkedProductsQuery = supabase.from("products").select("id").eq("category_id", categoryId).limit(1);
  if (!scope.useLegacySchema && scope.businessId) {
    linkedProductsQuery = linkedProductsQuery.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
  }
  const { data: linkedProducts } = await linkedProductsQuery;
  if ((linkedProducts ?? []).length > 0) {
    return { ok: false, error: "Bu kategoriye bagli urunler var." };
  }

  let deleteQuery = supabase.from("categories").delete().eq("id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
  }

  let { error } = await deleteQuery;
  if (error?.message?.toLowerCase().includes("profile_scope")) {
    let fallbackDeleteQuery = supabase.from("categories").delete().eq("id", categoryId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackDeleteQuery = fallbackDeleteQuery.eq("business_id", scope.businessId);
    }
    const fallback = await fallbackDeleteQuery;
    error = fallback.error;
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetProductAudit(deps, {
    entityType: "category",
    entityId: categoryId,
    action: "delete",
    details: { profileScope: activeProfileScope },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true };
}
