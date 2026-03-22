import { unstable_cache } from "next/cache";
import { ALL_BRANCHES_VALUE } from "@/lib/business";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DiningTable, Order, OrderStatus, TableStatus, TableZone } from "@/lib/types";

type Scope = {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
};

type CreateTableResult =
  | { ok: true; usingDemoData: true; qrCodeIdentifier: string }
  | { ok: true; id: string; qrCodeIdentifier: string; usingDemoData: false }
  | { ok: false; error: string };

type CreateZoneResult =
  | { ok: true; id: string; name: string; usingDemoData: false }
  | { ok: false; error: string };

type BulkCreateTablesResult =
  | { ok: true; createdCount: number; skippedCount: number; usingDemoData: false }
  | { ok: false; error: string };

type BulkDeleteTablesResult =
  | { ok: true; deletedCount: number; skippedCount: number; matchedCount: number; usingDemoData: false }
  | { ok: false; error: string };

type DeleteZoneResult =
  | { ok: true; id: string; name: string; affectedTableCount: number; usingDemoData: false }
  | { ok: false; error: string };

type BulkDeleteZonesResult =
  | { ok: true; deletedCount: number; skippedCount: number; affectedTableCount: number; usingDemoData: false }
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

type TableStatusUpdateResult =
  | { ok: true; status: TableStatus }
  | { ok: false; error: string };

type QueryDeps = {
  getDefaultBusinessScope: () => Promise<Scope>;
  getOrderPaymentSummaryMap: (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
    orderIds: string[],
    scopeOverride?: Scope,
  ) => Promise<Map<string, { net: number; count: number }>>;
  withQueryTimeout: <T>(promise: PromiseLike<T>, ms?: number) => Promise<T>;
  demoOrders: Order[];
  demoTables: DiningTable[];
};

function createQrIdentifier(tableNumber: number) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `table-${tableNumber}-${suffix}`;
}

function isDuplicateTableNumberError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("tables_business_table_number_unique") ||
    normalized.includes("uniq_tables_business_branch_zone_table_number") ||
    normalized.includes("uniq_tables_business_branch_nozone_table_number") ||
    normalized.includes("duplicate key value")
  );
}

function toMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function resolveEffectiveOrderStatus(status: OrderStatus, remainingBalance: number) {
  if (status === "cancelled" || status === "refunded") {
    return status;
  }
  return remainingBalance <= 0.009 ? ("paid" as OrderStatus) : status;
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

async function resolveTableZoneId(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  scope: Scope,
  branchId: string | null,
  zoneId: string | null | undefined,
) {
  if (!zoneId) {
    return { ok: true as const, zoneId: null as string | null };
  }

  let query = supabase
    .from("table_zones")
    .select("id, business_id, branch_id")
    .eq("id", zoneId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return { ok: false as const, error: "Secilen bolge bulunamadi veya erisim disinda." };
  }

  return { ok: true as const, zoneId: data.id as string };
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
  const cacheKey = `latest-orders-by-table:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}:${sortedTableIds.join(",")}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
        .from("orders")
        .select("id, check_number, table_id, total_price, final_price, status, created_at")
        .in("table_id", sortedTableIds)
        .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
        .order("created_at", { ascending: false });
      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }
      if (scope.branchId) {
        query = query.eq("branch_id", scope.branchId);
      }

      const result = await query;
      const rows = (result.data ?? []) as Array<{ id: string; check_number?: string | null; table_id: string; total_price: number; final_price: number | null; status: OrderStatus; created_at: string }>;
      const latestRows = new Map<string, { id: string; check_number?: string | null; table_id: string; total_price: number; final_price: number | null; status: OrderStatus; created_at: string }>();
      for (const row of rows) {
        if (!latestRows.has(row.table_id)) {
          latestRows.set(row.table_id, row);
        }
      }

      const orderIds = [...latestRows.values()].map((row) => row.id);
      const paymentSummary = await deps.getOrderPaymentSummaryMap(innerSupabase, orderIds, scope);
      const normalizedRows = [...latestRows.values()].map((row) => {
        const finalPrice = toMoney(Number(row.final_price ?? row.total_price));
        const amountPaid = toMoney(paymentSummary.get(row.id)?.net ?? 0);
        const remainingBalance = toMoney(Math.max(0, finalPrice - amountPaid));
        return {
          id: row.id,
          check_number: row.check_number ?? null,
          table_id: row.table_id,
          total_price: Number(row.total_price),
          final_price: finalPrice,
          amount_paid: amountPaid,
          remaining_balance: remainingBalance,
          payment_count: paymentSummary.get(row.id)?.count ?? 0,
          status: resolveEffectiveOrderStatus(row.status, remainingBalance),
          created_at: row.created_at,
        };
      });

      return {
        data: normalizedRows,
        error: result.error as { message: string } | null,
      };
    },
    [cacheKey],
    { revalidate: 5, tags: ["orders-summary", "table-map"] },
  );

  const cached = await reader();
  const data = cached?.data ?? null;
  const error = cached?.error ?? null;
  if (error) {
    return { ordersByTableId: new Map<string, Order>(), usingDemoData: false };
  }

  const ordersByTableId = new Map<string, Order>();
  for (const row of (data ?? []) as Array<{ id: string; check_number?: string | null; table_id: string; total_price: number; final_price: number; amount_paid: number; remaining_balance: number; payment_count: number; status: OrderStatus; created_at: string }>) {
    ordersByTableId.set(row.table_id, {
      id: row.id,
      check_number: row.check_number ?? null,
      table_id: row.table_id,
      items: [],
      total_price: Number(row.total_price),
      final_price: Number(row.final_price),
      amount_paid: Number(row.amount_paid),
      remaining_balance: Number(row.remaining_balance),
      payment_count: Number(row.payment_count),
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

  const scope = await deps.getDefaultBusinessScope();
  const cacheKey = `order-history:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}:${tableId}:${limit}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
        .from("orders")
        .select("id, check_number, table_id, total_price, final_price, status, created_at")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }
      if (scope.branchId) {
        query = query.eq("branch_id", scope.branchId);
      }

      const result = await query;
      const rows = (result.data ?? []) as Array<{
        id: string;
        check_number?: string | null;
        table_id: string;
        total_price: number;
        final_price?: number;
        status: OrderStatus;
        created_at: string;
      }>;
      const orderIds = rows.map((row) => row.id);
      const paymentSummary = await deps.getOrderPaymentSummaryMap(innerSupabase, orderIds, scope);
      const normalizedRows = rows.map((row) => {
        const finalPrice = toMoney(Number(row.final_price ?? row.total_price));
        const amountPaid = toMoney(paymentSummary.get(row.id)?.net ?? 0);
        const remainingBalance = toMoney(Math.max(0, finalPrice - amountPaid));
        return {
          id: row.id,
          check_number: row.check_number ?? null,
          table_id: row.table_id,
          total_price: Number(row.total_price),
          final_price: finalPrice,
          amount_paid: amountPaid,
          remaining_balance: remainingBalance,
          payment_count: paymentSummary.get(row.id)?.count ?? 0,
          status: resolveEffectiveOrderStatus(row.status, remainingBalance),
          created_at: row.created_at,
        };
      });

      return {
        data: normalizedRows,
        error: result.error as { message: string } | null,
      };
    },
    [cacheKey],
    { revalidate: 5, tags: ["orders-summary", "table-map"] },
  );

  const cached = await reader();
  const data = cached?.data ?? null;
  const error = cached?.error ?? null;
  if (error) {
    return { orders: [] as Order[], usingDemoData: false };
  }

  return {
    orders: ((data ?? []) as Array<{
      id: string;
      check_number?: string | null;
      table_id: string;
      total_price: number;
      final_price: number;
      amount_paid: number;
      remaining_balance: number;
      payment_count: number;
      status: OrderStatus;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      check_number: row.check_number ?? null,
      table_id: row.table_id,
      items: [],
      total_price: Number(row.total_price),
      final_price: Number(row.final_price),
      amount_paid: Number(row.amount_paid),
      remaining_balance: Number(row.remaining_balance),
      payment_count: Number(row.payment_count),
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

      const buildQuery = (includeZone: boolean) => {
        let query = readerSupabase
          .from("tables")
          .select(includeZone ? "id, business_id, branch_id, zone_id, table_number, name, status, qr_code_identifier" : "id, business_id, branch_id, table_number, name, status, qr_code_identifier")
          .order("table_number", { ascending: true });
        if (!scope.useLegacySchema && scope.businessId) {
          query = query.eq("business_id", scope.businessId);
        }
        if (scope.branchId) {
          query = query.eq("branch_id", scope.branchId);
        }
        return query;
      };

      try {
        let result = (await deps.withQueryTimeout(buildQuery(true))) as { data: unknown[] | null; error: { message: string } | null };
        if (result.error?.message?.toLowerCase().includes("zone_id")) {
          result = (await deps.withQueryTimeout(buildQuery(false))) as { data: unknown[] | null; error: { message: string } | null };
        }
        return { data: result.data as unknown[] | null, error: result.error as { message: string } | null };
      } catch {
        return { data: null, error: { message: "Query timeout" } };
      }
    },
    [cacheKey],
    { revalidate: 5, tags: ["table-map"] },
  );

  const cached = await reader();
  if (!cached || cached.error) {
    return { tables: [] as DiningTable[], usingDemoData: false };
  }

  return { tables: (cached.data ?? []) as DiningTable[], usingDemoData: false };
}

export async function getTableZonesImpl(deps: QueryDeps) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const zones = [
      {
        id: "demo-zone-main",
        business_id: null,
        branch_id: null,
        name: "Ana Salon",
        sort_order: 0,
        created_at: now,
        updated_at: now,
      },
    ] as TableZone[];
    return { zones, usingDemoData: true };
  }

  const scope = await deps.getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { zones: [] as TableZone[], usingDemoData: false };
  }

  const cacheKey = `table-zones:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const readerSupabase = getSupabaseServerClient();
      if (!readerSupabase) {
        return null;
      }

      let query = readerSupabase
        .from("table_zones")
        .select("id, business_id, branch_id, name, sort_order, created_at, updated_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
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
    { revalidate: 10, tags: ["table-zones", "table-map"] },
  );

  const cached = await reader();
  if (!cached || cached.error) {
    return { zones: [] as TableZone[], usingDemoData: false };
  }

  return { zones: (cached.data ?? []) as TableZone[], usingDemoData: false };
}

export async function createTableImpl(
  tableNumber: number,
  name: string | undefined,
  zoneId: string | null | undefined,
  deps: MutationDeps,
): Promise<CreateTableResult> {
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
  const resolvedZone = await resolveTableZoneId(supabase, scope, targetBranchId, zoneId);
  if (!resolvedZone.ok) {
    return { ok: false, error: resolvedZone.error };
  }

  const withBusinessPayload = {
    business_id: scope.businessId,
    branch_id: targetBranchId,
    zone_id: resolvedZone.zoneId,
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };
  const withBusinessPayloadWithoutZone = {
    business_id: scope.businessId,
    branch_id: targetBranchId,
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };
  const fallbackPayload = {
    zone_id: resolvedZone.zoneId,
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };
  const fallbackPayloadWithoutZone = {
    table_number: tableNumber,
    name: name?.trim() || `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: qrCodeIdentifier,
  };

  let data: { id: string; qr_code_identifier: string } | null = null;
  let error: { message: string } | null = null;
  let firstInsert = await supabase.from("tables").insert(withBusinessPayload).select("id, qr_code_identifier").single();
  if (firstInsert.error?.message?.toLowerCase().includes("zone_id")) {
    if (resolvedZone.zoneId) {
      return { ok: false, error: "Bolge ozelligi icin veritabani migrasyonunu calistirin." };
    }
    firstInsert = await supabase.from("tables").insert(withBusinessPayloadWithoutZone).select("id, qr_code_identifier").single();
  }
  data = firstInsert.data as { id: string; qr_code_identifier: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (error?.message?.toLowerCase().includes("business_id") || error?.message?.toLowerCase().includes("branch_id")) {
    let secondInsert = await supabase.from("tables").insert(fallbackPayload).select("id, qr_code_identifier").single();
    if (secondInsert.error?.message?.toLowerCase().includes("zone_id")) {
      if (resolvedZone.zoneId) {
        return { ok: false, error: "Bolge ozelligi icin veritabani migrasyonunu calistirin." };
      }
      secondInsert = await supabase.from("tables").insert(fallbackPayloadWithoutZone).select("id, qr_code_identifier").single();
    }
    data = secondInsert.data as { id: string; qr_code_identifier: string } | null;
    error = secondInsert.error as { message: string } | null;
  }

  if (error) {
    if (isDuplicateTableNumberError(error.message)) {
      return { ok: false, error: "Secilen bolgede bu masa numarasi zaten kullaniliyor." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Masa olusturulamadi." };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: data.id,
    action: "create",
    details: {
      tableNumber,
      tableName: name?.trim() || `Masa ${tableNumber}`,
      qrCodeIdentifier: data.qr_code_identifier,
      zoneId: resolvedZone.zoneId,
    },
  });

  deps.revalidateOperationsCaches();
  return { ok: true, id: data.id, qrCodeIdentifier: data.qr_code_identifier, usingDemoData: false };
}

export async function createTableZoneImpl(name: string, deps: MutationDeps): Promise<CreateZoneResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda bolge olusturma pasif." };
  }

  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 2) {
    return { ok: false, error: "Bolge adi en az 2 karakter olmali." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.businessId || !targetBranchId) {
    return { ok: false, error: "Bolge olusturmak icin once aktif isletme ve sube secilmeli." };
  }

  const sortQuery = supabase
    .from("table_zones")
    .select("sort_order")
    .eq("business_id", scope.businessId)
    .eq("branch_id", targetBranchId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const { data: lastSortRow } = await sortQuery.maybeSingle();
  const nextSortOrder = Number((lastSortRow as { sort_order?: number } | null)?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("table_zones")
    .insert({
      business_id: scope.businessId,
      branch_id: targetBranchId,
      name: normalizedName,
      sort_order: nextSortOrder,
    })
    .select("id, name")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("table_zones_business_branch_name_unique")) {
      return { ok: false, error: "Bu isimde bir bolge zaten var." };
    }
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({
    entityType: "table_zone",
    entityId: String(data.id),
    action: "create",
    details: { name: normalizedName, branchId: targetBranchId },
  });

  deps.revalidateOperationsCaches();
  return { ok: true, id: String(data.id), name: String(data.name), usingDemoData: false };
}

export async function assignTableZoneImpl(
  input: { tableId: string; zoneId: string | null },
  deps: MutationDeps,
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda bolge atama pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);

  let tableQuery = supabase
    .from("tables")
    .select("id, zone_id")
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    tableQuery = tableQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    tableQuery = tableQuery.eq("branch_id", targetBranchId);
  }

  const { data: tableRow, error: tableError } = await tableQuery.maybeSingle();
  if (tableError || !tableRow) {
    return { ok: false, error: tableError?.message ?? "Masa bulunamadi." };
  }

  const resolvedZone = await resolveTableZoneId(supabase, scope, targetBranchId, input.zoneId);
  if (!resolvedZone.ok) {
    return { ok: false, error: resolvedZone.error };
  }

  let updateQuery = supabase
    .from("tables")
    .update({ zone_id: resolvedZone.zoneId })
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    updateQuery = updateQuery.eq("branch_id", targetBranchId);
  }

  const { error } = await updateQuery;
  if (error) {
    if (isDuplicateTableNumberError(error.message)) {
      return { ok: false, error: "Hedef bolgede ayni masa numarasi oldugu icin atama yapilamadi." };
    }
    return { ok: false, error: error.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: input.tableId,
    action: "assign_zone",
    details: { previousZoneId: (tableRow as { zone_id?: string | null }).zone_id ?? null, nextZoneId: resolvedZone.zoneId },
  });

  deps.revalidateOperationsCaches();
  return { ok: true };
}

export async function bulkCreateTablesImpl(
  input: { startNumber: number; count: number; namePrefix?: string; zoneId?: string | null },
  deps: MutationDeps,
): Promise<BulkCreateTablesResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda toplu masa acma pasif." };
  }

  if (!Number.isInteger(input.startNumber) || input.startNumber <= 0) {
    return { ok: false, error: "Baslangic masa no pozitif bir tam sayi olmali." };
  }
  if (!Number.isInteger(input.count) || input.count <= 0 || input.count > 200) {
    return { ok: false, error: "Toplu acilis adedi 1 ile 200 arasinda olmali." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.useLegacySchema && scope.businessId && !targetBranchId) {
    return { ok: false, error: "Toplu masa acmak icin once aktif bir sube secilmeli veya olusturulmali." };
  }

  const resolvedZone = await resolveTableZoneId(supabase, scope, targetBranchId, input.zoneId ?? null);
  if (!resolvedZone.ok) {
    return { ok: false, error: resolvedZone.error };
  }

  const numbers = Array.from({ length: input.count }, (_, index) => input.startNumber + index);

  let existingQuery = supabase
    .from("tables")
    .select("table_number")
    .in("table_number", numbers);
  if (!scope.useLegacySchema && scope.businessId) {
    existingQuery = existingQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    existingQuery = existingQuery.eq("branch_id", targetBranchId);
  }
  if (resolvedZone.zoneId) {
    existingQuery = existingQuery.eq("zone_id", resolvedZone.zoneId);
  } else {
    existingQuery = existingQuery.is("zone_id", null);
  }
  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  const existingNumbers = new Set(((existingRows ?? []) as Array<{ table_number: number }>).map((row) => Number(row.table_number)));
  const tableNumbersToCreate = numbers.filter((tableNumber) => !existingNumbers.has(tableNumber));

  if (tableNumbersToCreate.length === 0) {
    return { ok: false, error: "Bu aralikta olusturulacak yeni masa bulunamadi. Numara araligini degistirin." };
  }

  const normalizedPrefix = (input.namePrefix ?? "").trim();
  const rowsToInsert = tableNumbersToCreate.map((tableNumber) => ({
    business_id: scope.businessId,
    branch_id: targetBranchId,
    zone_id: resolvedZone.zoneId,
    table_number: tableNumber,
    name: normalizedPrefix ? `${normalizedPrefix} ${tableNumber}` : `Masa ${tableNumber}`,
    status: "empty" as TableStatus,
    qr_code_identifier: createQrIdentifier(tableNumber),
  }));

  const { error: insertError } = await supabase.from("tables").insert(rowsToInsert);
  if (insertError) {
    if (insertError.message.toLowerCase().includes("zone_id")) {
      return { ok: false, error: "Bolge ozelligi icin veritabani migrasyonunu calistirin." };
    }
    return { ok: false, error: insertError.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: String(targetBranchId ?? scope.businessId ?? "bulk"),
    action: "bulk_create",
    details: {
      startNumber: input.startNumber,
      count: input.count,
      createdCount: tableNumbersToCreate.length,
      skippedCount: numbers.length - tableNumbersToCreate.length,
      zoneId: resolvedZone.zoneId,
      namePrefix: normalizedPrefix || null,
    },
  });

  deps.revalidateOperationsCaches();
  return {
    ok: true,
    createdCount: tableNumbersToCreate.length,
    skippedCount: numbers.length - tableNumbersToCreate.length,
    usingDemoData: false,
  };
}

export async function bulkDeleteTablesImpl(
  input: { startNumber: number; endNumber: number; zoneId?: string | null; includeNonEmpty?: boolean },
  deps: MutationDeps,
): Promise<BulkDeleteTablesResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda toplu masa silme pasif." };
  }

  if (!Number.isInteger(input.startNumber) || input.startNumber <= 0) {
    return { ok: false, error: "Baslangic masa no pozitif bir tam sayi olmali." };
  }
  if (!Number.isInteger(input.endNumber) || input.endNumber <= 0) {
    return { ok: false, error: "Bitis masa no pozitif bir tam sayi olmali." };
  }
  if (input.endNumber < input.startNumber) {
    return { ok: false, error: "Bitis masa no, baslangic no'dan kucuk olamaz." };
  }
  if (input.endNumber - input.startNumber > 1000) {
    return { ok: false, error: "Tek seferde en fazla 1001 masa araligi silinebilir." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.useLegacySchema && scope.businessId && !targetBranchId) {
    return { ok: false, error: "Toplu masa silmek icin once aktif bir sube secilmeli veya olusturulmali." };
  }

  let resolvedZoneId: string | null | undefined = input.zoneId;
  if (typeof input.zoneId === "string" && input.zoneId.trim()) {
    const resolvedZone = await resolveTableZoneId(supabase, scope, targetBranchId, input.zoneId);
    if (!resolvedZone.ok) {
      return { ok: false, error: resolvedZone.error };
    }
    resolvedZoneId = resolvedZone.zoneId;
  }

  let query = supabase
    .from("tables")
    .select("id, status, table_number")
    .gte("table_number", input.startNumber)
    .lte("table_number", input.endNumber);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    query = query.eq("branch_id", targetBranchId);
  }
  if (resolvedZoneId === null) {
    query = query.is("zone_id", null);
  } else if (typeof resolvedZoneId === "string") {
    query = query.eq("zone_id", resolvedZoneId);
  }

  const { data: rows, error: rowsError } = await query;
  if (rowsError) {
    return { ok: false, error: rowsError.message };
  }

  const matchedRows = (rows ?? []) as Array<{ id: string; status: TableStatus; table_number: number }>;
  if (matchedRows.length === 0) {
    return { ok: false, error: "Bu filtrede masa bulunamadi." };
  }

  const includeNonEmpty = input.includeNonEmpty === true;
  const idsToDelete = includeNonEmpty
    ? matchedRows.map((row) => row.id)
    : matchedRows.filter((row) => row.status === "empty").map((row) => row.id);
  const skippedCount = includeNonEmpty ? 0 : matchedRows.length - idsToDelete.length;

  if (idsToDelete.length === 0) {
    return { ok: false, error: includeNonEmpty ? "Secili aralikta silinebilecek masa yok." : "Secili aralikta silinebilecek bos masa yok." };
  }

  let deleteQuery = supabase.from("tables").delete().in("id", idsToDelete);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: String(targetBranchId ?? scope.businessId ?? "bulk"),
    action: "bulk_delete",
    details: {
      startNumber: input.startNumber,
      endNumber: input.endNumber,
      matchedCount: matchedRows.length,
      deletedCount: idsToDelete.length,
      skippedCount,
      zoneId: resolvedZoneId,
      includeNonEmpty,
    },
  });

  deps.revalidateOperationsCaches();
  return {
    ok: true,
    deletedCount: idsToDelete.length,
    skippedCount,
    matchedCount: matchedRows.length,
    usingDemoData: false,
  };
}

export async function bulkDeleteTablesByIdsImpl(
  input: { tableIds: string[]; includeNonEmpty?: boolean },
  deps: MutationDeps,
): Promise<BulkDeleteTablesResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda toplu masa silme pasif." };
  }

  const normalizedIds = [...new Set(input.tableIds.map((value) => value.trim()).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { ok: false, error: "Silinecek masalar secilmedi." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.useLegacySchema && scope.businessId && !targetBranchId) {
    return { ok: false, error: "Toplu masa silmek icin once aktif bir sube secilmeli veya olusturulmali." };
  }

  let query = supabase
    .from("tables")
    .select("id, status")
    .in("id", normalizedIds);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    query = query.eq("branch_id", targetBranchId);
  }

  const { data: rows, error: rowsError } = await query;
  if (rowsError) {
    return { ok: false, error: rowsError.message };
  }

  const matchedRows = (rows ?? []) as Array<{ id: string; status: TableStatus }>;
  if (matchedRows.length === 0) {
    return { ok: false, error: "Secilen masalar bulunamadi veya erisim disinda." };
  }

  const includeNonEmpty = input.includeNonEmpty === true;
  const idsToDelete = includeNonEmpty
    ? matchedRows.map((row) => row.id)
    : matchedRows.filter((row) => row.status === "empty").map((row) => row.id);
  const skippedCount = includeNonEmpty ? 0 : matchedRows.length - idsToDelete.length;

  if (idsToDelete.length === 0) {
    return { ok: false, error: includeNonEmpty ? "Secilen masalar silinemedi." : "Secilen masalarin hicbiri bos degil." };
  }

  let deleteQuery = supabase.from("tables").delete().in("id", idsToDelete);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: String(targetBranchId ?? scope.businessId ?? "bulk"),
    action: "bulk_delete_selected",
    details: {
      selectedCount: normalizedIds.length,
      matchedCount: matchedRows.length,
      deletedCount: idsToDelete.length,
      skippedCount,
      selectedIds: normalizedIds,
      includeNonEmpty,
    },
  });

  deps.revalidateOperationsCaches();
  return {
    ok: true,
    deletedCount: idsToDelete.length,
    skippedCount,
    matchedCount: matchedRows.length,
    usingDemoData: false,
  };
}

export async function deleteTableZoneImpl(zoneId: string, deps: MutationDeps): Promise<DeleteZoneResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda bolge silme pasif." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.businessId || !targetBranchId) {
    return { ok: false, error: "Bolge silmek icin once aktif isletme ve sube secilmeli." };
  }

  let zoneQuery = supabase
    .from("table_zones")
    .select("id, name")
    .eq("id", zoneId);
  if (!scope.useLegacySchema && scope.businessId) {
    zoneQuery = zoneQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    zoneQuery = zoneQuery.eq("branch_id", targetBranchId);
  }

  const { data: zoneRow, error: zoneError } = await zoneQuery.maybeSingle();
  if (zoneError || !zoneRow) {
    return { ok: false, error: zoneError?.message ?? "Silinecek bolge bulunamadi." };
  }

  let countQuery = supabase
    .from("tables")
    .select("id")
    .eq("zone_id", zoneId);
  if (!scope.useLegacySchema && scope.businessId) {
    countQuery = countQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    countQuery = countQuery.eq("branch_id", targetBranchId);
  }

  const { data: affectedRows } = await countQuery;
  const affectedTableCount = (affectedRows ?? []).length;

  let deleteQuery = supabase
    .from("table_zones")
    .delete()
    .eq("id", zoneId);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  await deps.logAuditEvent({
    entityType: "table_zone",
    entityId: zoneId,
    action: "delete",
    details: {
      name: String((zoneRow as { name?: string }).name ?? ""),
      affectedTableCount,
    },
  });

  deps.revalidateOperationsCaches();
  return {
    ok: true,
    id: zoneId,
    name: String((zoneRow as { name?: string }).name ?? ""),
    affectedTableCount,
    usingDemoData: false,
  };
}

export async function bulkDeleteTableZonesImpl(
  input: { zoneIds: string[] },
  deps: MutationDeps,
): Promise<BulkDeleteZonesResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda toplu bolge silme pasif." };
  }

  const normalizedZoneIds = [...new Set(input.zoneIds.map((value) => value.trim()).filter(Boolean))];
  if (normalizedZoneIds.length === 0) {
    return { ok: false, error: "Silinecek bolgeler secilmedi." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);
  if (!scope.businessId || !targetBranchId) {
    return { ok: false, error: "Bolge silmek icin once aktif isletme ve sube secilmeli." };
  }

  let zoneQuery = supabase
    .from("table_zones")
    .select("id")
    .in("id", normalizedZoneIds);
  if (!scope.useLegacySchema && scope.businessId) {
    zoneQuery = zoneQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    zoneQuery = zoneQuery.eq("branch_id", targetBranchId);
  }

  const { data: zoneRows, error: zoneError } = await zoneQuery;
  if (zoneError) {
    return { ok: false, error: zoneError.message };
  }

  const scopedZoneIds = ((zoneRows ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (scopedZoneIds.length === 0) {
    return { ok: false, error: "Secilen bolgeler bulunamadi veya erisim disinda." };
  }
  const skippedCount = normalizedZoneIds.length - scopedZoneIds.length;

  let tableCountQuery = supabase
    .from("tables")
    .select("id")
    .in("zone_id", scopedZoneIds);
  if (!scope.useLegacySchema && scope.businessId) {
    tableCountQuery = tableCountQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    tableCountQuery = tableCountQuery.eq("branch_id", targetBranchId);
  }

  const { data: affectedRows } = await tableCountQuery;
  const affectedTableCount = (affectedRows ?? []).length;

  let deleteQuery = supabase
    .from("table_zones")
    .delete()
    .in("id", scopedZoneIds);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  await deps.logAuditEvent({
    entityType: "table_zone",
    entityId: String(targetBranchId ?? scope.businessId ?? "bulk"),
    action: "bulk_delete",
    details: {
      deletedCount: scopedZoneIds.length,
      skippedCount,
      affectedTableCount,
      zoneIds: scopedZoneIds,
    },
  });

  deps.revalidateOperationsCaches();
  return {
    ok: true,
    deletedCount: scopedZoneIds.length,
    skippedCount,
    affectedTableCount,
    usingDemoData: false,
  };
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
    if (isDuplicateTableNumberError(error.message)) {
      return { ok: false, error: "Bu bolgede ayni masa numarasi oldugu icin guncellenemedi." };
    }
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

export async function updateTableStatusImpl(
  input: { tableId: string; status: TableStatus },
  deps: MutationDeps,
): Promise<TableStatusUpdateResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda masa durumu guncelleme pasif." };
  }

  if (input.status !== "empty" && input.status !== "reserved") {
    return { ok: false, error: "Masa durumu sadece Bos veya Rezerve olarak ayarlanabilir." };
  }

  const scope = await deps.getDefaultBusinessScope();
  const targetBranchId = await resolveMutationBranchId(supabase, scope);

  let tableQuery = supabase
    .from("tables")
    .select("id, status")
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    tableQuery = tableQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    tableQuery = tableQuery.eq("branch_id", targetBranchId);
  }

  const { data: tableRow, error: tableError } = await tableQuery.maybeSingle();
  if (tableError || !tableRow) {
    return { ok: false, error: tableError?.message ?? "Masa bulunamadi." };
  }

  const previousStatus = tableRow.status as TableStatus;
  if (previousStatus === input.status) {
    return { ok: true, status: input.status };
  }

  if (input.status === "reserved") {
    let activeOrderQuery = supabase
      .from("orders")
      .select("id")
      .eq("table_id", input.tableId)
      .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!scope.useLegacySchema && scope.businessId) {
      activeOrderQuery = activeOrderQuery.eq("business_id", scope.businessId);
    }
    if (targetBranchId) {
      activeOrderQuery = activeOrderQuery.eq("branch_id", targetBranchId);
    }

    const { data: activeOrder } = await activeOrderQuery.maybeSingle();
    if (activeOrder) {
      return { ok: false, error: "Aktif adisyonu olan masa rezerveye alinamaz." };
    }
  }

  let updateQuery = supabase
    .from("tables")
    .update({ status: input.status })
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    updateQuery = updateQuery.eq("branch_id", targetBranchId);
  }

  const { error: updateError } = await updateQuery;
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await deps.logAuditEvent({
    entityType: "table",
    entityId: input.tableId,
    action: "update_status",
    details: {
      previousStatus,
      nextStatus: input.status,
    },
  });

  deps.revalidateOperationsCaches();
  return { ok: true, status: input.status };
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
    .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
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

  let claimTargetQuery = supabase
    .from("tables")
    .update({ status: "occupied" as TableStatus })
    .eq("id", input.targetTableId)
    .eq("status", "empty")
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    claimTargetQuery = claimTargetQuery.eq("business_id", scope.businessId);
  }
  if (targetBranchId) {
    claimTargetQuery = claimTargetQuery.eq("branch_id", targetBranchId);
  }
  const { data: claimedTargetRows, error: claimTargetError } = await claimTargetQuery;
  if (claimTargetError) {
    return { ok: false, error: claimTargetError.message };
  }
  if (!claimedTargetRows || claimedTargetRows.length === 0) {
    return { ok: false, error: "Hedef masa az once baska bir islem tarafindan dolduruldu." };
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
    await supabase
      .from("tables")
      .update({ status: "empty" as TableStatus })
      .eq("id", input.targetTableId);
    return { ok: false, error: updateOrderError.message };
  }

  await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", input.sourceTableId);

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
