/**
 * Recete cozumleyici.
 *
 * Girdi: urunun recete satirlari + secilen modifier'larin recete etkileri.
 * Cikti: satista donacak tuketim satirlari.
 *
 * Saf fonksiyon — veritabani, React veya ag yok. `modifiers/engine.ts` gibi
 * bagimsiz test edilebilir.
 *
 * Plan: PLAN-RECETE-MALIYET-STOK.md
 */

export type RecipeLine = {
  ingredientId: string;
  /** Recetede yazan miktar, taban birimde (18 g, 300 ml). */
  quantity: number;
  /**
   * Fire katsayisi. Gercek tuketim = quantity / yieldFactor.
   * 0.97 -> ogutme kaybi ve purge shot hesaba katilir.
   */
  yieldFactor?: number;
  unitCost?: number;
};

export type ModifierEffectMode = "add" | "remove" | "replace" | "scale";

export type ModifierEffect = {
  mode: ModifierEffectMode;
  /** add ve replace icin eklenecek malzeme. */
  ingredientId?: string;
  /** remove, replace ve scale icin hedeflenen recete satiri. */
  targetIngredientId?: string;
  quantity?: number;
  multiplier?: number;
  yieldFactor?: number;
  unitCost?: number;
};

export type ConsumptionSource = "recipe" | "modifier_add" | "modifier_replace" | "modifier_scale";

export type ConsumptionLine = {
  ingredientId: string;
  /** Fire uygulanmis gercek tuketim. */
  quantity: number;
  unitCost: number;
  source: ConsumptionSource;
};

export type ResolveInput = {
  recipe: RecipeLine[];
  effects: ModifierEffect[];
  /** Kalem adedi. Tuketim bununla carpilir. */
  quantity?: number;
};

/** Fire uygulanmis tuketim. yieldFactor gecersizse 1 kabul edilir. */
function withYield(quantity: number, yieldFactor?: number) {
  const factor = typeof yieldFactor === "number" && yieldFactor > 0 && yieldFactor <= 1 ? yieldFactor : 1;
  return quantity / factor;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Kip sirasi bilerek sabit: scale -> remove -> replace -> add.
 *
 * Sira olmazsa ayni secim farkli sonuc verir. Ornek: "Large" + "Yulaf sutu"
 * birlikte secilirse once olcek buyutulur, sonra sut yulaf sutuyle degistirilir;
 * boylece buyuk boy yulaf sutu miktari dogru cikar. Ters sirada olcek, silinmis
 * bir satira uygulanmaya calisilirdi.
 */
const MODE_ORDER: Record<ModifierEffectMode, number> = {
  scale: 0,
  remove: 1,
  replace: 2,
  add: 3,
};

export function resolveConsumption(input: ResolveInput): ConsumptionLine[] {
  const itemQuantity = Math.max(1, input.quantity ?? 1);

  // Recete satirlari isleme alinir. Ayni malzeme birden fazla satirda gecerse
  // toplanir; aksi halde replace/scale hangi satiri hedefleyecegini bilemez.
  const working = new Map<string, { quantity: number; unitCost: number; source: ConsumptionSource }>();

  for (const line of input.recipe) {
    if (!line.ingredientId || !(line.quantity > 0)) continue;
    const consumed = withYield(line.quantity, line.yieldFactor);
    const existing = working.get(line.ingredientId);
    working.set(line.ingredientId, {
      quantity: (existing?.quantity ?? 0) + consumed,
      unitCost: line.unitCost ?? existing?.unitCost ?? 0,
      source: "recipe",
    });
  }

  const ordered = [...input.effects].sort((a, b) => MODE_ORDER[a.mode] - MODE_ORDER[b.mode]);

  for (const effect of ordered) {
    if (effect.mode === "scale") {
      const target = effect.targetIngredientId;
      const multiplier = effect.multiplier ?? 0;
      if (!target || multiplier <= 0) continue;
      const current = working.get(target);
      // Olceklenecek satir yoksa sessizce atlanir: recetesi olmayan urunde
      // "Large" secmek hata degil, sadece etkisiz.
      if (!current) continue;
      working.set(target, {
        ...current,
        quantity: current.quantity * multiplier,
        source: "modifier_scale",
      });
      continue;
    }

    if (effect.mode === "remove") {
      if (!effect.targetIngredientId) continue;
      working.delete(effect.targetIngredientId);
      continue;
    }

    if (effect.mode === "replace") {
      const target = effect.targetIngredientId;
      const replacement = effect.ingredientId;
      if (!target || !replacement) continue;

      const current = working.get(target);
      // Miktar verilmemisse hedefin miktari korunur: 300 ml sut yerine 300 ml
      // yulaf sutu. Hedef satir yoksa etki uygulanmaz — olmayan seyi
      // degistirmek yerine sessiz kalmak dogru; yoksa cift tuketim yazilirdi.
      if (!current) continue;

      const quantity = effect.quantity
        ? withYield(effect.quantity, effect.yieldFactor)
        : current.quantity;

      working.delete(target);
      const existing = working.get(replacement);
      working.set(replacement, {
        quantity: (existing?.quantity ?? 0) + quantity,
        unitCost: effect.unitCost ?? existing?.unitCost ?? 0,
        source: "modifier_replace",
      });
      continue;
    }

    // add
    const ingredientId = effect.ingredientId;
    if (!ingredientId || !(effect.quantity && effect.quantity > 0)) continue;
    const added = withYield(effect.quantity, effect.yieldFactor);
    const existing = working.get(ingredientId);
    working.set(ingredientId, {
      quantity: (existing?.quantity ?? 0) + added,
      unitCost: effect.unitCost ?? existing?.unitCost ?? 0,
      // Recete satirina ekleme yapildiysa kaynak recete olarak kalir; tamamen
      // yeni malzeme ise modifier kaynaklidir.
      source: existing ? existing.source : "modifier_add",
    });
  }

  return [...working.entries()]
    .filter(([, value]) => value.quantity > 0)
    .map(([ingredientId, value]) => ({
      ingredientId,
      quantity: round3(value.quantity * itemQuantity),
      unitCost: value.unitCost,
      source: value.source,
    }));
}

/** Tuketim satirlarindan birim maliyet. Urunun kendi `cost` alani haric. */
export function consumptionCost(lines: ConsumptionLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
}
