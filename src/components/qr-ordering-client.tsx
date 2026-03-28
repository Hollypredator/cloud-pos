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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
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
  const selectedProduct = selectedProductId ? visibleProducts.find((item) => item.id === selectedProductId) ?? null : null;
  const selectedProductGroups = selectedProduct ? groupsByProduct.get(selectedProduct.id) ?? [] : [];
  const formatPrice = (value: number) => `${Number(value).toFixed(2)} TL`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/65 p-3 shadow-[0_18px_35px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="sticky top-3 z-20 mb-3 rounded-2xl border border-white/10 bg-slate-900/95 px-2 py-2 shadow-[0_10px_20px_rgba(2,6,23,0.35)] backdrop-blur">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {orderedCategories.map((category) => {
                const isActive = category.id === activeCategoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedProductId(null);
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
        </div>

        {visibleProducts.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-300">
            Bu kategori için ürün bulunmuyor.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => {
              const isSelected = selectedProductId === product.id;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProductId((prev) => (prev === product.id ? null : product.id))}
                  className={`overflow-hidden rounded-[10px] border text-left transition ${
                    isSelected
                      ? "border-amber-300/80 bg-[#11233d] shadow-[0_14px_26px_rgba(2,6,23,0.45)]"
                      : "border-[#1e3356] bg-[#10213a] shadow-[0_8px_20px_rgba(2,6,23,0.35)] hover:border-[#325386]"
                  }`}
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-[104px] w-full object-cover sm:h-28" />
                  ) : (
                    <div className="flex h-[104px] w-full items-center justify-center bg-[#1a2d4a] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 sm:h-28">
                      Görsel Yok
                    </div>
                  )}
                  <div className="px-2.5 py-2.5">
                    <p className="text-[15px] font-semibold leading-5 text-white">{product.name}</p>
                    <p className="mt-1 text-[14px] font-medium text-slate-100">{formatPrice(product.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedProduct ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div>
              <p className="text-base font-semibold text-white">{selectedProduct.name}</p>
              <p className="mt-1 text-sm text-slate-300">{selectedProduct.description ?? "Aciklama bulunmuyor."}</p>
            </div>
            {selectedProductGroups.length > 0 ? (
              <div className="space-y-3">
                {selectedProductGroups.map((group) => (
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
              <p className="text-sm text-slate-300">Bu ürün için secenek bilgisi bulunmuyor.</p>
            )}
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-slate-400">QR ekrani menü görüntüleme icindir. Siparisler personel tarafindan açılır.</p>
      </section>
    </div>
  );
}
