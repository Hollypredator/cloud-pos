import { unstable_cache } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Category,
  Ingredient,
  Product,
  ProductIngredient,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

type Scope = {
  businessId: string | null;
  useLegacySchema: boolean;
};

type ProductIngredientRow = {
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredients: { id: string; name: string; unit: string } | { id: string; name: string; unit: string }[] | null;
};

type ProductDeps = {
  getDefaultBusinessScope: () => Promise<Scope>;
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

export type ProductManagementTab = "catalog" | "menu" | "categories" | "bulk" | "features";

function getProductManagementIncludes(tab: ProductManagementTab) {
  if (tab === "catalog" || tab === "features") {
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
  tab: ProductManagementTab;
}) {
  const cacheKey = `product-management:${input.businessId ?? "none"}:${input.useLegacySchema ? "legacy" : "scoped"}:${input.tab}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const includes = getProductManagementIncludes(input.tab);

      const [
        { data: categories },
        { data: products },
        { data: ingredients },
        { data: productIngredients, error: productIngredientsError },
        { data: modifierGroups, error: modifierGroupError },
        { data: modifierOptions, error: modifierOptionError },
      ] = await Promise.all([
        (input.useLegacySchema
          ? supabase.from("categories").select("id, name, sort_order")
          : supabase.from("categories").select("id, business_id, name, sort_order").eq("business_id", input.businessId!))
          .order("sort_order", { ascending: true }),
        (input.useLegacySchema
          ? supabase.from("products").select("id, category_id, name, price, stock_count, image_url, description, is_available")
          : supabase
              .from("products")
              .select("id, business_id, category_id, name, price, stock_count, image_url, description, is_available")
              .eq("business_id", input.businessId!))
          .order("created_at", { ascending: false }),
        includes.includeIngredients
          ? supabase.from("ingredients").select("id, name, unit").order("name", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        includes.includeIngredients
          ? supabase.from("product_ingredients").select("product_id, ingredient_id, quantity, ingredients(id, name, unit)")
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
    { revalidate: 15, tags: ["product-management"] },
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
  if (!supabase) {
    return {
      categories: deps.demoCategories,
      products: deps.demoProducts,
      ingredients: deps.demoIngredients,
      modifierGroups: deps.demoModifierGroups,
      modifierOptions: deps.demoModifierOptions,
      productIngredients: deps.demoProductIngredients.map((row) => ({
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        ingredient: deps.demoIngredients.find((item) => item.id === row.ingredient_id) ?? null,
      })),
      usingDemoData: true,
    };
  }

  const scope = await deps.getDefaultBusinessScope();
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
      usingDemoData: false,
    };
  }

  const tab = options?.tab ?? "catalog";
  const cached = await getCachedProductManagementRow({
    businessId: scope.businessId,
    useLegacySchema: scope.useLegacySchema,
    tab,
  });

  if (!cached || cached.hasError) {
    return {
      categories: deps.demoCategories,
      products: deps.demoProducts,
      ingredients: deps.demoIngredients,
      modifierGroups: deps.demoModifierGroups,
      modifierOptions: deps.demoModifierOptions,
      productIngredients: deps.demoProductIngredients.map((row) => ({
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        ingredient: deps.demoIngredients.find((item) => item.id === row.ingredient_id) ?? null,
      })),
      usingDemoData: true,
    };
  }

  return {
    categories: cached.categories,
    products: cached.products,
    ingredients: cached.ingredients,
    modifierGroups: cached.modifierGroups,
    modifierOptions: cached.modifierOptions,
    productIngredients: cached.productIngredients,
    usingDemoData: false,
  };
}

export async function createProductImpl(
  input: {
    categoryId: string;
    name: string;
    price: number;
    stockCount: number;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  },
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda urun ekleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const withBusinessPayload = {
    business_id: scope.businessId,
    category_id: input.categoryId,
    name: input.name,
    price: input.price,
    stock_count: input.stockCount,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    is_available: input.isAvailable ?? true,
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
  if (error?.message?.toLowerCase().includes("business_id")) {
    const secondInsert = await supabase.from("products").insert(fallbackPayload).select("id").single();
    data = secondInsert.data as { id: string } | null;
    error = secondInsert.error as { message: string } | null;
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Urun olusturulamadi." };
  }

  await deps.logAuditEvent({
    entityType: "product",
    entityId: data.id,
    action: "create",
    details: { name: input.name, categoryId: input.categoryId, price: input.price, stockCount: input.stockCount },
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
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
  },
  deps: ProductDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda urun guncelleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  let query = supabase
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
    query = query.eq("business_id", scope.businessId);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({
    entityType: "product",
    entityId: input.productId,
    action: "update",
    details: {
      categoryId: input.categoryId,
      name: input.name,
      price: input.price,
      stockCount: input.stockCount,
      isAvailable: input.isAvailable,
    },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteProductImpl(productId: string, deps: ProductDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda urun silme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  let query = supabase.from("products").delete().eq("id", productId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({ entityType: "product", entityId: productId, action: "delete" });
  deps.revalidateProductManagementCaches();
  return { ok: true };
}

export async function createCategoryImpl(name: string, sortOrder: number, deps: ProductDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori ekleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const withBusinessPayload = { business_id: scope.businessId, name, sort_order: sortOrder };
  const fallbackPayload = { name, sort_order: sortOrder };

  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  const firstInsert = await supabase.from("categories").insert(withBusinessPayload).select("id").single();
  data = firstInsert.data as { id: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (error?.message?.toLowerCase().includes("business_id")) {
    const secondInsert = await supabase.from("categories").insert(fallbackPayload).select("id").single();
    data = secondInsert.data as { id: string } | null;
    error = secondInsert.error as { message: string } | null;
  }
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Kategori olusturulamadi." };
  }

  await deps.logAuditEvent({
    entityType: "category",
    entityId: data.id,
    action: "create",
    details: { name, sortOrder },
  });

  deps.revalidateProductManagementCaches();
  return { ok: true, id: data.id };
}

export async function deleteCategoryImpl(categoryId: string, deps: ProductDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori silme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  let linkedProductsQuery = supabase.from("products").select("id").eq("category_id", categoryId).limit(1);
  if (!scope.useLegacySchema && scope.businessId) {
    linkedProductsQuery = linkedProductsQuery.eq("business_id", scope.businessId);
  }
  const { data: linkedProducts } = await linkedProductsQuery;
  if ((linkedProducts ?? []).length > 0) {
    return { ok: false, error: "Bu kategoriye bagli urunler var." };
  }

  let deleteQuery = supabase.from("categories").delete().eq("id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  const { error } = await deleteQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({ entityType: "category", entityId: categoryId, action: "delete" });
  deps.revalidateProductManagementCaches();
  return { ok: true };
}
