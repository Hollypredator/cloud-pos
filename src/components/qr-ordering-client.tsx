"use client";

import { useMemo, useState } from "react";
import type { Category, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";

export function QrOrderingClient({
  categories,
  products,
  modifierGroups,
  modifierOptions,
}: {
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
}) {
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [categories],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => orderedCategories[0]?.id ?? "");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const activeCategoryId = orderedCategories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : (orderedCategories[0]?.id ?? "");

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const category of orderedCategories) {
      byCategory.set(category.id, []);
    }
    for (const product of products) {
      if (!byCategory.has(product.category_id)) {
        byCategory.set(product.category_id, []);
      }
      byCategory.get(product.category_id)?.push(product);
    }
    return byCategory;
  }, [orderedCategories, products]);

  const groupsByProduct = useMemo(() => {
    const map = new Map<string, ProductModifierGroup[]>();
    for (const group of modifierGroups) {
      if (!map.has(group.product_id)) {
        map.set(group.product_id, []);
      }
      map.get(group.product_id)?.push(group);
    }
    return map;
  }, [modifierGroups]);

  const optionsByGroup = useMemo(() => {
    const map = new Map<string, ProductModifierOption[]>();
    for (const option of modifierOptions) {
      if (!map.has(option.group_id)) {
        map.set(option.group_id, []);
      }
      map.get(option.group_id)?.push(option);
    }
    return map;
  }, [modifierOptions]);

  const visibleProducts = grouped.get(activeCategoryId) ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/65 p-3 shadow-[0_18px_35px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="mb-3 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {orderedCategories.map((category) => {
              const isActive = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setExpandedProductId(null);
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[linear-gradient(135deg,#ff6d3d_0%,#f0b04f_100%)] text-white shadow-[0_10px_20px_rgba(255,109,61,0.28)]"
                      : "border border-white/15 bg-white/5 text-slate-200"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-300">
            Bu kategori icin urun bulunmuyor.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleProducts.map((product) => {
              const isExpanded = expandedProductId === product.id;
              const modifierGroupsForProduct = groupsByProduct.get(product.id) ?? [];

              return (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#1b233f_0%,#141c33_100%)]">
                  <button
                    type="button"
                    onClick={() => setExpandedProductId((prev) => (prev === product.id ? null : product.id))}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                        Gorsel Yok
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-white">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-300">{product.description ?? "Aciklama bulunmuyor."}</p>
                      <p className="mt-2 text-sm font-semibold text-amber-300">{Number(product.price).toFixed(2)} TL</p>
                    </div>
                    <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100">
                      {isExpanded ? "Kapat" : "Detay"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-3 border-t border-white/10 bg-slate-950/30 p-4">
                      <p className="text-sm text-slate-200">{product.description ?? "Aciklama bulunmuyor."}</p>
                      {modifierGroupsForProduct.length > 0 ? (
                        <div className="space-y-3">
                          {modifierGroupsForProduct.map((group) => (
                            <div key={group.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="font-semibold text-white">{group.name}</p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {(optionsByGroup.get(group.id) ?? []).map((option) => (
                                  <div key={option.id} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-100">
                                    <p className="font-medium">{option.name}</p>
                                    <p className="text-xs text-slate-300">
                                      {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Dahil"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-300">Bu urun icin secenek bilgisi bulunmuyor.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-400">QR ekrani menu goruntuleme icindir. Siparisler personel tarafindan acilir.</p>
      </section>
    </div>
  );
}
