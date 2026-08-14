import { describe, expect, it } from "vitest";
import { consumptionCost, resolveConsumption, type ModifierEffect, type RecipeLine } from "./engine";

/**
 * Latte recetesi: 18 g espresso + 300 ml sut + 1 adet bardak.
 * Fire: cekirdekte ogutme kaybi var (0.97).
 */
const LATTE: RecipeLine[] = [
  { ingredientId: "espresso", quantity: 18, yieldFactor: 0.97, unitCost: 1.4 },
  { ingredientId: "sut", quantity: 300, unitCost: 0.06 },
  { ingredientId: "bardak", quantity: 1, unitCost: 1.2 },
];

function byIngredient(lines: ReturnType<typeof resolveConsumption>) {
  return new Map(lines.map((line) => [line.ingredientId, line]));
}

describe("resolveConsumption", () => {
  it("recete satirlarini fire ile birlikte cozer", () => {
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects: [] }));

    // 18 / 0.97 = 18.557 -> 18.557
    expect(result.get("espresso")?.quantity).toBe(18.557);
    expect(result.get("sut")?.quantity).toBe(300);
    expect(result.get("bardak")?.quantity).toBe(1);
    expect(result.get("espresso")?.source).toBe("recipe");
  });

  it("fire verilmezse miktar aynen kalir", () => {
    const result = byIngredient(
      resolveConsumption({ recipe: [{ ingredientId: "sut", quantity: 200 }], effects: [] }),
    );
    expect(result.get("sut")?.quantity).toBe(200);
  });

  it("adet ile carpar", () => {
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects: [], quantity: 3 }));
    expect(result.get("sut")?.quantity).toBe(900);
    expect(result.get("bardak")?.quantity).toBe(3);
  });

  it("add: ekstra shot cekirdegi artirir", () => {
    const effects: ModifierEffect[] = [
      { mode: "add", ingredientId: "espresso", quantity: 18, yieldFactor: 0.97, unitCost: 1.4 },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));
    expect(result.get("espresso")?.quantity).toBe(37.113);
  });

  it("add: recetede olmayan malzeme modifier kaynakli isaretlenir", () => {
    const effects: ModifierEffect[] = [
      { mode: "add", ingredientId: "vanilya", quantity: 20, unitCost: 0.25 },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));
    expect(result.get("vanilya")?.source).toBe("modifier_add");
  });

  it("remove: sutsuz secimi sut satirini siler", () => {
    const effects: ModifierEffect[] = [{ mode: "remove", targetIngredientId: "sut" }];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));
    expect(result.has("sut")).toBe(false);
    expect(result.has("espresso")).toBe(true);
  });

  it("replace: yulaf sutu ayni miktari devralir", () => {
    const effects: ModifierEffect[] = [
      { mode: "replace", targetIngredientId: "sut", ingredientId: "yulaf_sutu", unitCost: 0.14 },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));

    expect(result.has("sut")).toBe(false);
    expect(result.get("yulaf_sutu")?.quantity).toBe(300);
    expect(result.get("yulaf_sutu")?.unitCost).toBe(0.14);
    expect(result.get("yulaf_sutu")?.source).toBe("modifier_replace");
  });

  it("replace: hedef satir yoksa tuketim yazilmaz", () => {
    // Olmayan seyi degistirmek cift tuketim yazmamali.
    const effects: ModifierEffect[] = [
      { mode: "replace", targetIngredientId: "krema", ingredientId: "yulaf_sutu" },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));
    expect(result.has("yulaf_sutu")).toBe(false);
  });

  it("scale: Large yalnizca hedef satiri buyutur", () => {
    const effects: ModifierEffect[] = [
      { mode: "scale", targetIngredientId: "sut", multiplier: 1.4 },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));

    expect(result.get("sut")?.quantity).toBe(420);
    // Espresso dozu degismez — kafelerde boy buyudugunde shot ayni kalir.
    expect(result.get("espresso")?.quantity).toBe(18.557);
  });

  it("scale + replace birlikte: once olcek, sonra degisim", () => {
    // Sira yanlis olsaydi olcek silinmis satira uygulanir, yulaf sutu 300 ml
    // kalirdi. Dogru sonuc 420 ml.
    const effects: ModifierEffect[] = [
      { mode: "replace", targetIngredientId: "sut", ingredientId: "yulaf_sutu", unitCost: 0.14 },
      { mode: "scale", targetIngredientId: "sut", multiplier: 1.4 },
    ];
    const result = byIngredient(resolveConsumption({ recipe: LATTE, effects }));

    expect(result.has("sut")).toBe(false);
    expect(result.get("yulaf_sutu")?.quantity).toBe(420);
  });

  it("scale: hedef yoksa sessizce atlanir", () => {
    const effects: ModifierEffect[] = [
      { mode: "scale", targetIngredientId: "krema", multiplier: 2 },
    ];
    const result = resolveConsumption({ recipe: LATTE, effects });
    expect(result).toHaveLength(3);
  });

  it("recetesiz urun bos tuketim doner", () => {
    expect(resolveConsumption({ recipe: [], effects: [] })).toEqual([]);
  });

  it("gecersiz miktarlar yok sayilir", () => {
    const result = resolveConsumption({
      recipe: [
        { ingredientId: "sut", quantity: 0 },
        { ingredientId: "", quantity: 10 },
      ],
      effects: [{ mode: "add", ingredientId: "vanilya", quantity: -5 }],
    });
    expect(result).toEqual([]);
  });

  it("ayni malzeme birden fazla recete satirinda ise toplanir", () => {
    const result = byIngredient(
      resolveConsumption({
        recipe: [
          { ingredientId: "sut", quantity: 200 },
          { ingredientId: "sut", quantity: 100 },
        ],
        effects: [],
      }),
    );
    expect(result.get("sut")?.quantity).toBe(300);
  });
});

describe("consumptionCost", () => {
  it("tuketim maliyetini toplar", () => {
    const lines = resolveConsumption({ recipe: LATTE, effects: [] });
    // 18.557 × 1.4 + 300 × 0.06 + 1 × 1.2 = 25.98 + 18 + 1.2
    expect(consumptionCost(lines)).toBeCloseTo(45.18, 2);
  });

  it("yulaf sutu maliyeti artirir", () => {
    const base = consumptionCost(resolveConsumption({ recipe: LATTE, effects: [] }));
    const oat = consumptionCost(
      resolveConsumption({
        recipe: LATTE,
        effects: [
          { mode: "replace", targetIngredientId: "sut", ingredientId: "yulaf_sutu", unitCost: 0.14 },
        ],
      }),
    );
    // 300 × (0.14 - 0.06) = 24 TL fark
    expect(oat - base).toBeCloseTo(24, 2);
  });
});
