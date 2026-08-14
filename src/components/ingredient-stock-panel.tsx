"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Search, Truck } from "lucide-react";
import type { IngredientStockRow } from "@/lib/data";

/**
 * Malzeme stoğu: sayım ve alım girişi tek panelde.
 *
 * Ayni ekranda urun stoğu da var; ikisi tek "stok" basligi altinda durur.
 * Iki ayri ekran yapilsaydi personel hangi stogu sayacagini bilemez, patron
 * iki farkli sayim yurutur ve fark raporu iki kaynaktan beslenirdi.
 *
 * Sayım ve alım da ayni gerekce ile TEK panelde iki sekme: ikisi de ayni
 * malzeme listesini, ayni arama/kritik filtresini kullanir. Ayri bilesenler
 * ayni listeyi iki kez cizip ayri kod yollarinda tutarsizlasabilirdi.
 *
 * Hiz kurallari reçete editörüyle ayni:
 *   - Sayfa yenilemesi yok, tek "Kaydet".
 *   - Enter bir sonraki satira gecer; el klavyeden kalkmaz.
 *   - Birim malzemeden gelir, ayri alan yok.
 *   - Sonuc (fark / yeni ortalama maliyet) canli hesaplanir; kaydetmeden
 *     once ne olacagi gorunur.
 */

export type IngredientStockPanelProps = {
  rows: IngredientStockRow[];
  schemaReady: boolean;
  onSaveCount: (input: {
    startedAt: string;
    reason: string;
    items: Array<{ ingredientId: string; countedQuantity: number }>;
  }) => Promise<{ ok: boolean; error?: string; adjusted?: number; message?: string }>;
  onSavePurchase: (input: {
    note: string;
    items: Array<{ ingredientId: string; quantity: number; unitCost: number }>;
  }) => Promise<{ ok: boolean; error?: string; adjusted?: number; message?: string }>;
};

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/** Hareketli agirlikli ortalama — sunucudaki record_ingredient_purchase ile ayni formul. Onizleme icin. */
function previewAverageCost(currentQty: number, currentCost: number, purchaseQty: number, purchaseCost: number) {
  const totalQty = currentQty + purchaseQty;
  if (totalQty <= 0) return purchaseCost;
  return Math.round(((currentQty * currentCost + purchaseQty * purchaseCost) / totalQty) * 10000) / 10000;
}

type Mode = "count" | "purchase";

export function IngredientStockPanel({ rows, schemaReady, onSaveCount, onSavePurchase }: IngredientStockPanelProps) {
  const [mode, setMode] = useState<Mode>("count");
  const [query, setQuery] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [purchaseQty, setPurchaseQty] = useState<Record<string, string>>({});
  const [purchaseCost, setPurchaseCost] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  /**
   * Sayimin basladigi an. Ilk deger girildiginde damgalanir; kaydederken
   * sunucu bu andan sonraki hareketleri mahsup eder (yaris kosulu, bulgu 5A).
   * Yalniz sayim modunda kullanilir; alim yarisi ayni yontemle korunmuyor
   * — onun korumasi sunucudaki satir kilidi (`for update`).
   */
  const startedAtRef = useRef<string | null>(null);
  const qtyInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const costInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((row) => {
      if (criticalOnly && !(row.minQuantity > 0 && row.quantity <= row.minQuantity)) return false;
      if (!term) return true;
      return row.name.toLocaleLowerCase("tr-TR").includes(term);
    });
  }, [rows, query, criticalOnly]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus(null);
  };

  // --- Sayım -------------------------------------------------------------

  const countedCount = Object.values(counted).filter((value) => value.trim() !== "").length;

  const diffFor = (row: IngredientStockRow) => {
    const raw = counted[row.ingredientId];
    if (raw === undefined || raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value - row.quantity;
  };

  const totalDiffValue = rows.reduce((sum, row) => {
    const diff = diffFor(row);
    return diff === null ? sum : sum + diff * row.cost;
  }, 0);

  const setCountValue = (ingredientId: string, value: string) => {
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }
    setCounted((prev) => ({ ...prev, [ingredientId]: value }));
    setStatus(null);
  };

  const saveCount = async () => {
    const items = Object.entries(counted)
      .filter(([, value]) => value.trim() !== "" && Number.isFinite(Number(value)))
      .map(([ingredientId, value]) => ({ ingredientId, countedQuantity: Number(value) }));

    if (items.length === 0) {
      setStatus({ tone: "error", message: "Sayılan kalem yok." });
      return;
    }

    setSaving(true);
    const result = await onSaveCount({
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      reason: "Malzeme sayımı",
      items,
    });
    setSaving(false);

    if (!result.ok) {
      setStatus({ tone: "error", message: result.error ?? "Sayım kaydedilemedi." });
      return;
    }

    setStatus({
      tone: "ok",
      message: result.message ?? `Sayım kaydedildi. ${result.adjusted ?? 0} kalemde düzeltme yazıldı.`,
    });
    setCounted({});
    startedAtRef.current = null;
  };

  // --- Alım girişi ---------------------------------------------------------

  const purchaseLineCount = Object.entries(purchaseQty).filter(
    ([id, value]) => value.trim() !== "" && Number(value) > 0 && Number(purchaseCost[id] ?? "") >= 0,
  ).length;

  const purchaseTotalCost = rows.reduce((sum, row) => {
    const qty = Number(purchaseQty[row.ingredientId] ?? "");
    const cost = Number(purchaseCost[row.ingredientId] ?? "");
    if (!(qty > 0) || !Number.isFinite(cost)) return sum;
    return sum + qty * cost;
  }, 0);

  const previewFor = (row: IngredientStockRow) => {
    const qtyRaw = purchaseQty[row.ingredientId];
    const costRaw = purchaseCost[row.ingredientId];
    const qty = Number(qtyRaw);
    const cost = Number(costRaw);
    if (!qtyRaw || !(qty > 0) || costRaw === undefined || costRaw.trim() === "" || !Number.isFinite(cost)) {
      return null;
    }
    return previewAverageCost(row.quantity, row.cost, qty, cost);
  };

  const savePurchase = async () => {
    const items = rows
      .map((row) => ({
        ingredientId: row.ingredientId,
        quantity: Number(purchaseQty[row.ingredientId] ?? ""),
        unitCost: Number(purchaseCost[row.ingredientId] ?? ""),
      }))
      .filter((item) => item.quantity > 0 && Number.isFinite(item.unitCost) && item.unitCost >= 0);

    if (items.length === 0) {
      setStatus({ tone: "error", message: "Girilen kalem yok." });
      return;
    }

    setSaving(true);
    const result = await onSavePurchase({ note: "Alım girişi", items });
    setSaving(false);

    if (!result.ok) {
      setStatus({ tone: "error", message: result.error ?? "Alım kaydedilemedi." });
      return;
    }

    setStatus({
      tone: "ok",
      message: result.message ?? `Alım kaydedildi. ${result.adjusted ?? items.length} kalem işlendi.`,
    });
    setPurchaseQty({});
    setPurchaseCost({});
  };

  if (!schemaReady) {
    return (
      <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Malzeme stok tabloları henüz uygulanmadı. `20260809_add_recipe_cost_and_ingredient_stock.sql`
          migration&apos;ı Supabase&apos;e uygulandıktan sonra bu bölüm çalışır.
        </span>
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Henüz malzeme tanımlı değil. Malzeme Kütüphanesi&apos;nden ekleyip reçetelere bağlayın.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => switchMode("count")}
          aria-pressed={mode === "count"}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${
            mode === "count" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          Sayım
        </button>
        <button
          type="button"
          onClick={() => switchMode("purchase")}
          aria-pressed={mode === "purchase"}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${
            mode === "purchase" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Alım Girişi
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Malzeme ara..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <button
          type="button"
          onClick={() => setCriticalOnly((value) => !value)}
          aria-pressed={criticalOnly}
          className={`min-h-[40px] rounded-xl border px-3 text-sm font-semibold ${
            criticalOnly ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          Sadece kritik
        </button>

        {mode === "count" ? (
          <span className="text-xs text-slate-500">
            {countedCount}/{rows.length} sayıldı
            {countedCount > 0 ? ` · fark değeri ₺${totalDiffValue.toFixed(2)}` : ""}
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            {purchaseLineCount} kalem girildi
            {purchaseLineCount > 0 ? ` · toplam tutar ₺${purchaseTotalCost.toFixed(2)}` : ""}
          </span>
        )}

        <button
          type="button"
          onClick={mode === "count" ? saveCount : savePurchase}
          disabled={saving || (mode === "count" ? countedCount === 0 : purchaseLineCount === 0)}
          className="ml-auto inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {mode === "count" ? "Sayımı kaydet" : "Alımı kaydet"}
        </button>
      </div>

      {status ? (
        <p
          role="status"
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            status.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {mode === "count" ? (
              <tr>
                <th className="px-4 py-2.5">Malzeme</th>
                <th className="px-4 py-2.5 text-right">Sistemde</th>
                <th className="px-4 py-2.5 text-right">Sayılan</th>
                <th className="px-4 py-2.5 text-right">Fark</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-2.5">Malzeme</th>
                <th className="px-4 py-2.5 text-right">Sistemde</th>
                <th className="px-4 py-2.5 text-right">Miktar</th>
                <th className="px-4 py-2.5 text-right">Birim Maliyet</th>
                <th className="px-4 py-2.5 text-right">Yeni Ortalama</th>
              </tr>
            )}
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const critical = row.minQuantity > 0 && row.quantity <= row.minQuantity;

              if (mode === "purchase") {
                const preview = previewFor(row);
                return (
                  <tr key={row.ingredientId} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <span className="font-semibold text-slate-900">{row.name}</span>
                      {critical ? (
                        <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          kritik
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {formatQty(row.quantity)} <span className="text-xs text-slate-400">{row.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        ref={(element) => {
                          qtyInputRefs.current[index] = element;
                        }}
                        inputMode="decimal"
                        value={purchaseQty[row.ingredientId] ?? ""}
                        onChange={(event) => {
                          setPurchaseQty((prev) => ({ ...prev, [row.ingredientId]: event.target.value }));
                          setStatus(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            costInputRefs.current[index]?.focus();
                          }
                        }}
                        placeholder="—"
                        className="min-h-[36px] w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        ref={(element) => {
                          costInputRefs.current[index] = element;
                        }}
                        inputMode="decimal"
                        value={purchaseCost[row.ingredientId] ?? ""}
                        onChange={(event) => {
                          setPurchaseCost((prev) => ({ ...prev, [row.ingredientId]: event.target.value }));
                          setStatus(null);
                        }}
                        onKeyDown={(event) => {
                          // Enter bir sonraki satirin miktar alanina gecer:
                          // alim girisi de sirada akar, tek satirlik fatura
                          // kalemi iki tusla islenir.
                          if (event.key === "Enter") {
                            event.preventDefault();
                            qtyInputRefs.current[index + 1]?.focus();
                          }
                        }}
                        placeholder="₺/birim"
                        className="min-h-[36px] w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {preview === null ? "—" : `₺${preview.toFixed(4)}`}
                    </td>
                  </tr>
                );
              }

              const diff = diffFor(row);
              return (
                <tr key={row.ingredientId} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className="font-semibold text-slate-900">{row.name}</span>
                    {critical ? (
                      <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        kritik
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {formatQty(row.quantity)} <span className="text-xs text-slate-400">{row.unit}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      ref={(element) => {
                        qtyInputRefs.current[index] = element;
                      }}
                      inputMode="decimal"
                      value={counted[row.ingredientId] ?? ""}
                      onChange={(event) => setCountValue(row.ingredientId, event.target.value)}
                      onKeyDown={(event) => {
                        // Enter bir alt satira gecer: sayim sirada akar.
                        if (event.key === "Enter") {
                          event.preventDefault();
                          qtyInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      placeholder="—"
                      className="min-h-[36px] w-24 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm"
                    />
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums font-semibold ${
                      diff === null ? "text-slate-300" : diff === 0 ? "text-slate-500" : diff > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={mode === "count" ? 4 : 5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Eşleşen malzeme yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
