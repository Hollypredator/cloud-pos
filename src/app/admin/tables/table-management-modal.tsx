"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { EmptyPanel } from "@/components/backoffice-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { normalizeLocale, translateUiText } from "@/lib/i18n";
import type { Category, DiningTable, Order, Product, ProductModifierGroup, ProductModifierOption } from "@/lib/types";
import { deleteTableAction, moveTableOrderAction, updateTableAction } from "./actions";
import { orderTone, tableStatusLabel } from "./helpers";

type TableOrderSummary = {
  id: string;
  final_price?: number;
  total_price: number;
  status: string;
  remaining_balance?: number;
};

type TableOrderHistoryItem = {
  id: string;
  created_at: string;
  status: string;
  final_price?: number;
  total_price: number;
  amount_paid?: number;
  remaining_balance?: number;
};

type ModalTab = "order" | "history" | "ops";

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
  receiptDetailsByOrderId: Record<string, Order>;
}) {
  const locale = normalizeLocale(document.documentElement.lang || "tr");
  const [activeTab, setActiveTab] = useState<ModalTab>("order");
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="panel-surface h-[100dvh] w-full max-w-6xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Masa Yonetimi", locale)}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{table.name || `Masa ${table.table_number}`}</h2>
            <p className="mt-1 text-sm text-slate-500">{translateUiText("Tum islemler popup icinde hizli yonetim icin sekmeli yapida.", locale)}</p>
          </div>
          <Link href="/admin/tables" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
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
            <p className="font-display mt-3 text-2xl font-semibold text-slate-900">{latestOrder ? `#${latestOrder.id.slice(0, 8)}` : translateUiText("Yok", locale)}</p>
            <p className="mt-2 text-sm text-slate-500">{latestOrder ? latestOrder.status : translateUiText("Bu masa icin acik siparis bulunmuyor", locale)}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(130deg,rgba(16,185,129,0.1),rgba(255,255,255,0.95)_65%)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kalan Bakiye", locale)}</p>
            <p className="font-display font-numeric mt-3 text-2xl font-semibold text-emerald-700">{Number(latestOrder?.remaining_balance ?? 0).toFixed(2)} TL</p>
            <p className="mt-2 text-sm text-slate-500">{translateUiText("Aktif siparis uzerinden hesaplanir", locale)}</p>
          </article>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] p-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${activeTab === "order" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Siparis Girisi", locale)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${activeTab === "history" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Son Siparisler", locale)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ops")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${activeTab === "ops" ? "bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] text-white shadow-[0_12px_22px_rgba(255,106,61,0.2)]" : "bg-white text-slate-700"}`}
          >
            {translateUiText("Masa Islemleri", locale)}
          </button>
        </div>

        {activeTab === "order" ? (
          <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4 border-b border-slate-200 pb-4">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                {translateUiText("Bu Masada Siparis Girisi", locale)}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {translateUiText("Popup icinden urun ekle, cikar ve siparisi mutfaga gonder.", locale)}
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
            />
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Son Siparisler", locale)}</h3>
                <p className="mt-1 text-sm text-slate-500">{translateUiText("Bu masa icin son olusan adisyonlar ve tahsilat durumlari", locale)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/cashier" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {translateUiText("Kasaya Git", locale)}
                </Link>
                <Link href="/tables" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {translateUiText("Masa Ekrani", locale)}
                </Link>
              </div>
            </div>

            {previewOrderId ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">#{previewOrderId.slice(0, 8)} {translateUiText("adisyon onizleme", locale)}</p>
                  <div className="no-print flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewPrint}
                      className="rounded-xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Yazdir / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewOrderId(null)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      {translateUiText("Kapat", locale)}
                    </button>
                  </div>
                </div>
                {receiptDetailsByOrderId[previewOrderId] ? (
                  <div ref={receiptPreviewRef} className="receipt-preview-print receipt-inline-sheet max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white p-4">
                    <div className="border-b border-slate-200 pb-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis Ozeti</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {new Date(receiptDetailsByOrderId[previewOrderId].created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {receiptDetailsByOrderId[previewOrderId].items.map((item, index) => (
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
                        <span>{Number(receiptDetailsByOrderId[previewOrderId].total_price).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-slate-600">
                        <span>Indirim</span>
                        <span>-{Number(receiptDetailsByOrderId[previewOrderId].discount_amount ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-slate-600">
                        <span>Servis Ucreti</span>
                        <span>+{Number(receiptDetailsByOrderId[previewOrderId].service_fee ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-base font-semibold text-slate-900">
                        <span>Toplam</span>
                        <span>{Number(receiptDetailsByOrderId[previewOrderId].final_price ?? receiptDetailsByOrderId[previewOrderId].total_price).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between text-emerald-700">
                        <span>Odenen</span>
                        <span>{Number(receiptDetailsByOrderId[previewOrderId].amount_paid ?? 0).toFixed(2)} TL</span>
                      </p>
                      <p className="flex justify-between font-semibold text-[#ff5a34]">
                        <span>Kalan</span>
                        <span>{Number(receiptDetailsByOrderId[previewOrderId].remaining_balance ?? 0).toFixed(2)} TL</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Adisyon detayi yuklenemedi.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {orders.length === 0 ? (
                <EmptyPanel title={translateUiText("Gecmis Siparis Yok", locale)} description={translateUiText("Bu masa icin daha once acilmis siparis kaydi bulunmuyor.", locale)} />
              ) : (
                orders.map((order) => {
                  const total = Number(order.final_price ?? order.total_price);
                  const paid = Number(order.amount_paid ?? 0);
                  const remaining = Number(order.remaining_balance ?? total);
                  return (
                    <article key={order.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Siparis", locale)}</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">#{order.id.slice(0, 8)}</p>
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
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Odenen", locale)}</p>
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
                          onClick={() => setPreviewOrderId(order.id)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto"
                        >
                          {translateUiText("Adisyonu Gor", locale)}
                        </button>
                        <Link href={`/cashier?order=${order.id}`} className="w-full rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-center text-sm font-semibold text-white sm:w-auto">
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
                    <input name="tableNumber" type="number" min={1} defaultValue={table.table_number} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                    <input name="tableName" defaultValue={table.name ?? ""} placeholder={translateUiText("Masa adi", locale)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  </div>
                  <PendingSubmitButton
                    idleLabel={translateUiText("Masa Bilgilerini Kaydet", locale)}
                    pendingLabel="Kaydediliyor..."
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                  />
                </form>
              </article>

              {latestOrder ? (
                <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Adisyonu Tas", locale)}</h3>
                  <p className="mt-2 text-sm text-slate-600">{translateUiText("Aktif adisyonu bos bir masaya tasiyarak eski masayi aninda kapat.", locale)}</p>
                  <form action={moveTableOrderAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="sourceTableId" value={table.id} />
                    <select
                      name="targetTableId"
                      required
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {translateUiText("Hedef masa sec", locale)}
                      </option>
                      {movableTables.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                    <PendingSubmitButton
                      idleLabel={translateUiText("Adisyonu Bu Masaya Tas", locale)}
                      pendingLabel="Tasiniyor..."
                      disabled={movableTables.length === 0}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    />
                  </form>
                  {movableTables.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">{translateUiText("Tasimak icin bos baska masa bulunmuyor.", locale)}</p>
                  ) : null}
                </article>
              ) : null}

              <article className="rounded-[28px] border border-rose-200 bg-rose-50/60 p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("Masayi Kaldir", locale)}</h3>
                <p className="mt-2 text-sm text-slate-600">{translateUiText("Sadece bos masalar silinebilir. Aktif masada once operasyon tamamlanmalidir.", locale)}</p>
                <form action={deleteTableAction} className="mt-4">
                  <input type="hidden" name="tableId" value={table.id} />
                  <PendingSubmitButton
                    idleLabel={translateUiText("Masayi Sil", locale)}
                    pendingLabel="Siliniyor..."
                    disabled={table.status !== "empty"}
                    className="w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  />
                </form>
              </article>
            </section>

            <section className="space-y-5">
              <article className="rounded-[28px] border border-slate-200 bg-white p-5">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{translateUiText("QR ve Hizli Aksiyonlar", locale)}</h3>
                <div className="mt-4 flex items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5">
                  <Image src={qrImage} alt={`${table.name || `Masa ${table.table_number}`} QR`} width={180} height={180} className="h-32 w-32 rounded-2xl object-cover sm:h-40 sm:w-40" unoptimized />
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("QR Linki", locale)}</p>
                  <p className="mt-1 break-all text-sm text-slate-700">{qrTarget}</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a href={qrImage} download={`masa-${table.table_number}-qr.png`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                    {translateUiText("QR Indir", locale)}
                  </a>
                  <a href={`/admin/tables/${table.id}/print`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                    {translateUiText("Yazdir", locale)}
                  </a>
                  <a href={qrTarget} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                    {translateUiText("QR Sayfasini Ac", locale)}
                  </a>
                  <Link href="/tables" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                    {translateUiText("Masa Ekrani", locale)}
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
