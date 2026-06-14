"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Barcode, CheckCircle2, Clock3, Filter, PackageCheck, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
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

function stockLevelTone(stock: number) {
  if (stock <= 0) return "border-rose-200 bg-rose-50 text-rose-800";
  if (stock <= 3) return "border-orange-200 bg-orange-50 text-orange-800";
  if (stock <= 10) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-white text-slate-700";
}

function saveStatusTone(status?: SaveStatus) {
  if (status === "saving") return "bg-sky-100 text-sky-800";
  if (status === "saved") return "bg-emerald-100 text-emerald-800";
  if (status === "error") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-600";
}

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
      setMessage({ type: "error", text: translateUiText("Sayima baslamak icin once sebep seçin.", locale) });
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
    setMessage({ type: "success", text: translateUiText("Son işlem geri alındı.", locale) });
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
      setMessage({ type: "error", text: translateUiText("Barkod/PLU ile ürün bulunamadı.", locale) });
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
  const progressPercent = products.length > 0 ? Math.round((countedCount / products.length) * 100) : 0;
  const lowStockTotal = useMemo(
    () => products.filter((product) => (editedStocks[product.id] ?? product.stock_count) <= 10).length,
    [editedStocks, products],
  );
  const outOfStockTotal = useMemo(
    () => products.filter((product) => (editedStocks[product.id] ?? product.stock_count) <= 0).length,
    [editedStocks, products],
  );
  const changedCount = useMemo(
    () => products.filter((product) => (editedStocks[product.id] ?? product.stock_count) !== product.stock_count).length,
    [editedStocks, products],
  );
  const activeFilterCount = [Boolean(query.trim()), lowOnly, remainingOnly].filter(Boolean).length;
  const sessionReasonLabel =
    sessionReason === "fire_zayi"
      ? translateUiText("Fire / Zayi", locale)
      : sessionReason === "mal_kabul"
        ? translateUiText("Mal Kabul", locale)
        : sessionReason || translateUiText("Sayım bekliyor", locale);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.28),transparent_42%),linear-gradient(135deg,#0f172a_0%,#172033_56%,#0f3d3e_100%)] p-6 text-white sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">{translateUiText("Stok Sayım Merkezi", locale)}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">{progressPercent}%</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {sessionStarted
                    ? `${sessionReasonLabel} · ${remainingCount} ${translateUiText("ürün kaldı", locale)}`
                    : translateUiText("Sayımı başlat, ürünleri filtrele ve değişiklikleri anında kaydet.", locale)}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${sessionStarted ? "bg-emerald-300/20 text-emerald-100" : "bg-white/10 text-slate-200"}`}>
                {sessionStarted ? translateUiText("Aktif", locale) : translateUiText("Hazırlık", locale)}
              </span>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: translateUiText("Toplam", locale), value: products.length },
                { label: translateUiText("Sayılan", locale), value: countedCount },
                { label: translateUiText("Kalan", locale), value: remainingCount },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/10 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            {!sessionStarted ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                    <PackageCheck aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold tracking-tight text-slate-950">{translateUiText("Sayımı Başlat", locale)}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{translateUiText("Oturum sebebini seç, sonra ürünleri saymaya başla.", locale)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
                  <select
                    value={sessionReasonPreset}
                    onChange={(event) => setSessionReasonPreset(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="sayim_duzeltme">{translateUiText("Sayım Düzeltme", locale)}</option>
                    <option value="fire_zayi">{translateUiText("Fire / Zayi", locale)}</option>
                    <option value="mal_kabul">{translateUiText("Mal Kabul", locale)}</option>
                    <option value="ozel">{translateUiText("Özel Sebep", locale)}</option>
                  </select>
                  <input
                    value={sessionReasonCustom}
                    onChange={(event) => setSessionReasonCustom(event.target.value)}
                    disabled={sessionReasonPreset !== "ozel"}
                    placeholder={translateUiText("Özel sebep yazın", locale)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 disabled:bg-slate-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const resolved = resolvedReasonValue();
                      if (!resolved.trim()) {
                        setMessage({ type: "error", text: translateUiText("Sebep seçmeden sayım başlatılamaz.", locale) });
                        return;
                      }
                      setSessionReason(resolved);
                      setSessionStarted(true);
                      setMessage(null);
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    {translateUiText("Başlat", locale)}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{translateUiText("Aktif sayım oturumu", locale)}</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{sessionReasonLabel}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
                    <Clock3 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    {translateUiText("Otomatik kaydetme açık", locale)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: translateUiText("Düşük stok", locale), value: lowStockTotal, icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-800" },
                { label: translateUiText("Stokta yok", locale), value: outOfStockTotal, icon: AlertTriangle, className: "border-rose-200 bg-rose-50 text-rose-800" },
                { label: translateUiText("Değişen", locale), value: changedCount, icon: SlidersHorizontal, className: "border-sky-200 bg-sky-50 text-sky-800" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-2xl border px-4 py-3 ${item.className}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em]">{item.label}</p>
                      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                    <p className="mt-2 text-2xl font-bold tracking-tight">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
          {message.text}
        </p>
      ) : null}

      <section className="sticky top-3 z-10 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.2} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={translateUiText("Ürün, barkod veya PLU ara", locale)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRemainingOnly((value) => !value)}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                remainingOnly ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              {translateUiText("Sadece kalanlar", locale)}
            </button>
            <button
              type="button"
              onClick={() => setLowOnly((value) => !value)}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                lowOnly ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <AlertTriangle aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              {translateUiText("Düşük stok", locale)}
            </button>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setLowOnly(false);
                  setRemainingOnly(false);
                }}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                {translateUiText("Temizle", locale)}
              </button>
            ) : null}
          </div>
        </div>

        {isSelfService ? (
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Barcode aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.2} />
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
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>
            <button type="button" onClick={applyBarcode} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              {translateUiText("Oku", locale)}
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-xs font-semibold text-slate-500">
          {filteredProducts.length} {translateUiText("ürün gösteriliyor", locale)}
          {activeFilterCount > 0 ? ` · ${activeFilterCount} ${translateUiText("filtre aktif", locale)}` : ""}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{translateUiText("Sayım Listesi", locale)}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{translateUiText("Ürün sayım kartları", locale)}</h2>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
            {countedCount}/{products.length} {translateUiText("tamamlandı", locale)}
          </p>
        </div>
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
                  <div className="flex items-center gap-3 pt-3">
                    <span className="h-px flex-1 bg-slate-200" />
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {categoryMap.get(product.category_id)?.name ?? translateUiText("Kategori", locale)}
                    </p>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                ) : null}
                <div className={`rounded-[1.35rem] border p-4 transition ${
                  isCounted
                    ? "border-emerald-300 bg-emerald-50/80 shadow-[0_10px_24px_rgba(16,185,129,0.08)]"
                    : lastScannedProductId === product.id
                      ? "border-sky-300 bg-sky-50/80"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                }`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px_128px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-bold tracking-tight text-slate-950">{product.name}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${stockLevelTone(stock)}`}>
                          {stock <= 0 ? translateUiText("Stokta yok", locale) : stock <= 10 ? translateUiText("Düşük stok", locale) : translateUiText("Normal", locale)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${saveStatusTone(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>{translateUiText("Mevcut", locale)}: <strong className="text-slate-950">{product.stock_count}</strong></span>
                        <span>{translateUiText("Sayım", locale)}: <strong className="text-slate-950">{stock}</strong></span>
                        <span>{isCounted ? translateUiText("Sayıldı", locale) : translateUiText("Bekliyor", locale)}</span>
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{translateUiText("Yeni stok", locale)}</span>
                      <input
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(event) => updateStockValue(product.id, Number(event.target.value))}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg font-bold text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => markCounted(product.id)}
                      disabled={!sessionStarted}
                      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
                        isCounted ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-slate-950 text-white hover:bg-slate-800"
                      }`}
                    >
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                      {isCounted ? translateUiText("Sayıldı", locale) : translateUiText("Saydım", locale)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {translateUiText("Ürün bulunamadı.", locale)}
            </p>
          ) : null}
        </div>
      </section>

      {undoAction ? (
        <section className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">{translateUiText("Son işlem kaydedildi. Yanlışsa geri alabilirsiniz.", locale)}</p>
            <button type="button" onClick={undoLastAction} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              {translateUiText("Geri al", locale)}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{translateUiText("Hareket geçmişi", locale)}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{translateUiText("Son stok hareketleri", locale)}</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">{movements.length} {translateUiText("kayıt", locale)}</p>
        </div>
        <div className="responsive-table-shell overflow-hidden rounded-2xl border border-slate-200">
          <table className="responsive-table w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-4 py-3">{translateUiText("Tarih", locale)}</th>
                <th className="px-4 py-3">{translateUiText("Ürün", locale)}</th>
                <th className="px-4 py-3">{translateUiText("Değişim", locale)}</th>
                <th className="px-4 py-3">{translateUiText("Önceki", locale)}</th>
                <th className="px-4 py-3">{translateUiText("Yeni", locale)}</th>
                <th className="px-4 py-3">{translateUiText("Neden", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {movements.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{row.product_name ?? row.product_id}</td>
                  <td className={`px-4 py-3 font-bold ${row.change_amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {row.change_amount >= 0 ? `+${row.change_amount}` : row.change_amount}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.previous_stock}</td>
                  <td className="px-4 py-3 text-slate-700">{row.new_stock}</td>
                  <td className="px-4 py-3 text-slate-700">{row.reason}</td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                    {translateUiText("Kayıt bulunamadı.", locale)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
