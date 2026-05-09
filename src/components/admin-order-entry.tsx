"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import type {
  Category,
  DiningTable,
  OrderChannel,
  OrderItemModifierSelection,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  TableStatus,
  OperatingProfile,
  OperatingProfileCapabilities,
} from "@/lib/types";

type CartEntry = {
  key: string;
  product: Product;
  quantity: number;
  modifiers: OrderItemModifierSelection[];
};

type CartMap = Record<string, CartEntry>;
type EntryMode = "classic" | "table_first";
type LayoutMode = "auto" | "tablet_3pane" | "mobile_stack";
type InitialView = "table_picker" | "composer";

function channelLabel(channel: OrderChannel) {
  if (channel === "dine_in") return "Masa";
  if (channel === "pickup") return "Gel-al";
  return "Paket servis";
}

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Bos";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function tableStatusTone(status: TableStatus) {
  if (status === "empty") return "bg-emerald-100 text-emerald-700";
  if (status === "occupied") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
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
  entryMode = "classic",
  layoutMode = "auto",
  initialView = "table_picker",
  businessType,
  operatingProfile = "restaurant_classic",
  operatingCapabilities,
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
  entryMode?: EntryMode;
  layoutMode?: LayoutMode;
  initialView?: InitialView;
  businessType?: string;
  operatingProfile?: OperatingProfile;
  operatingCapabilities?: OperatingProfileCapabilities;
}) {
  const isTableLocked = Boolean(lockedTableId);
  const [channel, setChannel] = useState<OrderChannel>(
    operatingCapabilities?.channels.includes("pickup") && operatingCapabilities.channels.length === 1
      ? "pickup"
      : (isTableLocked ? "dine_in" : "dine_in")
  );
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
  const [tablePickerFilter, setTablePickerFilter] = useState<"all" | TableStatus>("all");
  const [tablePickerQuery, setTablePickerQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSelfServiceCoffee = operatingProfile === "coffee_self_service";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isSelfServiceCoffee) {
      return;
    }
    if (channel !== "pickup") {
      setChannel("pickup");
    }
  }, [channel, isSelfServiceCoffee]);
  const [tablePickerView, setTablePickerView] = useState<InitialView>(() => {
    if (operatingCapabilities?.hide_table_ui) {
      return "composer";
    }
    if (entryMode !== "table_first") {
      return "composer";
    }
    if (initialView === "composer" && tables.some((table) => table.id === selectedTableId)) {
      return "composer";
    }
    return "table_picker";
  });
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
  const visibleProducts = useMemo(() => groupedProducts.get(activeCategoryId) ?? [], [activeCategoryId, groupedProducts]);
  const filteredVisibleProducts = useMemo(() => {
    const query = productSearchQuery.trim().toLocaleLowerCase("tr");
    if (!query) {
      return visibleProducts;
    }
    return visibleProducts.filter((product) => {
      const name = product.name.toLocaleLowerCase("tr");
      const description = (product.description ?? "").toLocaleLowerCase("tr");
      return name.includes(query) || description.includes(query);
    });
  }, [productSearchQuery, visibleProducts]);
  const selectedTable = tableById.get(selectedTableId) ?? null;
  const tableStats = useMemo(() => {
    const emptyCount = tables.filter((table) => table.status === "empty").length;
    const occupiedCount = tables.filter((table) => table.status === "occupied").length;
    const reservedCount = tables.filter((table) => table.status === "reserved").length;
    return {
      all: tables.length,
      empty: emptyCount,
      occupied: occupiedCount,
      reserved: reservedCount,
    };
  }, [tables]);
  const filteredTables = useMemo(() => {
    const query = tablePickerQuery.trim().toLocaleLowerCase("tr");
    const base = [...tables]
      .sort((left, right) => left.table_number - right.table_number)
      .filter((table) => tablePickerFilter === "all" || table.status === tablePickerFilter);
    if (!query) {
      return base;
    }
    return base.filter((table) => {
      const name = table.name?.toLocaleLowerCase("tr") ?? "";
      return name.includes(query) || `masa ${table.table_number}`.includes(query);
    });
  }, [tablePickerFilter, tablePickerQuery, tables]);

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

    if (isSelfServiceCoffee) {
      const modifiers: OrderItemModifierSelection[] = [];
      for (const group of groups) {
        const available = optionsByGroup.get(group.id) ?? [];
        let picked = available.filter((option) => option.is_default).slice(0, Math.max(group.max_select, 1));
        if (picked.length === 0 && group.is_required) {
          picked = available.slice(0, Math.max(group.min_select, 1));
        }
        for (const option of picked) {
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
      addConfiguredProductWithQuantity(product, modifiers, getConfiguredQuantity(product.id));
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

  function clearCart() {
    setCart({});
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
      setMessage("En az bir urun sec.");
      return;
    }

    const selectedTable = channel === "dine_in" ? tableById.get(selectedTableId) : null;
    if (channel === "dine_in" && !selectedTable) {
      setMessageTone("error");
      setMessage("Masa secilmeden siparis acilamaz.");
      return;
    }

    if (channel !== "dine_in" && !customerName.trim() && !isSelfServiceCoffee) {
      setMessageTone("error");
      setMessage("Musteri adi gerekli.");
      return;
    }

    if (channel === "delivery" && !deliveryAddress.trim()) {
      setMessageTone("error");
      setMessage("Paket servis icin adres gerekli.");
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
          customerName: customerName.trim() || (isSelfServiceCoffee ? "Self Servis" : undefined),
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
        setMessage(data.message ?? "Siparis acilamadi.");
        return;
      }
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryNote("");
      setMobileCartOpen(false);
      setMessageTone("success");
      setMessage(`Siparis acildi: #${String(data.orderId ?? "").slice(0, 8)}`);
      window.dispatchEvent(new Event("live-ops:update"));
      if (data.orderId) {
        onOrderCreated?.(data.orderId);
      }
    } catch {
      setMessageTone("error");
      setMessage("Baglanti hatasi olustu.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeProduct = activeProductId ? productById.get(activeProductId) ?? null : null;
  const cartEntries = Object.values(cart);
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const useStackLayout = layoutMode === "mobile_stack";
  const allCategoryId = "__all__";
  const selfServiceProducts = useMemo(() => {
    const hasSelectedCategory = orderedCategories.some((category) => category.id === selectedCategoryId);
    const shouldUseAllProducts =
      selectedCategoryId === allCategoryId || orderedCategories.length === 0 || !hasSelectedCategory;
    const base =
      shouldUseAllProducts
        ? products
        : products.filter((product) => product.category_id === selectedCategoryId);
    const onlyActive = base.filter((product) => product.is_available);
    const query = productSearchQuery.trim().toLocaleLowerCase("tr");
    if (!query) {
      return onlyActive;
    }
    return onlyActive.filter((product) => {
      const name = product.name.toLocaleLowerCase("tr");
      const description = (product.description ?? "").toLocaleLowerCase("tr");
      return name.includes(query) || description.includes(query);
    });
  }, [allCategoryId, orderedCategories, productSearchQuery, products, selectedCategoryId]);

  if (isSelfServiceCoffee) {
    return (
      <>
        <section className="app-mobile-hide overflow-hidden rounded-[26px] border border-slate-800 bg-[linear-gradient(180deg,#070d19_0%,#0f172a_100%)] text-slate-100 shadow-[0_30px_60px_rgba(2,6,23,0.45)]">
          <header className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-3xl font-black tracking-tight">Self Servis Kahvecim</p>
              <p className="mt-1 text-sm text-slate-400">Hizli ve Lezzetli</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Siparis Sayisi</p>
              <p className="mt-2 text-2xl font-bold text-rose-400">{cartCount}</p>
            </div>
          </header>

          <div className="grid min-h-[700px] grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-y-auto px-5 pb-6 pt-5">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(allCategoryId)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    selectedCategoryId === allCategoryId
                      ? "bg-rose-500 text-white shadow-[0_14px_24px_rgba(244,63,94,0.34)]"
                      : "bg-slate-700/60 text-slate-200 hover:bg-slate-600"
                  }`}
                >
                  Tumu
                </button>
                {orderedCategories.map((category) => {
                  const selected = selectedCategoryId === category.id;
                  return (
                    <button
                      key={`self-service-category-${category.id}`}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                        selected ? "bg-rose-500 text-white" : "bg-slate-700/60 text-slate-200 hover:bg-slate-600"
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5">
                <input
                  ref={searchInputRef}
                  value={productSearchQuery}
                  onChange={(event) => setProductSearchQuery(event.target.value)}
                  placeholder="Urun ara... (Ctrl+K)"
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
                />
              </div>

              {selfServiceProducts.length === 0 ? (
                <p className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-5 text-sm text-slate-400">
                  Bu filtrede aktif urun yok.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {selfServiceProducts.map((product) => (
                    <article
                      key={`self-service-product-${product.id}`}
                      className="rounded-2xl border border-slate-700/70 bg-[radial-gradient(circle_at_top,#273247_0%,#1e293b_35%,#111827_100%)] p-4"
                    >
                      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-700/80 text-xs font-black text-slate-100">
                        {product.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-lg font-semibold text-white">{product.name}</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-rose-400">₺{Number(product.price).toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => openModifierPicker(product)}
                        className="mt-4 rounded-full bg-slate-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
                      >
                        Ekle
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="flex flex-col border-l border-slate-700/80 bg-[linear-gradient(180deg,#202838_0%,#1a2234_55%,#171f31_100%)]">
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-5">
                <div>
                  <p className="text-3xl font-black tracking-tight text-white">Siparisim</p>
                  <p className="mt-1 text-sm text-slate-300">Toplam Urun: {cartCount}</p>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-600"
                >
                  Temizle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {cartEntries.length === 0 ? (
                  <p className="mt-20 text-center text-sm text-slate-400">Urun eklemek icin soldan sec.</p>
                ) : (
                  <div className="space-y-3">
                    {cartEntries.map((entry) => {
                      const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                      return (
                        <article key={`self-service-cart-${entry.key}`} className="rounded-xl border border-slate-600 bg-slate-800/75 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-white">{entry.product.name}</p>
                              <p className="text-sm text-slate-300">₺{(Number(entry.product.price) + modifierTotal).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeProduct(entry.key)}
                                className="h-8 w-8 rounded-lg bg-slate-700 text-sm font-bold text-white"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-white">{entry.quantity}</span>
                              <button
                                type="button"
                                onClick={() => increaseProduct(entry.key)}
                                className="h-8 w-8 rounded-lg bg-slate-700 text-sm font-bold text-white"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-700 px-5 py-5">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Ara Toplam</span>
                  <span>₺{total.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-4xl font-black tracking-tight text-rose-400">Toplam</p>
                  <p className="text-4xl font-black tracking-tight text-rose-400">₺{total.toFixed(2)}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" onClick={submitOrder} disabled={submitting} className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                    Nakit
                  </button>
                  <button type="button" onClick={submitOrder} disabled={submitting} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                    Kart
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className={`app-mobile-only space-y-3 ${isStackMobile ? "pb-[calc(190px+var(--safe-area-bottom))]" : "pb-[calc(164px+var(--safe-area-bottom))]"}`}>
          <p className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-sm text-slate-200">
            Self servis mobil akista urun secimi soldaki dark masaustu tasarimla eslenik calisir.
          </p>
        </div>
      </>
    );
  }

  if (entryMode === "table_first") {
    const isTerminal = layoutMode === "tablet_3pane";

    return (
      <section className={isTerminal ? "fixed inset-0 z-50 bg-[#f1f5f9] p-4" : "space-y-4"}>
        {tablePickerView === "table_picker" ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-full overflow-y-auto">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Masa Secimi</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Siparise Baslamak Icin Masa Sec</h2>
              </div>
              <div className="flex items-center gap-3">
                {isTerminal && (
                   <Link href="/ops" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                      Geri
                   </Link>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["all", "empty", "occupied", "reserved"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTablePickerFilter(status)}
                      className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold ${
                        tablePickerFilter === status
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {(status === "all" ? "Tumu" : tableStatusLabel(status))} ({tableStats[status]})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <input
                value={tablePickerQuery}
                onChange={(event) => setTablePickerQuery(event.target.value)}
                placeholder="Masa ara (ad veya numara)"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>

            {filteredTables.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Bu filtrede masa bulunamadi.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {filteredTables.map((table) => (
                  <button
                    key={`picker-${table.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedTableId(table.id);
                      setChannel("dine_in");
                      setTablePickerView("composer");
                    }}
                    className={`min-h-[110px] rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      table.id === selectedTableId
                        ? "border-[#ff5a34] bg-orange-50/50 shadow-[0_4px_12px_rgba(255,90,52,0.1)] ring-1 ring-[#ff5a34]/20"
                        : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col h-full justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Masa {table.table_number}</p>
                        <p className="mt-1 text-base font-bold text-slate-900 line-clamp-1">{table.name || `Masa ${table.table_number}`}</p>
                      </div>
                      <span className={`self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tableStatusTone(table.status)}`}>
                        {tableStatusLabel(table.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </article>
        ) : isTerminal ? (
          /* Specialized Terminal 3-Pane UI */
          <div className="flex flex-col h-full gap-4 overflow-hidden">
             {/* Header */}
             <header className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                   <button 
                      type="button" 
                      onClick={() => setTablePickerView("table_picker")}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                   </button>
                   <div>
                      <h1 className="text-xl font-bold text-slate-900">
                         {channel === "dine_in" ? (selectedTable?.name || `Masa ${selectedTable?.table_number}`) : channelLabel(channel)}
                      </h1>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{businessSlug}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                      Fis Yazdir
                   </button>
                   <Link 
                      href="/cashier"
                      className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-lg shadow-slate-900/20"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                      Kasiyer Paneli
                   </Link>
                </div>
             </header>

             {/* Main Content Area */}
             <div className="flex-1 grid grid-cols-[220px_1fr_380px] gap-4 overflow-hidden">
                {/* Categories Column */}
                <aside className="overflow-y-auto rounded-2xl bg-white/60 backdrop-blur-md p-3 shadow-sm border border-white">
                   <div className="space-y-2">
                      {orderedCategories.map((category, idx) => {
                         const isActive = category.id === activeCategoryId;
                         const colors = [
                            "from-orange-500 to-amber-500",
                            "from-blue-500 to-indigo-500",
                            "from-emerald-500 to-teal-500",
                            "from-rose-500 to-pink-500",
                            "from-purple-500 to-violet-500"
                         ];
                         const colorClass = colors[idx % colors.length];
                         
                         return (
                            <button
                               key={`term-cat-${category.id}`}
                               type="button"
                               onClick={() => setSelectedCategoryId(category.id)}
                               className={`w-full min-h-[64px] rounded-xl p-3 text-left transition-all relative overflow-hidden group ${
                                  isActive 
                                  ? `bg-gradient-to-br ${colorClass} text-white shadow-lg ring-2 ring-offset-2 ring-slate-200` 
                                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100"
                               }`}
                            >
                               <span className="relative z-10 font-bold text-sm">{category.name}</span>
                               <span className={`absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform ${isActive ? "text-white" : "text-slate-900"}`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.5V4a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H8"/></svg>
                               </span>
                            </button>
                         );
                      })}
                   </div>
                </aside>

                {/* Products Column */}
                <section className="flex flex-col gap-4 overflow-hidden">
                   <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                      <div className="relative">
                         <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                         <input
                            ref={searchInputRef}
                            autoFocus
                            value={productSearchQuery}
                            onChange={(event) => setProductSearchQuery(event.target.value)}
                            placeholder="Urun Ara... (Ctrl+K)"
                            className="h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-sm font-medium border-none focus:ring-2 focus:ring-slate-900"
                         />
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
                      {filteredVisibleProducts.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <p className="text-sm font-medium">Bu kategoride urun bulunamadi.</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredVisibleProducts.map((product) => (
                               <button
                                  key={`term-prod-${product.id}`}
                                  type="button"
                                  onClick={() => openModifierPicker(product)}
                                  className="group flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-4 text-left transition-all hover:border-emerald-200 hover:shadow-md active:scale-95"
                               >
                                  <div className="w-full">
                                     <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 min-h-[40px]">{product.name}</h3>
                                     <p className="mt-2 text-lg font-black text-slate-900">{Number(product.price).toFixed(2)} <span className="text-xs font-medium text-slate-500">TL</span></p>
                                  </div>
                                  <div className="mt-4 flex w-full items-center justify-between">
                                     <span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                        {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Opsiyonlu" : "Normal"}
                                     </span>
                                     <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                     </div>
                                  </div>
                               </button>
                            ))}
                         </div>
                      )}
                   </div>
                </section>

                {/* Cart Column (The Receipt) */}
                <aside className="flex flex-col rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden">
                   <div className="bg-slate-900 p-4 text-white">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold uppercase tracking-widest opacity-60">Siparis Detayi</span>
                         <button type="button" onClick={clearCart} className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Temizle</button>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                         <span className="text-3xl font-black">{total.toFixed(2)}</span>
                         <span className="text-sm font-bold opacity-60">TL</span>
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto p-4 bg-[url('https://www.transparenttextures.com/patterns/paper.png')]">
                      {cartEntries.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 italic">
                            <p>Henuz urun eklenmedi</p>
                         </div>
                      ) : (
                         <div className="space-y-4">
                            {cartEntries.map((entry) => {
                               const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                               const itemTotal = (Number(entry.product.price) + modifierTotal) * entry.quantity;
                               return (
                                  <div key={`term-cart-${entry.key}`} className="relative group border-b border-slate-200 border-dashed pb-4">
                                     <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                           <h4 className="font-bold text-slate-900 text-sm leading-tight">{entry.product.name}</h4>
                                           <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                              <span className="font-bold text-slate-900">x{entry.quantity}</span>
                                              <span>@ {(Number(entry.product.price) + modifierTotal).toFixed(2)} TL</span>
                                           </div>
                                        </div>
                                        <span className="font-bold text-slate-900 text-sm">{itemTotal.toFixed(2)}</span>
                                     </div>
                                     {entry.modifiers.length > 0 && (
                                        <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-0.5">
                                           {entry.modifiers.map(m => (
                                              <p key={m.option_id} className="text-[10px] text-slate-500">+ {m.option_name}</p>
                                           ))}
                                        </div>
                                     )}
                                     <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => removeProduct(entry.key)} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">-</button>
                                        <button onClick={() => increaseProduct(entry.key)} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">+</button>
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                      )}
                   </div>

                   <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                      <div className="flex justify-between items-center text-slate-900 font-bold">
                         <span>TOPLAM</span>
                         <span className="text-xl">{total.toFixed(2)} TL</span>
                      </div>
                      <button
                         type="button"
                         disabled={submitting || cartEntries.length === 0}
                         onClick={submitOrder}
                         className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all"
                      >
                         {submitting ? "ISLENIYOR..." : "SIPARISI TAMAMLA"}
                      </button>
                   </div>
                </aside>
             </div>

             {/* Modals for modifiers */}
             {activeProduct && (groupsByProduct.get(activeProduct.id) ?? []).length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                   <article className="w-full max-w-2xl rounded-3xl bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                      <header className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                         <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Secenekleri Tamamla</p>
                            <h2 className="text-xl font-bold text-slate-900">{activeProduct.name}</h2>
                         </div>
                         <button onClick={() => { setActiveProductId(null); setSelectedOptions({}); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                         </button>
                      </header>
                      
                      <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
                         {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
                            <div key={`term-mod-grp-${group.id}`}>
                               <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-bold text-slate-900">{group.name}</h3>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight ${group.is_required ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                                     {group.is_required ? "Zorunlu" : "Opsiyonel"}
                                  </span>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                  {(optionsByGroup.get(group.id) ?? []).map((option) => {
                                     const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                                     return (
                                        <button
                                           key={`term-opt-${option.id}`}
                                           type="button"
                                           onClick={() => toggleOption(group, option.id)}
                                           className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                                              checked ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                           }`}
                                        >
                                           <span className="font-bold text-sm">{option.name}</span>
                                           <span className={`text-[10px] mt-1 ${checked ? "text-slate-300" : "text-slate-500"}`}>
                                              {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Ucretsiz"}
                                           </span>
                                        </button>
                                     );
                                  })}
                               </div>
                            </div>
                         ))}
                      </div>

                      <footer className="bg-slate-50 p-6 border-t border-slate-200 flex items-center justify-between gap-4">
                         <div className="flex items-center gap-3">
                            <button onClick={() => setConfiguredQuantity(activeProduct.id, getConfiguredQuantity(activeProduct.id) - 1)} className="h-12 w-12 rounded-xl bg-white border border-slate-200 font-bold text-lg shadow-sm">-</button>
                            <span className="w-8 text-center font-bold text-lg">{getConfiguredQuantity(activeProduct.id)}</span>
                            <button onClick={() => setConfiguredQuantity(activeProduct.id, getConfiguredQuantity(activeProduct.id) + 1)} className="h-12 w-12 rounded-xl bg-white border border-slate-200 font-bold text-lg shadow-sm">+</button>
                         </div>
                         <button
                            onClick={confirmModifiers}
                            className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-bold shadow-lg active:scale-95 transition-transform"
                         >
                            SEPETE EKLE
                         </button>
                      </footer>
                   </article>
                </div>
             )}

             {/* Message Toast inside terminal */}
             {message && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
                   messageTone === "success" ? "bg-emerald-600 text-white" : messageTone === "error" ? "bg-rose-600 text-white" : "bg-slate-800 text-white"
                }`}>
                   <p className="font-bold text-sm">{message}</p>
                </div>
             )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Siparis Akisi</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {channel === "dine_in"
                    ? (selectedTable?.name || (selectedTable ? `Masa ${selectedTable.table_number}` : "Masa secilmedi"))
                    : channelLabel(channel)}
                </p>
              </div>
              {!isTableLocked && !operatingCapabilities?.hide_table_ui ? (
                <button
                  type="button"
                  onClick={() => setTablePickerView("table_picker")}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Masalari Goster
                </button>
              ) : null}
            </div>

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

            <div className={`grid gap-4 ${useStackLayout ? "" : "md:grid-cols-[minmax(240px,0.95fr)_minmax(220px,0.62fr)_minmax(0,1.2fr)]"}`}>
              <aside className={`${useStackLayout ? "" : "md:sticky md:top-4 md:h-fit"} min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kanal</p>
                {(!operatingCapabilities || operatingCapabilities.channels.length > 1) && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
                  {(["dine_in", "pickup", "delivery"] as OrderChannel[])
                    .filter((v) => (operatingCapabilities?.channels ? operatingCapabilities.channels.includes(v) : true))
                    .map((value) => (
                    <button
                      key={`table-first-channel-${value}`}
                      type="button"
                      onClick={() => {
                        if (!isTableLocked) {
                          setChannel(value);
                        }
                      }}
                      disabled={isTableLocked && value !== "dine_in"}
                      className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold ${
                        channel === value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      } ${isTableLocked && value !== "dine_in" ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {channelLabel(value)}
                    </button>
                  ))}
                </div>
                )}

                {channel === "dine_in" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Secili Masa</p>
                    {selectedTable ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{selectedTable.name || `Masa ${selectedTable.table_number}`}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tableStatusTone(selectedTable.status)}`}>
                          {tableStatusLabel(selectedTable.status)}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Masa secilmedi.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Musteri adi"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Telefon"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    {channel === "delivery" ? (
                      <textarea
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        placeholder="Adres"
                        className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    ) : null}
                    <textarea
                      value={deliveryNote}
                      onChange={(event) => setDeliveryNote(event.target.value)}
                      placeholder={channel === "delivery" ? "Kurye notu" : "Siparis notu"}
                      className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Kalem</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{cartCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Toplam</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{total.toFixed(2)} TL</p>
                  </div>
                </div>
                {cartEntries.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Sepeti Temizle
                  </button>
                ) : null}

                <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
                  {cartEntries.length === 0 ? (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">Sepet bos.</p>
                  ) : (
                    cartEntries.map((entry) => {
                      const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                      return (
                        <div key={`table-first-cart-${entry.key}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">{entry.product.name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {entry.quantity} x {(Number(entry.product.price) + modifierTotal).toFixed(2)} TL
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => removeProduct(entry.key)}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700"
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
                              className="min-h-[40px] w-16 rounded-lg border border-slate-300 px-2 text-center text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => increaseProduct(entry.key)}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitOrder}
                  className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Siparis aciliyor..." : "Siparisi Ac"}
                </button>
              </aside>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kategoriler</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {activeCategory?.name ?? "Kategori yok"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {orderedCategories.map((category) => {
                    const isActive = category.id === activeCategoryId;
                    const count = groupedProducts.get(category.id)?.length ?? 0;
                    return (
                      <button
                        key={`table-first-category-${category.id}`}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`min-h-[48px] rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {category.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{activeCategory?.name ?? "Urunler"}</h3>
                  <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {filteredVisibleProducts.length} urun
                  </span>
                </div>
                <input
                  ref={searchInputRef}
                  autoFocus
                  value={productSearchQuery}
                  onChange={(event) => setProductSearchQuery(event.target.value)}
                  placeholder="Urun Ara... (Ctrl+K)"
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                {activeProduct ? (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Secenekler</p>
                        <p className="text-sm font-semibold text-slate-900">{activeProduct.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProductId(null);
                          setSelectedOptions({});
                        }}
                        className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"
                      >
                        Kapat
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(groupsByProduct.get(activeProduct.id) ?? []).map((group) => (
                        <div key={`table-first-group-${group.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.is_required ? "Zorunlu" : "Opsiyonel"} - en fazla {group.max_select}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {(optionsByGroup.get(group.id) ?? []).map((option) => {
                              const checked = (selectedOptions[group.id] ?? []).includes(option.id);
                              return (
                                <button
                                  key={`table-first-option-${option.id}`}
                                  type="button"
                                  onClick={() => toggleOption(group, option.id)}
                                  className={`min-h-[40px] rounded-lg border px-3 py-2 text-left text-sm ${
                                    checked
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {option.name}
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
                      className="mt-3 min-h-[48px] w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Sepete Ekle
                    </button>
                  </article>
                ) : null}

                {filteredVisibleProducts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Bu kategoride aktif urun yok.
                  </p>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filteredVisibleProducts.map((product) => (
                      <article key={`table-first-product-${product.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-600">{product.description ?? "Menu urunu"}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">{Number(product.price).toFixed(2)} TL</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) - 1)}
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700"
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
                            className="min-h-[40px] w-16 rounded-lg border border-slate-300 px-2 text-center text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setConfiguredQuantity(product.id, getConfiguredQuantity(product.id) + 1)}
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => openModifierPicker(product)}
                            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:ml-auto sm:w-auto"
                          >
                            {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Secenekli Ekle" : "Ekle"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
    <div className="app-mobile-hide grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Siparis Kanali</p>
          {(!operatingCapabilities || operatingCapabilities.channels.length > 1) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["dine_in", "pickup", "delivery"] as OrderChannel[])
              .filter((v) => (operatingCapabilities?.channels ? operatingCapabilities.channels.includes(v) : true))
              .map((value) => (
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
          )}

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
                placeholder="Musteri adi"
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
                placeholder={channel === "delivery" ? "Kurye notu" : "Siparis notu"}
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
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Menu Kategorileri</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeCategory?.name ?? "Kategori yok"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryTabsOpen((prev) => !prev)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                {categoryTabsOpen ? "Gizle" : "Goster"}
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
                {visibleProducts.length} urun
              </span>
            </div>
            {visibleProducts.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Bu kategoride aktif urun yok.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {visibleProducts.map((product) => (
                  <div key={product.id} className="overflow-hidden rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{product.description ?? "Menu urunu"}</p>
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
                        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white sm:ml-auto sm:w-auto"
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
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Aktif Siparis</p>
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
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Sepet bos.</p>
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
          {submitting ? "Siparis aciliyor..." : "Siparisi Ac"}
        </button>
      </aside>
    </div>
      <div className={`app-mobile-only space-y-3 ${isStackMobile ? "pb-[calc(190px+var(--safe-area-bottom))]" : "pb-[calc(164px+var(--safe-area-bottom))]"}`}>
        <article className="mobile-task-card space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Kanali</p>
          {(!operatingCapabilities || operatingCapabilities.channels.length > 1) && (
          <div className="grid grid-cols-3 gap-2">
            {(["dine_in", "pickup", "delivery"] as OrderChannel[])
              .filter((v) => (operatingCapabilities?.channels ? operatingCapabilities.channels.includes(v) : true))
              .map((value) => (
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
          )}

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
                placeholder="Musteri adi"
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
                placeholder={channel === "delivery" ? "Kurye notu" : "Siparis notu"}
                className="min-h-20 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              />
            </div>
          )}
        </article>

        <article className="mobile-task-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Menu Kategorileri</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{activeCategory?.name ?? "Kategori yok"}</p>
            </div>
            <button
              type="button"
              onClick={() => setCategoryTabsOpen((prev) => !prev)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {categoryTabsOpen ? "Gizle" : "Goster"}
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
              {visibleProducts.length} urun
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                    className="mobile-cta-primary inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white sm:ml-auto sm:w-auto"
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Aktif Siparis</p>
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
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Sepet bos.</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Siparis</p>
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
            {submitting ? "Siparis aciliyor..." : "Siparisi Ac"}
          </button>
        </div>
      </div>
    </>
  );
}

