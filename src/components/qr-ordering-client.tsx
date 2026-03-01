"use client";

import { useMemo, useState } from "react";
import type {
  Category,
  OrderItemModifierSelection,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";
import { OrderStatusWidget } from "@/components/order-status-widget";
import { OrderHistoryWidget } from "@/components/order-history-widget";

type CartEntry = {
  key: string;
  product: Product;
  quantity: number;
  modifiers: OrderItemModifierSelection[];
};

type CartMap = Record<string, CartEntry>;

function buildCartKey(productId: string, modifiers: OrderItemModifierSelection[]) {
  const suffix = modifiers
    .map((modifier) => `${modifier.group_name}:${modifier.option_name}`)
    .sort()
    .join("|");
  return suffix ? `${productId}:${suffix}` : productId;
}

export function QrOrderingClient({
  businessSlug,
  qrCodeIdentifier,
  tableId,
  categories,
  products,
  modifierGroups,
  modifierOptions,
}: {
  businessSlug?: string;
  qrCodeIdentifier: string;
  tableId: string;
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
}) {
  const [cart, setCart] = useState<CartMap>({});
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [requestNote, setRequestNote] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [isRequestSending, setIsRequestSending] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

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

  const total = useMemo(
    () =>
      Object.values(cart).reduce((sum, entry) => {
        const modifierTotal = entry.modifiers.reduce((inner, modifier) => inner + Number(modifier.price_delta), 0);
        return sum + (Number(entry.product.price) + modifierTotal) * entry.quantity;
      }, 0),
    [cart],
  );

  function addConfiguredProduct(product: Product, modifiers: OrderItemModifierSelection[]) {
    const key = buildCartKey(product.id, modifiers);
    setCart((prev) => ({
      ...prev,
      [key]: {
        key,
        product,
        modifiers,
        quantity: (prev[key]?.quantity ?? 0) + 1,
      },
    }));
    setActiveProductId(null);
    setSelectedOptions({});
  }

  function openModifierPicker(product: Product) {
    const groups = groupsByProduct.get(product.id) ?? [];
    if (groups.length === 0) {
      addConfiguredProduct(product, []);
      return;
    }

    const defaults: Record<string, string[]> = {};
    for (const group of groups) {
      defaults[group.id] = (optionsByGroup.get(group.id) ?? [])
        .filter((option) => option.is_default)
        .map((option) => option.id)
        .slice(0, Math.max(1, group.max_select));
    }
    setSelectedOptions(defaults);
    setActiveProductId(product.id);
  }

  function toggleOption(group: ProductModifierGroup, optionId: string) {
    setSelectedOptions((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.includes(optionId);
      if (group.max_select === 1) {
        return { ...prev, [group.id]: exists ? [] : [optionId] };
      }
      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max_select) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function buildModifierSelections(productId: string) {
    const groups = groupsByProduct.get(productId) ?? [];
    const modifiers: OrderItemModifierSelection[] = [];
    for (const group of groups) {
      const selected = selectedOptions[group.id] ?? [];
      for (const optionId of selected) {
        const option = (optionsByGroup.get(group.id) ?? []).find((item) => item.id === optionId);
        if (!option) {
          continue;
        }
        modifiers.push({
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price_delta: Number(option.price_delta),
          quantity: 1,
        });
      }
    }
    return modifiers;
  }

  function confirmModifiers() {
    if (!activeProductId) {
      return;
    }
    const product = productById.get(activeProductId);
    if (!product) {
      return;
    }
    const groups = groupsByProduct.get(activeProductId) ?? [];
    for (const group of groups) {
      const count = (selectedOptions[group.id] ?? []).length;
      if (group.is_required && count < Math.max(1, group.min_select)) {
        setMessage(`${group.name} secimi zorunlu.`);
        return;
      }
    }
    addConfiguredProduct(product, buildModifierSelections(activeProductId));
  }

  function reorderFromLatest(items: Array<{ productId: string; quantity: number }>) {
    setCart((prev) => {
      const next = { ...prev };
      for (const row of items) {
        const product = products.find((item) => item.id === row.productId);
        if (!product) {
          continue;
        }
        const key = buildCartKey(product.id, []);
        next[key] = {
          key,
          product,
          modifiers: [],
          quantity: (next[key]?.quantity ?? 0) + row.quantity,
        };
      }
      return next;
    });
    setMessage("Son siparisteki urunler sepete eklendi.");
  }

  function removeProduct(key: string) {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) {
        return prev;
      }
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  }

  async function submitOrder() {
    const items = Object.values(cart).map((entry) => {
      const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
      const unitPrice = Number(entry.product.price) + modifierTotal;
      return {
        product_id: entry.product.id,
        name: entry.product.name,
        quantity: entry.quantity,
        unit_price: unitPrice,
        line_total: unitPrice * entry.quantity,
        modifiers: entry.modifiers,
      };
    });

    if (items.length === 0) {
      setMessage("Sepet bos. Lutfen en az bir urun secin.");
      return;
    }

    setIsSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          businessSlug,
          qrCodeIdentifier,
          items,
          totalPrice: total,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.message ?? "Siparis gonderilirken bir hata olustu.");
        return;
      }
      setCart({});
      setMessage("Siparisiniz mutfaga iletildi.");
    } catch {
      setMessage("Baglanti hatasi olustu. Lutfen tekrar deneyin.");
    } finally {
      setIsSending(false);
    }
  }

  async function createServiceRequest(requestType: "call_waiter" | "request_bill") {
    setIsRequestSending(true);
    setRequestMessage("");
    try {
      const response = await fetch("/api/table-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug,
          qrCodeIdentifier,
          requestType,
          note: requestNote.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setRequestMessage(data.message ?? "Talep gonderilemedi.");
        return;
      }
      setRequestMessage(
        requestType === "call_waiter"
          ? "Garson cagrildi. En kisa surede masa ziyaret edilecek."
          : "Hesap talebiniz kasaya iletildi.",
      );
    } catch {
      setRequestMessage("Baglanti hatasi olustu. Lutfen tekrar deneyin.");
    } finally {
      setIsRequestSending(false);
    }
  }

  const activeProduct = activeProductId ? productById.get(activeProductId) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">QR Siparis</p>
        <h1 className="text-2xl font-semibold">Masa: {qrCodeIdentifier}</h1>
      </header>

      {activeProduct ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Secenekler</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{activeProduct.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveProductId(null);
                setSelectedOptions({});
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Kapat
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
              <div key={group.id} className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{group.name}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(optionsByGroup.get(group.id) ?? []).map((option) => {
                    const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleOption(group, option.id)}
                        className={`rounded-lg border px-3 py-3 text-left text-sm ${
                          checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <span className="block font-medium">{option.name}</span>
                        <span className="mt-1 block text-xs">
                          {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Ucretsiz"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={confirmModifiers}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Sepete Ekle
          </button>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {categories.map((category) => (
            <article key={category.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">{category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(grouped.get(category.id) ?? []).map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-sm text-slate-600">{product.description ?? "Lezzetli secenek"}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-semibold text-emerald-700">{Number(product.price).toFixed(2)} TL</span>
                      <button
                        onClick={() => openModifierPicker(product)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                        type="button"
                      >
                        {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Sec" : "Ekle"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Sepet</h2>
          <div className="mt-3 space-y-3">
            {Object.values(cart).length === 0 ? (
              <p className="text-sm text-slate-500">Henuz urun eklenmedi.</p>
            ) : (
              Object.values(cart).map((entry) => {
                const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                return (
                  <div key={entry.key} className="rounded-lg bg-slate-50 p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.product.name}</p>
                        <p className="text-xs text-slate-600">
                          {entry.quantity} x {(Number(entry.product.price) + modifierTotal).toFixed(2)} TL
                        </p>
                      </div>
                      <button
                        onClick={() => removeProduct(entry.key)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        type="button"
                      >
                        Azalt
                      </button>
                    </div>
                    {entry.modifiers.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-slate-500">
                        {entry.modifiers.map((modifier) => (
                          <li key={`${entry.key}-${modifier.group_name}-${modifier.option_name}`}>
                            {modifier.group_name}: {modifier.option_name}
                            {modifier.price_delta > 0 ? ` (+${Number(modifier.price_delta).toFixed(2)} TL)` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-600">Toplam</p>
            <p className="text-2xl font-semibold text-slate-900">{total.toFixed(2)} TL</p>
          </div>
          <button
            onClick={submitOrder}
            disabled={isSending}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
            type="button"
          >
            {isSending ? "Gonderiliyor..." : "Siparisi Gonder"}
          </button>
          {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Servis Talepleri</h3>
            <input
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Not (opsiyonel)"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isRequestSending}
                onClick={() => createServiceRequest("call_waiter")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Garson Cagir
              </button>
              <button
                type="button"
                disabled={isRequestSending}
                onClick={() => createServiceRequest("request_bill")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Hesap Iste
              </button>
            </div>
            {requestMessage ? <p className="mt-2 text-sm text-slate-700">{requestMessage}</p> : null}
          </div>

          <div className="mt-6">
            <OrderStatusWidget
              businessSlug={businessSlug}
              qrCodeIdentifier={qrCodeIdentifier}
              onReorder={reorderFromLatest}
            />
          </div>

          <div className="mt-4">
            <OrderHistoryWidget businessSlug={businessSlug} qrCodeIdentifier={qrCodeIdentifier} />
          </div>
        </aside>
      </div>
    </div>
  );
}
