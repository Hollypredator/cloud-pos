"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import type { Ingredient, ModifierEffectMode, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";

/**
 * Hizli recete editoru.
 *
 * Eski akis her malzeme icin ayri server-action formu ve tam sayfa yenilemesi
 * istiyordu: 40 urun x ~3 malzeme = 120 gidis-donus, gercekte 1-2 saat.
 * Kimse doldurmadigi icin katalogdaki her urunun marji %100 gorunuyor.
 *
 * Hiz burada "musteri bekliyor" diye degil, "ozellik terk edilmesin" diye
 * gerekiyor: recete bos kalirsa maliyet motoru, fark raporu ve stok dusumu
 * bir ise yaramaz.
 *
 * Tasarim kararlari:
 *   - Urun degistirmek sayfa yenilemez; secim istemci tarafinda.
 *   - Birim malzemeden gelir, ayri alan yok. "18" yazarsin, yaninda "g" yazar.
 *     Birim alani koymak hem yavaslatir hem tutarsizlik uretir.
 *   - Enter yeni satir acar ve imleci malzeme alanina birakir.
 *   - Tek "Kaydet": urun basina tek istek, degistirme semantigi.
 */

export type RecipeLineDraft = {
  key: string;
  ingredientId: string;
  quantity: string;
  /** Yuzde olarak (1-100). Sunucuya kaydedilirken 0-1 kesire cevrilir. */
  yieldPct: string;
};

/** Modifier secenegin receteye etkisi. Tek satir = tek etki (add/remove/replace/scale). */
export type ModifierEffectLineDraft = {
  key: string;
  mode: ModifierEffectMode;
  /** add ve replace icin eklenecek/degistirilecek malzeme. */
  ingredientId: string;
  /** remove, replace ve scale icin hedeflenen recete satiri. */
  targetIngredientId: string;
  quantity: string;
  multiplier: string;
};

export type ModifierEffectSaveLine = {
  mode: ModifierEffectMode;
  ingredientId?: string;
  targetIngredientId?: string;
  quantity?: number;
  multiplier?: number;
};

export type RecipeEditorProps = {
  products: Product[];
  ingredients: Ingredient[];
  /** Urun kimligi -> mevcut recete satirlari. */
  initialRecipes: Record<string, Array<{ ingredientId: string; quantity: number; yieldFactor?: number }>>;
  /**
   * Kaydetmeyi engelleyen sebep. Demo katalog acikken urunler sahte kimlikli
   * gelir ve kayit sunucuda reddedilir; kullaniciyi recete yazdiktan SONRA
   * reddetmek yerine bastan uyarmak dogru.
   */
  readOnlyReason?: string | null;
  onSave: (
    productId: string,
    lines: Array<{ ingredientId: string; quantity: number; yieldFactor: number }>,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Urunun modifier gruplari (tumu; bilesende urun kimligine gore filtrelenir). */
  modifierGroups?: ProductModifierGroup[];
  /** Modifier secenekleri (tumu; grup kimligine gore filtrelenir). */
  modifierOptions?: ProductModifierOption[];
  /** Secenek kimligi -> mevcut recete etkileri. */
  initialModifierEffects?: Record<string, ModifierEffectSaveLine[]>;
  onSaveModifierEffects?: (
    optionId: string,
    effects: ModifierEffectSaveLine[],
  ) => Promise<{ ok: boolean; error?: string }>;
};

function newKey() {
  return `line-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLine(): RecipeLineDraft {
  return { key: newKey(), ingredientId: "", quantity: "", yieldPct: "100" };
}

/** "%97" -> 0.97. Gecersiz/bos deger veya 0 -> fire yok (1) sayilir. */
function clampYield(pctText: string) {
  const pct = Number(pctText);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return 1;
  return pct / 100;
}

function newEffectLine(): ModifierEffectLineDraft {
  return { key: newKey(), mode: "add", ingredientId: "", targetIngredientId: "", quantity: "", multiplier: "" };
}

function effectSummary(line: ModifierEffectLineDraft, ingredientById: Map<string, Ingredient>) {
  const ingredientName = ingredientById.get(line.ingredientId)?.name ?? "?";
  const targetName = ingredientById.get(line.targetIngredientId)?.name ?? "?";
  if (line.mode === "add") return `+ ${ingredientName} (${line.quantity || "0"})`;
  if (line.mode === "remove") return `− ${targetName}`;
  if (line.mode === "replace") return `${targetName} yerine ${ingredientName}${line.quantity ? ` (${line.quantity})` : ""}`;
  return `${targetName} x${line.multiplier || "0"}`;
}

const MODIFIER_EFFECT_MODE_LABELS: Record<ModifierEffectMode, string> = {
  add: "Ekle",
  remove: "Çıkar",
  replace: "Değiştir",
  scale: "Ölçekle",
};

export function RecipeEditor({
  products,
  ingredients,
  initialRecipes,
  readOnlyReason,
  onSave,
  modifierGroups = [],
  modifierOptions = [],
  initialModifierEffects = {},
  onSaveModifierEffects,
}: RecipeEditorProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, RecipeLineDraft[]>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [effectDrafts, setEffectDrafts] = useState<Record<string, ModifierEffectLineDraft[]>>({});
  const [savingOptionId, setSavingOptionId] = useState<string | null>(null);
  const [optionStatus, setOptionStatus] = useState<Record<string, { tone: "ok" | "error"; message: string }>>({});
  const lastRowRef = useRef<HTMLSelectElement | null>(null);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const visibleProducts = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("tr-TR");
    if (!text) return products;
    return products.filter((product) => product.name.toLocaleLowerCase("tr-TR").includes(text));
  }, [products, query]);

  /** Taslak yoksa kayitli receteden turetilir. */
  const linesFor = (productId: string): RecipeLineDraft[] => {
    if (drafts[productId]) return drafts[productId];
    const saved = initialRecipes[productId] ?? [];
    if (saved.length === 0) return [emptyLine()];
    return saved.map((line) => ({
      key: newKey(),
      ingredientId: line.ingredientId,
      quantity: String(line.quantity),
      yieldPct: String(Math.round((line.yieldFactor && line.yieldFactor > 0 ? line.yieldFactor : 1) * 100)),
    }));
  };

  const setLines = (productId: string, lines: RecipeLineDraft[]) => {
    setDrafts((prev) => ({ ...prev, [productId]: lines }));
    setStatus(null);
  };

  const recipeCount = (productId: string) =>
    (drafts[productId] ?? initialRecipes[productId]?.map(() => null) ?? []).filter(Boolean).length ||
    (initialRecipes[productId]?.length ?? 0);

  const selected = selectedId ? products.find((product) => product.id === selectedId) ?? null : null;
  const lines = selected ? linesFor(selected.id) : [];

  /** Taslak yoksa kayitli etkilerden turetilir. Bos secenekte otomatik satir eklenmez. */
  const effectsForOption = (optionId: string): ModifierEffectLineDraft[] => {
    if (effectDrafts[optionId]) return effectDrafts[optionId];
    const saved = initialModifierEffects[optionId] ?? [];
    return saved.map((line) => ({
      key: newKey(),
      mode: line.mode,
      ingredientId: line.ingredientId ?? "",
      targetIngredientId: line.targetIngredientId ?? "",
      quantity: line.quantity != null ? String(line.quantity) : "",
      multiplier: line.multiplier != null ? String(line.multiplier) : "",
    }));
  };

  const setEffectLines = (optionId: string, lines: ModifierEffectLineDraft[]) => {
    setEffectDrafts((prev) => ({ ...prev, [optionId]: lines }));
    setOptionStatus((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
  };

  const saveOptionEffects = async (optionId: string) => {
    if (!onSaveModifierEffects || readOnlyReason) return;
    setSavingOptionId(optionId);

    const payload: ModifierEffectSaveLine[] = effectsForOption(optionId)
      .filter((line) => {
        if (line.mode === "add") return line.ingredientId && Number(line.quantity) > 0;
        if (line.mode === "remove") return Boolean(line.targetIngredientId);
        if (line.mode === "replace") return Boolean(line.targetIngredientId) && Boolean(line.ingredientId);
        return Boolean(line.targetIngredientId) && Number(line.multiplier) > 0;
      })
      .map((line) => ({
        mode: line.mode,
        ingredientId: line.ingredientId || undefined,
        targetIngredientId: line.targetIngredientId || undefined,
        quantity: line.quantity ? Number(line.quantity) : undefined,
        multiplier: line.multiplier ? Number(line.multiplier) : undefined,
      }));

    const result = await onSaveModifierEffects(optionId, payload);
    setSavingOptionId(null);

    setOptionStatus((prev) => ({
      ...prev,
      [optionId]: result.ok
        ? { tone: "ok", message: `Kaydedildi (${payload.length} etki).` }
        : { tone: "error", message: result.error ?? "Etki kaydedilemedi." },
    }));
  };

  /** Sunucudaki formulle ayni: gercek tuketim = miktar / fire. */
  const lineCost = (line: RecipeLineDraft) => {
    const ingredient = ingredientById.get(line.ingredientId);
    const quantity = Number(line.quantity);
    if (!ingredient || !Number.isFinite(quantity)) return 0;
    const yieldFactor = clampYield(line.yieldPct);
    return (quantity / yieldFactor) * Number(ingredient.cost ?? 0);
  };

  const totalCost = lines.reduce((sum, line) => sum + lineCost(line), 0);

  const addLine = (productId: string) => {
    setLines(productId, [...linesFor(productId), emptyLine()]);
    // Yeni satir eklendikten sonra imlec oraya gitsin; art arda giris akiyor.
    window.setTimeout(() => lastRowRef.current?.focus(), 0);
  };

  const save = async () => {
    if (!selected || readOnlyReason) return;
    setSaving(true);
    setStatus(null);

    const payload = linesFor(selected.id)
      .filter((line) => line.ingredientId && Number(line.quantity) > 0)
      .map((line) => ({
        ingredientId: line.ingredientId,
        quantity: Number(line.quantity),
        yieldFactor: clampYield(line.yieldPct),
      }));

    const result = await onSave(selected.id, payload);
    setSaving(false);

    if (!result.ok) {
      setStatus({ tone: "error", message: result.error ?? "Reçete kaydedilemedi." });
      return;
    }
    setStatus({ tone: "ok", message: `${selected.name} reçetesi kaydedildi (${payload.length} malzeme).` });
  };

  return (
    <div className="space-y-3">
      {readOnlyReason ? (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{readOnlyReason}</span>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Urun listesi */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün ara..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>

        <ul className="max-h-[520px] overflow-y-auto p-2">
          {visibleProducts.map((product) => {
            const count = recipeCount(product.id);
            const active = product.id === selectedId;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(product.id);
                    setStatus(null);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                    active ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate font-semibold">{product.name}</span>
                  {count === 0 ? (
                    // Karar D3.3: recetesi olmayan urun sessizce %100 marj
                    // gostermemeli, acikca isaretlenmeli.
                    <span
                      title="Reçete yok — maliyet eksik"
                      className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-amber-400 text-amber-950" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      yok
                    </span>
                  ) : (
                    <span className={`shrink-0 text-[11px] ${active ? "text-white/60" : "text-slate-400"}`}>
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {visibleProducts.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-400">Eşleşen ürün yok.</li>
          ) : null}
        </ul>
      </div>

      {/* Recete paneli */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        {!selected ? (
          <p className="p-6 text-sm text-slate-500">Soldan bir ürün seçin.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">{selected.name}</h3>
                <p className="text-xs text-slate-500">
                  Satış fiyatı ₺{Number(selected.price).toFixed(2)} · Reçete maliyeti ₺{totalCost.toFixed(2)}
                  {Number(selected.price) > 0 ? (
                    <> · Marj %{(((Number(selected.price) - totalCost) / Number(selected.price)) * 100).toFixed(0)}</>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={save}
                disabled={saving || Boolean(readOnlyReason)}
                title={readOnlyReason ?? undefined}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Kaydet
              </button>
            </div>

            {status ? (
              <p
                role="status"
                className={`border-b px-4 py-2.5 text-sm font-semibold ${
                  status.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {status.message}
              </p>
            ) : null}

            <div className="space-y-2 p-4">
              {lines.map((line, index) => {
                const ingredient = ingredientById.get(line.ingredientId);
                const isLast = index === lines.length - 1;
                return (
                  <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_150px_88px_auto] sm:items-center">
                    <select
                      ref={isLast ? lastRowRef : undefined}
                      value={line.ingredientId}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, ingredientId: event.target.value };
                        setLines(selected.id, next);
                      }}
                      className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">Malzeme seç...</option>
                      {ingredients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...line, quantity: event.target.value };
                          setLines(selected.id, next);
                        }}
                        onKeyDown={(event) => {
                          // Enter yeni satir acar: art arda giriste el klavyeden
                          // kalkmasin.
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addLine(selected.id);
                          }
                        }}
                        placeholder="Miktar"
                        className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      />
                      <span className="w-10 shrink-0 text-xs font-semibold text-slate-500">
                        {ingredient?.unit ?? ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" title="Fire katsayısı — öğütme/purge kaybı gibi. Gerçek tüketim = miktar / fire.">
                      <input
                        inputMode="decimal"
                        value={line.yieldPct}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...line, yieldPct: event.target.value };
                          setLines(selected.id, next);
                        }}
                        placeholder="100"
                        className="min-h-[40px] w-14 rounded-xl border border-slate-200 bg-white px-2 text-right text-sm"
                      />
                      <span className="text-xs text-slate-400">% fire</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-20 text-right text-xs text-slate-500">
                        ₺{lineCost(line).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLines(selected.id, lines.filter((item) => item.key !== line.key))}
                        aria-label="Satırı sil"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addLine(selected.id)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:border-slate-400"
              >
                <Plus className="h-4 w-4" />
                Malzeme ekle
              </button>
            </div>

            {onSaveModifierEffects && modifierGroups.some((group) => group.product_id === selected.id) ? (
              <div className="space-y-3 border-t border-slate-200 p-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Ekler / Boy Malzeme Etkisi
                </h4>
                {modifierGroups
                  .filter((group) => group.product_id === selected.id)
                  .map((group) => (
                    <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-900">{group.name}</p>
                      <div className="space-y-3">
                        {modifierOptions
                          .filter((option) => option.group_id === group.id)
                          .map((option) => {
                            const effectLines = effectsForOption(option.id);
                            const rowStatus = optionStatus[option.id];
                            return (
                              <div key={option.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-slate-800">{option.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => saveOptionEffects(option.id)}
                                    disabled={savingOptionId === option.id || Boolean(readOnlyReason)}
                                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-60"
                                  >
                                    {savingOptionId === option.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    Kaydet
                                  </button>
                                </div>

                                {rowStatus ? (
                                  <p
                                    className={`mt-1.5 text-xs font-semibold ${
                                      rowStatus.tone === "ok" ? "text-emerald-700" : "text-rose-700"
                                    }`}
                                  >
                                    {rowStatus.message}
                                  </p>
                                ) : null}

                                <div className="mt-2 space-y-1.5">
                                  {effectLines.map((line, index) => (
                                    <div key={line.key} className="flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5">
                                      <select
                                        value={line.mode}
                                        onChange={(event) => {
                                          const next = [...effectLines];
                                          next[index] = { ...line, mode: event.target.value as ModifierEffectMode };
                                          setEffectLines(option.id, next);
                                        }}
                                        className="min-h-[32px] rounded-md border border-slate-200 bg-white px-2 text-xs"
                                      >
                                        {(Object.keys(MODIFIER_EFFECT_MODE_LABELS) as ModifierEffectMode[]).map((mode) => (
                                          <option key={mode} value={mode}>
                                            {MODIFIER_EFFECT_MODE_LABELS[mode]}
                                          </option>
                                        ))}
                                      </select>

                                      {line.mode === "remove" || line.mode === "replace" || line.mode === "scale" ? (
                                        <select
                                          value={line.targetIngredientId}
                                          onChange={(event) => {
                                            const next = [...effectLines];
                                            next[index] = { ...line, targetIngredientId: event.target.value };
                                            setEffectLines(option.id, next);
                                          }}
                                          className="min-h-[32px] min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        >
                                          <option value="">Hedef malzeme...</option>
                                          {ingredients.map((item) => (
                                            <option key={item.id} value={item.id}>
                                              {item.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : null}

                                      {line.mode === "add" || line.mode === "replace" ? (
                                        <select
                                          value={line.ingredientId}
                                          onChange={(event) => {
                                            const next = [...effectLines];
                                            next[index] = { ...line, ingredientId: event.target.value };
                                            setEffectLines(option.id, next);
                                          }}
                                          className="min-h-[32px] min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        >
                                          <option value="">{line.mode === "replace" ? "Yerine..." : "Malzeme..."}</option>
                                          {ingredients.map((item) => (
                                            <option key={item.id} value={item.id}>
                                              {item.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : null}

                                      {line.mode === "add" || line.mode === "replace" ? (
                                        <input
                                          inputMode="decimal"
                                          value={line.quantity}
                                          onChange={(event) => {
                                            const next = [...effectLines];
                                            next[index] = { ...line, quantity: event.target.value };
                                            setEffectLines(option.id, next);
                                          }}
                                          placeholder={line.mode === "replace" ? "Miktar (boşsa aynı)" : "Miktar"}
                                          className="min-h-[32px] w-24 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        />
                                      ) : null}

                                      {line.mode === "scale" ? (
                                        <input
                                          inputMode="decimal"
                                          value={line.multiplier}
                                          onChange={(event) => {
                                            const next = [...effectLines];
                                            next[index] = { ...line, multiplier: event.target.value };
                                            setEffectLines(option.id, next);
                                          }}
                                          placeholder="Çarpan (örn 2)"
                                          className="min-h-[32px] w-24 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        />
                                      ) : null}

                                      <span className="ml-auto text-[10px] text-slate-400">
                                        {effectSummary(line, ingredientById)}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEffectLines(
                                            option.id,
                                            effectLines.filter((item) => item.key !== line.key),
                                          )
                                        }
                                        aria-label="Etkiyi sil"
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-rose-600"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setEffectLines(option.id, [...effectLines, newEffectLine()])}
                                  className="mt-2 inline-flex min-h-[28px] items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 text-xs font-semibold text-slate-600 hover:border-slate-400"
                                >
                                  <Plus className="h-3 w-3" />
                                  Etki ekle
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
