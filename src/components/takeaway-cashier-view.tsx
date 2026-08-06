"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Coffee, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  CreditCard, 
  Banknote, 
  Sparkles, 
  Store, 
  ArrowLeft,
  CheckCircle2,
  ReceiptText
} from "lucide-react";
import { printToLocalDaemon } from "@/lib/offline-sync";
import { sendOkcPaymentRequest } from "@/lib/okc-integration";

type CoffeeItem = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
};

type SelectedModifier = {
  size: "Single" | "Medium" | "Large";
  milk: "Tam Yağlı" | "Yulaf Sütü (+15 TL)" | "Laktozsuz (+10 TL)";
  syrup: "Yok" | "Vanilya (+10 TL)" | "Karamel (+10 TL)" | "Fındık (+10 TL)";
  extraShot: boolean;
};

type CartItem = {
  cartId: string;
  product: CoffeeItem;
  modifiers: SelectedModifier;
  qty: number;
  totalPrice: number;
};

const demoCoffeeMenu: CoffeeItem[] = [
  { id: "c1", name: "Caffe Latte", category: "Sıcak Kahve", basePrice: 85.0 },
  { id: "c2", name: "Iced Americano", category: "Soğuk Kahve", basePrice: 75.0 },
  { id: "c3", name: "Cappuccino", category: "Sıcak Kahve", basePrice: 85.0 },
  { id: "c4", name: "Flat White", category: "Sıcak Kahve", basePrice: 90.0 },
  { id: "c5", name: "Iced Latte", category: "Soğuk Kahve", basePrice: 90.0 },
  { id: "c6", name: "Espresso Single", category: "Sıcak Kahve", basePrice: 60.0 },
  { id: "c7", name: "San Sebastian", category: "Tatlı", basePrice: 135.0 },
  { id: "c8", name: "Mocha", category: "Sıcak Kahve", basePrice: 95.0 },
];

export type TakeawayCashierViewProps = {
  /** Aktif işletme adı. Fiş başlığında ve ekran başlığında kullanılır.
      Eskiden "Holy Cup" sabit yazılıydı ve her işletmede o basılıyordu. */
  businessName?: string;
  branchName?: string;
};

export function TakeawayCashierView({
  businessName = "İşletme",
  branchName,
}: TakeawayCashierViewProps = {}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CoffeeItem | null>(null);
  const [modifiers, setModifiers] = useState<SelectedModifier>({
    size: "Medium",
    milk: "Tam Yağlı",
    syrup: "Yok",
    extraShot: false,
  });

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fiyat Hesaplayıcı
  const calculateItemPrice = (item: CoffeeItem, mods: SelectedModifier) => {
    let price = item.basePrice;
    if (mods.size === "Large") price += 15;
    if (mods.milk.includes("+15")) price += 15;
    if (mods.milk.includes("+10")) price += 10;
    if (mods.syrup !== "Yok") price += 10;
    if (mods.extraShot) price += 20;
    return price;
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const itemPrice = calculateItemPrice(selectedProduct, modifiers);
    const newItem: CartItem = {
      cartId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      product: selectedProduct,
      modifiers: { ...modifiers },
      qty: 1,
      totalPrice: itemPrice,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice * item.qty, 0);

  // Ödeme ve Fiş İşleme
  const handleCompleteOrder = async (paymentType: "cash" | "credit_card") => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setStatusMsg("Ödeme işleniyor ve fiş basılıyor...");

    // 1. ÖKC Yazarkasa İsteği
    await sendOkcPaymentRequest("beko", {
      orderId: `ORDER-${Date.now().toString().slice(-6)}`,
      amount: cartTotal,
      paymentType,
      customerName: customerName || "Kahve Sever",
    });

    // 2. 0.1s Fiş Basım Daemon İsteği
    const printSuccess = await printToLocalDaemon({
      businessName,
      headerNote: branchName ? `TAKEAWAY FİŞİ · ${branchName}` : "TAKEAWAY FİŞİ",
      orderId: `ORDER-${Date.now().toString().slice(-6)}`,
      customerName: customerName || "Müşteri",
      items: cart.map((c) => ({
        name: `${c.product.name} (${c.modifiers.size})`,
        qty: c.qty,
        price: c.totalPrice,
        modifiers: [
          c.modifiers.milk !== "Tam Yağlı" ? c.modifiers.milk : null,
          c.modifiers.syrup !== "Yok" ? `Şurup: ${c.modifiers.syrup}` : null,
          c.modifiers.extraShot ? "Ekstra Shot" : null,
        ].filter(Boolean),
      })),
      total: cartTotal,
    });

    if (printSuccess) {
      setStatusMsg("✅ Ödeme Alındı & Fiş Yazıcıdan Basıldı (0.1s)");
    } else {
      setStatusMsg("✅ Ödeme Alındı! (Yazıcı simüle edildi)");
    }

    setCart([]);
    setCustomerName("");
    setIsProcessing(false);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-3 sm:p-6 flex flex-col justify-between selection:bg-red-600 selection:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/m/ops"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-red-600 text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">{businessName} · Takeaway Kasa</h1>
            <p className="text-xs text-zinc-400">{branchName ?? "Hızlı dokunmatik sipariş paneli"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Müşteri İsim / No..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 w-40 sm:w-56"
          />
        </div>
      </div>

      {/* Notification Banner */}
      {statusMsg && (
        <div className="my-3 p-3.5 rounded-xl bg-zinc-900 border border-red-600/40 text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-red-500 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Main Grid: Left Menu & Right Cart */}
      <div className="my-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Menu Items (8 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Hızlı Kahve Seçimi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {demoCoffeeMenu.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedProduct(item)}
                className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-red-600/60 hover:bg-zinc-800 transition text-left flex flex-col justify-between min-h-[100px] cursor-pointer group"
              >
                <div>
                  <span className="text-[10px] font-bold text-red-400 uppercase">{item.category}</span>
                  <p className="text-sm font-black text-white group-hover:text-red-400 transition-colors mt-0.5">{item.name}</p>
                </div>
                <p className="text-xs font-bold text-zinc-300 mt-2">{item.basePrice.toFixed(2)} TL</p>
              </button>
            ))}
          </div>

          {/* Modifier Modal / Panel when item selected */}
          {selectedProduct && (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-red-600/40 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-black text-white">{selectedProduct.name} - Kahve Opsiyonları</h3>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-xs text-zinc-400 hover:text-white">İptal</button>
              </div>

              {/* Size Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-400 uppercase">Boyut</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Single", "Medium", "Large"] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setModifiers((m) => ({ ...m, size: sz }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${modifiers.size === sz ? "bg-red-950 border-red-600 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}
                    >
                      {sz} {sz === "Large" ? "(+15 TL)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Milk Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-400 uppercase">Süt Tipi</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Tam Yağlı", "Yulaf Sütü (+15 TL)", "Laktozsuz (+10 TL)"] as const).map((mlk) => (
                    <button
                      key={mlk}
                      type="button"
                      onClick={() => setModifiers((m) => ({ ...m, milk: mlk }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${modifiers.milk === mlk ? "bg-red-950 border-red-600 text-white" : "bg-black border-zinc-800 text-zinc-400"}`}
                    >
                      {mlk}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Shot */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Ekstra Espresso Shot (+20 TL)</span>
                <button
                  type="button"
                  onClick={() => setModifiers((m) => ({ ...m, extraShot: !m.extraShot }))}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${modifiers.extraShot ? "bg-red-600 text-white border-red-500" : "bg-black text-zinc-400 border-zinc-800"}`}
                >
                  {modifiers.extraShot ? "Eklendi (+20 TL)" : "+ Ekle"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full pos-btn-red py-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Sepete Ekle • {calculateItemPrice(selectedProduct, modifiers).toFixed(2)} TL
              </button>
            </div>
          )}
        </div>

        {/* Right Cart Section (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Adisyon / Sipariş Sepeti</h2>
              <span className="text-xs text-red-400 font-bold">{cart.length} Kalem</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Sepet henüz boş. Sol taraftan ürün seçin.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.cartId} className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{item.product.name} ({item.modifiers.size})</p>
                      <p className="text-[10px] text-zinc-400">
                        {item.modifiers.milk !== "Tam Yağlı" && `${item.modifiers.milk} • `}
                        {item.modifiers.extraShot && "Ekstra Shot"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-white">{(item.totalPrice * item.qty).toFixed(2)} TL</span>
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((i) => i.cartId !== item.cartId))}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Area */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="flex justify-between items-center text-lg font-black text-white">
              <span>TOPLAM TUTAR:</span>
              <span className="text-red-500">{cartTotal.toFixed(2)} TL</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={() => handleCompleteOrder("cash")}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-zinc-700"
              >
                <Banknote className="h-4 w-4 text-emerald-400" />
                <span>NAKİT ÖDENDİ</span>
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={() => handleCompleteOrder("credit_card")}
                className="pos-btn-red p-3 rounded-xl disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="h-4 w-4 text-white" />
                <span>POS / ÖKC FİŞİ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
