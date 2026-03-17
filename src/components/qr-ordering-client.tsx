"use client";

import { useMemo, useState } from "react";
import type { Category, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";

export function QrOrderingClient({
  qrCodeIdentifier,
  categories,
  products,
  modifierGroups,
  modifierOptions,
}: {
  qrCodeIdentifier: string;
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">QR Menu</p>
        <h1 className="text-2xl font-semibold">Masa: {qrCodeIdentifier}</h1>
        <p className="mt-3 text-sm text-slate-300">
          Bu ekranda sadece menu goruntulenir. Siparis ve adisyon islemleri isletme personeli tarafindan yonetilir.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Menu</h2>
            <p className="text-sm text-slate-500">Kategoriyi secip urun detayini kart icinde acabilirsiniz.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">QR uzerinden siparis alinmiyor</div>
        </div>

        <div className="mb-4 overflow-x-auto pb-1">
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
                    isActive ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Bu kategori icin urun bulunmuyor.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleProducts.map((product) => {
              const isExpanded = expandedProductId === product.id;
              const modifierGroupsForProduct = groupsByProduct.get(product.id) ?? [];

              return (
                <article key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setExpandedProductId((prev) => (prev === product.id ? null : product.id))}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Gorsel Yok
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{product.description ?? "Aciklama bulunmuyor."}</p>
                      <p className="mt-2 text-sm font-semibold text-emerald-700">{Number(product.price).toFixed(2)} TL</p>
                    </div>
                    <span className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">{isExpanded ? "Kapat" : "Detay"}</span>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-3 border-t border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-600">{product.description ?? "Aciklama bulunmuyor."}</p>
                      {modifierGroupsForProduct.length > 0 ? (
                        <div className="space-y-3">
                          {modifierGroupsForProduct.map((group) => (
                            <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="font-semibold text-slate-900">{group.name}</p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {(optionsByGroup.get(group.id) ?? []).map((option) => (
                                  <div key={option.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                    <p className="font-medium">{option.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Dahil"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Bu urun icin secenek bilgisi bulunmuyor.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
