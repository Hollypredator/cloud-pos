import { unstable_cache } from "next/cache";
import { ALL_BRANCHES_VALUE } from "@/lib/business";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DiningTable, Order, OrderStatus, TableStatus } from "@/lib/types";

type Scope = {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
};

type CreateTableResult =
  | { ok: true; usingDemoData: true; qrCodeIdentifier: string }
  | { ok: true; id: string; qrCodeIdentifier: string; usingDemoData: false }
  | { ok: false; error: string };

type MutationDeps = {
  getDefaultBusinessScope: () => Promise<Scope>;
  getTenantDataClient?: () => Promise<NonNullable<ReturnType<typeof getSupabaseServerClient>> | null>;
  logAuditEvent: (input: {
    entityType: string;
    entityId: string;
    action: string;
    details?: Record<string, unknown>;
  }) => Promise<void>;
  revalidateOperationsCaches: () => void;
};

type TableMoveResult =
  | { ok: true }
  | { ok: false; error: string };

type QueryDeps = {
  getDefaultBusinessScope: () => Promise<Scope>;
  getOrderPaymentSummaryMap: (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
    orderIds: string[],
  ) => Promise<Map<string, { net: number; count: number }>>;
  withQueryTimeout: <T>(promise: PromiseLike<T>, ms?: number) => Promise<T>;
  demoOrders: Order[];
  demoTables: DiningTable[];
};

function createQrIdentifier(tableNumber: number) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `table-${tableNumber}-${suffix}`;
}

async function resolveMutationBranchId(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, scope: Scope) {
  if (scope.branchId && scope.branchId !== ALL_BRANCHES_VALUE) {
    return scope.branchId;
  }

  if (!scope.businessId) {
    return null;
  }

  const { data: firstBranch, error } = await supabase
    .from("branches")
    .select("id")
    .eq("business_id", scope.businessId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (firstBranch?.id as string | undefined) ?? null;
}

export async function listLatestOrdersByTableIdsImpl(tableIds: string[], deps: QueryDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const latestOrders = new Map<string, Order>();
    for (const tableId of tableIds) {
      const latest = deps.demoOrders
        .filter((order) => order.table_id === tableId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (latest) {
        latestOrders.set(tableId, latest);
      }
    }
    return { ordersByTableId: latestOrders, usingDemoData: true };
  }

  if (tableIds.length === 0) {
    return { ordersByTableId: new Map<string, Order>(), usingDemoData: false };
  }

  const scope = await deps.getDefaultBusinessScope();
  const sortedTableIds = [...tableIds].sort();
  const cacheKey = `latest-orders-by-table:${scope.businessId ?? "none"}:${scope.useLegacySchema ? "legacy" : "scoped"}:${sortedTableIds.join(",")}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
        .from("orders")
        .select("id, table_id, total_price, final_price, status, created_at")
        .in("table_id", sortedTableIds)
        .order("created_at", { ascending: false });
      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }

      const result = await query;
      return {
        data: result.data as Array<{ id: string; table_id: string; total_price: number; final_price: number | null; status: OrderStatus; created_at: string }> | null,
        error: result.error as { message: string } | null,
      };
    },
    [cacheKey],
    { revalidate: 8, tags: ["orders-summary", "table-map"] },
  );

  const cached = await reader();
  const data = cached?.data ?? null;
  const error = cached?.error ?? null;
  if (error) {
    return { ordersByTableId: new Map<string, Order>(), usingDemoData: false };
  }

  const latestRows = new Map<string, { id: string; table_id: string; total_price: number; final_price: number | null; status: OrderStatus; created_at: string }>();
  for (const row of (data ?? []) as Array<{ id: string; table_id: string; total_price: number; final_price: number | null; status: OrderStatus; created_at: string }>) {
    if (!latestRows.has(row.table_id)) {
      latestRows.set(row.table_id, row);
    }
  }

  const orderIds = [...latestRows.values()].map((row) => row.id);
  const paymentSummary = await deps.getOrderPaymentSummaryMap(supabase, orderIds);
  const ordersByTableId = new Map<string, Order>();
  for (const row of latestRows.values()) {
    ordersByTableId.set(row.table_id, {
      id: row.id,
      table_id: row.table_id,
      items: [],
      total_price: Number(row.total_price),
      final_price: Number(row.final_price ?? row.total_price),
      amount_paid: paymentSummary.get(row.id)?.net ?? 0,
      remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
      payment_count: paymentSummary.get(row.id)?.count ?? 0,
      status: row.status,
      created_at: row.created_at,
    });
  }

  return { ordersByTableId, usingDemoData: false };
}

export async function getOrderHistoryByTableIdImpl(tableId: string, limit: number, deps: QueryDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const history = deps.demoOrders
      .filter((order) => order.table_id === tableId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    return { orders: history, usingDemoData: true };
  }

  const cacheKey = `order-history:${tableId}:${limit}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      const result = await innerSupabase
        .from("orders")
        .select("id, table_id, total_price, final_price, status, created_at")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false })
        .limit(limit);

      return {
        data: result.data as Array<{
          id: string;
          table_id: string;
          total_price: number;
          final_price?: number;
          status: OrderStatus;
          created_at: string;
        }> | null,
        error: result.error as { message: string } | null,
      };
    },
    [cacheKey],
    { revalidate: 8, tags: ["orders-summary", "table-map"] },
  );

  const cached = await reader();
  const data = cached?.data ?? null;
  const error = cached?.error ?? null;
  if (error) {
    return { orders: [] as Order[], usingDemoData: false };
  }

  const orderIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const paymentSummary = await deps.getOrderPaymentSummaryMap(supabase, orderIds);

  return {
    orders: ((data ?? []) as Array<{
      id: string;
      table_id: string;
      total_price: number;
      final_price?: number;
      status: OrderStatus;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      table_id: row.table_id,
      items: [],
      total_price: Number(row.total_price),
      final_price: Number(row.final_price ?? row.total_price),
      amount_paid: paymentSummary.get(row.id)?.net ?? 0,
      remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
      payment_count: paymentSummary.get(row.id)?.count ?? 0,
      status: row.status,
      created_at: row.created_at,
    })),
    usingDemoData: false,
  };
}

export async function getTableMapImpl(deps: QueryDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { tables: deps.demoTables, usingDemoData: true };
  }

  const scope = await deps.getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { tables: [] as DiningTable[], usingDemoData: false };
  }

  const cacheKey = `table-map:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const readerSupabase = getSupabaseServerClient();
      if (!readerSupabase) {
        return null;
      }

      let query = readerSupabase
        .from("tables")
        .select("id, business_id, branch_id, table_number, name, status, qr_code_identifier")
        .order("table_number", { ascending: true });
      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }
      if (scope.branchId) {
        query = query.eq("branch_id", scope.branchId);
      }

      try {
        const result = (await deps.withQueryTimeout(query)) as { data: unknown[] | null; error: { message: string } | null };
        return { data: result.data as unknown[] | null, error: result.error as { message: string } | null };
      } catch {
        return { data: null, error: { message: "Query timeout" } };
      }
    },
    [cacheKey],
    { revalidate: 10, tags: ["table-map"] },
  );

  const cached = await reader();
  if (!cached || cached.error) {
    return { tables: [] as DiningTable[], usingDemoData: false };
  }

  return { tables: (cached.data ?? []) as DiningTable[], usingDemoData: false };
}

export async function createTableImpl(tableNumber: number, name: string | undefined, deps: MutationDeps): Promise<CreateTableResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: true, usingDemoData: true, qrCodeIdentifier: createQrIdentifier(tableNumber) };
  }

  const qrCodeIdentifier = createQrIdentifier(tableNumber);
  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.useLegacySchema && scope.businessId && !targetBranchId) {
    return { ok: false, error: "Masa eklemek icin once aktif bir sube secilmeli veya olusturulmali." };
  }

  const withBusinessPayload = {
    business_id: scope.businessId,
    branch_id: targetBranchId,
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };
  const fallbackPayload = {
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };

  let data: { id: string; qr_code_identifier: string } | null = null;
  let error: { message: string } | null = null;
  const firstInsert = await supabase.from("tables").insert(withBusinessPayload).select("id, qr_code_identifier").single();
  data = firstInsert.data as { id: string; qr_code_identifier: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (error?.message?.toLowerCase().includes("business_id")) {
    const secondInsert = await supabase.from("tables").insert(fallbackPayload).select("id, qr_code_identifier").single();
    data = secondInsert.data as { id: string; qr_code_identifier: string } | null;
    error = secondInsert.error as { message: string } | null;
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Masa olusturulamadi." };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: data.id,
    action: "create",
    details: { tableNumber, tableName: name?.trim() || `Masa ${tableNumber}`, qrCodeIdentifier: data.qr_code_identifier },
  });

  deps.revalidateOperationsCaches();
  return { ok: true, id: data.id, qrCodeIdentifier: data.qr_code_identifier, usingDemoData: false };
}

export async function updateTableDetailsImpl(input: { tableId: string; tableNumber: number; name: string }, deps: MutationDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda masa guncelleme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  let query = supabase
    .from("tables")
    .update({
      table_number: input.tableNumber,
      name: input.name.trim() || `Masa ${input.tableNumber}`,
    })
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    query = query.eq("branch_id", targetBranchId);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: input.tableId,
    action: "update",
    details: { tableNumber: input.tableNumber, tableName: input.name.trim() || `Masa ${input.tableNumber}` },
  });

  deps.revalidateOperationsCaches();
  return { ok: true };
}

export async function deleteTableImpl(tableId: string, deps: MutationDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda silme islemi pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  let rowQuery = supabase.from("tables").select("id, status").eq("id", tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    rowQuery = rowQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    rowQuery = rowQuery.eq("branch_id", targetBranchId);
  }

  const { data: tableRow, error: rowError } = await rowQuery.maybeSingle();
  if (rowError || !tableRow) {
    return { ok: false, error: rowError?.message ?? "Masa bulunamadi." };
  }
  if ((tableRow.status as TableStatus) !== "empty") {
    return { ok: false, error: "Yalnizca bos masalar silinebilir." };
  }

  let deleteQuery = supabase.from("tables").delete().eq("id", tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
  }

  const { error } = await deleteQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({ entityType: "table", entityId: tableId, action: "delete" });
  deps.revalidateOperationsCaches();
  return { ok: true };
}

export async function moveTableOrderImpl(
  input: { sourceTableId: string; targetTableId: string },
  deps: MutationDeps,
): Promise<TableMoveResult> {
  const supabase = (await deps.getTenantDataClient?.()) ?? getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda adisyon tasima pasif." };
  }

  if (input.sourceTableId === input.targetTableId) {
    return { ok: false, error: "Adisyon ayni masaya tasinamaz." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);

  let activeOrderQuery = supabase
    .from("orders")
    .select("id, status, table_id")
    .eq("table_id", input.sourceTableId)
    .in("status", ["pending", "preparing", "served"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (!scope.useLegacySchema && scope.businessId) {
    activeOrderQuery = activeOrderQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    activeOrderQuery = activeOrderQuery.eq("branch_id", targetBranchId);
  }

  const { data: orderRow, error: orderError } = await activeOrderQuery.maybeSingle();
  if (orderError || !orderRow) {
    return { ok: false, error: orderError?.message ?? "Tasinacak aktif adisyon bulunamadi." };
  }

  let targetTableQuery = supabase
    .from("tables")
    .select("id, status")
    .eq("id", input.targetTableId);
  if (!scope.useLegacySchema && scope.businessId) {
    targetTableQuery = targetTableQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    targetTableQuery = targetTableQuery.eq("branch_id", targetBranchId);
  }

  const { data: targetTable, error: targetTableError } = await targetTableQuery.maybeSingle();
  if (targetTableError || !targetTable) {
    return { ok: false, error: targetTableError?.message ?? "Hedef masa bulunamadi." };
  }

  if ((targetTable.status as TableStatus) !== "empty") {
    return { ok: false, error: "Adisyon sadece bos bir masaya tasinabilir." };
  }

  let updateOrderQuery = supabase
    .from("orders")
    .update({ table_id: input.targetTableId })
    .eq("id", orderRow.id);
  if (!scope.useLegacySchema && scope.businessId) {
    updateOrderQuery = updateOrderQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    updateOrderQuery = updateOrderQuery.eq("branch_id", targetBranchId);
  }

  const { error: updateOrderError } = await updateOrderQuery;
  if (updateOrderError) {
    return { ok: false, error: updateOrderError.message };
  }

  await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", input.sourceTableId);
  await supabase.from("tables").update({ status: "occupied" as TableStatus }).eq("id", input.targetTableId);

  await deps.logAuditEvent({
    entityType: "order",
    entityId: orderRow.id as string,
    action: "move_table",
    details: {
      fromTableId: input.sourceTableId,
      toTableId: input.targetTableId,
    },
  });

  deps.revalidateOperationsCaches();
  return { ok: true };
}
