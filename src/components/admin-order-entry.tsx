"use client";

import { useMemo, useState } from "react";
import type {
  Category,
  DiningTable,
  OrderChannel,
  OrderItemModifierSelection,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

type CartEntry = {
  key: string;
  product: Product;
  quantity: number;
  modifiers: OrderItemModifierSelection[];
};

type CartMap = Record<string, CartEntry>;

function channelLabel(channel: OrderChannel) {
  if (channel === "dine_in") return "Masa";
  if (channel === "pickup") return "Gel-al";
  return "Paket servis";
}

function buildCartKey(productId: string, modifiers: OrderItemModifierSelection[]) {
  const suffix = modifiers
    .map((modifier) => `${modifier.group_name}:${modifier.option_name}`)
    .sort()
    .join("|");
  return suffix ? `${productId}:${suffix}` : productId;
}

export function AdminOrderEntry({
  businessSlug,
  categories,
  products,
  modifierGroups,
  modifierOptions,
  tables,
  initialTableId,
  lockedTableId,
  onOrderCreated,
  mobilePresentation = "default",
}: {
  businessSlug: string;
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  tables: DiningTable[];
  initialTableId?: string;
  lockedTableId?: string;
  onOrderCreated?: (orderId: string) => void;
  mobilePresentation?: "default" | "stack";
}) {
  const isTableLocked = Boolean(lockedTableId);
  const [channel, setChannel] = useState<OrderChannel>(isTableLocked ? "dine_in" : "dine_in");
  const [selectedTableId, setSelectedTableId] = useState<string>(
    (lockedTableId && tables.some((table) => table.id === lockedTableId))
      ? lockedTableId
      : (initialTableId && tables.some((table) => table.id === initialTableId))
        ? initialTableId
        : (tables[0]?.id ?? ""),
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [cart, setCart] = useState<CartMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [categoryTabsOpen, setCategoryTabsOpen] = useState(true);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const isStackMobile = mobilePresentation === "stack";

  const tableById = useMemo(() => new Map(tables.map((table) => [table.id, table])), [tables]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const orderedCategories = useMemo(
    () => [...categories].sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)),
    [categories],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => orderedCategories[0]?.id ?? "");

  const groupedProducts = useMemo(() => {
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

  const total = useMemo(
    () =>
      Object.values(cart).reduce((sum, entry) => {
        const modifierTotal = entry.modifiers.reduce((inner, modifier) => inner + Number(modifier.price_delta), 0);
        return sum + (Number(entry.product.price) + modifierTotal) * entry.quantity;
      }, 0),
    [cart],
  );

  const activeCategoryId = orderedCategories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : (orderedCategories[0]?.id ?? "");
  const activeCategory = orderedCategories.find((category) => category.id === activeCategoryId) ?? null;
  const visibleProducts = groupedProducts.get(activeCategoryId) ?? [];

  function getConfiguredQuantity(productId: string) {
    const raw = Number(productQuantities[productId] ?? 1);
    if (!Number.isFinite(raw)) {
      return 1;
    }
    return Math.max(1, Math.min(99, Math.round(raw)));
  }

  function setConfiguredQuantity(productId: string, quantity: number) {
    const safe = Math.max(1, Math.min(99, Math.round(quantity)));
    setProductQuantities((prev) => ({ ...prev, [productId]: safe }));
  }

  function openModifierPicker(product: Product) {
    const groups = groupsByProduct.get(product.id) ?? [];
    if (groups.length === 0) {
      addConfiguredProductWithQuantity(product, [], getConfiguredQuantity(product.id));
      return;
    }

    const defaults: Record<string, string[]> = {};
    for (const group of groups) {
      const defaultOptionIds = (optionsByGroup.get(group.id) ?? [])
        .filter((option) => option.is_default)
        .map((option) => option.id);
      defaults[group.id] = defaultOptionIds.slice(0, Math.max(group.max_select, 1));
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

  function addConfiguredProductWithQuantity(product: Product, modifiers: OrderItemModifierSelection[], quantity: number) {
    const key = buildCartKey(product.id, modifiers);
    const safeQuantity = Math.max(1, Math.min(99, Math.round(quantity)));
    setCart((prev) => ({
      ...prev,
      [key]: {
        key,
        product,
        modifiers,
        quantity: (prev[key]?.quantity ?? 0) + safeQuantity,
      },
    }));
    setActiveProductId(null);
    setSelectedOptions({});
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
        setMessageTone("error");
        setMessage(`${group.name} secimi zorunlu.`);
        return;
      }
    }

    addConfiguredProductWithQuantity(product, buildModifierSelections(activeProductId), getConfiguredQuantity(activeProductId));
  }

  function removeProduct(key: string) {
    setCart((prev) => {
      const current = prev[key];
      if (!current) {
        return prev;
      }
      if (current.quantity <= 1) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          quantity: current.quantity - 1,
        },
      };
    });
  }

  function increaseProduct(key: string) {
    setCart((prev) => {
      const current = prev[key];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          quantity: Math.min(99, current.quantity + 1),
        },
      };
    });
  }

  function setCartEntryQuantity(key: string, quantity: number) {
    const safe = Math.max(1, Math.min(99, Math.round(quantity)));
    setCart((prev) => {
      const current = prev[key];
      if (!current) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...current,
          quantity: safe,
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
      setMessageTone("error");
      setMessage("En az bir ürün sec.");
      return;
    }

    const selectedTable = channel === "dine_in" ? tableById.get(selectedTableId) : null;
    if (channel === "dine_in" && !selectedTable) {
      setMessageTone("error");
      setMessage("Masa secilmeden sipariş açılamaz.");
      return;
    }

    if (channel !== "dine_in" && !customerName.trim()) {
      setMessageTone("error");
      setMessage("Müşteri adi gerekli.");
      return;
    }

    if (channel === "delivery" && !deliveryAddress.trim()) {
      setMessageTone("error");
      setMessage("Paket servis için adres gerekli.");
      return;
    }

    setSubmitting(true);
    setMessageTone("info");
    setMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug,
          channel,
          qrCodeIdentifier: selectedTable?.qr_code_identifier,
          tableId: selectedTable?.id,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          deliveryAddress: deliveryAddress.trim() || undefined,
          deliveryNote: deliveryNote.trim() || undefined,
          items,
          totalPrice: total,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string; orderId?: string };
      if (!response.ok || !data.ok) {
        setMessageTone("error");
        setMessage(data.message ?? "Sipariş acilamadi.");
        return;
      }
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryNote("");
      setMobileCartOpen(false);
      setMessageTone("success");
      setMessage(`Sipariş açıldı: #${String(data.orderId ?? "").slice(0, 8)}`);
      window.dispatchEvent(new Event("live-ops:update"));
      if (data.orderId) {
        onOrderCreated?.(data.orderId);
      }
    } catch {
      setMessageTone("error");
      setMessage("Baglanti hatasi oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeProduct = activeProductId ? productById.get(activeProductId) ?? null : null;
  const cartEntries = Object.values(cart);
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <>
    <div className="app-mobile-hide grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sipariş Kanali</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["dine_in", "pickup", "delivery"] as OrderChannel[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (!isTableLocked) {
                    setChannel(value);
                  }
                }}
                disabled={isTableLocked && value !== "dine_in"}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  channel === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                } ${isTableLocked && value !== "dine_in" ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {channelLabel(value)}
              </button>
            ))}
          </div>

          {channel === "dine_in" ? (
            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700" htmlFor="table-select">
                Masa
              </label>
              <select
                id="table-select"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
                value={selectedTableId}
                onChange={(event) => setSelectedTableId(event.target.value)}
                disabled={isTableLocked}
              >
                {(isTableLocked
                  ? tables.filter((table) => table.id === selectedTableId)
                  : tables
                ).map((table) => (
                  <option key={table.id} value={table.id}>
                    {(table.name || `Masa ${table.table_number}`)} - {table.status}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Müşteri adi"
                className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Telefon"
                className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
              {channel === "delivery" ? (
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Adres"
                  className="min-h-28 rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
                />
              ) : null}
              <textarea
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                placeholder={channel === "delivery" ? "Kurye notu" : "Sipariş notu"}
                className="min-h-24 rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
              />
            </div>
          )}
        </article>

        {activeProduct ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Modifier Secimi</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{activeProduct.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfiguredQuantity(activeProduct.id, getConfiguredQuantity(activeProduct.id) - 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  value={getConfiguredQuantity(activeProduct.id)}
                  onChange={(event) => setConfiguredQuantity(activeProduct.id, Number(event.target.value))}
                  className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => setConfiguredQuantity(activeProduct.id, getConfiguredQuantity(activeProduct.id) + 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveProductId(null);
                  setSelectedOptions({});
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 sm:w-auto"
              >
                Kapat
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
                <div key={group.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{group.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {group.is_required ? "Zorunlu" : "Opsiyonel"} - en fazla {group.max_select}
                  </p>
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
              className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
            >
              Sepete Ekle
            </button>
          </article>
        ) : null}

        <section className="space-y-4">
          {message ? (
            <div
              className={`rounded-[24px] border px-4 py-4 text-sm font-medium ${
                messageTone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : messageTone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {message}
            </div>
          ) : null}
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:sticky md:top-4 md:z-20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Menü Kategorileri</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeCategory?.name ?? "Kategori yok"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryTabsOpen((prev) => !prev)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                {categoryTabsOpen ? "Gizle" : "Göster"}
              </button>
            </div>
            {categoryTabsOpen ? (
              <div className="mt-3 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  {orderedCategories.map((category) => {
                    const isActive = category.id === activeCategoryId;
                    const productCount = groupedProducts.get(category.id)?.length ?? 0;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {category.name} ({productCount})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{activeCategory?.name ?? "Kategori"}</h2>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {visibleProducts.length} ürün
              </span>
            </div>
            {visibleProducts.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Bu kategoride aktif ürün yok.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visibleProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{product.description ?? "Menü urunu"}</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-700">{Number(product.price).toFixed(2)} TL</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) - 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        value={getConfiguredQuantity(product.id)}
                        onChange={(event) => setConfiguredQuantity(product.id, Number(event.target.value))}
                        className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) + 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => openModifierPicker(product)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                      >
                        {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Seceneklerle Ekle" : "Ekle"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </section>

      <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Aktif Sipariş</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{channelLabel(channel)}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kalem</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{cartCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Toplam</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{total.toFixed(2)} TL</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {Object.values(cart).length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Sepet boş.</p>
          ) : (
            Object.values(cart).map((entry) => {
              const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
              return (
                <div key={entry.key} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.product.name}</p>
                      <p className="text-xs text-slate-600">
                        {entry.quantity} x {(Number(entry.product.price) + modifierTotal).toFixed(2)} TL
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(entry.key)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      inputMode="numeric"
                      value={entry.quantity}
                      onChange={(event) => setCartEntryQuantity(entry.key, Number(event.target.value))}
                      className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => increaseProduct(entry.key)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
                    >
                      +
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

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="flex justify-between text-sm text-slate-600">
            <span>Toplam</span>
            <span>{total.toFixed(2)} TL</span>
          </p>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={submitOrder}
          className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Sipariş açılıyor..." : "Siparisi Ac"}
        </button>
      </aside>
    </div>
      <div className={`app-mobile-only space-y-3 ${isStackMobile ? "pb-[calc(190px+var(--safe-area-bottom))]" : "pb-[calc(164px+var(--safe-area-bottom))]"}`}>
        <article className="mobile-task-card space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Sipariş Kanali</p>
          <div className="grid grid-cols-3 gap-2">
            {(["dine_in", "pickup", "delivery"] as OrderChannel[]).map((value) => (
              <button
                key={`mobile-channel-${value}`}
                type="button"
                onClick={() => {
                  if (!isTableLocked) {
                    setChannel(value);
                  }
                }}
                disabled={isTableLocked && value !== "dine_in"}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  channel === value ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                } ${isTableLocked && value !== "dine_in" ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {channelLabel(value)}
              </button>
            ))}
          </div>

          {channel === "dine_in" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="mobile-table-select">
                Masa
              </label>
              <select
                id="mobile-table-select"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                value={selectedTableId}
                onChange={(event) => setSelectedTableId(event.target.value)}
                disabled={isTableLocked}
              >
                {(isTableLocked ? tables.filter((table) => table.id === selectedTableId) : tables).map((table) => (
                  <option key={`mobile-table-${table.id}`} value={table.id}>
                    {(table.name || `Masa ${table.table_number}`)} - {table.status}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Müşteri adi"
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Telefon"
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              />
              {channel === "delivery" ? (
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Adres"
                  className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                />
              ) : null}
              <textarea
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                placeholder={channel === "delivery" ? "Kurye notu" : "Sipariş notu"}
                className="min-h-20 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              />
            </div>
          )}
        </article>

        <article className="mobile-task-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Menü Kategorileri</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{activeCategory?.name ?? "Kategori yok"}</p>
            </div>
            <button
              type="button"
              onClick={() => setCategoryTabsOpen((prev) => !prev)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {categoryTabsOpen ? "Gizle" : "Göster"}
            </button>
          </div>
          {categoryTabsOpen ? (
            <div className="mt-3 overflow-x-auto pb-1">
              <div className={`flex min-w-max gap-2 ${isStackMobile ? "mobile-task-tabs-static" : ""}`}>
                {orderedCategories.map((category) => {
                  const isActive = category.id === activeCategoryId;
                  const productCount = groupedProducts.get(category.id)?.length ?? 0;
                  return (
                    <button
                      key={`mobile-category-${category.id}`}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                        isActive ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {category.name} ({productCount})
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </article>

        {activeProduct ? (
          <article className="mobile-task-card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Secenekler</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{activeProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveProductId(null);
                  setSelectedOptions({});
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Kapat
              </button>
            </div>
            {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
              <div key={`mobile-group-${group.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {group.is_required ? "Zorunlu" : "Opsiyonel"} - en fazla {group.max_select}
                </p>
                <div className="mt-2 grid gap-2">
                  {(optionsByGroup.get(group.id) ?? []).map((option) => {
                    const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                    return (
                      <button
                        key={`mobile-option-${option.id}`}
                        type="button"
                        onClick={() => toggleOption(group, option.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${
                          checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={confirmModifiers}
              className="mobile-cta-primary w-full px-4 py-3 text-sm font-semibold text-white"
            >
              Sepete Ekle
            </button>
          </article>
        ) : null}

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              messageTone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : messageTone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <article className="mobile-task-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">{activeCategory?.name ?? "Kategori"}</h2>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {visibleProducts.length} ürün
            </span>
          </div>
          <div className="space-y-3">
            {visibleProducts.map((product) => (
              <div key={`mobile-product-${product.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm text-emerald-700">{Number(product.price).toFixed(2)} TL</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) - 1)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    value={getConfiguredQuantity(product.id)}
                    onChange={(event) => setConfiguredQuantity(product.id, Number(event.target.value))}
                    className="h-10 w-16 rounded-lg border border-slate-300 px-2 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) + 1)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => openModifierPicker(product)}
                    className="mobile-cta-primary ml-auto inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
                  >
                    {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Secenekli Ekle" : "Ekle"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {mobileCartOpen ? (
        <div className="app-mobile-only fixed inset-0 z-[70] bg-slate-950/35">
          <div className="absolute inset-0 overflow-y-auto bg-[#eef1f5] px-3 pb-[calc(96px+var(--safe-area-bottom))] pt-[calc(72px+var(--safe-area-top))]">
            <header className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Aktif Sipariş</p>
                  <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-slate-900">{channelLabel(channel)}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                >
                  Kapat
                </button>
              </div>
            </header>

            <div className="mt-3 space-y-2">
              {cartEntries.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Sepet boş.</p>
              ) : (
                cartEntries.map((entry) => {
                  const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                  return (
                    <div key={`mobile-cart-${entry.key}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.product.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {entry.quantity} x {(Number(entry.product.price) + modifierTotal).toFixed(2)} TL
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeProduct(entry.key)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-xs text-slate-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          inputMode="numeric"
                          value={entry.quantity}
                          onChange={(event) => setCartEntryQuantity(entry.key, Number(event.target.value))}
                          className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => increaseProduct(entry.key)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-xs text-slate-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`app-mobile-only fixed inset-x-0 z-40 px-3`}
        style={{ bottom: isStackMobile ? "calc(74px + var(--safe-area-bottom))" : "calc(72px + var(--safe-area-bottom))" }}
      >
        <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.14)] ${isStackMobile ? "m-flow-cart-dock" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Sipariş</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{cartCount} kalem - {total.toFixed(2)} TL</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Sepeti Ac
            </button>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={submitOrder}
            className="mobile-cta-primary mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Sipariş açılıyor..." : "Siparisi Ac"}
          </button>
        </div>
      </div>
    </>
  );
}
