"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderHistoryWidget } from "@/components/order-history-widget";
import { OrderStatusWidget } from "@/components/order-status-widget";
import { QR_CONFIRMATION_UI_VERSION } from "@/lib/qr-confirmation";
import type { Category, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";
import type { OperatingProfile } from "@/lib/types";

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  selectedModifiers: Record<string, ProductModifierOption>;
};

type QrApiFailure = {
  ok?: boolean;
  message?: string;
  code?: string;
  resultStatus?: string;
};
type QrFunnelStep =
  | "scan"
  | "cart_add"
  | "cart_view"
  | "cart_remove"
  | "checkout_open"
  | "checkout_abandon"
  | "checkout_confirm_view"
  | "checkout_confirm_ack"
  | "order_submit"
  | "order_ack";

type QrConfirmationPayload = {
  confirmedAtClient: string;
  uiVersion: string;
  cartItemCount: number;
  cartTotal: number;
  cartSnapshotHash: string;
};

type QrOrderConfirmation = {
  confirmationId: string;
  confirmedAt: string;
  cancelUntil: string;
  cancelWindowSeçonds: number;
};

type QrCreateOrderResponse = QrApiFailure & {
  orderId?: string | null;
  confirmation?: QrOrderConfirmation | null;
};

type SelfServicePaymentMethod = "cash" | "card";

type SubmitPayloadItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  modifiers?: Array<{
    group_id?: string;
    group_name: string;
    option_id?: string;
    option_name: string;
    price_delta: number;
    quantity?: number;
  }>;
};

type RecentOrderSnapshot = {
  customerName: string;
  paymentMethod: SelfServicePaymentMethod;
  items: Array<{
    productId: string;
    quantity: number;
    modifierOptionIds: string[];
  }>;
};

function createModifierSignature(selectedModifiers: Record<string, ProductModifierOption>) {
  return Object.values(selectedModifiers)
    .map((modifier) => `${modifier.group_id}:${modifier.id}`)
    .sort()
    .join("|");
}

function createCartStorageKey(businessSlug?: string, qrCodeIdentifier?: string) {
  return `qr-cart:v2:${(businessSlug ?? "default").trim().toLowerCase()}:${(qrCodeIdentifier ?? "unknown").trim().toLowerCase()}`;
}

function createOrderHistoryStorageKey(businessSlug?: string, qrCodeIdentifier?: string) {
  return `qr-order-history:v1:${(businessSlug ?? "default").trim().toLowerCase()}:${(qrCodeIdentifier ?? "unknown").trim().toLowerCase()}`;
}
function createRecentOrderStorageKey(businessSlug?: string, qrCodeIdentifier?: string) {
  return `qr-recent-order:v1:${(businessSlug ?? "default").trim().toLowerCase()}:${(qrCodeIdentifier ?? "unknown").trim().toLowerCase()}`;
}

function parseStoredOrderIds(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }
    return parsed
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter((id) => id.length > 0);
  } catch {
    return [] as string[];
  }
}

function fnv1aHash(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createDeterministicIdempotencyKey(input: {
  businessSlug?: string;
  qrCodeIdentifier?: string;
  totalPrice: number;
  items: SubmitPayloadItem[];
}) {
  const normalized = {
    b: (input.businessSlug ?? "default").trim().toLowerCase(),
    q: (input.qrCodeIdentifier ?? "unknown").trim().toLowerCase(),
    t: Number(input.totalPrice).toFixed(2),
    i: input.items
      .map((item) => ({
        p: item.product_id,
        q: item.quantity,
        u: Number(item.unit_price).toFixed(2),
        mods: (item.modifiers ?? [])
          .map((mod) => ({
            g: mod.group_id ?? "",
            o: mod.option_id ?? "",
            n: mod.option_name,
            d: Number(mod.price_delta).toFixed(2),
          }))
          .sort((a, b) => `${a.g}:${a.o}`.localeCompare(`${b.g}:${b.o}`)),
      }))
      .sort((a, b) => `${a.p}:${a.q}:${a.u}`.localeCompare(`${b.p}:${b.q}:${b.u}`)),
  };
  return `qr-order:${fnv1aHash(JSON.stringify(normalized))}`;
}

function createCartSnapshotHash(input: {
  businessSlug?: string;
  qrCodeIdentifier?: string;
  totalPrice: number;
  items: SubmitPayloadItem[];
}) {
  return fnv1aHash(JSON.stringify({
    b: (input.businessSlug ?? "default").trim().toLowerCase(),
    q: (input.qrCodeIdentifier ?? "unknown").trim().toLowerCase(),
    t: Number(input.totalPrice).toFixed(2),
    i: input.items,
  }));
}

function getHumanErrorMessage(input?: QrApiFailure) {
  if (!input) {
    return "Sipariş gönderilemedi. Lutfen tekrar deneyin.";
  }
  if (input.code === "QR_TOKEN_EXPIRED") {
    return "QR oturumu suresi doldu. Lutfen 2-3 saniye icinde tekrar deneyin.";
  }
  if (input.code === "QR_TOKEN_MISSING" || input.code === "QR_TOKEN_INVALID" || input.code === "QR_TOKEN_MISMATCH") {
    return "QR erisim dogrulanamadı. Lutfen QR kodu yeniden okutun.";
  }
  if (input.code === "TABLE_NOT_FOUND") {
    return "Masa kaydı bulunamadı. QR kodunu yeniden okutup tekrar deneyin.";
  }
  if (input.resultStatus === "CONFLICT") {
    return "Ayni sipariş daha once alinmis gorunuyor. Durum panelinden kontrol edin.";
  }
  return input.message ?? "Sipariş gönderilemedi. Internet bağlantınizi kontrol edip tekrar deneyin.";
}

async function waitMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseStoredCart(
  raw: string,
  productsById: Map<string, Product>,
  modifierOptionsById: Map<string, ProductModifierOption>,
) {
  try {
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      productId?: string;
      quantity?: number;
      selectedModifierOptionIds?: string[];
    }>;
    if (!Array.isArray(parsed)) {
      return [] as CartItem[];
    }

    const restored: CartItem[] = [];
    for (const row of parsed) {
      const productId = typeof row.productId === "string" ? row.productId : "";
      const product = productsById.get(productId);
      if (!product) {
        continue;
      }
      const selectedModifiers: Record<string, ProductModifierOption> = {};
      for (const optionId of Array.isArray(row.selectedModifierOptionIds) ? row.selectedModifierOptionIds : []) {
        const option = modifierOptionsById.get(optionId);
        if (option) {
          selectedModifiers[option.group_id] = option;
        }
      }
      restored.push({
        id: row.id && row.id.trim() ? row.id : crypto.randomUUID(),
        product,
        quantity: Math.max(1, Number(row.quantity || 1)),
        selectedModifiers,
      });
    }
    return restored;
  } catch {
    return [] as CartItem[];
  }
}

function parseRecentOrderSnapshot(raw: string): RecentOrderSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as RecentOrderSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) {
      return null;
    }
    return {
      customerName: typeof parsed.customerName === "string" ? parsed.customerName : "",
      paymentMethod: parsed.paymentMethod === "card" ? "card" : "cash",
      items: parsed.items
        .map((item) => ({
          productId: typeof item.productId === "string" ? item.productId : "",
          quantity: Math.max(1, Number(item.quantity || 1)),
          modifierOptionIds: Array.isArray(item.modifierOptionIds)
            ? item.modifierOptionIds.filter((id) => typeof id === "string")
            : [],
        }))
        .filter((item) => item.productId.length > 0),
    };
  } catch {
    return null;
  }
}

export function QrOrderingClient({
  categories,
  products,
  modifierGroups,
  modifierOptions,
  businessSlug,
  qrCodeIdentifier,
  qrAccessToken,
  qrConfirmationEnabled,
  operatingProfile = "restaurant_classic",
}: {
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  businessSlug?: string;
  qrCodeIdentifier?: string;
  qrAccessToken?: string;
  qrConfirmationEnabled?: boolean;
  operatingProfile?: OperatingProfile;
}) {
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [categories],
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => orderedCategories[0]?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"review" | "confirm">("review");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SelfServicePaymentMethod>("cash");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [recentOrderSnapshot, setRecentOrderSnapshot] = useState<RecentOrderSnapshot | null>(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<QrOrderConfirmation | null>(null);
  const [lastOrderSummary, setLastOrderSummary] = useState<SubmitPayloadItem[]>([]);
  const [lastOrderTotal, setLastOrderTotal] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [cancelSeçondsLeft, setCancelSeçondsLeft] = useState<number>(0);
  const [customerOrderIds, setCustomerOrderIds] = useState<string[]>([]);
  const [activeQrAccessToken, setActiveQrAccessToken] = useState<string | undefined>(qrAccessToken);
  const [isCartHydrated, setIsCartHydrated] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ProductModifierOption>>({});
  const [modifierErrorGroupIds, setModifierErrorGroupIds] = useState<string[]>([]);
  const modifierGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const inFlightSubmitKeyRef = useRef<string | null>(null);
  const lastSuccessfulSubmitKeyRef = useRef<string | null>(null);
  const scanTrackedRef = useRef(false);
  const checkoutTrackedRef = useRef(false);
  const cartOpenRef = useRef(false);

  const productsById = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const modifierOptionsById = useMemo(() => new Map(modifierOptions.map((item) => [item.id, item])), [modifierOptions]);
  const cartStorageKey = useMemo(() => createCartStorageKey(businessSlug, qrCodeIdentifier), [businessSlug, qrCodeIdentifier]);
  const orderHistoryStorageKey = useMemo(() => createOrderHistoryStorageKey(businessSlug, qrCodeIdentifier), [businessSlug, qrCodeIdentifier]);
  const recentOrderStorageKey = useMemo(() => createRecentOrderStorageKey(businessSlug, qrCodeIdentifier), [businessSlug, qrCodeIdentifier]);

  const cartTotal = cartItems.reduce((acc, item) => {
    let unit = Number(item.product.price);
    for (const mod of Object.values(item.selectedModifiers)) {
      unit += Number(mod.price_delta);
    }
    return acc + unit * item.quantity;
  }, 0);
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

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
  const isCoffeeSelfService = operatingProfile === "coffee_self_service";

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

  const visibleProductsRaw = useMemo(() => grouped.get(activeCategoryId) ?? [], [grouped, activeCategoryId]);
  const normalizedSearch = productSearchTerm.trim().toLocaleLowerCase("tr-TR");
  const visibleProducts = normalizedSearch
    ? visibleProductsRaw.filter((item) => {
        const name = item.name.toLocaleLowerCase("tr-TR");
        const description = (item.description ?? "").toLocaleLowerCase("tr-TR");
        return name.includes(normalizedSearch) || description.includes(normalizedSearch);
      })
    : visibleProductsRaw;
  const selectedProduct = selectedProductId ? visibleProducts.find((item) => item.id === selectedProductId) ?? null : null;
  const selectedProductGroups = selectedProduct ? groupsByProduct.get(selectedProduct.id) ?? [] : [];
  const topPickProductIds = useMemo(() => products.slice(0, 8).map((item) => item.id), [products]);
  const topPickProducts = useMemo(
    () => visibleProductsRaw.filter((item) => topPickProductIds.includes(item.id)).slice(0, 8),
    [topPickProductIds, visibleProductsRaw],
  );

  const trackFunnel = useCallback(async (
    step: QrFunnelStep,
    extras?: { cartItems?: number; cartTotal?: number; orderId?: string | null },
  ) => {
    try {
      await fetchWithTimeout("/api/qr/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          businessSlug,
          qrCodeIdentifier,
          cartItems: extras?.cartItems,
          cartTotal: extras?.cartTotal,
          orderId: extras?.orderId ?? undefined,
        }),
        keepalive: true,
      }, 6000);
    } catch {
      // no-op
    }
  }, [businessSlug, qrCodeIdentifier]);

  useEffect(() => {
    setActiveQrAccessToken(qrAccessToken);
  }, [qrAccessToken]);

  useEffect(() => {
    if (scanTrackedRef.current) {
      return;
    }
    scanTrackedRef.current = true;
    void trackFunnel("scan");
  }, [trackFunnel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(cartStorageKey);
    if (raw) {
      setCartItems(parseStoredCart(raw, productsById, modifierOptionsById));
    }
    const rawOrderHistory = window.localStorage.getItem(orderHistoryStorageKey);
    if (rawOrderHistory) {
      setCustomerOrderIds(parseStoredOrderIds(rawOrderHistory));
    } else {
      setCustomerOrderIds([]);
    }
    const rawRecentOrder = window.localStorage.getItem(recentOrderStorageKey);
    if (rawRecentOrder) {
      setRecentOrderSnapshot(parseRecentOrderSnapshot(rawRecentOrder));
    }
    setIsCartHydrated(true);
  }, [cartStorageKey, orderHistoryStorageKey, productsById, modifierOptionsById, recentOrderStorageKey]);

  useEffect(() => {
    if (!isCartHydrated || typeof window === "undefined") {
      return;
    }
    if (cartItems.length === 0) {
      window.localStorage.removeItem(cartStorageKey);
      return;
    }
    const serialized = cartItems.map((item) => ({
      id: item.id,
      productId: item.product.id,
      quantity: item.quantity,
      selectedModifierOptionIds: Object.values(item.selectedModifiers).map((option) => option.id),
    }));
    window.localStorage.setItem(cartStorageKey, JSON.stringify(serialized));
  }, [cartItems, cartStorageKey, isCartHydrated]);

  useEffect(() => {
    if (!isCartHydrated || typeof window === "undefined") {
      return;
    }
    if (customerOrderIds.length === 0) {
      window.localStorage.removeItem(orderHistoryStorageKey);
      return;
    }
    window.localStorage.setItem(orderHistoryStorageKey, JSON.stringify(customerOrderIds));
  }, [customerOrderIds, isCartHydrated, orderHistoryStorageKey]);

  useEffect(() => {
    if (!isCartHydrated || typeof window === "undefined") {
      return;
    }
    if (!recentOrderSnapshot) {
      window.localStorage.removeItem(recentOrderStorageKey);
      return;
    }
    window.localStorage.setItem(recentOrderStorageKey, JSON.stringify(recentOrderSnapshot));
  }, [isCartHydrated, recentOrderSnapshot, recentOrderStorageKey]);

  useEffect(() => {
    if (!isCartOpen) {
      checkoutTrackedRef.current = false;
      return;
    }
    if (checkoutTrackedRef.current) {
      return;
    }
    checkoutTrackedRef.current = true;
    void trackFunnel("checkout_open");
    void trackFunnel("cart_view", { cartItems: cartItemCount, cartTotal });
  }, [cartItemCount, cartTotal, isCartOpen, trackFunnel]);

  useEffect(() => {
    const wasOpen = cartOpenRef.current;
    if (wasOpen && !isCartOpen && cartItems.length > 0 && !isSubmitting) {
      void trackFunnel("checkout_abandon", { cartItems: cartItemCount, cartTotal });
    }
    cartOpenRef.current = isCartOpen;
  }, [cartItemCount, cartItems.length, cartTotal, isCartOpen, isSubmitting, trackFunnel]);

  useEffect(() => {
    if (!isCartOpen) {
      setCheckoutStep("review");
      setConfirmationChecked(false);
    }
  }, [isCartOpen]);

  useEffect(() => {
    if (!orderConfirmation?.cancelUntil) {
      setCancelSeçondsLeft(0);
      return;
    }
    const sync = () => {
      const seçonds = Math.max(0, Math.ceil((new Date(orderConfirmation.cancelUntil).getTime() - Date.now()) / 1000));
      setCancelSeçondsLeft(seçonds);
    };
    sync();
    const timer = setInterval(sync, 1000);
    return () => clearInterval(timer);
  }, [orderConfirmation?.cancelUntil]);

  const handleProductSelect = (productId: string) => {
    setSubmitError(null);
    setModifierErrorGroupIds([]);
    if (selectedProductId === productId) {
      setSelectedProductId(null);
      return;
    }

    setSelectedProductId(productId);
    setQuantity(1);
    const initialModifiers: Record<string, ProductModifierOption> = {};
    const groups = groupsByProduct.get(productId) ?? [];
    for (const group of groups) {
      const options = optionsByGroup.get(group.id) ?? [];
      const defaultOption = options.find((option) => option.is_default) || (group.is_required ? options[0] : null);
      if (defaultOption) {
        initialModifiers[group.id] = defaultOption;
      }
    }
    setSelectedModifiers(initialModifiers);
  };

  const handleModifierSelect = (groupId: string, option: ProductModifierOption) => {
    setSelectedModifiers((prev) => ({ ...prev, [groupId]: option }));
    setModifierErrorGroupIds((prev) => prev.filter((id) => id !== groupId));
  };

  const upsertCartItem = (nextItem: CartItem) => {
    setCartItems((prev) => {
      const nextSignature = createModifierSignature(nextItem.selectedModifiers);
      const existingIndex = prev.findIndex((item) => (
        item.product.id === nextItem.product.id &&
        createModifierSignature(item.selectedModifiers) === nextSignature
      ));
      if (existingIndex === -1) {
        return [...prev, nextItem];
      }

      const updated = [...prev];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + nextItem.quantity,
      };
      return updated;
    });
  };

  const updateCartItemQuantity = (itemId: string, nextQuantity: number) => {
    setCartItems((prev) => prev.map((item) => (
      item.id === itemId
        ? { ...item, quantity: Math.max(1, Math.floor(nextQuantity || 1)) }
        : item
    )));
  };

  const quickAddProduct = (product: Product) => {
    const groups = groupsByProduct.get(product.id) ?? [];
    const hasRequiredGroups = groups.some((group) => group.is_required);
    if (hasRequiredGroups) {
      handleProductSelect(product.id);
      return;
    }

    const selectedDefaultModifiers: Record<string, ProductModifierOption> = {};
    for (const group of groups) {
      const options = optionsByGroup.get(group.id) ?? [];
      const defaultOption = options.find((option) => option.is_default);
      if (defaultOption) {
        selectedDefaultModifiers[group.id] = defaultOption;
      }
    }

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product,
      quantity: 1,
      selectedModifiers: selectedDefaultModifiers,
    };

    let unitPrice = Number(product.price);
    for (const mod of Object.values(selectedDefaultModifiers)) {
      unitPrice += Number(mod.price_delta);
    }

    setSubmitError(null);
    setModifierErrorGroupIds([]);
    upsertCartItem(newItem);
    void trackFunnel("cart_add", { cartItems: cartItemCount + 1, cartTotal: cartTotal + unitPrice });
  };

  const handleAddToCart = () => {
    if (!selectedProduct) {
      return;
    }

    const missingRequiredGroups = selectedProductGroups
      .filter((group) => group.is_required && !selectedModifiers[group.id])
      .map((group) => group.id);
    if (missingRequiredGroups.length > 0) {
      setModifierErrorGroupIds(missingRequiredGroups);
      const firstMissingGroupId = missingRequiredGroups[0];
      const groupNode = modifierGroupRefs.current[firstMissingGroupId];
      groupNode?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product: selectedProduct,
      quantity,
      selectedModifiers: { ...selectedModifiers },
    };
    setSubmitError(null);
    setModifierErrorGroupIds([]);
    upsertCartItem(newItem);
    setSelectedProductId(null);
    void trackFunnel("cart_add", { cartItems: cartItems.length + quantity, cartTotal: cartTotal + Number(selectedProduct.price) * quantity });
  };


  const formatPrice = (value: number) => `${Number(value).toFixed(2)} TL`;
  const formatSeçonds = (value: number) => `${Math.max(0, value)} sn`;
  const currentClock = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const getProductEmoji = (name: string) => {
    const label = name.toLocaleLowerCase("tr-TR");
    if (label.includes("espresso") || label.includes("kahve") || label.includes("americano") || label.includes("cappuccino")) return "☕";
    if (label.includes("latte")) return "🥛";
    if (label.includes("mocha") || label.includes("cikolata") || label.includes("çikolata")) return "🍫";
    if (label.includes("frapp")) return "🥤";
    if (label.includes("limon")) return "🍋";
    if (label.includes("ice")) return "🧊";
    if (label.includes("cay") || label.includes("çay")) return "🍵";
    if (label.includes("pasta") || label.includes("cake")) return "🍰";
    if (label.includes("cookie")) return "🍪";
    if (label.includes("sandvic") || label.includes("sandviç")) return "🥪";
    return "🍽️";
  };
  const getPrepTimeLabel = (product: Product) => {
    const label = `${product.name} ${product.description ?? ""}`.toLocaleLowerCase("tr-TR");
    if (label.includes("frapp") || label.includes("sandvic") || label.includes("sandvi")) return "6-8 dk";
    if (label.includes("tatli") || label.includes("cake") || label.includes("cookie")) return "3-5 dk";
    return "2-4 dk";
  };

  const suggestUpsellProducts = useCallback((limit = 2) => {
    if (cartItems.length === 0) {
      return [] as Product[];
    }
    const inCartIds = new Set(cartItems.map((item) => item.product.id));
    const hasCoffee = cartItems.some((item) => {
      const name = item.product.name.toLocaleLowerCase("tr-TR");
      return name.includes("kahve") || name.includes("espresso") || name.includes("latte");
    });
    const candidates = products.filter((product) => !inCartIds.has(product.id));
    const dessertFirst = candidates.filter((product) => {
      const name = product.name.toLocaleLowerCase("tr-TR");
      return name.includes("cookie") || name.includes("croissant") || name.includes("cake") || name.includes("tiramisu");
    });
    const addonFirst = candidates.filter((product) => {
      const name = product.name.toLocaleLowerCase("tr-TR");
      return name.includes("shot") || name.includes("syrup") || name.includes("add-on");
    });
    const selected = hasCoffee ? [...addonFirst, ...dessertFirst] : [...dessertFirst, ...addonFirst];
    return selected.slice(0, limit);
  }, [cartItems, products]);

  const reOrderLast = () => {
    if (!recentOrderSnapshot) {
      return;
    }
    const restored: CartItem[] = [];
    for (const item of recentOrderSnapshot.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        continue;
      }
      const selectedModMap: Record<string, ProductModifierOption> = {};
      for (const optionId of item.modifierOptionIds) {
        const option = modifierOptionsById.get(optionId);
        if (option) {
          selectedModMap[option.group_id] = option;
        }
      }
      restored.push({
        id: crypto.randomUUID(),
        product,
        quantity: Math.max(1, item.quantity),
        selectedModifiers: selectedModMap,
      });
    }
    if (restored.length === 0) {
      return;
    }
    setCartItems(restored);
    setCustomerName(recentOrderSnapshot.customerName);
    setPaymentMethod(recentOrderSnapshot.paymentMethod);
    setSubmitError(null);
  };

  async function refreshQrToken(): Promise<string | undefined> {
    if (!qrCodeIdentifier) {
      return undefined;
    }
    let lastError = "QR token yenilenemedi.";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchWithTimeout("/api/qr/token/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrCodeIdentifier,
            businessSlug,
          }),
        }, 8000);
        const data = (await response.json()) as { ok?: boolean; qrAccessToken?: string; message?: string };
        if (response.ok && data.ok && data.qrAccessToken) {
          setActiveQrAccessToken(data.qrAccessToken);
          return data.qrAccessToken;
        }
        lastError = data.message ?? lastError;
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
      await waitMs(250 * (attempt + 1));
    }
    throw new Error(lastError);
  }

  async function callCreateOrder(input: {
    token: string;
    payloadItems: SubmitPayloadItem[];
    idempotencyKey: string;
    qrConfirmation?: QrConfirmationPayload;
    customerName?: string;
    paymentMethod: SelfServicePaymentMethod;
  }) {
    return fetchWithTimeout("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": input.idempotencyKey,
        "x-command-id": input.idempotencyKey,
      },
      body: JSON.stringify({
        qrCodeIdentifier,
        qrAccessToken: input.token,
        businessSlug,
        customerName: input.customerName,
        paymentMethod: input.paymentMethod,
        items: input.payloadItems,
        totalPrice: cartTotal,
        qrConfirmation: input.qrConfirmation,
      }),
    }, 12000);
  }

  const submitOrder = async (paymentMethod: SelfServicePaymentMethod) => {
    if (cartItems.length === 0) {
      return;
    }
    if (!qrCodeIdentifier) {
      setSubmitError("Geçerli QR kodu olmadan sipariş acilamaz.");
      return;
    }
    if (qrConfirmationEnabled && !confirmationChecked) {
      setSubmitError("Siparişi göndermeden once onay kutusunu isaretleyin.");
      return;
    }
    if (operatingProfile === "coffee_self_service" && !customerName.trim()) {
      setSubmitError("Lutfen isminizi giriniz.");
      return;
    }
    setSubmitError(null);

    const payloadItems: SubmitPayloadItem[] = cartItems.map((item) => {
      const modifiersArray = Object.values(item.selectedModifiers).map((mod) => {
        const group = modifierGroups.find((g) => g.id === mod.group_id);
        return {
          group_id: mod.group_id,
          group_name: group?.name ?? "",
          option_id: mod.id,
          option_name: mod.name,
          price_delta: Number(mod.price_delta),
          quantity: 1,
        };
      });

      let unitPrice = Number(item.product.price);
      for (const mod of modifiersArray) {
        unitPrice += mod.price_delta;
      }
      return {
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: unitPrice * item.quantity,
        modifiers: modifiersArray.length > 0 ? modifiersArray : undefined,
      };
    });

    const idempotencyKey = createDeterministicIdempotencyKey({
      businessSlug,
      qrCodeIdentifier,
      totalPrice: cartTotal,
      items: payloadItems,
    });

    if (lastSuccessfulSubmitKeyRef.current === idempotencyKey) {
      setOrderSuccess(true);
      return;
    }
    if (inFlightSubmitKeyRef.current === idempotencyKey) {
      return;
    }

    inFlightSubmitKeyRef.current = idempotencyKey;
    setIsSubmitting(true);
    setCancelError(null);
    setCancelSuccess(null);
    void trackFunnel("order_submit", { cartItems: cartItemCount, cartTotal });

    try {
      let tokenToUse = activeQrAccessToken;
      if (!tokenToUse) {
        tokenToUse = await refreshQrToken();
      }
      if (!tokenToUse) {
        throw new Error("QR token bulunamadı.");
      }

      const qrConfirmationPayload: QrConfirmationPayload | undefined = qrConfirmationEnabled
        ? {
            confirmedAtClient: new Date().toISOString(),
            uiVersion: QR_CONFIRMATION_UI_VERSION,
            cartItemCount,
            cartTotal,
            cartSnapshotHash: createCartSnapshotHash({
              businessSlug,
              qrCodeIdentifier,
              totalPrice: cartTotal,
              items: payloadItems,
            }),
          }
        : undefined;

      let response = await callCreateOrder({
        token: tokenToUse,
        payloadItems,
        idempotencyKey,
        qrConfirmation: qrConfirmationPayload,
        customerName: customerName.trim() || undefined,
        paymentMethod,
      });
      let data = (await response.json()) as QrCreateOrderResponse;

      if (!response.ok && response.status === 403 && data.code?.startsWith("QR_TOKEN_")) {
        tokenToUse = await refreshQrToken();
        if (!tokenToUse) {
          throw new Error("QR token yenilenemedi.");
        }
        response = await callCreateOrder({
          token: tokenToUse,
          payloadItems,
          idempotencyKey,
          qrConfirmation: qrConfirmationPayload,
          customerName: customerName.trim() || undefined,
          paymentMethod,
        });
        data = (await response.json()) as QrCreateOrderResponse;
      }

      if (!response.ok || !data.ok) {
        setSubmitError(getHumanErrorMessage(data));
        return;
      }

      lastSuccessfulSubmitKeyRef.current = idempotencyKey;
      const createdOrderId = typeof data.orderId === "string" ? data.orderId : null;
      setLastOrderId(createdOrderId);
      if (createdOrderId) {
        setCustomerOrderIds((prev) => {
          const next = [createdOrderId, ...prev.filter((id) => id !== createdOrderId)];
          return next.slice(0, 12);
        });
      }
      setOrderConfirmation(data.confirmation ?? null);
      setLastOrderSummary(payloadItems);
      setLastOrderTotal(cartTotal);
      setRecentOrderSnapshot({
        customerName: customerName.trim(),
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          modifierOptionIds: Object.values(item.selectedModifiers).map((option) => option.id),
        })),
      });
      setCartItems([]);
      setIsCartOpen(false);
      setOrderSuccess(true);
      void trackFunnel("order_ack", { orderId: typeof data.orderId === "string" ? data.orderId : null });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setSubmitError("Bağlantı zaman asimina ugradı. Internetinizi kontrol edip tekrar deneyin.");
      } else {
        setSubmitError(error instanceof Error ? error.message : "Bağlantı hatası oluştu.");
      }
    } finally {
      inFlightSubmitKeyRef.current = null;
      setIsSubmitting(false);
    }
  };

  const cancelOrderByQr = async () => {
    if (!lastOrderId || !qrCodeIdentifier) {
      return;
    }
    setCancelError(null);
    setCancelSuccess(null);
    setIsCancelling(true);

    try {
      let tokenToUse = activeQrAccessToken;
      if (!tokenToUse) {
        tokenToUse = await refreshQrToken();
      }
      if (!tokenToUse) {
        throw new Error("QR token bulunamadı.");
      }

      let response = await fetch(`/api/orders/${encodeURIComponent(lastOrderId)}/cancel-by-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCodeIdentifier,
          businessSlug,
          qrAccessToken: tokenToUse,
        }),
      });
      let data = (await response.json()) as QrApiFailure & { alreadyCancelled?: boolean };

      if (!response.ok && response.status === 403 && data.code?.startsWith("QR_TOKEN_")) {
        tokenToUse = await refreshQrToken();
        if (!tokenToUse) {
          throw new Error("QR token yenilenemedi.");
        }
        response = await fetch(`/api/orders/${encodeURIComponent(lastOrderId)}/cancel-by-qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrCodeIdentifier,
            businessSlug,
            qrAccessToken: tokenToUse,
          }),
        });
        data = (await response.json()) as QrApiFailure & { alreadyCancelled?: boolean };
      }

      if (!response.ok || !data.ok) {
        setCancelError(getHumanErrorMessage(data));
        return;
      }

      setCancelSuccess(data.alreadyCancelled ? "Sipariş zaten iptal edilmiş." : "Siparişiniz iptal edildi.");
      setCancelSeçondsLeft(0);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "İptal işlemi sirasinda hata oluştu.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-6 md:px-6">
        <div className="rounded-3xl border border-emerald-200/40 bg-emerald-900/20 p-5 text-center">
          <h1 className="text-2xl font-bold text-white">Siparişiniz Alindi</h1>
          <p className="mt-1 text-sm text-emerald-100">Siparişiniz mutfaga iletildi. Afiyet olsun.</p>
          {lastOrderId ? <p className="mt-2 text-xs text-emerald-200">Referans: {lastOrderId.slice(0, 8)}</p> : null}
          {orderConfirmation?.confirmedAt ? (
            <p className="mt-1 text-xs text-emerald-200">
              Onay Saati: {new Date(orderConfirmation.confirmedAt).toLocaleString("tr-TR")}
            </p>
          ) : null}
          <button
            onClick={() => {
              setOrderSuccess(false);
              setOrderConfirmation(null);
              setLastOrderSummary([]);
              setLastOrderTotal(0);
              setCancelError(null);
              setCancelSuccess(null);
            }}
            className="mt-4 rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
          >
            Yeni Sipariş Ver
          </button>
        </div>

        <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 text-slate-100">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold">Onaylanan Sepet Ozeti</span>
            <span className="text-emerald-300">Toplam: {formatPrice(lastOrderTotal)}</span>
          </div>
          <div className="space-y-2">
            {lastOrderSummary.map((item, index) => (
              <div key={`${item.product_id}-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{item.quantity}x {item.name}</span>
                  <span>{formatPrice(item.line_total)}</span>
                </div>
              </div>
            ))}
          </div>
          {orderConfirmation?.cancelUntil ? (
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-sm">
              <p>İptal/Duzeltme Suresi: {formatSeçonds(cancelSeçondsLeft)}</p>
              <p className="text-xs text-amber-100">
                Son zaman: {new Date(orderConfirmation.cancelUntil).toLocaleTimeString("tr-TR")}
              </p>
              <button
                onClick={cancelOrderByQr}
                disabled={isCancelling || cancelSeçondsLeft <= 0}
                className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? "İptal Ediliyor..." : "Siparişi İptal Et"}
              </button>
              {cancelError ? <p className="mt-2 text-xs text-rose-200">{cancelError}</p> : null}
              {cancelSuccess ? <p className="mt-2 text-xs text-emerald-200">{cancelSuccess}</p> : null}
            </div>
          ) : null}
          {!orderConfirmation && qrConfirmationEnabled ? (
            <p className="mt-3 text-xs text-amber-200">
              Onay kaydı oluşturulamadı. İptal talebi icin personele bildirin.
            </p>
          ) : null}
        </section>

        {qrCodeIdentifier && activeQrAccessToken ? (
          <div className="grid gap-4 md:grid-cols-2">
            <OrderStatusWidget
              businessSlug={businessSlug}
              qrCodeIdentifier={qrCodeIdentifier}
              qrAccessToken={activeQrAccessToken}
            />
            <OrderHistoryWidget
              businessSlug={businessSlug}
              qrCodeIdentifier={qrCodeIdentifier}
              qrAccessToken={activeQrAccessToken}
              orderIds={customerOrderIds}
            />
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Sipariş durumunu gorebilmek icin QR kodu yeniden okutun.
          </p>
        )}
      </div>
    );
  }

  if (isCoffeeSelfService) {
    return (
      <div className="min-h-screen bg-[radıal-gradient(circle_at_top,#111827_0%,#0b1220_56%,#090f1a_100%)] text-white">
        <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 xl:grid-cols-[1fr_350px]">
          <section className="border-b border-white/10 px-5 py-4 xl:col-span-2 xl:border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff5f7a_0%,#ff385c_100%)] text-2xl shadow-[0_10px_25px_rgba(255,56,92,0.45)]">
                  ☕
                </div>
                <div>
                  <p className="text-3xl font-black tracking-tight">Self Servis Kahvecim</p>
                  <p className="text-sm text-slate-300">Hizli & Lezzetli</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-rose-400">{currentClock}</p>
                <p className="text-sm text-slate-300">Sipariş Sayisi: {cartItems.length}</p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden px-5 py-4">
            <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="search"
                placeholder="Ürün veya icerik ara..."
                value={productSearchTerm}
                onChange={(event) => setProductSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => {
                  if (topPickProducts.length === 0) {
                    return;
                  }
                  setSelectedCategoryId(topPickProducts[0].category_id);
                  setProductSearchTerm("");
                }}
                className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100"
              >
                Sik Sipariş Edilenler
              </button>
            </div>
            <div className="mb-4 overflow-x-auto">
              <div className="flex min-w-max items-center gap-3">
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
                      className={`rounded-full px-6 py-3 text-lg font-bold transition ${
                        isActive
                          ? "bg-[linear-gradient(135deg,#ff5f7a_0%,#ff385c_100%)] text-white shadow-[0_12px_24px_rgba(255,56,92,0.35)]"
                          : "bg-white/10 text-slate-100 hover:bg-white/15"
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <p className="rounded-2xl border border-white/15 bg-white/5 px-4 py-5 text-sm text-slate-200">
                Bu kategori icin ürün bulunmuyor.
              </p>
            ) : (
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                  {visibleProducts.map((product) => {
                    const isSelected = selectedProductId === product.id;
                    const handleTilePress = () => {
                      const groups = groupsByProduct.get(product.id) ?? [];
                      const hasRequiredGroups = groups.some((group) => group.is_required);
                      if (hasRequiredGroups) {
                        handleProductSelect(product.id);
                        return;
                      }
                      quickAddProduct(product);
                    };
                    return (
                      <article
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        onClick={handleTilePress}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleTilePress();
                          }
                        }}
                        className={`cursor-pointer rounded-3xl border p-4 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                          isSelected
                            ? "border-rose-400/70 bg-rose-500/10 shadow-[0_14px_35px_rgba(244,63,94,0.3)]"
                            : "border-white/10 bg-[linear-gradient(145deg,rgba(30,41,59,0.85)_0%,rgba(17,24,39,0.95)_100%)]"
                        }`}
                      >
                        <div className="w-full">
                          <div className="mb-2 text-center text-5xl">{getProductEmoji(product.name)}</div>
                          <p className="text-center text-[1.35rem] font-bold leadıng-tight">{product.name}</p>
                          <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
                            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-amber-200">Hazırlik: {getPrepTimeLabel(product)}</span>
                            {topPickProductIds.includes(product.id) ? (
                              <span className="rounded-full border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-rose-100">En Cok Tercih</span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-center text-[1.9rem] font-black text-rose-400">{formatPrice(product.price)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleTilePress();
                          }}
                          className="mt-3 w-full rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                        >
                          Ekle
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedProduct ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/65 p-4">
                <p className="text-lg font-bold">{selectedProduct.name}</p>
                <p className="mt-1 text-sm text-slate-300">{selectedProduct.description ?? "Açıklama bulunmuyor."}</p>
                {modifierErrorGroupIds.length > 0 ? (
                  <p className="mt-3 rounded-xl border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                    Zorunlu seçenekleri tamamlayin.
                  </p>
                ) : null}
                {selectedProductGroups.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {selectedProductGroups.map((group) => (
                      <div
                        key={group.id}
                        ref={(node) => {
                          modifierGroupRefs.current[group.id] = node;
                        }}
                        className={`rounded-xl border p-3 ${
                          modifierErrorGroupIds.includes(group.id) ? "border-rose-400 bg-rose-500/10" : "border-white/10 bg-white/5"
                        }`}
                      >
                        <p className="mb-2 text-sm font-bold">
                          {group.name}
                          {group.is_required ? <span className="ml-2 text-xs text-amber-300">Zorunlu</span> : null}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(optionsByGroup.get(group.id) ?? []).map((option) => {
                            const isSelectedOption = selectedModifiers[group.id]?.id === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => handleModifierSelect(group.id, option)}
                                className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                  isSelectedOption
                                    ? "border-rose-400 bg-rose-500/10 text-rose-200"
                                    : "border-white/10 bg-slate-900/50 text-slate-200"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{option.name}</span>
                                  <span>{Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Dahil"}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold">-</button>
                    <span className="w-8 text-center text-lg font-bold">{quantity}</span>
                    <button onClick={() => setQuantity((q) => q + 1)} className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold">+</button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="rounded-xl bg-[linear-gradient(135deg,#ff5f7a_0%,#ff385c_100%)] px-5 py-2 text-sm font-bold text-white"
                  >
                    Sepete Ekle
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="border-l border-white/10 bg-[linear-gradient(180deg,#303644_0%,#232a3a_100%)] px-4 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-3xl font-black">Siparişim</p>
                <p className="text-sm text-slate-300">Toplam Ürün: <span className="font-bold text-rose-400">{cartItemCount}</span></p>
              </div>
              <div className="flex items-center gap-2">
                {recentOrderSnapshot ? (
                  <button
                    type="button"
                    onClick={reOrderLast}
                    className="rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
                  >
                    Son Siparişi Tekrarla
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/20"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="max-h-[calc(100vh-380px)] space-y-2 overflow-y-auto pr-1">
              {cartItems.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-slate-300">Sepet boş.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[1rem] font-bold">{item.product.name}</p>
                        <p className="text-sm text-slate-300">{formatPrice(Number(item.product.price) * item.quantity)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              setCartItems((prev) => prev.filter((row) => row.id !== item.id));
                              void trackFunnel("cart_remove", { cartItems: Math.max(0, cartItemCount - 1), cartTotal });
                              return;
                            }
                            updateCartItemQuantity(item.id, item.quantity - 1);
                          }}
                          className="h-9 w-9 rounded-xl bg-white/10 text-xl font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-lg font-bold text-rose-400">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                          className="h-9 w-9 rounded-xl bg-white/10 text-xl font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 ? (
              <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">Sana Ozel Oneri</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestUpsellProducts(2).map((product) => (
                    <button
                      key={`upsell-${product.id}`}
                      type="button"
                      onClick={() => quickAddProduct(product)}
                      className="rounded-full border border-emerald-200/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-50"
                    >
                      + {product.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span>Ara Toplam</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-4xl font-black text-rose-400">Toplam</span>
                <span className="text-5xl font-black text-rose-400">{formatPrice(cartTotal)}</span>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Pickup Adi</label>
                <input
                  type="text"
                  placeholder="Adiniz veya Sipariş No"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-400"
                />
              </div>
              {qrConfirmationEnabled ? (
                <label className="mb-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">
                  <input
                    type="checkbox"
                    checked={confirmationChecked}
                    onChange={(event) => setConfirmationChecked(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>Siparişi ve tutarı onayliyorum.</span>
                </label>
              ) : null}
              {submitError ? (
                <p className="mb-3 rounded-xl border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                  {submitError}
                </p>
              ) : null}
              {activeQrAccessToken || qrCodeIdentifier ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${paymentMethod === "cash" ? "bg-rose-500 text-white" : "bg-transparent text-slate-200"}`}
                    >
                      Nakit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${paymentMethod === "card" ? "bg-indigo-500 text-white" : "bg-transparent text-slate-200"}`}
                    >
                      Kart
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void submitOrder(paymentMethod);
                    }}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-[linear-gradient(135deg,#ff5f7a_0%,#ff385c_100%)] px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
                  >
                    {isSubmitting ? "Sipariş Gonderiliyor..." : `Siparişi ${paymentMethod === "cash" ? "Nakit" : "Kart"} Olarak Gonder`}
                  </button>
                </div>
              ) : (
                <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                  Sipariş verebilmek icin gecerli bir masa QR kodu okutmalisiniz.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 ${
      isCoffeeSelfService ? "text-amber-50" : ""
    }`}>
      <section className={`rounded-3xl border p-3 backdrop-blur ${
        isCoffeeSelfService
          ? "border-amber-200/10 bg-[#1b130f]/85 shadow-[0_18px_35px_rgba(12,8,6,0.52)]"
          : "border-white/10 bg-slate-900/65 shadow-[0_18px_35px_rgba(2,6,23,0.45)]"
      }`}>
        {isCoffeeSelfService ? (
          <div className="mb-3 rounded-2xl border border-amber-100/15 bg-amber-100/5 px-4 py-3 text-sm text-amber-50">
            Self-servis sipariş: ürünleri seçin, siparişi onaylayin, pickup adınizi girin.
          </div>
        ) : null}
        <div className={`sticky top-3 z-20 mb-3 rounded-2xl border px-2 py-2 backdrop-blur ${
          isCoffeeSelfService
            ? "border-amber-200/10 bg-[#2a1c14]/95 shadow-[0_10px_20px_rgba(15,8,5,0.36)]"
            : "border-white/10 bg-slate-900/95 shadow-[0_10px_20px_rgba(2,6,23,0.35)]"
        }`}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [scroll-behavior:smooth] [touch-action:pan-x]">
            <div className="flex min-w-max snap-x snap-mandatory gap-2">
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
                    className={`snap-start rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? (isCoffeeSelfService
                            ? "bg-[linear-gradient(135deg,#b86f3f_0%,#da9b5c_100%)] text-white shadow-[0_10px_20px_rgba(184,111,63,0.34)]"
                            : "bg-[linear-gradient(135deg,#ff6d3d_0%,#f0b04f_100%)] text-white shadow-[0_10px_20px_rgba(255,109,61,0.28)]")
                        : (isCoffeeSelfService
                            ? "border border-amber-100/10 bg-amber-50/5 text-amber-100"
                            : "border border-white/15 bg-white/5 text-slate-200")
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
          <p className={`rounded-2xl border px-4 py-5 text-sm ${isCoffeeSelfService ? "border-amber-100/10 bg-amber-100/5 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
            Bu kategori icin ürün bulunmuyor.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <article
                  key={product.id}
                  className={`overflow-hidden rounded-[10px] border text-left transition ${
                    isSelected
                      ? (isCoffeeSelfService
                          ? "border-amber-300/70 bg-[#2c1f17] shadow-[0_14px_26px_rgba(20,12,7,0.45)] ring-2 ring-amber-500/70"
                          : "border-amber-300/80 bg-[#11233d] shadow-[0_14px_26px_rgba(2,6,23,0.45)] ring-2 ring-amber-400")
                      : (isCoffeeSelfService
                          ? "border-[#4b3326] bg-[#261b15] shadow-[0_8px_20px_rgba(12,7,5,0.34)] hover:border-[#8a5c41]"
                          : "border-[#1e3356] bg-[#10213a] shadow-[0_8px_20px_rgba(2,6,23,0.35)] hover:border-[#325386]")
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const groups = groupsByProduct.get(product.id) ?? [];
                      const hasRequiredGroups = groups.some((group) => group.is_required);
                      if (hasRequiredGroups) {
                        handleProductSelect(product.id);
                        return;
                      }
                      quickAddProduct(product);
                    }}
                    className="w-full text-left"
                  >
                    {product.image_url ? (
                      <div className="relative h-[104px] w-full sm:h-28">
                        <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                      </div>
                    ) : (
                      <div className={`flex h-[104px] w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.12em] sm:h-28 ${
                        isCoffeeSelfService ? "bg-[#3a271d] text-amber-100" : "bg-[#1a2d4a] text-slate-300"
                      }`}>
                        Görsel Yok
                      </div>
                    )}
                    <div className="px-2.5 py-2.5">
                      <p className="text-[15px] font-semibold leadıng-5 text-white">{product.name}</p>
                      <p className={`mt-1 text-[14px] font-medium ${isCoffeeSelfService ? "text-amber-300" : "text-amber-400"}`}>{formatPrice(product.price)}</p>
                    </div>
                  </button>
                  <div className={`border-t px-2.5 py-2.5 ${isCoffeeSelfService ? "border-amber-100/10" : "border-white/10"}`}>
                    <button
                      type="button"
                      onClick={() => quickAddProduct(product)}
                      className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        isCoffeeSelfService
                          ? "border-amber-100/20 bg-amber-100/5 text-amber-50 hover:bg-amber-100/10"
                          : "border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                      }`}
                    >
                      Hizli Ekle (+1)
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {cartItems.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Seçilen Ürünler</p>
              <p className="text-xs text-slate-300">Sirayla eklenir</p>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              {cartItems.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-100">{index + 1}. {item.product.name}</span>
                  <span className="font-semibold text-amber-300">{item.quantity}x</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {selectedProduct && (
          <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
            <div>
              <p className="text-xl font-bold text-white">{selectedProduct.name}</p>
              <p className="mt-1 text-sm text-slate-300">{selectedProduct.description ?? "Açıklama bulunmuyor."}</p>
            </div>
            {modifierErrorGroupIds.length > 0 ? (
              <p className="rounded-xl border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                Zorunlu seçenekleri tamamlayin.
              </p>
            ) : null}
            {selectedProductGroups.length > 0 && (
              <div className="space-y-4">
                {selectedProductGroups.map((group) => {
                  const hasError = modifierErrorGroupIds.includes(group.id);
                  return (
                    <div
                      key={group.id}
                      ref={(node) => {
                        modifierGroupRefs.current[group.id] = node;
                      }}
                      className={`rounded-xl border p-4 ${hasError ? "border-rose-400 bg-rose-500/10" : "border-white/10 bg-white/5"}`}
                    >
                      <p className="mb-3 font-bold text-white">
                        {group.name}
                        {group.is_required ? <span className="ml-2 text-xs font-medium text-amber-400">Zorunlu</span> : null}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(optionsByGroup.get(group.id) ?? []).map((option) => {
                          const isOptSelected = selectedModifiers[group.id]?.id === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleModifierSelect(group.id, option)}
                              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition ${
                                isOptSelected
                                  ? "border-amber-400 bg-amber-400/10 text-amber-400"
                                  : "border-white/10 bg-slate-900/40 text-slate-200 hover:bg-slate-800"
                              }`}
                            >
                              <span className="font-medium">{option.name}</span>
                              <span className={isOptSelected ? "text-amber-400" : "text-slate-400"}>
                                {Number(option.price_delta) > 0 ? `+${Number(option.price_delta).toFixed(2)} TL` : "Dahil"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/20"
                >
                  -
                </button>
                <span className="w-4 text-center text-lg font-bold text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-10 w-10 rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/20"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#ff6d3d_0%,#f0b04f_100%)] px-6 py-3 font-bold text-white shadow-[0_4px_14px_rgba(255,109,61,0.4)] sm:w-auto"
              >
                Sepete Ekle
              </button>
            </div>
          </div>
        )}
      </section>

      {cartItems.length > 0 && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-300">{cartItemCount} Ürün</p>
                <p className="text-lg font-bold text-emerald-400">{formatPrice(cartTotal)}</p>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                className="w-full rounded-2xl bg-emerald-600 px-8 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,0.3)] transition hover:bg-emerald-500 sm:w-auto"
              >
                Sepeti Gor
              </button>
            </div>
          </div>

          {isCartOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 p-4">
                <h2 className="text-lg font-bold text-white">Sipariş Sepeti</h2>
                <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-white/10 p-2 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                      {(() => {
                        let unitTotal = Number(item.product.price);
                        for (const mod of Object.values(item.selectedModifiers)) {
                          unitTotal += Number(mod.price_delta);
                        }
                        return (
                          <>
                      <div className="flex items-start justify-between gap-2 font-semibold text-white">
                        <span className="min-w-0 break-words">
                          {item.quantity}x {item.product.name}
                        </span>
                        <span>{formatPrice(unitTotal * item.quantity)}</span>
                      </div>
                      {Object.values(item.selectedModifiers).length > 0 ? (
                        <div className="mt-2 text-sm text-slate-400">
                          {Object.values(item.selectedModifiers).map((mod) => (
                            <div key={mod.id} className="flex justify-between">
                              <span>+ {mod.name}</span>
                              {Number(mod.price_delta) > 0 ? <span>{formatPrice(Number(mod.price_delta))}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white"
                          >
                            -
                          </button>
                          <input
                            value={item.quantity}
                            onChange={(event) => updateCartItemQuantity(item.id, Number(event.target.value))}
                            inputMode="numeric"
                            className="h-8 w-14 rounded-lg border border-white/20 bg-white/5 px-2 text-center text-sm text-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white"
                          >
                            +
                          </button>
                        </div>
                      <button
                        onClick={() => {
                          setCartItems((prev) => prev.filter((i) => i.id !== item.id));
                          void trackFunnel("cart_remove", { cartItems: Math.max(0, cartItemCount - item.quantity), cartTotal });
                        }}
                        className="text-sm font-medium text-red-400"
                      >
                        Sepetten Çıkar
                      </button>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-900 p-6">
                <div className="mb-4 flex justify-between text-xl font-bold text-white">
                  <span>Toplam</span>
                  <span className="text-emerald-400">{formatPrice(cartTotal)}</span>
                </div>

                {submitError ? (
                  <p className="mb-3 rounded-xl border border-rose-300/50 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                    {submitError}
                  </p>
                ) : null}
                {activeQrAccessToken || qrCodeIdentifier ? (
                  qrConfirmationEnabled ? (
                    checkoutStep === "review" ? (
                      <button
                        onClick={() => {
                          setCheckoutStep("confirm");
                          void trackFunnel("checkout_confirm_view", { cartItems: cartItemCount, cartTotal });
                        }}
                        className="w-full rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] py-4 text-lg font-bold text-white shadow-[0_10px_25px_rgba(5,150,105,0.4)]"
                      >
                        Sipariş Ozetiyle Devam Et
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={confirmationChecked}
                            onChange={(event) => setConfirmationChecked(event.target.checked)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span>Siparişi ve tutarı onayliyorum.</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCheckoutStep("review")}
                            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                          >
                            Geri Dön
                          </button>
                          <button
                            onClick={() => {
                              void trackFunnel("checkout_confirm_ack", { cartItems: cartItemCount, cartTotal });
                              void submitOrder("cash");
                            }}
                            disabled={isSubmitting || !confirmationChecked}
                            className="w-full rounded-xl bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(5,150,105,0.4)] disabled:opacity-50"
                          >
                            {isSubmitting ? "Sipariş Gonderiliyor..." : "Son Onayla Gonder"}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        void submitOrder("cash");
                      }}
                      disabled={isSubmitting}
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] py-4 text-lg font-bold text-white shadow-[0_10px_25px_rgba(5,150,105,0.4)] disabled:opacity-50"
                    >
                      {isSubmitting ? "Sipariş Gonderiliyor..." : "Siparişi Onayla"}
                    </button>
                  )
                ) : (
                  <p className="text-center text-sm font-medium text-amber-400">
                    Sipariş verebilmek icin gecerli bir masa QR kodu okutmalisiniz.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

