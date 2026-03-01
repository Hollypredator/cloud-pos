import { revalidatePath } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { createTable, deleteTable, getOrderHistoryByTableId, getTableMap, listLatestOrdersByTableIds, updateTableDetails } from "@/lib/data";
import { BackofficePage, EmptyPanel, NoticeBanner, SummaryCard, WorkflowGuide, WorkspaceTabs } from "@/components/backoffice-ui";
import type { DiningTable } from "@/lib/types";

function feedbackHref(tone: "success" | "error", message: string) {
  return `/admin/tables?tone=${encodeURIComponent(tone)}&feedback=${encodeURIComponent(message)}`;
}

async function addTableAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/tables");

  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Yeni masa numarasi pozitif bir tam sayi olmali."));
  }

  try {
    await createTable(tableNumber, tableName);
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Yeni masa olusturuldu."));
  } catch {
    redirect(feedbackHref("error", "Masa olusturulamadi. Numara zaten kullaniliyor olabilir."));
  }
}

async function updateTableAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/tables");

  const tableId = String(formData.get("tableId") ?? "");
  const tableNumber = Number(formData.get("tableNumber"));
  const tableName = String(formData.get("tableName") ?? "").trim();
  if (!tableId || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    redirect(feedbackHref("error", "Masa bilgilerini kaydetmek icin gecerli bir masa no girin."));
  }

  try {
    await updateTableDetails({ tableId, tableNumber, name: tableName });
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa bilgileri guncellendi."));
  } catch {
    redirect(feedbackHref("error", "Masa bilgileri guncellenemedi."));
  }
}

async function deleteTableAction(formData: FormData) {
  "use server";
  await requireRole(["admin"], "/admin/tables");

  const tableId = formData.get("tableId");
  if (typeof tableId !== "string") {
    redirect(feedbackHref("error", "Silinecek masa bulunamadi."));
  }

  try {
    await deleteTable(tableId);
    revalidatePath("/admin/tables");
    revalidatePath("/tables");
    redirect(feedbackHref("success", "Masa silindi."));
  } catch {
    redirect(feedbackHref("error", "Masa silinemedi. Aktif operasyonu olan masalar silinemez."));
  }
}

async function buildQrTarget(identifier: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const businessSlug = await getActiveBusinessSlug();
  return `${base}/${businessSlug}/qr/${identifier}`;
}

async function buildQrImage(identifier: string) {
  const target = encodeURIComponent(await buildQrTarget(identifier));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${target}`;
}

function tableStatusLabel(status: string) {
  if (status === "occupied") return "Dolu";
  if (status === "reserved") return "Rezerve";
  return "Bos";
}

function tableStatusTone(status: string) {
  if (status === "occupied") return "bg-amber-100 text-amber-800";
  if (status === "reserved") return "bg-sky-100 text-sky-800";
  return "bg-emerald-100 text-emerald-700";
}

function orderTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "served") return "bg-[#fff2ee] text-[#ff5a34]";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string; tone?: "success" | "error"; table?: string }>;
}) {
  await requireRole(["admin"], "/admin/tables");
  const { feedback, tone, table: selectedTableId } = await searchParams;
  const { tables, usingDemoData } = await getTableMap();

  const targets = await Promise.all(
    tables.map(async (table) => ({
      id: table.id,
      target: await buildQrTarget(table.qr_code_identifier),
      image: await buildQrImage(table.qr_code_identifier),
    })),
  );
  const targetMap = new Map(targets.map((row) => [row.id, row]));
  const { ordersByTableId } = await listLatestOrdersByTableIds(tables.map((table) => table.id));
  const latestOrderMap = ordersByTableId;
  const selectedTable = selectedTableId ? tables.find((table) => table.id === selectedTableId) ?? null : null;
  const { orders: selectedTableHistory } = selectedTable ? await getOrderHistoryByTableId(selectedTable.id, 8) : { orders: [] };
  const occupiedCount = tables.filter((table) => table.status === "occupied").length;
  const emptyCount = tables.filter((table) => table.status === "empty").length;
  const activeOrderCount = tables.filter((table) => {
    const order = latestOrderMap.get(table.id);
    return order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "refunded";
  }).length;

  return (
    <BackofficePage
      title="Bolge ve Masa Yonetimi"
      description="Salon yerlesimi, QR hedefleri ve aktif masa listesi"
      actions={
        <form action={addTableAction} className="flex flex-wrap items-center gap-3">
          <input name="tableNumber" type="number" min={1} required placeholder="Yeni masa no" className="w-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          <input name="tableName" placeholder="Masa adi" className="w-44 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white">
            Yeni Masa
          </button>
        </form>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Masa islemi tamamlanamadi" : "Masa islemi tamamlandi"}
          description={feedback}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Toplam Masa" value={String(tables.length)} hint="Salon kapasitesi" tone="accent" />
        <SummaryCard label="Dolu Masa" value={String(occupiedCount)} hint="Aktif servis alan masa" tone="danger" />
        <SummaryCard label="Bos Masa" value={String(emptyCount)} hint="Yeni musteri icin hazir" tone="success" />
        <SummaryCard label="Acik Adisyon" value={String(activeOrderCount)} hint="Masaya bagli operasyon" />
      </section>

      <WorkflowGuide
        title="Masalari 3 Adimda Hazirla"
        description="Salon kurulumu ilk kez yapilsa bile masa akisi kolay anlasilsin."
        steps={[
          { title: "Masayi olustur ve isim ver", description: "Yeni masa numarasini ve gorunur masa adini kaydet; ekip bu isimle calisir." },
          { title: "QR'i kontrol et", description: "QR ve yazdirma islerini Masa Yonet popup'i icinden tamamla." },
          { title: "Aktif siparisi buradan izle", description: "Her kartta son adisyon ozetini gor; detayli gecmisi popup icinden ac." },
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs tabs={[{ label: "Isletmeler" }, { label: "Bolge & Masa Yonetimi", active: true }]} />

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo veride masa ekleme ve silme kalici degildir.
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Bolgeler</h2>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                1
              </span>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#ff8b73] bg-[#fff8ee] px-4 py-4">
              <p className="text-xl font-semibold text-slate-900">Ana Salon</p>
              <p className="mt-1 text-sm text-slate-500">{tables.length} masa</p>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Masalar</h2>
                <p className="text-sm text-slate-500">Kartlar sadece hizli operasyonu gosterir; tum yonetim popup icindedir.</p>
              </div>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                {tables.length}
              </span>
            </div>

            {tables.length === 0 ? (
              <div className="mt-4">
                <EmptyPanel title="Masa Yok" description="Ilk masayi olusturunca salon grid'i burada gosterilecek." />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {tables.map((table) => {
                  const latestOrder = latestOrderMap.get(table.id);
                  return (
                    <article
                      key={table.id}
                      className={`flex h-full flex-col rounded-[24px] border bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] ${
                        table.status === "occupied"
                          ? "border-amber-200 shadow-[0_14px_28px_rgba(245,158,11,0.12)]"
                          : table.status === "reserved"
                            ? "border-sky-200 shadow-[0_14px_28px_rgba(14,165,233,0.10)]"
                            : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-2xl font-semibold tracking-tight text-slate-900">{table.name || `Masa ${table.table_number}`}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Masa {table.table_number}</p>
                          <p className="mt-1 text-sm text-slate-500">{tableStatusLabel(table.status)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${tableStatusTone(table.status)}`}>{tableStatusLabel(table.status)}</span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        {latestOrder ? (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Aktif Adisyon</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">#{latestOrder.id.slice(0, 8)}</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${orderTone(latestOrder.status)}`}>
                                {latestOrder.status}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                              <span>Tutar</span>
                              <span className="font-numeric">{Number(latestOrder.final_price ?? latestOrder.total_price ?? 0).toFixed(2)} TL</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Hazirlik Durumu</p>
                            <p className="mt-2 text-sm text-slate-500">Bu masa yeni siparis almak icin hazir.</p>
                          </>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Link
                          href={`/admin/tables?table=${table.id}`}
                          className="rounded-xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-3 py-3 text-center text-sm font-semibold text-white"
                        >
                          Masa Yonet
                        </Link>
                        {latestOrder ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              href={`/cashier?order=${latestOrder.id}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-semibold text-slate-700"
                            >
                              Kasada Ac
                            </Link>
                            <Link
                              href={`/receipt/${latestOrder.id}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-semibold text-slate-700"
                            >
                              Adisyon
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-500">
                            Bu masada aktif adisyon yok.
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedTable ? (
        <TableManagementModal
          table={selectedTable}
          latestOrder={latestOrderMap.get(selectedTable.id) ?? null}
          orders={selectedTableHistory}
          qrTarget={targetMap.get(selectedTable.id)?.target ?? "#"}
          qrImage={targetMap.get(selectedTable.id)?.image ?? "#"}
        />
      ) : null}
    </BackofficePage>
  );
}

function TableManagementModal({
  table,
  latestOrder,
  orders,
  qrTarget,
  qrImage,
}: {
  table: DiningTable;
  latestOrder: { id: string; final_price?: number; total_price: number; status: string; remaining_balance?: number } | null;
  orders: Array<{
    id: string;
    created_at: string;
    status: string;
    final_price?: number;
    total_price: number;
    amount_paid?: number;
    remaining_balance?: number;
  }>;
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
                <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                  Masa Bilgilerini Kaydet
                </button>
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
                <button type="submit" disabled={table.status !== "empty"} className="rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Masayi Sil
                </button>
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
