import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  User, 
  MapPin, 
  AlertCircle, 
  PlusCircle, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Info,
  CheckCircle2 
} from "lucide-react";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUserWithRole, hasRoleAccess, requireRole } from "@/lib/auth";
import {
  getTableMap,
  getTableZones,
  listLatestOrdersByTableIds,
  listTableRequests,
  listTableSupervisors,
} from "@/lib/domains/tables";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { TableStatus } from "@/lib/types";

const statusStyles: Record<TableStatus, string> = {
  empty: "bg-emerald-500 text-white uupm-glow-success",
  occupied: "bg-amber-500 text-white uupm-glow-warning",
  reserved: "bg-indigo-500 text-white uupm-glow-warning",
};

type TableFilter = "all" | TableStatus;

type TablesSearchParams = {
  status?: string;
  feedback?: string;
  tone?: "success" | "error";
  flow?: string;
  tableId?: string;
};

function parseTableFilter(value?: string | null): TableFilter {
  if (value === "empty" || value === "occupied" || value === "reserved") {
    return value;
  }
  return "all";
}

function parseFlow(value?: string | null) {
  if (value === "new-order") {
    return "new-order" as const;
  }
  return null;
}

function baseHref(filter: TableFilter) {
  return filter === "all" ? "/m/tables" : `/m/tables?status=${filter}`;
}

function feedbackHref(tone: "success" | "error", message: string, filter: TableFilter, flow?: string | null, tableId?: string | null) {
  const params = new URLSearchParams();
  params.set("tone", tone);
  params.set("feedback", message);
  if (filter !== "all") {
    params.set("status", filter);
  }
  if (flow === "new-order") {
    params.set("flow", flow);
  }
  if (tableId) {
    params.set("tableId", tableId);
  }
  return `/m/tables?${params.toString()}`;
}

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Boş";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function orderStatusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazırlanıyor";
  if (status === "ready") return "Servise Hazır";
  if (status === "served") return "Servise Hazır";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandı";
  if (status === "partially_refunded") return "Kısmi İade";
  if (status === "cancelled") return "İptal";
  if (status === "refunded") return "İade";
  return status;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function isOpenOrderStatus(status: string) {
  return status === "pending" || status === "preparing" || status === "ready" || status === "served" || status === "partially_paid";
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

async function setTableStatusAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/tables");

  const tableId = String(formData.get("tableId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  const returnFilter = parseTableFilter(String(formData.get("returnStatusFilter") ?? "").trim());
  const returnFlow = parseFlow(String(formData.get("returnFlow") ?? "").trim());
  const returnTableId = String(formData.get("returnFlowTableId") ?? "").trim() || null;

  if (!tableId || (nextStatus !== "empty" && nextStatus !== "reserved")) {
    redirect(feedbackHref("error", "Masa durumu güncellenemedi.", returnFilter, returnFlow, returnTableId));
  }

  const result = await executeWebOpsCommand({
    type: "TABLE_STATUS_SET",
    payload: {
      table_id: tableId,
      status: nextStatus,
    },
  });

  if (result.status !== "ACK") {
    redirect(feedbackHref("error", result.message ?? "Masa durumu güncellenemedi.", returnFilter, returnFlow, returnTableId));
  }

  revalidatePath("/m/tables");
  revalidatePath("/tables");
  revalidatePath("/ops");
  revalidatePath("/m/ops");
  revalidatePath("/admin/tables");

  redirect(
    feedbackHref(
      "success",
      nextStatus === "reserved" ? "Masa rezerveye alındı." : "Masa tekrar boş duruma alındı.",
      returnFilter,
      returnFlow,
      returnTableId,
    ),
  );
}

export default async function MobileTablesPage({
  searchParams,
}: {
  searchParams: Promise<TablesSearchParams>;
}) {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "cashier", "kitchen"], "/m/tables");
  const {
    status: rawFilter,
    feedback,
    tone,
    flow: rawFlow,
    tableId: requestedTableId,
  } = await searchParams;
  const activeFilter = parseTableFilter(rawFilter);
  const activeFlow = parseFlow(rawFlow);

  const currentUser = await getCurrentUserWithRole();
  const allowAll = currentUser.usingDemoData;
  const canOpenOrders = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);
  const canUseCashier = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);
  const canOpenKitchen = allowAll || hasRoleAccess(currentUser.role, ["admin", "kitchen"]);
  const canManageReservations = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);

  const { tables, usingDemoData: usingTablesDemo } = await getTableMap();
  const sortedTables = [...tables].sort((left, right) => left.table_number - right.table_number);
  const tableIds = sortedTables.map((table) => table.id);

  const [
    { ordersByTableId, usingDemoData: usingOrdersDemo },
    { requests: openRequests, hasNextPage: hasMoreOpenRequests, usingDemoData: usingRequestsDemo },
    { zones, usingDemoData: usingZonesDemo },
    { assignments: tableSupervisors, usingDemoData: usingSupervisorsDemo },
  ] = await Promise.all([
    listLatestOrdersByTableIds(tableIds),
    listTableRequests("open", { limit: 80, page: 1, includeTableNumber: false }),
    getTableZones(),
    listTableSupervisors(),
  ]);

  const usingDemoData = usingTablesDemo || usingOrdersDemo || usingRequestsDemo || usingZonesDemo || usingSupervisorsDemo;
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.name]));
  const supervisorByTableId = new Map(tableSupervisors.map((assignment) => [assignment.table_id, assignment]));
  const requestCountByTableId = new Map<string, number>();
  for (const request of openRequests) {
    const currentCount = requestCountByTableId.get(request.table_id) ?? 0;
    requestCountByTableId.set(request.table_id, currentCount + 1);
  }

  const filteredTables =
    activeFilter === "all" ? sortedTables : sortedTables.filter((table) => table.status === activeFilter);
  const emptyCount = sortedTables.filter((table) => table.status === "empty").length;
  const occupiedCount = sortedTables.filter((table) => table.status === "occupied").length;
  const reservedCount = sortedTables.filter((table) => table.status === "reserved").length;
  const openOrderCount = [...ordersByTableId.values()].filter((order) => isOpenOrderStatus(order.status)).length;
  const openRequestCountLabel = hasMoreOpenRequests ? `${openRequests.length}+` : String(openRequests.length);

  const selectedTableId = requestedTableId && sortedTables.some((table) => table.id === requestedTableId)
    ? requestedTableId
    : null;

  return (
    <>
      <LiveOpsBridge tables={["tables", "orders", "table_requests"]} />

      {feedback ? (
        <div className={`m-card border rounded-[22px] p-4 shadow-sm mb-4 flex items-center gap-3.5 ${
          tone === "error" 
            ? "border-rose-200 bg-rose-50 text-rose-800" 
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          {tone === "error" ? <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
          <p className="text-xs font-bold">{feedback}</p>
        </div>
      ) : null}

      {usingDemoData ? (
        <div className="m-card m-banner-warning border border-amber-300 rounded-[20px] bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Demo veri modu aktif.</p>
        </div>
      ) : null}

      {/* Tables Status KPI Grid */}
      <section className="m-grid-3">
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 font-sans">Boş</p>
          <p className="mt-1.5 text-2xl font-black text-emerald-600 uupm-monospace-num">{emptyCount}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 font-sans">Dolu</p>
          <p className="mt-1.5 text-2xl font-black text-amber-600 uupm-monospace-num">{occupiedCount}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 font-sans">Rezerve</p>
          <p className="mt-1.5 text-2xl font-black text-indigo-600 uupm-monospace-num">{reservedCount}</p>
        </article>
      </section>

      {/* Segment Filter and Summary */}
      <section className="m-card m-segment-wrap rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm mt-3.5">
        <div className="m-segment-row">
          <Link href={baseHref("all")} data-active={activeFilter === "all"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Tümü
          </Link>
          <Link href={baseHref("empty")} data-active={activeFilter === "empty"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Boş ({emptyCount})
          </Link>
          <Link href={baseHref("occupied")} data-active={activeFilter === "occupied"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Dolu ({occupiedCount})
          </Link>
          <Link href={baseHref("reserved")} data-active={activeFilter === "reserved"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Rezerve ({reservedCount})
          </Link>
        </div>
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Info className="h-4 w-4 text-slate-400 shrink-0" />
          <span>Açık adisyon: {openOrderCount} — Masa talebi: {openRequestCountLabel}</span>
        </div>
      </section>

      {/* Tables Grid stack */}
      <section className="grid gap-3.5 mt-3.5">
        {filteredTables.length === 0 ? (
          <article className="m-card border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center rounded-[24px]">
            <p className="text-sm font-bold text-slate-800">Masa bulunamadı.</p>
          </article>
        ) : (
          filteredTables.map((table) => {
            const latestOrder = ordersByTableId.get(table.id);
            const requestCount = requestCountByTableId.get(table.id) ?? 0;
            const zoneName = table.zone_id ? zoneNameById.get(table.zone_id) ?? "Belirsiz" : "Bölgesiz";
            const supervisor = supervisorByTableId.get(table.id);
            const hasOpenOrder = latestOrder ? isOpenOrderStatus(latestOrder.status) : false;
            const hasRequests = requestCount > 0;

            return (
              <article 
                key={`m-table-${table.id}`} 
                className={`m-card uupm-card-interactive rounded-[24px] border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                  hasRequests 
                    ? "border-amber-400 uupm-pulsing-warning" 
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">MASA {table.table_number}</p>
                    <p className="text-base font-black text-slate-900 mt-1">{table.name || `Masa ${table.table_number}`}</p>
                  </div>
                  <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${statusStyles[table.status]}`}>
                    {tableStatusLabel(table.status)}
                  </span>
                </div>

                <div className="mt-3.5 space-y-1.5 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" strokeWidth={2.2} />
                    <p>Bölge: <span className="font-bold text-slate-800">{zoneName}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400 shrink-0" strokeWidth={2.2} />
                    <p>Garson: <span className="font-bold text-slate-800">{supervisor?.full_name ?? "Atanmamış"}</span></p>
                  </div>
                </div>

                {/* Sub Panel for Active orders */}
                {latestOrder ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 shadow-sm">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Açık Adisyon</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900">#{orderRef(latestOrder)}</span>
                      <span className="rounded-full bg-white border border-slate-200/50 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider shadow-sm">
                        {orderStatusLabel(latestOrder.status)}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-400">Kalan Tutar</span>
                      <span className="font-black text-emerald-700 uupm-monospace-num">{formatMoney(Number(latestOrder.remaining_balance ?? latestOrder.final_price ?? latestOrder.total_price))}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-3.5 py-3 text-xs font-semibold text-slate-400">
                    Açık adisyon bulunmuyor.
                  </div>
                )}

                {requestCount > 0 ? (
                  <div className="mt-3 rounded-2xl bg-amber-500/10 border border-amber-500/15 px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>{requestCount} Açık Servis Talebi Var</span>
                  </div>
                ) : null}

                {/* Grid Buttons */}
                <div className="mt-4 grid gap-2">
                  {canOpenOrders ? (
                    <Link 
                      href={`/admin/orders?table=${table.id}`} 
                      className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 text-white w-full inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-98 transition-all"
                    >
                      <PlusCircle className="h-4.5 w-4.5" strokeWidth={2.4} />
                      {latestOrder && hasOpenOrder ? "Siparişe Ekle" : "Sipariş Aç"}
                    </Link>
                  ) : null}

                  {canUseCashier && latestOrder && hasOpenOrder ? (
                    <Link 
                      href={`/m/cashier?order=${encodeURIComponent(latestOrder.id)}`} 
                      className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      Adisyona Git
                      <ArrowRight className="h-4.5 w-4.5 text-slate-600" strokeWidth={2.4} />
                    </Link>
                  ) : null}

                  {canOpenKitchen && latestOrder && hasOpenOrder ? (
                    <Link 
                      href="/m/kitchen" 
                      className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      Mutfak Ekranı
                      <ArrowRight className="h-4.5 w-4.5 text-slate-600" strokeWidth={2.4} />
                    </Link>
                  ) : null}

                  {canManageReservations && table.status === "empty" ? (
                    <form action={setTableStatusAction}>
                      <input type="hidden" name="tableId" value={table.id} />
                      <input type="hidden" name="status" value="reserved" />
                      <input type="hidden" name="returnStatusFilter" value={activeFilter} />
                      <input type="hidden" name="returnFlow" value={activeFlow ?? ""} />
                      <input type="hidden" name="returnFlowTableId" value={selectedTableId ?? ""} />
                      <PendingSubmitButton
                        idleLabel="Rezerve Et"
                        pendingLabel="İşleniyor..."
                        className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 min-h-[44px] w-full text-xs font-bold uppercase tracking-wider rounded-2xl shadow-sm"
                      />
                    </form>
                  ) : null}

                  {canManageReservations && table.status === "reserved" ? (
                    <form action={setTableStatusAction}>
                      <input type="hidden" name="tableId" value={table.id} />
                      <input type="hidden" name="status" value="empty" />
                      <input type="hidden" name="returnStatusFilter" value={activeFilter} />
                      <input type="hidden" name="returnFlow" value={activeFlow ?? ""} />
                      <input type="hidden" name="returnFlowTableId" value={selectedTableId ?? ""} />
                      <PendingSubmitButton
                        idleLabel="Rezervasyonu Kaldır"
                        pendingLabel="İşleniyor..."
                        className="mobile-cta-secondary border border-slate-200 hover:bg-slate-50 text-slate-800 min-h-[44px] w-full text-xs font-bold uppercase tracking-wider rounded-2xl shadow-sm"
                      />
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
      <div className="h-4" aria-hidden="true" />
    </>
  );
}
