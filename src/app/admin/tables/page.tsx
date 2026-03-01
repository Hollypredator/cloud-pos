import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { BackofficePage, EmptyPanel, NoticeBanner, SummaryCard, WorkflowGuide, WorkspaceTabs } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getOrderHistoryByTableId, getTableMap, listLatestOrdersByTableIds } from "@/lib/data";
import { addTableAction } from "./actions";
import { buildQrImage, buildQrTarget, orderTone, tableStatusLabel, tableStatusTone } from "./helpers";
import { TableManagementModal } from "./table-management-modal";

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
          <PendingSubmitButton
            idleLabel="Yeni Masa"
            pendingLabel="Ekleniyor..."
            className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white"
          />
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
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">1</span>
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
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${orderTone(latestOrder.status)}`}>{latestOrder.status}</span>
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
                        <Link href={`/admin/tables?table=${table.id}`} className="rounded-xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-3 py-3 text-center text-sm font-semibold text-white">
                          Masa Yonet
                        </Link>
                        {latestOrder ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Link href={`/cashier?order=${latestOrder.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                              Kasada Ac
                            </Link>
                            <Link href={`/receipt/${latestOrder.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-semibold text-slate-700">
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
