"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  MonitorSmartphone,
  Search,
  ShoppingBasket,
} from "lucide-react";
import {
  clearActiveCustomerDisplaySession,
  createCustomerDisplaySession,
  CUSTOMER_DISPLAY_SESSIONS_STORAGE_KEY,
  getActiveCustomerDisplaySession,
  publishCustomerDisplaySnapshot,
  type CustomerDisplaySessionRecord,
} from "@/lib/customer-display";

function triggerHaptic(pattern: number | number[] = 40) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic feedback failed", e);
    }
  }
}
import { SelfServiceModifierInline } from "@/components/self-service-modifier-inline";
import { TablePickerFloorPlan } from "@/components/table-picker-floor-plan";
import { loadCatalog, type CatalogSnapshot } from "@/lib/offline/catalog-store";
import { freezeCartConsumption } from "@/lib/offline/catalog-consumption";

import type {
  Category,
  CustomerDisplaySnapshot,
  DiningTable,
  OrderChannel,
  OrderItemModifierSelection,
  PaymentMethod,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  TableStatus,
  TableZone,
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

/** `/api/orders` govdesi. `onSubmitOrder` devraldiginda ayni sekli alir. */
export type OrderSubmitPayload = {
  businessSlug: string;
  channel: OrderChannel;
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNote?: string;
  items: Array<Record<string, unknown>>;
  totalPrice: number;
};

export type OrderSubmitResult = {
  ok: boolean;
  message?: string;
  orderId?: string;
  checkNumber?: string | null;
};
type LayoutMode = "auto" | "tablet_3pane" | "mobile_stack" | "modal_3pane";
type InitialView = "table_picker" | "composer";
type ReceiptPrintLayout = "thermal" | "thermal58";

function channelLabel(channel: OrderChannel) {
  if (channel === "dine_in") return "Masa";
  if (channel === "pickup") return "Gel-al";
  return "Paket servis";
}

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Boş";
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

function toDisplayItems(cart: CartMap) {
  return Object.values(cart).map((entry) => {
    const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
    const unitPrice = Number(entry.product.price) + modifierTotal;
    return {
      key: entry.key,
      name: entry.product.name,
      quantity: entry.quantity,
      lineTotal: unitPrice * entry.quantity,
    };
  });
}

function normalizeTurkishSearch(text: string): string {
  if (!text) return "";
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i");
}

export function AdminOrderEntry({
  businessSlug,
  categories,
  products,
  modifierGroups,
  modifierOptions,
  tables,
  zones = [],
  businessName,
  branchName,
  initialTableId,
  lockedTableId,
  onOrderCreated,
  onSubmitOrder,
  selfServiceModifierFlow = "auto_default",
  onTableChange,
  mobilePresentation = "default",
  entryMode = "classic",
  layoutMode = "auto",
  initialView = "table_picker",
  operatingProfile = "restaurant_classic",
  operatingCapabilities,
}: {
  businessSlug: string;
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  tables: DiningTable[];
  /** Kroki gorunumundeki bolge sekmeleri. Verilmezse tek "Bölgesiz" sekme. */
  zones?: TableZone[];
  /** Self-servis kasa basligi. Verilmezse notr metne duser. */
  businessName?: string | null;
  branchName?: string | null;
  initialTableId?: string;
  lockedTableId?: string;
  onOrderCreated?: (orderId: string, paymentMethod?: PaymentMethod) => void;
  /** Siparis gonderimini devralir. Verilmezse /api/orders kullanilir. */
  onSubmitOrder?: (payload: OrderSubmitPayload) => Promise<OrderSubmitResult>;
  /**
   * Self-servis modifier akisi.
   *   auto_default -> varsayilanlar secilip urun dogrudan sepete eklenir (eski davranis)
   *   stepped      -> urun/boy/ekler akisi acilir
   */
  selfServiceModifierFlow?: "auto_default" | "stepped";
  onTableChange?: (tableId: string) => void;
  mobilePresentation?: "default" | "stack";
  entryMode?: EntryMode;
  layoutMode?: LayoutMode;
  initialView?: InitialView;
  operatingProfile?: OperatingProfile;
  operatingCapabilities?: OperatingProfileCapabilities;
}) {
  const router = useRouter();
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
        : (entryMode === "table_first" ? "" : (tables[0]?.id ?? "")),
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
  // Musteri ekrani eslestirme vardiyada bir kez yapilan kurulum isi, siparis
  // basina degil. Varsayilan acikken urun izgarasindan once ~150px yer
  // kapliyordu — kasiyer her acilista urune ulasmak icin kaydirmak
  // zorundaydi. Katlanmis baslar, durumu tek satirda gosterir.
  const [displayPairingOpen, setDisplayPairingOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [tablePickerFilter, setTablePickerFilter] = useState<"all" | TableStatus>("all");
  const [tablePickerLayout, setTablePickerLayout] = useState<"liste" | "kroki">("liste");
  const [tablePickerQuery, setTablePickerQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [nextItemMultiplier, setNextItemMultiplier] = useState<number>(1);
  const [receiptPrintLayout, setReceiptPrintLayout] = useState<ReceiptPrintLayout>("thermal");
  const [displaySession, setDisplaySession] = useState<CustomerDisplaySessionRecord | null>(null);
  const [displayCodeCopied, setDisplayCodeCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const displayFreezeUntilRef = useRef(0);
  const isSelfServiceCoffee = operatingProfile === "coffee_self_service";
  // Self-servis kendi kimligini (isletme adi + canli/offline nokta) kendi
  // basligina tasiyor artik — app-shell'in genel "CLOUD POS" cubugu
  // self-servis icin hic render edilmiyor (ikisi ust uste iki baslikti).
  // Bu yuzden kucuk bir yerel online takibi burada da lazim.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    if (!isSelfServiceCoffee) return;
    const apply = () => setIsOnline(navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, [isSelfServiceCoffee]);
  const [catalogSnapshot, setCatalogSnapshot] = useState<CatalogSnapshot | null>(null);

  // Tuketim SATIS ANINDA istemcide donduruluyor (bkz. catalog-consumption.ts).
  // `onSubmitOrder` devralindiginda (or. self-servis kasa) cagiran kendi
  // dondurmasini yapar; bu yalnizca varsayilan /api/orders yolunu besler —
  // masa/kasa siparisleri de reçete stok dusumunu almadan kalmasin diye.
  useEffect(() => {
    if (onSubmitOrder) return;
    const controller = new AbortController();
    void loadCatalog({ signal: controller.signal })
      .then((result) => {
        if (result.status === "empty") return;
        setCatalogSnapshot(result.snapshot);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [onSubmitOrder]);

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

  useEffect(() => {
    if (!isSelfServiceCoffee || typeof window === "undefined") {
      return;
    }
    setDisplaySession(getActiveCustomerDisplaySession());
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CUSTOMER_DISPLAY_SESSIONS_STORAGE_KEY) {
        return;
      }
      setDisplaySession(getActiveCustomerDisplaySession());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isSelfServiceCoffee]);

  // Synchronize state when initialTableId or lockedTableId changes (e.g. browser navigation)
  useEffect(() => {
    const nextTableId = lockedTableId || initialTableId || "";
    setSelectedTableId(nextTableId);
    if (!nextTableId && entryMode === "table_first") {
      setTablePickerView("table_picker");
    } else {
      setTablePickerView("composer");
    }
  }, [initialTableId, lockedTableId, entryMode]);

  // Notify parent of table changes from local user interactions
  useEffect(() => {
    if (selectedTableId !== (initialTableId || "")) {
      if (onTableChange) {
        onTableChange(selectedTableId);
      } else if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/orders")) {
        const params = new URLSearchParams(window.location.search);
        if (selectedTableId) {
          params.set("table", selectedTableId);
        } else {
          params.delete("table");
        }
        router.replace(`/admin/orders?${params.toString()}`);
      }
    }
  }, [selectedTableId, initialTableId, onTableChange, router]);

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
    const query = normalizeTurkishSearch(productSearchQuery);
    if (!query) {
      return visibleProducts;
    }
    return visibleProducts.filter((product) => {
      const name = normalizeTurkishSearch(product.name);
      const description = normalizeTurkishSearch(product.description ?? "");
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
    const query = normalizeTurkishSearch(tablePickerQuery);
    const base = [...tables]
      .sort((left, right) => left.table_number - right.table_number)
      .filter((table) => tablePickerFilter === "all" || table.status === tablePickerFilter);
    if (!query) {
      return base;
    }
    return base.filter((table) => {
      const name = normalizeTurkishSearch(table.name ?? "");
      return name.includes(query) || `masa ${table.table_number}`.includes(query);
    });
  }, [tablePickerFilter, tablePickerQuery, tables]);

  const publishDisplaySnapshot = useCallback(
    (
      input: Omit<CustomerDisplaySnapshot, "sessionId" | "updatedAt">,
      targetSession = displaySession,
    ) => {
      if (!isSelfServiceCoffee || !targetSession) {
        return;
      }
      const snapshot: CustomerDisplaySnapshot = {
        sessionId: targetSession.sessionId,
        updatedAt: Date.now(),
        ...input,
      };
      publishCustomerDisplaySnapshot(targetSession.sessionId, snapshot);
    },
    [displaySession, isSelfServiceCoffee],
  );

  function createDisplayPairCode() {
    const nextSession = createCustomerDisplaySession();
    setDisplaySession(nextSession);
    setDisplayCodeCopied(false);
    publishDisplaySnapshot(
      {
        status: "idle",
        channel,
        customerName: customerName.trim() || null,
        items: toDisplayItems(cart),
        subtotal: total,
        total,
        message: "Bağlantı kuruldu. Sipariş bekleniyor.",
      },
      nextSession,
    );
  }

  async function copyDisplayPairCode() {
    if (!displaySession || typeof navigator === "undefined") {
      return;
    }
    try {
      await navigator.clipboard.writeText(displaySession.pairCode);
      setDisplayCodeCopied(true);
      window.setTimeout(() => setDisplayCodeCopied(false), 1500);
    } catch {
      setDisplayCodeCopied(false);
    }
  }

  function openCustomerDisplay() {
    if (!displaySession || typeof window === "undefined") {
      return;
    }
    window.open(`/customer-display?code=${encodeURIComponent(displaySession.pairCode)}`, "_blank", "noopener,noreferrer");
  }

  function clearDisplaySession() {
    clearActiveCustomerDisplaySession();
    setDisplaySession(null);
    setDisplayCodeCopied(false);
  }

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
      addConfiguredProductWithQuantity(product, [], nextItemMultiplier);
      setNextItemMultiplier(1);
      return;
    }

    if (isSelfServiceCoffee && selfServiceModifierFlow === "stepped") {
      // Boy ve ekler izgarada urunun kendi yerinde acilir (bkz.
      // self-service-modifier-inline.tsx). Varsayilan yoksa zorunlu grupta
      // ilk secenege duser — bos zorunlu grupla acilirsa kullanici hicbir
      // sey secmeden "Sepete Ekle"ye basamaz, ekranda hangi grubun eksik
      // oldugu bile gorunmez.
      const defaults: Record<string, string[]> = {};
      for (const group of groups) {
        const options = optionsByGroup.get(group.id) ?? [];
        const preselected = options.filter((option) => option.is_default).map((option) => option.id);
        const fallback = group.is_required && preselected.length === 0 && options[0] ? [options[0].id] : [];
        defaults[group.id] = (preselected.length > 0 ? preselected : fallback).slice(
          0,
          Math.max(group.max_select, 1),
        );
      }
      setSelectedOptions(defaults);
      setConfiguredQuantity(product.id, nextItemMultiplier);
      setActiveProductId(product.id);
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
      addConfiguredProductWithQuantity(product, modifiers, nextItemMultiplier);
      setNextItemMultiplier(1);
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
    triggerHaptic(40);
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
        setMessage(`${group.name} seçimi zorunlu.`);
        return;
      }
    }

    addConfiguredProductWithQuantity(product, buildModifierSelections(activeProductId), nextItemMultiplier);
    setNextItemMultiplier(1);
  }

  /** Izgara-ici self-servis onayi. `confirmModifiers` gibi ama adet
      `getConfiguredQuantity`den gelir — cip'lerdeki +/- burayi besler. */
  function confirmInlineModifiers(product: Product) {
    const groups = groupsByProduct.get(product.id) ?? [];
    for (const group of groups) {
      const count = (selectedOptions[group.id] ?? []).length;
      if (group.is_required && count < Math.max(1, group.min_select)) {
        return;
      }
    }
    addConfiguredProductWithQuantity(product, buildModifierSelections(product.id), getConfiguredQuantity(product.id));
  }

  function removeProduct(key: string) {
    triggerHaptic(30);
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
    triggerHaptic(40);
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

  function handleReceiptPrint(layout: ReceiptPrintLayout) {
    if (Object.keys(cart).length === 0) {
      setMessageTone("error");
      setMessage("Fiş yazdırmak icin en az bir ürün seç.");
      return;
    }

    setReceiptPrintLayout(layout);
    window.requestAnimationFrame(() => {
      const layoutClass = layout === "thermal58" ? "receipt-print-58" : "receipt-print-80";
      const sizeValue = layout === "thermal58" ? "58mm" : "80mm";
      const styleId = "receipt-print-style-force-composer";
      
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        @media print {
          @page {
            size: ${sizeValue} auto !important;
            margin: 0 !important;
          }
          html, body {
            width: ${sizeValue} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `;

      const clearPrintMode = () => {
        document.body.classList.remove("printing-inline-receipt", "receipt-print-80", "receipt-print-58", "receipt-print-a4");
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };

      clearPrintMode();
      document.body.classList.add("printing-inline-receipt", layoutClass);
      window.addEventListener("afterprint", clearPrintMode, { once: true });
      window.print();
      window.setTimeout(clearPrintMode, 700);
    });
  }

  /**
   * Odeme yontemi cagirana bildirilir.
   *
   * Nakit ve Kart dugmeleri ayni `submitOrder`i cagiriyordu; secim hicbir yere
   * gitmiyordu, ikisi de yalnizca siparis aciyordu. Yontem artik
   * `onOrderCreated`e geciyor ki self-servis kasa odemeyi dogru kaydedebilsin.
   */
  async function submitOrder(paymentMethod?: PaymentMethod) {
    triggerHaptic([50, 30, 50]);
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
    const displayItems = items.map((item, index) => ({
      key: `${item.product_id}-${index}`,
      name: item.name,
      quantity: item.quantity,
      lineTotal: item.line_total,
    }));

    if (items.length === 0) {
      setMessageTone("error");
      setMessage("En az bir ürün seç.");
      return;
    }

    const selectedTable = channel === "dine_in" ? tableById.get(selectedTableId) : null;
    if (channel === "dine_in" && !selectedTable) {
      setMessageTone("error");
      setMessage("Masa seçilmeden sipariş acilamaz.");
      return;
    }

    if (channel !== "dine_in" && !customerName.trim() && !isSelfServiceCoffee) {
      setMessageTone("error");
      setMessage("Müşteri adı gerekli.");
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
      const requestPayload: OrderSubmitPayload = {
        businessSlug,
        channel,
        tableId: channel === "dine_in" ? selectedTable?.id : undefined,
        customerName: customerName.trim() || (isSelfServiceCoffee ? "Self Servis" : undefined),
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        items,
        totalPrice: total,
      };

      // Varsayilan yol degismedi: /api/orders'a POST. `onSubmitOrder` verildiginde
      // gonderim cagirana devredilir — self-servis kasa cevrimdisiyken siparisi
      // IndexedDB kuyruguna yazmak icin bunu kullaniyor.
      const data = onSubmitOrder
        ? await onSubmitOrder(requestPayload)
        : await (async () => {
            const frozenConsumption = catalogSnapshot
              ? freezeCartConsumption(
                  catalogSnapshot,
                  items.map((item) => ({
                    productId: item.product_id,
                    quantity: item.quantity,
                    modifierOptionIds: item.modifiers
                      .map((modifier) => modifier.option_id)
                      .filter((value): value is string => Boolean(value)),
                  })),
                )
              : [];
            const response = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...requestPayload, frozenConsumption }),
            });
            const parsed = (await response.json()) as OrderSubmitResult;
            return response.ok ? parsed : { ...parsed, ok: false };
          })();

      const resolvedCheckNumber =
        typeof data.checkNumber === "string" && data.checkNumber.trim()
          ? data.checkNumber.trim()
          : null;
      if (!data.ok) {
        setMessageTone("error");
        setMessage(data.message ?? "Sipariş açılamadı.");
        displayFreezeUntilRef.current = Date.now() + 10_000;
        publishDisplaySnapshot({
          status: "error",
          channel,
          customerName: customerName.trim() || null,
          items: displayItems,
          subtotal: total,
          total,
          message: data.message ?? "Sipariş açılamadı.",
        });
        return;
      }
      displayFreezeUntilRef.current = Date.now() + 4_000;
      publishDisplaySnapshot({
        status: "created",
        channel,
        customerName: customerName.trim() || null,
        items: displayItems,
        subtotal: total,
        total,
        orderId: data.orderId ?? null,
        checkNumber: resolvedCheckNumber,
        message: resolvedCheckNumber ? `Sipariş alındı: #${resolvedCheckNumber}` : "Sipariş alındı.",
      });
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryNote("");
      setMobileCartOpen(false);
      setMessageTone("success");
      setMessage(resolvedCheckNumber ? `Sipariş açıldı: #${resolvedCheckNumber}` : "Sipariş açıldı.");
      window.dispatchEvent(new Event("live-ops:update"));
      if (data.orderId) {
        if (onOrderCreated) {
          onOrderCreated(data.orderId, paymentMethod);
        } else if (isStackMobile || layoutMode === "mobile_stack") {
          router.push("/m/cashier");
        }
      }
    } catch {
      setMessageTone("error");
      setMessage("Bağlantı hatası oluştu.");
      displayFreezeUntilRef.current = Date.now() + 10_000;
      publishDisplaySnapshot({
        status: "error",
        channel,
        customerName: customerName.trim() || null,
        items: displayItems,
        subtotal: total,
        total,
        message: "Bağlantı hatası oluştu.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const activeProduct = activeProductId ? productById.get(activeProductId) ?? null : null;
  const cartEntries = Object.values(cart);
  const cartCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const receiptTitle =
    channel === "dine_in"
      ? (selectedTable?.name || (selectedTable ? `Masa ${selectedTable.table_number}` : "Masa seçilmedi"))
      : channelLabel(channel);
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
    const query = normalizeTurkishSearch(productSearchQuery);
    if (!query) {
      return onlyActive;
    }
    return onlyActive.filter((product) => {
      const name = normalizeTurkishSearch(product.name);
      const description = normalizeTurkishSearch(product.description ?? "");
      return name.includes(query) || description.includes(query);
    });
  }, [allCategoryId, orderedCategories, productSearchQuery, products, selectedCategoryId]);

  useEffect(() => {
    if (!isSelfServiceCoffee || !displaySession) {
      return;
    }
    if (!submitting && Date.now() < displayFreezeUntilRef.current) {
      return;
    }

    publishDisplaySnapshot({
      status: submitting ? "submitting" : "composing",
      channel,
      customerName: customerName.trim() || null,
      items: toDisplayItems(cart),
      subtotal: total,
      total,
      message: submitting
        ? "Sipariş aciliyor..."
        : cartCount > 0
          ? "Kasiyer siparişi hazırliyor."
          : "Ürün seçimi bekleniyor.",
    });
  }, [cart, cartCount, channel, customerName, displaySession, isSelfServiceCoffee, publishDisplaySnapshot, submitting, total]);

  useEffect(() => {
    if (!isSelfServiceCoffee || !displaySession) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      if (!submitting && Date.now() < displayFreezeUntilRef.current) {
        return;
      }
      publishDisplaySnapshot({
        status: submitting ? "submitting" : "composing",
        channel,
        customerName: customerName.trim() || null,
        items: toDisplayItems(cart),
        subtotal: total,
        total,
        message: submitting
          ? "Sipariş aciliyor..."
          : cartCount > 0
            ? "Kasiyer siparişi hazırliyor."
            : "Ürün seçimi bekleniyor.",
      });
    }, 3000);

    return () => window.clearInterval(heartbeat);
  }, [cart, cartCount, channel, customerName, displaySession, isSelfServiceCoffee, publishDisplaySnapshot, submitting, total]);

  if (isSelfServiceCoffee) {
    return (
      <>
        {/* Genis/kucuk gorunum secimi burada `ss-kiosk-*` ile SALT ekran
            genisligine bagli — `app-mobile-*`'in aksine, kiosk modunun
            (sol menuyu gizleyen `.mobile-app-mode`) yan etkisi olmasin diye.
            Ikisi ayni CSS sinifina baglanirsa genis bir kiosk tabletinde
            sol menu gizlenirken YANLIŞLIKLA telefon duzenine (2 kolon +
            yuzen sepet) de duserdi; fiyat/sepet paneli kaybolur, kullanici
            "yonetimden koptu" hisseder. */}
        <section className="ss-kiosk-hide flex flex-1 min-h-0 flex-col overflow-x-clip rounded-[26px] border border-[#e7dcd7] bg-white text-[#241a17] shadow-[0_20px_50px_rgba(36,26,23,0.08)]">
          {/* Acik tema: koyu M3 versiyonu ekranda test edildikten sonra
              "aciksa tamam" denildi. Iki bilincli sapma hala geçerli: (1)
              "Seç" CTA'si hover-only degil hep gorunur (dokunmatikte hover
              yok). (2) Ust cubuktaki Ürün→Boy→Ekstra seridi dekoratif bir
              lejant — gercek, urune-ozel adim durumu SelfServiceModifierInline
              icindeki (artik grup-grup ilerleyen) buyuk numarali seritte. */}
          <header className="relative grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-[#e7dcd7] bg-white px-6">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/ops"
                className="group flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#e8502f] transition hover:text-[#d1441f]"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Panele Dön
              </Link>
              <div className="h-6 w-px shrink-0 bg-[#e7dcd7]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}
                    aria-hidden="true"
                  />
                  <p className="truncate text-lg font-black leading-tight text-[#241a17]">{businessName ?? "Self Servis"}</p>
                </div>
                <p className="truncate text-[11px] uppercase tracking-widest text-[#8a7a74]">{branchName ?? "Hızlı ve Lezzetli"}</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8a9a3] lg:flex" aria-hidden="true">
              <span>Ürün</span>
              <ChevronRight className="h-3.5 w-3.5 text-[#d8c8c2]" />
              <span>Boy</span>
              <ChevronRight className="h-3.5 w-3.5 text-[#d8c8c2]" />
              <span>Ekstra</span>
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a74]">Sipariş Sayısı</p>
                <p className="text-lg font-bold text-[#e8502f]">{cartCount}</p>
              </div>
              <button
                type="button"
                onClick={() => setDisplayPairingOpen((prev) => !prev)}
                aria-expanded={displayPairingOpen}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
                  displaySession
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-[#e7dcd7] text-[#8a7a74] hover:border-[#8a7a74]/50"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${displaySession ? "bg-emerald-500" : "bg-[#d8c8c2]"}`}
                  aria-hidden="true"
                />
                <MonitorSmartphone className="h-4 w-4" />
                Müşteri Ekranı
              </button>
            </div>
          </header>

          {displayPairingOpen ? (
            <div className="border-b border-[#e7dcd7] bg-[#faf6f4] px-6 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  onClick={createDisplayPairCode}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Kod Uret
                </button>
                <button
                  type="button"
                  onClick={openCustomerDisplay}
                  disabled={!displaySession}
                  className="rounded-xl border border-[#e7dcd7] bg-white px-4 py-2 text-sm font-semibold text-[#241a17] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Müşteri Ekranini Ac
                </button>
                <button
                  type="button"
                  onClick={copyDisplayPairCode}
                  disabled={!displaySession}
                  className="rounded-xl border border-[#e7dcd7] bg-white px-4 py-2 text-sm font-semibold text-[#241a17] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {displayCodeCopied ? "Kopyalandi" : "Kodu Kopyala"}
                </button>
                <button
                  type="button"
                  onClick={clearDisplaySession}
                  disabled={!displaySession}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eslestirmeyi Temizle
                </button>
                {displaySession ? (
                  <span className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black tracking-[0.14em] text-emerald-700">
                    {displaySession.pairCode}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[#8a7a74]">
                10.1&quot; ekranda <span className="font-semibold text-[#241a17]">/customer-display</span> acip bu kod ile baglanin.
              </p>
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_min(360px,30vw)] grid-rows-[1fr]">
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="flex shrink-0 flex-col gap-3 border-b border-[#e7dcd7] px-5 pb-4 pt-5">
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(allCategoryId)}
                    className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                      selectedCategoryId === allCategoryId
                        ? "border-transparent bg-[#e8502f] text-white"
                        : "border-[#e7dcd7] bg-transparent text-[#8a7a74] hover:border-[#8a7a74]/50"
                    }`}
                  >
                    Tümu
                  </button>
                  {orderedCategories.map((category) => {
                    const selected = selectedCategoryId === category.id;
                    return (
                      <button
                        key={`self-service-category-${category.id}`}
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                          selected
                            ? "border-transparent bg-[#e8502f] text-white"
                            : "border-[#e7dcd7] bg-transparent text-[#8a7a74] hover:border-[#8a7a74]/50"
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7a74]/70" />
                  <input
                    ref={searchInputRef}
                    value={productSearchQuery}
                    onChange={(event) => setProductSearchQuery(event.target.value)}
                    placeholder="Ürün ara... (Ctrl+K)"
                    className="h-12 w-full rounded-2xl border border-[#e7dcd7] bg-white pl-11 pr-4 text-sm text-[#241a17] placeholder:text-[#8a7a74]/60 focus:border-[#e8502f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
                {selfServiceProducts.length === 0 ? (
                  <p className="rounded-2xl border border-[#e7dcd7] bg-[#faf6f4] px-4 py-5 text-sm text-[#8a7a74]">
                    Bu filtrede aktif ürün yok.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {selfServiceProducts.map((product) => {
                      const productGroups = groupsByProduct.get(product.id) ?? [];
                      const isExpanded =
                        isSelfServiceCoffee &&
                        selfServiceModifierFlow === "stepped" &&
                        activeProductId === product.id &&
                        productGroups.length > 0;

                      // Genisleyen kart tum satiri kaplar: ekranin geri kalani
                      // gorunur kalsin diye — modal degil, izgaranin kendisi.
                      if (isExpanded) {
                        return (
                          <div key={`self-service-product-${product.id}`} className="sm:col-span-2 xl:col-span-4">
                            <SelfServiceModifierInline
                              product={product}
                              groups={productGroups}
                              optionsByGroup={optionsByGroup}
                              selected={selectedOptions}
                              onToggle={toggleOption}
                              quantity={getConfiguredQuantity(product.id)}
                              onQuantityChange={(quantity) => setConfiguredQuantity(product.id, quantity)}
                              onCancel={() => {
                                setActiveProductId(null);
                                setSelectedOptions({});
                              }}
                              onConfirm={() => confirmInlineModifiers(product)}
                            />
                          </div>
                        );
                      }

                      return (
                        <article
                          key={`self-service-product-${product.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openModifierPicker(product)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openModifierPicker(product);
                            }
                          }}
                          className="flex h-[168px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#e7dcd7] bg-white p-4 text-left transition hover:border-[#e8502f]/40 hover:bg-[#fff8f6] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8502f]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5efec] text-xs font-black text-[#241a17]">
                              {product.name.slice(0, 2).toUpperCase()}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openModifierPicker(product);
                              }}
                              className="shrink-0 rounded-full bg-[#e8502f] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#d1441f]"
                            >
                              {productGroups.length > 0 ? "Seç" : "Ekle"}
                            </button>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-[#241a17]">{product.name}</p>
                            <p className="mt-1 text-xl font-black tracking-tight text-[#e8502f]">₺{Number(product.price).toFixed(2)}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside className="flex min-w-0 flex-col border-l border-[#e7dcd7] bg-[#faf6f4]">
              <div className="flex items-center justify-between border-b border-[#e7dcd7] px-5 py-5">
                <div>
                  <p className="text-2xl font-black tracking-tight text-[#241a17]">Siparişim</p>
                  <p className="mt-1 text-sm text-[#8a7a74]">Toplam Ürün: {cartCount}</p>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-xl border border-[#e7dcd7] bg-white px-3 py-2 text-xs font-semibold text-[#241a17] hover:bg-[#f5efec]"
                >
                  Temizle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {cartEntries.length === 0 ? (
                  <div className="mt-16 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#e7dcd7] bg-white">
                      <ShoppingBasket className="h-7 w-7 text-[#8a7a74]" />
                    </div>
                    <p className="text-sm text-[#8a7a74]">Ürün eklemek icin soldan seç.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartEntries.map((entry) => {
                      const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                      return (
                        <article key={`self-service-cart-${entry.key}`} className="rounded-xl border border-[#e7dcd7] bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[#241a17]">{entry.product.name}</p>
                              <p className="text-sm text-[#8a7a74]">₺{(Number(entry.product.price) + modifierTotal).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeProduct(entry.key)}
                                className="h-8 w-8 rounded-lg bg-[#f5efec] text-sm font-bold text-[#241a17] hover:bg-[#e7dcd7]"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-[#241a17]">{entry.quantity}</span>
                              <button
                                type="button"
                                onClick={() => increaseProduct(entry.key)}
                                className="h-8 w-8 rounded-lg bg-[#f5efec] text-sm font-bold text-[#241a17] hover:bg-[#e7dcd7]"
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

              <div className="border-t border-[#e7dcd7] bg-white px-5 py-5">
                <div className="flex items-center justify-between text-sm text-[#8a7a74]">
                  <span>Ara Toplam</span>
                  <span className="font-semibold text-[#241a17]">₺{total.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-lg font-bold text-[#241a17]">Toplam</p>
                  <p className="text-3xl font-black tracking-tight text-[#e8502f]">₺{total.toFixed(2)}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => submitOrder("cash")}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#e8502f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#d1441f] disabled:opacity-50"
                  >
                    <Banknote className="h-4 w-4" />
                    Nakit
                  </button>
                  <button
                    type="button"
                    onClick={() => submitOrder("card")}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-[#e7dcd7] bg-white px-4 py-3 text-sm font-bold text-[#241a17] transition hover:bg-[#f5efec] disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Kart
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Alt bosluk asagidaki "Floating Cart Dock"u karsilamak icin var;
            eskiden buna ek olarak app-shell'in self-servis icin artik hic
            render edilmeyen alt Home/Actions cubugunu da (~64-88px) karsilamasi
            gerekiyordu (190/164), o pay artik dusuldu (128/104). */}
        <div className={`ss-kiosk-only space-y-3 ${isStackMobile ? "pb-[calc(128px+var(--safe-area-bottom))]" : "pb-[calc(104px+var(--safe-area-bottom))]"}`}>
          {/* Mobile Self-Service: Baslik. Masaustu bolumun aksine bunun hic
              basligi yoktu — app-shell'in genel ust cubugu buraya kimlik
              saglardi. O cubuk artik self-servis icin hic render edilmiyor
              (iki ust uste baslikti), o yuzden bu satir olmadan telefon
              genisliginde isletme adi/canli durumu hicbir yerde gorunmezdi.
              Masaustu bolumle ayni acik tema tokenlari: m-card/m-segment-pill
              kasitli kullanilmiyor, cunku .coffee-pos-mode CSS'i onlari koyu
              temaya geri cekiyor. */}
          <div className="flex items-center gap-2 px-1">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}
              aria-hidden="true"
            />
            <p className="truncate text-sm font-bold text-[#241a17]">{businessName ?? "Self Servis"}</p>
          </div>

          {/* Mobile Self-Service: Search */}
          <div className="rounded-2xl border border-[#e7dcd7] bg-white p-1 space-y-1">
            <input
              ref={searchInputRef}
              value={productSearchQuery}
              onChange={(event) => setProductSearchQuery(event.target.value)}
              placeholder="Ürün ara..."
              className="h-11 w-full rounded-xl border-0 bg-[#f5efec] px-4 text-sm text-[#241a17] placeholder:text-[#8a7a74] focus:outline-none focus:ring-1 focus:ring-[#e8502f]/50"
            />
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-[#e7dcd7] pt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7a74]">Çarpan:</span>
                <div className="flex rounded-lg bg-[#f5efec] p-0.5">
                  {[1, 2, 3, 4, 5, 10].map((num) => {
                    const isActive = nextItemMultiplier === num;
                    return (
                      <button
                        key={`mob-multiplier-${num}`}
                        type="button"
                        onClick={() => setNextItemMultiplier(num)}
                        className={`h-7 px-2.5 rounded-md text-[10px] font-black transition-all ${
                          isActive
                            ? "bg-[#e8502f] text-white shadow-sm"
                            : "text-[#8a7a74] hover:text-[#241a17]"
                        }`}
                      >
                        {num}x
                      </button>
                    );
                  })}
                </div>
              </div>
              {nextItemMultiplier > 1 && (
                <button
                  type="button"
                  onClick={() => setNextItemMultiplier(1)}
                  className="text-[10px] font-semibold text-[#e8502f]"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Mobile Self-Service: Category Chips */}
          <div className="ss-mobile-category-rail overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <div className="flex min-w-max gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(allCategoryId)}
                className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                  selectedCategoryId === allCategoryId
                    ? "border-transparent bg-[#e8502f] text-white"
                    : "border-[#e7dcd7] bg-white text-[#8a7a74]"
                }`}
              >
                Tümü
              </button>
              {orderedCategories.map((category) => {
                const selected = selectedCategoryId === category.id;
                return (
                  <button
                    key={`ss-mobile-cat-${category.id}`}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                      selected
                        ? "border-transparent bg-[#e8502f] text-white"
                        : "border-[#e7dcd7] bg-white text-[#8a7a74]"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Self-Service: Product Grid */}
          {selfServiceProducts.length === 0 ? (
            <div className="rounded-2xl border border-[#e7dcd7] bg-[#faf6f4] px-4 py-8 text-center text-sm text-[#8a7a74]">
              Bu filtrede aktif ürün yok.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {selfServiceProducts.map((product) => {
                const productGroups = groupsByProduct.get(product.id) ?? [];
                const isExpanded =
                  isSelfServiceCoffee &&
                  selfServiceModifierFlow === "stepped" &&
                  activeProductId === product.id &&
                  productGroups.length > 0;

                if (isExpanded) {
                  return (
                    <div key={`ss-mobile-product-${product.id}`} className="col-span-2">
                      <SelfServiceModifierInline
                        product={product}
                        groups={productGroups}
                        optionsByGroup={optionsByGroup}
                        selected={selectedOptions}
                        onToggle={toggleOption}
                        quantity={getConfiguredQuantity(product.id)}
                        onQuantityChange={(quantity) => setConfiguredQuantity(product.id, quantity)}
                        onCancel={() => {
                          setActiveProductId(null);
                          setSelectedOptions({});
                        }}
                        onConfirm={() => confirmInlineModifiers(product)}
                      />
                    </div>
                  );
                }

                return (
                  <article
                    key={`ss-mobile-product-${product.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openModifierPicker(product)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openModifierPicker(product);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-[#e7dcd7] bg-white p-3.5 transition active:scale-[0.98] hover:border-[#e8502f]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8502f]"
                  >
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f5efec] text-[11px] font-black text-[#241a17]">
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="line-clamp-2 text-[0.92rem] font-semibold leading-tight text-[#241a17]">{product.name}</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-[#e8502f]">₺{Number(product.price).toFixed(2)}</p>
                  </article>
                );
              })}
            </div>
          )}

          {/* Mobile Self-Service: Message */}
          {message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                messageTone === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : messageTone === "error"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-[#e7dcd7] bg-[#faf6f4] text-[#8a7a74]"
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>

        {/* Mobile Self-Service: Cart Panel (full screen) */}
        {mobileCartOpen ? (
          <div className="ss-kiosk-only fixed inset-0 z-[70] bg-black/30">
            <div className="absolute inset-0 overflow-y-auto bg-[#faf6f4] px-3 pb-[calc(96px+var(--safe-area-bottom))] pt-[calc(72px+var(--safe-area-top))]">
              <header className="sticky top-0 z-10 rounded-2xl border border-[#e7dcd7] bg-white/98 px-4 py-3 shadow-[0_8px_20px_rgba(36,26,23,0.1)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a7a74]">Siparişim</p>
                    <h2 className="mt-1 text-lg font-bold text-[#241a17]">{cartCount} ürün</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileCartOpen(false)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#e7dcd7] bg-white px-4 text-sm font-semibold text-[#241a17]"
                  >
                    Kapat
                  </button>
                </div>
              </header>

              <div className="mt-3 space-y-2">
                {cartEntries.length === 0 ? (
                  <p className="rounded-xl border border-[#e7dcd7] bg-white px-4 py-6 text-center text-sm text-[#8a7a74]">Sepet boş.</p>
                ) : (
                  cartEntries.map((entry) => {
                    const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                    return (
                      <div key={`ss-mobile-cart-${entry.key}`} className="relative overflow-hidden rounded-xl bg-red-500">
                        <div className="absolute inset-y-0 right-4 flex items-center text-white font-bold text-xs pointer-events-none">
                          <span>Sil</span>
                        </div>
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: -100, right: 0 }}
                          dragElastic={{ left: 0.2, right: 0 }}
                          onDragEnd={(event, info) => {
                            if (info.offset.x < -70) {
                              removeProduct(entry.key);
                            }
                          }}
                          className="rounded-xl border border-[#e7dcd7] bg-white px-4 py-3 relative z-10 w-full"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-[#241a17]">{entry.product.name}</p>
                              <p className="mt-1 text-sm text-[#8a7a74]">₺{(Number(entry.product.price) + modifierTotal).toFixed(2)}</p>
                              {entry.modifiers.length > 0 ? (
                                <p className="mt-1 text-xs text-[#b8a9a3]">{entry.modifiers.map((m) => m.option_name).join(", ")}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeProduct(entry.key)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5efec] text-sm font-bold text-[#241a17]"
                              >
                                -
                              </button>
                              <span className="w-7 text-center text-sm font-bold text-[#241a17]">{entry.quantity}</span>
                              <button
                                type="button"
                                onClick={() => increaseProduct(entry.key)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5efec] text-sm font-bold text-[#241a17]"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })
                )}
              </div>

              {cartEntries.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-[#e7dcd7] bg-white px-4 py-4">
                  <div className="flex items-center justify-between text-sm text-[#8a7a74]">
                    <span>Ara Toplam</span>
                    <span>₺{total.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-2xl font-black tracking-tight text-[#e8502f]">Toplam</p>
                    <p className="text-2xl font-black tracking-tight text-[#e8502f]">₺{total.toFixed(2)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => submitOrder("cash")} disabled={submitting} className="rounded-2xl bg-[#e8502f] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60">
                      {submitting ? "İşleniyor..." : "Nakit"}
                    </button>
                    <button type="button" onClick={() => submitOrder("card")} disabled={submitting} className="rounded-2xl border border-[#e7dcd7] bg-white px-4 py-3.5 text-sm font-bold text-[#241a17] disabled:opacity-60">
                      {submitting ? "İşleniyor..." : "Kart"}
                    </button>
                  </div>
                  <button type="button" onClick={clearCart} className="mt-3 w-full rounded-xl border border-[#e7dcd7] bg-white px-4 py-2.5 text-xs font-semibold text-[#8a7a74]">
                    Sepeti Temizle
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Mobile Self-Service: Floating Cart Dock. Onceki 72-74px, altta
            artik render edilmeyen app-shell Home/Actions cubugunu (ve onun
            kendi guvenli-alan payini) karsilamak icindi; simdi sadece kucuk
            bir nefes payi + guvenli alan yeterli. */}
        <div
          className={`ss-kiosk-only fixed inset-x-0 z-40 px-3`}
          style={{ bottom: "calc(12px + var(--safe-area-bottom))" }}
        >
          <div className="rounded-2xl border border-[#e7dcd7] bg-white p-3 shadow-[0_12px_30px_rgba(36,26,23,0.14)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a7a74]">Sipariş</p>
                <p className="mt-1 text-sm font-bold text-[#241a17]">{cartCount} kalem • ₺{total.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                className="rounded-xl bg-[#e8502f] px-4 py-2.5 text-sm font-bold text-white"
              >
                Sepeti Aç
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (entryMode === "table_first") {
    const isTerminal = layoutMode === "tablet_3pane" || layoutMode === "mobile_stack";
    const isModalThreePane = layoutMode === "modal_3pane";
    const useThreePaneLayout = isTerminal || isModalThreePane;
    const tableFirstSectionClassName = isTerminal
      ? "fixed top-[calc(68px+var(--safe-area-top))] bottom-[calc(64px+var(--safe-area-bottom))] md:top-0 md:bottom-0 inset-x-0 z-30 md:z-50 bg-[#f1f5f9] p-3 sm:p-4"
      : "space-y-4 min-w-0";

    return (
      <>
      <section className={tableFirstSectionClassName}>
        {tablePickerView === "table_picker" ? (
          <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-y-auto ${isModalThreePane ? "max-h-[70vh]" : "h-full"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Masa Seçimi</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Siparişe Baslamak Icin Masa Seç</h2>
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
                      {(status === "all" ? "Tümu" : tableStatusLabel(status))} ({tableStats[status]})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={tablePickerQuery}
                onChange={(event) => setTablePickerQuery(event.target.value)}
                placeholder="Masa ara (ad veya numara)"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              {/* Garson salonu isimle degil yerle hatirlar; kroki gorunumu
                  /admin/tables/floor-plan'daki yerlesimi birebir gosterir. */}
              <div className="flex shrink-0 gap-1 rounded-xl border border-slate-300 bg-slate-50 p-1">
                {(["liste", "kroki"] as const).map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setTablePickerLayout(layout)}
                    className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                      tablePickerLayout === layout ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {layout === "liste" ? "Liste" : "Kroki"}
                  </button>
                ))}
              </div>
            </div>

            {tablePickerLayout === "kroki" ? (
              <div className="mt-4">
                <TablePickerFloorPlan
                  tables={filteredTables}
                  zones={zones}
                  selectedTableId={selectedTableId}
                  onSelect={(tableId) => {
                    setSelectedTableId(tableId);
                    setChannel("dine_in");
                    setTablePickerView("composer");
                  }}
                />
              </div>
            ) : filteredTables.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Bu filtrede masa bulunamadı.
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
        ) : useThreePaneLayout ? (
          /* Specialized Terminal 3-Pane UI */
          <div className={`relative flex min-h-0 flex-col gap-4 overflow-hidden ${isTerminal ? "h-full" : ""}`}>
             {/* Header */}
             <header className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                   <button 
                      type="button" 
                      onClick={() => setTablePickerView("table_picker")}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                   </button>
                   <div>
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 line-clamp-1">
                         {channel === "dine_in" ? (selectedTable?.name || `Masa ${selectedTable?.table_number}`) : channelLabel(channel)}
                      </h1>
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-widest">{businessSlug}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                   {isTerminal ? (
                     <>
                       <div className="hidden items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex">
                          <button
                             type="button"
                             onClick={() => handleReceiptPrint("thermal")}
                             disabled={cartEntries.length === 0}
                             className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                             <span>80mm</span>
                          </button>
                          <button
                             type="button"
                             onClick={() => handleReceiptPrint("thermal58")}
                             disabled={cartEntries.length === 0}
                             className="inline-flex h-10 items-center rounded-lg px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                             58mm
                          </button>
                       </div>
                       <Link
                          href="/cashier"
                          className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-4 sm:px-5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                          <span className="hidden sm:inline">Kasiyer Paneli</span>
                          <span className="sm:hidden">Kasa</span>
                       </Link>
                     </>
                   ) : (
                     <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                       Modal Sipariş Akışi
                     </p>
                   )}
                </div>
             </header>

             {/* Main Content Area */}
             <div className={`flex-1 min-h-0 grid gap-4 overflow-hidden ${
                isTerminal 
                ? "grid-cols-1 md:grid-cols-[220px_1fr_380px]" 
                : "grid-cols-1 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.25fr)_minmax(280px,0.9fr)]"
             }`}>
                {/* Categories Column */}
                <aside className={`min-w-0 overflow-y-auto rounded-2xl p-3 shadow-sm border ${
                   isTerminal 
                   ? "hidden md:block bg-white/60 border-white backdrop-blur-md" 
                   : "hidden lg:block bg-white border-slate-100"
                }`}>
                   <div className={isTerminal ? "space-y-2" : "flex flex-wrap gap-2"}>
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
                               className={`${isTerminal ? "w-full min-h-[64px] p-3 text-left" : "min-h-[44px] whitespace-nowrap px-4 py-2.5 text-sm font-semibold"} rounded-xl transition-all relative overflow-hidden group ${
                                  isActive 
                                  ? `bg-gradient-to-br ${colorClass} text-white shadow-lg ring-2 ring-offset-2 ring-slate-200` 
                                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-100"
                               }`}
                            >
                               <span className="relative z-10 font-bold text-sm">{category.name}</span>
                               {isTerminal ? (
                                 <span className={`absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform ${isActive ? "text-white" : "text-slate-900"}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.5V4a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H8"/></svg>
                                 </span>
                               ) : null}
                            </button>
                         );
                      })}
                   </div>
                </aside>

                {/* Products Column */}
                <section className="min-w-0 flex flex-col gap-4 overflow-hidden">
                   {/* Mobile Category Horizontal Scroll */}
                   <div className={`mobile-terminal-category-rail shrink-0 overflow-x-auto pb-1 -mx-1 px-1 ${isTerminal ? "md:hidden" : "lg:hidden"}`}>
                      <div className="flex gap-2 min-w-max">
                         {orderedCategories.map((category) => {
                            const isActive = category.id === activeCategoryId;
                            return (
                               <button
                                  key={`mob-cat-${category.id}`}
                                  type="button"
                                  onClick={() => setSelectedCategoryId(category.id)}
                                  data-active={isActive}
                                  className="mobile-terminal-category-chip whitespace-nowrap"
                               >
                                  {category.name}
                               </button>
                            );
                         })}
                      </div>
                   </div>

                    <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100 shrink-0 space-y-3">
                       <div className="relative">
                          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          <input
                             ref={searchInputRef}
                             autoFocus
                             value={productSearchQuery}
                             onChange={(event) => setProductSearchQuery(event.target.value)}
                             placeholder="Ürün Ara... (Ctrl+K)"
                             className="h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-sm font-medium border-none focus:ring-2 focus:ring-slate-900"
                          />
                       </div>
                       
                       <div className="flex items-center justify-between border-t border-slate-100 pt-3 flex-wrap gap-2">
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Adet Çarpanı:</span>
                           <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                             {[1, 2, 3, 4, 5, 10].map((num) => {
                               const isActive = nextItemMultiplier === num;
                               return (
                                 <button
                                   key={`multiplier-${num}`}
                                   type="button"
                                   onClick={() => setNextItemMultiplier(num)}
                                   className={`h-9 px-3.5 rounded-lg text-xs font-black transition-all ${
                                     isActive
                                       ? "bg-slate-900 text-white shadow-sm"
                                       : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                   }`}
                                 >
                                   {num}x
                                 </button>
                               );
                             })}
                           </div>
                         </div>
                         {nextItemMultiplier > 1 && (
                           <div className="flex items-center gap-2 animate-pulse">
                             <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff5a34]" />
                             <span className="text-xs font-bold text-[#ff5a34]">Sonraki ürün {nextItemMultiplier} adet eklenecek</span>
                             <button
                               type="button"
                               onClick={() => setNextItemMultiplier(1)}
                               className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline ml-1"
                             >
                               Sıfırla
                             </button>
                           </div>
                         )}
                       </div>
                    </div>
                   
                   <div className={`mobile-terminal-products flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm border border-slate-100 ${
                      cartEntries.length > 0 ? "pb-24 md:pb-4" : ""
                   }`}>
                      {filteredVisibleProducts.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <p className="text-sm font-medium">Bu kategoride ürün bulunamadı.</p>
                         </div>
                      ) : (
                         <div className="mobile-terminal-product-grid grid gap-3 grid-cols-2 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredVisibleProducts.map((product) => (
                               <button
                                  key={`term-prod-${product.id}`}
                                  type="button"
                                  onClick={() => openModifierPicker(product)}
                                  className="mobile-terminal-product-card group flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-4 text-left transition-all hover:border-emerald-200 hover:shadow-md active:scale-95"
                                >
                                  <h3 className="font-bold text-slate-900 group-hover:text-slate-950 transition-colors line-clamp-2 min-h-[40px] text-xs sm:text-sm">{product.name}</h3>
                                  <div className="mt-auto flex w-full items-end justify-between gap-2 pt-3">
                                     <div className="min-w-0">
                                        {(groupsByProduct.get(product.id) ?? []).length > 0 ? (
                                          <span className="mobile-terminal-option-dot">Ops</span>
                                        ) : null}
                                        <p className="mobile-terminal-product-price text-base sm:text-lg font-black text-slate-900">
                                          {Number(product.price).toFixed(2)} <span className="text-[10px] sm:text-xs font-medium text-slate-500">TL</span>
                                        </p>
                                     </div>
                                     <div className="mobile-terminal-add-icon h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
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
                <aside className={`min-w-0 flex flex-col rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden ${
                   isTerminal ? "hidden md:flex" : "hidden lg:flex"
                }`}>
                   <div className="bg-slate-900 p-4 text-white">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold uppercase tracking-widest opacity-60">Sipariş Detayi</span>
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
                            <p>Henüz ürün eklenmedi</p>
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
                         onClick={() => submitOrder()}
                         className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all"
                      >
                         {submitting ? "ISLENIYOR..." : "SİPARİŞİ TAMAMLA"}
                      </button>
                   </div>
                </aside>
             </div>

             {/* Mobile Floating Cart Summary Bar */}
             {cartEntries.length > 0 && (
                <div className={`mobile-terminal-cart-bar absolute bottom-0 inset-x-0 z-[90] bg-white border-t border-slate-200 p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] flex items-center justify-between ${
                   isTerminal ? "md:hidden" : "lg:hidden"
                }`}>
                   <button 
                      type="button"
                      onClick={() => setMobileCartOpen(true)}
                      className="mobile-terminal-cart-summary flex items-center gap-3 text-left focus:outline-none"
                   >
                      <div className="mobile-terminal-cart-icon relative h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                         <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center ring-2 ring-white">
                            {cartCount}
                         </span>
                      </div>
                      <div>
                         <span className="mobile-terminal-cart-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sepet</span>
                         <span className="mobile-terminal-cart-total text-base font-black text-slate-900">{total.toFixed(2)} TL</span>
                      </div>
                   </button>
                   <div className="mobile-terminal-cart-actions flex gap-2">
                      <button
                         type="button"
                         onClick={() => setMobileCartOpen(true)}
                         className="mobile-terminal-cart-button mobile-terminal-cart-button-secondary h-12 px-4 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
                      >
                         Sepeti Aç
                      </button>
                      <button
                         type="button"
                         disabled={submitting}
                         onClick={() => submitOrder()}
                         className="mobile-terminal-cart-button mobile-terminal-cart-button-primary h-12 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-50"
                      >
                         {submitting ? "..." : "Tamamla"}
                      </button>
                   </div>
                </div>
             )}

             {/* Mobile Cart Overlay Drawer */}
             {mobileCartOpen && (
                <div className={`absolute inset-0 z-[150] bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200 ${
                   isTerminal ? "md:hidden" : "lg:hidden"
                }`}>
                   <div className="absolute inset-x-0 bottom-0 top-16 rounded-t-[32px] bg-[#f8fafc] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                      <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                         <div>
                            <span className="text-xs font-bold uppercase tracking-widest opacity-60">Sipariş Detayi</span>
                            <div className="mt-1 flex items-baseline gap-1">
                               <span className="text-2xl font-black">{total.toFixed(2)}</span>
                               <span className="text-sm font-bold opacity-60">TL</span>
                            </div>
                         </div>
                         <button 
                            type="button" 
                            onClick={() => setMobileCartOpen(false)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-transform"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                         </button>
                      </header>

                      {/* Cart List */}
                      <div className="flex-1 overflow-y-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/paper.png')]">
                         {cartEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 italic">
                               <p>Henüz ürün eklenmedi</p>
                            </div>
                         ) : (
                            <div className="space-y-4">
                               {cartEntries.map((entry) => {
                                  const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                                  const itemTotal = (Number(entry.product.price) + modifierTotal) * entry.quantity;
                                  return (
                                     <div key={`mobile-drawer-cart-${entry.key}`} className="relative overflow-hidden rounded-xl bg-rose-600 my-1">
                                        <div className="absolute inset-y-0 right-4 flex items-center text-white font-bold text-xs pointer-events-none">
                                           <span>Sil</span>
                                        </div>
                                        <motion.div
                                           drag="x"
                                           dragConstraints={{ left: -100, right: 0 }}
                                           dragElastic={{ left: 0.2, right: 0 }}
                                           onDragEnd={(event, info) => {
                                              if (info.offset.x < -70) {
                                                 removeProduct(entry.key);
                                              }
                                           }}
                                           className="bg-white p-3 rounded-xl border border-slate-200 relative z-10 w-full"
                                        >
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
                                           <div className="mt-3 flex items-center gap-2">
                                              <button 
                                                 type="button"
                                                 onClick={() => removeProduct(entry.key)} 
                                                 className="h-9 w-9 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-700 font-bold active:scale-90 transition-transform"
                                              >
                                                 -
                                              </button>
                                              <button 
                                                 type="button"
                                                 onClick={() => increaseProduct(entry.key)} 
                                                 className="h-9 w-9 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-700 font-bold active:scale-90 transition-transform"
                                              >
                                                 +
                                              </button>
                                           </div>
                                        </motion.div>
                                     </div>
                                  );
                               })}
                            </div>
                         )}
                      </div>

                      {/* Checkout Button */}
                      <div className="p-6 bg-white border-t border-slate-200 space-y-4 shrink-0 pb-6">
                         <div className="flex justify-between items-center text-slate-900 font-bold">
                            <span>TOPLAM</span>
                            <span className="text-xl">{total.toFixed(2)} TL</span>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <button
                               type="button"
                               onClick={clearCart}
                               className="h-14 rounded-2xl border border-slate-200 text-slate-600 font-bold active:scale-95 transition-transform"
                            >
                               TEMİZLE
                            </button>
                            <button
                               type="button"
                               disabled={submitting || cartEntries.length === 0}
                               onClick={async () => {
                                  await submitOrder();
                                }}
                               className="h-14 rounded-2xl bg-emerald-600 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                            >
                               {submitting ? "İşleniyor..." : "SİPARİŞİ TAMAMLA"}
                            </button>

                         </div>
                      </div>
                   </div>
                </div>
             )}

             {/* Modals for modifiers */}
             {activeProduct &&
             !(isSelfServiceCoffee && selfServiceModifierFlow === "stepped") &&
             (groupsByProduct.get(activeProduct.id) ?? []).length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                   <article className="w-full max-w-2xl rounded-3xl bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                      <header className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                         <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Seçenekleri Tamamla</p>
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
                                     {group.is_required ? "Zorunlu" : "Opsiyönel"}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sipariş Akışi</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {channel === "dine_in"
                    ? (selectedTable?.name || (selectedTable ? `Masa ${selectedTable.table_number}` : "Masa seçilmedi"))
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
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Seçili Masa</p>
                    {selectedTable ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{selectedTable.name || `Masa ${selectedTable.table_number}`}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tableStatusTone(selectedTable.status)}`}>
                          {tableStatusLabel(selectedTable.status)}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Masa seçilmedi.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Müşteri adı"
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
                      placeholder={channel === "delivery" ? "Kurye notu" : "Sipariş notu"}
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
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">Sepet boş.</p>
                  ) : (
                    cartEntries.map((entry) => {
                      const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
                      return (
                        <div key={`table-first-cart-wrapper-${entry.key}`} className="relative overflow-hidden rounded-xl bg-rose-600">
                          <div className="absolute inset-y-0 right-4 flex items-center text-white font-bold text-xs pointer-events-none">
                            <span>Sil</span>
                          </div>
                          <motion.div
                            drag="x"
                            dragConstraints={{ left: -100, right: 0 }}
                            dragElastic={{ left: 0.2, right: 0 }}
                            onDragEnd={(event, info) => {
                              if (info.offset.x < -70) {
                                removeProduct(entry.key);
                              }
                            }}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 relative z-10 w-full"
                          >
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
                          </motion.div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitOrder()}
                  className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Sipariş aciliyor..." : "Siparişi Ac"}
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
                  <h3 className="text-base font-semibold text-slate-900">{activeCategory?.name ?? "Ürünler"}</h3>
                  <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {filteredVisibleProducts.length} ürün
                  </span>
                </div>
                <input
                  ref={searchInputRef}
                  autoFocus
                  value={productSearchQuery}
                  onChange={(event) => setProductSearchQuery(event.target.value)}
                  placeholder="Ürün Ara... (Ctrl+K)"
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                {activeProduct ? (
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Seçenekler</p>
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
                            {group.is_required ? "Zorunlu" : "Opsiyönel"} - en fazla {group.max_select}
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
                    Bu kategoride aktif ürün yok.
                  </p>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filteredVisibleProducts.map((product) => (
                      <article key={`table-first-product-${product.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-600">{product.description ?? "Menu ürünu"}</p>
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
                            {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Seçenekli Ekle" : "Ekle"}
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
      <div
        aria-hidden="true"
        className={`receipt-inline-sheet pointer-events-none fixed left-[-10000px] top-0 bg-white text-slate-950 ${
          receiptPrintLayout === "thermal58" ? "w-[58mm]" : "w-[80mm]"
        }`}
      >
        <header className="border-b border-dashed border-slate-400 pb-2 text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em]">{businessSlug}</p>
          <p className="mt-1 text-[11px] font-semibold">{receiptTitle}</p>
          <p className="mt-1 text-[10px] text-slate-600">{new Date().toLocaleString("tr-TR")}</p>
        </header>

        <ul className="mt-2 space-y-2">
          {cartEntries.map((entry) => {
            const modifierTotal = entry.modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0);
            const unitPrice = Number(entry.product.price) + modifierTotal;
            const itemTotal = unitPrice * entry.quantity;
            return (
              <li key={`print-receipt-${entry.key}`} className="text-[11px] leading-tight">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{entry.quantity}x {entry.product.name}</span>
                  <span className="shrink-0 font-bold">{itemTotal.toFixed(2)}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-600">{unitPrice.toFixed(2)} TL</p>
                {entry.modifiers.length > 0 ? (
                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                    {entry.modifiers.map((modifier) => (
                      <p key={`${entry.key}-${modifier.group_id}-${modifier.option_id}`}>
                        + {modifier.option_name}
                        {Number(modifier.price_delta) !== 0 ? ` (${Number(modifier.price_delta).toFixed(2)} TL)` : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 border-t border-dashed border-slate-400 pt-2 text-[12px] font-bold">
          <p className="flex justify-between gap-3">
            <span>TOPLAM</span>
            <span>{total.toFixed(2)} TL</span>
          </p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <div className="app-mobile-hide grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sipariş Kanali</p>
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
                placeholder="Müşteri adı"
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
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Modifier Seçimi</p>
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
                    {group.is_required ? "Zorunlu" : "Opsiyönel"} - en fazla {group.max_select}
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
                {visibleProducts.length} ürün
              </span>
            </div>
            {visibleProducts.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Bu kategoride aktif ürün yok.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {visibleProducts.map((product) => (
                  <div key={product.id} className="overflow-hidden rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{product.description ?? "Menu ürünu"}</p>
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
                        {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Seçeneklerle Ekle" : "Ekle"}
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
          onClick={() => submitOrder()}
          className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Sipariş aciliyor..." : "Siparişi Ac"}
        </button>
      </aside>
    </div>
      <div className={`app-mobile-only space-y-3 ${isStackMobile ? "pb-[calc(190px+var(--safe-area-bottom))]" : "pb-[calc(164px+var(--safe-area-bottom))]"}`}>
        <article className="mobile-task-card space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Sipariş Kanali</p>
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
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="mobile-table-select">
                  Masa
                </label>
                {(entryMode as string) === "table_first" && !isTableLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTableId("");
                      setTablePickerView("table_picker");
                    }}
                    className="text-xs font-bold text-[#ff5a34]"
                  >
                    Masaları Değiştir
                  </button>
                )}
              </div>
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
                placeholder="Müşteri adı"
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

        <article className="mobile-task-card mobile-order-category-card">
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
            <div className="mobile-order-category-rail mt-3 overflow-x-auto pb-1">
              <div className={`flex min-w-max gap-2 ${isStackMobile ? "mobile-task-tabs-static" : ""}`}>
                {orderedCategories.map((category) => {
                  const isActive = category.id === activeCategoryId;
                  const productCount = groupedProducts.get(category.id)?.length ?? 0;
                  return (
                    <button
                      key={`mobile-category-${category.id}`}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      data-active={isActive}
                      className="mobile-order-category-chip whitespace-nowrap"
                    >
                      <span>{category.name}</span>
                      <small>{productCount}</small>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Seçenekler</p>
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
                  {group.is_required ? "Zorunlu" : "Opsiyönel"} - en fazla {group.max_select}
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

        <article className="mobile-task-card mobile-order-products-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">{activeCategory?.name ?? "Kategori"}</h2>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {visibleProducts.length} ürün
            </span>
          </div>
          <div className="mobile-order-product-list">
            {visibleProducts.map((product) => (
              <div key={`mobile-product-${product.id}`} className="mobile-order-product-row">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-semibold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{Number(product.price).toFixed(2)} TL</p>
                    <span className="mt-2 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      {(groupsByProduct.get(product.id) ?? []).length > 0 ? "Opsiyonlu" : "Normal"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModifierPicker(product)}
                    className="mobile-order-add-button"
                    aria-label={`${product.name} sepete ekle`}
                  >
                    +
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
                    <div key={`mobile-cart-wrapper-${entry.key}`} className="relative overflow-hidden rounded-xl bg-rose-600">
                      <div className="absolute inset-y-0 right-4 flex items-center text-white font-bold text-xs pointer-events-none">
                        <span>Sil</span>
                      </div>
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -100, right: 0 }}
                        dragElastic={{ left: 0.2, right: 0 }}
                        onDragEnd={(event, info) => {
                          if (info.offset.x < -70) {
                            removeProduct(entry.key);
                          }
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3 relative z-10 w-full"
                      >
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
                      </motion.div>
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
        <div className={`mobile-order-cart-dock rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.14)] ${isStackMobile ? "m-flow-cart-dock" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Sipariş</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{cartCount} kalem</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {total.toFixed(2)} TL
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="mobile-cta-primary mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
          >
            Sepeti Aç
          </button>
        </div>
      </div>
    </>
  );
}

