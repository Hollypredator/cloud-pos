"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudOff, Loader2, Printer, TriangleAlert } from "lucide-react";
import { AdminOrderEntry, type OrderSubmitPayload, type OrderSubmitResult } from "@/components/admin-order-entry";
import {
  countFailed,
  countPending,
  enqueueCommand,
  onQueueChanged,
  startAutoSync,
} from "@/lib/offline-queue";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { printReceipt } from "@/lib/receipt-print";
import { loadCatalog, snapshotAgeMinutes, type CatalogSnapshot } from "@/lib/offline/catalog-store";
import { freezeCartConsumption } from "@/lib/offline/catalog-consumption";
import type {
  Category,
  DiningTable,
  OperatingProfile,
  OperatingProfileCapabilities,
  PaymentMethod,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from "@/lib/types";

/**
 * Self-servis kasa: siparis + odeme tek akista.
 *
 * `AdminOrderEntry` yeniden yazilmadi — zaten gercek menuyu ve modifier gruplarini
 * tuketiyor, `/api/orders`'a yaziyor ve `entryMode: "classic"` ile masa secimi
 * istemiyor. Eksik olan tek sey odemeydi: o bilesende "payment" kelimesi hic
 * gecmiyor, odeme `/cashier`'da ayri bir ekranda aliniyordu.
 *
 * Burada yapilan: siparis acildiktan hemen sonra ayni akista odemeyi kapatmak,
 * fisi basmak ve kasa cekmecesini acmak. Kafe profilinin `pay_at_order` tanimi
 * boylece fiilen uygulanmis oluyor.
 */

export type SelfServiceCheckoutProps = {
  businessSlug: string;
  businessName: string;
  branchName?: string | null;
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  tables: DiningTable[];
  operatingProfile: OperatingProfile;
  operatingCapabilities: OperatingProfileCapabilities;
  layoutMode: "auto" | "mobile_stack" | "tablet_3pane";
  mobilePresentation: "stack" | "default";
  /** Yazici IP'si bos ise servis yerel USB/stdout ciktisina duser. */
  printerIp?: string;
  /** Cekmece yaziciya bagli degilse kapatilir. */
  drawerEnabled?: boolean;
};

type TakeawaySaleResponse = {
  ok: boolean;
  message?: string;
  remaining?: number;
  receipt?: {
    orderNo: string | null;
    customerName: string | null;
    items: Array<{ name: string; qty: number; lineTotal: number; modifiers: string[] }>;
    subtotal: number;
    discount: number;
    total: number;
    paymentLabel: string;
  } | null;
};

type Status = {
  tone: "info" | "success" | "error" | "warning";
  message: string;
};

/**
 * Siparis kalemlerini fis satirlarina cevirir.
 *
 * `AdminOrderEntry` kalemleri `{ name, quantity, line_total, modifiers }` seklinde
 * uretiyor; fis servisi `{ name, qty, lineTotal, modifiers[] }` bekliyor.
 */
function toReceiptItems(payload?: OrderSubmitPayload) {
  if (!payload) return [];

  return payload.items.map((raw) => {
    const item = raw as {
      name?: unknown;
      quantity?: unknown;
      line_total?: unknown;
      modifiers?: Array<{ option_name?: unknown; price_delta?: unknown }>;
    };

    return {
      name: typeof item.name === "string" ? item.name : "Ürün",
      qty: typeof item.quantity === "number" ? item.quantity : 1,
      lineTotal: typeof item.line_total === "number" ? item.line_total : 0,
      modifiers: (item.modifiers ?? []).map((modifier) => {
        const optionName = typeof modifier.option_name === "string" ? modifier.option_name : "";
        const priceDelta = typeof modifier.price_delta === "number" ? modifier.price_delta : 0;
        return priceDelta
          ? `${optionName} (${priceDelta > 0 ? "+" : ""}${priceDelta.toFixed(2)} TL)`
          : optionName;
      }),
    };
  });
}

/**
 * Siparis kalemlerini tuketim cozumu girdisine cevirir.
 *
 * Sepet sirasi korunur: cevrimdisi satista order_items.id henuz yok,
 * eslesme indeks uzerinden yapilir.
 */
function toCartLines(payload: OrderSubmitPayload) {
  return payload.items.map((raw) => {
    const item = raw as {
      product_id?: unknown;
      quantity?: unknown;
      modifiers?: Array<{ option_id?: unknown }>;
    };
    return {
      productId: typeof item.product_id === "string" ? item.product_id : null,
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      modifierOptionIds: (item.modifiers ?? [])
        .map((modifier) => (typeof modifier.option_id === "string" ? modifier.option_id : null))
        .filter((value): value is string => Boolean(value)),
    };
  });
}

export function SelfServiceCheckout({
  businessSlug,
  businessName,
  branchName,
  categories,
  products,
  modifierGroups,
  modifierOptions,
  tables,
  operatingProfile,
  operatingCapabilities,
  layoutMode,
  mobilePresentation,
  printerIp,
  drawerEnabled = true,
}: SelfServiceCheckoutProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [queuePanelOpen, setQueuePanelOpen] = useState(false);

  /**
   * Onbellekli katalog. Sunucu props'u yalnizca ilk boyama icin; mount'tan
   * sonra kaynak yerel depo olur.
   *
   * Sebep: sayfa sunucu bileseni oldugu icin cevrimdisiyken menu hic
   * gelmiyordu. Service worker gezinmeyi onbelleklese bile veri bayat ve
   * yasi bilinmiyordu. Simdi yas biliniyor ve ekranda yaziyor.
   */
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);

  /**
   * Cevrimdisi satislarin sepet icerigi. Fis basimi icin tutulur; senkron
   * tamamlandiginda kaydin islevi biter.
   */
  const offlineCartsRef = useRef(new Map<string, OrderSubmitPayload>());

  const refreshQueue = useCallback(() => {
    void countPending().then(setPending).catch(() => {});
    void countFailed().then(setFailed).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog({ signal: controller.signal })
      .then((result) => {
        if (result.status === "empty") {
          setCatalogNote(result.reason);
          return;
        }
        setCatalog(result.snapshot);
        if (result.status === "cached") {
          const age = snapshotAgeMinutes(result.snapshot);
          setCatalogNote(
            age === null
              ? `${result.reason}: yerel katalog kullanılıyor.`
              : `${result.reason}: katalog ${age} dk önce güncellendi.`,
          );
        } else {
          setCatalogNote(null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const apply = () => setOnline(navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);

    const stopAutoSync = startAutoSync();
    const stopWatching = onQueueChanged(refreshQueue);
    refreshQueue();

    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
      stopAutoSync();
      stopWatching();
    };
  }, [refreshQueue]);

  /**
   * Cevrimdisiyken siparis kuyruga yazilir.
   *
   * Kuyruk kaydi sunucu kimligi uretmez; bu yuzden yerel bir referans doner.
   * Siparis numarasi (`checkNumber`) senkron sonrasi sunucuda olusur — cevrimdisi
   * numara uretip sonra degistirmek, musteriye verilen sira numarasinin tutmamasi
   * demek olurdu.
   */
  const submitOrderOffline = async (payload: OrderSubmitPayload): Promise<OrderSubmitResult> => {
    const groupId = crypto.randomUUID();
    try {
      // Fis icerigi icin sepet saklanir. Cevrimdisiyken sunucudan fis verisi
      // alinamiyor; saklamazsak musteriye kalemsiz, 0,00 TL yazan bir fis
      // basiliyordu.
      offlineCartsRef.current.set(groupId, payload);
      await enqueueCommand({
        type: "ORDER_CREATE",
        groupId,
        idempotencyKey: `order-${groupId}`,
        payload: {
          table_id: payload.tableId ?? null,
          channel: payload.channel,
          customer_name: payload.customerName,
          customer_phone: payload.customerPhone,
          delivery_address: payload.deliveryAddress,
          delivery_note: payload.deliveryNote,
          items: payload.items,
          total_price: payload.totalPrice,
          // Tuketim SATIS ANINDA donduruluyor. Sunucuda cozulseydi bu siparis
          // saatler sonra senkron oldugunda o anki receteyle dusum yapardi;
          // recete degismisse satilan kahve ile dusen malzeme tutmazdi.
          frozen_consumption: catalog ? freezeCartConsumption(catalog, toCartLines(payload)) : [],
        },
      });
      return { ok: true, orderId: `offline:${groupId}`, checkNumber: null };
    } catch {
      return { ok: false, message: "Sipariş çevrimdışı kuyruğa yazılamadı." };
    }
  };

  const handleOrderSubmit = async (payload: OrderSubmitPayload): Promise<OrderSubmitResult> => {
    if (!navigator.onLine) {
      return submitOrderOffline(payload);
    }

    try {
      // Cevrimiciyken de tuketim istemcide donduruluyor: kural tek yerde,
      // "satis aninda dondur" ilkesi cevrimici/cevrimdisi ayrimi yapmaz.
      const frozenConsumption = catalog ? freezeCartConsumption(catalog, toCartLines(payload)) : [];
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, frozenConsumption }),
      });
      const data = (await response.json()) as OrderSubmitResult;
      if (!response.ok) {
        return { ...data, ok: false };
      }
      return data;
    } catch {
      // Ag `navigator.onLine` true iken de kopmus olabilir. Siparisi
      // kaybetmemek icin kuyruga dusuruluyor.
      return submitOrderOffline(payload);
    }
  };

  const handleOrderCreated = async (orderId: string, paymentMethod: PaymentMethod = "cash") => {
    // Cevrimdisi siparis: odeme de kuyruga yazilir, fis yerel basilir.
    if (orderId.startsWith("offline:")) {
      const groupId = orderId.slice("offline:".length);
      await enqueueCommand({
        type: "PAYMENT_SALE_CASH",
        groupId,
        idempotencyKey: `pay-${groupId}`,
        // order_id senkron sirasinda sunucuda cozulur; kuyruk sirali gonderim
        // yaptigi icin siparis her zaman odemeden once islenir.
        payload: { order_id: `offline:${groupId}`, method: paymentMethod },
      });
      // Fis yerel yaziciya gider — internetten bagimsiz. Icerik saklanan
      // sepetten kurulur; sunucudan fis verisi ancak senkron sonrasi alinabilir.
      // Sira numarasi da o zaman olusur, bu yuzden fise yazilmaz.
      const cart = offlineCartsRef.current.get(groupId);
      const printed = await printReceipt({
        businessName,
        branchName: branchName ?? undefined,
        orderNo: null,
        customerName: cart?.customerName ?? null,
        items: toReceiptItems(cart),
        total: cart?.totalPrice ?? 0,
        paymentLabel: paymentMethod === "cash" ? "Nakit" : "Kart",
        footerNote: "CEVRIMDISI SATIS - SIRA NO SENKRON SONRASI",
        printerIp,
        openDrawer: drawerEnabled,
      });

      offlineCartsRef.current.delete(groupId);

      setStatus({
        tone: "warning",
        message: printed.ok
          ? "Çevrimdışı: sipariş ve ödeme kuyruğa alındı, çekmece açıldı. Bağlantı gelince gönderilecek."
          : `Çevrimdışı: sipariş ve ödeme kuyruğa alındı. Fiş basılamadı: ${printed.error}`,
      });
      return;
    }

    setBusy(true);
    setStatus({ tone: "info", message: "Ödeme kaydediliyor..." });

    // Server action yerine API rotasi: `AdminOrderEntry` siparis sonrasi
    // `live-ops:update` yayinliyor, RSC tazelemesi akistaki server action'i
    // iptal ediyordu (net::ERR_ABORTED) ve odeme hic calismiyordu.
    // Idempotency anahtari siparis kimliginden turetiliyor: ikinci cagri
    // tekrar tahsilat yapmaz.
    let sale: TakeawaySaleResponse;
    try {
      const response = await fetch("/api/takeaway/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method: paymentMethod, idempotencyKey: `takeaway-pay-${orderId}` }),
        // Sayfa tazelenirken istek yarida kalmasin.
        keepalive: true,
      });
      sale = (await response.json()) as TakeawaySaleResponse;
      if (!response.ok) sale = { ...sale, ok: false };
    } catch {
      sale = { ok: false, message: "Ödeme isteği gönderilemedi. Bağlantıyı kontrol edin." };
    }

    if (!sale.ok) {
      setBusy(false);
      setStatus({ tone: "error", message: sale.message ?? "Ödeme alınamadı." });
      return;
    }

    if (!sale.receipt) {
      setBusy(false);
      setStatus({ tone: "warning", message: `${sale.message ?? "Ödeme alındı."} Fiş verisi alınamadı, fiş basılmadı.` });
      return;
    }

    setStatus({ tone: "info", message: "Fiş basılıyor..." });

    const printed = await printReceipt({
      businessName,
      branchName: branchName ?? undefined,
      orderNo: sale.receipt.orderNo,
      customerName: sale.receipt.customerName,
      items: sale.receipt.items,
      subtotal: sale.receipt.subtotal,
      discount: sale.receipt.discount,
      total: sale.receipt.total,
      paymentLabel: sale.receipt.paymentLabel,
      printerIp,
      openDrawer: drawerEnabled,
    });

    setBusy(false);

    if (printed.ok) {
      const orderLabel = sale.receipt.orderNo ? ` Sıra: ${sale.receipt.orderNo}` : "";
      setStatus({
        tone: "success",
        message: `${sale.message}${orderLabel} Fiş basıldı${drawerEnabled ? ", çekmece açıldı" : ""}.`,
      });
      // Mesaj kendiliginden kaybolmuyor: kasiyer sirt donuk olabilir, satisin
      // sonucunu kacirmamali. Sonraki satista zaten yenileniyor.
      return;
    }

    // Odeme kaydedildi ama fis basilmadi. Bu ikisini ayirmak onemli: kasiyer
    // odemeyi tekrar almamali, yalnizca fisi yeniden basmali.
    setStatus({
      tone: "warning",
      message: `${sale.message} Ancak fiş basılamadı: ${printed.error}`,
    });
  };

  const toneClass = (tone: Status["tone"]) => {
    if (tone === "success") return "border-emerald-500/40 bg-emerald-950/50 text-emerald-200";
    if (tone === "error") return "border-red-500/40 bg-red-950/50 text-red-200";
    if (tone === "warning") return "border-amber-500/40 bg-amber-950/50 text-amber-200";
    return "border-white/10 bg-white/5 text-white/70";
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Odeme yontemi sepetteki Nakit/Kart dugmelerinden gelir; ayri bir secici
          eklemek ayni secimi iki yerde sormak olurdu. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="ml-auto flex items-center gap-3">
          {!online || pending > 0 || failed > 0 ? (
            // Basarisiz kayit varsa rozet tiklanabilir: sayiyi gorup ne
            // yapacagini bilememek, kaydin unutulmasi demek.
            <button
              type="button"
              onClick={() => (failed > 0 ? setQueuePanelOpen((open) => !open) : undefined)}
              aria-expanded={failed > 0 ? queuePanelOpen : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                failed > 0
                  ? "cursor-pointer border-red-500/40 bg-red-950/50 text-red-200 hover:bg-red-900/50"
                  : "cursor-default border-amber-500/40 bg-amber-950/50 text-amber-200"
              }`}
            >
              <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
              {!online ? "Çevrimdışı" : "Senkron bekliyor"}
              {pending > 0 ? ` · ${pending} bekliyor` : ""}
              {failed > 0 ? ` · ${failed} başarısız` : ""}
            </button>
          ) : null}

          {/* ÖKC bagli olmadigi surece basilan sey mali fis degildir. */}
          <span className="flex items-center gap-1.5 text-[11px] text-white/35">
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Adisyon fişi · mali fiş değil
          </span>
        </div>
      </div>

      {/* Bayat katalogla calismak sorun degil; BILMEDEN calismak sorun.
          Yasi gosterilir, karari kasiyer verir. */}
      {catalogNote ? (
        <p className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-200">
          <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {catalogNote}
        </p>
      ) : null}

      {queuePanelOpen && failed > 0 ? (
        <OfflineQueuePanel onClose={() => setQueuePanelOpen(false)} />
      ) : null}

      {status ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold ${toneClass(status.tone)}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : status.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : status.tone === "error" || status.tone === "warning" ? (
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : null}
          <span>{status.message}</span>
        </div>
      ) : null}

      {/* Flex konteyner olmak ZORUNDA: AdminOrderEntry'nin self-servis kolu
          `flex flex-1 min-h-0` bir <section> donduruyor ve yuksekligini
          ebeveyninden aliyor. Burasi `block` kalirsa o flex-1 hicbir ise
          yaramaz, section icerik boyu kadar uzar, icindeki overflow-y-auto
          sinirlanamaz ve en disdaki overflow-hidden ekranin altini keser —
          sepete ve odeme butonlarina erisilemez. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <AdminOrderEntry
          businessSlug={businessSlug}
          categories={catalog?.menu.categories ?? categories}
          products={catalog?.menu.products ?? products}
          modifierGroups={catalog?.menu.modifierGroups ?? modifierGroups}
          modifierOptions={catalog?.menu.modifierOptions ?? modifierOptions}
          tables={tables}
          businessName={businessName}
          branchName={branchName}
          entryMode="classic"
          layoutMode={layoutMode}
          initialView="composer"
          operatingProfile={operatingProfile}
          operatingCapabilities={operatingCapabilities}
          mobilePresentation={mobilePresentation}
          selfServiceModifierFlow="stepped"
          onSubmitOrder={handleOrderSubmit}
          onOrderCreated={handleOrderCreated}
        />
      </div>
    </div>
  );
}
