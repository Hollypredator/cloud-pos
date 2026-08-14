import { describe, expect, it } from "vitest";
import { freezeCartConsumption, frozenConsumptionCost, indexCatalog } from "./catalog-consumption";
import type { CatalogSnapshot } from "./catalog-store";

const LATTE = "prod-latte";
const SU = "prod-su";
const OAT = "opt-oat";
const LARGE = "opt-large";

function snapshot(overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    syncedAt: "2026-08-10T09:00:00.000Z",
    business: { slug: "kafe", name: "Kafe", branchId: "branch-1", branchName: "Merkez" },
    menu: {
      categories: [],
      products: [],
      modifierGroups: [],
      modifierOptions: [],
      usingDemoData: false,
    },
    ingredients: [
      { id: "espresso", name: "Espresso", unit: "g", cost: 1.4 },
      { id: "sut", name: "Süt", unit: "ml", cost: 0.06 },
      { id: "yulaf_sutu", name: "Yulaf Sütü", unit: "ml", cost: 0.14 },
    ],
    recipes: [
      { productId: LATTE, ingredientId: "espresso", quantity: 18, yieldFactor: 0.97 },
      { productId: LATTE, ingredientId: "sut", quantity: 300, yieldFactor: 1 },
    ],
    modifierEffects: [
      {
        optionId: OAT,
        mode: "replace",
        ingredientId: "yulaf_sutu",
        targetIngredientId: "sut",
        quantity: null,
        multiplier: null,
      },
      {
        optionId: LARGE,
        mode: "scale",
        ingredientId: null,
        targetIngredientId: "sut",
        quantity: null,
        multiplier: 1.4,
      },
    ],
    recipeSchemaReady: true,
    ...overrides,
  };
}

describe("indexCatalog", () => {
  it("malzeme maliyetini recete satirina baglar", () => {
    const index = indexCatalog(snapshot());
    const lines = index.recipesByProduct.get(LATTE);
    expect(lines).toHaveLength(2);
    expect(lines?.find((line) => line.ingredientId === "espresso")?.unitCost).toBe(1.4);
  });

  it("modifier etkisinin maliyetini de baglar", () => {
    const index = indexCatalog(snapshot());
    const effect = index.effectsByOption.get(OAT)?.[0];
    expect(effect?.mode).toBe("replace");
    expect(effect?.unitCost).toBe(0.14);
  });
});

describe("freezeCartConsumption", () => {
  it("duz recete tuketimini dondurur", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: LATTE, quantity: 1, modifierOptionIds: [] },
    ]);

    expect(frozen).toHaveLength(1);
    expect(frozen[0].lineIndex).toBe(0);
    const espresso = frozen[0].lines.find((line) => line.ingredientId === "espresso");
    // Fire uygulanir: 18 / 0.97
    expect(espresso?.quantity).toBe(18.557);
  });

  it("Large + yulaf sutu sirasi dogru cozulur", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: LATTE, quantity: 1, modifierOptionIds: [LARGE, OAT] },
    ]);

    const ids = frozen[0].lines.map((line) => line.ingredientId);
    expect(ids).not.toContain("sut");
    expect(frozen[0].lines.find((line) => line.ingredientId === "yulaf_sutu")?.quantity).toBe(420);
  });

  it("recetesi olmayan urun icin kayit uretmez", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: SU, quantity: 2, modifierOptionIds: [] },
    ]);
    expect(frozen).toEqual([]);
  });

  it("kalem indeksini korur, recetesizleri atlar", () => {
    // Indeks tasimak sart: cevrimdisi satista order_items.id henuz yok,
    // senkronda olusur. Indeks sirali eslesmeyi saglar.
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: SU, quantity: 1, modifierOptionIds: [] },
      { productId: LATTE, quantity: 1, modifierOptionIds: [] },
    ]);

    expect(frozen).toHaveLength(1);
    expect(frozen[0].lineIndex).toBe(1);
  });

  it("adet ile carpar", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: LATTE, quantity: 3, modifierOptionIds: [] },
    ]);
    expect(frozen[0].lines.find((line) => line.ingredientId === "sut")?.quantity).toBe(900);
  });

  it("urun kimligi yoksa atlar", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: null, quantity: 1, modifierOptionIds: [] },
    ]);
    expect(frozen).toEqual([]);
  });

  it("recete tablosu bos ise sessizce bos doner", () => {
    const frozen = freezeCartConsumption(snapshot({ recipes: [], modifierEffects: [] }), [
      { productId: LATTE, quantity: 1, modifierOptionIds: [] },
    ]);
    expect(frozen).toEqual([]);
  });
});

describe("frozenConsumptionCost", () => {
  it("dondurulmus tuketimin maliyetini toplar", () => {
    const frozen = freezeCartConsumption(snapshot(), [
      { productId: LATTE, quantity: 1, modifierOptionIds: [] },
    ]);
    // 18.557 × 1.4 + 300 × 0.06
    expect(frozenConsumptionCost(frozen)).toBeCloseTo(43.98, 2);
  });

  it("yulaf sutu maliyeti artirir", () => {
    const base = frozenConsumptionCost(
      freezeCartConsumption(snapshot(), [{ productId: LATTE, quantity: 1, modifierOptionIds: [] }]),
    );
    const oat = frozenConsumptionCost(
      freezeCartConsumption(snapshot(), [{ productId: LATTE, quantity: 1, modifierOptionIds: [OAT] }]),
    );
    expect(oat - base).toBeCloseTo(24, 2);
  });
});
