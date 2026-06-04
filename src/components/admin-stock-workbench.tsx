"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { translateUiText } from "@/lib/i18n";
import type { AppLocale } from "@/lib/i18n";
import type { BusinessType, Category, Product, StockMovement } from "@/lib/types";

type BulkAdjustResult =
  | { ok: false; error: string }
  | {
      ok: true;
      summary: {
        totalRequested: number;
        changedCount: number;
        unchangedCount: number;
        failedCount: number;
        changed: Array<{ productId: string; from: number; to: number }>;
        failed: Array<{ productId: string; reason: string }>;
      };
    };

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AdminStockWorkbench({
  locale,
  products,
  categories,
  movements,
  activeBusinessType,
  initialQuery,
  initialLowOnly,
  initialRemainingOnly,
  onBulkAdjust,
}: {
  locale: AppLocale;
  products: Product[];
  categories: Category[];
  movements: StockMovement[];
  activeBusinessType: BusinessType;
  initialQuery: string;
  initialLowOnly: boolean;
  initialRemainingOnly: boolean;
  onBulkAdjust: (input: { reason: string; items: Array<{ productId: string; newStock: number }> }) => Promise<BulkAdjustResult>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isSelfService = activeBusinessType === "self_service_coffee";

  const [query, setQuery] = useState(initialQuery);
  const [lowOnly, setLowOnly] = useState(initialLowOnly);
  const [remainingOnly, setRemainingOnly] = useState(initialRemainingOnly);
  const [sessionReasonPreset, setSessionReasonPreset] = useState("sayim_duzeltme");
  const [sessionReasonCustom, setSessionReasonCustom] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionReason, setSessionReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countedProductIds, setCountedProductIds] = useState<Record<string, true>>({});
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [lastScannedProductId, setLastScannedProductId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [undoAction, setUndoAction] = useState<{
    productId: string;
    previousStock: number;
    newStock: number;
    expiresAt: number;
  } | null>(null);

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Map<string, number>>(new Map());
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const baseStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.id, Number(product.stock_count ?? 0));
    }
    return map;
  }, [products]);

  const categoryMap = useMemo(() => {
    const sorted = [...categories].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const map = new Map<string, { name: string; index: number }>();
    sorted.forEach((category, index) => map.set(category.id, { name: category.name, index }));
    return map;
  }, [categories]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (lowOnly) {
      params.set("lowOnly", "1");
    }
    if (remainingOnly) {
      params.set("remainingOnly", "1");
    }
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [lowOnly, pathname, query, remainingOnly, router]);

  useEffect(() => {
    if (isSelfService) {
      barcodeInputRef.current?.focus();
    }
  }, [isSelfService]);

  useEffect(() => {
    if (!undoAction) {
      return;
    }
    const timeout = setTimeout(() => {
      setUndoAction((current) => (current?.expiresAt === undoAction.expiresAt ? null : current));
    }, Math.max(0, undoAction.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [undoAction]);

  function resolvedReasonValue() {
    if (sessionReasonPreset === "ozel") {
      return sessionReasonCustom.trim();
    }
    if (sessionReasonPreset === "fire_zayi") {
      return "fire_zayi";
    }
    if (sessionReasonPreset === "mal_kabul") {
      return "mal_kabul";
    }
    return "sayim_duzeltme";
  }

  async function flushQueue() {
    if (queueRef.current.size === 0 || !sessionReason) {
      return;
    }
    const batchItems = [...queueRef.current.entries()].map(([productId, newStock]) => ({ productId, newStock }));
    queueRef.current.clear();
    setSaveStatuses((prev) => {
      const next = { ...prev };
      for (const item of batchItems) {
        next[item.productId] = "saving";
      }
      return next;
    });

    const result = await onBulkAdjust({ reason: sessionReason, items: batchItems });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      setSaveStatuses((prev) => {
        const next = { ...prev };
        for (const item of batchItems) {
          next[item.productId] = "error";
        }
        return next;
      });
      return;
    }

    setSaveStatuses((prev) => {
      const next = { ...prev };
      for (const item of batchItems) {
        next[item.productId] = "saved";
      }
      return next;
    });
  }

  function enqueueSave(productId: string, newStock: number) {
    queueRef.current.set(productId, Math.max(0, Math.round(newStock)));
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(() => {
      void flushQueue();
    }, 450);
  }

  function updateStockValue(productId: string, stock: number) {
    setEditedStocks((prev) => ({ ...prev, [productId]: Math.max(0, Math.round(stock)) }));
  }

  function markCounted(productId: string) {
    if (!sessionStarted) {
      setMessage({ type: "error", text: translateUiText("Sayima baslamak icin once sebep secin.", locale) });
      return;
    }
    const base = baseStockMap.get(productId) ?? 0;
    const target = editedStocks[productId] ?? base;
    setCountedProductIds((prev) => ({ ...prev, [productId]: true }));
    setSaveStatuses((prev) => ({ ...prev, [productId]: "saving" }));
    setUndoAction({
      productId,
      previousStock: base,
      newStock: target,
      expiresAt: Date.now() + 10000,
    });
    enqueueSave(productId, target);
  }

  function undoLastAction() {
    if (!undoAction) {
      return;
    }
    const { productId, previousStock } = undoAction;
    setCountedProductIds((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setEditedStocks((prev) => ({ ...prev, [productId]: previousStock }));
    setSaveStatuses((prev) => ({ ...prev, [productId]: "saving" }));
    enqueueSave(productId, previousStock);
    setUndoAction(null);
    setMessage({ type: "success", text: translateUiText("Son islem geri alindi.", locale) });
  }

  function applyBarcode() {
    if (!isSelfService || !sessionStarted) {
      return;
    }
    const code = barcodeInput.trim().toLocaleLowerCase("tr-TR");
    if (!code) {
      return;
    }
    const found = products.find((product) => {
      const barcode = String(product.barcode ?? "").toLocaleLowerCase("tr-TR");
      const plu = String(product.plu_code ?? "").toLocaleLowerCase("tr-TR");
      return barcode === code || plu === code;
    });
    if (!found) {
      setMessage({ type: "error", text: translateUiText("Barkod/PLU ile urun bulunamadi.", locale) });
      barcodeInputRef.current?.focus();
      return;
    }
    setLastScannedProductId(found.id);
    markCounted(found.id);
    setBarcodeInput("");
    barcodeInputRef.current?.focus();
  }

  function statusLabel(status?: SaveStatus) {
    if (status === "saving") return translateUiText("Kaydediliyor", locale);
    if (status === "saved") return translateUiText("Kaydedildi", locale);
    if (status === "error") return translateUiText("Kaydedilemedi", locale);
    return translateUiText("Bekliyor", locale);
  }

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return products
      .filter((product) => {
        const stock = editedStocks[product.id] ?? product.stock_count;
        const isCounted = Boolean(countedProductIds[product.id]);
        if (lowOnly && stock > 10) {
          return false;
        }
        if (remainingOnly && isCounted) {
          return false;
        }
        if (!term) {
          return true;
        }
        return (
          product.name.toLocaleLowerCase("tr-TR").includes(term) ||
          String(product.barcode ?? "").toLocaleLowerCase("tr-TR").includes(term) ||
          String(product.plu_code ?? "").toLocaleLowerCase("tr-TR").includes(term)
        );
      })
      .sort((a, b) => {
        if (activeBusinessType === "restaurant_cafe") {
          const aIndex = categoryMap.get(a.category_id)?.index ?? Number.MAX_SAFE_INTEGER;
          const bIndex = categoryMap.get(b.category_id)?.index ?? Number.MAX_SAFE_INTEGER;
          if (aIndex !== bIndex) {
            return aIndex - bIndex;
          }
        }
        return a.name.localeCompare(b.name, "tr");
      });
  }, [activeBusinessType, categoryMap, countedProductIds, editedStocks, lowOnly, products, query, remainingOnly]);

  const countedCount = useMemo(
    () => products.filter((product) => countedProductIds[product.id]).length,
    [countedProductIds, products],
  );
  const remainingCount = Math.max(0, products.length - countedCount);

  return (
    <div className="space-y-6">
      {!sessionStarted ? (
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{translateUiText("Sayimi Baslat", locale)}</h2>
          <p className="mt-1 text-sm text-slate-600">{translateUiText("Oturum sebebini sec, sonra tek tusla urunleri say.", locale)}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[260px_minmax(0,1fr)_auto] md:items-center">
            <select
              value={sessionReasonPreset}
              onChange={(event) => setSessionReasonPreset(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <option value="sayim_duzeltme">{translateUiText("Sayim Duzeltme", locale)}</option>
              <option value="fire_zayi">{translateUiText("Fire / Zayi", locale)}</option>
              <option value="mal_kabul">{translateUiText("Mal Kabul", locale)}</option>
              <option value="ozel">{translateUiText("Ozel Sebep", locale)}</option>
            </select>
            <input
              value={sessionReasonCustom}
              onChange={(event) => setSessionReasonCustom(event.target.value)}
              disabled={sessionReasonPreset !== "ozel"}
              placeholder={translateUiText("Ozel sebep yazin", locale)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                const resolved = resolvedReasonValue();
                if (!resolved.trim()) {
                  setMessage({ type: "error", text: translateUiText("Sebep secmeden sayim baslatilamaz.", locale) });
                  return;
                }
                setSessionReason(resolved);
                setSessionStarted(true);
                setMessage(null);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {translateUiText("Sayimi Baslat", locale)}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">{translateUiText("Toplam", locale)}</p>
            <p className="text-2xl font-bold text-slate-900">{products.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <p className="text-xs text-emerald-700">{translateUiText("Sayilan", locale)}</p>
            <p className="text-2xl font-bold text-emerald-700">{countedCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs text-amber-700">{translateUiText("Kalan", locale)}</p>
            <p className="text-2xl font-bold text-amber-700">{remainingCount}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translateUiText("Ara", locale)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={remainingOnly} onChange={(event) => setRemainingOnly(event.target.checked)} />
            {translateUiText("Sadece Kalanlar", locale)}
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
            {translateUiText("Dusuk Stok", locale)}
          </label>
        </div>

        {isSelfService ? (
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyBarcode();
                }
              }}
              placeholder={translateUiText("Barkod/PLU okut", locale)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
            <button type="button" onClick={applyBarcode} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {translateUiText("Oku", locale)}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{translateUiText("Sayim Kartlari", locale)}</h2>
        <div className="grid gap-3">
          {filteredProducts.map((product, index) => {
            const stock = editedStocks[product.id] ?? product.stock_count;
            const isCounted = Boolean(countedProductIds[product.id]);
            const status = saveStatuses[product.id] ?? "idle";
            const showCategoryHeader =
              activeBusinessType === "restaurant_cafe" &&
              (index === 0 || filteredProducts[index - 1]?.category_id !== product.category_id);
            return (
              <div key={product.id} className="space-y-1">
                {showCategoryHeader ? (
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {categoryMap.get(product.category_id)?.name ?? translateUiText("Kategori", locale)}
                  </p>
                ) : null}
                <div className={`rounded-2xl border p-4 ${isCounted ? "border-emerald-300 bg-emerald-50/70" : lastScannedProductId === product.id ? "border-sky-300 bg-sky-50/70" : "border-slate-200 bg-slate-50"}`}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto] md:items-center">
                    <div>
                      <p className="truncate text-lg font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {translateUiText("Stok", locale)}: {stock} | {translateUiText("Durum", locale)}: {isCounted ? translateUiText("Sayildi", locale) : translateUiText("Bekliyor", locale)} | {statusLabel(status)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(event) => updateStockValue(product.id, Number(event.target.value))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-semibold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => markCounted(product.id)}
                      disabled={!sessionStarted}
                      className="rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white disabled:opacity-50"
                    >
                      {translateUiText("Saydim", locale)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {translateUiText("Urun bulunamadi.", locale)}
            </p>
          ) : null}
        </div>
      </section>

      {undoAction ? (
        <section className="sticky bottom-2 z-20 rounded-xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">{translateUiText("Son islem kaydedildi. Yanlissa geri alabilirsiniz.", locale)}</p>
            <button type="button" onClick={undoLastAction} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              {translateUiText("Geri Al", locale)}
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
          {message.text}
        </p>
      ) : null}

      <section className="responsive-table-shell rounded-2xl bg-white p-4 shadow-sm">
        <table className="responsive-table w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">{translateUiText("Tarih", locale)}</th>
              <th className="py-2">{translateUiText("Urun", locale)}</th>
              <th className="py-2">{translateUiText("Degisim", locale)}</th>
              <th className="py-2">{translateUiText("Onceki", locale)}</th>
              <th className="py-2">{translateUiText("Yeni", locale)}</th>
              <th className="py-2">{translateUiText("Neden", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-700">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                <td className="py-2 font-medium text-slate-900">{row.product_name ?? row.product_id}</td>
                <td className={`py-2 font-semibold ${row.change_amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {row.change_amount >= 0 ? `+${row.change_amount}` : row.change_amount}
                </td>
                <td className="py-2 text-slate-700">{row.previous_stock}</td>
                <td className="py-2 text-slate-700">{row.new_stock}</td>
                <td className="py-2 text-slate-700">{row.reason}</td>
              </tr>
            ))}
            {movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  {translateUiText("Kayit bulunamadi.", locale)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

