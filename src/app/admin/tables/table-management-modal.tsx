"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { EmptyPanel } from "@/components/backoffice-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { normalizeLocale, translateUiText } from "@/lib/i18n";
import type { Category, DiningTable, Order, Product, ProductModifierGroup, ProductModifierOption, TableZone } from "@/lib/types";
import { assignTableZoneAction, deleteTableAction, moveTableOrderAction, updateTableAction, updateTableStatusAction } from "./actions";
import { orderTone, tableStatusLabel } from "./helpers";

type TableOrderSummary = {
  id: string;
  check_number?: string | null;
  final_price?: number;
  total_price: number;
  status: string;
  remaining_balance?: number;
};

type TableOrderHistoryItem = {
  id: string;
  check_number?: string | null;
  created_at: string;
  status: string;
  final_price?: number;
  total_price: number;
  amount_paid?: number;
  remaining_balance?: number;
};

type ModalTab = "order" | "history" | "ops";
type LiveHistoryResponse = {
  ok: boolean;
  latestOrder: {
    id: string;
    checkNumber?: string | null;
    status: string;
    totalPrice: number;
    finalPrice: number;
    remainingBalance: number;
    createdAt: string;
  } | null;
  orders: Array<{
    id: string;
    checkNumber?: string | null;
    status: string;
    totalPrice: number;
    finalPrice: number;
    amountPaid: number;
    remainingBalance: number;
    createdAt: string;
  }>;
};

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

export function TableManagementModal({
  table,
  latestOrder,
  orders,
  qrTarget,
  qrImage,
  movableTables,
  businessSlug,
  categories,
  products,
  modifierGroups,
  modifierOptions,
  allTables,
  zones,
  receiptDetailsByOrderId,
}: {
  table: DiningTable;
  latestOrder: TableOrderSummary | null;
  orders: TableOrderHistoryItem[];
  qrTarget: string;
  qrImage: string;
  movableTables: Array<{ id: string; label: string }>;
  businessSlug: string;
  categories: Category[];
  products: Product[];
  modifierGroups: ProductModifierGroup[];
  modifierOptions: ProductModifierOption[];
  allTables: DiningTable[];
  zones: TableZone[];
  receiptDetailsByOrderId: Record<string, Order>;
}) {
  const locale = normalizeLocale(document.documentElement.lang || "tr");
  const [activeTab, setActiveTab] = useState<ModalTab>("order");
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [liveLatestOrder, setLiveLatestOrder] = useState<TableOrderSummary | null>(latestOrder);
  const [historyOrders, setHistoryOrders] = useState<TableOrderHistoryItem[]>(orders);
  const [receiptDetails, setReceiptDetails] = useState<Record<string, Order>>(receiptDetailsByOrderId);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [receiptLoadingOrderId, setReceiptLoadingOrderId] = useState<string | null>(null);
  const syncInFlightRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const receiptPreviewRef = useRef<HTMLDivElement | null>(null);
  const handlePreviewPrint = () => {
    if (!receiptPreviewRef.current) {
      return;
    }
    document.body.classList.add("printing-inline-receipt");
    const clear = () => document.body.classList.remove("printing-inline-receipt");
    window.addEventListener("afterprint", clear, { once: true });
    window.print();
    window.setTimeout(clear, 500);
  };

  const refreshOrderData = useCallback(async (silent = true) => {
    if (syncInFlightRef.current) {
      return;
    }
    if (silent && Date.now() - lastSyncedAtRef.current < 1200) {
      return;
    }
    syncInFlightRef.current = true;
    if (!silent) {
      setHistoryLoading(true);
    }
    try {
      const response = await fetch(`/api/admin/tables/${encodeURIComponent(table.id)}/history?limit=8`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as LiveHistoryResponse;
      if (!data.ok) {
        return;
      }
      setLiveLatestOrder(
        data.latestOrder
          ? {
              id: data.latestOrder.id,
              check_number: data.latestOrder.checkNumber ?? null,
              status: data.latestOrder.status,
              total_price: Number(data.latestOrder.totalPrice),
              final_price: Number(data.latestOrder.finalPrice),
              remaining_balance: Number(data.latestOrder.remainingBalance),
            }
          : null,
      );
      setHistoryOrders(
        data.orders.map((order) => ({
          id: order.id,
          check_number: order.checkNumber ?? null,
          status: order.status,
          total_price: Number(order.totalPrice),
          final_price: Number(order.finalPrice),
          amount_paid: Number(order.amountPaid),
          remaining_balance: Number(order.remainingBalance),
          created_at: order.createdAt,
        })),
      );
      lastSyncedAtRef.current = Date.now();
    } finally {
      syncInFlightRef.current = false;
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, [table.id]);

  async function openReceiptPreview(orderId: string) {
    setPreviewOrderId(orderId);
    if (receiptDetails[orderId]) {
      return;
    }

    setReceiptLoadingOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/receipt`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { ok: boolean; order?: Order };
      if (!data.ok || !data.order) {
        return;
      }
      setReceiptDetails((prev) => ({ ...prev, [orderId]: data.order as Order }));
    } finally {
      setReceiptLoadingOrderId(null);
    }
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runSync = async (silent = true) => {
      if (!active) {
        return;
      }
      await refreshOrderData(silent);
      if (!active) {
        return;
      }
      timer = setTimeout(() => {
        void runSync(true);
      }, document.hidden ? 12000 : 3500);
    };

    const handleAttentionRefresh = (event?: Event) => {
      if (document.hidden) {
        return;
      }
      const detail = (event as CustomEvent<{ tables?: string[] }> | undefined)?.detail;
      if (detail && Array.isArray(detail.tables) && !detail.tables.some((tableName) => tableName === "orders" || tableName === "payments")) {
        return;
      }
      void refreshOrderData(true);
    };

    void runSync(true);
    window.addEventListener("focus", handleAttentionRefresh);
    document.addEventListener("visibilitychange", handleAttentionRefresh);
    window.addEventListener("live-ops:update", handleAttentionRefresh);

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
      window.removeEventListener("focus", handleAttentionRefresh);
      document.removeEventListener("visibilitychange", handleAttentionRefresh);
      window.removeEventListener("live-ops:update", handleAttentionRefresh);
    };
  }, [refreshOrderData]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="panel-surface h-[100dvh] w-full max-w-6xl overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Masa Yönetimi", locale)}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{table.name || `Masa ${table.table_number}`}</h2>
            <p className="mt-1 text-sm text-slate-500">{translateUiText("Tüm işlemler popup icinde hızlı yönetim için sekmeli yapida.", locale)}</p>
          </div>
          <Link href="/admin/tables" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 sm:text-sm">
            {translateUiText("Kapat", locale)}
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(130deg,rgba(59,130,246,0.09),rgba(255,255,255,0.95)_65%)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Masa Durumu", locale)}</p>
            <p className="font-display mt-3 text-2xl font-semibold text-slate-900">{tableStatusLabel(table.status)}</p>
            <p className="mt-2 text-sm text-slate-500">{translateUiText("Masa", locale)} {table.table_number}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(130deg,rgba(255,106,61,0.1),rgba(255,255,255,0.95)_65%)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Aktif Adisyon", locale)}</p>
            <p className="font-display mt-3 text-2xl font-semibold text-slate-900">{liveLatestOrder ? `#${orderRef(liveLatestOrder)}` : translateUiText("Yok", locale)}</p>
            <p className="mt-2 text-sm text-slate-500">{liveLatestOrder ? liveLatestOrder.status : translateUiText("Bu masa için açık sipariş bulunmuyor", locale)}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(130deg,rgba(16,185,129,0.1),rgba(255,255,255,0.95)_65%)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kalan Bakiye", locale)}</p>
            <p className="font-display font-numeric mt-3 text-2xl font-semibold text-emerald-700">{Number(liveLatestOrder?.remaining_balance ?? 0).toFixed(2)} TL</p>
            <p className="mt-2 text-sm text-slate-500">{translateUiText("Aktif sipariş uzerinden hesaplanir", locale)}</p>
          </article>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] p-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={`min-h-12 rounded-xl px-4 py-3 text-base font-semibold sm:text-sm ${activeTab === "order" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Sipariş Girisi", locale)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`min-h-12 rounded-xl px-4 py-3 text-base font-semibold sm:text-sm ${activeTab === "history" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Son Siparişler", locale)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ops")}
            className={`min-h-12 rounded-xl px-4 py-3 text-base font-semibold sm:text-sm ${activeTab === "ops" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Masa Islemleri", locale)}
          </button>
        </div>

        {activeTab === "order" ? (
          <section className="mt-5 min-w-0 rounded-[28px] border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 border-b border-slate-200 pb-4">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                {translateUiText("Bu Masada Sipariş Girisi", locale)}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {translateUiText("Popup icinden ürün ekle, Çıkar ve siparişi mutfaga günder.", locale)}
              </p>
            </div>
            <AdminOrderEntry
              businessSlug={businessSlug}
              categories={categories}
              products={products}
              modifierGroups={modifierGroups}
              modifierOptions={modifierOptions}
              tables={allTables}
              initialTableId={table.id}
              lockedTableId={table.id}
              entryMode="table_first"
              layoutMode="modal_3pane"
              initialView="composer"
              onOrderCreated={() => {
                void refreshOrderData(false);
                setActiveTab("history");
              }}
            />
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Son Siparişler", locale)}</h3>
                <p className="mt-1 text-sm text-slate-500">{translateUiText("Bu masa için son oluşan adisyonlar ve tahsilat durumlari", locale)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/cashier" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 sm:text-sm">
                  {translateUiText("Kasaya Git", locale)}
                </Link>
                <Link href="/tables" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-700 sm:text-sm">
                  {translateUiText("Masa Ekranı", locale)}
                </Link>
              </div>
            </div>

            {previewOrderId ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">#{orderRef(receiptDetails[previewOrderId] ?? { id: previewOrderId })} {translateUiText("adisyon Önizleme", locale)}</p>
                  <div className="no-print flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewPrint}
                      className="min-h-11 rounded-xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Yazdır / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewOrderId(null)}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      {translateUiText("Kapat", locale)}
                    </button>
                  </div>
                </div>
                {receiptDetails[previewOrderId] ? (
                  <div ref={receiptPreviewRef} className="receipt-preview-print receipt-inline-sheet max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white p-4">
                    <div className="border-b border-slate-200 pb-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sipariş Özeti</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {new Date(receiptDetails[previewOrderId].created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {receiptDetails[previewOrderId].items.map((item, index) => (
                        <div key={`${previewOrderId}-${item.product_id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.quantity}x {item.name}
                            </p>
                            <p className="text-sm font-semibold text-slate-900">{Number(item.line_total).toFixed(2)} TL</p>
                          </div>
                          {item.modifiers?.length ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.modifiers.map((modifier) => `${modifier.group_name}: ${modifier.option_name}`).join(" / ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
                      <p className="flex justify-between text-slate-600">
                        <span>Ara Toplam</span>
                        <span>{Number(receiptDetails[previewOrderId].total_price).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-slate-600">
                        <span>İndirim</span>
                        <span>-{Number(receiptDetails[previewOrderId].discount_amount ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-slate-600">
                        <span>Servis Ucreti</span>
                        <span>+{Number(receiptDetails[previewOrderId].service_fee ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-base font-semibold text-slate-900">
                        <span>Toplam</span>
                        <span>{Number(receiptDetails[previewOrderId].final_price ?? receiptDetails[previewOrderId].total_price).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-emerald-700">
                        <span>Ödenen</span>
                        <span>{Number(receiptDetails[previewOrderId].amount_paid ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between font-semibold text-[#ff5a34]">
                        <span>Kalan</span>
                        <span>{Number(receiptDetails[previewOrderId].remaining_balance ?? 0).toFixed(2)} TL</span>
                      </p>
                    </div>
                  </div>
                ) : receiptLoadingOrderId === previewOrderId ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    Adisyon detayi yükleniyor...
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Adisyon detayi yüklenemedi.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {historyLoading && historyOrders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Son siparişler güncelleniyor...
                </div>
              ) : historyOrders.length === 0 ? (
                <EmptyPanel title={translateUiText("Geçmiş Sipariş Yok", locale)} description={translateUiText("Bu masa için daha önce açılmış sipariş kaydı bulunmuyor.", locale)} />
              ) : (
                historyOrders.map((order) => {
                  const total = Number(order.final_price ?? order.total_price);
                  const paid = Number(order.amount_paid ?? 0);
                  const remaining = Number(order.remaining_balance ?? total);
                  return (
                    <article key={order.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Sipariş", locale)}</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">#{orderRef(order)}</p>
                          <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleString("tr-TR")}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${orderTone(order.status)}`}>{order.status}</span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Toplam", locale)}</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-slate-900">{total.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Ödenen", locale)}</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-emerald-700">{paid.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kalan", locale)}</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-[#ff5a34]">{remaining.toFixed(2)} TL</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void openReceiptPreview(order.id);
                          }}
                          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-base font-semibold text-slate-700 sm:w-auto sm:text-sm"
                        >
                          {translateUiText("Adisyonu Gör", locale)}
                        </button>
                        <Link href={`/cashier?order=${order.id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-center text-base font-semibold text-white sm:w-auto sm:text-sm">
                          {translateUiText("Popup Tahsilat", locale)}
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "ops" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="space-y-5">
              <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Masa Bilgileri", locale)}</h3>
                <form action={updateTableAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="tableId" value={table.id} />
                  <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                    <input name="tableNumber" type="number" min={1} inputMode="numeric" defaultValue={table.table_number} className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm" />
                    <input name="tableName" defaultValue={table.name ?? ""} placeholder={translateUiText("Masa adi", locale)} className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm" />
                  </div>
                  <PendingSubmitButton
                    idleLabel={translateUiText("Masa Bilgilerini Kaydet", locale)}
                    pendingLabel="Kaydediliyor..."
                    className="min-h-12 w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white sm:w-auto sm:text-sm"
                  />
                </form>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Bölge Atama</h3>
                <p className="mt-2 text-sm text-slate-600">Masanin hangi bolgede görünecegini seçin.</p>
                <form action={assignTableZoneAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="tableId" value={table.id} />
                  <select name="zoneId" defaultValue={table.zone_id ?? "__none__"} className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm">
                    <option value="__none__">Atanmamis</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                  <PendingSubmitButton
                    idleLabel="Bolgeyi Güncelle"
                    pendingLabel="Güncelleniyor..."
                    className="min-h-12 w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white sm:w-auto sm:text-sm"
                  />
                </form>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Rezervasyon</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Bu masayı tek tikla rezerveye alabilir veya tekrar boş duruma getirebilirsin.
                </p>
                <form action={updateTableStatusAction} className="mt-4">
                  <input type="hidden" name="tableId" value={table.id} />
                  <input type="hidden" name="status" value={table.status === "reserved" ? "empty" : "reserved"} />
                  <PendingSubmitButton
                    idleLabel={table.status === "reserved" ? "Rezerveden Çıkar (Boş)" : "Masayı Rezerve Yap"}
                    pendingLabel="Güncelleniyor..."
                    disabled={table.status === "occupied"}
                    className="min-h-12 w-full rounded-2xl border border-sky-300 bg-white px-4 py-3 text-base font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
                  />
                </form>
                {table.status === "occupied" ? (
                  <p className="mt-3 text-sm text-slate-500">Dolu masada aktif adisyon oldugu için rezervasyon degisikligi kilitli.</p>
                ) : null}
              </article>

              {liveLatestOrder ? (
                <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Adisyonu Taş", locale)}</h3>
                  <p className="mt-2 text-sm text-slate-600">{translateUiText("Aktif adisyonu boş bir masaya taşıyarak eski masayı aninda kapat.", locale)}</p>
                  <form action={moveTableOrderAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="sourceTableId" value={table.id} />
                    <select
                      name="targetTableId"
                      required
                      className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {translateUiText("Hedef masa seç", locale)}
                      </option>
                      {movableTables.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                    <PendingSubmitButton
                      idleLabel={translateUiText("Adisyonu Bu Masaya Taş", locale)}
                      pendingLabel="Taşınıyor..."
                      disabled={movableTables.length === 0}
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
                    />
                  </form>
                  {movableTables.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">{translateUiText("Taşımak için boş baska masa bulunmuyor.", locale)}</p>
                  ) : null}
                </article>
              ) : null}

              <article className="rounded-[28px] border border-rose-200 bg-rose-50/60 p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Masayı Kaldır", locale)}</h3>
                <p className="mt-2 text-sm text-slate-600">{translateUiText("Sadece boş masalar silinebilir. Aktif masada önce operasyon tamamlanmalıdır.", locale)}</p>
                <form action={deleteTableAction} className="mt-4">
                  <input type="hidden" name="tableId" value={table.id} />
                  <PendingSubmitButton
                    idleLabel={translateUiText("Masayı Sil", locale)}
                    pendingLabel="Siliniyor..."
                    disabled={table.status !== "empty"}
                    className="min-h-12 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-base font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
                  />
                </form>
              </article>
            </section>

            <section className="space-y-5">
              <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("QR ve Hızlı Aksiyonlar", locale)}</h3>
                <div className="mt-4 flex items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5">
                  <Image src={qrImage} alt={`${table.name || `Masa ${table.table_number}`} QR`} width={180} height={180} className="h-32 w-32 rounded-2xl object-cover sm:h-40 sm:w-40" unoptimized />
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("QR Linki", locale)}</p>
                  <p className="mt-1 break-all text-sm text-slate-700">{qrTarget}</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a href={qrImage} download={`masa-${table.table_number}-qr.png`} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
                    {translateUiText("QR İndir", locale)}
                  </a>
                  <a href={`/admin/tables/${table.id}/print`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
                    {translateUiText("Yazdır", locale)}
                  </a>
                  <a href={qrTarget} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
                    {translateUiText("QR Sayfasını A?", locale)}
                  </a>
                  <Link href="/tables" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
                    {translateUiText("Masa Ekranı", locale)}
                  </Link>
                </div>
              </article>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
