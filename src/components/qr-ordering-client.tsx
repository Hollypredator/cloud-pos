"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Category, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";

type CartItem = {
  id: string; // unique ID for cart row
  product: Product;
  quantity: number;
  selectedModifiers: Record<string, ProductModifierOption>; // group_id -> option
};

export function QrOrderingClient({
  categories,
  products,
  modifierGroups,
  modifierOptions,
  businessSlug,
  qrCodeIdentifier,
  qrAccessToken,
}: {
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  businessSlug?: string;
  qrCodeIdentifier?: string;
  qrAccessToken?: string;
}) {
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
    [categories],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => orderedCategories[0]?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Active product selections
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ProductModifierOption>>({});

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

  // Reset selections when opening a product
  const handleProductSelect = (productId: string) => {
    if (selectedProductId === productId) {
      setSelectedProductId(null);
    } else {
      setSelectedProductId(productId);
      setQuantity(1);
      // Auto-select defaults
      const initialModifiers: Record<string, ProductModifierOption> = {};
      const groups = groupsByProduct.get(productId) ?? [];
      for (const group of groups) {
        const options = optionsByGroup.get(group.id) ?? [];
        const defaultOpt = options.find((o) => o.is_default) || (group.is_required ? options[0] : null);
        if (defaultOpt) {
          initialModifiers[group.id] = defaultOpt;
        }
      }
      setSelectedModifiers(initialModifiers);
    }
  };

  const handleModifierSelect = (groupId: string, option: ProductModifierOption) => {
    setSelectedModifiers((prev) => ({ ...prev, [groupId]: option }));
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    // Check required groups
    for (const group of selectedProductGroups) {
      if (group.is_required && !selectedModifiers[group.id]) {
        alert(`Lütfen ${group.name} seçimi yapın.`);
        return;
      }
    }

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product: selectedProduct,
      quantity,
      selectedModifiers: { ...selectedModifiers },
    };
    setCartItems((prev) => [...prev, newItem]);
    setSelectedProductId(null);
  };

  const cartTotal = cartItems.reduce((acc, item) => {
    let itemPrice = Number(item.product.price);
    for (const mod of Object.values(item.selectedModifiers)) {
      itemPrice += Number(mod.price_delta);
    }
    return acc + itemPrice * item.quantity;
  }, 0);

  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const formatPrice = (value: number) => `${Number(value).toFixed(2)} TL`;

  const submitOrder = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    
    const payloadItems = cartItems.map((item) => {
      const modifiersArray = Object.values(item.selectedModifiers).map(mod => {
        const group = modifierGroups.find(g => g.id === mod.group_id);
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

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCodeIdentifier,
          qrAccessToken,
          businessSlug,
          items: payloadItems,
          totalPrice: cartTotal,
        }),
      });

      if (res.ok) {
        setCartItems([]);
        setIsCartOpen(false);
        setOrderSuccess(true);
      } else {
        const err = await res.json();
        alert(`Sipariş gönderilemedi: ${err.message}`);
      }
    } catch {
      alert("Bağlantı hatası oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 rounded-full bg-emerald-500/20 p-4">
          <svg className="h-16 w-16 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Siparişiniz Alındı!</h1>
        <p className="text-slate-300 mb-8">Siparişiniz mutfağa iletildi. Afiyet olsun.</p>
        <button 
          onClick={() => setOrderSuccess(false)}
          className="rounded-2xl bg-slate-800 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Menüye Dön
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/65 p-3 shadow-[0_18px_35px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="sticky top-3 z-20 mb-3 rounded-2xl border border-white/10 bg-slate-900/95 px-2 py-2 shadow-[0_10px_20px_rgba(2,6,23,0.35)] backdrop-blur">
          <div className="overflow-x-auto pb-1 scrollbar-hide">
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
                  onClick={() => handleProductSelect(product.id)}
                  className={`overflow-hidden rounded-[10px] border text-left transition ${
                    isSelected
                      ? "border-amber-300/80 bg-[#11233d] shadow-[0_14px_26px_rgba(2,6,23,0.45)] ring-2 ring-amber-400"
                      : "border-[#1e3356] bg-[#10213a] shadow-[0_8px_20px_rgba(2,6,23,0.35)] hover:border-[#325386]"
                  }`}
                >
                  {product.image_url ? (
                    <div className="relative h-[104px] w-full sm:h-28">
                      <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-[104px] w-full items-center justify-center bg-[#1a2d4a] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 sm:h-28">
                      Görsel Yok
                    </div>
                  )}
                  <div className="px-2.5 py-2.5">
                    <p className="text-[15px] font-semibold leading-5 text-white">{product.name}</p>
                    <p className="mt-1 text-[14px] font-medium text-amber-400">{formatPrice(product.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedProduct && (
          <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
            <div>
              <p className="text-xl font-bold text-white">{selectedProduct.name}</p>
              <p className="mt-1 text-sm text-slate-300">{selectedProduct.description ?? "Açıklama bulunmuyor."}</p>
            </div>
            {selectedProductGroups.length > 0 && (
              <div className="space-y-4">
                {selectedProductGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-bold text-white mb-3">
                      {group.name}
                      {group.is_required && <span className="ml-2 text-xs text-amber-400 font-medium">Zorunlu</span>}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(optionsByGroup.get(group.id) ?? []).map((option) => {
                        const isOptSelected = selectedModifiers[group.id]?.id === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleModifierSelect(group.id, option)}
                            className={`flex justify-between items-center rounded-xl border px-3 py-3 text-sm transition ${
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
                ))}
              </div>
            )}
            
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="h-10 w-10 rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/20"
                >-</button>
                <span className="text-lg font-bold text-white w-4 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(q => q + 1)}
                  className="h-10 w-10 rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/20"
                >+</button>
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
                Sepeti Gör
              </button>
            </div>
          </div>

          {isCartOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 p-4">
                <h2 className="text-lg font-bold text-white">Sipariş Sepeti</h2>
                <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-white/10 p-2 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                      <div className="flex items-start justify-between gap-2 font-semibold text-white">
                        <span className="min-w-0 break-words">{item.quantity}x {item.product.name}</span>
                        <span>{formatPrice(Number(item.product.price) * item.quantity)}</span>
                      </div>
                      {Object.values(item.selectedModifiers).length > 0 && (
                        <div className="mt-2 text-sm text-slate-400">
                          {Object.values(item.selectedModifiers).map(mod => (
                            <div key={mod.id} className="flex justify-between">
                              <span>+ {mod.name}</span>
                              {Number(mod.price_delta) > 0 && <span>{formatPrice(Number(mod.price_delta))}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      <button 
                        onClick={() => setCartItems(prev => prev.filter(i => i.id !== item.id))}
                        className="mt-3 text-sm text-red-400 font-medium"
                      >
                        Sepetten Çıkar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-900 p-6">
                <div className="mb-4 flex justify-between text-xl font-bold text-white">
                  <span>Toplam</span>
                  <span className="text-emerald-400">{formatPrice(cartTotal)}</span>
                </div>
                {qrAccessToken ? (
                  <button
                    onClick={submitOrder}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] py-4 text-lg font-bold text-white shadow-[0_10px_25px_rgba(5,150,105,0.4)] disabled:opacity-50"
                  >
                    {isSubmitting ? "Sipariş Gönderiliyor..." : "Siparişi Onayla"}
                  </button>
                ) : (
                  <p className="text-center text-sm text-amber-400 font-medium">
                    Sipariş verebilmek için geçerli bir masa QR kodu okutmalısınız.
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

