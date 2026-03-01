import Image from "next/image";
import Link from "next/link";
import { EmptyPanel } from "@/components/backoffice-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { DiningTable } from "@/lib/types";
import { deleteTableAction, updateTableAction } from "./actions";
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

export function TableManagementModal({
  table,
  latestOrder,
  orders,
  qrTarget,
  qrImage,
}: {
  table: DiningTable;
  latestOrder: TableOrderSummary | null;
  orders: TableOrderHistoryItem[];
  qrTarget: string;
  qrImage: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="panel-surface h-[100dvh] w-full max-w-6xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa Yonetimi</p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">{table.name || `Masa ${table.table_number}`}</h2>
            <p className="mt-1 text-sm text-slate-500">Duzenleme, QR ve siparis gecmisi ayni popup icinde tamamlanir.</p>
          </div>
          <Link href="/admin/tables" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            Kapat
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa Durumu</p>
            <p className="font-display mt-3 text-2xl font-semibold text-slate-900">{tableStatusLabel(table.status)}</p>
            <p className="mt-2 text-sm text-slate-500">Masa {table.table_number}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Aktif Adisyon</p>
            <p className="font-display mt-3 text-2xl font-semibold text-slate-900">{latestOrder ? `#${latestOrder.id.slice(0, 8)}` : "Yok"}</p>
            <p className="mt-2 text-sm text-slate-500">{latestOrder ? latestOrder.status : "Bu masa icin acik siparis bulunmuyor"}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kalan Bakiye</p>
            <p className="font-display font-numeric mt-3 text-2xl font-semibold text-emerald-700">{Number(latestOrder?.remaining_balance ?? 0).toFixed(2)} TL</p>
            <p className="mt-2 text-sm text-slate-500">Aktif siparis uzerinden hesaplanir</p>
          </article>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-5">
            <article className="rounded-[28px] border border-slate-200 bg-white p-5">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Masa Bilgileri</h3>
              <form action={updateTableAction} className="mt-4 grid gap-3">
                <input type="hidden" name="tableId" value={table.id} />
                <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                  <input name="tableNumber" type="number" min={1} defaultValue={table.table_number} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input name="tableName" defaultValue={table.name ?? ""} placeholder="Masa adi" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                </div>
                <PendingSubmitButton
                  idleLabel="Masa Bilgilerini Kaydet"
                  pendingLabel="Kaydediliyor..."
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                />
              </form>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-5">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">QR ve Hizli Aksiyonlar</h3>
              <div className="mt-4 flex items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5">
                <Image src={qrImage} alt={`${table.name || `Masa ${table.table_number}`} QR`} width={180} height={180} className="h-40 w-40 rounded-2xl object-cover" unoptimized />
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">QR Linki</p>
                <p className="mt-1 break-all text-sm text-slate-700">{qrTarget}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a href={qrImage} download={`masa-${table.table_number}-qr.png`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  QR Indir
                </a>
                <a href={`/admin/tables/${table.id}/print`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  Yazdir
                </a>
                <a href={qrTarget} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  QR Sayfasini Ac
                </a>
                <Link href="/tables" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  Masa Ekrani
                </Link>
              </div>
            </article>

            <article className="rounded-[28px] border border-rose-200 bg-rose-50/60 p-5">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Masayi Kaldir</h3>
              <p className="mt-2 text-sm text-slate-600">Sadece bos masalar silinebilir. Aktif masada once operasyon tamamlanmalidir.</p>
              <form action={deleteTableAction} className="mt-4">
                <input type="hidden" name="tableId" value={table.id} />
                <PendingSubmitButton
                  idleLabel="Masayi Sil"
                  pendingLabel="Siliniyor..."
                  disabled={table.status !== "empty"}
                  className="rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </form>
            </article>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Son Siparisler</h3>
                <p className="mt-1 text-sm text-slate-500">Bu masa icin son olusan adisyonlar ve tahsilat durumlari</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/cashier" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Kasaya Git
                </Link>
                <Link href="/tables" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Masa Ekrani
                </Link>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {orders.length === 0 ? (
                <EmptyPanel title="Gecmis Siparis Yok" description="Bu masa icin daha once acilmis siparis kaydi bulunmuyor." />
              ) : (
                orders.map((order) => {
                  const total = Number(order.final_price ?? order.total_price);
                  const paid = Number(order.amount_paid ?? 0);
                  const remaining = Number(order.remaining_balance ?? total);
                  return (
                    <article key={order.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Siparis</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">#{order.id.slice(0, 8)}</p>
                          <p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleString("tr-TR")}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${orderTone(order.status)}`}>{order.status}</span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Toplam</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-slate-900">{total.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Odenen</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-emerald-700">{paid.toFixed(2)} TL</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kalan</p>
                          <p className="font-display font-numeric mt-2 text-xl font-semibold text-[#ff5a34]">{remaining.toFixed(2)} TL</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/receipt/${order.id}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                          Adisyonu Gor
                        </Link>
                        <Link href={`/cashier?order=${order.id}`} className="rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-sm font-semibold text-white">
                          Popup Tahsilat
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
