import { resolveConsumption, type ConsumptionLine, type ModifierEffect, type RecipeLine } from "@/lib/recipes/engine";

/**
 * Satista recete tuketimini cozer ve yazilacak satirlari uretir.
 *
 * Motor (`recipes/engine.ts`) saf; bu dosya ona veritabanindan yem tasir.
 * Ayrimin sebebi: kural tek yerde ve testli kalsin, veri erisimi degisince
 * kural bozulmasin.
 *
 * Plan: PLAN-RECETE-MALIYET-STOK.md (Faz 3)
 */

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

export type OrderItemForConsumption = {
  /** `order_items.id` — idempotans anahtarinin yarisi. */
  orderItemId: string;
  productId: string | null;
  quantity: number;
  modifierOptionIds: string[];
};

export type ConsumptionRow = {
  orderItemId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  source: ConsumptionLine["source"];
};

export type RecipeContext = {
  recipesByProduct: Map<string, RecipeLine[]>;
  effectsByOption: Map<string, ModifierEffect[]>;
  /** Recetesi olmayan urunler — "maliyet eksik" rozetini besler (karar D3.3). */
  productsWithoutRecipe: Set<string>;
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Recete satirlarini ve modifier etkilerini toplu yukler.
 *
 * Toplu yukleme zorunlu: sepette 5 farkli urun varsa urun basina sorgu acmak
 * N+1 olur ve kasa yolunu yavaslatir. `getOrderItemUnitCostSnapshotMap` ayni
 * deseni kullaniyor (CEO review, Section 7).
 */
export async function loadRecipeContext(
  supabase: SupabaseLike,
  productIds: string[],
  optionIds: string[],
): Promise<RecipeContext> {
  const recipesByProduct = new Map<string, RecipeLine[]>();
  const effectsByOption = new Map<string, ModifierEffect[]>();
  const productsWithoutRecipe = new Set<string>(productIds);

  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("product_ingredients")
      .select("product_id, ingredient_id, quantity, yield_factor, ingredients(cost)")
      .in("product_id", productIds);

    if (error) {
      throw new Error(`Reçete satırları okunamadı: ${error.message}`);
    }

    for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
      const productId = asString(raw.product_id);
      const ingredientId = asString(raw.ingredient_id);
      if (!productId || !ingredientId) continue;

      // Supabase iliskili tabloyu dizi ya da nesne olarak dondurebilir.
      const related = raw.ingredients as { cost?: unknown } | Array<{ cost?: unknown }> | null;
      const cost = Array.isArray(related) ? asNumber(related[0]?.cost) : asNumber(related?.cost);

      const lines = recipesByProduct.get(productId) ?? [];
      lines.push({
        ingredientId,
        quantity: asNumber(raw.quantity),
        yieldFactor: asNumber(raw.yield_factor, 1),
        unitCost: cost,
      });
      recipesByProduct.set(productId, lines);
      productsWithoutRecipe.delete(productId);
    }
  }

  if (optionIds.length > 0) {
    const { data, error } = await supabase
      .from("modifier_option_ingredients")
      .select("option_id, ingredient_id, target_ingredient_id, quantity, multiplier, mode, ingredients(cost)")
      .in("option_id", optionIds);

    if (error) {
      throw new Error(`Modifier reçete etkileri okunamadı: ${error.message}`);
    }

    for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
      const optionId = asString(raw.option_id);
      const mode = asString(raw.mode);
      if (!optionId || !mode) continue;

      const related = raw.ingredients as { cost?: unknown } | Array<{ cost?: unknown }> | null;
      const cost = Array.isArray(related) ? asNumber(related[0]?.cost) : asNumber(related?.cost);

      const effects = effectsByOption.get(optionId) ?? [];
      effects.push({
        mode: mode as ModifierEffect["mode"],
        ingredientId: asString(raw.ingredient_id) ?? undefined,
        targetIngredientId: asString(raw.target_ingredient_id) ?? undefined,
        quantity: raw.quantity == null ? undefined : asNumber(raw.quantity),
        multiplier: raw.multiplier == null ? undefined : asNumber(raw.multiplier),
        unitCost: cost,
      });
      effectsByOption.set(optionId, effects);
    }
  }

  return { recipesByProduct, effectsByOption, productsWithoutRecipe };
}

/**
 * Her siparis kalemi icin tuketim satirlarini uretir.
 *
 * Ayni malzeme hem receteden hem modifier'dan gelebilir; motor kalem icinde
 * topluyor. Bu, `unique(order_item_id, ingredient_id)` idempotans indeksinin
 * calismasi icin sart — aksi halde tek kalem ayni malzemeyi iki satirla
 * yazmaya calisir ve kendi kendini reddeder.
 */
export function buildConsumptionRows(
  items: OrderItemForConsumption[],
  context: RecipeContext,
): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];

  for (const item of items) {
    if (!item.productId) continue;

    const recipe = context.recipesByProduct.get(item.productId);
    if (!recipe || recipe.length === 0) {
      // Recetesi olmayan urun dusum yapmaz. Hata degil: su, hazir kek gibi
      // urunlerin recetesi olmayabilir. Maliyet eksikligi rozetle bildirilir.
      continue;
    }

    const effects = item.modifierOptionIds.flatMap(
      (optionId) => context.effectsByOption.get(optionId) ?? [],
    );

    const lines = resolveConsumption({ recipe, effects, quantity: item.quantity });

    for (const line of lines) {
      rows.push({
        orderItemId: item.orderItemId,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        source: line.source,
      });
    }
  }

  return rows;
}

/** Tuketim satirlarindan toplam maliyet — rapor ve dogrulama icin. */
export function totalConsumptionCost(rows: ConsumptionRow[]) {
  return rows.reduce((sum, row) => sum + row.quantity * row.unitCost, 0);
}
