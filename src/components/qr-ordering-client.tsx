"use client";

import { useMemo, useState } from "react";
import type {
  Category,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

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
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const category of categories) {
      byCategory.set(category.id, []);
    }
    for (const product of products) {
      if (!byCategory.has(product.category_id)) {
        byCategory.set(product.category_id, []);
      }
      byCategory.get(product.category_id)?.push(product);
    }
    return byCategory;
  }, [categories, products]);

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

  const activeProduct = activeProductId ? productById.get(activeProductId) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">QR Menu</p>
        <h1 className="text-2xl font-semibold">Masa: {qrCodeIdentifier}</h1>
        <p className="mt-3 text-sm text-slate-300">
          Bu ekranda sadece menu goruntulenir. Siparis ve adisyon islemleri isletme personeli tarafindan yonetilir.
        </p>
      </header>

      {activeProduct ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Urun Detayi</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{activeProduct.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{activeProduct.description ?? "Aciklama bulunmuyor."}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveProductId(null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 sm:w-auto"
            >
              Kapat
            </button>
          </div>
          {(groupsByProduct.get(activeProduct.id) ?? []).length > 0 ? (
            <div className="mt-4 space-y-4">
              {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
                <div key={group.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(optionsByGroup.get(group.id) ?? []).map((option) => (
                      <div key={option.id} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                        <span className="block font-medium">{option.name}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Dahil"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Menu</h2>
            <p className="text-sm text-slate-500">Urunleri inceleyin. Siparisiniz personel tarafindan adisyona eklenir.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            QR uzerinden siparis alinmiyor
          </div>
        </div>
        <div className="space-y-6">
          {categories.map((category) => (
            <article key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-xl font-semibold text-slate-900">{category.name}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(grouped.get(category.id) ?? []).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setActiveProductId(product.id)}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-left"
                  >
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{product.description ?? "Lezzetli secenek"}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-emerald-700">{Number(product.price).toFixed(2)} TL</span>
                      <span className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">
                        Detay
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
