import Link from "next/link";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { BackofficePage, EmptyPanel, NoticeBanner, SummaryCard, WorkflowGuide, WorkspaceTabs } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getMenu } from "@/lib/domains/orders";
import { getOrderHistoryByTableId, getTableMap, getTableZones, listAssignableWaiters, listLatestOrdersByTableIds, listTableSupervisors } from "@/lib/domains/tables";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import type { Order } from "@/lib/types";
import {
  addTableAction,
  bulkAddTablesAction,
  bulkDeleteSelectedTablesAction,
  bulkDeleteTablesAction,
  bulkDeleteZonesAction,
  createZoneAction,
  deleteZoneAction,
  setTableSupervisorAction,
} from "./actions";
import { orderTone, tableStatusLabel, tableStatusTone } from "./helpers";
import { buildQrImage, buildQrTarget } from "./qr-helpers-server";
import { TableManagementModal } from "./table-management-modal";

type MenuSnapshot = Awaited<ReturnType<typeof getMenu>>;

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

export default async function AdminTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string; tone?: "success" | "error"; table?: string; zone?: string; delete?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireRole(["admin"], "/admin/tables");
  const { feedback, tone, table: selectedTableId, zone: zoneFilterParam, delete: deleteParam } = await searchParams;
  const tableMapResult = await measureAsync("table_map", () => getTableMap());
  const { tables, usingDemoData } = tableMapResult.value;
  const zonesResult = await measureAsync("table_zones", () => getTableZones());
  const { zones } = zonesResult.value;
  const latestOrdersResult = await measureAsync("latest_orders_by_table", () => listLatestOrdersByTableIds(tables.map((table) => table.id)));
  const { ordersByTableId } = latestOrdersResult.value;
  const waitersResult = await measureAsync("assignable_waiters", () => listAssignableWaiters());
  const { waiters } = waitersResult.value;
  const supervisorsResult = await measureAsync("table_supervisors", () => listTableSupervisors());
  const { assignments: tableSupervisors, available: supervisorFeatureAvailable } = supervisorsResult.value;
  const supervisorByTableId = new Map(tableSupervisors.map((assignment) => [assignment.table_id, assignment]));
  const latestOrderMap = ordersByTableId;
  const selectedTable = selectedTableId ? tables.find((table) => table.id === selectedTableId) ?? null : null;

  const perfSegments: Array<{ label: string; ms: number; value?: unknown }> = [tableMapResult, zonesResult, latestOrdersResult, waitersResult, supervisorsResult];
  let businessSlug = "";
  let categories: MenuSnapshot["categories"] = [];
  let products: MenuSnapshot["products"] = [];
  let modifierGroups: MenuSnapshot["modifierGroups"] = [];
  let modifierOptions: MenuSnapshot["modifierOptions"] = [];
  let selectedTableHistory: Order[] = [];
  let selectedTableQrTarget = "#";
  let selectedTableQrImage = "#";

  if (selectedTable) {
    const businessScopeResult = await measureAsync("business_scope", () => getBusinessScopeContext());
    businessSlug = businessScopeResult.value.activeSlug;
    perfSegments.push(businessScopeResult);

    const menüResult = await measureAsync("menü_for_table_modal_order_entry", () => getMenu(businessSlug));
    categories = menüResult.value.categories;
    products = menüResult.value.products;
    modifierGroups = menüResult.value.modifierGroups;
    modifierOptions = menüResult.value.modifierOptions;
    perfSegments.push(menüResult);

    const selectedHistoryResult = await measureAsync("selected_table_history", () => getOrderHistoryByTableId(selectedTable.id, 8));
    selectedTableHistory = selectedHistoryResult.value.orders;
    perfSegments.push(selectedHistoryResult);

    const selectedTableQrTargetResult = await measureAsync("selected_table_qr_target", () => buildQrTarget(selectedTable.qr_code_identifier));
    selectedTableQrTarget = selectedTableQrTargetResult.value;
    perfSegments.push(selectedTableQrTargetResult);

    const selectedTableQrImageResult = await measureAsync("selected_table_qr_image", () =>
      buildQrImage(selectedTable.qr_code_identifier, selectedTableQrTarget),
    );
    selectedTableQrImage = selectedTableQrImageResult.value;
    perfSegments.push(selectedTableQrImageResult);
  }

  const selectedReceiptDetailsByOrderId: Record<string, Order> = {};
  logServerPerf("/admin/tables", perfSegments);
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const movableTables = selectedTable
    ? tables
        .filter((table) => table.id !== selectedTable.id && table.status === "empty")
        .map((table) => ({
          id: table.id,
          label: `${table.name || `Masa ${table.table_number}`} (No ${table.table_number}${table.zone_id ? ` - ${zoneById.get(table.zone_id)?.name ?? "Atanmamis"}` : " - Atanmamis"})`,
        }))
    : [];
  const occupiedCount = tables.filter((table) => table.status === "occupied").length;
  const emptyCount = tables.filter((table) => table.status === "empty").length;
  const activeOrderCount = tables.filter((table) => {
    const order = latestOrderMap.get(table.id);
    return order && order.status !== "paid" && order.status !== "cancelled" && order.status !== "refunded";
  }).length;
  const zoneCounts = new Map<string, number>();
  let unassignedCount = 0;
  for (const table of tables) {
    if (table.zone_id && zoneById.has(table.zone_id)) {
      zoneCounts.set(table.zone_id, (zoneCounts.get(table.zone_id) ?? 0) + 1);
    } else {
      unassignedCount += 1;
    }
  }
  const zoneFilter = (zoneFilterParam ?? "").trim();
  const filteredTables =
    zoneFilter === "__unassigned__"
      ? tables.filter((table) => !table.zone_id || !zoneById.has(table.zone_id))
      : zoneFilter
        ? tables.filter((table) => table.zone_id === zoneFilter)
        : tables;
  const selectedZoneLabel =
    zoneFilter === "__unassigned__"
      ? "Atanmamis"
      : zoneFilter
        ? zoneById.get(zoneFilter)?.name ?? "Seçili bölge"
        : "Tüm bölgeler";
  const deleteMode = deleteParam === "1";
  const zoneQueryPart = zoneFilter ? `?zone=${encodeURIComponent(zoneFilter)}` : "";
  const deleteModeHref = zoneFilter
    ? `/admin/tables?zone=${encodeURIComponent(zoneFilter)}&delete=1`
    : "/admin/tables?delete=1";
  const normalModeHref = zoneQueryPart ? `/admin/tables${zoneQueryPart}` : "/admin/tables";

  return (
    <BackofficePage
      title={translateUiText("Bölge ve Masa Yönetimi", locale)}
      description={translateUiText("Salon yerlesimi, QR hedefleri ve aktif masa listesi", locale)}
      actions={
        <>
          <LiveOpsBridge tables={["orders", "tables", "payments"]} fallbackIntervalMs={5000} />
          <form action={addTableAction} className="grid w-full gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 sm:w-auto sm:grid-cols-[120px_170px_180px_auto] sm:items-center">
            <input
              name="tableNumber"
              type="number"
              min={1}
              inputMode="numeric"
              required
              placeholder={translateUiText("Yeni masa no", locale)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:w-36 sm:text-sm"
            />
            <input
              name="tableName"
              placeholder={translateUiText("Masa adi", locale)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:w-44 sm:text-sm"
            />
            <select name="zoneId" defaultValue="__none__" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:w-44 sm:text-sm">
              <option value="__none__">Bölge seç (opsiyonel)</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            <PendingSubmitButton
              idleLabel={translateUiText("Yeni Masa", locale)}
              pendingLabel="Ekleniyor..."
              className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-3 text-base font-semibold text-white sm:w-auto sm:text-sm"
            />
          </form>
        </>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Masa işlemi tamamlanamadi" : "Masa işlemi tamamlandı"}
          description={feedback}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          label={translateUiText("Toplam Masa", locale)}
          value={String(tables.length)}
          hint="Salon kapasitesi"
          tone="accent"
          className="bg-[linear-gradient(130deg,rgba(220,38,38,0.14),rgba(255,255,255,0.9)_65%)]"
        />
        <SummaryCard
          label={translateUiText("Dolu Masa", locale)}
          value={String(occupiedCount)}
          hint={translateUiText("Aktif servis alan masa", locale)}
          tone="danger"
          className="bg-[linear-gradient(130deg,rgba(251,113,133,0.12),rgba(255,255,255,0.9)_65%)]"
        />
        <SummaryCard
          label={translateUiText("Boş Masa", locale)}
          value={String(emptyCount)}
          hint={translateUiText("Yeni müşteri için hazır", locale)}
          tone="success"
          className="bg-[linear-gradient(130deg,rgba(16,185,129,0.12),rgba(255,255,255,0.9)_65%)]"
        />
        <SummaryCard
          label={translateUiText("Açık Adisyon", locale)}
          value={String(activeOrderCount)}
          hint={translateUiText("Masaya bağlı operasyon", locale)}
          className="bg-[linear-gradient(130deg,rgba(59,130,246,0.1),rgba(255,255,255,0.9)_65%)]"
        />
      </section>

      <WorkflowGuide
        title={translateUiText("Masalari 3 Adimda Hazırla", locale)}
        description={translateUiText("Salon kurulumu ilk kez yapilsa bile masa akışı kolay anlasilsin.", locale)}
        className="bg-[linear-gradient(125deg,rgba(15,23,42,0.03),rgba(255,255,255,0.92)_45%,rgba(220,38,38,0.08))]"
        steps={[
          { title: translateUiText("Masayı oluştur ve isim ver", locale), description: translateUiText("Yeni masa numarasını ve görünur masa adini kaydet; ekip bu isimle çalışır.", locale) },
          { title: translateUiText("QR'i kontrol et", locale), description: translateUiText("QR ve yazdırma islerini Masa Yönet popup'i icinden tamamla.", locale) },
          { title: translateUiText("Aktif siparişi buradan izle", locale), description: translateUiText("Her kartta son adisyon ozetini gör; detayli geçmişi popup icinden ac.", locale) },
        ]}
      />

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
        <WorkspaceTabs tabs={[{ label: translateUiText("İşletmeler", locale) }, { label: translateUiText("Bölge ve Masa Yönetimi", locale), active: true }]} />

        {usingDemoData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo veride masa ekleme ve silme kalici degildir.
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Bölgeler</h2>
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">{zones.length}</span>
            </div>

            <form action={createZoneAction} className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <input
                name="zoneName"
                required
                minLength={2}
                placeholder="Yeni bölge adi"
                className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm"
              />
              <PendingSubmitButton
                idleLabel="Bölge Ac"
                pendingLabel="Olusturuluyor..."
                className="min-h-12 w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white sm:text-sm"
              />
            </form>

            <div className="mt-4 space-y-2">
              <Link
                href="/admin/tables"
                className={`block rounded-2xl border px-4 py-4 text-base transition sm:text-sm ${!zoneFilter ? "border-[#ff8b73] bg-[#fff8ee] text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                <span className="font-semibold">Tüm Bölgeler</span>
                <span className="mt-1 block text-xs text-slate-500">{tables.length} masa</span>
              </Link>
              {zones.map((zone) => (
                <div key={zone.id} className="flex items-stretch gap-2">
                  <Link
                    href={`/admin/tables?zone=${zone.id}`}
                    className={`block flex-1 rounded-2xl border px-4 py-4 text-base transition sm:text-sm ${zoneFilter === zone.id ? "border-[#ff8b73] bg-[#fff8ee] text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    <span className="font-semibold">{zone.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{zoneCounts.get(zone.id) ?? 0} masa</span>
                  </Link>
                  <form action={deleteZoneAction} className="contents">
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <PendingSubmitButton
                      idleLabel="Sil"
                      pendingLabel="..."
                      className="min-h-12 rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700"
                    />
                  </form>
                </div>
              ))}
              <Link
                href="/admin/tables?zone=__unassigned__"
                className={`block rounded-2xl border px-4 py-4 text-base transition sm:text-sm ${zoneFilter === "__unassigned__" ? "border-[#ff8b73] bg-[#fff8ee] text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                <span className="font-semibold">Atanmamis</span>
                <span className="mt-1 block text-xs text-slate-500">{unassignedCount} masa</span>
              </Link>
            </div>

            {zones.length > 0 ? (
              <form action={bulkDeleteZonesAction} className="mt-4 grid gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">Toplu Bölge Silme</p>
                <select
                  name="zoneIds"
                  multiple
                  required
                  className="min-h-28 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-rose-700">Seçilen bölgeler silinir; bu bölgelerdeki masalar otomatik olarak atanmamış olur.</p>
                <PendingSubmitButton
                  idleLabel="Seçili Bölgeleri Sil"
                  pendingLabel="Siliniyor..."
                  className="min-h-12 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700"
                />
              </form>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-[#f6f7f9] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Masalar</h2>
                <p className="text-sm text-slate-500">Seçili görünum: {selectedZoneLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#ff5a34] px-3 text-sm font-bold text-white">
                  {filteredTables.length}
                </span>
                <Link
                  href="/admin/tables/floor-plan"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kroki Düzenle
                </Link>
                <Link
                  href={deleteMode ? normalModeHref : deleteModeHref}
                  className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold ${
                    deleteMode ? "border-slate-300 bg-white text-slate-700" : "border-rose-300 bg-rose-50 text-rose-700"
                  }`}
                >
                  {deleteMode ? "Silme Modunu Kapat" : "Silme Modu"}
                </Link>
              </div>
            </div>

            <form action={bulkAddTablesAction} className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[120px_110px_1fr_180px_auto] lg:items-center">
              <input
                name="startNumber"
                type="number"
                min={1}
                inputMode="numeric"
                required
                placeholder="Başlangıç no"
                className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm"
              />
              <input
                name="count"
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                required
                placeholder="Adet"
                className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm"
              />
              <input
                name="namePrefix"
                placeholder="Toplu isim on eki (opsiyonel)"
                className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm"
              />
              <select name="zoneId" defaultValue="__none__" className="min-h-12 rounded-2xl border border-slate-300 px-4 py-3 text-base sm:text-sm">
                <option value="__none__">Bölge seç (opsiyonel)</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <PendingSubmitButton
                idleLabel="Toplu Masa Ac"
                pendingLabel="Olusturuluyor..."
                className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-[#dc2626] to-[#991b1b] px-4 py-3 text-base font-semibold text-white sm:text-sm lg:w-auto"
              />
            </form>

            <form action={bulkDeleteTablesAction} className="mt-3 grid gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-3 lg:grid-cols-[120px_120px_180px_minmax(220px,1fr)_auto] lg:items-center">
              <input
                name="startNumber"
                type="number"
                min={1}
                inputMode="numeric"
                required
                placeholder="Silme başlangıç"
                className="min-h-12 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-base sm:text-sm"
              />
              <input
                name="endNumber"
                type="number"
                min={1}
                inputMode="numeric"
                required
                placeholder="Silme bitiş"
                className="min-h-12 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-base sm:text-sm"
              />
              <select
                name="zoneId"
                defaultValue={zoneFilter === "__unassigned__" ? "__none__" : zoneFilter && zoneById.has(zoneFilter) ? zoneFilter : "__all__"}
                className="min-h-12 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-base sm:text-sm"
              >
                <option value="__all__">Tüm bölgeler</option>
                <option value="__none__">Sadece atanmamış</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">
                <input type="checkbox" name="includeNonEmpty" value="1" className="h-4 w-4 rounded border-rose-300" />
                Dolu/rezerve masalari da sil
              </label>
              <PendingSubmitButton
                idleLabel="Toplu Masa Sil"
                pendingLabel="Siliniyor..."
                className="min-h-12 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-base font-semibold text-rose-700 sm:text-sm lg:w-auto"
              />
            </form>

            {filteredTables.length === 0 ? (
              <div className="mt-4">
                <EmptyPanel title="Masa Yok" description={`${selectedZoneLabel} için masa bulunmuyor. Toplu acilis veya yeni masa ile devam edebilirsiniz.`} />
              </div>
            ) : deleteMode ? (
              <form action={bulkDeleteSelectedTablesAction} className="mt-4 space-y-3">
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  Silme modu açık. Varsayilan olarak sadece boş masalar silinir. Istersen aşağıdaki onay ile dolu/rezerve
                  masalari da silebilirsin.
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredTables.map((table) => {
                    const latestOrderRaw = latestOrderMap.get(table.id);
                    const latestOrder =
                      latestOrderRaw && !["paid", "cancelled", "refunded"].includes(latestOrderRaw.status)
                        ? latestOrderRaw
                        : null;
                    const zoneLabel = table.zone_id ? zoneById.get(table.zone_id)?.name ?? "Atanmamis" : "Atanmamis";
                    const supervisor = supervisorByTableId.get(table.id);
                    const isEmptyTable = table.status === "empty";
                    return (
                      <label
                        key={table.id}
                        className={`flex h-full cursor-pointer flex-col rounded-[24px] border bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] ${
                          isEmptyTable ? "border-rose-200" : "border-amber-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{table.name || `Masa ${table.table_number}`}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Masa {table.table_number}</p>
                            <p className="mt-1 text-sm text-slate-500">{tableStatusLabel(table.status)}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Bölge: {zoneLabel}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Sorumlu garson: <span className="font-semibold text-slate-700">{supervisor?.full_name ?? "Atanmamis"}</span>
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${tableStatusTone(table.status)}`}>{tableStatusLabel(table.status)}</span>
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          {latestOrder ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Aktif Adisyon</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">#{orderRef(latestOrder)}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${orderTone(latestOrder.status)}`}>{latestOrder.status}</span>
                              </div>
                              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                                <span>Tutar</span>
                                <span className="font-numeric">{Number(latestOrder.final_price ?? latestOrder.total_price ?? 0).toFixed(2)} TL</span>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">Bu masa yeni sipariş almak için hazır.</p>
                          )}
                        </div>

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
                          <span className={`inline-flex items-center gap-2 font-semibold ${isEmptyTable ? "text-rose-700" : "text-amber-700"}`}>
                            <input type="checkbox" name="tableIds" value={table.id} className="h-4 w-4 rounded border-rose-300" />
                            {isEmptyTable ? "Silmek için seç" : "Aktif/Rezerve masa (zorla silme için seç)"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">
                    <input type="checkbox" name="includeNonEmpty" value="1" className="h-4 w-4 rounded border-rose-300" />
                    Dolu/rezerve masalari da sil
                  </label>
                  <PendingSubmitButton
                    idleLabel="Seçili Masalari Sil"
                    pendingLabel="Siliniyor..."
                    className="min-h-12 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-base font-semibold text-rose-700 sm:w-auto sm:text-sm"
                  />
                </div>
              </form>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredTables.map((table) => {
                  const latestOrderRaw = latestOrderMap.get(table.id);
                  const latestOrder =
                    latestOrderRaw && !["paid", "cancelled", "refunded"].includes(latestOrderRaw.status)
                      ? latestOrderRaw
                      : null;
                  const zoneLabel = table.zone_id ? zoneById.get(table.zone_id)?.name ?? "Atanmamis" : "Atanmamis";
                  const supervisor = supervisorByTableId.get(table.id);
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
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Bölge: {zoneLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Sorumlu garson: <span className="font-semibold text-slate-700">{supervisor?.full_name ?? "Atanmamis"}</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${tableStatusTone(table.status)}`}>{tableStatusLabel(table.status)}</span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        {latestOrder ? (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Aktif Adisyon</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">#{orderRef(latestOrder)}</p>
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
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Hazırlık Durumu</p>
                            <p className="mt-2 text-sm text-slate-500">Bu masa yeni sipariş almak için hazır.</p>
                          </>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2">
                        {supervisorFeatureAvailable ? (
                          <form action={setTableSupervisorAction} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <input type="hidden" name="tableId" value={table.id} />
                            <select
                              name="profileId"
                              defaultValue={supervisor?.profile_id ?? "__none__"}
                              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                            >
                              <option value="__none__">Sorumlu garson yok</option>
                              {waiters.map((waiter) => (
                                <option key={waiter.id} value={waiter.id}>
                                  {waiter.full_name?.trim() || `Garson ${waiter.id.slice(0, 6)}`}
                                </option>
                              ))}
                            </select>
                            <PendingSubmitButton
                              idleLabel="Sorumlu Kaydet"
                              pendingLabel="Kaydediliyor..."
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            />
                          </form>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            Sorumlu garson atamasi için son migration henüz uygulanmamis.
                          </div>
                        )}
                        <Link href={`/admin/tables?table=${table.id}${zoneFilter ? `&zone=${zoneFilter}` : ""}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#dc2626] to-[#991b1b] px-3 py-3 text-center text-base font-semibold text-white sm:text-sm">
                          Masa Yönet
                        </Link>
                        {latestOrder ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Link href={`/cashier?order=${latestOrder.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
                              Kasada Aç
                            </Link>
                            <Link href={`/receipt/${latestOrder.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-base font-semibold text-slate-700 sm:text-sm">
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
          receiptDetailsByOrderId={selectedReceiptDetailsByOrderId}
          qrTarget={selectedTableQrTarget}
          qrImage={selectedTableQrImage}
          movableTables={movableTables}
          businessSlug={businessSlug}
          categories={categories}
          products={products}
          modifierGroups={modifierGroups}
          modifierOptions={modifierOptions}
          allTables={tables}
          zones={zones}
        />
      ) : null}
    </BackofficePage>
  );
}
