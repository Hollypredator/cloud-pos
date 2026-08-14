import { describe, expect, it } from "vitest";
import { toFrozenConsumption } from "./command-executor";

/**
 * `toFrozenConsumption` istemcinin komut payload'ina ekledigi dondurulmus
 * tuketimi ayristirir. Sunucu bunu OLDUGU GIBI yazar, yeniden hesaplamaz —
 * bu yuzden ayristirmanin gecersiz veriyi sessizce atlayip GECERLI veriyi
 * bozmadan gecirmesi kritik (PLAN-RECETE-MALIYET-STOK.md Faz 3).
 */
describe("toFrozenConsumption", () => {
  it("gecerli girdiyi aynen gecirir", () => {
    const result = toFrozenConsumption([
      { lineIndex: 0, lines: [{ ingredientId: "espresso", quantity: 18.557, unitCost: 1.4, source: "recipe" }] },
    ]);
    expect(result).toEqual([
      { lineIndex: 0, lines: [{ ingredientId: "espresso", quantity: 18.557, unitCost: 1.4, source: "recipe" }] },
    ]);
  });

  it("dizi degilse undefined doner", () => {
    expect(toFrozenConsumption(null)).toBeUndefined();
    expect(toFrozenConsumption(undefined)).toBeUndefined();
    expect(toFrozenConsumption("nope")).toBeUndefined();
    expect(toFrozenConsumption({})).toBeUndefined();
  });

  it("bos dizi icin undefined doner", () => {
    expect(toFrozenConsumption([])).toBeUndefined();
  });

  it("lineIndex eksikse girdiyi atlar", () => {
    const result = toFrozenConsumption([
      { lines: [{ ingredientId: "espresso", quantity: 18, unitCost: 1.4, source: "recipe" }] },
    ]);
    expect(result).toBeUndefined();
  });

  it("lines dizi degilse girdiyi atlar", () => {
    const result = toFrozenConsumption([{ lineIndex: 0, lines: "espresso" }]);
    expect(result).toBeUndefined();
  });

  it("ingredientId veya gecersiz miktar tasiyan satiri atlar", () => {
    const result = toFrozenConsumption([
      {
        lineIndex: 0,
        lines: [
          { ingredientId: "", quantity: 18, unitCost: 1.4, source: "recipe" },
          { ingredientId: "sut", quantity: 0, unitCost: 0.06, source: "recipe" },
          { ingredientId: "sut", quantity: -5, unitCost: 0.06, source: "recipe" },
          { ingredientId: "espresso", quantity: 18, unitCost: 1.4, source: "recipe" },
        ],
      },
    ]);
    expect(result).toEqual([
      { lineIndex: 0, lines: [{ ingredientId: "espresso", quantity: 18, unitCost: 1.4, source: "recipe" }] },
    ]);
  });

  it("tum satirlari gecersizse girdiyi tamamen atlar", () => {
    const result = toFrozenConsumption([{ lineIndex: 0, lines: [{ ingredientId: "", quantity: 18 }] }]);
    expect(result).toBeUndefined();
  });

  it("unitCost ve source eksikse guvenli varsayilan kullanir", () => {
    const result = toFrozenConsumption([
      { lineIndex: 1, lines: [{ ingredientId: "espresso", quantity: 18 }] },
    ]);
    expect(result).toEqual([
      { lineIndex: 1, lines: [{ ingredientId: "espresso", quantity: 18, unitCost: 0, source: "recipe" }] },
    ]);
  });

  it("birden fazla kalemi indeks sirasiyla korur", () => {
    const result = toFrozenConsumption([
      { lineIndex: 2, lines: [{ ingredientId: "sut", quantity: 300 }] },
      { lineIndex: 0, lines: [{ ingredientId: "espresso", quantity: 18 }] },
    ]);
    expect(result?.map((entry) => entry.lineIndex)).toEqual([2, 0]);
  });

  it("bozuk dizi ogelerini atlar, gecerli olanlari korur", () => {
    const result = toFrozenConsumption([
      null,
      "bozuk",
      { lineIndex: 0, lines: [{ ingredientId: "espresso", quantity: 18 }] },
    ]);
    expect(result).toHaveLength(1);
    expect(result?.[0].lineIndex).toBe(0);
  });
});
