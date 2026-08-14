import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { MobileTablesUi } from "@/components/mobile-tables-ui";
import { getCurrentUserWithRole, hasRoleAccess, requireRole } from "@/lib/auth";
import {
  getTableMap,
  getTableZones,
  listLatestOrdersByTableIds,
  listTableRequests,
  listTableSupervisors,
} from "@/lib/domains/tables";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import type { TableStatus } from "@/lib/types";

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

  const currentUser = await getCurrentUserWithRole();
  const allowAll = currentUser.usingDemoData;
  const canOpenOrders = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier", "waiter"]);
  const canUseCashier = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);
  const canOpenKitchen = allowAll || hasRoleAccess(currentUser.role, ["admin", "kitchen"]);
  const canManageReservations = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier", "waiter"]);

  const { tables, usingDemoData: usingTablesDemo } = await getTableMap();
  const sortedTables = [...tables].sort((left, right) => left.table_number - right.table_number);
  const tableIds = sortedTables.map((table) => table.id);

  const [
    { ordersByTableId, usingDemoData: usingOrdersDemo },
    { requests: openRequests, usingDemoData: usingRequestsDemo },
    { zones, usingDemoData: usingZonesDemo },
    { assignments: tableSupervisors, usingDemoData: usingSupervisorsDemo },
  ] = await Promise.all([
    listLatestOrdersByTableIds(tableIds),
    listTableRequests("open", { limit: 80, page: 1, includeTableNumber: false }),
    getTableZones(),
    listTableSupervisors(),
  ]);

  const usingDemoData = usingTablesDemo || usingOrdersDemo || usingRequestsDemo || usingZonesDemo || usingSupervisorsDemo;

  return (
    <>
      <LiveOpsBridge tables={["tables", "orders", "table_requests"]} />

      {feedback && (
        <div className={`border rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-3.5 ${
          tone === "error" 
            ? "border-rose-200 bg-rose-50 text-rose-800" 
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          {tone === "error" ? <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
          <p className="text-xs font-bold">{feedback}</p>
        </div>
      )}

      {usingDemoData && (
        <div className="border border-amber-250 rounded-2xl bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Demo veri modu aktif.</p>
        </div>
      )}

      <MobileTablesUi 
        tables={sortedTables}
        ordersByTableId={ordersByTableId}
        openRequests={openRequests}
        zones={zones}
        tableSupervisors={tableSupervisors}
        canOpenOrders={canOpenOrders}
        canUseCashier={canUseCashier}
        canOpenKitchen={canOpenKitchen}
        canManageReservations={canManageReservations}
        activeFilter={activeFilter}
        setTableStatusAction={setTableStatusAction}
      />
    </>
  );
}
