import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUserWithRole, hasRoleAccess, requireRole } from "@/lib/auth";
import { getMenu } from "@/lib/domains/orders";
import {
  getTableMap,
  getTableZones,
  listLatestOrdersByTableIds,
  listTableRequests,
  listTableSupervisors,
} from "@/lib/domains/tables";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import type { TableStatus } from "@/lib/types";

const statusStyles: Record<TableStatus, string> = {
  empty: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-800",
  reserved: "bg-sky-100 text-sky-800",
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

function flowHref(filter: TableFilter, tableId?: string | null) {
  const params = new URLSearchParams();
  params.set("flow", "new-order");
  if (tableId) {
    params.set("tableId", tableId);
  }
  if (filter !== "all") {
    params.set("status", filter);
  }
  return `/m/tables?${params.toString()}`;
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
  if (status === "empty") return "Bos";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function orderStatusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "ready") return "Servise Hazır";
  if (status === "served") return "Servise Hazır";
  if (status === "partially_paid") return "Kısmi Ödeme";
  if (status === "paid") return "Kapandi";
  if (status === "partially_refunded") return "Kısmi Iade";
  if (status === "cancelled") return "Iptal";
  if (status === "refunded") return "Iade";
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
  await requireRole(["admin", "waiter", "cashier"], "/m/tables");

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
  await requireRole(["admin", "waiter", "cashier", "kitchen"], "/m/tables");
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
  const canOpenOrders = allowAll || hasRoleAccess(currentUser.role, ["admin", "waiter", "cashier"]);
  const canUseCashier = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);
  const canOpenKitchen = allowAll || hasRoleAccess(currentUser.role, ["admin", "kitchen"]);
  const canManageReservations = allowAll || hasRoleAccess(currentUser.role, ["admin", "waiter", "cashier"]);

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

  const openOrderFlow = activeFlow === "new-order" && canOpenOrders;
  const selectedTableId = requestedTableId && sortedTables.some((table) => table.id === requestedTableId)
    ? requestedTableId
    : filteredTables[0]?.id ?? sortedTables[0]?.id;
  const selectedTable = selectedTableId ? sortedTables.find((table) => table.id === selectedTableId) ?? null : null;

  const orderEntryData = openOrderFlow
    ? await (async () => {
        const businessScope = await getBusinessScopeContext();
        const { categories, products, modifierGroups, modifierOptions, usingDemoData: usingMenuDemo } = await getMenu(
          businessScope.activeSlug,
        );
        return {
          businessSlug: businessScope.activeSlug,
          categories,
          products,
          modifierGroups,
          modifierOptions,
          usingMenuDemo,
        };
      })()
    : null;

  return (
    <>
      <LiveOpsBridge tables={["tables", "orders", "table_requests"]} />

      {feedback ? (
        <div className={`m-card ${tone === "error" ? "m-banner-error" : "m-banner-success"}`}>
          {feedback}
        </div>
      ) : null}

      {usingDemoData ? (
        <div className="m-card m-banner-warning">Demo veri modu aktif.</div>
      ) : null}
      {orderEntryData?.usingMenuDemo ? <div className="m-card m-banner-warning">Menü demo verisi kullaniliyor.</div> : null}

      <section className="m-grid-3 mt-3">
        <article className="m-card text-center">
          <p className="m-label">Bos</p>
          <p className="m-value text-emerald-700">{emptyCount}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Dolu</p>
          <p className="m-value text-amber-700">{occupiedCount}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Rezerve</p>
          <p className="m-value text-sky-700">{reservedCount}</p>
        </article>
      </section>

      <section className="m-card m-segment-wrap mt-3">
        <div className="m-segment-row">
          <Link href={baseHref("all")} data-active={activeFilter === "all"} className="m-segment-pill">
            Tumu
          </Link>
          <Link href={baseHref("empty")} data-active={activeFilter === "empty"} className="m-segment-pill">
            Bos
          </Link>
          <Link href={baseHref("occupied")} data-active={activeFilter === "occupied"} className="m-segment-pill">
            Dolu
          </Link>
          <Link href={baseHref("reserved")} data-active={activeFilter === "reserved"} className="m-segment-pill">
            Rezerve
          </Link>
        </div>
        <p className="m-muted mt-2">Açık adisyon: {openOrderCount} - Açık servis talebi: {openRequestCountLabel}</p>
      </section>

      <section className="m-stack mt-3">
        {filteredTables.length === 0 ? (
          <article className="m-card">
            <p className="m-value-sm">Bu filtrede gosterilecek masa yok.</p>
          </article>
        ) : (
          filteredTables.map((table) => {
            const latestOrder = ordersByTableId.get(table.id);
            const requestCount = requestCountByTableId.get(table.id) ?? 0;
            const zoneName = table.zone_id ? zoneNameById.get(table.zone_id) ?? "Bölge silinmis" : "Bolgesiz";
            const supervisor = supervisorByTableId.get(table.id);
            const hasOpenOrder = latestOrder ? isOpenOrderStatus(latestOrder.status) : false;

            return (
              <article key={`m-table-${table.id}`} className="m-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-label">Masa {table.table_number}</p>
                    <p className="m-value-sm">{table.name || `Masa ${table.table_number}`}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[table.status]}`}>
                    {tableStatusLabel(table.status)}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <p>Bölge: <span className="font-semibold text-slate-900">{zoneName}</span></p>
                  <p>Sorumlu: <span className="font-semibold text-slate-900">{supervisor?.full_name ?? "Atanmamis"}</span></p>
                </div>

                {latestOrder ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <p className="m-label">Açık Adisyon</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">#{orderRef(latestOrder)}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {orderStatusLabel(latestOrder.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Kalan: <span className="font-semibold text-emerald-700">{formatMoney(Number(latestOrder.remaining_balance ?? latestOrder.final_price ?? latestOrder.total_price))}</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    Bu masada açık adisyon yok.
                  </div>
                )}

                {requestCount > 0 ? (
                  <div className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800">
                    {requestCount} açık servis talebi var.
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {canOpenOrders ? (
                    <Link href={flowHref(activeFilter, table.id)} className="m-btn-primary inline-flex items-center justify-center">
                      {latestOrder && hasOpenOrder ? "Siparise Ekle" : "Sipariş Ac"}
                    </Link>
                  ) : null}

                  {canUseCashier && latestOrder && hasOpenOrder ? (
                    <Link href={`/m/cashier?order=${encodeURIComponent(latestOrder.id)}`} className="m-btn-secondary inline-flex items-center justify-center">
                      Adisyona Git
                    </Link>
                  ) : null}

                  {canOpenKitchen && latestOrder && hasOpenOrder ? (
                    <Link href="/m/kitchen" className="m-btn-secondary inline-flex items-center justify-center">
                      Mutfaga Git
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
                        idleLabel="Rezerveye Al"
                        pendingLabel="Isleniyor..."
                        className="m-btn-secondary min-h-[44px] w-full"
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
                        idleLabel="Rezervasyonu Kaldir"
                        pendingLabel="Isleniyor..."
                        className="m-btn-secondary min-h-[44px] w-full"
                      />
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      {openOrderFlow && orderEntryData ? (
        <div className="m-flow-overlay">
          <div className="m-flow-shell">
            <header className="m-flow-header">
              <div>
                <p className="m-label">Sipariş Akışı</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedTable ? `${selectedTable.name || `Masa ${selectedTable.table_number}`} Siparisi` : "Yeni Sipariş"}
                </h2>
              </div>
              <Link href={baseHref(activeFilter)} className="m-btn-secondary inline-flex items-center justify-center px-3">
                Kapat
              </Link>
            </header>

            <div className="mt-3">
              <AdminOrderEntry
                businessSlug={orderEntryData.businessSlug}
                categories={orderEntryData.categories}
                products={orderEntryData.products}
                modifierGroups={orderEntryData.modifierGroups}
                modifierOptions={orderEntryData.modifierOptions}
                tables={sortedTables}
                initialTableId={selectedTableId}
                mobilePresentation="stack"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
