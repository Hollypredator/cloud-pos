import { describe, expect, it } from "vitest";
import { buildConsumptionRows, loadRecipeContext, totalConsumptionCost, type RecipeContext } from "./consumption";

/** `in()` cagrisina gore sabit veri donen minimal Supabase taklidi. */
function fakeSupabase(tables: Record<string, unknown[]>, errors: Record<string, string> = {}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            async in() {
              if (errors[table]) return { data: null, error: { message: errors[table] } };
              return { data: tables[table] ?? [], error: null };
            },
          };
        },
      };
    },
  };
}

const LATTE = "prod-latte";
const OAT_OPTION = "opt-oat";
const LARGE_OPTION = "opt-large";

const RECIPE_ROWS = [
  { product_id: LATTE, ingredient_id: "espresso", quantity: 18, yield_factor: 0.97, ingredients: { cost: 1.4 } },
  { product_id: LATTE, ingredient_id: "sut", quantity: 300, yield_factor: 1, ingredients: { cost: 0.06 } },
];

const EFFECT_ROWS = [
  {
    option_id: OAT_OPTION,
    mode: "replace",
    ingredient_id: "yulaf_sutu",
    target_ingredient_id: "sut",
    quantity: null,
    multiplier: null,
    ingredients: { cost: 0.14 },
  },
  {
    option_id: LARGE_OPTION,
    mode: "scale",
    ingredient_id: null,
    target_ingredient_id: "sut",
    quantity: null,
    multiplier: 1.4,
    ingredients: null,
  },
];

describe("loadRecipeContext", () => {
  it("recete satirlarini ve malzeme maliyetini yukler", async () => {
    const supabase = fakeSupabase({ product_ingredients: RECIPE_ROWS });
    const context = await loadRecipeContext(supabase, [LATTE], []);

    const lines = context.recipesByProduct.get(LATTE);
    expect(lines).toHaveLength(2);
    expect(lines?.[0].unitCost).toBe(1.4);
    expect(lines?.[0].yieldFactor).toBe(0.97);
  });

  it("iliskili tablo dizi olarak gelirse de maliyeti okur", async () => {
    // Supabase iliskiyi bazen dizi dondurur; ikisi de desteklenmeli.
    const supabase = fakeSupabase({
      product_ingredients: [{ ...RECIPE_ROWS[0], ingredients: [{ cost: 2.5 }] }],
    });
    const context = await loadRecipeContext(supabase, [LATTE], []);
    expect(context.recipesByProduct.get(LATTE)?.[0].unitCost).toBe(2.5);
  });

  it("recetesi olmayan urunu isaretler", async () => {
    const supabase = fakeSupabase({ product_ingredients: [] });
    const context = await loadRecipeContext(supabase, [LATTE, "prod-su"], []);
    expect(context.productsWithoutRecipe.has(LATTE)).toBe(true);
    expect(context.productsWithoutRecipe.has("prod-su")).toBe(true);
  });

  it("recetesi olan urun isaretten cikar", async () => {
    const supabase = fakeSupabase({ product_ingredients: RECIPE_ROWS });
    const context = await loadRecipeContext(supabase, [LATTE, "prod-su"], []);
    expect(context.productsWithoutRecipe.has(LATTE)).toBe(false);
    expect(context.productsWithoutRecipe.has("prod-su")).toBe(true);
  });

  it("modifier etkilerini yukler", async () => {
    const supabase = fakeSupabase({ modifier_option_ingredients: EFFECT_ROWS });
    const context = await loadRecipeContext(supabase, [], [OAT_OPTION, LARGE_OPTION]);

    expect(context.effectsByOption.get(OAT_OPTION)?.[0].mode).toBe("replace");
    expect(context.effectsByOption.get(LARGE_OPTION)?.[0].multiplier).toBe(1.4);
    // null miktar undefined'a cevrilmeli, 0'a degil: 0 "miktar yok" demek degil.
    expect(context.effectsByOption.get(OAT_OPTION)?.[0].quantity).toBeUndefined();
  });

  it("recete sorgusu hata verirse firlatir", async () => {
    const supabase = fakeSupabase({}, { product_ingredients: "izin yok" });
    await expect(loadRecipeContext(supabase, [LATTE], [])).rejects.toThrow(/Reçete satırları okunamadı/);
  });

  it("bos girdide sorgu acmaz", async () => {
    const supabase = fakeSupabase({}, { product_ingredients: "acilmamaliydi" });
    const context = await loadRecipeContext(supabase, [], []);
    expect(context.recipesByProduct.size).toBe(0);
  });
});

describe("buildConsumptionRows", () => {
  async function context(): Promise<RecipeContext> {
    return loadRecipeContext(
      fakeSupabase({ product_ingredients: RECIPE_ROWS, modifier_option_ingredients: EFFECT_ROWS }),
      [LATTE],
      [OAT_OPTION, LARGE_OPTION],
    );
  }

  it("duz recete satirlarini uretir", async () => {
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: LATTE, quantity: 1, modifierOptionIds: [] }],
      await context(),
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.ingredientId === "espresso")?.quantity).toBe(18.557);
    expect(rows.every((r) => r.orderItemId === "oi-1")).toBe(true);
  });

  it("adet ile carpar", async () => {
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: LATTE, quantity: 2, modifierOptionIds: [] }],
      await context(),
    );
    expect(rows.find((r) => r.ingredientId === "sut")?.quantity).toBe(600);
  });

  it("Large + yulaf sutu birlikte dogru cozulur", async () => {
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: LATTE, quantity: 1, modifierOptionIds: [LARGE_OPTION, OAT_OPTION] }],
      await context(),
    );

    expect(rows.find((r) => r.ingredientId === "sut")).toBeUndefined();
    expect(rows.find((r) => r.ingredientId === "yulaf_sutu")?.quantity).toBe(420);
  });

  it("recetesi olmayan urun satir uretmez", async () => {
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: "prod-su", quantity: 3, modifierOptionIds: [] }],
      await context(),
    );
    expect(rows).toEqual([]);
  });

  it("urun kimligi yoksa atlar", async () => {
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: null, quantity: 1, modifierOptionIds: [] }],
      await context(),
    );
    expect(rows).toEqual([]);
  });

  it("ayni kalemde ayni malzeme tek satirda toplanir", async () => {
    // Idempotans indeksi unique(order_item_id, ingredient_id) — ayni kalem
    // ayni malzemeyi iki satirla yazmaya calisirsa kendi kendini reddeder.
    const ctx = await loadRecipeContext(
      fakeSupabase({
        product_ingredients: RECIPE_ROWS,
        modifier_option_ingredients: [
          {
            option_id: "opt-shot",
            mode: "add",
            ingredient_id: "espresso",
            target_ingredient_id: null,
            quantity: 18,
            multiplier: null,
            ingredients: { cost: 1.4 },
          },
        ],
      }),
      [LATTE],
      ["opt-shot"],
    );

    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: LATTE, quantity: 1, modifierOptionIds: ["opt-shot"] }],
      ctx,
    );

    const espressoRows = rows.filter((r) => r.ingredientId === "espresso");
    expect(espressoRows).toHaveLength(1);
    expect(espressoRows[0].quantity).toBe(36.557);
  });

  it("birden fazla kalem ayri orderItemId tasir", async () => {
    const rows = buildConsumptionRows(
      [
        { orderItemId: "oi-1", productId: LATTE, quantity: 1, modifierOptionIds: [] },
        { orderItemId: "oi-2", productId: LATTE, quantity: 1, modifierOptionIds: [OAT_OPTION] },
      ],
      await context(),
    );

    expect(new Set(rows.map((r) => r.orderItemId))).toEqual(new Set(["oi-1", "oi-2"]));
    expect(rows.find((r) => r.orderItemId === "oi-2" && r.ingredientId === "yulaf_sutu")).toBeDefined();
  });
});

describe("totalConsumptionCost", () => {
  it("tuketim maliyetini toplar", async () => {
    const ctx = await loadRecipeContext(fakeSupabase({ product_ingredients: RECIPE_ROWS }), [LATTE], []);
    const rows = buildConsumptionRows(
      [{ orderItemId: "oi-1", productId: LATTE, quantity: 1, modifierOptionIds: [] }],
      ctx,
    );
    // 18.557 × 1.4 + 300 × 0.06 = 25.98 + 18
    expect(totalConsumptionCost(rows)).toBeCloseTo(43.98, 2);
  });
});
