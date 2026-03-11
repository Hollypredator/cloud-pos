import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { BackofficePage, EmptyPanel, NoticeBanner, SummaryCard, WorkflowGuide, WorkspaceTabs } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getOrderHistoryByTableId, getTableMap, listLatestOrdersByTableIds } from "@/lib/domains/tables";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { addTableAction } from "./actions";
import { buildQrImage, buildQrTarget, orderTone, tableStatusLabel, tableStatusTone } from "./helpers";
import { TableManagementModal } from "./table-management-modal";

export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string; tone?: "success" | "error"; table?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireRole(["admin"], "/admin/tables");
  const { feedback, tone, table: selectedTableId } = await searchParams;
  const tableMapResult = await measureAsync("table_map", () => getTableMap());
  const { tables, usingDemoData } = tableMapResult.value;

  const targetResult = await measureAsync("qr_targets", () => Promise.all(
    tables.map(async (table) => ({
      id: table.id,
      target: await buildQrTarget(table.qr_code_identifier),
      image: await buildQrImage(table.qr_code_identifier),
    })),
  ));
  const targetMap = new Map(targetResult.value.map((row) => [row.id, row]));
  const latestOrdersResult = await measureAsync("latest_orders_by_table", () => listLatestOrdersByTableIds(tables.map((table) => table.id)));
  const { ordersByTableId } = latestOrdersResult.value;
  const latestOrderMap = ordersByTableId;
  const selectedTable = selectedTableId ? tables.find((table) => table.id === selectedTableId) ?? null : null;
  const selectedHistoryResult = selectedTable
    ? await measureAsync("selected_table_history", () => getOrderHistoryByTableId(selectedTable.id, 8))
    : null;
  const { orders: selectedTableHistory } = selectedHistoryResult?.value ?? { orders: [] };
  logServerPerf("/admin/tables", [tableMapResult, targetResult, latestOrdersResult, ...(selectedHistoryResult ? [selectedHistoryResult] : [])]);
  const movableTables = selectedTable
    ? tables
        .filter((table) => table.id !== selectedTable.id && table.status === "empty")
        .map((table) => ({
          id: table.id,
          label: `${table.name || `Masa ${table.table_number}`} (No ${table.table_number})`,
        }))
    : [];
  const occupiedCount = tables.filter((table) => table.status === "occupied").length;
  const emptyCount = tables.filter((table) => table.status === "empty").length;
  const activeOrderCount = tables.filter((table) => {
    const order = latestOrderMap.get(table.id);
    return order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "refunded";
  }).length;

  return (
    <BackofficePage
      title={translateUiText("Bolge ve Masa Yonetimi", locale)}
      description={translateUiText("Salon yerlesimi, QR hedefleri ve aktif masa listesi", locale)}
      actions={
        <form action={addTableAction} className="flex flex-wrap items-center gap-3">
          <input name="tableNumber" type="number" min={1} required placeholder={translateUiText("Yeni masa no", locale)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-36" />
          <input name="tableName" placeholder={translateUiText("Masa adi", locale)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:w-44" />
          <PendingSubmitButton
            idleLabel={translateUiText("Yeni Masa", locale)}
            pendingLabel="Ekleniyor..."
            className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-sm font-semibold text-white sm:w-auto"
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
        <SummaryCard label={translateUiText("Toplam Masa", locale)} value={String(tables.length)} hint="Salon kapasitesi" tone="accent" />
        <SummaryCard label={translateUiText("Dolu Masa", locale)} value={String(occupiedCount)} hint={translateUiText("Aktif servis alan masa", locale)} tone="danger" />
        <SummaryCard label={translateUiText("Bos Masa", locale)} value={String(emptyCount)} hint={translateUiText("Yeni musteri icin hazir", locale)} tone="success" />
        <SummaryCard label={translateUiText("Acik Adisyon", locale)} value={String(activeOrderCount)} hint={translateUiText("Masaya bagli operasyon", locale)} />
      </section>

      <WorkflowGuide
        title={translateUiText("Masalari 3 Adimda Hazirla", locale)}
        description={translateUiText("Salon kurulumu ilk kez yapilsa bile masa akisi kolay anlasilsin.", locale)}
        steps={[
          { title: translateUiText("Masayi olustur ve isim ver", locale), description: translateUiText("Yeni masa numarasini ve gorunur masa adini kaydet; ekip bu isimle calisir.", locale) },
          { title: translateUiText("QR'i kontrol et", locale), description: translateUiText("QR ve yazdirma islerini Masa Yonet popup'i icinden tamamla.", locale) },
          { title: translateUiText("Aktif siparisi buradan izle", locale), description: translateUiText("Her kartta son adisyon ozetini gor; detayli gecmisi popup icinden ac.", locale) },
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs tabs={[{ label: translateUiText("Isletmeler", locale) }, { label: translateUiText("Bolge ve Masa Yonetimi", locale), active: true }]} />

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo veride masa ekleme ve silme kalici degildir.
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Bolgeler</h2>
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
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Masalar</h2>
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
                          <p className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{table.name || `Masa ${table.table_number}`}</p>
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
                          <div className="grid gap-2 sm:grid-cols-2">
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
          movableTables={movableTables}
        />
      ) : null}
    </BackofficePage>
  );
}
