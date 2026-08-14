"use client";

import { resolveConsumption, type ModifierEffect, type RecipeLine } from "@/lib/recipes/engine";
import type { CatalogSnapshot } from "@/lib/offline/catalog-store";

/**
 * Onbelleklenmis katalogdan tuketim cozer — istemcide, satis aninda.
 *
 * Bu dosyanin varlik sebebi tek bir karar: "tuketim satis aninda dondurulur"
 * (PLAN-RECETE-MALIYET-STOK.md). Sunucuda cozulseydi cevrimdisi bir siparis
 * saatler sonra senkron oldugunda O ANKI receteyle dusum yapardi; recete
 * degismisse satilan kahve ile dusen malzeme tutmazdi.
 *
 * `recipes/consumption.ts` ayni isi sunucuda, Supabase'den okuyarak yapar.
 * Ikisi de ayni saf motoru (`recipes/engine.ts`) cagirir; kural tek yerde.
 */

export type CartLineForConsumption = {
  productId: string | null;
  quantity: number;
  modifierOptionIds: string[];
};

export type FrozenConsumptionLine = {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  source: string;
};

export type FrozenConsumption = {
  /** Sepet sirasindaki kalem indeksi; senkronda siparis kalemiyle eslesir. */
  lineIndex: number;
  lines: FrozenConsumptionLine[];
};

type CatalogIndex = {
  recipesByProduct: Map<string, RecipeLine[]>;
  effectsByOption: Map<string, ModifierEffect[]>;
};

/** Anlik goruntuyu arama yapilabilir hale getirir. Sepet basina bir kez. */
export function indexCatalog(snapshot: CatalogSnapshot): CatalogIndex {
  const costById = new Map(snapshot.ingredients.map((item) => [item.id, item.cost]));

  const recipesByProduct = new Map<string, RecipeLine[]>();
  for (const row of snapshot.recipes) {
    const lines = recipesByProduct.get(row.productId) ?? [];
    lines.push({
      ingredientId: row.ingredientId,
      quantity: row.quantity,
      yieldFactor: row.yieldFactor,
      unitCost: costById.get(row.ingredientId) ?? 0,
    });
    recipesByProduct.set(row.productId, lines);
  }

  const effectsByOption = new Map<string, ModifierEffect[]>();
  for (const row of snapshot.modifierEffects) {
    const effects = effectsByOption.get(row.optionId) ?? [];
    effects.push({
      mode: row.mode as ModifierEffect["mode"],
      ingredientId: row.ingredientId ?? undefined,
      targetIngredientId: row.targetIngredientId ?? undefined,
      quantity: row.quantity ?? undefined,
      multiplier: row.multiplier ?? undefined,
      unitCost: row.ingredientId ? costById.get(row.ingredientId) ?? 0 : 0,
    });
    effectsByOption.set(row.optionId, effects);
  }

  return { recipesByProduct, effectsByOption };
}

/**
 * Sepetin tuketimini dondurur.
 *
 * Kalem kimligi yerine INDEKS tasinir: cevrimdisi satista `order_items.id`
 * henuz yok, sunucuda senkron aninda olusur. Senkron sirasi korundugu icin
 * indeks guvenli eslesme saglar.
 */
export function freezeCartConsumption(
  snapshot: CatalogSnapshot,
  cart: CartLineForConsumption[],
): FrozenConsumption[] {
  const index = indexCatalog(snapshot);
  const frozen: FrozenConsumption[] = [];

  cart.forEach((line, lineIndex) => {
    if (!line.productId) return;

    const recipe = index.recipesByProduct.get(line.productId);
    // Recetesi olmayan urun dusum yapmaz: sise su, hazir kek gibi kalemlerin
    // recetesi olmayabilir. Hata degil.
    if (!recipe || recipe.length === 0) return;

    const effects = line.modifierOptionIds.flatMap(
      (optionId) => index.effectsByOption.get(optionId) ?? [],
    );

    const lines = resolveConsumption({ recipe, effects, quantity: line.quantity });
    if (lines.length === 0) return;

    frozen.push({
      lineIndex,
      lines: lines.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        source: item.source,
      })),
    });
  });

  return frozen;
}

/** Dondurulmus tuketimin toplam maliyeti — fis ve rapor icin. */
export function frozenConsumptionCost(frozen: FrozenConsumption[]) {
  return frozen.reduce(
    (sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + line.quantity * line.unitCost, 0),
    0,
  );
}
