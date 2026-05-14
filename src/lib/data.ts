import * as AppContextCore from "@/lib/server/app-context/core";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import {
  assignTableZoneImpl,
  bulkCreateTablesImpl,
  bulkDeleteTablesByIdsImpl,
  bulkDeleteTablesImpl,
  bulkDeleteTableZonesImpl,
  createTableImpl,
  createTableZoneImpl,
  deleteTableImpl,
  deleteTableZoneImpl,
  getOrderHistoryByTableIdImpl,
  getTableMapImpl,
  getTableZonesImpl,
  listLatestOrdersByTableIdsImpl,
  moveTableOrderImpl,
  updateTableStatusImpl,
  updateTableDetailsImpl,
} from "@/lib/server/tables-data";
import {
  createCategoryImpl,
  createProductImpl,
  deleteCategoryImpl,
  deleteProductImpl,
  getProductManagementDataImpl,
  updateCategoryPrepStationImpl,
  updateProductImpl,
} from "@/lib/server/products-data";
import { ALL_BRANCHES_VALUE, DEFAULT_BUSINESS_SLUG, normalizeBusinessSlug } from "@/lib/business";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { demoStaffAccounts } from "@/lib/demo";
import {
  getBusinessScopeContext as getDefaultBusinessScope,
  getRequestAppContext,
} from "@/lib/server/app-context";
import { getDirectPlatformOwnerEmails } from "@/lib/platform-owner";
import {
  defaultApplicationSettings,
  defaultGeneralSettings,
  defaultSeoSettings,
  defaultSmtpSettings,
  normalizeApplicationSettings,
  normalizeGeneralSettings,
  normalizeSeoSettings,
  normalizeSmtpSettings,
  type ApplicationSettings,
  type GeneralSettings,
  type SeoSettings,
  type SmtpSettings,
} from "@/lib/app-settings";
import { defaultDemoPageContent, normalizeDemoPageContent, type DemoPageContent } from "@/lib/demo";
import { defaultLandingContent, emptyLandingContent, normalizeLandingContent, type LandingContent } from "@/lib/site-content";
import { type FeatureKey } from "@/lib/features";
import type {
  AlertDispatch,
  AppRole,
  AuditLog,
  BlogPost,
  BlogPostStatus,
  Business,
  BusinessType,
  Branch,
  BranchProfile,
  CashRegisterSession,
  Category,
  Courier,
  DiningTable,
  Ingredient,
  MediaAsset,
  Order,
  OrderChannel,
  OrderItem,
  OrderStationStatus,
  OrderStatus,
  PlatformAccessUser,
  PlatformPermission,
  PlatformRole,
  PaymentMethod,
  OrderPaymentSummaryAggregate,
  OpsSnapshotAggregate,
  PrepStation,
  Product,
  ProductDepartment,
  ProductModifierGroup,
  ProductModifierOption,
  ProductProfileScope,
  ProductKind,
  ProductUnit,
  ProductIngredient,
  SalesLead,
  SalesLeadNote,
  SalesLeadStatus,
  BusinessPlan,
  SiteContent,
  StockMovement,
  SupportAccessUser,
  SupportAuditLogEntry,
  SupportHealthSummary,
  SupportIncident,
  SupportIncidentUpdate,
  SupportIncidentSeverity,
  SupportIncidentStatus,
  SupportKnowledgeArticle,
  SupportOnboardingSummary,
  SupportPlanRequest,
  SupportPlanRequestStatus,
  SupportRole,
  SupportBillingStatus,
  SupportFeatureFlagOverride,
  SupportRiskLevel,
  SupportTenantSummary,
  SupportTenantProfile,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketType,
  SupportTeamMemberSummary,
  StudioAccessUser,
  StudioRole,
  StaffAccessScope,
  TableRequest,
  TableRequestType,
  TableStatus,
  TenantModel,
  TenantLifecycleStage,
  FulfillmentStatus,
  OrderItemModifierSelection,
} from "@/lib/types";

type AuthServerClient = NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>;
type ServiceServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
type TenantSupabaseClient = AuthServerClient | ServiceServerClient;

function getPrivilegedEmails(envValue?: string | null) {
  return new Set([
    ...getDirectPlatformOwnerEmails(),
    ...((envValue ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)),
  ]);
}

const platformRolePermissions: Record<PlatformRole, PlatformPermission[]> = {
  platform_owner: [
    "platform.access.manage",
    "platform.audit.read",
    "support.read",
    "support.write",
    "support.assign",
    "support.billing",
    "support.access.manage",
    "studio.read",
    "studio.write",
    "studio.publish",
  ],
  platform_admin: [
    "platform.access.manage",
    "platform.audit.read",
    "support.read",
    "support.write",
    "support.assign",
    "support.billing",
    "support.access.manage",
    "studio.read",
    "studio.write",
    "studio.publish",
  ],
  support_manager: [
    "platform.audit.read",
    "support.read",
    "support.write",
    "support.assign",
    "support.billing",
    "support.access.manage",
  ],
  support_agent: ["platform.audit.read", "support.read", "support.write", "support.assign"],
  billing_manager: ["platform.audit.read", "support.read", "support.billing"],
  content_manager: ["studio.read", "studio.write", "studio.publish"],
  content_editor: ["studio.read", "studio.write"],
  observer: ["support.read", "studio.read"],
};

function normalizePlatformPermissions(role: PlatformRole, permissions?: string[] | null) {
  return Array.from(new Set([...(platformRolePermissions[role] ?? []), ...((permissions ?? []) as PlatformPermission[])])) as PlatformPermission[];
}

export function hasPlatformPermission(
  access: { role: PlatformRole | null; permissions?: PlatformPermission[] | null } | null | undefined,
  permission: PlatformPermission,
) {
  if (!access?.role) {
    return false;
  }

  const permissions = normalizePlatformPermissions(access.role, access.permissions ?? []);
  return permissions.includes(permission);
}

function getSupportTicketSlaHours(priority: SupportTicketPriority) {
  switch (priority) {
    case "urgent":
      return 2;
    case "high":
      return 8;
    case "normal":
      return 24;
    case "low":
    default:
      return 48;
  }
}

function enrichTicketSla<T extends SupportTicket>(ticket: T): T {
  const dueAt = new Date(new Date(ticket.created_at).getTime() + getSupportTicketSlaHours(ticket.priority) * 60 * 60 * 1000);
  const now = Date.now();
  const remainingMs = dueAt.getTime() - now;
  const sla_status =
    remainingMs <= 0 ? "breached" : remainingMs <= 4 * 60 * 60 * 1000 ? "due_soon" : "on_track";

  return {
    ...ticket,
    sla_due_at: dueAt.toISOString(),
    sla_status,
  };
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function withQueryTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout")), ms);
    }),
  ]);
}

function isRetryableMutationError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("timeout") ||
    normalized.includes("deadlock") ||
    normalized.includes("connection") ||
    normalized.includes("network") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("too many requests")
  );
}

async function retryMutation<T>(
  operation: () => Promise<{ data?: T | null; error?: { message: string } | null }>,
  maxAttempts = 3,
) {
  let attempt = 0;
  let lastResult: { data?: T | null; error?: { message: string } | null } | null = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    const result = await operation();
    lastResult = result;
    if (!result.error || !isRetryableMutationError(result.error.message)) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
  }
  return lastResult ?? { error: { message: "Retry failed" } };
}

function toMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function toScaled(value: number, scale = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

const UUID_V4_LOOSE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuidForDb(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }
  return UUID_V4_LOOSE_PATTERN.test(trimmed) ? trimmed : null;
}

const PREP_STATIONS: PrepStation[] = ["kitchen", "bar", "dessert"];

function isValidOrderStationStatus(value: unknown): value is OrderStationStatus {
  return value === "pending" || value === "preparing" || value === "served";
}

function parseOrderStationStatuses(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const candidate = raw as Record<string, unknown>;
  const parsed: Partial<Record<PrepStation, OrderStationStatus>> = {};
  for (const station of PREP_STATIONS) {
    const status = candidate[station];
    if (isValidOrderStationStatus(status)) {
      parsed[station] = status;
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function normalizeStationLabel(value?: string | null) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("Ãƒâ€Ã‚Â±", "i")
    .replaceAll("ÃƒÆ’Ã‚Â¶", "o")
    .replaceAll("ÃƒÆ’Ã‚Â¼", "u")
    .replaceAll("Ãƒâ€¦Ã…Â¸", "s")
    .replaceAll("ÃƒÆ’Ã‚Â§", "c")
    .replaceAll("Ãƒâ€Ã…Â¸", "g");
}

function inferStationByCategoryName(name?: string | null): PrepStation {
  const normalized = normalizeStationLabel(name);
  if (
    normalized.includes("icecek") ||
    normalized.includes("kahve") ||
    normalized.includes("bar") ||
    normalized.includes("kokteyl")
  ) {
    return "bar";
  }
  if (normalized.includes("tatli") || normalized.includes("firin") || normalized.includes("dessert")) {
    return "dessert";
  }
  return "kitchen";
}

function inferStationByItemName(name?: string | null): PrepStation {
  const normalized = normalizeStationLabel(name);
  if (
    normalized.includes("viski") ||
    normalized.includes("whisky") ||
    normalized.includes("vodka") ||
    normalized.includes("bira") ||
    normalized.includes("sarap") ||
    normalized.includes("kokteyl") ||
    normalized.includes("tequila") ||
    normalized.includes("tekila") ||
    normalized.includes("gin") ||
    normalized.includes("raki") ||
    normalized.includes("rom")
  ) {
    return "bar";
  }
  if (
    normalized.includes("tatli") ||
    normalized.includes("sufle") ||
    normalized.includes("souffle") ||
    normalized.includes("pasta") ||
    normalized.includes("cheesecake") ||
    normalized.includes("brownie") ||
    normalized.includes("dondurma")
  ) {
    return "dessert";
  }
  return "kitchen";
}

function resolveStationForOrderItem(
  item: OrderItem,
  productCategoryMap: Map<string, string>,
  categoryMap: Map<string, { name?: string | null; prep_station?: string | null }>,
): PrepStation {
  const categoryId = productCategoryMap.get(item.product_id);
  const category = categoryId ? categoryMap.get(categoryId) : undefined;
  if (category?.prep_station === "kitchen" || category?.prep_station === "bar" || category?.prep_station === "dessert") {
    return category.prep_station;
  }
  if (category?.name) {
    return inferStationByCategoryName(category.name);
  }
  return inferStationByItemName(item.name);
}

function deriveOrderStatusFromStationStatuses(
  stationStatuses: Partial<Record<PrepStation, OrderStationStatus>>,
  fallbackStatus: OrderStatus,
) {
  const statuses = PREP_STATIONS.map((station) => stationStatuses[station]).filter(
    (status): status is OrderStationStatus => Boolean(status),
  );
  if (statuses.length === 0) {
    return fallbackStatus;
  }
  if (statuses.includes("pending")) {
    return "pending" as OrderStatus;
  }
  if (statuses.includes("preparing")) {
    return "preparing" as OrderStatus;
  }
  return "ready" as OrderStatus;
}

function isMissingStationStatusesColumnError(message?: string | null) {
  return (message ?? "").toLowerCase().includes("station_statuses");
}

function isMissingLockVersionColumnError(message?: string | null) {
  return (message ?? "").toLowerCase().includes("lock_version");
}

function isMissingRpcFunctionError(message?: string | null, rpcName?: string) {
  const normalized = (message ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }
  if (rpcName && normalized.includes(rpcName.toLowerCase()) && normalized.includes("does not exist")) {
    return true;
  }
  return normalized.includes("function") && normalized.includes("does not exist");
}

function isRecoverableCreateOrAppendOrderRpcError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }
  if (isMissingRpcFunctionError(message, "create_or_append_order")) {
    return true;
  }
  return (
    normalized.includes("column \"channel\" is of type order_channel but expression is of type text") ||
    normalized.includes("column \"fulfillment_status\" is of type fulfillment_status but expression is of type text") ||
    normalized.includes("cannot cast type text to order_channel") ||
    normalized.includes("cannot cast type text to fulfillment_status") ||
    normalized.includes("operator does not exist: order_channel = text") ||
    normalized.includes("operator does not exist: fulfillment_status = text")
  );
}

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set(["preparing", "ready", "served", "cancelled"]),
  preparing: new Set(["pending", "ready", "served", "cancelled"]),
  ready: new Set(["preparing", "served", "partially_paid", "paid", "cancelled"]),
  served: new Set(["ready", "partially_paid", "paid", "cancelled"]),
  partially_paid: new Set(["partially_paid", "paid", "partially_refunded", "refunded"]),
  paid: new Set(["partially_refunded", "refunded"]),
  partially_refunded: new Set(["partially_refunded", "refunded"]),
  cancelled: new Set([]),
  refunded: new Set([]),
};

function isAllowedOrderStatusTransition(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  if (currentStatus === nextStatus) {
    return true;
  }
  return ORDER_STATUS_TRANSITIONS[currentStatus]?.has(nextStatus) ?? false;
}

function resolveOrderSettlementStatus(
  targetAmount: number,
  netAmount: number,
  allowRefunded: boolean,
  currentStatus: OrderStatus,
  businessType?: string,
) {
  const roundedTarget = toMoney(targetAmount);
  const roundedNet = toMoney(netAmount);
  if (roundedNet >= roundedTarget) {
    if (businessType === "self_service_coffee" && (currentStatus === "pending" || currentStatus === "preparing" || currentStatus === "ready")) {
      return currentStatus;
    }
    return "paid" as OrderStatus;
  }
  if (allowRefunded && roundedNet > 0) {
    return "partially_refunded" as OrderStatus;
  }
  if (allowRefunded && roundedNet <= 0) {
    return "refunded" as OrderStatus;
  }
  if (roundedNet > 0) {
    return "partially_paid" as OrderStatus;
  }
  if (currentStatus === "pending" || currentStatus === "preparing") {
    return "ready" as OrderStatus;
  }
  if (currentStatus === "cancelled" || currentStatus === "refunded") {
    return currentStatus;
  }
  return "served" as OrderStatus;
}

function mapPaymentMutationConflictToMessage(conflictReason: string, paymentType: "sale" | "refund") {
  if (conflictReason === "ORDER_NOT_FOUND") {
    return "SipariÃ…Å¸ bulunamadi.";
  }
  if (conflictReason === "INVALID_AMOUNT") {
    return paymentType === "sale" ? "Ãƒâ€“deme tutari sifirdan buyuk olmali." : "Iade tutari sifirdan buyuk olmali.";
  }
  if (conflictReason === "ORDER_CANCELLED") {
    return paymentType === "sale"
      ? "Iptal edilmis siparise ÃƒÂ¶deme eklenemez."
      : "Iptal edilmis siparise iade eklenemez.";
  }
  if (conflictReason === "ORDER_REFUNDED" && paymentType === "sale") {
    return "Iade edilmis siparise ÃƒÂ¶deme eklenemez.";
  }
  if (conflictReason === "OVERPAYMENT") {
    return "Ãƒâ€“deme tutari kalan bakiyeden buyuk olamaz.";
  }
  if (conflictReason === "OVER_REFUND") {
    return "Iade tutari iade edilebilir bakiyeden buyuk olamaz.";
  }
  if (conflictReason === "NO_REFUNDABLE_BALANCE") {
    return "Iade edilebilir tahsilat bulunamadi.";
  }
  if (conflictReason === "STATUS_TRANSITION_BLOCKED") {
    return "SipariÃ…Å¸ durum gecisi doÃ„Å¸rulanamadÃ„Â±.";
  }
  if (conflictReason === "CONCURRENT_UPDATE") {
    return "SipariÃ…Å¸ baska bir terminalde gÃƒÂ¼ncellendi. LÃƒÂ¼tfen tekrar deneyin.";
  }
  return paymentType === "sale" ? "Ãƒâ€“deme iÃ…Å¸lemi tamamlanamadi." : "Iade iÃ…Å¸lemi tamamlanamadi.";
}

function parsePaymentMutationRpcRow(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  return {
    applied: row.applied === true,
    idempotent: row.idempotent === true,
    paymentId: typeof row.payment_id === "string" ? row.payment_id : null,
    nextStatus: typeof row.next_status === "string" ? (row.next_status as OrderStatus) : null,
    amountPaid: toMoney(Number(row.amount_paid ?? 0)),
    remainingBalance: toMoney(Number(row.remaining_balance ?? 0)),
    conflictReason: typeof row.conflict_reason === "string" ? row.conflict_reason : null,
  };
}

function resolvePaymentMutationOutcome(input: {
  row: ReturnType<typeof parsePaymentMutationRpcRow>;
  paymentType: "sale" | "refund";
}) {
  const row = input.row;
  if (!row) {
    return { ok: false as const, error: mapPaymentMutationConflictToMessage("UNKNOWN", input.paymentType) };
  }
  if (row.applied || row.idempotent) {
    return {
      ok: true as const,
      idempotent: row.idempotent,
      status: row.nextStatus ?? "served",
      amountPaid: row.amountPaid,
      remaining: row.remainingBalance,
    };
  }
  return {
    ok: false as const,
    error: mapPaymentMutationConflictToMessage(row.conflictReason ?? "UNKNOWN", input.paymentType),
  };
}

type SettlementScope = {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
};

async function buildPendingStationStatusesForItems(items: OrderItem[]) {
  if (items.length === 0) {
    return {} as Partial<Record<PrepStation, OrderStationStatus>>;
  }

  const catalog = await getKitchenCatalogSnapshot();
  const productCategoryMap = new Map(catalog.products.map((product) => [product.id, product.category_id]));
  const categoryMap = new Map(
    catalog.categories.map((category) => [category.id, { name: category.name, prep_station: category.prep_station }]),
  );

  const stationStatuses: Partial<Record<PrepStation, OrderStationStatus>> = {};
  for (const item of items) {
    const station = resolveStationForOrderItem(item, productCategoryMap, categoryMap);
    stationStatuses[station] = "pending";
  }
  return stationStatuses;
}

async function syncOrderStationStatusesAfterOrderWrite(input: {
  supabase: TenantSupabaseClient;
  scope: SettlementScope;
  orderId: string;
  items: OrderItem[];
}) {
  if (input.items.length === 0) {
    return;
  }

  let findQuery = input.supabase
    .from("orders")
    .select("id, status, station_statuses")
    .eq("id", input.orderId);
  if (!input.scope.useLegacySchema && input.scope.businessId) {
    findQuery = findQuery.eq("business_id", input.scope.businessId);
  }
  if (input.scope.branchId) {
    findQuery = findQuery.eq("branch_id", input.scope.branchId);
  }

  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError) {
    if (isMissingStationStatusesColumnError(findError.message)) {
      return;
    }
    throw new Error(findError.message);
  }
  if (!orderRow) {
    return;
  }

  const currentStatus = (orderRow.status as OrderStatus | null) ?? "pending";
  if (currentStatus === "paid" || currentStatus === "cancelled" || currentStatus === "refunded") {
    return;
  }

  const incomingStatuses = await buildPendingStationStatusesForItems(input.items);
  if (Object.keys(incomingStatuses).length === 0) {
    return;
  }

  const mergedStatuses: Partial<Record<PrepStation, OrderStationStatus>> = {
    ...(parseOrderStationStatuses((orderRow as { station_statuses?: unknown }).station_statuses) ?? {}),
  };
  for (const station of PREP_STATIONS) {
    if (incomingStatuses[station]) {
      mergedStatuses[station] = "pending";
    }
  }

  const aggregateStatus =
    currentStatus === "partially_paid" || currentStatus === "partially_refunded"
      ? currentStatus
      : deriveOrderStatusFromStationStatuses(mergedStatuses, currentStatus);
  let updateQuery = input.supabase
    .from("orders")
    .update({
      station_statuses: mergedStatuses,
      status: aggregateStatus,
    })
    .eq("id", input.orderId);
  if (!input.scope.useLegacySchema && input.scope.businessId) {
    updateQuery = updateQuery.eq("business_id", input.scope.businessId);
  }
  if (input.scope.branchId) {
    updateQuery = updateQuery.eq("branch_id", input.scope.branchId);
  }
  const { error: updateError } = await updateQuery;
  if (updateError && !isMissingStationStatusesColumnError(updateError.message)) {
    throw new Error(updateError.message);
  }
}

async function reconcileOrderSettlementState(input: {
  supabase: TenantSupabaseClient;
  scope: SettlementScope;
  orderId: string;
  targetAmount: number;
  tableId?: string | null;
  allowRefunded: boolean;
}) {
  const latestSummary = await getOrderPaymentSummaryMap(input.supabase, [input.orderId]);
  const amountPaid = toMoney(latestSummary.get(input.orderId)?.net ?? 0);
  let currentOrderQuery = input.supabase
    .from("orders")
    .select("id, status")
    .eq("id", input.orderId);
  if (!input.scope.useLegacySchema && input.scope.businessId) {
    currentOrderQuery = currentOrderQuery.eq("business_id", input.scope.businessId);
  }
  if (input.scope.branchId) {
    currentOrderQuery = currentOrderQuery.eq("branch_id", input.scope.branchId);
  }
  const { data: currentOrderRow } = await currentOrderQuery.maybeSingle();
  const currentStatus = ((currentOrderRow as { status?: OrderStatus } | null)?.status ?? "served") as OrderStatus;
  const activeBusinessType =
    (input.scope as { activeBusinessType?: string | null }).activeBusinessType ?? undefined;
  const nextStatusCandidate = resolveOrderSettlementStatus(
    input.targetAmount,
    amountPaid,
    input.allowRefunded,
    currentStatus,
    activeBusinessType,
  );
  const nextStatus = isAllowedOrderStatusTransition(currentStatus, nextStatusCandidate)
    ? nextStatusCandidate
    : currentStatus;
  const remaining = toMoney(Math.max(0, input.targetAmount - amountPaid));

  const orderUpdateResult = await retryMutation(async () => {
    let orderUpdateQuery = input.supabase.from("orders").update({ status: nextStatus }).eq("id", input.orderId);
    if (!input.scope.useLegacySchema && input.scope.businessId) {
      orderUpdateQuery = orderUpdateQuery.eq("business_id", input.scope.businessId);
    }
    if (input.scope.branchId) {
      orderUpdateQuery = orderUpdateQuery.eq("branch_id", input.scope.branchId);
    }
    return orderUpdateQuery;
  });
  if (orderUpdateResult.error) {
    return {
      ok: false as const,
      error: orderUpdateResult.error.message,
      status: nextStatus,
      amountPaid,
      remaining,
    };
  }

  if (nextStatus === "paid" && input.tableId) {
    await retryMutation(async () =>
      input.supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", input.tableId),
    );
  }

  return {
    ok: true as const,
    status: nextStatus,
    amountPaid,
    remaining,
  };
}

const getRequestScopedServiceDataClient = cache(() => getSupabaseServerClient());

const getCachedOpsDataClient = cache(async (): Promise<TenantSupabaseClient | null> => {
  const serviceClient = getRequestScopedServiceDataClient();
  if (serviceClient) {
    return serviceClient;
  }

  const authClient = await getSupabaseAuthServerClient();
  return authClient ?? null;
});

async function getOpsDataClient(): Promise<TenantSupabaseClient | null> {
  return getCachedOpsDataClient();
}

const getCachedTenantDataClient = cache(async (): Promise<TenantSupabaseClient | null> => {
  const authClient = await getSupabaseAuthServerClient();
  if (authClient) {
    return authClient;
  }
  return getRequestScopedServiceDataClient();
});

async function getTenantDataClient(): Promise<TenantSupabaseClient | null> {
  return getCachedTenantDataClient();
}

const demoCategories: Category[] = [
  { id: "demo-cat-1", name: "Kahveler", sort_order: 1, prep_station: "bar" },
  { id: "demo-cat-2", name: "Soguk Icecekler", sort_order: 2, prep_station: "bar" },
  { id: "demo-cat-3", name: "Tatli ve Firin", sort_order: 3, prep_station: "dessert" },
];

const demoProducts: Product[] = [
  {
    id: "demo-prod-1",
    category_id: "demo-cat-1",
    name: "Latte",
    price: 120,
    stock_count: 999,
    image_url: null,
    description: "Double shot espresso + milk",
    is_available: true,
  },
  {
    id: "demo-prod-2",
    category_id: "demo-cat-1",
    name: "Americano",
    price: 95,
    stock_count: 999,
    image_url: null,
    description: "Yogun ama yumusak icim",
    is_available: true,
  },
  {
    id: "demo-prod-3",
    category_id: "demo-cat-3",
    name: "San Sebastian",
    price: 170,
    stock_count: 4,
    image_url: null,
    description: "Ev yapimi cheesecake",
    is_available: true,
  },
  {
    id: "demo-prod-4",
    category_id: "demo-cat-2",
    name: "Cold Brew",
    price: 135,
    stock_count: 5,
    image_url: null,
    description: "Uzun demleme soguk kahve",
    is_available: true,
  },
  {
    id: "demo-prod-5",
    category_id: "demo-cat-3",
    name: "Butter Croissant",
    price: 90,
    stock_count: 3,
    image_url: null,
    description: "Tereyagli sabah servisi",
    is_available: true,
  },
  {
    id: "demo-prod-6",
    category_id: "demo-cat-1",
    name: "Flat White",
    price: 125,
    stock_count: 14,
    image_url: null,
    description: "Kisa sut dokusu, yogun espresso",
    is_available: true,
  },
];

const demoSelfServiceCategories: Category[] = [
  { id: "ss-cat-1", name: "Sicak", sort_order: 1, prep_station: "bar" },
  { id: "ss-cat-2", name: "Soguk", sort_order: 2, prep_station: "bar" },
  { id: "ss-cat-3", name: "Yiyecek", sort_order: 3, prep_station: "dessert" },
  { id: "ss-cat-4", name: "Ekstra", sort_order: 4, prep_station: "bar" },
];

const demoSelfServiceProducts: Product[] = [
  { id: "ss-prod-1", category_id: "ss-cat-1", name: "Espresso", price: 110, stock_count: 999, image_url: null, description: "Single shot espresso", is_available: true },
  { id: "ss-prod-2", category_id: "ss-cat-1", name: "Doppio", price: 125, stock_count: 999, image_url: null, description: "Double shot espresso", is_available: true },
  { id: "ss-prod-3", category_id: "ss-cat-1", name: "Americano", price: 135, stock_count: 999, image_url: null, description: "Hot water + espresso", is_available: true },
  { id: "ss-prod-4", category_id: "ss-cat-1", name: "Latte", price: 155, stock_count: 999, image_url: null, description: "Espresso, steamed milk", is_available: true },
  { id: "ss-prod-5", category_id: "ss-cat-1", name: "Cappuccino", price: 160, stock_count: 999, image_url: null, description: "Espresso, milk foam", is_available: true },
  { id: "ss-prod-6", category_id: "ss-cat-1", name: "Flat White", price: 165, stock_count: 999, image_url: null, description: "Ristretto based silky milk", is_available: true },
  { id: "ss-prod-7", category_id: "ss-cat-1", name: "Mocha", price: 175, stock_count: 999, image_url: null, description: "Chocolate flavored latte", is_available: true },
  { id: "ss-prod-8", category_id: "ss-cat-1", name: "Caramel Macchiato", price: 185, stock_count: 999, image_url: null, description: "Vanilla, milk, espresso, caramel", is_available: true },
  { id: "ss-prod-9", category_id: "ss-cat-1", name: "White Chocolate Mocha", price: 190, stock_count: 999, image_url: null, description: "White mocha sauce + espresso", is_available: true },
  { id: "ss-prod-10", category_id: "ss-cat-1", name: "Filtre Kahve", price: 120, stock_count: 999, image_url: null, description: "Freshly brewed daily coffee", is_available: true },
  { id: "ss-prod-11", category_id: "ss-cat-1", name: "Turk Kahvesi", price: 130, stock_count: 999, image_url: null, description: "Traditional cezve brew", is_available: true },
  { id: "ss-prod-12", category_id: "ss-cat-1", name: "Chai Tea Latte", price: 170, stock_count: 999, image_url: null, description: "Spiced tea latte", is_available: true },

  { id: "ss-prod-13", category_id: "ss-cat-2", name: "Iced Americano", price: 145, stock_count: 999, image_url: null, description: "Espresso over ice", is_available: true },
  { id: "ss-prod-14", category_id: "ss-cat-2", name: "Iced Latte", price: 165, stock_count: 999, image_url: null, description: "Milk + espresso over ice", is_available: true },
  { id: "ss-prod-15", category_id: "ss-cat-2", name: "Iced Mocha", price: 180, stock_count: 999, image_url: null, description: "Iced chocolate mocha", is_available: true },
  { id: "ss-prod-16", category_id: "ss-cat-2", name: "Cold Brew", price: 170, stock_count: 999, image_url: null, description: "Long-steeped cold coffee", is_available: true },
  { id: "ss-prod-17", category_id: "ss-cat-2", name: "Nitro Cold Brew", price: 195, stock_count: 999, image_url: null, description: "Nitrogen infused cold brew", is_available: true },
  { id: "ss-prod-18", category_id: "ss-cat-2", name: "Vanilla Sweet Cream Cold Brew", price: 205, stock_count: 999, image_url: null, description: "Cold brew + vanilla cream", is_available: true },
  { id: "ss-prod-19", category_id: "ss-cat-2", name: "Iced Caramel Macchiato", price: 205, stock_count: 999, image_url: null, description: "Iced caramel espresso drink", is_available: true },
  { id: "ss-prod-20", category_id: "ss-cat-2", name: "Iced White Mocha", price: 210, stock_count: 999, image_url: null, description: "Iced white mocha", is_available: true },
  { id: "ss-prod-21", category_id: "ss-cat-2", name: "Strawberry Acai Refresher", price: 190, stock_count: 999, image_url: null, description: "Fruity refresher", is_available: true },
  { id: "ss-prod-22", category_id: "ss-cat-2", name: "Mango Dragonfruit Refresher", price: 195, stock_count: 999, image_url: null, description: "Tropical refresher", is_available: true },
  { id: "ss-prod-23", category_id: "ss-cat-2", name: "Coffee Frappuccino", price: 210, stock_count: 999, image_url: null, description: "Blended coffee classic", is_available: true },
  { id: "ss-prod-24", category_id: "ss-cat-2", name: "Caramel Frappuccino", price: 220, stock_count: 999, image_url: null, description: "Blended caramel coffee", is_available: true },
  { id: "ss-prod-25", category_id: "ss-cat-2", name: "Mocha Cookie Crumble Frappuccino", price: 235, stock_count: 999, image_url: null, description: "Mocha + cookie crumble", is_available: true },
  { id: "ss-prod-26", category_id: "ss-cat-2", name: "Java Chip Frappuccino", price: 230, stock_count: 999, image_url: null, description: "Chocolate chip blended coffee", is_available: true },
  { id: "ss-prod-27", category_id: "ss-cat-2", name: "White Chocolate Frappuccino", price: 225, stock_count: 999, image_url: null, description: "White chocolate blended drink", is_available: true },
  { id: "ss-prod-28", category_id: "ss-cat-2", name: "Matcha Frappuccino", price: 220, stock_count: 999, image_url: null, description: "Green tea blended drink", is_available: true },

  { id: "ss-prod-29", category_id: "ss-cat-3", name: "Butter Croissant", price: 115, stock_count: 999, image_url: null, description: "All-butter daily bake", is_available: true },
  { id: "ss-prod-30", category_id: "ss-cat-3", name: "Chocolate Croissant", price: 125, stock_count: 999, image_url: null, description: "Cocoa filled croissant", is_available: true },
  { id: "ss-prod-31", category_id: "ss-cat-3", name: "San Sebastian", price: 210, stock_count: 999, image_url: null, description: "Burnt basque cheesecake", is_available: true },
  { id: "ss-prod-32", category_id: "ss-cat-3", name: "Tiramisu", price: 205, stock_count: 999, image_url: null, description: "Espresso layered dessert", is_available: true },
  { id: "ss-prod-33", category_id: "ss-cat-3", name: "Red Velvet Slice", price: 195, stock_count: 999, image_url: null, description: "Cream cheese frosting cake", is_available: true },
  { id: "ss-prod-34", category_id: "ss-cat-3", name: "Bagel Sandwich", price: 185, stock_count: 999, image_url: null, description: "Bagel with smoked turkey", is_available: true },
  { id: "ss-prod-35", category_id: "ss-cat-3", name: "Chicken Caesar Wrap", price: 210, stock_count: 999, image_url: null, description: "Chicken caesar style wrap", is_available: true },
  { id: "ss-prod-36", category_id: "ss-cat-3", name: "Protein Box", price: 225, stock_count: 999, image_url: null, description: "Egg, cheese, fruit set", is_available: true },

  { id: "ss-prod-37", category_id: "ss-cat-4", name: "Extra Espresso Shot", price: 110, stock_count: 999, image_url: null, description: "Add one more espresso shot", is_available: true },
  { id: "ss-prod-38", category_id: "ss-cat-4", name: "Vanilla Syrup Add-on", price: 110, stock_count: 999, image_url: null, description: "Vanilla flavored syrup", is_available: true },
  { id: "ss-prod-39", category_id: "ss-cat-4", name: "Caramel Sauce Add-on", price: 110, stock_count: 999, image_url: null, description: "Sweet caramel topping", is_available: true },
  { id: "ss-prod-40", category_id: "ss-cat-4", name: "Cold Foam Add-on", price: 115, stock_count: 999, image_url: null, description: "Silky cold foam layer", is_available: true },
];

function getDemoMenuSeed(businessType?: BusinessType | null) {
  const isSelfService = businessType === "self_service_coffee";
  return {
    categories: isSelfService ? demoSelfServiceCategories : demoCategories,
    products: isSelfService ? demoSelfServiceProducts : demoProducts,
    modifierGroups: isSelfService ? ([] as ProductModifierGroup[]) : demoModifierGroups,
    modifierOptions: isSelfService ? ([] as ProductModifierOption[]) : demoModifierOptions,
  };
}

const demoTables: DiningTable[] = [
  {
    id: "demo-table-1",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 1,
    name: "Bahce 1",
    status: "occupied",
    qr_code_identifier: "table-1",
  },
  {
    id: "demo-table-2",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 2,
    name: "Bahce 2",
    status: "occupied",
    qr_code_identifier: "table-2",
  },
  {
    id: "demo-table-3",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 3,
    name: "Cam Kenari",
    status: "occupied",
    qr_code_identifier: "table-3",
  },
  {
    id: "demo-table-4",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_number: 4,
    name: "Salon 4",
    status: "empty",
    qr_code_identifier: "table-4",
  },
  {
    id: "demo-table-5",
    business_id: "demo-business-1",
    branch_id: "demo-branch-2",
    table_number: 5,
    name: "VIP 1",
    status: "reserved",
    qr_code_identifier: "table-5",
  },
];

const demoOrders: Order[] = [
  {
    id: "demo-order-1",
    check_number: "0001",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: "demo-table-1",
    table_number: 1,
    channel: "dine_in",
    fulfillment_status: "not_applicable",
    status: "pending",
    total_price: 215,
    discount_amount: 0,
    service_fee: 0,
    final_price: 215,
    created_at: minutesAgo(8),
    items: [
      {
        product_id: "demo-prod-1",
        name: "Latte",
        quantity: 1,
        unit_price: 120,
        line_total: 165,
        modifiers: [
          { group_name: "Boy", option_name: "Buyuk", price_delta: 25, quantity: 1 },
          { group_name: "Ekstra", option_name: "Ekstra shot", price_delta: 20, quantity: 1 },
        ],
      },
      {
        product_id: "demo-prod-2",
        name: "Americano",
        quantity: 1,
        unit_price: 95,
        line_total: 95,
      },
    ],
  },
  {
    id: "demo-order-2",
    check_number: "0002",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: null,
    channel: "delivery",
    customer_name: "Ayse Demir",
    customer_phone: "+90 555 111 22 33",
    delivery_address: "Ataturk Mah. Sedir Sok. No:12 Kadikoy",
    delivery_note: "Zile basmadan arayin",
    courier_id: "demo-courier-1",
    courier_name: "Kurye Mehmet",
    courier_phone: "+90 555 777 88 99",
    fulfillment_status: "awaiting_dispatch",
    status: "preparing",
    total_price: 305,
    discount_amount: 0,
    service_fee: 0,
    final_price: 305,
    created_at: minutesAgo(14),
    items: [
      {
        product_id: "demo-prod-4",
        name: "Cold Brew",
        quantity: 1,
        unit_price: 135,
        line_total: 135,
      },
      {
        product_id: "demo-prod-5",
        name: "Butter Croissant",
        quantity: 1,
        unit_price: 90,
        line_total: 90,
      },
      {
        product_id: "demo-prod-6",
        name: "Flat White",
        quantity: 1,
        unit_price: 80,
        line_total: 80,
      },
    ],
  },
  {
    id: "demo-order-3",
    check_number: "0003",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: null,
    channel: "pickup",
    customer_name: "Mert Kaya",
    customer_phone: "+90 555 444 55 66",
    fulfillment_status: "completed",
    status: "served",
    total_price: 420,
    discount_amount: 20,
    service_fee: 0,
    final_price: 400,
    created_at: minutesAgo(21),
    items: [
      {
        product_id: "demo-prod-1",
        name: "Latte",
        quantity: 2,
        unit_price: 120,
        line_total: 240,
      },
      {
        product_id: "demo-prod-3",
        name: "San Sebastian",
        quantity: 1,
        unit_price: 170,
        line_total: 170,
      },
    ],
  },
  {
    id: "demo-order-4",
    check_number: "0004",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    table_id: "demo-table-4",
    table_number: 4,
    channel: "dine_in",
    fulfillment_status: "not_applicable",
    status: "paid",
    total_price: 260,
    discount_amount: 0,
    service_fee: 15,
    final_price: 275,
    created_at: minutesAgo(46),
    items: [
      {
        product_id: "demo-prod-2",
        name: "Americano",
        quantity: 1,
        unit_price: 95,
        line_total: 95,
      },
      {
        product_id: "demo-prod-5",
        name: "Butter Croissant",
        quantity: 1,
        unit_price: 90,
        line_total: 90,
      },
      {
        product_id: "demo-prod-4",
        name: "Cold Brew",
        quantity: 1,
        unit_price: 75,
        line_total: 75,
      },
    ],
  },
];

const demoIngredients: Ingredient[] = [
  { id: "demo-ing-1", name: "Espresso", unit: "shot", cost: 6.5 },
  { id: "demo-ing-2", name: "Sut", unit: "ml", cost: 0.08 },
  { id: "demo-ing-3", name: "Cheesecake Base", unit: "gram", cost: 0.22 },
  { id: "demo-ing-4", name: "Cold Brew Concentrate", unit: "ml", cost: 0.12 },
  { id: "demo-ing-5", name: "Butter Dough", unit: "gram", cost: 0.18 },
];

const demoProductIngredients: ProductIngredient[] = [
  { product_id: "demo-prod-1", ingredient_id: "demo-ing-1", quantity: 2 },
  { product_id: "demo-prod-1", ingredient_id: "demo-ing-2", quantity: 180 },
  { product_id: "demo-prod-3", ingredient_id: "demo-ing-3", quantity: 150 },
  { product_id: "demo-prod-4", ingredient_id: "demo-ing-4", quantity: 250 },
  { product_id: "demo-prod-5", ingredient_id: "demo-ing-5", quantity: 120 },
];

const demoModifierGroups: ProductModifierGroup[] = [
  {
    id: "demo-mod-group-1",
    product_id: "demo-prod-1",
    name: "Boy",
    min_select: 1,
    max_select: 1,
    is_required: true,
    sort_order: 1,
  },
  {
    id: "demo-mod-group-2",
    product_id: "demo-prod-1",
    name: "Ekstra",
    min_select: 0,
    max_select: 2,
    is_required: false,
    sort_order: 2,
  },
];

const demoModifierOptions: ProductModifierOption[] = [
  {
    id: "demo-mod-opt-1",
    group_id: "demo-mod-group-1",
    name: "Kucuk",
    price_delta: 0,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "demo-mod-opt-2",
    group_id: "demo-mod-group-1",
    name: "Buyuk",
    price_delta: 25,
    is_default: false,
    sort_order: 2,
  },
  {
    id: "demo-mod-opt-3",
    group_id: "demo-mod-group-2",
    name: "Ekstra shot",
    price_delta: 20,
    is_default: false,
    sort_order: 1,
  },
  {
    id: "demo-mod-opt-4",
    group_id: "demo-mod-group-2",
    name: "Yulaf sut",
    price_delta: 18,
    is_default: false,
    sort_order: 2,
  },
];

const demoBusiness: Business = {
  id: "demo-business-1",
  name: "Demo Business",
  slug: DEFAULT_BUSINESS_SLUG,
  plan: "growth",
  business_type: "restaurant_cafe",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const demoBranches: Branch[] = [
  {
    id: "demo-branch-1",
    business_id: "demo-business-1",
    name: "Merkez Ã…Âube",
    slug: "merkez",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-branch-2",
    business_id: "demo-business-1",
    name: "Bahce Ã…Âube",
    slug: "bahce",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoCouriers: Courier[] = [
  {
    id: "demo-courier-1",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    full_name: "Kurye Mehmet",
    phone: "+90 555 777 88 99",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-courier-2",
    business_id: "demo-business-1",
    branch_id: "demo-branch-1",
    full_name: "Kurye Elif",
    phone: "+90 555 666 55 44",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const getCachedApplicationSettingsRow = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("id, key, content, created_at, updated_at")
      .eq("key", "application_settings")
      .maybeSingle();

    if (error) {
      return { error: true as const, row: null };
    }

    return { error: false as const, row: (data as SiteContent | null) ?? null };
  },
  ["app-settings-application"],
  { tags: ["app-settings-application"] },
);

const getCachedGeneralSettingsRow = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("id, key, content, created_at, updated_at")
      .eq("key", "general_settings")
      .maybeSingle();

    if (error) {
      return { error: true as const, row: null };
    }

    return { error: false as const, row: (data as SiteContent | null) ?? null };
  },
  ["app-settings-general"],
  { tags: ["app-settings-general"] },
);

type GeneralSettingsScope = "global" | "active-business";

function buildGeneralSettingsKey(scope: GeneralSettingsScope, businessSlug?: string) {
  if (scope === "active-business") {
    return `general_settings:${normalizeBusinessSlug(businessSlug)}`;
  }
  return "general_settings";
}

async function getCachedGeneralSettingsRowByKey(key: string) {
  if (key === "general_settings") {
    return getCachedGeneralSettingsRow();
  }

  const cachedReader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from("app_settings")
        .select("id, key, content, created_at, updated_at")
        .eq("key", key)
        .maybeSingle();

      if (error) {
        return { error: true as const, row: null };
      }

      return { error: false as const, row: (data as SiteContent | null) ?? null };
    },
    [`app-settings-general:${key}`],
    { tags: ["app-settings-general", `app-settings-general:${key}`] },
  );

  return cachedReader();
}

const getCachedSeoSettingsRow = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("id, key, content, created_at, updated_at")
      .eq("key", "seo_settings")
      .maybeSingle();

    if (error) {
      return { error: true as const, row: null };
    }

    return { error: false as const, row: (data as SiteContent | null) ?? null };
  },
  ["app-settings-seo"],
  { tags: ["app-settings-seo"] },
);

const resolveBusinessBySlug = cache(async (businessSlug?: string) => {
  const slug = normalizeBusinessSlug(businessSlug);
  const cacheKey = `business-by-slug:v2:${slug}`;
  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const reader = unstable_cache(
      async () => {
        let { data, error } = await serviceClient
          .from("businesses")
          .select("id, name, slug, plan, business_type, is_active, created_at, updated_at")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (error?.message?.toLowerCase().includes("business_type")) {
          const fallback = await serviceClient
            .from("businesses")
            .select("id, name, slug, plan, is_active, created_at, updated_at")
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle();
          data = fallback.data as typeof data;
          error = fallback.error as typeof error;
        }

        if (error) {
          if (error.message.toLowerCase().includes("businesses")) {
            return { business: null as Business | null, usingDemoData: false, useLegacySchema: true };
          }
          return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
        }

        if (!data) {
          return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
        }

        const normalizedBusiness = {
          ...(data as Omit<Business, "business_type"> & { business_type?: unknown }),
          business_type:
            (data as { business_type?: unknown }).business_type === "self_service_coffee"
              ? "self_service_coffee"
              : "restaurant_cafe",
        } satisfies Business;

        return {
          business: normalizedBusiness,
          usingDemoData: false,
          useLegacySchema: false,
        };
      },
      [cacheKey],
      { revalidate: 60, tags: ["businesses"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { business: demoBusiness, usingDemoData: true, useLegacySchema: false };
  }

  let { data, error } = await authClient
    .from("businesses")
    .select("id, name, slug, plan, business_type, is_active, created_at, updated_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error?.message?.toLowerCase().includes("business_type")) {
    const fallback = await authClient
      .from("businesses")
      .select("id, name, slug, plan, is_active, created_at, updated_at")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error as typeof error;
  }

  if (error) {
    if (error.message.toLowerCase().includes("businesses")) {
      return { business: null as Business | null, usingDemoData: false, useLegacySchema: true };
    }
    return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
  }

  if (!data) {
    return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
  }

  const normalizedBusiness = {
    ...(data as Omit<Business, "business_type"> & { business_type?: unknown }),
    business_type:
      (data as { business_type?: unknown }).business_type === "self_service_coffee"
        ? "self_service_coffee"
        : "restaurant_cafe",
  } satisfies Business;

  return {
    business: normalizedBusiness,
    usingDemoData: false,
    useLegacySchema: false,
  };
});

export async function getBusinessContextBySlug(businessSlug?: string) {
  const { business, usingDemoData, useLegacySchema } = await resolveBusinessBySlug(businessSlug);
  return {
    businessId: business?.id ?? null,
    business,
    usingDemoData,
    useLegacySchema: Boolean(useLegacySchema),
  };
}

export async function listBranches() {
  const authClient = await getSupabaseAuthServerClient();
  const serviceClient = getSupabaseServerClient();
  const scope = await getDefaultBusinessScope();
  const activeBranchId = scope.branchId;
  if (!serviceClient && !authClient) {
    return {
      branches: demoBranches,
      activeBranchId: activeBranchId || demoBranches[0]?.id || "",
      usingDemoData: true,
    };
  }
  if (!scope.useLegacySchema && !scope.businessId) {
    return { branches: [] as Branch[], activeBranchId: activeBranchId || "", usingDemoData: false };
  }

  if (!scope.canAccessAllBranches && scope.branchAccessIds.length === 0) {
    return { branches: [] as Branch[], activeBranchId: "", usingDemoData: false };
  }

  const queryWithClient = async (client: TenantSupabaseClient) => {
    let query = client
      .from("branches")
      .select("id, business_id, name, slug, branch_profile, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (!scope.useLegacySchema && scope.businessId) {
      query = query.eq("business_id", scope.businessId);
    }
    if (!scope.canAccessAllBranches) {
      query = query.in("id", scope.branchAccessIds);
    }

    let { data, error } = await query;
    if (error?.message?.toLowerCase().includes("branch_profile")) {
      let fallbackQuery = client
        .from("branches")
        .select("id, business_id, name, slug, is_active, created_at, updated_at")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (!scope.useLegacySchema && scope.businessId) {
        fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
      }
      if (!scope.canAccessAllBranches) {
        fallbackQuery = fallbackQuery.in("id", scope.branchAccessIds);
      }
      const fallbackResult = await fallbackQuery;
      data = (fallbackResult.data ?? []).map((row) => ({
        ...(row as Branch),
        branch_profile: "restaurant" as const,
      }));
      error = fallbackResult.error;
    }
    return {
      hasError: Boolean(error),
      errorMessage: error?.message ?? null,
      branches: (data ?? []) as Branch[],
    };
  };

  const result = serviceClient
    ? await unstable_cache(
        async () => queryWithClient(serviceClient),
        [`branches:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.canAccessAllBranches ? "all" : scope.branchAccessIds.join(",")}:${scope.useLegacySchema ? "legacy" : "scoped"}`],
        { revalidate: 20, tags: ["branches"] },
      )()
    : await queryWithClient(authClient as TenantSupabaseClient);

  const data = result.branches ?? [];
  const error = result.hasError ? { message: result.errorMessage ?? "branches" } : null;
  if (error) {
    if (error.message.toLowerCase().includes("branches")) {
      return { branches: [] as Branch[], activeBranchId: activeBranchId || "", usingDemoData: false };
    }
    return { branches: [] as Branch[], activeBranchId: activeBranchId || "", usingDemoData: false };
  }

  const branches = ((data ?? []) as Branch[]).map((branch) => ({
    ...branch,
    branch_profile: "restaurant" as BranchProfile,
  }));
  const resolvedActiveBranchId =
    activeBranchId === ALL_BRANCHES_VALUE && scope.canAccessAllBranches
      ? ALL_BRANCHES_VALUE
      : branches.some((branch) => branch.id === activeBranchId)
      ? activeBranchId
      : branches.find((branch) => branch.id === scope.branchAccessIds[0])?.id ?? branches[0]?.id ?? "";
  return {
    branches,
    activeBranchId: resolvedActiveBranchId,
    usingDemoData: false,
  };
}

export async function createBranch(input: { name: string; slug: string; branchProfile?: BranchProfile }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sube ekleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
  }

  const name = input.name.trim();
  const slug = normalizeBusinessSlug(input.slug);
  const branchProfile = "restaurant";
  if (!name || !slug) {
    return { ok: false, error: "Sube adi ve slug zorunludur." };
  }

  let { data, error } = await supabase
    .from("branches")
    .insert({
      business_id: scope.businessId,
      name,
      slug,
      branch_profile: branchProfile,
      is_active: true,
    })
    .select("id")
    .single();

  if (error?.message?.toLowerCase().includes("branch_profile")) {
    const fallback = await supabase
      .from("branches")
      .insert({
        business_id: scope.businessId,
        name,
        slug,
        is_active: true,
      })
      .select("id")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "branch",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { name, slug, branchProfile },
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function updateBranch(input: { branchId: string; name: string; slug: string; branchProfile?: BranchProfile }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sube guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  const name = input.name.trim();
  const slug = normalizeBusinessSlug(input.slug);
  const branchProfile = "restaurant";
  if (!name || !slug) {
    return { ok: false, error: "Sube adi ve slug zorunludur." };
  }

  let query = supabase
    .from("branches")
    .update({
      name,
      slug,
      branch_profile: branchProfile,
    })
    .eq("id", input.branchId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }

  let { error } = await query;
  if (error?.message?.toLowerCase().includes("branch_profile")) {
    let fallbackQuery = supabase
      .from("branches")
      .update({
        name,
        slug,
      })
      .eq("id", input.branchId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
    }
    const fallback = await fallbackQuery;
    error = fallback.error;
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "branch",
    entityId: input.branchId,
    action: "update",
    details: { name, slug, branchProfile },
  });

  return { ok: true };
}
export async function setBranchActiveStatus(input: { branchId: string; isActive: boolean }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda Ã…Å¸ube durum guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  if (!input.isActive) {
    const { count, error: countError } = await supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("business_id", scope.businessId)
      .eq("is_active", true);
    if (countError) {
      return { ok: false, error: countError.message };
    }
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "En az bir aktif Ã…Å¸ube kalmali." };
    }
  }

  let query = supabase.from("branches").update({ is_active: input.isActive }).eq("id", input.branchId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "branch",
    entityId: input.branchId,
    action: "status_update",
    details: { isActive: input.isActive },
  });

  return { ok: true };
}

export async function deleteBranch(branchId: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda Ã…Å¸ube silme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { count: branchCount, error: countError } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", scope.businessId);
  if (countError) {
    return { ok: false, error: countError.message };
  }
  if ((branchCount ?? 0) <= 1) {
    return { ok: false, error: "Son Ã…Å¸ube silinemez." };
  }

  const dependencyChecks = await Promise.all([
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("couriers").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
  ]);
  const linkedCount = dependencyChecks.reduce((sum, result) => sum + (result.count ?? 0), 0);
  const dependencyError = dependencyChecks.find((result) => result.error)?.error;
  if (dependencyError) {
    return { ok: false, error: dependencyError.message };
  }
  if (linkedCount > 0) {
    return { ok: false, error: "Bu subede masa, sipariÃ…Å¸ veya kurye kaydÃ„Â± oldugu iÃƒÂ§in silinemez." };
  }

  const { error } = await supabase
    .from("branches")
    .delete()
    .eq("business_id", scope.businessId)
    .eq("id", branchId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "branch",
    entityId: branchId,
    action: "delete",
  });

  return { ok: true };
}

export async function listBusinesses() {
  const supabase = await getTenantDataClient();
  const activeSlug = await getActiveBusinessSlug();
  if (!supabase) {
    return {
      businesses: [demoBusiness],
      activeSlug,
      usingDemoData: true,
    };
  }
  const tenantSupabase = supabase;

  const reader = unstable_cache(
    async () => {
      const { data, error } = await tenantSupabase
        .from("businesses")
        .select("id, name, slug, plan, is_active, created_at, updated_at")
        .eq("is_active", true)
        .order("name", { ascending: true });

      return {
        hasError: Boolean(error),
        errorMessage: error?.message ?? null,
        businesses: (data ?? []) as Business[],
      };
    },
    ["businesses:active"],
    { revalidate: 30, tags: ["businesses"] },
  );

  const cached = await reader();
  const data = cached?.businesses ?? [];
  const error = cached?.hasError ? { message: cached.errorMessage ?? "businesses" } : null;

  if (error) {
    if (error.message.toLowerCase().includes("businesses")) {
      return {
        businesses: [demoBusiness],
        activeSlug,
        usingDemoData: false,
      };
    }
    return {
      businesses: [] as Business[],
      activeSlug,
      usingDemoData: false,
    };
  }

  return {
    businesses: (data ?? []) as Business[],
    activeSlug,
    usingDemoData: false,
  };
}

export async function createBusiness(input: { name: string; slug: string; plan?: BusinessPlan }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda iÃ…Å¸letme oluÃ…Å¸turma pasif." };
  }

  const slug = normalizeBusinessSlug(input.slug);
  if (!slug) {
    return { ok: false, error: "Gecerli bir slug gerekli." };
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      name: input.name.trim(),
      slug,
      plan: input.plan ?? "growth",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Ã„Â°Ã…Å¸letme oluÃ…Å¸turulamadÃ„Â±." };
  }

  await logAuditEvent({
    entityType: "business",
    entityId: data.id as string,
    action: "create",
    details: { name: input.name.trim(), slug },
  });
  return { ok: true, id: data.id as string };
}

export async function setBusinessActiveStatus(input: { businessId: string; isActive: boolean }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda iÃ…Å¸letme guncelleme pasif." };
  }

  const { data: activeRows } = await supabase
    .from("businesses")
    .select("id")
    .eq("is_active", true);
  const activeCount = (activeRows ?? []).length;
  if (!input.isActive && activeCount <= 1) {
    return { ok: false, error: "En az bir aktif iÃ…Å¸letme kalmali." };
  }

  const { error } = await supabase
    .from("businesses")
    .update({ is_active: input.isActive })
    .eq("id", input.businessId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "business",
    entityId: input.businessId,
    action: "status_update",
    details: { isActive: input.isActive },
  });

  return { ok: true };
}

function normalizeTenantSlug(value: string) {
  return normalizeBusinessSlug(value);
}

function normalizeBranchSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "merkez";
}

function generateTemporaryPassword() {
  return `Tmp${Math.random().toString(36).slice(2, 10)}!9`;
}


function buildDeterministicSlug(baseSlug: string, attempt: number) {
  if (attempt <= 1) {
    return baseSlug;
  }
  return `${baseSlug}-${attempt}`;
}

function isBranchSlugConflictError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    (normalized.includes("duplicate key") && normalized.includes("slug")) ||
    normalized.includes("branches_business_id_slug_key")
  );
}

export async function createSupportTenantProvision(input: {
  businessName: string;
  businessSlug: string;
  plan?: BusinessPlan;
  tenantModel?: TenantModel;
  branchName?: string;
  branchSlug?: string;
  branchProfile?: BranchProfile;
  ownerEmail: string;
  ownerFullName?: string;
  ownerPassword?: string;
  businessType?: BusinessType;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda tenant olusturma pasif." };
  }

  const actor = await getCurrentSupportActor();
  const platformAccess = await getPlatformAccessByEmail(actor.email ?? "");
  const canManageTenantProvision =
    actor.role === "support_admin" || hasPlatformPermission(platformAccess, "support.access.manage");
  if (!canManageTenantProvision) {
    return { ok: false, error: "Bu islem icin support admin yetkisi gerekli." };
  }

  const businessName = input.businessName.trim();
  const businessSlug = normalizeTenantSlug(input.businessSlug);
  const branchName = input.branchName?.trim() || "Merkez Sube";
  const baseBranchSlug = normalizeBranchSlug(input.branchSlug?.trim() || branchName);
  const tenantModel: TenantModel = "restaurant_only";
  const branchSeeds = [
    {
      name: branchName,
      slugBase: baseBranchSlug,
      branchProfile: "restaurant" as BranchProfile,
    },
  ];
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const ownerFullName = input.ownerFullName?.trim() || ownerEmail.split("@")[0] || "Owner";
  const ownerPassword = input.ownerPassword?.trim() || "";

  if (!businessName || !businessSlug || !ownerEmail || branchSeeds.length === 0) {
    return { ok: false, error: "Isletme ve owner e-posta alanlari zorunludur." };
  }

  let createdBusinessId: string | null = null;
  const createdBranches: Array<{ id: string; name: string; slug: string; branchProfile: BranchProfile }> = [];
  let createdUserId: string | null = null;

  const rollback = async () => {
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId);
    }
    for (const branch of [...createdBranches].reverse()) {
      await supabase.from("branches").delete().eq("id", branch.id);
    }
    if (createdBusinessId) {
      await supabase.from("businesses").delete().eq("id", createdBusinessId);
    }
  };

  const businessInsert = await supabase
    .from("businesses")
    .insert({
      name: businessName,
      slug: businessSlug,
      business_type: input.businessType ?? "restaurant_cafe",
      plan: input.plan ?? "growth",
      is_active: true,
    })
    .select("id")
    .single();

  if (businessInsert.error || !businessInsert.data?.id) {
    return { ok: false, error: businessInsert.error?.message ?? "Isletme olusturulamadi." };
  }
  createdBusinessId = businessInsert.data.id as string;

  const usedSlugs = new Set<string>();
  for (const seed of branchSeeds) {
    let branchCreated = false;
    let lastBranchError: string | null = null;

    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const slugCandidate = buildDeterministicSlug(seed.slugBase, attempt);
      if (usedSlugs.has(slugCandidate)) {
        continue;
      }

      let branchInsert = await supabase
        .from("branches")
        .insert({
          business_id: createdBusinessId,
          name: seed.name,
          slug: slugCandidate,
          branch_profile: seed.branchProfile,
          is_active: true,
        })
        .select("id")
        .single();

      if (branchInsert.error?.message?.toLowerCase().includes("branch_profile")) {
        branchInsert = await supabase
          .from("branches")
          .insert({
            business_id: createdBusinessId,
            name: seed.name,
            slug: slugCandidate,
            is_active: true,
          })
          .select("id")
          .single();
      }

      if (!branchInsert.error && branchInsert.data?.id) {
        usedSlugs.add(slugCandidate);
        createdBranches.push({
          id: branchInsert.data.id as string,
          name: seed.name,
          slug: slugCandidate,
          branchProfile: seed.branchProfile,
        });
        branchCreated = true;
        break;
      }

      if (isBranchSlugConflictError(branchInsert.error?.message)) {
        usedSlugs.add(slugCandidate);
        continue;
      }

      lastBranchError = branchInsert.error?.message ?? "Sube olusturulamadi.";
      break;
    }

    if (!branchCreated) {
      await rollback();
      return { ok: false, error: lastBranchError ?? "Sube olusturulamadi." };
    }
  }

  const usersResult = await supabase.auth.admin.listUsers();
  if (usersResult.error) {
    await rollback();
    return { ok: false, error: usersResult.error.message };
  }
  const existingUser = usersResult.data.users.find((user) => user.email?.toLowerCase() === ownerEmail);
  let ownerUserId = existingUser?.id ?? null;
  let temporaryPassword: string | null = null;

  if (!ownerUserId) {
    const passwordToUse = ownerPassword || generateTemporaryPassword();
    temporaryPassword = ownerPassword ? null : passwordToUse;
    const createUser = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: passwordToUse,
      email_confirm: true,
      user_metadata: { full_name: ownerFullName },
    });
    if (createUser.error || !createUser.data.user?.id) {
      await rollback();
      return { ok: false, error: createUser.error?.message ?? "Owner kullanicisi olusturulamadi." };
    }
    ownerUserId = createUser.data.user.id;
    createdUserId = ownerUserId;
  } else {
    const existingAccess =
      (
        await supabase
          .from("staff_branch_access")
          .select("business_id")
          .eq("profile_id", ownerUserId)
      ).data ?? [];

    const hasOtherTenant = (existingAccess as Array<{ business_id: string }>).some(
      (row) => row.business_id !== createdBusinessId,
    );
    if (hasOtherTenant) {
      await rollback();
      return { ok: false, error: "Bu owner e-postasi baska tenantta kullaniliyor." };
    }
  }

  const profileUpsert = await supabase.from("profiles").upsert(
    {
      id: ownerUserId,
      full_name: ownerFullName,
      role: "owner",
    },
    { onConflict: "id" },
  );

  if (profileUpsert.error) {
    await rollback();
    return { ok: false, error: profileUpsert.error.message };
  }

  await supabase
    .from("staff_branch_access")
    .delete()
    .eq("profile_id", ownerUserId)
    .eq("business_id", createdBusinessId);

  const accessInsert = await supabase.from("staff_branch_access").insert({
    profile_id: ownerUserId,
    business_id: createdBusinessId,
    branch_id: null,
    access_scope: "business",
    is_primary: true,
  });

  if (accessInsert.error) {
    await rollback();
    return { ok: false, error: accessInsert.error.message };
  }

  await writeSupportAuditLog({
    action: "tenant.created",
    entityType: "business",
    entityId: createdBusinessId,
    businessId: createdBusinessId,
    details: {
      businessName,
      businessSlug,
      plan: input.plan ?? "growth",
      tenantModel,
      createdBranches,
      ownerEmail,
      ownerUserId,
    },
  });

  const primaryCreatedBranch = createdBranches[0] ?? null;
  return {
    ok: true,
    businessId: createdBusinessId,
    branchId: primaryCreatedBranch?.id ?? null,
    branchProfile: primaryCreatedBranch?.branchProfile ?? "restaurant",
    tenantModel,
    createdBranches,
    ownerUserId,
    temporaryPassword,
  };
}

export async function updateActiveBusinessPlan(plan: BusinessPlan) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda plan guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { error } = await supabase.from("businesses").update({ plan }).eq("id", scope.businessId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "business",
    entityId: scope.businessId,
    action: "plan_update",
    details: { plan },
  });

  return { ok: true };
}

export async function listCouriers() {
  const serviceClient = getSupabaseServerClient();
  const authClient = serviceClient ? null : await getTenantDataClient();
  if (!serviceClient && !authClient) {
    return { couriers: demoCouriers, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { couriers: [] as Courier[], usingDemoData: false };
  }

  const queryCouriers = async (client: TenantSupabaseClient) => {
    let query = client
      .from("couriers")
      .select("id, business_id, branch_id, full_name, phone, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (!scope.useLegacySchema && scope.businessId) {
      query = query.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      query = query.eq("branch_id", scope.branchId);
    }

    const result = (await withQueryTimeout(query)) as { data: unknown[] | null; error: { message: string } | null };
    return {
      data: result.data as unknown[] | null,
      error: result.error as { message: string } | null,
    };
  };

  if (!serviceClient && authClient) {
    const uncached = await queryCouriers(authClient);
    if (uncached.error) {
      return { couriers: [] as Courier[], usingDemoData: false };
    }
    return { couriers: (uncached.data ?? []) as Courier[], usingDemoData: false };
  }

  const cacheKey = `couriers:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }
      return queryCouriers(innerSupabase);
    },
    [cacheKey],
    { revalidate: 30, tags: ["couriers"] },
  );

  try {
    const cached = await reader();
    if (!cached) {
      return { couriers: demoCouriers, usingDemoData: true };
    }
    if (cached.error) {
      if (cached.error.message.toLowerCase().includes("couriers")) {
        return { couriers: [] as Courier[], usingDemoData: false };
      }
      return { couriers: [] as Courier[], usingDemoData: false };
    }
    return { couriers: (cached.data ?? []) as Courier[], usingDemoData: false };
  } catch {
    return { couriers: demoCouriers, usingDemoData: true };
  }
}

export async function createCourier(input: { fullName: string; phone?: string; businessId?: string | null }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kurye eklenemez." };
  }

  const scope = await getDefaultBusinessScope();
  const businessId = input.businessId ?? scope.businessId;
  if (!businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data, error } = await supabase
    .from("couriers")
    .insert({
      business_id: businessId,
      branch_id: scope.branchId,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "courier",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { fullName: input.fullName.trim(), phone: input.phone?.trim() || null },
  });

  revalidateOperationsCaches();
  return { ok: true, id: String(data?.id ?? "") };
}

export async function updateCourier(input: {
  courierId: string;
  fullName: string;
  phone?: string;
  isActive?: boolean;
}) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kurye guncellenemez." };
  }

  const scope = await getDefaultBusinessScope();
  const fullName = input.fullName.trim();
  if (!fullName) {
    return { ok: false, error: "Kurye adi zorunludur." };
  }

  let query = supabase
    .from("couriers")
    .update({
      full_name: fullName,
      phone: input.phone?.trim() || null,
      is_active: input.isActive ?? true,
    })
    .eq("id", input.courierId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    query = query.eq("branch_id", scope.branchId);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "courier",
    entityId: input.courierId,
    action: "update",
    details: {
      fullName,
      phone: input.phone?.trim() || null,
      isActive: input.isActive ?? true,
    },
  });

  revalidateOperationsCaches();
  return { ok: true };
}

export async function deleteCourier(courierId: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kurye silinemez." };
  }

  const scope = await getDefaultBusinessScope();

  let activeAssignmentsQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("channel", "delivery")
    .eq("courier_id", courierId)
    .in("fulfillment_status", ["awaiting_dispatch", "out_for_delivery"]);
  if (!scope.useLegacySchema && scope.businessId) {
    activeAssignmentsQuery = activeAssignmentsQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    activeAssignmentsQuery = activeAssignmentsQuery.eq("branch_id", scope.branchId);
  }

  const activeAssignments = await activeAssignmentsQuery;
  if ((activeAssignments.count ?? 0) > 0) {
    return { ok: false, error: "Aktif teslimati olan kurye silinemez. Ãƒâ€“nce siparisleri kapatin veya baska kuryeye atayin." };
  }

  let deleteQuery = supabase.from("couriers").delete().eq("id", courierId);
  if (!scope.useLegacySchema && scope.businessId) {
    deleteQuery = deleteQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    deleteQuery = deleteQuery.eq("branch_id", scope.branchId);
  }

  const { error } = await deleteQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "courier",
    entityId: courierId,
    action: "delete",
  });

  revalidateOperationsCaches();
  return { ok: true };
}

async function logAuditEvent(input: {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    details: input.details ?? {},
  });
}

function fireAndForgetAuditEvent(input: {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  void logAuditEvent(input).catch(() => {});
}

function fireAndForgetOrderPostCreateMaintenance(input: {
  supabase: TenantSupabaseClient;
  scope: SettlementScope;
  orderId: string;
  tableId?: string | null;
  items: OrderItem[];
}) {
  void (async () => {
    if (input.tableId) {
      await input.supabase.from("tables").update({ status: "occupied" as TableStatus }).eq("id", input.tableId);
    }
    await syncOrderStationStatusesAfterOrderWrite({
      supabase: input.supabase,
      scope: input.scope,
      orderId: input.orderId,
      items: input.items,
    });
  })().catch((error) => {
    console.warn("[orders.create] post-create maintenance failed", {
      orderId: input.orderId,
      tableId: input.tableId ?? null,
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}

export async function getMenu(businessSlug?: string) {
  const supabase = getSupabaseServerClient();
  const defaultDemoMenu = getDemoMenuSeed();
  const { settings: applicationSettings } = await getApplicationSettings();
  const demoCatalogFallbackEnabled = applicationSettings.embeddedDemoCatalogEnabled;
  if (!supabase) {
    if (!demoCatalogFallbackEnabled) {
      return {
        categories: [] as Category[],
        products: [] as Product[],
        modifierGroups: [] as ProductModifierGroup[],
        modifierOptions: [] as ProductModifierOption[],
        usingDemoData: false,
      };
    }
    return {
      categories: defaultDemoMenu.categories,
      products: defaultDemoMenu.products,
      modifierGroups: defaultDemoMenu.modifierGroups,
      modifierOptions: defaultDemoMenu.modifierOptions,
      usingDemoData: true,
    };
  }

  const { business, useLegacySchema } = await resolveBusinessBySlug(businessSlug);
  const demoMenu = getDemoMenuSeed(business?.business_type ?? null);
  if (!business && !useLegacySchema) {
    return {
      categories: [] as Category[],
      products: [] as Product[],
      modifierGroups: [] as ProductModifierGroup[],
      modifierOptions: [] as ProductModifierOption[],
      usingDemoData: false,
    };
  }
  const cacheKey = `menu:${business?.id ?? "none"}:${useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      const categoriesQuery = useLegacySchema
        ? innerSupabase.from("categories").select("*").order("sort_order", { ascending: true })
        : innerSupabase.from("categories").select("*").eq("business_id", business!.id).order("sort_order", { ascending: true });

      const [categoryResult, productResult] = await withQueryTimeout(
        Promise.all([
          categoriesQuery,
          useLegacySchema
            ? innerSupabase
                .from("products")
                .select("id, category_id, name, price, stock_count, image_url, description, is_available")
                .eq("is_available", true)
                .gt("stock_count", 0)
            : innerSupabase
                .from("products")
                .select("id, business_id, category_id, name, price, stock_count, image_url, description, is_available")
                .eq("business_id", business!.id)
                .eq("is_available", true)
                .gt("stock_count", 0),
        ]),
      );

      const categories = categoryResult.data as unknown[] | null;
      const categoryError = categoryResult.error as { message: string } | null;
      const products = productResult.data as unknown[] | null;
      const productError = productResult.error as { message: string } | null;

      const productIds = ((products ?? []) as Array<{ id: string }>).map((row) => row.id);
      const [groupResult, optionResult] = await withQueryTimeout(
        Promise.all([
          productIds.length === 0
            ? Promise.resolve({ data: [], error: null })
            : innerSupabase
                .from("product_modifier_groups")
                .select("id, product_id, name, min_select, max_select, is_required, sort_order")
                .in("product_id", productIds),
          innerSupabase
            .from("product_modifier_options")
            .select("id, group_id, name, price_delta, is_default, sort_order"),
        ]),
      );

      const modifierGroups = groupResult.data as unknown[] | null;
      const modifierGroupError = groupResult.error as { message: string } | null;
      const modifierOptions = optionResult.data as unknown[] | null;
      const modifierOptionError = optionResult.error as { message: string } | null;

      return {
        hasError: Boolean(categoryError || productError || modifierGroupError || modifierOptionError),
        categories: (categories ?? []) as Category[],
        products: (products ?? []) as Product[],
        modifierGroups: (modifierGroups ?? []) as ProductModifierGroup[],
        modifierOptions: (modifierOptions ?? []) as ProductModifierOption[],
      };
    },
    [cacheKey],
    { revalidate: 30, tags: ["menu", "product-management"] },
  );

  try {
    const cached = await reader();
    if (!cached || cached.hasError) {
      if (!demoCatalogFallbackEnabled) {
        return {
          categories: [] as Category[],
          products: [] as Product[],
          modifierGroups: [] as ProductModifierGroup[],
          modifierOptions: [] as ProductModifierOption[],
          usingDemoData: false,
        };
      }
      return {
        categories: demoMenu.categories,
        products: demoMenu.products,
        modifierGroups: demoMenu.modifierGroups,
        modifierOptions: demoMenu.modifierOptions,
        usingDemoData: true,
      };
    }

    const isSelfServiceBusiness = business?.business_type === "self_service_coffee";
    const isRestaurantBusiness = business?.business_type === "restaurant_cafe";
    const shouldUseDemoForEmptyMenu =
      demoCatalogFallbackEnabled &&
      ((isSelfServiceBusiness && (cached.categories.length === 0 || cached.products.length === 0)) ||
        (isRestaurantBusiness && (cached.categories.length === 0 || cached.products.length === 0)));
    if (shouldUseDemoForEmptyMenu) {
      return {
        categories: demoMenu.categories,
        products: demoMenu.products,
        modifierGroups: demoMenu.modifierGroups,
        modifierOptions: demoMenu.modifierOptions,
        usingDemoData: true,
      };
    }

    return {
      categories: cached.categories,
      products: cached.products,
      modifierGroups: cached.modifierGroups,
      modifierOptions: cached.modifierOptions,
      usingDemoData: false,
    };
  } catch {
    if (!demoCatalogFallbackEnabled) {
      return {
        categories: [] as Category[],
        products: [] as Product[],
        modifierGroups: [] as ProductModifierGroup[],
        modifierOptions: [] as ProductModifierOption[],
        usingDemoData: false,
      };
    }
    return {
      categories: demoMenu.categories,
      products: demoMenu.products,
      modifierGroups: demoMenu.modifierGroups,
      modifierOptions: demoMenu.modifierOptions,
      usingDemoData: true,
    };
  }
}

export async function getTableByQr(
  qrCodeIdentifier: string,
  businessSlug?: string,
): Promise<DiningTable | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return demoTables.find((table) => table.qr_code_identifier === qrCodeIdentifier) ?? null;
  }

  const { business, useLegacySchema } = await resolveBusinessBySlug(businessSlug);
  if (!business && !useLegacySchema) {
    return null;
  }

  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    const result = (useLegacySchema
      ? await withQueryTimeout(
          supabase
            .from("tables")
            .select("id, table_number, status, qr_code_identifier")
            .eq("qr_code_identifier", qrCodeIdentifier)
            .maybeSingle(),
        )
      : await withQueryTimeout(
          supabase
            .from("tables")
            .select("id, business_id, branch_id, table_number, status, qr_code_identifier")
            .eq("business_id", business!.id)
            .eq("qr_code_identifier", qrCodeIdentifier)
            .maybeSingle(),
        )) as { data: unknown; error: { message: string } | null };
    data = result.data;
    error = result.error as { message: string } | null;
  } catch {
    return demoTables.find((table) => table.qr_code_identifier === qrCodeIdentifier) ?? null;
  }

  if (error) {
    return null;
  }

  return (data as DiningTable | null) ?? null;
}

export async function getTableById(
  tableId: string,
  businessSlug?: string,
): Promise<DiningTable | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return demoTables.find((table) => table.id === tableId) ?? null;
  }

  const { business, useLegacySchema } = await resolveBusinessBySlug(businessSlug);
  if (!business && !useLegacySchema) {
    return null;
  }

  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    const result = (useLegacySchema
      ? await withQueryTimeout(
          supabase
            .from("tables")
            .select("id, table_number, status, qr_code_identifier")
            .eq("id", tableId)
            .maybeSingle(),
        )
      : await withQueryTimeout(
          supabase
            .from("tables")
            .select("id, business_id, branch_id, table_number, status, qr_code_identifier")
            .eq("business_id", business!.id)
            .eq("id", tableId)
            .maybeSingle(),
        )) as { data: unknown; error: { message: string } | null };
    data = result.data;
    error = result.error as { message: string } | null;
  } catch {
    return demoTables.find((table) => table.id === tableId) ?? null;
  }

  if (error) {
    return null;
  }

  return (data as DiningTable | null) ?? null;
}

export async function createTableRequest(input: {
  qrCodeIdentifier: string;
  requestType: TableRequestType;
  businessSlug?: string;
  note?: string;
}) {
  const table = await getTableByQr(input.qrCodeIdentifier, input.businessSlug);
  if (!table) {
    return { ok: false, error: "Masa bulunamadi." };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: true, usingDemoData: true };
  }

  const withBusinessPayload = {
    business_id: table.business_id ?? null,
    branch_id: table.branch_id ?? null,
    table_id: table.id,
    request_type: input.requestType,
    note: input.note ?? null,
    status: "open",
  };
  const fallbackPayload = {
    table_id: table.id,
    request_type: input.requestType,
    note: input.note ?? null,
    status: "open",
  };

  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  const firstInsert = await supabase.from("table_requests").insert(withBusinessPayload).select("id").single();
  data = firstInsert.data as { id: string } | null;
  error = firstInsert.error as { message: string } | null;
  if (error?.message?.toLowerCase().includes("business_id")) {
    const secondInsert = await supabase.from("table_requests").insert(fallbackPayload).select("id").single();
    data = secondInsert.data as { id: string } | null;
    error = secondInsert.error as { message: string } | null;
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Talep oluÃ…Å¸turulamadÃ„Â±." };
  }

  await logAuditEvent({
    entityType: "table_request",
    entityId: String(data.id),
    action: "create",
    details: { qr: input.qrCodeIdentifier, requestType: input.requestType, note: input.note ?? null },
  });

  revalidateOperationsCaches();
  return { ok: true, id: String(data.id), usingDemoData: false };
}

type TableRequestRow = {
  id: string;
  table_id: string;
  request_type: TableRequestType;
  status: "open" | "resolved";
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  tables?: { table_number: number } | { table_number: number }[] | null;
};

export async function listTableRequests(
  status: "open" | "resolved" = "open",
  options?: { limit?: number; page?: number; includeTableNumber?: boolean },
) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 50)));
  const safePage = Math.max(1, Math.floor(options?.page ?? 1));
  const includeTableNumber = options?.includeTableNumber ?? true;
  const offset = (safePage - 1) * safeLimit;
  const fetchLimit = safeLimit + 1;
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      requests: [] as TableRequest[],
      page: safePage,
      limit: safeLimit,
      hasNextPage: false,
      hasPreviousPage: safePage > 1,
      usingDemoData: true,
    };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return {
      requests: [] as TableRequest[],
      page: safePage,
      limit: safeLimit,
      hasNextPage: false,
      hasPreviousPage: safePage > 1,
      usingDemoData: false,
    };
  }
  const cacheKey = `table-requests:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${status}:${safeLimit}:${safePage}:${includeTableNumber ? "with-table-number" : "compact"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      const selectColumns = includeTableNumber
        ? "id, table_id, request_type, status, note, created_at, resolved_at, tables(table_number,name,table_zones(name))"
        : "id, table_id, request_type, status, note, created_at, resolved_at";
      let query = innerSupabase
        .from("table_requests")
        .select(selectColumns)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(offset, offset + fetchLimit - 1);

      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }
      if (scope.branchId) {
        query = query.eq("branch_id", scope.branchId);
      }

      const result = await query;
      return {
        data: result.data as TableRequestRow[] | null,
        error: result.error as { message: string } | null,
      };
    },
    [cacheKey],
    { revalidate: 8, tags: ["table-requests"] },
  );

  const cached = await reader();
  if (!cached || cached.error) {
    return {
      requests: [] as TableRequest[],
      page: safePage,
      limit: safeLimit,
      hasNextPage: false,
      hasPreviousPage: safePage > 1,
      usingDemoData: false,
    };
  }

  const rows = (cached.data ?? []) as TableRequestRow[];
  const hasNextPage = rows.length > safeLimit;
  const requests = rows.slice(0, safeLimit).map((row) => ({
    id: row.id,
    branch_id: (row as { branch_id?: string | null }).branch_id ?? scope.branchId ?? null,
    table_id: row.table_id,
    table_number: includeTableNumber ? getTableNumber(row.tables ?? null) : undefined,
    request_type: row.request_type,
    status: row.status,
    note: row.note,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  }));

  return {
    requests,
    page: safePage,
    limit: safeLimit,
    hasNextPage,
    hasPreviousPage: safePage > 1,
    usingDemoData: false,
  };
}

export async function resolveTableRequest(requestId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda talep cozme pasif." };
  }

  const { data, error } = await supabase
    .from("table_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open")
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: true, noop: true };
  }

  fireAndForgetAuditEvent({
    entityType: "table_request",
    entityId: requestId,
    action: "resolve",
  });
  revalidateTag("table-requests", "max");
  revalidateTag("dashboard-snapshot", "max");
  return { ok: true };
}

async function resolveOrderBranchProfile(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  branchId: string | null;
  businessId: string | null;
}) {
  if (!input.branchId) {
    return "restaurant" as BranchProfile;
  }

  const branchResult = await input.supabase
    .from("branches")
    .select("id, branch_profile")
    .eq("id", input.branchId)
    .maybeSingle();

  if (branchResult.error?.message?.toLowerCase().includes("branch_profile")) {
    return "restaurant" as BranchProfile;
  }
  if (branchResult.error) {
    return null;
  }

  const branchProfile = (branchResult.data as { branch_profile?: BranchProfile | null } | null)?.branch_profile ?? "restaurant";
  return branchProfile;
}

async function validateOrderItemProfileScope(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  businessId: string | null;
  branchProfile: BranchProfile;
  items: OrderItem[];
}) {
  const productIds = [
    ...new Set(
      input.items
        .map((item) => normalizeUuidForDb(item.product_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (productIds.length === 0) {
    return { ok: true as const };
  }

  let query = input.supabase
    .from("products")
    .select("id, profile_scope, business_id")
    .in("id", productIds);
  if (input.businessId) {
    query = query.eq("business_id", input.businessId);
  }

  const { data, error } = await query;
  if (error?.message?.toLowerCase().includes("profile_scope")) {
    return { ok: true as const };
  }
  if (error) {
    return { ok: false as const, error: error.message };
  }

  const profileScope = input.branchProfile === "enterprise_market" ? "enterprise_market" : "restaurant";
  const mismatched = ((data ?? []) as Array<{ id: string; profile_scope?: ProductProfileScope | null }>).filter(
    (row) => (row.profile_scope ?? "restaurant") !== profileScope,
  );
  if (mismatched.length > 0) {
    return {
      ok: false as const,
      error:
        profileScope === "enterprise_market"
          ? "Restoran urunleri market siparisine eklenemez."
          : "Market urunleri restoran siparisine eklenemez.",
    };
  }

  return { ok: true as const };
}

async function getOrderItemUnitCostSnapshotMap(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  productIds: string[];
  businessId: string | null;
  useLegacySchema: boolean;
}) {
  const map = new Map<string, number>();
  if (input.productIds.length === 0) {
    return map;
  }

  let productQuery = input.supabase
    .from("products")
    .select("id, cost")
    .in("id", input.productIds);
  if (!input.useLegacySchema && input.businessId) {
    productQuery = productQuery.eq("business_id", input.businessId);
  }

  const { data: productRows, error: productError } = await productQuery;
  if (productError) {
    console.warn("[orders.create] unit cost snapshot product lookup failed", { error: productError.message });
    return map;
  }

  for (const row of (productRows ?? []) as Array<{ id: string; cost: number | null }>) {
    map.set(row.id, Math.max(0, Number(row.cost ?? 0)));
  }

  const scopedRecipeQuery =
    !input.useLegacySchema && input.businessId
      ? input.supabase
          .from("product_ingredients")
          .select("product_id, quantity, ingredients(cost), products!inner(business_id)")
          .eq("products.business_id", input.businessId)
      : input.supabase
          .from("product_ingredients")
          .select("product_id, quantity, ingredients(cost)");

  const { data: recipeRows, error: recipeError } = await scopedRecipeQuery.in("product_id", input.productIds);
  if (recipeError) {
    console.warn("[orders.create] unit cost snapshot recipe lookup failed", { error: recipeError.message });
    return map;
  }

  for (const row of (recipeRows ?? []) as Array<{
    product_id: string;
    quantity: number;
    ingredients:
      | { cost: number | null }
      | { cost: number | null }[]
      | null;
  }>) {
    const ingredientNode = Array.isArray(row.ingredients) ? row.ingredients[0] ?? null : row.ingredients;
    const ingredientCost = Math.max(0, Number(ingredientNode?.cost ?? 0));
    const current = map.get(row.product_id) ?? 0;
    const recipeContribution = Math.max(0, Number(row.quantity ?? 0)) * ingredientCost;
    map.set(row.product_id, toScaled(Math.max(0, current + recipeContribution), 4));
  }

  return map;
}

export async function createOrder(input: {
  tableId?: string | null;
  businessId?: string;
  branchId?: string | null;
  items: OrderItem[];
  totalPrice: number;
  channel?: OrderChannel;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNote?: string;
  courierName?: string;
  courierPhone?: string;
  courierId?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: true, id: crypto.randomUUID(), usingDemoData: true };
  }
  const scope = await getDefaultBusinessScope();

  const channel = input.channel ?? "dine_in";
  const inlineOrderItemsLimit = Math.max(0, Number.parseInt(process.env.ORDER_INLINE_ITEMS_LIMIT ?? "12", 10) || 12);
  const normalizedItems = input.items.map((item) => ({
    ...item,
    product_id_for_db: normalizeUuidForDb(item.product_id),
  }));
  const inlineItemsForOrderRow = normalizedItems.length <= inlineOrderItemsLimit ? input.items : [];
  const fulfillmentStatus =
    input.fulfillmentStatus ?? (channel === "delivery" ? "awaiting_dispatch" : "not_applicable");
  const trimmedCustomerName = input.customerName?.trim() || null;
  const trimmedCustomerPhone = input.customerPhone?.trim() || null;
  const trimmedDeliveryAddress = input.deliveryAddress?.trim() || null;
  const trimmedDeliveryNote = input.deliveryNote?.trim() || null;
  const trimmedCourierName = input.courierName?.trim() || null;
  const trimmedCourierPhone = input.courierPhone?.trim() || null;
  const courierId = input.courierId ?? null;
  const effectiveBusinessId = input.businessId ?? scope.businessId ?? null;
  const effectiveBranchId = input.branchId ?? scope.branchId ?? null;

  const branchProfile = await resolveOrderBranchProfile({
    supabase,
    branchId: effectiveBranchId,
    businessId: effectiveBusinessId,
  });
  if (!branchProfile) {
    return { ok: false, error: "Aktif sube profili cozulemedi." };
  }

  const profileValidation = await validateOrderItemProfileScope({
    supabase,
    businessId: effectiveBusinessId,
    branchProfile,
    items: input.items,
  });
  if (!profileValidation.ok) {
    return { ok: false, error: profileValidation.error };
  }

  const withBusinessPayload = {
    business_id: effectiveBusinessId,
    branch_id: effectiveBranchId,
    table_id: input.tableId ?? null,
    items: inlineItemsForOrderRow,
    total_price: input.totalPrice,
    final_price: input.totalPrice,
    discount_amount: 0,
    service_fee: 0,
    channel,
    customer_name: trimmedCustomerName,
    customer_phone: trimmedCustomerPhone,
    delivery_address: trimmedDeliveryAddress,
    delivery_note: trimmedDeliveryNote,
    courier_id: courierId,
    courier_name: trimmedCourierName,
    courier_phone: trimmedCourierPhone,
    fulfillment_status: fulfillmentStatus,
    status: "pending",
  };
  const fallbackPayload = {
    table_id: input.tableId ?? null,
    items: inlineItemsForOrderRow,
    total_price: input.totalPrice,
    final_price: input.totalPrice,
    discount_amount: 0,
    service_fee: 0,
    channel,
    customer_name: trimmedCustomerName,
    customer_phone: trimmedCustomerPhone,
    delivery_address: trimmedDeliveryAddress,
    delivery_note: trimmedDeliveryNote,
    courier_id: courierId,
    courier_name: trimmedCourierName,
    courier_phone: trimmedCourierPhone,
    fulfillment_status: fulfillmentStatus,
    status: "pending",
  };

  const rpcPayload = normalizedItems.map((item) => ({
    product_id: item.product_id_for_db ?? "",
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    modifiers: (item.modifiers ?? []).map((modifier) => ({
      group_name: modifier.group_name,
      option_name: modifier.option_name,
      price_delta: modifier.price_delta,
      quantity: modifier.quantity ?? item.quantity,
    })),
  }));

  const rpcResult = await supabase.rpc("create_or_append_order", {
    p_business_id: effectiveBusinessId,
    p_branch_id: effectiveBranchId,
    p_table_id: input.tableId ?? null,
    p_channel: channel,
    p_customer_name: trimmedCustomerName,
    p_customer_phone: trimmedCustomerPhone,
    p_delivery_address: trimmedDeliveryAddress,
    p_delivery_note: trimmedDeliveryNote,
    p_courier_id: courierId,
    p_courier_name: trimmedCourierName,
    p_courier_phone: trimmedCourierPhone,
    p_fulfillment_status: fulfillmentStatus,
    p_total_price: input.totalPrice,
    p_items: rpcPayload,
  });

  const rpcOrder = ((rpcResult.data as Array<{ order_id: string; created_new: boolean }> | null) ?? [])[0] ?? null;
  if (!rpcResult.error && rpcOrder?.order_id) {
    fireAndForgetOrderPostCreateMaintenance({
      supabase,
      scope,
      orderId: rpcOrder.order_id,
      tableId: input.tableId ?? null,
      items: input.items,
    });
    fireAndForgetAuditEvent({
      entityType: "order",
      entityId: rpcOrder.order_id,
      action: rpcOrder.created_new ? "create" : "update",
      details: {
        tableId: input.tableId ?? null,
        channel,
        totalPrice: input.totalPrice,
        itemCount: input.items.length,
        customerName: trimmedCustomerName,
        courierId,
      },
    });
    revalidateOperationsCaches();
    return { ok: true, id: rpcOrder.order_id, usingDemoData: false };
  }
  if (rpcResult.error) {
    if (!isRecoverableCreateOrAppendOrderRpcError(rpcResult.error.message)) {
      return { ok: false, error: rpcResult.error.message };
    }
    console.warn("[orders.create] create_or_append_order RPC failed, falling back to direct writes", {
      error: rpcResult.error.message,
      businessId: effectiveBusinessId,
      branchId: effectiveBranchId,
      tableId: input.tableId ?? null,
      channel,
    });
  }

  type OrderMergeCandidate = {
    id: string;
    total_price: number;
    final_price: number | null;
    items: OrderItem[] | null;
    status: OrderStatus | null;
    updated_at?: string | null;
    lock_version?: number | null;
  };

  let orderId: string | null = null;
  let createdNewOrder = false;
  let mergeSnapshot: {
    id: string;
    total_price: number;
    final_price: number;
    items: OrderItem[];
    status: OrderStatus;
  } | null = null;

  if (channel === "dine_in" && input.tableId) {
    let mergeQuery = supabase
      .from("orders")
      .select("id, total_price, final_price, items, status, updated_at, lock_version")
      .eq("table_id", input.tableId)
      .eq("channel", "dine_in")
      .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!scope.useLegacySchema && effectiveBusinessId) {
      mergeQuery = mergeQuery.eq("business_id", effectiveBusinessId);
    }
    if (effectiveBranchId) {
      mergeQuery = mergeQuery.eq("branch_id", effectiveBranchId);
    }

    const mergeResult = await mergeQuery;
    const mergeRow = (mergeResult.data?.[0] as OrderMergeCandidate | undefined) ?? null;

    if (mergeRow) {
      const currentItems = Array.isArray(mergeRow.items) ? mergeRow.items : [];
      const mergedItems =
        currentItems.length + normalizedItems.length <= inlineOrderItemsLimit
          ? [...currentItems, ...input.items]
          : [];
      const baseTotal = Number(mergeRow.total_price ?? 0);
      const baseFinal = Number(mergeRow.final_price ?? mergeRow.total_price ?? 0);
      const updatedTotal = baseTotal + Number(input.totalPrice);
      const updatedFinal = baseFinal + Number(input.totalPrice);
      mergeSnapshot = {
        id: mergeRow.id,
        total_price: baseTotal,
        final_price: baseFinal,
        items: currentItems,
        status: (mergeRow.status ?? "pending") as OrderStatus,
      };

      let updateExistingQuery = supabase
        .from("orders")
        .update({
          items: mergedItems,
          total_price: updatedTotal,
          final_price: updatedFinal,
          status: "pending",
          lock_version: Math.max(0, Number(mergeRow.lock_version ?? 0)) + 1,
        })
        .eq("id", mergeRow.id)
        .select("id");
      if (mergeRow.updated_at) {
        updateExistingQuery = updateExistingQuery.eq("updated_at", mergeRow.updated_at);
      }
      if (typeof mergeRow.lock_version === "number") {
        updateExistingQuery = updateExistingQuery.eq("lock_version", mergeRow.lock_version);
      }
      const { data: updatedExistingRows, error: updateExistingError } = await updateExistingQuery;

      if (updateExistingError && isMissingLockVersionColumnError(updateExistingError.message)) {
        const fallbackUpdate = await supabase
          .from("orders")
          .update({
            items: mergedItems,
            total_price: updatedTotal,
            final_price: updatedFinal,
            status: "pending",
          })
          .eq("id", mergeRow.id);
        if (fallbackUpdate.error) {
          return { ok: false, error: fallbackUpdate.error.message };
        }
      } else if (updateExistingError) {
        return { ok: false, error: updateExistingError.message };
      } else if (!updatedExistingRows || updatedExistingRows.length === 0) {
        return { ok: false, error: "SipariÃ…Å¸ baska bir kullanÃ„Â±cÃ„Â± tarafindan gÃƒÂ¼ncellendi. LÃƒÂ¼tfen tekrar deneyin." };
      }

      orderId = mergeRow.id;
    }
  }

  if (!orderId) {
    let orderData: { id: string } | null = null;
    let orderError: { message: string } | null = null;
    const firstInsert = await supabase.from("orders").insert(withBusinessPayload).select("id").single();
    orderData = firstInsert.data as { id: string } | null;
    orderError = firstInsert.error as { message: string } | null;
    if (orderError?.message?.toLowerCase().includes("business_id")) {
      const secondInsert = await supabase.from("orders").insert(fallbackPayload).select("id").single();
      orderData = secondInsert.data as { id: string } | null;
      orderError = secondInsert.error as { message: string } | null;
    }

    if (orderError) {
      return { ok: false, error: orderError.message };
    }
    if (!orderData) {
      return { ok: false, error: "SipariÃ…Å¸ oluÃ…Å¸turulamadÃ„Â±." };
    }

    orderId = orderData.id;
    createdNewOrder = true;
  }

  const persistedOrderId = orderId;
  if (!persistedOrderId) {
    return { ok: false, error: "SipariÃ…Å¸ oluÃ…Å¸turulamadÃ„Â±." };
  }

  const unitCostSnapshotByProductId = await getOrderItemUnitCostSnapshotMap({
    supabase,
    productIds: [...new Set(normalizedItems.map((item) => item.product_id_for_db).filter(Boolean) as string[])],
    businessId: effectiveBusinessId,
    useLegacySchema: scope.useLegacySchema,
  });

  const payload = normalizedItems.map((item) => {
    const unitCostSnapshot = toScaled(Math.max(0, unitCostSnapshotByProductId.get(item.product_id_for_db ?? "") ?? 0), 4);
    const quantity = Math.max(0, Number(item.quantity));
    return {
      order_id: persistedOrderId,
      product_id: item.product_id_for_db,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      unit_cost_snapshot: unitCostSnapshot,
      line_cost_snapshot: toScaled(unitCostSnapshot * quantity, 4),
    };
  });

  let itemInsert = await supabase.from("order_items").insert(payload);
  let itemError = itemInsert.error;
  if (
    itemError &&
    (itemError.message.toLowerCase().includes("unit_cost_snapshot") ||
      itemError.message.toLowerCase().includes("line_cost_snapshot"))
  ) {
    const legacyPayload = normalizedItems.map((item) => ({
      order_id: persistedOrderId,
      product_id: item.product_id_for_db,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }));
    itemInsert = await supabase.from("order_items").insert(legacyPayload);
    itemError = itemInsert.error;
  }
  if (itemError) {
    if (createdNewOrder) {
      await supabase.from("orders").delete().eq("id", persistedOrderId);
    } else if (mergeSnapshot) {
      await supabase
        .from("orders")
        .update({
          items: mergeSnapshot.items,
          total_price: mergeSnapshot.total_price,
          final_price: mergeSnapshot.final_price,
          status: mergeSnapshot.status,
        })
        .eq("id", mergeSnapshot.id);
    }
    return { ok: false, error: itemError.message };
  }

  const modifierPayload = normalizedItems.flatMap((item) =>
    (item.modifiers ?? []).map((modifier) => ({
      order_id: orderId,
      product_id: item.product_id_for_db,
      product_name: item.name,
      modifier_group_name: modifier.group_name,
      modifier_option_name: modifier.option_name,
      price_delta: modifier.price_delta,
      quantity: modifier.quantity ?? item.quantity,
    })),
  );

  if (modifierPayload.length > 0) {
    const modifierInsert = await supabase.from("order_item_modifiers").insert(modifierPayload);
    if (modifierInsert.error) {
      if (createdNewOrder) {
        await supabase
          .from("order_items")
          .delete()
          .eq("order_id", persistedOrderId);
        await supabase.from("orders").delete().eq("id", persistedOrderId);
      } else if (mergeSnapshot) {
        await supabase
          .from("orders")
          .update({
            items: mergeSnapshot.items,
            total_price: mergeSnapshot.total_price,
            final_price: mergeSnapshot.final_price,
            status: mergeSnapshot.status,
          })
          .eq("id", mergeSnapshot.id);
      }
      return { ok: false, error: modifierInsert.error.message };
    }
  }

  fireAndForgetOrderPostCreateMaintenance({
    supabase,
    scope,
    orderId: persistedOrderId,
    tableId: input.tableId ?? null,
    items: input.items,
  });
  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: persistedOrderId,
    action: createdNewOrder ? "create" : "update",
    details: {
      tableId: input.tableId ?? null,
      channel,
      totalPrice: input.totalPrice,
      itemCount: input.items.length,
      customerName: trimmedCustomerName,
      courierId,
    },
  });
  revalidateOperationsCaches();
  return { ok: true, id: persistedOrderId, usingDemoData: false };
}

type OrderRow = {
  id: string;
  check_number?: string | null;
  branch_id?: string | null;
  table_id: string | null;
  station_statuses?: unknown;
  total_price: number;
  discount_amount?: number;
  service_fee?: number;
  final_price?: number;
  channel?: OrderChannel;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_note?: string | null;
  courier_id?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  fulfillment_status?: FulfillmentStatus;
  status: OrderStatus;
  created_at: string;
  tables: OrderTableRelation;
};

type OrderTableZoneRelation = { name?: string | null } | { name?: string | null }[] | null;
type OrderTableInfo = {
  table_number: number;
  name?: string | null;
  table_zones?: OrderTableZoneRelation;
};
type OrderTableRelation = OrderTableInfo | OrderTableInfo[] | null;

type OrderItemRow = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type OrderItemModifierRow = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  modifier_group_name: string;
  modifier_option_name: string;
  price_delta: number;
  quantity: number;
};

type OrderPaymentSummaryEntry = {
  paid: number;
  refunds: number;
  net: number;
  count: number;
};

type RuntimePaymentSummaryCacheEntry = {
  expiresAt: number;
  rows: OrderPaymentSummaryAggregate[];
};

const ORDER_PAYMENT_SUMMARY_TTL_MS = 8_000;
const ORDER_PAYMENT_SUMMARY_MAX_CACHE_ITEMS = 256;
const ORDER_FLOW_SUMMARY_REVALIDATE_SECONDS = 1;
const ORDER_FLOW_KITCHEN_REVALIDATE_SECONDS = 1;
const ORDER_FLOW_RECEIPT_REVALIDATE_SECONDS = 2;
const runtimeOrderPaymentSummaryCache = new Map<string, RuntimePaymentSummaryCacheEntry>();

function buildPaymentSummaryOrderIdsFingerprint(orderIds: string[]) {
  const joined = orderIds.join(",");
  let hash = 0;
  for (let index = 0; index < joined.length; index += 1) {
    hash = (hash * 31 + joined.charCodeAt(index)) >>> 0;
  }
  return `${orderIds.length}:${hash.toString(16)}`;
}

function mapPaymentSummaryByOrderId(rows: OrderPaymentSummaryAggregate[]) {
  const byOrderId = new Map<string, OrderPaymentSummaryEntry>();
  for (const row of rows) {
    byOrderId.set(row.order_id, {
      paid: toMoney(Number(row.paid)),
      refunds: toMoney(Number(row.refunds)),
      net: toMoney(Number(row.net)),
      count: Math.max(0, Number(row.payment_count ?? 0)),
    });
  }
  return byOrderId;
}

async function getOrderPaymentSummaryRows(
  supabase: TenantSupabaseClient,
  orderIds: string[],
) {
  let rpcResult:
    | {
        data: unknown[] | null;
        error: { message: string } | null;
      }
    | null = null;
  try {
    rpcResult = (await withQueryTimeout(
      supabase.rpc("get_order_payment_summary", { p_order_ids: orderIds }),
    )) as {
      data: unknown[] | null;
      error: { message: string } | null;
    };
  } catch (error) {
    console.warn("[orders.payment-summary] rpc timed out, falling back to payments table", {
      error: error instanceof Error ? error.message : "unknown",
      orderCount: orderIds.length,
    });
  }

  if (rpcResult && !rpcResult.error) {
    return (rpcResult.data ?? []) as OrderPaymentSummaryAggregate[];
  }

  // Keep compatibility if the RPC is unavailable on a tenant.
  let fallback:
    | {
        data: Array<{ order_id: string; payment_type: "sale" | "refund"; amount: number }> | null;
        error: { message: string } | null;
      }
    | null = null;
  try {
    fallback = (await withQueryTimeout(
      supabase.from("payments").select("order_id, payment_type, amount").in("order_id", orderIds),
    )) as {
      data: Array<{ order_id: string; payment_type: "sale" | "refund"; amount: number }> | null;
      error: { message: string } | null;
    };
  } catch (error) {
    console.warn("[orders.payment-summary] fallback query timed out", {
      error: error instanceof Error ? error.message : "unknown",
      orderCount: orderIds.length,
    });
    return [];
  }

  if (fallback && !fallback.error) {
    const rolledUp = new Map<string, OrderPaymentSummaryEntry>();
    for (const row of fallback.data ?? []) {
      const current = rolledUp.get(row.order_id) ?? { paid: 0, refunds: 0, net: 0, count: 0 };
      const amount = toMoney(Number(row.amount));
      if (row.payment_type === "refund") {
        current.refunds = toMoney(current.refunds + amount);
        current.net = toMoney(current.net - amount);
      } else {
        current.paid = toMoney(current.paid + amount);
        current.net = toMoney(current.net + amount);
        current.count += 1;
      }
      rolledUp.set(row.order_id, current);
    }

    return [...rolledUp.entries()].map(([order_id, summary]) => ({
      order_id,
      paid: summary.paid,
      refunds: summary.refunds,
      net: summary.net,
      payment_count: summary.count,
    }));
  }

  return [];
}

async function getOrderPaymentSummaryMap(
  supabase: TenantSupabaseClient | null,
  orderIds: string[],
  scopeOverride?: {
    businessId: string | null;
    branchId: string | null;
    useLegacySchema: boolean;
  },
) {
  if (!supabase || orderIds.length === 0) {
    return new Map<string, OrderPaymentSummaryEntry>();
  }

  const normalizedOrderIds = [...new Set(orderIds.filter(Boolean))].sort();
  if (normalizedOrderIds.length === 0) {
    return new Map<string, OrderPaymentSummaryEntry>();
  }

  const scope = scopeOverride ?? (await getDefaultBusinessScope());
  const orderIdsFingerprint = buildPaymentSummaryOrderIdsFingerprint(normalizedOrderIds);
  const cacheKey = `order-payment-summary:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}:${orderIdsFingerprint}`;
  const now = Date.now();
  const cached = runtimeOrderPaymentSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return mapPaymentSummaryByOrderId(cached.rows);
  }

  const rows = await getOrderPaymentSummaryRows(supabase, normalizedOrderIds);
  runtimeOrderPaymentSummaryCache.set(cacheKey, {
    expiresAt: now + ORDER_PAYMENT_SUMMARY_TTL_MS,
    rows,
  });

  if (runtimeOrderPaymentSummaryCache.size > ORDER_PAYMENT_SUMMARY_MAX_CACHE_ITEMS) {
    for (const [key, entry] of runtimeOrderPaymentSummaryCache) {
      if (entry.expiresAt <= now) {
        runtimeOrderPaymentSummaryCache.delete(key);
      }
    }
    if (runtimeOrderPaymentSummaryCache.size > ORDER_PAYMENT_SUMMARY_MAX_CACHE_ITEMS) {
      const oldestKey = runtimeOrderPaymentSummaryCache.keys().next().value as string | undefined;
      if (oldestKey) {
        runtimeOrderPaymentSummaryCache.delete(oldestKey);
      }
    }
  }

  return mapPaymentSummaryByOrderId(rows);
}

type FinancePaymentRow = {
  id?: string;
  order_id: string;
  payment_type: "sale" | "refund";
  method: "cash" | "card" | "mixed";
  amount: number;
  note?: string | null;
  created_at: string;
};

type ProductProfitabilityRow = {
  productName: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  refundImpact: number;
};

async function listScopedFinancePayments(input: {
  supabase: TenantSupabaseClient;
  startIso: string;
  endIso?: string;
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
  mode?: "compact" | "full";
  orderByCreatedAtDesc?: boolean;
  limit?: number;
}) {
  const mode = input.mode ?? "compact";

  let query =
    mode === "full"
      ? input.supabase
          .from("payments")
          .select("id, order_id, payment_type, method, amount, note, created_at")
          .gte("created_at", input.startIso)
      : input.supabase
          .from("payments")
          .select("order_id, payment_type, method, amount, created_at")
          .gte("created_at", input.startIso);

  if (input.endIso) {
    query = query.lt("created_at", input.endIso);
  }

  if (!input.useLegacySchema && input.businessId) {
    query = query.eq("business_id", input.businessId);
  }
  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  }
  if (input.orderByCreatedAtDesc) {
    query = query.order("created_at", { ascending: false });
  }
  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;
  return {
    rows: ((data ?? []) as FinancePaymentRow[]).map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
    error,
  };
}

function aggregateFinancePayments(rows: FinancePaymentRow[]) {
  let grossSales = 0;
  let refunds = 0;
  const methodMap = new Map<string, { sales: number; refunds: number }>([
    ["cash", { sales: 0, refunds: 0 }],
    ["card", { sales: 0, refunds: 0 }],
    ["mixed", { sales: 0, refunds: 0 }],
  ]);
  const hourMap = new Map<string, number>();
  for (let i = 0; i < 24; i += 1) {
    hourMap.set(String(i).padStart(2, "0"), 0);
  }
  const dailyMap = new Map<string, { sales: number; refunds: number }>();
  const orderNetMap = new Map<string, number>();
  const paidOrderIds = new Set<string>();

  for (const row of rows) {
    const amount = Number(row.amount);
    const methodBucket = methodMap.get(row.method) ?? { sales: 0, refunds: 0 };
    const dayKey = String(row.created_at).slice(0, 10);
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { sales: 0, refunds: 0 });
    }
    const dayBucket = dailyMap.get(dayKey)!;

    if (row.payment_type === "refund") {
      refunds += amount;
      methodBucket.refunds += amount;
      dayBucket.refunds += amount;
      orderNetMap.set(row.order_id, (orderNetMap.get(row.order_id) ?? 0) - amount);
    } else {
      grossSales += amount;
      methodBucket.sales += amount;
      dayBucket.sales += amount;
      paidOrderIds.add(row.order_id);
      const hour = new Date(row.created_at).getHours().toString().padStart(2, "0");
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + amount);
      orderNetMap.set(row.order_id, (orderNetMap.get(row.order_id) ?? 0) + amount);
    }

    methodMap.set(row.method, methodBucket);
    dailyMap.set(dayKey, dayBucket);
  }

  return {
    grossSales,
    refunds,
    netSales: grossSales - refunds,
    methodMap,
    hourMap,
    dailyMap,
    orderNetMap,
    paidOrderIds,
  };
}

function buildGroupedOrderItems(
  itemRows: OrderItemRow[],
  modifierRows: OrderItemModifierRow[],
) {
  const groupedItems = new Map<string, OrderItem[]>();
  const groupedModifiers = new Map<string, OrderItemModifierSelection[]>();

  for (const row of modifierRows) {
    const key = `${row.order_id}:${row.product_id ?? row.product_name}`;
    if (!groupedModifiers.has(key)) {
      groupedModifiers.set(key, []);
    }
    groupedModifiers.get(key)?.push({
      group_name: row.modifier_group_name,
      option_name: row.modifier_option_name,
      price_delta: Number(row.price_delta),
      quantity: Number(row.quantity),
    });
  }

  for (const row of itemRows) {
    if (!groupedItems.has(row.order_id)) {
      groupedItems.set(row.order_id, []);
    }
    const modifierKey = `${row.order_id}:${row.product_id ?? row.product_name}`;
    groupedItems.get(row.order_id)?.push({
      product_id: row.product_id ?? "unknown-product",
      name: row.product_name,
      quantity: row.quantity,
      unit_price: Number(row.unit_price),
      line_total: Number(row.line_total),
      modifiers: groupedModifiers.get(modifierKey) ?? [],
    });
  }

  return groupedItems;
}

function mapDetailedOrders(
  orders: OrderRow[],
  groupedItems: Map<string, OrderItem[]>,
  paymentSummary: Map<string, { paid: number; refunds: number; net: number; count: number }>,
) {
  return orders.map((row) => ({
    id: row.id,
    check_number: row.check_number ?? null,
    branch_id: row.branch_id ?? null,
    table_id: row.table_id,
    table_number: getTableNumber(row.tables),
    table_name: getTableName(row.tables),
    table_zone_name: getTableZoneName(row.tables),
    channel: row.channel ?? "dine_in",
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    delivery_address: row.delivery_address ?? null,
    delivery_note: row.delivery_note ?? null,
    courier_id: row.courier_id ?? null,
    courier_name: row.courier_name ?? null,
    courier_phone: row.courier_phone ?? null,
    fulfillment_status: row.fulfillment_status ?? "not_applicable",
    amount_paid: toMoney(paymentSummary.get(row.id)?.net ?? 0),
    remaining_balance: toMoney(
      Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
    ),
    payment_count: paymentSummary.get(row.id)?.count ?? 0,
    items: groupedItems.get(row.id) ?? [],
    total_price: Number(row.total_price),
    discount_amount: Number(row.discount_amount ?? 0),
    service_fee: Number(row.service_fee ?? 0),
    final_price: Number(row.final_price ?? row.total_price),
    status: row.status,
    station_statuses: parseOrderStationStatuses(row.station_statuses),
    created_at: row.created_at,
  })) as Order[];
}

async function getCachedOrderSummaryRows(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
  statuses: OrderStatus[];
  channels: OrderChannel[] | null;
  includePaymentSummary: boolean;
  includeStationStatuses: boolean;
  limit: number | null;
  ascending: boolean;
}) {
  const statusKey = [...input.statuses].sort().join(",");
  const channelKey = input.channels?.length ? [...input.channels].sort().join(",") : "all-channels";
  const cacheKey = `orders-summary:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${statusKey}:${channelKey}:${input.includePaymentSummary ? "payments" : "no-payments"}:${input.includeStationStatuses ? "stations" : "nostations"}:${input.limit ?? "all"}:${input.ascending ? "asc" : "desc"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const orderSummarySelect = input.includeStationStatuses
        ? "id, check_number, branch_id, table_id, station_statuses, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))"
        : "id, check_number, branch_id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ordersQuery: any = supabase.from("orders");
      ordersQuery = ordersQuery.select(orderSummarySelect);
      ordersQuery = ordersQuery.in("status", input.statuses);
      ordersQuery = ordersQuery.order("created_at", { ascending: input.ascending });
      if (input.channels && input.channels.length > 0) {
        ordersQuery = ordersQuery.in("channel", input.channels);
      }

      if (!input.useLegacySchema && input.businessId) {
        ordersQuery = ordersQuery.eq("business_id", input.businessId);
      }
      if (input.branchId) {
        ordersQuery = ordersQuery.eq("branch_id", input.branchId);
      }
      if (typeof input.limit === "number") {
        ordersQuery = ordersQuery.limit(input.limit);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) {
        return { orders: [] as Order[], hasError: true };
      }

      const orders = (ordersData ?? []) as OrderRow[];
      if (orders.length === 0) {
        return { orders: [] as Order[], hasError: false };
      }

      const orderIds = orders.map((row) => row.id);
      const paymentSummary = input.includePaymentSummary
        ? await getOrderPaymentSummaryMap(supabase, orderIds, {
            businessId: input.businessId,
            branchId: input.branchId,
            useLegacySchema: input.useLegacySchema,
          })
        : new Map<string, { paid: number; refunds: number; net: number; count: number }>();

      return {
        orders: orders.map((row) => ({
          id: row.id,
          check_number: row.check_number ?? null,
          branch_id: row.branch_id ?? null,
          table_id: row.table_id,
          table_number: getTableNumber(row.tables),
          table_name: getTableName(row.tables),
          table_zone_name: getTableZoneName(row.tables),
          channel: row.channel ?? "dine_in",
          customer_name: row.customer_name ?? null,
          customer_phone: row.customer_phone ?? null,
          delivery_address: row.delivery_address ?? null,
          delivery_note: row.delivery_note ?? null,
          courier_id: row.courier_id ?? null,
          courier_name: row.courier_name ?? null,
          courier_phone: row.courier_phone ?? null,
          fulfillment_status: row.fulfillment_status ?? "not_applicable",
          amount_paid: toMoney(paymentSummary.get(row.id)?.net ?? 0),
          remaining_balance: toMoney(
            Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
          ),
          payment_count: paymentSummary.get(row.id)?.count ?? 0,
          items: [],
          total_price: Number(row.total_price),
          discount_amount: Number(row.discount_amount ?? 0),
          service_fee: Number(row.service_fee ?? 0),
          final_price: Number(row.final_price ?? row.total_price),
          status: row.status,
          station_statuses: input.includeStationStatuses ? parseOrderStationStatuses(row.station_statuses) : null,
          created_at: row.created_at,
        })) as Order[],
        hasError: false,
      };
    },
    [cacheKey],
    { revalidate: ORDER_FLOW_SUMMARY_REVALIDATE_SECONDS, tags: ["orders-summary"] },
  );

  return reader();
}

async function getCachedOrderReceiptRow(input: {
  orderId: string;
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}) {
  const cacheKey = `order-receipt:${input.orderId}:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      let orderQuery = supabase
        .from("orders")
        .select("id, check_number, table_id, station_statuses, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))")
        .eq("id", input.orderId);
      if (!input.useLegacySchema && input.businessId) {
        orderQuery = orderQuery.eq("business_id", input.businessId);
      }
      if (input.branchId) {
        orderQuery = orderQuery.eq("branch_id", input.branchId);
      }

      const { data, error } = await orderQuery.maybeSingle();

      if (error || !data) {
        return { hasError: true as const, order: null as Order | null };
      }

      const [paymentSummary, { data: itemRows }, { data: modifierRows }] = await Promise.all([
        getOrderPaymentSummaryMap(supabase, [input.orderId], {
          businessId: input.businessId,
          branchId: input.branchId,
          useLegacySchema: input.useLegacySchema,
        }),
        supabase
          .from("order_items")
          .select("product_id, product_name, quantity, unit_price, line_total")
          .eq("order_id", input.orderId),
        supabase
          .from("order_item_modifiers")
          .select("product_id, product_name, modifier_group_name, modifier_option_name, price_delta, quantity")
          .eq("order_id", input.orderId),
      ]);

      const groupedModifiers = new Map<string, OrderItemModifierSelection[]>();
      for (const row of (modifierRows ?? []) as Array<{
        product_id: string | null;
        product_name: string;
        modifier_group_name: string;
        modifier_option_name: string;
        price_delta: number;
        quantity: number;
      }>) {
        const key = `${row.product_id ?? row.product_name}`;
        if (!groupedModifiers.has(key)) {
          groupedModifiers.set(key, []);
        }
        groupedModifiers.get(key)?.push({
          group_name: row.modifier_group_name,
          option_name: row.modifier_option_name,
          price_delta: Number(row.price_delta),
          quantity: Number(row.quantity),
        });
      }

      const tableInfo = data.tables as OrderTableRelation;
      const tableNumber = Array.isArray(tableInfo) ? tableInfo[0]?.table_number : tableInfo?.table_number;
      const tableName = Array.isArray(tableInfo) ? tableInfo[0]?.name ?? null : tableInfo?.name ?? null;

      return {
        hasError: false as const,
        order: {
          id: data.id as string,
          check_number: (data.check_number as string | null) ?? null,
          table_id: (data.table_id as string | null) ?? null,
          table_number: tableNumber,
          table_name: tableName,
          table_zone_name: getTableZoneName(tableInfo),
          channel: (data.channel as OrderChannel | null) ?? "dine_in",
          customer_name: (data.customer_name as string | null) ?? null,
          customer_phone: (data.customer_phone as string | null) ?? null,
          delivery_address: (data.delivery_address as string | null) ?? null,
          delivery_note: (data.delivery_note as string | null) ?? null,
          courier_id: (data.courier_id as string | null) ?? null,
          courier_name: (data.courier_name as string | null) ?? null,
          courier_phone: (data.courier_phone as string | null) ?? null,
          fulfillment_status: (data.fulfillment_status as FulfillmentStatus | null) ?? "not_applicable",
          amount_paid: toMoney(paymentSummary.get(input.orderId)?.net ?? 0),
          remaining_balance: toMoney(
            Math.max(0, Number(data.final_price ?? data.total_price) - (paymentSummary.get(input.orderId)?.net ?? 0)),
          ),
          payment_count: paymentSummary.get(input.orderId)?.count ?? 0,
          items: ((itemRows ?? []) as Array<{
            product_id: string | null;
            product_name: string;
            quantity: number;
            unit_price: number;
            line_total: number;
          }>).map((row) => ({
            product_id: row.product_id ?? "unknown-product",
            name: row.product_name,
            quantity: Number(row.quantity),
            unit_price: Number(row.unit_price),
            line_total: Number(row.line_total),
            modifiers: groupedModifiers.get(`${row.product_id ?? row.product_name}`) ?? [],
          })),
          total_price: Number(data.total_price),
          discount_amount: Number(data.discount_amount ?? 0),
          service_fee: Number(data.service_fee ?? 0),
          final_price: Number(data.final_price ?? data.total_price),
          status: data.status as OrderStatus,
          station_statuses: parseOrderStationStatuses((data as { station_statuses?: unknown }).station_statuses),
          created_at: data.created_at as string,
        } as Order,
      };
    },
    [cacheKey],
    { revalidate: ORDER_FLOW_RECEIPT_REVALIDATE_SECONDS, tags: ["order-receipt", "orders-summary"] },
  );

  return reader();
}

async function getCachedKitchenOrdersSnapshot(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}) {
  const statusKey = ["pending", "preparing", "ready", "served", "partially_paid"].join(",");
  const cacheKey = `kitchen-orders:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${statusKey}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      let ordersQuery = supabase
        .from("orders")
        .select("id, check_number, branch_id, table_id, station_statuses, total_price, discount_amount, service_fee, final_price, channel, customer_name, delivery_address, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))")
        .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
        .order("created_at", { ascending: true });

      if (!input.useLegacySchema && input.businessId) {
        ordersQuery = ordersQuery.eq("business_id", input.businessId);
      }
      if (input.branchId) {
        ordersQuery = ordersQuery.eq("branch_id", input.branchId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) {
        return { orders: [] as Order[], hasError: true };
      }

      const orders = (ordersData ?? []) as OrderRow[];
      if (orders.length === 0) {
        return { orders: [] as Order[], hasError: false };
      }

      const orderIds = orders.map((row) => row.id);
      const [{ data: itemRows, error: itemError }, { data: modifierRows }] = await Promise.all([
        supabase
          .from("order_items")
          .select("order_id, product_id, product_name, quantity, unit_price, line_total")
          .in("order_id", orderIds),
        supabase
          .from("order_item_modifiers")
          .select("order_id, product_id, product_name, modifier_group_name, modifier_option_name, price_delta, quantity")
          .in("order_id", orderIds),
      ]);

      if (itemError) {
        return { orders: [] as Order[], hasError: true };
      }

      const groupedItems = buildGroupedOrderItems(
        ((itemRows ?? []) as OrderItemRow[]),
        ((modifierRows ?? []) as OrderItemModifierRow[]),
      );

      return {
        orders: orders.map((row) => ({
          id: row.id,
          check_number: row.check_number ?? null,
          branch_id: row.branch_id ?? null,
          table_id: row.table_id,
          table_number: getTableNumber(row.tables),
          table_name: getTableName(row.tables),
          table_zone_name: getTableZoneName(row.tables),
          channel: row.channel ?? "dine_in",
          customer_name: row.customer_name ?? null,
          customer_phone: null,
          delivery_address: row.delivery_address ?? null,
          delivery_note: null,
          courier_id: null,
          courier_name: null,
          courier_phone: null,
          fulfillment_status: row.fulfillment_status ?? "not_applicable",
          amount_paid: 0,
          remaining_balance: 0,
          payment_count: 0,
          items: groupedItems.get(row.id) ?? [],
          total_price: Number(row.total_price),
          discount_amount: Number(row.discount_amount ?? 0),
          service_fee: Number(row.service_fee ?? 0),
          final_price: Number(row.final_price ?? row.total_price),
          status: row.status,
          station_statuses: parseOrderStationStatuses(row.station_statuses),
          created_at: row.created_at,
        })) as Order[],
        hasError: false,
      };
    },
    [cacheKey],
    { revalidate: ORDER_FLOW_KITCHEN_REVALIDATE_SECONDS, tags: ["kitchen-orders", "orders-summary"] },
  );

  return reader();
}

export async function listOrders(
  statuses: OrderStatus[],
  options?: {
    includeItems?: boolean;
    includePaymentSummary?: boolean;
    includeStationStatuses?: boolean;
    limit?: number;
    ascending?: boolean;
    channels?: OrderChannel[];
  },
) {
  const supabase = await getTenantDataClient();
  const includeItems = options?.includeItems ?? true;
  const includePaymentSummary = options?.includePaymentSummary ?? true;
  const includeStationStatuses = options?.includeStationStatuses ?? true;
  const limit = options?.limit;
  const ascending = options?.ascending ?? true;
  const channels = options?.channels;
  if (!supabase) {
    const filtered = demoOrders
      .filter((order) => statuses.includes(order.status) && (!channels || channels.includes(order.channel ?? "dine_in")))
      .sort((a, b) => (ascending ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
    return { orders: (typeof limit === "number" ? filtered.slice(0, limit) : filtered), usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { orders: [] as Order[], usingDemoData: false };
  }

  if (!includeItems) {
    const cached = await getCachedOrderSummaryRows({
      businessId: scope.businessId,
      branchId: scope.branchId,
      useLegacySchema: scope.useLegacySchema,
      statuses,
      includePaymentSummary,
      includeStationStatuses,
      limit: typeof limit === "number" ? limit : null,
      ascending,
      channels: channels ?? null,
    });

    if (cached && !cached.hasError) {
      return {
        orders: cached.orders,
        usingDemoData: false,
      };
    }
  }

  const orderSummarySelect = includeStationStatuses
    ? "id, check_number, branch_id, table_id, station_statuses, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))"
    : "id, check_number, branch_id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery: any = supabase.from("orders");
  ordersQuery = ordersQuery.select(orderSummarySelect);
  ordersQuery = ordersQuery.in("status", statuses);
  ordersQuery = ordersQuery.order("created_at", { ascending });
  if (channels && channels.length > 0) {
    ordersQuery = ordersQuery.in("channel", channels);
  }

  if (!scope.useLegacySchema && scope.businessId) {
    ordersQuery = ordersQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    ordersQuery = ordersQuery.eq("branch_id", scope.branchId);
  }
  if (typeof limit === "number") {
    ordersQuery = ordersQuery.limit(limit);
  }

  const { data: ordersData, error: ordersError } = await ordersQuery;

  if (ordersError) {
    return {
      orders: demoOrders.filter((order) => statuses.includes(order.status) && (!channels || channels.includes(order.channel ?? "dine_in"))),
      usingDemoData: true,
    };
  }

  const orders = (ordersData ?? []) as OrderRow[];
  if (orders.length === 0) {
    return { orders: [] as Order[], usingDemoData: false };
  }

  const orderIds = orders.map((row) => row.id);
  const paymentSummary = includePaymentSummary
    ? await getOrderPaymentSummaryMap(supabase, orderIds)
    : new Map<string, { paid: number; refunds: number; net: number; count: number }>();
  if (!includeItems) {
    return {
      orders: orders.map((row) => ({
        id: row.id,
        check_number: row.check_number ?? null,
        branch_id: row.branch_id ?? null,
        table_id: row.table_id,
        table_number: getTableNumber(row.tables),
        table_name: getTableName(row.tables),
        table_zone_name: getTableZoneName(row.tables),
        channel: row.channel ?? "dine_in",
        customer_name: row.customer_name ?? null,
        customer_phone: row.customer_phone ?? null,
        delivery_address: row.delivery_address ?? null,
        delivery_note: row.delivery_note ?? null,
        courier_id: row.courier_id ?? null,
        courier_name: row.courier_name ?? null,
        courier_phone: row.courier_phone ?? null,
        fulfillment_status: row.fulfillment_status ?? "not_applicable",
        amount_paid: toMoney(paymentSummary.get(row.id)?.net ?? 0),
        remaining_balance: toMoney(
          Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
        ),
        payment_count: paymentSummary.get(row.id)?.count ?? 0,
        items: [],
        total_price: Number(row.total_price),
        discount_amount: Number(row.discount_amount ?? 0),
        service_fee: Number(row.service_fee ?? 0),
        final_price: Number(row.final_price ?? row.total_price),
        status: row.status,
        station_statuses: includeStationStatuses ? parseOrderStationStatuses(row.station_statuses) : null,
        created_at: row.created_at,
      })),
      usingDemoData: false,
    };
  }
  const { data: itemRows, error: itemError } = await supabase
    .from("order_items")
    .select("order_id, product_id, product_name, quantity, unit_price, line_total")
    .in("order_id", orderIds);
  const { data: modifierRows } = await supabase
    .from("order_item_modifiers")
    .select("order_id, product_id, product_name, modifier_group_name, modifier_option_name, price_delta, quantity")
    .in("order_id", orderIds);

  if (itemError) {
    let fallbackQuery = supabase
        .from("orders")
        .select("id, check_number, table_id, station_statuses, items, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))")
        .in("status", statuses)
        .order("created_at", { ascending: true });
    if (channels && channels.length > 0) {
      fallbackQuery = fallbackQuery.in("channel", channels);
    }

    if (!scope.useLegacySchema && scope.businessId) {
      fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
    }

    const fallbackRows = await fallbackQuery;

    if (fallbackRows.error) {
      return {
        orders: demoOrders.filter((order) => statuses.includes(order.status) && (!channels || channels.includes(order.channel ?? "dine_in"))),
        usingDemoData: true,
      };
    }

    const fallback = (fallbackRows.data ?? []) as Array<
      OrderRow & { items: OrderItem[] | null; tables: { table_number: number; name?: string | null } | { table_number: number; name?: string | null }[] | null }
    >;
    return {
      orders: fallback.map((row) => ({
        id: row.id,
        check_number: row.check_number ?? null,
        branch_id: row.branch_id ?? null,
        table_id: row.table_id,
        table_number: getTableNumber(row.tables),
        table_name: getTableName(row.tables),
        table_zone_name: getTableZoneName(row.tables),
        channel: row.channel ?? "dine_in",
        customer_name: row.customer_name ?? null,
        customer_phone: row.customer_phone ?? null,
        delivery_address: row.delivery_address ?? null,
        delivery_note: row.delivery_note ?? null,
        courier_id: row.courier_id ?? null,
        courier_name: row.courier_name ?? null,
        courier_phone: row.courier_phone ?? null,
        fulfillment_status: row.fulfillment_status ?? "not_applicable",
        amount_paid: toMoney(paymentSummary.get(row.id)?.net ?? 0),
        remaining_balance: toMoney(
          Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
        ),
        payment_count: paymentSummary.get(row.id)?.count ?? 0,
        items: row.items ?? [],
        total_price: row.total_price,
        discount_amount: Number(row.discount_amount ?? 0),
        service_fee: Number(row.service_fee ?? 0),
        final_price: Number(row.final_price ?? row.total_price),
        status: row.status,
        station_statuses: parseOrderStationStatuses((row as { station_statuses?: unknown }).station_statuses),
        created_at: row.created_at,
      })),
      usingDemoData: false,
    };
  }

  const groupedItems = buildGroupedOrderItems(
    ((itemRows ?? []) as OrderItemRow[]),
    ((modifierRows ?? []) as OrderItemModifierRow[]),
  );

  return {
    orders: mapDetailedOrders(orders, groupedItems, paymentSummary),
    usingDemoData: false,
  };
}

export async function getKitchenOrdersSnapshot() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      orders: demoOrders.filter((order) => ["pending", "preparing", "ready", "served", "partially_paid"].includes(order.status)),
      usingDemoData: true,
    };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { orders: [] as Order[], usingDemoData: false };
  }

  const cached = await getCachedKitchenOrdersSnapshot({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });

  if (cached && !cached.hasError) {
    return {
      orders: cached.orders,
      usingDemoData: false,
    };
  }

  const fallback = await listOrders(["pending", "preparing", "ready", "served", "partially_paid"], { includePaymentSummary: false });
  return {
    orders: fallback.orders,
    usingDemoData: fallback.usingDemoData,
  };
}

const CASHIER_HISTORY_FILTERABLE_STATUSES: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "served",
  "partially_paid",
  "paid",
  "partially_refunded",
  "cancelled",
  "refunded",
];

function normalizeDateInput(value: string | undefined, edge: "start" | "end") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const time = edge === "start" ? "T00:00:00.000+03:00" : "T23:59:59.999+03:00";
  const parsed = new Date(`${value}${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function resolveHistoryStatusFilter(value: string | undefined) {
  if (!value || value === "all") {
    return "all" as const;
  }
  return CASHIER_HISTORY_FILTERABLE_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : "all";
}

export async function getCashierPageSnapshot(
  selectedOrderId?: string,
  options?: {
    historyStatus?: string;
    historyFrom?: string;
    historyTo?: string;
  },
) {
  const cashierOpenScope = (process.env.CASHIER_OPEN_SCOPE ?? "all_open").toLowerCase();
  const businessScope = await AppContextCore.getDefaultBusinessScope();
  const operatingProfile = resolveOperatingProfile(businessScope?.activeBusinessType);
  const isSelfServiceCoffee = operatingProfile === "coffee_self_service";
  const cashierOpenLimit = Math.max(
    12,
    Number.parseInt(process.env.CASHIER_OPEN_LIMIT ?? (isSelfServiceCoffee ? "18" : "24"), 10) ||
      (isSelfServiceCoffee ? 18 : 24),
  );
  const cashierPaidLimit = Math.max(4, Number.parseInt(process.env.CASHIER_PAID_LIMIT ?? "6", 10) || 6);
  const cashierHistoryLimit = Math.max(
    20,
    Number.parseInt(process.env.CASHIER_HISTORY_LIMIT ?? (isSelfServiceCoffee ? "40" : "100"), 10) ||
      (isSelfServiceCoffee ? 40 : 100),
  );
  const openStatuses: OrderStatus[] =
    cashierOpenScope === "served_only" ? ["ready", "served", "partially_paid"] : ["pending", "preparing", "ready", "served", "partially_paid"];
  const historyStatusFilter = resolveHistoryStatusFilter(options?.historyStatus);
  const historyFromDate = normalizeDateInput(options?.historyFrom, "start");
  const historyToDate = normalizeDateInput(options?.historyTo, "end");

  let servedResult: { orders: Order[]; usingDemoData: boolean };
  let paidResult: { orders: Order[]; usingDemoData: boolean };
  let historyResult: { orders: Order[]; usingDemoData: boolean };
  let selectedOrderResult: { order: Order | null; usingDemoData: boolean };
  try {
    [servedResult, paidResult, historyResult, selectedOrderResult] = await Promise.all([
      listOrders(openStatuses, {
        includeItems: false,
        includePaymentSummary: true,
        includeStationStatuses: false,
        channels: isSelfServiceCoffee ? ["pickup"] : undefined,
        limit: cashierOpenLimit,
        ascending: false,
      }),
      isSelfServiceCoffee
        ? Promise.resolve({ orders: [] as Order[], usingDemoData: false })
        : listOrders(["paid"], {
            includeItems: false,
            includePaymentSummary: true,
            includeStationStatuses: false,
            limit: cashierPaidLimit,
            ascending: false,
          }),
      listOrders(
        ["pending", "preparing", "ready", "served", "partially_paid", "paid", "partially_refunded", "cancelled", "refunded"],
        {
          includeItems: false,
          includePaymentSummary: true,
          includeStationStatuses: false,
          channels: ["pickup"],
          limit: cashierHistoryLimit,
          ascending: false,
        },
      ),
      typeof selectedOrderId === "string"
        ? getOrderReceipt(selectedOrderId)
        : Promise.resolve({ order: null as Order | null, usingDemoData: false }),
    ]);
  } catch (error) {
    console.error("[cashier.snapshot] primary snapshot query failed", {
      error: error instanceof Error ? error.message : "unknown",
      selectedOrderId: selectedOrderId ?? null,
      isSelfServiceCoffee,
    });
    try {
      [servedResult, paidResult, historyResult, selectedOrderResult] = await Promise.all([
        listOrders(openStatuses, {
          includeItems: false,
          includePaymentSummary: false,
          includeStationStatuses: false,
          channels: isSelfServiceCoffee ? ["pickup"] : undefined,
          limit: cashierOpenLimit,
          ascending: false,
        }),
        isSelfServiceCoffee
          ? Promise.resolve({ orders: [] as Order[], usingDemoData: false })
          : listOrders(["paid"], {
              includeItems: false,
              includePaymentSummary: false,
              includeStationStatuses: false,
              limit: cashierPaidLimit,
              ascending: false,
            }),
        listOrders(
          ["pending", "preparing", "ready", "served", "partially_paid", "paid", "partially_refunded", "cancelled", "refunded"],
          {
            includeItems: false,
            includePaymentSummary: false,
            includeStationStatuses: false,
            channels: ["pickup"],
            limit: cashierHistoryLimit,
            ascending: false,
          },
        ),
        typeof selectedOrderId === "string"
          ? getOrderReceipt(selectedOrderId)
          : Promise.resolve({ order: null as Order | null, usingDemoData: false }),
      ]);
    } catch (fallbackError) {
      console.error("[cashier.snapshot] fallback snapshot query failed", {
        error: fallbackError instanceof Error ? fallbackError.message : "unknown",
        selectedOrderId: selectedOrderId ?? null,
        isSelfServiceCoffee,
      });
      servedResult = { orders: [], usingDemoData: false };
      paidResult = { orders: [], usingDemoData: false };
      historyResult = { orders: [], usingDemoData: false };
      selectedOrderResult = { order: null, usingDemoData: false };
    }
  }

  const servedWithPayments = servedResult.orders;
  const paidWithPayments = paidResult.orders.map((order) =>
    order.status === "cancelled" || order.status === "refunded"
      ? order
      : { ...order, status: "paid" as OrderStatus },
  );
  const autoSettledFromOpen = servedWithPayments
    .filter(
      (order) =>
        !isSelfServiceCoffee &&
        Number(order.remaining_balance ?? Number(order.final_price ?? order.total_price)) <= 0.009 &&
        order.status !== "cancelled" &&
        order.status !== "refunded",
    )
    .map((order) => ({ ...order, status: "paid" as OrderStatus }));
  const servedOrders = servedWithPayments.filter(
    (order) =>
      (isSelfServiceCoffee || Number(order.remaining_balance ?? Number(order.final_price ?? order.total_price)) > 0.009) &&
      order.status !== "paid" &&
      order.status !== "cancelled" &&
      order.status !== "refunded",
  );
  const paidOrderMap = new Map<string, Order>(
    [...paidWithPayments, ...autoSettledFromOpen].map((order) => [order.id, order]),
  );
  const normalizedPaidOrders = Array.from(paidOrderMap.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);
  const activePickupOrders = servedWithPayments.filter(
    (order) =>
      order.channel === "pickup" &&
      order.status !== "paid" &&
      order.status !== "cancelled" &&
      order.status !== "refunded",
  );
  const historyPickupOrders = historyResult.orders
    .filter((order) => order.channel === "pickup")
    .filter((order) => (historyStatusFilter === "all" ? true : order.status === historyStatusFilter))
    .filter((order) => {
      if (!historyFromDate && !historyToDate) {
        return true;
      }
      const createdAt = new Date(order.created_at);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }
      if (historyFromDate && createdAt < historyFromDate) {
        return false;
      }
      if (historyToDate && createdAt > historyToDate) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    servedOrders,
    paidOrders: normalizedPaidOrders,
    activePickupOrders,
    historyPickupOrders,
    selectedOrder: selectedOrderResult.order,
    usingDemoData:
      servedResult.usingDemoData ||
      paidResult.usingDemoData ||
      historyResult.usingDemoData ||
      selectedOrderResult.usingDemoData,
  };
}

export async function getDeliveryPageSnapshot(selectedOrderId?: string) {
  const deliveryBoardLimit = Math.max(20, Number.parseInt(process.env.DELIVERY_BOARD_LIMIT ?? "50", 10) || 50);
  const [ordersResult, couriersResult, selectedOrderResult] = await Promise.all([
    listOrders(["pending", "preparing", "ready", "served"], {
      includeItems: false,
      includePaymentSummary: false,
      includeStationStatuses: false,
      channels: ["delivery"],
      limit: deliveryBoardLimit,
      ascending: false,
    }),
    listCouriers(),
    typeof selectedOrderId === "string"
      ? getOrderReceipt(selectedOrderId)
      : Promise.resolve({ order: null as Order | null, usingDemoData: false }),
  ]);

  return {
    orders: ordersResult.orders,
    couriers: couriersResult.couriers,
    selectedOrder: selectedOrderResult.order,
    usingDemoData: ordersResult.usingDemoData || couriersResult.usingDemoData || selectedOrderResult.usingDemoData,
  };
}

export async function getKitchenPageSnapshot() {
  const ordersResult = await getKitchenOrdersSnapshot();
  if (ordersResult.orders.length === 0) {
    return {
      orders: ordersResult.orders,
      categories: [] as Array<Pick<Category, "id" | "name" | "prep_station">>,
      products: [] as Array<Pick<Product, "id" | "category_id">>,
      usingDemoData: ordersResult.usingDemoData,
    };
  }

  const catalogResult = await getKitchenCatalogSnapshot();
  const knownProductIds = new Set(catalogResult.products.map((product) => product.id));
  const orderedProductIds = Array.from(
    new Set(
      ordersResult.orders
        .flatMap((order) => order.items.map((item) => item.product_id))
        .filter((productId): productId is string => Boolean(productId) && productId !== "unknown-product"),
    ),
  );
  const missingProductIds = orderedProductIds.filter((productId) => !knownProductIds.has(productId));

  if (missingProductIds.length === 0) {
    return {
      orders: ordersResult.orders,
      categories: catalogResult.categories,
      products: catalogResult.products,
      usingDemoData: ordersResult.usingDemoData || catalogResult.usingDemoData,
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      orders: ordersResult.orders,
      categories: catalogResult.categories,
      products: catalogResult.products,
      usingDemoData: ordersResult.usingDemoData || catalogResult.usingDemoData,
    };
  }

  const { data: missingProducts, error: missingProductsError } = await supabase
    .from("products")
    .select("id, category_id")
    .in("id", missingProductIds);

  if (missingProductsError) {
    return {
      orders: ordersResult.orders,
      categories: catalogResult.categories,
      products: catalogResult.products,
      usingDemoData: ordersResult.usingDemoData || catalogResult.usingDemoData,
    };
  }

  const hydratedProducts = [
    ...catalogResult.products,
    ...((missingProducts ?? []) as Array<Pick<Product, "id" | "category_id">>).filter((product) => !knownProductIds.has(product.id)),
  ];
  const knownCategoryIds = new Set(catalogResult.categories.map((category) => category.id));
  const missingCategoryIds = Array.from(
    new Set(
      ((missingProducts ?? []) as Array<Pick<Product, "id" | "category_id">>)
        .map((product) => product.category_id)
        .filter((categoryId): categoryId is string => Boolean(categoryId) && !knownCategoryIds.has(categoryId)),
    ),
  );

  if (missingCategoryIds.length === 0) {
    return {
      orders: ordersResult.orders,
      categories: catalogResult.categories,
      products: hydratedProducts,
      usingDemoData: ordersResult.usingDemoData || catalogResult.usingDemoData,
    };
  }

  const { data: missingCategories, error: missingCategoriesError } = await supabase
    .from("categories")
    .select("id, name, prep_station")
    .in("id", missingCategoryIds);

  return {
    orders: ordersResult.orders,
    categories: missingCategoriesError
      ? catalogResult.categories
      : [
          ...catalogResult.categories,
          ...((missingCategories ?? []) as Array<Pick<Category, "id" | "name" | "prep_station">>).filter(
            (category) => !knownCategoryIds.has(category.id),
          ),
        ],
    products: hydratedProducts,
    usingDemoData: ordersResult.usingDemoData || catalogResult.usingDemoData,
  };
}

export async function listLatestOrdersByTableIds(tableIds: string[]) {
  return listLatestOrdersByTableIdsImpl(tableIds, {
    getDefaultBusinessScope,
    getOrderPaymentSummaryMap,
    withQueryTimeout,
    demoOrders,
    demoTables,
  });
}

export async function getLatestOrderByTableId(tableId: string) {
  const { ordersByTableId, usingDemoData } = await listLatestOrdersByTableIds([tableId]);
  const order = ordersByTableId.get(tableId) ?? null;
  if (!order) {
    return { order: null, usingDemoData };
  }

  if (["paid", "cancelled", "refunded"].includes(order.status)) {
    return { order: null, usingDemoData };
  }

  return { order, usingDemoData };
}

export async function getOrderHistoryByTableId(tableId: string, limit = 5) {
  return getOrderHistoryByTableIdImpl(tableId, limit, {
    getDefaultBusinessScope,
    getOrderPaymentSummaryMap,
    withQueryTimeout,
    demoOrders,
    demoTables,
  });
}

export async function getOrderReceipt(orderId: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    const order = demoOrders.find((row) => row.id === orderId) ?? null;
    return { order, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { order: null as Order | null, usingDemoData: false };
  }

  const cached = await getCachedOrderReceiptRow({
    orderId,
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  if (cached && !cached.hasError) {
    return { order: cached.order, usingDemoData: false };
  }

  let orderQuery = supabase
    .from("orders")
    .select("id, check_number, table_id, station_statuses, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number,name,table_zones(name))")
    .eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    orderQuery = orderQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    orderQuery = orderQuery.eq("branch_id", scope.branchId);
  }

  const { data, error } = await orderQuery.maybeSingle();

  if (error || !data) {
    return { order: null as Order | null, usingDemoData: false };
  }

  const [paymentSummary, { data: itemRows }, { data: modifierRows }] = await Promise.all([
    getOrderPaymentSummaryMap(supabase, [orderId]),
    supabase
      .from("order_items")
      .select("product_id, product_name, quantity, unit_price, line_total")
      .eq("order_id", orderId),
    supabase
      .from("order_item_modifiers")
      .select("product_id, product_name, modifier_group_name, modifier_option_name, price_delta, quantity")
      .eq("order_id", orderId),
  ]);

  const tableInfo = data.tables as OrderTableRelation;
  const tableNumber = Array.isArray(tableInfo) ? tableInfo[0]?.table_number : tableInfo?.table_number;
  const tableName = Array.isArray(tableInfo) ? tableInfo[0]?.name ?? null : tableInfo?.name ?? null;
  const groupedModifiers = new Map<string, OrderItemModifierSelection[]>();
  for (const row of (modifierRows ?? []) as Array<{
    product_id: string | null;
    product_name: string;
    modifier_group_name: string;
    modifier_option_name: string;
    price_delta: number;
    quantity: number;
  }>) {
    const key = `${row.product_id ?? row.product_name}`;
    if (!groupedModifiers.has(key)) {
      groupedModifiers.set(key, []);
    }
    groupedModifiers.get(key)?.push({
      group_name: row.modifier_group_name,
      option_name: row.modifier_option_name,
      price_delta: Number(row.price_delta),
      quantity: Number(row.quantity),
    });
  }

  return {
    order: {
      id: data.id as string,
      check_number: (data.check_number as string | null) ?? null,
      table_id: (data.table_id as string | null) ?? null,
      table_number: tableNumber,
      table_name: tableName,
      table_zone_name: getTableZoneName(tableInfo),
      channel: (data.channel as OrderChannel | null) ?? "dine_in",
      customer_name: (data.customer_name as string | null) ?? null,
      customer_phone: (data.customer_phone as string | null) ?? null,
      delivery_address: (data.delivery_address as string | null) ?? null,
      delivery_note: (data.delivery_note as string | null) ?? null,
      courier_id: (data.courier_id as string | null) ?? null,
      courier_name: (data.courier_name as string | null) ?? null,
      courier_phone: (data.courier_phone as string | null) ?? null,
      fulfillment_status: (data.fulfillment_status as FulfillmentStatus | null) ?? "not_applicable",
      amount_paid: paymentSummary.get(orderId)?.net ?? 0,
      remaining_balance: Math.max(0, Number(data.final_price ?? data.total_price) - (paymentSummary.get(orderId)?.net ?? 0)),
      payment_count: paymentSummary.get(orderId)?.count ?? 0,
      items: ((itemRows ?? []) as Array<{
        product_id: string | null;
        product_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>).map((row) => ({
        product_id: row.product_id ?? "unknown-product",
        name: row.product_name,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        line_total: Number(row.line_total),
        modifiers: groupedModifiers.get(`${row.product_id ?? row.product_name}`) ?? [],
      })),
      total_price: Number(data.total_price),
      discount_amount: Number(data.discount_amount ?? 0),
      service_fee: Number(data.service_fee ?? 0),
      final_price: Number(data.final_price ?? data.total_price),
      status: data.status as OrderStatus,
      station_statuses: parseOrderStationStatuses((data as { station_statuses?: unknown }).station_statuses),
      created_at: data.created_at as string,
    } as Order,
    usingDemoData: false,
  };
}

function getTableNumber(
  tables: OrderTableRelation | undefined,
): number | undefined {
  if (!tables) {
    return undefined;
  }
  if (Array.isArray(tables)) {
    return tables[0]?.table_number;
  }
  return tables.table_number;
}

function getTableName(
  tables: OrderTableRelation | undefined,
): string | null {
  if (!tables) {
    return null;
  }
  if (Array.isArray(tables)) {
    return tables[0]?.name ?? null;
  }
  return tables.name ?? null;
}

function getTableZoneName(
  tables: OrderTableRelation | undefined,
): string | null {
  if (!tables) {
    return null;
  }
  const tableInfo = Array.isArray(tables) ? tables[0] : tables;
  if (!tableInfo?.table_zones) {
    return null;
  }
  const zoneInfo = Array.isArray(tableInfo.table_zones)
    ? tableInfo.table_zones[0]
    : tableInfo.table_zones;
  return zoneInfo?.name ?? null;
}

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: true, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, table_id, status, station_statuses, lock_version").eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Order not found" };
  }

  const currentStatus = (orderRow.status as OrderStatus | null) ?? "pending";
  if (!isAllowedOrderStatusTransition(currentStatus, nextStatus)) {
    return { ok: false, error: `GeÃƒÂ§ersiz sipariÃ…Å¸ gecisi: ${currentStatus} -> ${nextStatus}` };
  }

  const expectedLockVersion = Number((orderRow as { lock_version?: number | null }).lock_version ?? 0);
  const currentStationStatuses = parseOrderStationStatuses((orderRow as { station_statuses?: unknown }).station_statuses) ?? {};
  const shouldPromoteStationsToServed = nextStatus === "ready" || nextStatus === "served" || nextStatus === "partially_paid" || nextStatus === "paid";
  const normalizedStationStatuses = shouldPromoteStationsToServed
    ? ({
        kitchen: currentStationStatuses.kitchen ? "served" : undefined,
        bar: currentStationStatuses.bar ? "served" : undefined,
        dessert: currentStationStatuses.dessert ? "served" : undefined,
      } satisfies Partial<Record<PrepStation, OrderStationStatus>>)
    : undefined;
  const updatePayload: {
    status: OrderStatus;
    lock_version: number;
    station_statuses?: Partial<Record<PrepStation, OrderStationStatus>>;
  } = {
    status: nextStatus,
    lock_version: expectedLockVersion + 1,
  };
  if (normalizedStationStatuses) {
    updatePayload.station_statuses = normalizedStationStatuses;
  }

  let updateQuery = supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .eq("lock_version", expectedLockVersion)
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    updateQuery = updateQuery.eq("branch_id", scope.branchId);
  }
  const { data: updatedRows, error } = await updateQuery;
  if (error && isMissingLockVersionColumnError(error.message)) {
    let fallbackUpdateQuery = supabase.from("orders").update(updatePayload).eq("id", orderId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackUpdateQuery = fallbackUpdateQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      fallbackUpdateQuery = fallbackUpdateQuery.eq("branch_id", scope.branchId);
    }
    const fallbackResult = await fallbackUpdateQuery;
    if (fallbackResult.error) {
      return { ok: false, error: fallbackResult.error.message };
    }
  } else if (error) {
    return { ok: false, error: error.message };
  } else if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: "SipariÃ…Å¸ baska bir kullanÃ„Â±cÃ„Â± tarafindan gÃƒÂ¼ncellendi. LÃƒÂ¼tfen tekrar deneyin." };
  }

  if (nextStatus === "paid") {
    if (orderRow.table_id) {
      await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", orderRow.table_id);
    }
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "status_change",
    details: { nextStatus },
  });

  revalidateOrderFlowCaches();
  if (nextStatus === "paid") {
    revalidateTag("table-map", "max");
    revalidateReportCaches();
  }
  return { ok: true, usingDemoData: false };
}

export async function updateOrderStationStatus(
  orderId: string,
  station: PrepStation,
  nextStationStatus: OrderStationStatus,
) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: true, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase
    .from("orders")
    .select("id, status, station_statuses, lock_version")
    .eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }

  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError) {
    if (isMissingStationStatusesColumnError(findError.message)) {
      return updateOrderStatus(orderId, nextStationStatus);
    }
    return { ok: false, error: findError.message };
  }
  if (!orderRow) {
    return { ok: false, error: "Order not found" };
  }

  const currentStatus = (orderRow.status as OrderStatus | null) ?? "pending";
  if (currentStatus === "paid" || currentStatus === "cancelled" || currentStatus === "refunded") {
    return { ok: false, error: "Kapali sipariste istasyon durumu degistirilemez." };
  }

  const stationStatuses: Partial<Record<PrepStation, OrderStationStatus>> = {
    ...(parseOrderStationStatuses((orderRow as { station_statuses?: unknown }).station_statuses) ?? {}),
    [station]: nextStationStatus,
  };
  const aggregateStatus =
    currentStatus === "partially_paid" || currentStatus === "partially_refunded"
      ? currentStatus
      : deriveOrderStatusFromStationStatuses(stationStatuses, currentStatus);
  if (!isAllowedOrderStatusTransition(currentStatus, aggregateStatus)) {
    return { ok: false, error: `GeÃƒÂ§ersiz sipariÃ…Å¸ gecisi: ${currentStatus} -> ${aggregateStatus}` };
  }
  const expectedLockVersion = Number((orderRow as { lock_version?: number | null }).lock_version ?? 0);

  let updateQuery = supabase
    .from("orders")
    .update({
      station_statuses: stationStatuses,
      status: aggregateStatus,
      lock_version: expectedLockVersion + 1,
    })
    .eq("id", orderId)
    .eq("lock_version", expectedLockVersion)
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    updateQuery = updateQuery.eq("branch_id", scope.branchId);
  }
  const { data: updatedRows, error: updateError } = await updateQuery;
  if (updateError) {
    if (isMissingStationStatusesColumnError(updateError.message)) {
      return updateOrderStatus(orderId, nextStationStatus);
    }
    if (isMissingLockVersionColumnError(updateError.message)) {
      let fallbackUpdateQuery = supabase
        .from("orders")
        .update({
          station_statuses: stationStatuses,
          status: aggregateStatus,
        })
        .eq("id", orderId);
      if (!scope.useLegacySchema && scope.businessId) {
        fallbackUpdateQuery = fallbackUpdateQuery.eq("business_id", scope.businessId);
      }
      if (scope.branchId) {
        fallbackUpdateQuery = fallbackUpdateQuery.eq("branch_id", scope.branchId);
      }
      const fallbackResult = await fallbackUpdateQuery;
      if (fallbackResult.error) {
        return { ok: false, error: fallbackResult.error.message };
      }
      fireAndForgetAuditEvent({
        entityType: "order",
        entityId: orderId,
        action: "station_status_change",
        details: { station, nextStationStatus, aggregateStatus },
      });
      revalidateOrderFlowCaches();
      return { ok: true, usingDemoData: false };
    }
    return { ok: false, error: updateError.message };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: "SipariÃ…Å¸ baska bir kullanÃ„Â±cÃ„Â± tarafindan gÃƒÂ¼ncellendi. LÃƒÂ¼tfen tekrar deneyin." };
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "station_status_change",
    details: { station, nextStationStatus, aggregateStatus },
  });

  revalidateOrderFlowCaches();
  return { ok: true, usingDemoData: false };
}

export async function applyOrderFinancials(input: {
  orderId: string;
  discountAmount: number;
  serviceFee: number;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda finansal guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, total_price, lock_version").eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "SipariÃ…Å¸ bulunamadi." };
  }

  const subtotal = Number(orderRow.total_price);
  const discountAmount = Math.max(0, Number(input.discountAmount || 0));
  const serviceFee = Math.max(0, Number(input.serviceFee || 0));
  const finalPrice = Math.max(0, subtotal - discountAmount + serviceFee);

  let financialQuery = supabase
    .from("orders")
    .update({
      discount_amount: discountAmount,
      service_fee: serviceFee,
      final_price: finalPrice,
      lock_version: Number((orderRow as { lock_version?: number | null }).lock_version ?? 0) + 1,
    })
    .eq("id", input.orderId)
    .eq("lock_version", Number((orderRow as { lock_version?: number | null }).lock_version ?? 0))
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    financialQuery = financialQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    financialQuery = financialQuery.eq("branch_id", scope.branchId);
  }
  const { data: financialRows, error } = await financialQuery;
  if (error && isMissingLockVersionColumnError(error.message)) {
    let fallbackFinancialQuery = supabase
      .from("orders")
      .update({
        discount_amount: discountAmount,
        service_fee: serviceFee,
        final_price: finalPrice,
      })
      .eq("id", input.orderId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackFinancialQuery = fallbackFinancialQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      fallbackFinancialQuery = fallbackFinancialQuery.eq("branch_id", scope.branchId);
    }
    const fallbackResult = await fallbackFinancialQuery;
    if (fallbackResult.error) {
      return { ok: false, error: fallbackResult.error.message };
    }
  } else if (error) {
    return { ok: false, error: error.message };
  } else if (!financialRows || financialRows.length === 0) {
    return { ok: false, error: "SipariÃ…Å¸ baska bir kullanÃ„Â±cÃ„Â± tarafindan gÃƒÂ¼ncellendi. LÃƒÂ¼tfen tekrar deneyin." };
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: input.orderId,
    action: "financial_update",
    details: { discountAmount, serviceFee, finalPrice },
  });

  revalidateOrderFlowCaches();
  revalidateTag("table-map", "max");
  revalidateReportCaches();
  return { ok: true, finalPrice };
}

export async function completeOrderPayment(input: {
  orderId: string;
  method: PaymentMethod;
  amount?: number;
  note?: string;
  createdBy?: string;
  requestKey?: string;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda ÃƒÂ¶deme iÃ…Å¸lemi pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase
    .from("orders")
    .select("id, table_id, final_price, total_price, status")
    .eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "SipariÃ…Å¸ bulunamadi." };
  }
  if (orderRow.status === "cancelled" || orderRow.status === "refunded" || orderRow.status === "partially_refunded") {
    return { ok: false, error: "Iptal veya iade edilmis siparise ÃƒÂ¶deme eklenemez." };
  }
  const requestKey = typeof input.requestKey === "string" && input.requestKey.trim() ? input.requestKey.trim() : null;
  const requestedAmount = Number.isFinite(Number(input.amount))
    ? toMoney(Math.max(0, Number(input.amount)))
    : null;
  if (requestedAmount !== null && requestedAmount <= 0) {
    return { ok: false, error: "Ãƒâ€“deme tutari sifirdan buyuk olmali." };
  }

  const paymentMutationRpcResult = await supabase.rpc("apply_order_payment_mutation", {
    p_order_id: input.orderId,
    p_payment_type: "sale",
    p_method: input.method,
    p_amount: requestedAmount,
    p_note: input.note ?? null,
    p_created_by: input.createdBy ?? null,
    p_idempotency_key: requestKey,
    p_business_id: scope.businessId,
    p_branch_id: scope.branchId,
  });
  const rpcPaymentRow = parsePaymentMutationRpcRow(
    ((paymentMutationRpcResult.data as Array<Record<string, unknown>> | null) ?? [])[0] ?? null,
  );
  if (!paymentMutationRpcResult.error && rpcPaymentRow) {
    const outcome = resolvePaymentMutationOutcome({ row: rpcPaymentRow, paymentType: "sale" });
    if (!outcome.ok) {
      if (rpcPaymentRow.conflictReason === "CONCURRENT_UPDATE") {
        await setAlertDispatch("duplicate_payment_counter", {
          orderId: input.orderId,
          reason: rpcPaymentRow.conflictReason,
          at: new Date().toISOString(),
        });
      }
      return { ok: false, error: outcome.error };
    }

    if (outcome.idempotent) {
      await setAlertDispatch("duplicate_payment_counter", {
        orderId: input.orderId,
        requestKey,
        status: outcome.status,
        amountPaid: outcome.amountPaid,
        remaining: outcome.remaining,
        at: new Date().toISOString(),
      });
    }
    fireAndForgetAuditEvent({
      entityType: "payment",
      entityId: input.orderId,
      action: outcome.idempotent ? "complete_payment_idempotent" : "complete_payment",
      details: {
        method: input.method,
        amount: requestedAmount,
        nextPaidTotal: outcome.amountPaid,
        remaining: outcome.remaining,
      },
    });
    revalidateOrderFlowCaches();
    revalidateTag("table-map", "max");
    revalidateReportCaches();
    return {
      ok: true,
      idempotent: outcome.idempotent,
      status: outcome.status,
      amountPaid: outcome.amountPaid,
      remaining: outcome.remaining,
    };
  }
  if (paymentMutationRpcResult.error && !isMissingRpcFunctionError(paymentMutationRpcResult.error.message, "apply_order_payment_mutation")) {
    return { ok: false, error: paymentMutationRpcResult.error.message };
  }

  const paymentSummary = await getOrderPaymentSummaryMap(supabase, [input.orderId]);
  const alreadyPaid = toMoney(paymentSummary.get(input.orderId)?.net ?? 0);
  const targetAmount = toMoney(Number(orderRow.final_price ?? orderRow.total_price));
  const remaining = toMoney(Math.max(0, targetAmount - alreadyPaid));
  const amount = toMoney(Math.max(0, Number(input.amount ?? remaining)));
  if (amount <= 0) {
    return { ok: false, error: "Ãƒâ€“deme tutari sifirdan buyuk olmali." };
  }
  if (toMoney(amount - remaining) > 0) {
    return { ok: false, error: "Ãƒâ€“deme tutari kalan bakiyeden buyuk olamaz." };
  }
  if (requestKey) {
    let idempotencyLookup = supabase
      .from("payments")
      .select("id")
      .eq("order_id", input.orderId)
      .eq("payment_type", "sale")
      .eq("idempotency_key", requestKey)
      .limit(1);
    if (!scope.useLegacySchema && scope.businessId) {
      idempotencyLookup = idempotencyLookup.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      idempotencyLookup = idempotencyLookup.eq("branch_id", scope.branchId);
    }
    const { data: existingPayment, error: idempotencyError } = await idempotencyLookup.maybeSingle();
    if (!idempotencyError && existingPayment) {
      const reconciled = await reconcileOrderSettlementState({
        supabase,
        scope,
        orderId: input.orderId,
        targetAmount,
        tableId: orderRow.table_id,
        allowRefunded: false,
      });
      if (!reconciled.ok) {
        await setAlertDispatch("payment_status_reconcile_failed", {
          orderId: input.orderId,
          flow: "complete_payment_idempotent",
          nextStatus: reconciled.status,
          targetAmount,
          nextPaidTotal: reconciled.amountPaid,
          error: reconciled.error,
          at: new Date().toISOString(),
        });
      }
      return {
        ok: true,
        idempotent: true,
        status: reconciled.status,
        amountPaid: reconciled.amountPaid,
        remaining: reconciled.remaining,
      };
    }
  }

  const withBusinessPayment = {
    business_id: scope.businessId,
    branch_id: scope.branchId,
    order_id: input.orderId,
    payment_type: "sale",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
    idempotency_key: requestKey,
  };
  const fallbackPayment = {
    order_id: input.orderId,
    payment_type: "sale",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
    idempotency_key: requestKey,
  };
  let paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
  if (
    paymentInsert.error?.message?.toLowerCase().includes("business_id") ||
    paymentInsert.error?.message?.toLowerCase().includes("idempotency_key")
  ) {
    paymentInsert = await supabase.from("payments").insert(fallbackPayment);
  }
  const paymentError = paymentInsert.error;
  if (paymentError) {
    if (paymentError.message.toLowerCase().includes("duplicate key") && requestKey) {
      const reconciled = await reconcileOrderSettlementState({
        supabase,
        scope,
        orderId: input.orderId,
        targetAmount,
        tableId: orderRow.table_id,
        allowRefunded: false,
      });
      if (!reconciled.ok) {
        await setAlertDispatch("payment_status_reconcile_failed", {
          orderId: input.orderId,
          flow: "complete_payment_duplicate",
          nextStatus: reconciled.status,
          targetAmount,
          nextPaidTotal: reconciled.amountPaid,
          error: reconciled.error,
          at: new Date().toISOString(),
        });
      }
      return {
        ok: true,
        idempotent: true,
        status: reconciled.status,
        amountPaid: reconciled.amountPaid,
        remaining: reconciled.remaining,
      };
    }
    return { ok: false, error: paymentError.message };
  }

  const reconciled = await reconcileOrderSettlementState({
    supabase,
    scope,
    orderId: input.orderId,
    targetAmount,
    tableId: orderRow.table_id,
    allowRefunded: false,
  });
  if (!reconciled.ok) {
    await setAlertDispatch("payment_status_reconcile_failed", {
      orderId: input.orderId,
      flow: "complete_payment",
      nextStatus: reconciled.status,
      targetAmount,
      nextPaidTotal: reconciled.amountPaid,
      error: reconciled.error,
      at: new Date().toISOString(),
    });
    return { ok: false, error: reconciled.error };
  }
  fireAndForgetAuditEvent({
    entityType: "payment",
    entityId: input.orderId,
    action: "complete_payment",
    details: { method: input.method, amount, nextPaidTotal: reconciled.amountPaid, remaining: reconciled.remaining },
  });
  revalidateOrderFlowCaches();
  revalidateTag("table-map", "max");
  revalidateReportCaches();
  return { ok: true, status: reconciled.status, amountPaid: reconciled.amountPaid, remaining: reconciled.remaining };
}

export async function cancelOrder(orderId: string, note?: string, requestKey?: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda iptal pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, table_id, status").eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "SipariÃ…Å¸ bulunamadi." };
  }
  const normalizedRequestKey = typeof requestKey === "string" && requestKey.trim() ? requestKey.trim() : null;
  if (normalizedRequestKey) {
    let idempotencyLookup = supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("payment_type", "sale")
      .eq("amount", 0)
      .eq("idempotency_key", normalizedRequestKey)
      .limit(1);
    if (!scope.useLegacySchema && scope.businessId) {
      idempotencyLookup = idempotencyLookup.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      idempotencyLookup = idempotencyLookup.eq("branch_id", scope.branchId);
    }
    const { data: existingCancelNote, error: idempotencyError } = await idempotencyLookup.maybeSingle();
    if (!idempotencyError && existingCancelNote) {
      return { ok: true, idempotent: true };
    }
  }
  if (orderRow.status === "paid" || orderRow.status === "partially_paid" || orderRow.status === "partially_refunded") {
    return { ok: false, error: "Ãƒâ€“deme alinmis sipariÃ…Å¸ iptal edilemez. Iade akisini kullanin." };
  }
  const paymentSummary = await getOrderPaymentSummaryMap(supabase, [orderId]);
  const netPaid = paymentSummary.get(orderId)?.net ?? 0;
  if (netPaid > 0) {
    return { ok: false, error: "Bu sipariste tahsilat var. Iptal yerine iade yapin." };
  }

  const cancelResult = await retryMutation(async () => {
    let cancelQuery = supabase.from("orders").update({ status: "cancelled" as OrderStatus }).eq("id", orderId);
    if (!scope.useLegacySchema && scope.businessId) {
      cancelQuery = cancelQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      cancelQuery = cancelQuery.eq("branch_id", scope.branchId);
    }
    return cancelQuery;
  });
  if (cancelResult.error) {
    await setAlertDispatch("payment_status_reconcile_failed", {
      orderId,
      flow: "cancel",
      nextStatus: "cancelled",
      error: cancelResult.error.message,
      at: new Date().toISOString(),
    });
    return { ok: false, error: cancelResult.error.message };
  }

  if (orderRow.table_id) {
    await retryMutation(async () => supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", orderRow.table_id));
  }
  if (note) {
    const withBusinessPayment = {
      business_id: scope.businessId,
      branch_id: scope.branchId,
      order_id: orderId,
      payment_type: "sale",
      method: "cash" as PaymentMethod,
      amount: 0,
      note: `cancel_note:${note}`,
      idempotency_key: normalizedRequestKey,
    };
    const fallbackPayment = {
      order_id: orderId,
      payment_type: "sale",
      method: "cash" as PaymentMethod,
      amount: 0,
      note: `cancel_note:${note}`,
      idempotency_key: normalizedRequestKey,
    };
    const paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
    if (
      paymentInsert.error?.message?.toLowerCase().includes("business_id") ||
      paymentInsert.error?.message?.toLowerCase().includes("idempotency_key")
    ) {
      await supabase.from("payments").insert(fallbackPayment);
    }
  }
  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "cancel",
    details: { note: note ?? null },
  });
  revalidateOrderFlowCaches();
  revalidateTag("table-map", "max");
  revalidateReportCaches();
  return { ok: true };
}

export async function cancelOrderItem(orderId: string, productId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda iÃ…Å¸lem pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, status, items, total_price, final_price").eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }

  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "SipariÃ…Å¸ bulunamadi." };
  }

  if (orderRow.status === "paid" || orderRow.status === "cancelled" || orderRow.status === "refunded") {
    return { ok: false, error: "Kapanmis veya iptal edilmis bir adisyondan ÃƒÂ¼rÃƒÂ¼n silinemez." };
  }

  const items = Array.isArray(orderRow.items) ? (orderRow.items as OrderItem[]) : [];
  const targetIndex = items.findIndex((item) => item.product_id === productId);
  if (targetIndex === -1) {
    return { ok: false, error: "ÃƒÅ“rÃƒÂ¼n adisyonda bulunamadi." };
  }

  const itemToEdit = items[targetIndex];
  const unitPrice = Number(itemToEdit.unit_price) || 0;
  let unitCostSnapshot = 0;
  const unitCostLookup = await supabase
    .from("order_items")
    .select("unit_cost_snapshot")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();
  if (!unitCostLookup.error) {
    unitCostSnapshot = Math.max(0, Number(
      (unitCostLookup.data as { unit_cost_snapshot?: number | null } | null)?.unit_cost_snapshot ?? 0,
    ));
  }
  
  if (itemToEdit.quantity <= 1) {
    items.splice(targetIndex, 1);
    await retryMutation(async () => supabase.from("order_items").delete().eq("order_id", orderId).eq("product_id", productId));
  } else {
    itemToEdit.quantity -= 1;
    itemToEdit.line_total = Number(itemToEdit.line_total) - unitPrice;
    const nextLineCostSnapshot = toScaled(Math.max(0, unitCostSnapshot) * Math.max(0, Number(itemToEdit.quantity)), 4);
    const orderItemUpdate = await retryMutation(async () => supabase.from("order_items").update({
      quantity: itemToEdit.quantity,
      line_total: itemToEdit.line_total,
      line_cost_snapshot: nextLineCostSnapshot,
    }).eq("order_id", orderId).eq("product_id", productId));
    if (orderItemUpdate.error?.message?.toLowerCase().includes("line_cost_snapshot")) {
      await retryMutation(async () => supabase.from("order_items").update({
        quantity: itemToEdit.quantity,
        line_total: itemToEdit.line_total,
      }).eq("order_id", orderId).eq("product_id", productId));
    }
  }
  
  const newTotalPrice = Math.max(0, Number(orderRow.total_price) - unitPrice);
  const newFinalPrice = Math.max(0, Number(orderRow.final_price) - unitPrice);

  const updateResult = await retryMutation(async () => {
    let updateQuery = supabase.from("orders").update({
      items: items,
      total_price: newTotalPrice,
      final_price: newFinalPrice
    }).eq("id", orderId);
    if (!scope.useLegacySchema && scope.businessId) {
      updateQuery = updateQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      updateQuery = updateQuery.eq("branch_id", scope.branchId);
    }
    return updateQuery;
  });

  if (updateResult.error) {
    return { ok: false, error: "SipariÃ…Å¸ gÃƒÂ¼ncellenemedi." };
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "update",
    details: { note: "ÃƒÅ“rÃƒÂ¼n iptal edildi/dusuruldu", productId }
  });

  revalidateOrderFlowCaches();
  revalidateTag("table-map", "max");
  revalidateReportCaches();
  return { ok: true, remainingItems: items.length };
}

export async function refundOrder(input: {
  orderId: string;
  method: PaymentMethod;
  amount?: number;
  note?: string;
  createdBy?: string;
  requestKey?: string;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda iade pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase
    .from("orders")
    .select("id, final_price, total_price, status")
    .eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "SipariÃ…Å¸ bulunamadi." };
  }
  if (orderRow.status === "cancelled") {
    return { ok: false, error: "Iptal edilmis siparise iade eklenemez." };
  }
  const requestKey = typeof input.requestKey === "string" && input.requestKey.trim() ? input.requestKey.trim() : null;
  const requestedAmount = Number.isFinite(Number(input.amount))
    ? toMoney(Math.max(0, Number(input.amount)))
    : null;
  if (requestedAmount !== null && requestedAmount <= 0) {
    return { ok: false, error: "Iade tutari sifirdan buyuk olmali." };
  }

  const paymentMutationRpcResult = await supabase.rpc("apply_order_payment_mutation", {
    p_order_id: input.orderId,
    p_payment_type: "refund",
    p_method: input.method,
    p_amount: requestedAmount,
    p_note: input.note ?? null,
    p_created_by: input.createdBy ?? null,
    p_idempotency_key: requestKey,
    p_business_id: scope.businessId,
    p_branch_id: scope.branchId,
  });
  const rpcPaymentRow = parsePaymentMutationRpcRow(
    ((paymentMutationRpcResult.data as Array<Record<string, unknown>> | null) ?? [])[0] ?? null,
  );
  if (!paymentMutationRpcResult.error && rpcPaymentRow) {
    const outcome = resolvePaymentMutationOutcome({ row: rpcPaymentRow, paymentType: "refund" });
    if (!outcome.ok) {
      if (rpcPaymentRow.conflictReason === "OVER_REFUND") {
        await setAlertDispatch("over_refund_alarm", {
          orderId: input.orderId,
          requestKey,
          attemptedAmount: requestedAmount,
          at: new Date().toISOString(),
        });
      }
      return { ok: false, error: outcome.error };
    }
    if (outcome.idempotent) {
      await setAlertDispatch("duplicate_refund_counter", {
        orderId: input.orderId,
        requestKey,
        status: outcome.status,
        amountPaid: outcome.amountPaid,
        remaining: outcome.remaining,
        at: new Date().toISOString(),
      });
    }

    fireAndForgetAuditEvent({
      entityType: "payment",
      entityId: input.orderId,
      action: outcome.idempotent ? "refund_idempotent" : "refund",
      details: {
        method: input.method,
        amount: requestedAmount,
        note: input.note ?? null,
        nextStatus: outcome.status,
      },
    });

    revalidateOrderFlowCaches();
    revalidateTag("table-map", "max");
    revalidateReportCaches();
    return { ok: true, idempotent: outcome.idempotent, status: outcome.status };
  }
  if (paymentMutationRpcResult.error && !isMissingRpcFunctionError(paymentMutationRpcResult.error.message, "apply_order_payment_mutation")) {
    return { ok: false, error: paymentMutationRpcResult.error.message };
  }

  const paymentSummary = await getOrderPaymentSummaryMap(supabase, [input.orderId]);
  const summary = paymentSummary.get(input.orderId) ?? { paid: 0, refunds: 0, net: 0, count: 0 };
  const refundableBalance = toMoney(Math.max(0, summary.paid - summary.refunds));
  if (refundableBalance <= 0) {
    return { ok: false, error: "Iade edilebilir tahsilat bulunamadi." };
  }

  const amount = toMoney(Math.max(0, Number(input.amount ?? refundableBalance)));
  if (amount <= 0) {
    return { ok: false, error: "Iade tutari sifirdan buyuk olmali." };
  }
  if (toMoney(amount - refundableBalance) > 0) {
    return { ok: false, error: "Iade tutari iade edilebilir bakiyeden buyuk olamaz." };
  }

  const targetAmount = toMoney(Number(orderRow.final_price ?? orderRow.total_price));
  if (requestKey) {
    let idempotencyLookup = supabase
      .from("payments")
      .select("id")
      .eq("order_id", input.orderId)
      .eq("payment_type", "refund")
      .eq("idempotency_key", requestKey)
      .limit(1);
    if (!scope.useLegacySchema && scope.businessId) {
      idempotencyLookup = idempotencyLookup.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      idempotencyLookup = idempotencyLookup.eq("branch_id", scope.branchId);
    }
    const { data: existingPayment, error: idempotencyError } = await idempotencyLookup.maybeSingle();
    if (!idempotencyError && existingPayment) {
      const reconciled = await reconcileOrderSettlementState({
        supabase,
        scope,
        orderId: input.orderId,
        targetAmount,
        allowRefunded: true,
      });
      if (!reconciled.ok) {
        await setAlertDispatch("payment_status_reconcile_failed", {
          orderId: input.orderId,
          flow: "refund_idempotent",
          nextStatus: reconciled.status,
          targetAmount,
          nextNet: reconciled.amountPaid,
          error: reconciled.error,
          at: new Date().toISOString(),
        });
      }
      return { ok: true, idempotent: true, status: reconciled.status };
    }
  }

  const withBusinessPayment = {
    business_id: scope.businessId,
    branch_id: scope.branchId,
    order_id: input.orderId,
    payment_type: "refund",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
    idempotency_key: requestKey,
  };
  const fallbackPayment = {
    order_id: input.orderId,
    payment_type: "refund",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
    idempotency_key: requestKey,
  };
  let paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
  if (
    paymentInsert.error?.message?.toLowerCase().includes("business_id") ||
    paymentInsert.error?.message?.toLowerCase().includes("idempotency_key")
  ) {
    paymentInsert = await supabase.from("payments").insert(fallbackPayment);
  }
  const paymentError = paymentInsert.error;
  if (paymentError) {
    if (paymentError.message.toLowerCase().includes("duplicate key") && requestKey) {
      const reconciled = await reconcileOrderSettlementState({
        supabase,
        scope,
        orderId: input.orderId,
        targetAmount,
        allowRefunded: true,
      });
      if (!reconciled.ok) {
        await setAlertDispatch("payment_status_reconcile_failed", {
          orderId: input.orderId,
          flow: "refund_duplicate",
          nextStatus: reconciled.status,
          targetAmount,
          nextNet: reconciled.amountPaid,
          error: reconciled.error,
          at: new Date().toISOString(),
        });
      }
      return { ok: true, idempotent: true, status: reconciled.status };
    }
    return { ok: false, error: paymentError.message };
  }

  const reconciled = await reconcileOrderSettlementState({
    supabase,
    scope,
    orderId: input.orderId,
    targetAmount,
    allowRefunded: true,
  });
  if (!reconciled.ok) {
    await setAlertDispatch("payment_status_reconcile_failed", {
      orderId: input.orderId,
      flow: "refund",
      nextStatus: reconciled.status,
      targetAmount,
      nextNet: reconciled.amountPaid,
      error: reconciled.error,
      at: new Date().toISOString(),
    });
    return { ok: false, error: reconciled.error };
  }

  fireAndForgetAuditEvent({
    entityType: "payment",
    entityId: input.orderId,
    action: "refund",
    details: { method: input.method, amount, note: input.note ?? null, refundableBalance, nextStatus: reconciled.status },
  });

  revalidateOrderFlowCaches();
  revalidateTag("table-map", "max");
  revalidateReportCaches();
  return { ok: true, status: reconciled.status };
}

export async function assignOrderCourier(input: {
  orderId: string;
  courierId: string;
  courierName: string;
  courierPhone?: string | null;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda kurye atama pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let query = supabase
    .from("orders")
    .update({
      courier_id: input.courierId,
      courier_name: input.courierName,
      courier_phone: input.courierPhone ?? null,
      fulfillment_status: "out_for_delivery" as FulfillmentStatus,
    })
    .eq("id", input.orderId)
    .eq("channel", "delivery")
    .eq("fulfillment_status", "awaiting_dispatch")
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    query = query.eq("branch_id", scope.branchId);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    let existingQuery = supabase
      .from("orders")
      .select("id, courier_id, fulfillment_status")
      .eq("id", input.orderId)
      .eq("channel", "delivery");
    if (!scope.useLegacySchema && scope.businessId) {
      existingQuery = existingQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      existingQuery = existingQuery.eq("branch_id", scope.branchId);
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) {
      return { ok: false, error: existingError.message };
    }
    if (!existing) {
      return { ok: false, error: "SipariÃ…Å¸ bulunamadi veya eriÃ…Å¸im izni yok." };
    }
    if (existing.fulfillment_status === "out_for_delivery" && existing.courier_id === input.courierId) {
      return { ok: true, noop: true };
    }
    return { ok: false, error: "SipariÃ…Å¸ mevcut durumunda kurye atamasi kabul etmiyor." };
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: input.orderId,
    action: "assign_courier",
    details: {
      courierId: input.courierId,
      courierName: input.courierName,
      courierPhone: input.courierPhone ?? null,
    },
  });

  revalidateOrderFlowCaches();
  revalidateTag("couriers", "max");
  return { ok: true };
}

export async function markDeliveryCompleted(orderId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda teslimat tamamlama pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let currentOrderQuery = supabase
    .from("orders")
    .select("id, status, fulfillment_status")
    .eq("id", orderId)
    .eq("channel", "delivery");
  if (!scope.useLegacySchema && scope.businessId) {
    currentOrderQuery = currentOrderQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    currentOrderQuery = currentOrderQuery.eq("branch_id", scope.branchId);
  }

  const { data: currentOrder, error: currentOrderError } = await currentOrderQuery.maybeSingle();
  if (currentOrderError) {
    return { ok: false, error: currentOrderError.message };
  }
  if (!currentOrder) {
    return { ok: false, error: "SipariÃ…Å¸ bulunamadi veya eriÃ…Å¸im izni yok." };
  }
  if (currentOrder.fulfillment_status === "completed") {
    return { ok: true, noop: true };
  }

  const immutableStatuses = new Set<OrderStatus>(["paid", "partially_paid", "partially_refunded", "refunded", "cancelled"]);
  const nextStatus: OrderStatus = immutableStatuses.has(currentOrder.status) ? currentOrder.status : "served";

  let updateQuery = supabase
    .from("orders")
    .update({ fulfillment_status: "completed" as FulfillmentStatus, status: nextStatus })
    .eq("id", orderId)
    .eq("channel", "delivery")
    .neq("fulfillment_status", "completed")
    .select("id");
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    updateQuery = updateQuery.eq("branch_id", scope.branchId);
  }

  const { data: updated, error } = await updateQuery;
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!updated || updated.length === 0) {
    return { ok: true, noop: true };
  }

  fireAndForgetAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "delivery_completed",
  });

  revalidateOrderFlowCaches();
  return { ok: true };
}

export async function getTableMap() {
  return getTableMapImpl({
    getDefaultBusinessScope,
    getOrderPaymentSummaryMap,
    withQueryTimeout,
    demoOrders,
    demoTables,
  });
}

export async function getTableZones() {
  return getTableZonesImpl({
    getDefaultBusinessScope,
    getOrderPaymentSummaryMap,
    withQueryTimeout,
    demoOrders,
    demoTables,
  });
}

async function queryAssignableWaitersByScope(
  client: TenantSupabaseClient,
  scope: { businessId: string; branchId: string | null },
) {
  let accessQuery = client
    .from("staff_branch_access")
    .select("profile_id, branch_id")
    .eq("business_id", scope.businessId);
  if (scope.branchId) {
    accessQuery = accessQuery.eq("branch_id", scope.branchId);
  }

  const { data: accessRows, error: accessError } = await accessQuery;
  if (accessError) {
    return {
      hasError: true as const,
      waiters: [] as Array<{ id: string; full_name: string | null }>,
    };
  }

  const profileIds = [
    ...new Set(((accessRows ?? []) as Array<{ profile_id: string | null }>).map((row) => row.profile_id).filter(Boolean)),
  ] as string[];

  if (profileIds.length === 0) {
    return {
      hasError: false as const,
      waiters: [] as Array<{ id: string; full_name: string | null }>,
    };
  }

  const { data: profileRows, error: profilesError } = await client
    .from("profiles")
    .select("id, full_name, role")
    .in("id", profileIds)
    .eq("role", "waiter")
    .order("full_name", { ascending: true });

  if (profilesError) {
    return {
      hasError: true as const,
      waiters: [] as Array<{ id: string; full_name: string | null }>,
    };
  }

  return {
    hasError: false as const,
    waiters: (profileRows ?? []) as Array<{ id: string; full_name: string | null }>,
  };
}

export async function listAssignableWaiters() {
  try {
    const serviceClient = getSupabaseServerClient();
    const authClient = serviceClient ? null : await getSupabaseAuthServerClient();
    if (!serviceClient && !authClient) {
      return {
        waiters: [] as Array<{ id: string; full_name: string | null }>,
        usingDemoData: true,
      };
    }

    const scope = await getDefaultBusinessScope();
    if (!scope.businessId) {
      return {
        waiters: [] as Array<{ id: string; full_name: string | null }>,
        usingDemoData: false,
      };
    }

    const targetScope = { businessId: scope.businessId, branchId: scope.branchId };
    if (!serviceClient && authClient) {
      const uncached = await queryAssignableWaitersByScope(authClient, targetScope);
      if (uncached.hasError) {
        return {
          waiters: [] as Array<{ id: string; full_name: string | null }>,
          usingDemoData: false,
        };
      }
      return {
        waiters: uncached.waiters,
        usingDemoData: false,
      };
    }

    const cacheKey = `assignable-waiters:${scope.businessId}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
    const reader = unstable_cache(
      async () => {
        const innerSupabase = getSupabaseServerClient();
        if (!innerSupabase) {
          return null;
        }
        return queryAssignableWaitersByScope(innerSupabase, targetScope);
      },
      [cacheKey],
      { revalidate: 20, tags: ["profiles", "staff-access"] },
    );

    const cached = await reader();
    if (!cached || cached.hasError) {
      return {
        waiters: [] as Array<{ id: string; full_name: string | null }>,
        usingDemoData: false,
      };
    }

    return {
      waiters: cached.waiters,
      usingDemoData: false,
    };
  } catch {
    return {
      waiters: [] as Array<{ id: string; full_name: string | null }>,
      usingDemoData: false,
    };
  }
}

export async function listTableSupervisors() {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return {
        assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
        available: false,
        usingDemoData: true,
      };
    }

    const scope = await getDefaultBusinessScope();
    if (!scope.useLegacySchema && !scope.businessId) {
      return {
        assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
        available: true,
        usingDemoData: false,
      };
    }

    const cacheKey = `table-supervisors:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
    const reader = unstable_cache(
      async () => {
        const innerSupabase = getSupabaseServerClient();
        if (!innerSupabase) {
          return null;
        }

        const runQuery = async (scoped: boolean) => {
          let query = innerSupabase.from("table_supervisors").select("table_id, profile_id");
          if (scoped && !scope.useLegacySchema && scope.businessId) {
            query = query.eq("business_id", scope.businessId);
          }
          if (scoped && scope.branchId) {
            query = query.eq("branch_id", scope.branchId);
          }
          return query;
        };

        let assignmentResult = await runQuery(true);
        if (
          assignmentResult.error &&
          (assignmentResult.error.message.toLowerCase().includes("business_id") ||
            assignmentResult.error.message.toLowerCase().includes("branch_id"))
        ) {
          assignmentResult = await runQuery(false);
        }

        const assignments = (assignmentResult.data ?? []) as Array<{ table_id: string; profile_id: string }>;
        const profileIds = [...new Set(assignments.map((row) => row.profile_id).filter(Boolean))];
        let profileNameById = new Map<string, string | null>();
        if (profileIds.length > 0) {
          const profileResult = await innerSupabase
            .from("profiles")
            .select("id, full_name")
            .in("id", profileIds);
          if (!profileResult.error) {
            profileNameById = new Map(
              ((profileResult.data ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [
                profile.id,
                profile.full_name ?? null,
              ]),
            );
          }
        }

        return {
          data: assignments.map((row) => ({
            table_id: row.table_id,
            profile_id: row.profile_id,
            full_name: profileNameById.get(row.profile_id) ?? null,
          })),
          error: assignmentResult.error as { message: string } | null,
        };
      },
      [cacheKey],
      { revalidate: 5, tags: ["table-supervisors", "table-map"] },
    );

    const cached = await reader();
    if (!cached) {
      return {
        assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
        available: true,
        usingDemoData: false,
      };
    }

    if (cached.error) {
      const normalized = cached.error.message.toLowerCase();
      if (normalized.includes("table_supervisors")) {
        return {
          assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
          available: false,
          usingDemoData: false,
        };
      }
      return {
        assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
        available: true,
        usingDemoData: false,
      };
    }

    return {
      assignments: (cached.data ?? []) as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
      available: true,
      usingDemoData: false,
    };
  } catch {
    return {
      assignments: [] as Array<{ table_id: string; profile_id: string; full_name: string | null }>,
      available: true,
      usingDemoData: false,
    };
  }
}

export async function setTableSupervisor(input: {
  tableId: string;
  profileId: string | null;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda sorumlu garson atamasi pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  let tableQuery = supabase
    .from("tables")
    .select("id, business_id, branch_id")
    .eq("id", input.tableId);
  if (!scope.useLegacySchema && scope.businessId) {
    tableQuery = tableQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    tableQuery = tableQuery.eq("branch_id", scope.branchId);
  }

  const { data: tableRow, error: tableError } = await tableQuery.maybeSingle();
  if (tableError || !tableRow) {
    return { ok: false, error: tableError?.message ?? "Masa bulunamadi." };
  }

  const targetBusinessId = (tableRow as { business_id?: string | null }).business_id ?? scope.businessId ?? null;
  const targetBranchId = (tableRow as { branch_id?: string | null }).branch_id ?? null;

  if (!input.profileId) {
    let deleteQuery = supabase.from("table_supervisors").delete().eq("table_id", input.tableId);
    if (!scope.useLegacySchema && targetBusinessId) {
      deleteQuery = deleteQuery.eq("business_id", targetBusinessId);
    }
    if (targetBranchId) {
      deleteQuery = deleteQuery.eq("branch_id", targetBranchId);
    }

    const { error } = await deleteQuery;
    if (error) {
      if (error.message.toLowerCase().includes("table_supervisors")) {
        return { ok: false, error: "Sorumlu garson tablosu bulunamadi. Son migration'i ÃƒÂ§alÃ„Â±Ã…Å¸tÃ„Â±rÃ„Â±n." };
      }
      return { ok: false, error: error.message };
    }

    await logAuditEvent({
      entityType: "table",
      entityId: input.tableId,
      action: "clear_supervisor",
      details: {},
    });

    revalidateOperationsCaches();
    return { ok: true };
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", input.profileId)
    .maybeSingle();

  if (profileError || !profileRow) {
    return { ok: false, error: profileError?.message ?? "Garson profili bulunamadi." };
  }
  if ((profileRow as { role?: AppRole | null }).role !== "waiter") {
    return { ok: false, error: "Sadece garson rolundeki kullanicilar sorumlu olarak atanabilir." };
  }

  let accessQuery = supabase
    .from("staff_branch_access")
    .select("profile_id")
    .eq("profile_id", input.profileId);
  if (!scope.useLegacySchema && targetBusinessId) {
    accessQuery = accessQuery.eq("business_id", targetBusinessId);
  }

  const { data: accessRows, error: accessError } = await accessQuery.limit(1);
  if (accessError) {
    return { ok: false, error: accessError.message };
  }
  if (!accessRows || accessRows.length === 0) {
    return { ok: false, error: "Secilen garson aktif iÃ…Å¸letme kapsaminda deÃ„Å¸il." };
  }

  const { error } = await supabase
    .from("table_supervisors")
    .upsert(
      {
        business_id: targetBusinessId,
        branch_id: targetBranchId,
        table_id: input.tableId,
        profile_id: input.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "table_id" },
    );

  if (error) {
    if (error.message.toLowerCase().includes("table_supervisors")) {
      return { ok: false, error: "Sorumlu garson tablosu bulunamadi. Son migration'i ÃƒÂ§alÃ„Â±Ã…Å¸tÃ„Â±rÃ„Â±n." };
    }
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "table",
    entityId: input.tableId,
    action: "set_supervisor",
    details: {
      profileId: input.profileId,
    },
  });

  revalidateOperationsCaches();
  return { ok: true };
}

export async function createTable(tableNumber: number, name?: string, options?: { zoneId?: string | null }) {
  return createTableImpl(tableNumber, name, options?.zoneId, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function createTableZone(name: string) {
  return createTableZoneImpl(name, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function assignTableZone(input: { tableId: string; zoneId: string | null }) {
  return assignTableZoneImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function bulkCreateTables(input: { startNumber: number; count: number; namePrefix?: string; zoneId?: string | null }) {
  return bulkCreateTablesImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function bulkDeleteTables(input: { startNumber: number; endNumber: number; zoneId?: string | null; includeNonEmpty?: boolean }) {
  return bulkDeleteTablesImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function bulkDeleteTablesByIds(input: { tableIds: string[]; includeNonEmpty?: boolean }) {
  return bulkDeleteTablesByIdsImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function updateTableDetails(input: { tableId: string; tableNumber: number; name: string }) {
  return updateTableDetailsImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function updateTableStatus(input: { tableId: string; status: TableStatus }) {
  return updateTableStatusImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function deleteTable(tableId: string) {
  return deleteTableImpl(tableId, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function deleteTableZone(zoneId: string) {
  return deleteTableZoneImpl(zoneId, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function bulkDeleteTableZones(input: { zoneIds: string[] }) {
  return bulkDeleteTableZonesImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

export async function moveTableOrder(input: { sourceTableId: string; targetTableId: string }) {
  return moveTableOrderImpl(input, {
    getDefaultBusinessScope,
    getTenantDataClient,
    logAuditEvent,
    revalidateOperationsCaches,
  });
}

function revalidateProductManagementCaches() {
  revalidateTag("product-management", "max");
  revalidateTag("kitchen-catalog", "max");
  revalidateTag("menu", "max");
}

function revalidateReportCaches() {
  revalidateTag("sales-report-summary", "max");
  revalidateTag("financial-insights", "max");
}

function revalidateOrderFlowCaches() {
  revalidateTag("orders-summary", "max");
  revalidateTag("kitchen-orders", "max");
  revalidateTag("order-receipt", "max");
  revalidateTag("dashboard-snapshot", "max");
}

function revalidateOperationsCaches() {
  revalidateTag("table-map", "max");
  revalidateTag("table-zones", "max");
  revalidateTag("table-supervisors", "max");
  revalidateTag("dashboard-snapshot", "max");
  revalidateTag("orders-summary", "max");
  revalidateTag("kitchen-orders", "max");
  revalidateTag("table-requests", "max");
  revalidateTag("couriers", "max");
  revalidateTag("order-receipt", "max");
}

const MARKET_PRODUCT_KIND_VALUES = new Set<ProductKind>(["standard", "weighted", "service"]);
const MARKET_PRODUCT_UNIT_VALUES = new Set<ProductUnit>(["adet", "kg", "gram", "litre", "ml", "paket"]);
const MARKET_PRODUCT_DEPARTMENT_VALUES = new Set<ProductDepartment>([
  "general",
  "butcher",
  "delicatessen",
  "bakery",
  "produce",
  "beverage",
  "frozen",
  "non_food",
]);

export type EnterpriseMarketImportRow = {
  category_name: string;
  name: string;
  price: number;
  stock_count: number;
  description: string | null;
  image_url: string | null;
  barcode: string | null;
  plu_code: string | null;
  product_kind: ProductKind;
  unit: ProductUnit;
  department: ProductDepartment;
  is_available: boolean;
};

export type EnterpriseMarketImportIssue = {
  row: number;
  field: string;
  message: string;
};

export type EnterpriseMarketImportDryRunSummary = {
  rowCount: number;
  newCategoryCount: number;
  newProductCount: number;
  updateProductCount: number;
  conflictCount: number;
  errorCount: number;
  errors: string[];
  conflicts: EnterpriseMarketImportIssue[];
  replaceScope: boolean;
};

function normalizeMarketImportText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeMarketImportBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "evet" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "hayir" || normalized === "no") {
      return false;
    }
  }
  return fallback;
}

function normalizeMarketImportNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return fallback;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeMarketProductKind(value: unknown) {
  const normalized = normalizeMarketImportText(value).toLowerCase();
  if (MARKET_PRODUCT_KIND_VALUES.has(normalized as ProductKind)) {
    return normalized as ProductKind;
  }
  return "standard" as ProductKind;
}

function normalizeMarketProductUnit(value: unknown) {
  const normalized = normalizeMarketImportText(value).toLowerCase();
  if (MARKET_PRODUCT_UNIT_VALUES.has(normalized as ProductUnit)) {
    return normalized as ProductUnit;
  }
  return "adet" as ProductUnit;
}

function normalizeMarketProductDepartment(value: unknown) {
  const normalized = normalizeMarketImportText(value).toLowerCase();
  if (MARKET_PRODUCT_DEPARTMENT_VALUES.has(normalized as ProductDepartment)) {
    return normalized as ProductDepartment;
  }
  return "general" as ProductDepartment;
}

function normalizeEnterpriseMarketImportPayload(jsonText: string) {
  let raw: unknown = null;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return {
      rows: [] as EnterpriseMarketImportRow[],
      errors: ["JSON parse edilemedi. Dosya icerigi gecersiz."],
      conflicts: [] as EnterpriseMarketImportIssue[],
    };
  }

  if (!Array.isArray(raw)) {
    return {
      rows: [] as EnterpriseMarketImportRow[],
      errors: ["Import verisi JSON array olmalidir."],
      conflicts: [] as EnterpriseMarketImportIssue[],
    };
  }

  const rows: EnterpriseMarketImportRow[] = [];
  const errors: string[] = [];
  const conflicts: EnterpriseMarketImportIssue[] = [];
  const seenProductKeys = new Map<string, number>();
  const seenBarcodes = new Map<string, number>();
  const seenPluCodes = new Map<string, number>();

  for (let index = 0; index < raw.length; index += 1) {
    const rowNumber = index + 1;
    const item = raw[index];
    if (!item || typeof item !== "object") {
      errors.push(`Satir ${rowNumber}: kayit nesnesi gecersiz.`);
      continue;
    }

    const record = item as Record<string, unknown>;
    const categoryName =
      normalizeMarketImportText(record.category_name) || normalizeMarketImportText(record.category);
    const productName = normalizeMarketImportText(record.name) || normalizeMarketImportText(record.product_name);

    if (!categoryName) {
      errors.push(`Satir ${rowNumber}: category_name/category zorunlu.`);
    }
    if (!productName) {
      errors.push(`Satir ${rowNumber}: name/product_name zorunlu.`);
    }
    if (!categoryName || !productName) {
      continue;
    }

    const price = normalizeMarketImportNumber(record.price, Number.NaN);
    const stockRaw = normalizeMarketImportNumber(record.stock_count, 0);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Satir ${rowNumber}: price sayisal ve sifirdan buyuk/esit olmali.`);
      continue;
    }
    if (!Number.isFinite(stockRaw) || stockRaw < 0) {
      errors.push(`Satir ${rowNumber}: stock_count sayisal ve sifirdan buyuk/esit olmali.`);
      continue;
    }

    const barcode = normalizeMarketImportText(record.barcode) || null;
    const pluCode = normalizeMarketImportText(record.plu_code) || null;
    const productKey = `${categoryName.toLocaleLowerCase("tr-TR")}::${productName.toLocaleLowerCase("tr-TR")}`;
    if (seenProductKeys.has(productKey)) {
      conflicts.push({
        row: rowNumber,
        field: "name",
        message: `Ayni kategori+urun tekrarli (onceki satir: ${seenProductKeys.get(productKey)}).`,
      });
    } else {
      seenProductKeys.set(productKey, rowNumber);
    }
    if (barcode) {
      if (seenBarcodes.has(barcode)) {
        conflicts.push({
          row: rowNumber,
          field: "barcode",
          message: `Ayni barkod tekrarli (onceki satir: ${seenBarcodes.get(barcode)}).`,
        });
      } else {
        seenBarcodes.set(barcode, rowNumber);
      }
    }
    if (pluCode) {
      if (seenPluCodes.has(pluCode)) {
        conflicts.push({
          row: rowNumber,
          field: "plu_code",
          message: `Ayni PLU kodu tekrarli (onceki satir: ${seenPluCodes.get(pluCode)}).`,
        });
      } else {
        seenPluCodes.set(pluCode, rowNumber);
      }
    }

    rows.push({
      category_name: categoryName,
      name: productName,
      price: Math.max(0, price),
      stock_count: Math.max(0, Math.round(stockRaw)),
      description: normalizeMarketImportText(record.description) || null,
      image_url: normalizeMarketImportText(record.image_url) || null,
      barcode,
      plu_code: pluCode,
      product_kind: normalizeMarketProductKind(record.product_kind),
      unit: normalizeMarketProductUnit(record.unit),
      department: normalizeMarketProductDepartment(record.department),
      is_available: normalizeMarketImportBoolean(record.is_available, true),
    });
  }

  return { rows, errors, conflicts };
}

async function readEnterpriseMarketCatalogKeys(input: {
  supabase: TenantSupabaseClient;
  businessId: string;
}) {
  const categoryWithScopeResult = await input.supabase
    .from("categories")
    .select("id, name, profile_scope")
    .eq("business_id", input.businessId)
    .eq("profile_scope", "enterprise_market");
  let categoryRows: Array<{
    id: string;
    name: string;
    profile_scope?: ProductProfileScope | null;
  }> = [];
  if (categoryWithScopeResult.error?.message?.toLowerCase().includes("profile_scope")) {
    const fallbackCategoryResult = await input.supabase
      .from("categories")
      .select("id, name")
      .eq("business_id", input.businessId);
    if (fallbackCategoryResult.error) {
      return { ok: false as const, error: fallbackCategoryResult.error.message };
    }
    categoryRows = ((fallbackCategoryResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => ({
      ...row,
      profile_scope: "restaurant",
    }));
  } else if (categoryWithScopeResult.error) {
    return { ok: false as const, error: categoryWithScopeResult.error.message };
  } else {
    categoryRows = (categoryWithScopeResult.data ?? []) as Array<{
      id: string;
      name: string;
      profile_scope?: ProductProfileScope | null;
    }>;
  }

  const productWithScopeResult = await input.supabase
    .from("products")
    .select("id, category_id, name, barcode, plu_code, profile_scope")
    .eq("business_id", input.businessId)
    .eq("profile_scope", "enterprise_market");
  let productRows: Array<{
    id: string;
    category_id: string;
    name: string;
    barcode?: string | null;
    plu_code?: string | null;
    profile_scope?: ProductProfileScope | null;
  }> = [];
  if (productWithScopeResult.error?.message?.toLowerCase().includes("profile_scope")) {
    const fallbackProductResult = await input.supabase
      .from("products")
      .select("id, category_id, name, barcode, plu_code")
      .eq("business_id", input.businessId);
    if (fallbackProductResult.error) {
      return { ok: false as const, error: fallbackProductResult.error.message };
    }
    productRows = ((fallbackProductResult.data ?? []) as Array<{
      id: string;
      category_id: string;
      name: string;
      barcode?: string | null;
      plu_code?: string | null;
    }>).map((row) => ({
      ...row,
      profile_scope: "restaurant",
    }));
  } else if (productWithScopeResult.error) {
    return { ok: false as const, error: productWithScopeResult.error.message };
  } else {
    productRows = (productWithScopeResult.data ?? []) as Array<{
      id: string;
      category_id: string;
      name: string;
      barcode?: string | null;
      plu_code?: string | null;
      profile_scope?: ProductProfileScope | null;
    }>;
  }
  const marketCategories = categoryRows.filter((row) => (row.profile_scope ?? "restaurant") === "enterprise_market");
  const marketCategoryIds = new Set(marketCategories.map((row) => row.id));
  const marketProducts = productRows.filter((row) => (row.profile_scope ?? "restaurant") === "enterprise_market" && marketCategoryIds.has(row.category_id));

  const categoryNameToId = new Map<string, string>();
  const categoryIdToName = new Map<string, string>();
  for (const category of marketCategories) {
    const key = category.name.trim().toLocaleLowerCase("tr-TR");
    if (!key) {
      continue;
    }
    categoryNameToId.set(key, category.id);
    categoryIdToName.set(category.id, category.name.trim());
  }

  const productKeys = new Set<string>();
  const barcodeToProductKey = new Map<string, string>();
  const pluToProductKey = new Map<string, string>();
  for (const product of marketProducts) {
    const categoryName = categoryIdToName.get(product.category_id);
    if (!categoryName) {
      continue;
    }
    const productKey = `${categoryName.toLocaleLowerCase("tr-TR")}::${product.name.trim().toLocaleLowerCase("tr-TR")}`;
    productKeys.add(productKey);
    const barcode = normalizeMarketImportText(product.barcode);
    const pluCode = normalizeMarketImportText(product.plu_code);
    if (barcode) {
      barcodeToProductKey.set(barcode, productKey);
    }
    if (pluCode) {
      pluToProductKey.set(pluCode, productKey);
    }
  }

  return {
    ok: true as const,
    categoryNameToId,
    productKeys,
    barcodeToProductKey,
    pluToProductKey,
  };
}

export async function dryRunEnterpriseMarketImport(input: { jsonText: string; replaceScope?: boolean }) {
  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false as const, error: "Aktif isletme bulunamadi." };
  }

  const parsed = normalizeEnterpriseMarketImportPayload(input.jsonText);
  if (parsed.rows.length === 0 && parsed.errors.length === 0) {
    return { ok: false as const, error: "Import listesi bos." };
  }

  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false as const, error: "Demo modda market import pasif." };
  }

  const existing = await readEnterpriseMarketCatalogKeys({ supabase, businessId: scope.businessId });
  if (!existing.ok) {
    return { ok: false as const, error: existing.error };
  }

  const newCategoryNames = new Set<string>();
  let newProductCount = 0;
  let updateProductCount = 0;
  const conflicts = [...parsed.conflicts];
  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index];
    const rowNumber = index + 1;
    const categoryKey = row.category_name.toLocaleLowerCase("tr-TR");
    const productKey = `${categoryKey}::${row.name.toLocaleLowerCase("tr-TR")}`;
    const hasCategory = existing.categoryNameToId.has(categoryKey) || newCategoryNames.has(categoryKey);
    if (!hasCategory) {
      newCategoryNames.add(categoryKey);
    }

    if (existing.productKeys.has(productKey)) {
      updateProductCount += 1;
    } else {
      newProductCount += 1;
    }

    if (row.barcode) {
      const mappedKey = existing.barcodeToProductKey.get(row.barcode);
      if (mappedKey && mappedKey !== productKey) {
        conflicts.push({
          row: rowNumber,
          field: "barcode",
          message: "Barkod farkli bir urun tarafinda kullaniliyor.",
        });
      }
    }
    if (row.plu_code) {
      const mappedKey = existing.pluToProductKey.get(row.plu_code);
      if (mappedKey && mappedKey !== productKey) {
        conflicts.push({
          row: rowNumber,
          field: "plu_code",
          message: "PLU kodu farkli bir urun tarafinda kullaniliyor.",
        });
      }
    }
  }

  const summary: EnterpriseMarketImportDryRunSummary = {
    rowCount: parsed.rows.length,
    newCategoryCount: newCategoryNames.size,
    newProductCount,
    updateProductCount,
    conflictCount: conflicts.length,
    errorCount: parsed.errors.length,
    errors: parsed.errors,
    conflicts,
    replaceScope: Boolean(input.replaceScope),
  };

  return {
    ok: parsed.errors.length === 0 && conflicts.length === 0,
    summary,
    rows: parsed.rows,
  };
}

export async function commitEnterpriseMarketImport(input: { jsonText: string; replaceScope?: boolean }) {
  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false as const, error: "Aktif isletme bulunamadi." };
  }

  const dryRun = await dryRunEnterpriseMarketImport({
    jsonText: input.jsonText,
    replaceScope: input.replaceScope,
  });
  if (!dryRun.ok) {
    return {
      ok: false as const,
      error: dryRun.error ?? "Dry-run hatalari giderilmeden import commit edilemez.",
      summary: "summary" in dryRun ? dryRun.summary : undefined,
    };
  }

  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false as const, error: "Demo modda market import pasif." };
  }

  const authClient = await getSupabaseAuthServerClient();
  const actorResult = authClient ? await authClient.auth.getUser() : null;
  const actorId = actorResult?.data.user?.id ?? null;
  const replaceScope = Boolean(input.replaceScope);
  const { data, error } = await supabase.rpc("import_enterprise_market_catalog", {
    p_business_id: scope.businessId,
    p_rows: dryRun.rows,
    p_replace_scope: replaceScope,
    p_actor_id: actorId,
  });
  if (error) {
    if (error.message.toLowerCase().includes("import_enterprise_market_catalog")) {
      return { ok: false as const, error: "Market import fonksiyonu bulunamadi. Ilgili migration calistirilmali." };
    }
    return { ok: false as const, error: error.message };
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const summary: EnterpriseMarketImportDryRunSummary = {
    rowCount: Number(payload.row_count ?? dryRun.summary.rowCount ?? 0),
    newCategoryCount: Number(payload.category_inserted_count ?? dryRun.summary.newCategoryCount ?? 0),
    newProductCount: Number(payload.inserted_count ?? dryRun.summary.newProductCount ?? 0),
    updateProductCount: Number(payload.updated_count ?? dryRun.summary.updateProductCount ?? 0),
    conflictCount: 0,
    errorCount: 0,
    errors: [],
    conflicts: [],
    replaceScope,
  };

  revalidateProductManagementCaches();
  return {
    ok: true as const,
    summary,
  };
}

export async function getProductManagementData(
  options?: {
    tab?: import("@/lib/server/products-data").ProductManagementTab;
  },
) {
  const scope = await getDefaultBusinessScope();
  const demoMenu = getDemoMenuSeed((scope as { activeBusinessType?: BusinessType | null }).activeBusinessType ?? null);
  return getProductManagementDataImpl({
    getDefaultBusinessScope,
    isDemoCatalogFallbackEnabled: async () => {
      const { settings } = await getApplicationSettings();
      return settings.embeddedDemoCatalogEnabled;
    },
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories: demoMenu.categories,
    demoProducts: demoMenu.products,
    demoIngredients,
    demoModifierGroups: demoMenu.modifierGroups,
    demoModifierOptions: demoMenu.modifierOptions,
    demoProductIngredients,
  }, options);
}

export async function getKitchenCatalogSnapshot() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      categories: demoCategories.map((category) => ({
        id: category.id,
        name: category.name,
        prep_station: category.prep_station ?? "kitchen",
      })),
      products: demoProducts.map((product) => ({
        id: product.id,
        category_id: product.category_id,
      })),
      usingDemoData: true,
    };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return {
      categories: [] as Pick<Category, "id" | "name" | "prep_station">[],
      products: [] as Pick<Product, "id" | "category_id">[],
      usingDemoData: false,
    };
  }
  const cacheKey = `kitchen-catalog:${scope.businessId ?? "none"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let categoriesQuery = innerSupabase
        .from("categories")
        .select("id, name, prep_station")
        .order("sort_order", { ascending: true });
      let productsQuery = innerSupabase.from("products").select("id, category_id");

      if (!scope.useLegacySchema && scope.businessId) {
        categoriesQuery = categoriesQuery.eq("business_id", scope.businessId);
        productsQuery = productsQuery.eq("business_id", scope.businessId);
      }

      const [categoryResult, productResult] = await withQueryTimeout(Promise.all([categoriesQuery, productsQuery]));
      if (categoryResult.error || productResult.error) {
        return { hasError: true as const, categories: [] as Array<Pick<Category, "id" | "name" | "prep_station">>, products: [] as Array<Pick<Product, "id" | "category_id">> };
      }

      return {
        hasError: false as const,
        categories: (categoryResult.data ?? []) as Array<Pick<Category, "id" | "name" | "prep_station">>,
        products: (productResult.data ?? []) as Array<Pick<Product, "id" | "category_id">>,
      };
    },
    [cacheKey],
    { revalidate: 30, tags: ["kitchen-catalog", "product-management"] },
  );

  try {
    const cached = await reader();
    if (!cached || cached.hasError) {
      return {
        categories: demoCategories.map((category) => ({
          id: category.id,
          name: category.name,
          prep_station: category.prep_station ?? "kitchen",
        })),
        products: demoProducts.map((product) => ({
          id: product.id,
          category_id: product.category_id,
        })),
        usingDemoData: true,
      };
    }

    return {
      categories: cached.categories,
      products: cached.products,
      usingDemoData: false,
    };
  } catch {
    return {
      categories: demoCategories.map((category) => ({
        id: category.id,
        name: category.name,
        prep_station: category.prep_station ?? "kitchen",
      })),
      products: demoProducts.map((product) => ({
        id: product.id,
        category_id: product.category_id,
      })),
      usingDemoData: true,
    };
  }
}

export async function createProductModifierGroup(input: {
  productId: string;
  name: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda modifier grubu eklenemez." };
  }

  const { data, error } = await supabase
    .from("product_modifier_groups")
    .insert({
      product_id: input.productId,
      name: input.name.trim(),
      min_select: Math.max(0, Number(input.minSelect ?? 0)),
      max_select: Math.max(1, Number(input.maxSelect ?? 1)),
      is_required: input.isRequired ?? false,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetAuditEvent({
    entityType: "product_modifier_group",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { productId: input.productId, name: input.name.trim() },
  });

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function createProductModifierOption(input: {
  groupId: string;
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda modifier opsiyonu eklenemez." };
  }

  const { data, error } = await supabase
    .from("product_modifier_options")
    .insert({
      group_id: input.groupId,
      name: input.name.trim(),
      price_delta: Number(input.priceDelta ?? 0),
      is_default: input.isDefault ?? false,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  fireAndForgetAuditEvent({
    entityType: "product_modifier_option",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { groupId: input.groupId, name: input.name.trim(), priceDelta: Number(input.priceDelta ?? 0) },
  });

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteProductModifierGroup(groupId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda modifier grubu silinemez." };
  }

  const { error } = await supabase.from("product_modifier_groups").delete().eq("id", groupId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteProductModifierOption(optionId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda modifier opsiyonu silinemez." };
  }

  const { error } = await supabase.from("product_modifier_options").delete().eq("id", optionId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function createProduct(input: {
  categoryId: string;
  name: string;
  price: number;
  stockCount: number;
  profileScope: ProductProfileScope;
  description?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  barcode?: string;
  pluCode?: string;
  productKind?: ProductKind;
  unit?: ProductUnit;
  department?: ProductDepartment;
  cost?: number;
}) {
  return createProductImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function updateProduct(input: {
  productId: string;
  categoryId: string;
  name: string;
  price: number;
  stockCount: number;
  profileScope: ProductProfileScope;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  barcode?: string;
  pluCode?: string;
  productKind?: ProductKind;
  unit?: ProductUnit;
  department?: ProductDepartment;
  cost?: number;
}) {
  return updateProductImpl(input, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function deleteProduct(productId: string) {
  return deleteProductImpl(productId, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function createIngredient(name: string, unit: string, cost: number) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda malzeme ekleme pasif." };
  }
  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const payload = !scope.useLegacySchema && scope.businessId
    ? { name, unit, cost, business_id: scope.businessId }
    : { name, unit, cost };
  const { data, error } = await supabase.from("ingredients").insert(payload).select("id").single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProductManagementCaches();
  return { ok: true, id: data.id as string };
}

export async function updateIngredient(ingredientId: string, name: string, unit: string, cost: number) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda malzeme guncelleme pasif." };
  }
  const scope = await getDefaultBusinessScope();

  let query = supabase
    .from("ingredients")
    .update({ name, unit, cost })
    .eq("id", ingredientId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { error } = await query;

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteIngredient(ingredientId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda malzeme silme pasif." };
  }
  const scope = await getDefaultBusinessScope();

  let query = supabase.from("ingredients").delete().eq("id", ingredientId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateProductManagementCaches();
  return { ok: true };
}

export async function attachIngredientToProduct(input: {
  productId: string;
  ingredientId: string;
  quantity: number;
}) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda ÃƒÂ¼rÃƒÂ¼n malzemesi duzenleme pasif." };
  }
  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && scope.businessId) {
    const [{ data: product }, { data: ingredient }] = await Promise.all([
      supabase
        .from("products")
        .select("id, business_id")
        .eq("id", input.productId)
        .eq("business_id", scope.businessId)
        .maybeSingle(),
      supabase
        .from("ingredients")
        .select("id, business_id")
        .eq("id", input.ingredientId)
        .eq("business_id", scope.businessId)
        .maybeSingle(),
    ]);

    if (!product || !ingredient) {
      return { ok: false, error: "Malzeme veya ÃƒÂ¼rÃƒÂ¼n aktif iÃ…Å¸letmede bulunamadi." };
    }
  }

  const { error } = await supabase.from("product_ingredients").upsert({
    product_id: input.productId,
    ingredient_id: input.ingredientId,
    quantity: input.quantity,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateProductManagementCaches();
  return { ok: true };
}

export async function detachIngredientFromProduct(productId: string, ingredientId: string) {
  const supabase = getSupabaseServerClient() ?? (await getTenantDataClient());
  if (!supabase) {
    return { ok: false, error: "Demo modda ÃƒÂ¼rÃƒÂ¼n malzemesi duzenleme pasif." };
  }
  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && scope.businessId) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("business_id", scope.businessId)
      .maybeSingle();
    if (!product) {
      return { ok: false, error: "ÃƒÅ“rÃƒÂ¼n aktif iÃ…Å¸letmede bulunamadi." };
    }
  }

  const { error } = await supabase
    .from("product_ingredients")
    .delete()
    .eq("product_id", productId)
    .eq("ingredient_id", ingredientId);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateProductManagementCaches();
  return { ok: true };
}

export async function listProfiles() {
  try {
    const authClient = await getSupabaseAuthServerClient();
    const serviceClient = getSupabaseServerClient();
    if (!authClient) {
      return {
        profiles: [] as Array<{
          id: string;
          full_name: string | null;
          role: AppRole;
          email?: string | null;
          access_scope?: StaffAccessScope;
          primary_branch_id?: string | null;
          primary_branch_name?: string | null;
        }>,
        usingDemoData: true,
      };
    }
    const tenantAuthClient = authClient;

    const scope = await getDefaultBusinessScope();
    if (!scope.businessId) {
      return { profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, usingDemoData: false };
    }

    const cacheKey = `profiles:${scope.businessId}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
    const reader = unstable_cache(
      async () => {
        const { data: accessRows, error: accessError } = await tenantAuthClient
          .from("staff_branch_access")
          .select("profile_id, branch_id, access_scope, is_primary, branches(name)")
          .eq("business_id", scope.businessId);

        if (accessError) {
          return { hasError: true as const, profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, accessRows: [] as unknown[] };
        }

        const profileIds = [...new Set(((accessRows ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id))];
        if (profileIds.length === 0) {
          return { hasError: false as const, profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, accessRows: (accessRows ?? []) as unknown[] };
        }

        const { data, error } = await tenantAuthClient
          .from("profiles")
          .select("id, full_name, role")
          .in("id", profileIds)
          .order("created_at", { ascending: false });

        return {
          hasError: Boolean(error),
          profiles: ((data ?? []) as Array<{ id: string; full_name: string | null; role: AppRole }>),
          accessRows: (accessRows ?? []) as unknown[],
        };
      },
      [cacheKey],
      { revalidate: 20, tags: ["profiles", "staff-access"] },
    );

    const cached = await reader();
    if (!cached || cached.hasError) {
      return { profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, usingDemoData: false };
    }

  const accessRows = cached.accessRows as Array<{
    profile_id: string;
    branch_id: string | null;
    access_scope: StaffAccessScope;
    is_primary: boolean;
    branches?: { name: string } | { name: string }[] | null;
  }>;

  const getCachedAuthUsers = unstable_cache(
    async () => {
      if (!serviceClient) {
        return [] as Array<{ id: string; email: string | null }>;
      }
      try {
        const { data, error } = await serviceClient.auth.admin.listUsers();
        if (error) {
          console.error("[listProfiles] auth.admin.listUsers failed", error.message);
          return [] as Array<{ id: string; email: string | null }>;
        }
        return (data?.users ?? []).map((user) => ({
          id: user.id,
          email: user.email ?? null,
        }));
      } catch (error) {
        console.error("[listProfiles] auth.admin.listUsers threw", error);
        return [] as Array<{ id: string; email: string | null }>;
      }
    },
    ["auth-users:emails"],
    { revalidate: 60, tags: ["profiles"] },
  );
  const authUsers = await getCachedAuthUsers();
  const emailById = new Map(authUsers.map((user) => [user.id, user.email]));
  const accessByProfile = new Map(
    accessRows.map((row) => [
      row.profile_id,
      {
        access_scope: row.access_scope,
        primary_branch_id: row.branch_id,
        primary_branch_name: Array.isArray(row.branches) ? row.branches[0]?.name ?? null : row.branches?.name ?? null,
      },
    ]),
  );

    return {
      profiles: cached.profiles.map((profile) => ({
        ...profile,
        email: emailById.get(profile.id) ?? null,
        access_scope: accessByProfile.get(profile.id)?.access_scope ?? (profile.role === "owner" ? "business" : "branch"),
        primary_branch_id: accessByProfile.get(profile.id)?.primary_branch_id ?? null,
        primary_branch_name: accessByProfile.get(profile.id)?.primary_branch_name ?? null,
      })),
      usingDemoData: false,
    };
  } catch (error) {
    console.error("[listProfiles] unexpected failure", error);
    return { profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, usingDemoData: false };
  }
}

export async function listProfileRoleCounts() {
  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return {
      counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 },
      usingDemoData: true,
    };
  }
  const tenantAuthClient = authClient;

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return {
      counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 },
      usingDemoData: false,
    };
  }

  const cacheKey = `profile-role-counts:${scope.businessId}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const { data: accessRows, error: accessError } = await tenantAuthClient
        .from("staff_branch_access")
        .select("profile_id")
        .eq("business_id", scope.businessId);

      if (accessError) {
        return { hasError: true as const, counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 } };
      }

      const profileIds = [...new Set(((accessRows ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id))];
      if (profileIds.length === 0) {
        return { hasError: false as const, counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 } };
      }

      const { data: profiles, error: profilesError } = await tenantAuthClient
        .from("profiles")
        .select("role")
        .in("id", profileIds);
      if (profilesError) {
        return { hasError: true as const, counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 } };
      }

      const counts = { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 };
      for (const row of (profiles ?? []) as Array<{ role: AppRole }>) {
        if (row.role === "owner") counts.owner += 1;
        else if (row.role === "admin") counts.admin += 1;
        else if (row.role === "cashier") counts.cashier += 1;
        else if (row.role === "kitchen") counts.kitchen += 1;
        else if (row.role === "waiter") counts.waiter += 1;
      }

      return { hasError: false as const, counts };
    },
    [cacheKey],
    { revalidate: 30, tags: ["profiles", "staff-access"] },
  );

  const cached = await reader();
  if (!cached || cached.hasError) {
    return {
      counts: { owner: 0, admin: 0, cashier: 0, kitchen: 0, waiter: 0 },
      usingDemoData: false,
    };
  }

  return { counts: cached.counts, usingDemoData: false };
}

export async function updateProfileRole(profileId: string, role: AppRole) {
  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { ok: false, error: "Demo modda rol guncelleme pasif." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data: existingAccess, error: accessFindError } = await authClient
    .from("staff_branch_access")
    .select("profile_id, branch_id")
    .eq("profile_id", profileId)
    .eq("business_id", businessScope.businessId);

  if (accessFindError) {
    return { ok: false, error: accessFindError.message };
  }

  if (!existingAccess || existingAccess.length === 0) {
    return { ok: false, error: "Bu personel aktif iÃ…Å¸letme kapsaminda bulunamadi." };
  }

  const { error: profileError } = await authClient.from("profiles").update({ role }).eq("id", profileId);
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const normalizedAccessScope: StaffAccessScope = role === "owner" ? "business" : "branch";
  let branchId: string | null = null;

  if (normalizedAccessScope === "branch") {
    const { data: currentPrimary } = await authClient
      .from("staff_branch_access")
      .select("branch_id")
      .eq("profile_id", profileId)
      .eq("business_id", businessScope.businessId)
      .eq("is_primary", true)
      .maybeSingle();

    branchId = (currentPrimary?.branch_id as string | null | undefined) ?? null;

    if (!branchId) {
      const { data: firstBranch, error: branchError } = await authClient
        .from("branches")
        .select("id")
        .eq("business_id", businessScope.businessId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (branchError) {
        return { ok: false, error: branchError.message };
      }

      branchId = (firstBranch?.id as string | undefined) ?? null;
    }

    if (!branchId) {
      return { ok: false, error: "Ã…Âube personeli iÃƒÂ§in ÃƒÂ¶nce en az bir aktif Ã…Å¸ube olusturulmalidir." };
    }
  }

  const { error: accessCleanupError } = await authClient
    .from("staff_branch_access")
    .delete()
    .eq("profile_id", profileId)
    .eq("business_id", businessScope.businessId);

  if (accessCleanupError) {
    return { ok: false, error: accessCleanupError.message };
  }

  const { error: accessInsertError } = await authClient.from("staff_branch_access").insert({
    profile_id: profileId,
    business_id: businessScope.businessId,
    branch_id: branchId,
    access_scope: normalizedAccessScope,
    is_primary: true,
  });

  if (accessInsertError) {
    return { ok: false, error: accessInsertError.message };
  }

  await logAuditEvent({
    entityType: "profile",
    entityId: profileId,
    action: "update_role",
    details: {
      role,
      accessScope: role === "owner" ? "business" : "branch",
    },
  });

  return { ok: true };
}

export async function updateStaffAccount(input: {
  profileId: string;
  fullName: string;
  email: string;
  role: AppRole;
  accessScope: StaffAccessScope;
  branchId?: string | null;
  password?: string;
}) {
  const authClient = await getSupabaseAuthServerClient();
  const serviceClient = getSupabaseServerClient();
  if (!authClient || !serviceClient) {
    return { ok: false, error: "Demo modda personel guncelleme pasif." };
  }

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim() ?? "";
  if (!fullName || !email) {
    return { ok: false, error: "Ad soyad ve e-posta zorunludur." };
  }

  if (password && password.length < 6) {
    return { ok: false, error: "Sifre en az 6 karakter olmali." };
  }
  const normalizedAccessScope: StaffAccessScope = input.role === "owner" ? "business" : input.accessScope;
  const normalizedBranchId = normalizedAccessScope === "branch" ? input.branchId ?? null : null;

  if (normalizedAccessScope === "branch" && !normalizedBranchId) {
    return { ok: false, error: "Ã…Âube personeli iÃƒÂ§in bir Ã…Å¸ube secilmelidir." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data: existingAccess, error: existingAccessError } = await authClient
    .from("staff_branch_access")
    .select("profile_id")
    .eq("profile_id", input.profileId)
    .eq("business_id", businessScope.businessId);

  if (existingAccessError) {
    return { ok: false, error: existingAccessError.message };
  }

  if (!existingAccess || existingAccess.length === 0) {
    return { ok: false, error: "Bu personel aktif iÃ…Å¸letme kapsaminda bulunamadi." };
  }

  const authUpdate = await serviceClient.auth.admin.updateUserById(input.profileId, {
    email,
    ...(password ? { password } : {}),
    user_metadata: {
      full_name: fullName,
    },
  });
  if (authUpdate.error) {
    return { ok: false, error: authUpdate.error.message };
  }

  const { error: profileError } = await authClient
    .from("profiles")
    .update({
      full_name: fullName,
      role: input.role,
    })
    .eq("id", input.profileId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const { error: accessCleanupError } = await authClient
    .from("staff_branch_access")
    .delete()
    .eq("profile_id", input.profileId)
    .eq("business_id", businessScope.businessId);
  if (accessCleanupError) {
    return { ok: false, error: accessCleanupError.message };
  }

  const { error: accessInsertError } = await authClient.from("staff_branch_access").insert({
    profile_id: input.profileId,
    business_id: businessScope.businessId,
    branch_id: normalizedBranchId,
    access_scope: normalizedAccessScope,
    is_primary: true,
  });
  if (accessInsertError) {
    return { ok: false, error: accessInsertError.message };
  }

  await logAuditEvent({
    entityType: "profile",
    entityId: input.profileId,
    action: "update_staff_account",
    details: {
      fullName,
      email,
      role: input.role,
      accessScope: normalizedAccessScope,
      branchId: normalizedBranchId,
      passwordUpdated: Boolean(password),
    },
  });

  return { ok: true };
}

export async function deleteStaffAccount(profileId: string) {
  const authClient = await getSupabaseAuthServerClient();
  const serviceClient = getSupabaseServerClient();
  if (!authClient || !serviceClient) {
    return { ok: false, error: "Demo modda personel silme pasif." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data: accessRows, error: accessError } = await authClient
    .from("staff_branch_access")
    .select("business_id")
    .eq("profile_id", profileId);
  if (accessError || !accessRows || accessRows.length === 0) {
    return { ok: false, error: accessError?.message ?? "Personel eriÃ…Å¸im kaydÃ„Â± bulunamadi." };
  }

  if (!(accessRows as Array<{ business_id: string }>).some((row) => row.business_id === businessScope.businessId)) {
    return { ok: false, error: "Bu personel aktif iÃ…Å¸letme kapsaminda bulunamadi." };
  }

  if ((accessRows as Array<{ business_id: string }>).some((row) => row.business_id !== businessScope.businessId)) {
    return { ok: false, error: "Bu hesap birden fazla iÃ…Å¸letmede kullaniliyor. Guvenlik iÃƒÂ§in global silme engellendi." };
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile) {
    return { ok: false, error: profileError?.message ?? "Personel bulunamadi." };
  }

  if ((profile.role as AppRole) === "owner") {
    const ownerIds = [...new Set(
      ((await authClient
        .from("staff_branch_access")
        .select("profile_id")
        .eq("business_id", businessScope.businessId)).data ?? []).map((row) => row.profile_id),
    )];
    const { count, error: countError } = await authClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .in("id", ownerIds);
    if (countError) {
      return { ok: false, error: countError.message };
    }
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Son patron kullaniciyi silemezsin." };
    }
  }

  const deleteAuth = await serviceClient.auth.admin.deleteUser(profileId);
  if (deleteAuth.error) {
    return { ok: false, error: deleteAuth.error.message };
  }

  await authClient.from("profiles").delete().eq("id", profileId);

  await logAuditEvent({
    entityType: "profile",
    entityId: profileId,
    action: "delete_staff_account",
  });

  return { ok: true };
}

export async function createStaffAccount(input: {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  accessScope: StaffAccessScope;
  branchId?: string | null;
}) {
  const authClient = await getSupabaseAuthServerClient();
  const serviceClient = getSupabaseServerClient();
  if (!authClient || !serviceClient) {
    return { ok: false, error: "Demo modda kullanÃ„Â±cÃ„Â± oluÃ…Å¸turma pasif." };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const fullName = input.fullName.trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "Ad, e-posta ve sifre gerekli." };
  }

  if (password.length < 6) {
    return { ok: false, error: "Sifre en az 6 karakter olmali." };
  }
  const normalizedAccessScope: StaffAccessScope = input.role === "owner" ? "business" : "branch";
  const normalizedBranchId = normalizedAccessScope === "branch" ? input.branchId ?? null : null;

  if (normalizedAccessScope === "branch" && !normalizedBranchId) {
    return { ok: false, error: "Ã…Âube personeli iÃƒÂ§in bir Ã…Å¸ube secilmelidir." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers();
  if (usersError) {
    return { ok: false, error: usersError.message };
  }

  const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
  let userId = existingUser?.id;

  if (userId) {
    const existingAccessRows =
      (
        await serviceClient
          .from("staff_branch_access")
          .select("business_id")
          .eq("profile_id", userId)
      ).data ?? [];

    const businessIds = [...new Set((existingAccessRows as Array<{ business_id: string }>).map((row) => row.business_id))];
    if (businessIds.some((businessId) => businessId !== businessScope.businessId)) {
      return { ok: false, error: "Bu e-posta baska bir iÃ…Å¸letmede kullaniliyor. Tenant guvenligi iÃƒÂ§in ayni hesap yeniden baglanamaz." };
    }
  }

  if (!userId) {
    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      return { ok: false, error: createError.message };
    }

    userId = createdUser.user?.id;
  } else {
    const { error: updateUserError } = await serviceClient.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        full_name: fullName,
      },
    });
    if (updateUserError) {
      return { ok: false, error: updateUserError.message };
    }
  }

  if (!userId) {
    return { ok: false, error: "KullanÃ„Â±cÃ„Â± hesabi oluÃ…Å¸turulamadÃ„Â±." };
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role: input.role,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    if (!existingUser) {
      await serviceClient.auth.admin.deleteUser(userId);
    }
    return { ok: false, error: profileError.message };
  }

  await authClient
    .from("staff_branch_access")
    .delete()
    .eq("profile_id", userId)
    .eq("business_id", businessScope.businessId);
  const { error: accessError } = await authClient.from("staff_branch_access").insert({
    profile_id: userId,
    business_id: businessScope.businessId,
    branch_id: normalizedBranchId,
    access_scope: normalizedAccessScope,
    is_primary: true,
  });
  if (accessError) {
    return { ok: false, error: accessError.message };
  }

  await logAuditEvent({
    entityType: "profile",
    entityId: userId,
    action: "create_staff_account",
    details: {
      email,
      role: input.role,
      fullName,
      accessScope: normalizedAccessScope,
      branchId: normalizedBranchId,
    },
  });

  return { ok: true, id: userId };
}

export async function assignExistingAuthUserToBusiness(input: {
  email: string;
  fullName?: string;
  role: AppRole;
  accessScope: StaffAccessScope;
  branchId?: string | null;
}) {
  const authClient = await getSupabaseAuthServerClient();
  const serviceClient = getSupabaseServerClient();
  if (!authClient || !serviceClient) {
    return { ok: false, error: "Demo modda kullanÃ„Â±cÃ„Â± baglama pasif." };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName?.trim() ?? "";
  if (!email) {
    return { ok: false, error: "E-posta zorunludur." };
  }

  const normalizedAccessScope: StaffAccessScope = input.role === "owner" ? "business" : "branch";
  const normalizedBranchId = normalizedAccessScope === "branch" ? input.branchId ?? null : null;
  if (normalizedAccessScope === "branch" && !normalizedBranchId) {
    return { ok: false, error: "Ã…Âube personeli iÃƒÂ§in bir Ã…Å¸ube secilmelidir." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers();
  if (usersError) {
    return { ok: false, error: usersError.message };
  }

  const authUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
  if (!authUser) {
    return { ok: false, error: "Auth kayitlarinda bu e-postayla kullanÃ„Â±cÃ„Â± bulunamadi." };
  }

  const userId = authUser.id;
  const currentName =
    ((authUser.user_metadata as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
    authUser.email?.split("@")[0] ||
    "Personel";
  const resolvedFullName = fullName || currentName;

  const existingAccessRows =
    (
      await serviceClient
        .from("staff_branch_access")
        .select("business_id")
        .eq("profile_id", userId)
    ).data ?? [];
  const businessIds = [...new Set((existingAccessRows as Array<{ business_id: string }>).map((row) => row.business_id))];
  if (businessIds.some((businessId) => businessId !== businessScope.businessId)) {
    return { ok: false, error: "Bu hesap baska bir isletmeye baÃ„Å¸lÃ„Â±. Tenant guvenligi nedeniyle eklenemedi." };
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      full_name: resolvedFullName,
      role: input.role,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  await authClient
    .from("staff_branch_access")
    .delete()
    .eq("profile_id", userId)
    .eq("business_id", businessScope.businessId);

  const { error: accessInsertError } = await authClient.from("staff_branch_access").insert({
    profile_id: userId,
    business_id: businessScope.businessId,
    branch_id: normalizedBranchId,
    access_scope: normalizedAccessScope,
    is_primary: true,
  });
  if (accessInsertError) {
    return { ok: false, error: accessInsertError.message };
  }

  await logAuditEvent({
    entityType: "profile",
    entityId: userId,
    action: "assign_existing_auth_user",
    details: {
      email,
      role: input.role,
      fullName: resolvedFullName,
      accessScope: normalizedAccessScope,
      branchId: normalizedBranchId,
    },
  });

  return { ok: true, id: userId };
}

export async function createDemoStaffSet() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda demo hesap kurulumu pasif." };
  }

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  const scope = await getDefaultBusinessScope();
  for (const account of demoStaffAccounts) {
    const result = await createStaffAccount({
      email: account.email,
      password: account.password,
      fullName: account.fullName,
      role: account.role,
      accessScope: account.role === "owner" ? "business" : "branch",
      branchId: scope.branchId,
    });
    results.push({
      email: account.email,
      ok: result.ok,
      error: "error" in result ? result.error : undefined,
    });
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      error: `Bazi demo hesaplari oluÃ…Å¸turulamadÃ„Â±: ${failed.map((item) => item.email).join(", ")}`,
    };
  }

  return { ok: true, count: results.length };
}

export async function createCategory(
  name: string,
  sortOrder: number,
  prepStation: PrepStation = "kitchen",
  profileScope: ProductProfileScope = "restaurant",
) {
  return createCategoryImpl(name, sortOrder, prepStation, profileScope, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function updateCategoryPrepStation(categoryId: string, prepStation: PrepStation) {
  return updateCategoryPrepStationImpl({ categoryId, prepStation }, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function updateCategorySortOrder(categoryId: string, sortOrder: number) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori sira guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  let query = supabase.from("categories").update({ sort_order: sortOrder }).eq("id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
  }
  let { error } = await query;
  if (error?.message?.toLowerCase().includes("profile_scope")) {
    let fallbackQuery = supabase.from("categories").update({ sort_order: sortOrder }).eq("id", categoryId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
    }
    const fallback = await fallbackQuery;
    error = fallback.error;
  }
  if (error) {
    return { ok: false, error: error.message };
  }
  await logAuditEvent({
    entityType: "category",
    entityId: categoryId,
    action: "sort_order_update",
    details: { sortOrder, profileScope: activeProfileScope },
  });
  revalidateProductManagementCaches();
  return { ok: true };
}

export async function reorderCategories(categoryIds: string[]) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kategori sira guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  for (let index = 0; index < categoryIds.length; index += 1) {
    let query = supabase
      .from("categories")
      .update({ sort_order: index + 1 })
      .eq("id", categoryIds[index]);

    if (!scope.useLegacySchema && scope.businessId) {
      query = query.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
    }

    let { error } = await query;
    if (error?.message?.toLowerCase().includes("profile_scope")) {
      let fallbackQuery = supabase
        .from("categories")
        .update({ sort_order: index + 1 })
        .eq("id", categoryIds[index]);
      if (!scope.useLegacySchema && scope.businessId) {
        fallbackQuery = fallbackQuery.eq("business_id", scope.businessId);
      }
      const fallback = await fallbackQuery;
      error = fallback.error;
    }
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  await logAuditEvent({
    entityType: "category",
    entityId: "bulk",
    action: "reorder",
    details: { categoryIds, profileScope: activeProfileScope },
  });

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteCategory(categoryId: string) {
  return deleteCategoryImpl(categoryId, {
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  });
}

export async function bulkUpdateCategoryPrices(categoryId: string, percent: number) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda toplu fiyat guncelleme pasif." };
  }

  const scale = 1 + percent / 100;
  if (scale <= 0) {
    return { ok: false, error: "GeÃƒÂ§ersiz yuzde degeri." };
  }

  const scope = await getDefaultBusinessScope();
  const activeProfileScope = (scope.activeBranchProfile ?? "restaurant") as ProductProfileScope;
  let listQuery = supabase.from("products").select("id, price").eq("category_id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    listQuery = listQuery.eq("business_id", scope.businessId).eq("profile_scope", activeProfileScope);
  }
  let { data: products, error: listError } = await listQuery;
  if (listError?.message?.toLowerCase().includes("profile_scope")) {
    let fallbackListQuery = supabase.from("products").select("id, price").eq("category_id", categoryId);
    if (!scope.useLegacySchema && scope.businessId) {
      fallbackListQuery = fallbackListQuery.eq("business_id", scope.businessId);
    }
    const fallback = await fallbackListQuery;
    products = fallback.data;
    listError = fallback.error;
  }
  if (listError) {
    return { ok: false, error: listError.message };
  }

  const updates = (products ?? []).map((product) => ({
    id: product.id,
    price: Math.max(0, Number((Number(product.price) * scale).toFixed(2))),
  }));

  for (const item of updates) {
    const { error } = await supabase.from("products").update({ price: item.price }).eq("id", item.id);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidateProductManagementCaches();
  return { ok: true, updatedCount: updates.length };
}

export async function listStockMovements(limit = 100) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { movements: [] as StockMovement[], usingDemoData: true };
  }
  const scope = await getDefaultBusinessScope();

  let query = supabase
    .from("stock_movements")
    .select("id, product_id, change_amount, previous_stock, new_stock, reason, created_at, products(name, business_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("products.business_id", scope.businessId);
  }
  const { data, error } = await query;

  if (error) {
    return { movements: [] as StockMovement[], usingDemoData: true };
  }

  return {
    movements: (data ?? []).map((row) => {
      const product = row.products as { name?: string } | { name?: string }[] | null;
      const productName = Array.isArray(product) ? product[0]?.name : product?.name;
      return {
        id: row.id as string,
        product_id: row.product_id as string,
        change_amount: Number(row.change_amount),
        previous_stock: Number(row.previous_stock),
        new_stock: Number(row.new_stock),
        reason: String(row.reason),
        created_at: String(row.created_at),
        product_name: productName,
      };
    }),
    usingDemoData: false,
  };
}

export async function listAuditLogs(limit = 200) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { logs: [] as AuditLog[], usingDemoData: true };
  }
  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { logs: [] as AuditLog[], usingDemoData: false };
  }

  let allowedActorIds: string[] | null = null;
  if (!scope.useLegacySchema && scope.businessId) {
    const { data: accessRows } = await supabase
      .from("staff_branch_access")
      .select("profile_id")
      .eq("business_id", scope.businessId);
    allowedActorIds = [...new Set(((accessRows ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id))];
    if (allowedActorIds.length === 0) {
      return { logs: [] as AuditLog[], usingDemoData: false };
    }
  }

  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, entity_type, entity_id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (allowedActorIds) {
    query = query.in("actor_id", allowedActorIds);
  }
  const { data, error } = await query;

  if (error) {
    return { logs: [] as AuditLog[], usingDemoData: false };
  }

  return {
    logs: (data ?? []) as AuditLog[],
    usingDemoData: false,
  };
}

async function getCachedSalesReportSummaryRow(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
  days: number;
  startIso: string;
  endIso?: string;
  rangeKey: string;
}) {
  const cacheKey = `sales-report-summary:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.rangeKey}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const paymentResult = await listScopedFinancePayments({
        supabase,
        startIso: input.startIso,
        endIso: input.endIso,
        businessId: input.businessId,
        branchId: input.branchId,
        useLegacySchema: input.useLegacySchema,
        mode: "compact",
      });
      if (paymentResult.error) {
        return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, hasError: true };
      }
      const aggregation = aggregateFinancePayments(paymentResult.rows);

      const map = new Map<string, { sales: number; refunds: number }>();
      const start = new Date(input.startIso);
      for (let i = 0; i < input.days; i += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        map.set(formatDateOnly(day), { sales: 0, refunds: 0 });
      }

      for (const [day, values] of aggregation.dailyMap.entries()) {
        if (!map.has(day)) {
          map.set(day, { sales: 0, refunds: 0 });
        }
        const bucket = map.get(day)!;
        bucket.sales += values.sales;
        bucket.refunds += values.refunds;
      }

      return {
        rows: Array.from(map.entries()).map(([day, values]) => ({
          day,
          sales: values.sales,
          refunds: values.refunds,
          net: values.sales - values.refunds,
        })),
        hasError: false,
      };
    },
    [cacheKey],
    { revalidate: 30, tags: ["sales-report-summary"] },
  );

  return reader();
}

function parseDateOnly(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveFinanceRange(input: {
  days?: number;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);

  if (startDate && endDate) {
    const normalizedStart = startDate <= endDate ? startDate : endDate;
    const normalizedEnd = startDate <= endDate ? endDate : startDate;
    const maxSpanDays = 366;
    const spanDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / 86400000) + 1;
    const clampedDays = Math.max(1, Math.min(maxSpanDays, spanDays));
    const clampedEnd = new Date(normalizedStart);
    clampedEnd.setDate(normalizedStart.getDate() + clampedDays - 1);
    const endExclusive = new Date(clampedEnd);
    endExclusive.setDate(clampedEnd.getDate() + 1);
    return {
      days: clampedDays,
      startIso: normalizedStart.toISOString(),
      endIso: endExclusive.toISOString(),
      startDate: formatDateOnly(normalizedStart),
      endDate: formatDateOnly(clampedEnd),
      mode: "date" as const,
      rangeKey: `date:${formatDateOnly(normalizedStart)}:${formatDateOnly(clampedEnd)}`,
    };
  }

  const safeDays = Math.max(1, Math.min(90, Math.floor(input.days ?? 7)));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (safeDays - 1));
  return {
    days: safeDays,
    startIso: start.toISOString(),
    endIso: undefined,
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(new Date()),
    mode: "period" as const,
    rangeKey: `period:${safeDays}`,
  };
}

export async function getSalesReportSummary(input: { days?: number; startDate?: string | null; endDate?: string | null } | number = 7) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, usingDemoData: true };
  }

  try {
    const scope = await getDefaultBusinessScope();
    const normalizedInput = typeof input === "number" ? { days: input } : input;
    const range = resolveFinanceRange(normalizedInput);
    const cached = await getCachedSalesReportSummaryRow({
      businessId: scope.businessId,
      branchId: scope.branchId,
      useLegacySchema: scope.useLegacySchema,
      days: range.days,
      startIso: range.startIso,
      endIso: range.endIso,
      rangeKey: range.rangeKey,
    });

    if (!cached || cached.hasError) {
      return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, usingDemoData: false };
    }

    return { rows: cached.rows, usingDemoData: false };
  } catch (error) {
    console.error("[sales-report-summary] failed", error);
    return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, usingDemoData: false };
  }
}

async function getCachedFinancialInsightsRow(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
  days: number;
  startIso: string;
  endIso?: string;
  rangeKey: string;
  includeTopProducts: boolean;
  includeRecentPayments: boolean;
}) {
  const cacheKey = `financial-insights:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.rangeKey}:${input.includeTopProducts ? "top" : "notop"}:${input.includeRecentPayments ? "recent" : "norecent"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const paymentResult = await listScopedFinancePayments({
        supabase,
        startIso: input.startIso,
        endIso: input.endIso,
        businessId: input.businessId,
        branchId: input.branchId,
        useLegacySchema: input.useLegacySchema,
        mode: "compact",
      });
      if (paymentResult.error) {
        return {
          hasError: true,
          summary: {
            grossSales: 0,
            refunds: 0,
            netSales: 0,
            discountTotal: 0,
            serviceFeeTotal: 0,
            paidOrderCount: 0,
            averageTicket: 0,
            outstandingReceivables: 0,
            cancelledCount: 0,
          },
          methodBreakdown: [] as Array<{ method: string; sales: number; refunds: number; net: number }>,
          hourlySales: [] as Array<{ hour: string; sales: number }>,
          topProducts: [] as ProductProfitabilityRow[],
          recentPayments: [] as Array<{
            id: string;
            order_id: string;
            payment_type: string;
            method: string;
            amount: number;
            note: string | null;
            created_at: string;
          }>,
        };
      }
      const aggregationRows = paymentResult.rows;
      const aggregation = aggregateFinancePayments(aggregationRows);
      const paidOrderIds = [...aggregation.paidOrderIds];
      const recentPaymentsResult = input.includeRecentPayments
        ? await listScopedFinancePayments({
            supabase,
            startIso: input.startIso,
            endIso: input.endIso,
            businessId: input.businessId,
            branchId: input.branchId,
            useLegacySchema: input.useLegacySchema,
            mode: "full",
            orderByCreatedAtDesc: true,
            limit: 60,
          })
        : { rows: [] as FinancePaymentRow[], error: null as { message: string } | null };

      let topProducts: ProductProfitabilityRow[] = [];
      if (input.includeTopProducts) {
        let profitabilityOrderQuery = supabase
          .from("orders")
          .select("id, final_price, total_price")
          .in("status", ["paid", "partially_refunded", "refunded"])
          .gte("created_at", input.startIso);
        if (input.endIso) {
          profitabilityOrderQuery = profitabilityOrderQuery.lt("created_at", input.endIso);
        }
        if (!input.useLegacySchema && input.businessId) {
          profitabilityOrderQuery = profitabilityOrderQuery.eq("business_id", input.businessId);
        }
        if (input.branchId) {
          profitabilityOrderQuery = profitabilityOrderQuery.eq("branch_id", input.branchId);
        }

        const { data: profitabilityOrders, error: profitabilityOrderError } = await profitabilityOrderQuery;
        if (!profitabilityOrderError && (profitabilityOrders?.length ?? 0) > 0) {
          const orderIds = (profitabilityOrders ?? []).map((row) => row.id as string);
          const [itemResult, refundResult] = await Promise.all([
            supabase
              .from("order_items")
              .select("order_id, product_name, quantity, line_total, line_cost_snapshot")
              .in("order_id", orderIds),
            supabase
              .from("payments")
              .select("order_id, amount")
              .eq("payment_type", "refund")
              .in("order_id", orderIds),
          ]);

          let itemRows = (itemResult.data ?? []) as Array<{
            order_id: string;
            product_name: string;
            quantity: number;
            line_total: number;
            line_cost_snapshot: number | null;
          }>;
          let itemError = itemResult.error;
          if (itemError?.message?.toLowerCase().includes("line_cost_snapshot")) {
            const legacyItemResult = await supabase
              .from("order_items")
              .select("order_id, product_name, quantity, line_total")
              .in("order_id", orderIds);
            itemRows = ((legacyItemResult.data ?? []) as Array<{
              order_id: string;
              product_name: string;
              quantity: number;
              line_total: number;
            }>).map((row) => ({ ...row, line_cost_snapshot: 0 }));
            itemError = legacyItemResult.error;
          }

          const refundRows = (refundResult.data ?? []) as Array<{ order_id: string; amount: number }>;
          const refundError = refundResult.error;

          if (!itemError && !refundError) {
            const finalByOrderId = new Map<string, number>();
            for (const order of (profitabilityOrders ?? []) as Array<{
              id: string;
              final_price: number | null;
              total_price: number;
            }>) {
              finalByOrderId.set(order.id, Number(order.final_price ?? order.total_price ?? 0));
            }

            const refundByOrderId = new Map<string, number>();
            for (const row of refundRows) {
              refundByOrderId.set(row.order_id, (refundByOrderId.get(row.order_id) ?? 0) + Number(row.amount ?? 0));
            }

            const lineTotalByOrderId = new Map<string, number>();
            for (const row of itemRows) {
              lineTotalByOrderId.set(row.order_id, (lineTotalByOrderId.get(row.order_id) ?? 0) + Number(row.line_total ?? 0));
            }

            const productMap = new Map<string, { qty: number; revenue: number; cost: number; refundImpact: number }>();
            for (const row of itemRows) {
              const productName = row.product_name || "Bilinmeyen urun";
              const orderFinal = Math.max(0, Number(finalByOrderId.get(row.order_id) ?? 0));
              const orderRefundRaw = Math.max(0, Number(refundByOrderId.get(row.order_id) ?? 0));
              const orderRefund = Math.min(orderFinal, orderRefundRaw);
              const orderNetRevenue = Math.max(0, orderFinal - orderRefund);
              const orderLineTotal = Math.max(0, Number(lineTotalByOrderId.get(row.order_id) ?? 0));
              const ratio = orderLineTotal > 0 ? Number(row.line_total ?? 0) / orderLineTotal : 0;
              const allocatedRevenue = orderNetRevenue * ratio;
              const allocatedRefundImpact = orderRefund * ratio;

              const bucket = productMap.get(productName) ?? { qty: 0, revenue: 0, cost: 0, refundImpact: 0 };
              bucket.qty += Number(row.quantity ?? 0);
              bucket.revenue += allocatedRevenue;
              bucket.cost += Number(row.line_cost_snapshot ?? 0);
              bucket.refundImpact += allocatedRefundImpact;
              productMap.set(productName, bucket);
            }

            topProducts = Array.from(productMap.entries())
              .map(([productName, values]) => {
                const revenue = toMoney(values.revenue);
                const cost = toMoney(values.cost);
                const profit = toMoney(revenue - cost);
                const margin = revenue > 0 ? toScaled((profit / revenue) * 100, 2) : 0;
                return {
                  productName,
                  qty: toScaled(values.qty, 3),
                  revenue,
                  cost,
                  profit,
                  margin,
                  refundImpact: toMoney(values.refundImpact),
                };
              })
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 10);
          }
        }
      }

      let orderQuery = supabase
        .from("orders")
        .select("id, status, discount_amount, service_fee, final_price, total_price, created_at")
        .gte("created_at", input.startIso);
      if (input.endIso) {
        orderQuery = orderQuery.lt("created_at", input.endIso);
      }
      if (!input.useLegacySchema && input.businessId) {
        orderQuery = orderQuery.eq("business_id", input.businessId);
      }
      if (input.branchId) {
        orderQuery = orderQuery.eq("branch_id", input.branchId);
      }
      const { data: orderRows } = await orderQuery;
      let discountTotal = 0;
      let serviceFeeTotal = 0;
      let outstandingReceivables = 0;
      let cancelledCount = 0;
      for (const order of (orderRows ?? []) as Array<{
        id: string;
        status: OrderStatus;
        discount_amount: number | null;
        service_fee: number | null;
        final_price: number | null;
        total_price: number;
      }>) {
        discountTotal += Number(order.discount_amount ?? 0);
        serviceFeeTotal += Number(order.service_fee ?? 0);
        if (order.status === "cancelled") {
          cancelledCount += 1;
        }
        if (
          order.status === "pending" ||
          order.status === "preparing" ||
          order.status === "ready" ||
          order.status === "served" ||
          order.status === "partially_paid"
        ) {
          const finalAmount = Number(order.final_price ?? order.total_price);
          const orderNet = aggregation.orderNetMap.get(order.id) ?? 0;
          outstandingReceivables += Math.max(0, finalAmount - orderNet);
        }
      }

      const paidOrderCount = paidOrderIds.length;
      const averageTicket = paidOrderCount > 0 ? aggregation.grossSales / paidOrderCount : 0;

      return {
        hasError: false,
        summary: {
          grossSales: aggregation.grossSales,
          refunds: aggregation.refunds,
          netSales: aggregation.netSales,
          discountTotal,
          serviceFeeTotal,
          paidOrderCount,
          averageTicket,
          outstandingReceivables,
          cancelledCount,
        },
        methodBreakdown: Array.from(aggregation.methodMap.entries()).map(([method, values]) => ({
          method,
          sales: values.sales,
          refunds: values.refunds,
          net: values.sales - values.refunds,
        })),
        hourlySales: Array.from(aggregation.hourMap.entries()).map(([hour, sales]) => ({
          hour,
          sales,
        })),
        topProducts,
        recentPayments: recentPaymentsResult.error
          ? []
          : recentPaymentsResult.rows.slice(0, 60).map((row) => ({
              id: row.id ?? "",
              order_id: row.order_id,
              payment_type: row.payment_type,
              method: row.method,
              amount: row.amount,
              note: row.note ?? null,
              created_at: row.created_at,
            })),
      };
    },
    [cacheKey],
    { revalidate: 30, tags: ["financial-insights"] },
  );

  return reader();
}

export async function getFinancialInsights(
  input:
    | {
        days?: number;
        startDate?: string | null;
        endDate?: string | null;
        includeTopProducts?: boolean;
        includeRecentPayments?: boolean;
      }
    | number = 7,
) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return {
      usingDemoData: true,
      summary: {
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        discountTotal: 0,
        serviceFeeTotal: 0,
        paidOrderCount: 0,
        averageTicket: 0,
        outstandingReceivables: 0,
        cancelledCount: 0,
      },
      methodBreakdown: [] as Array<{ method: string; sales: number; refunds: number; net: number }>,
      hourlySales: [] as Array<{ hour: string; sales: number }>,
      topProducts: [] as ProductProfitabilityRow[],
      recentPayments: [] as Array<{
        id: string;
        order_id: string;
        payment_type: string;
        method: string;
        amount: number;
        note: string | null;
        created_at: string;
      }>,
    };
  }

  try {
    const scope = await getDefaultBusinessScope();
    const normalizedInput =
      typeof input === "number"
        ? { days: input, includeTopProducts: true, includeRecentPayments: true }
        : { includeTopProducts: true, includeRecentPayments: true, ...input };
    const range = resolveFinanceRange(normalizedInput);
    const cached = await getCachedFinancialInsightsRow({
      businessId: scope.businessId,
      branchId: scope.branchId,
      useLegacySchema: scope.useLegacySchema,
      days: range.days,
      startIso: range.startIso,
      endIso: range.endIso,
      rangeKey: range.rangeKey,
      includeTopProducts: normalizedInput.includeTopProducts ?? true,
      includeRecentPayments: normalizedInput.includeRecentPayments ?? true,
    });

    if (!cached || cached.hasError) {
      return {
        usingDemoData: false,
        summary: {
          grossSales: 0,
          refunds: 0,
          netSales: 0,
          discountTotal: 0,
          serviceFeeTotal: 0,
          paidOrderCount: 0,
          averageTicket: 0,
          outstandingReceivables: 0,
          cancelledCount: 0,
        },
        methodBreakdown: [] as Array<{ method: string; sales: number; refunds: number; net: number }>,
        hourlySales: [] as Array<{ hour: string; sales: number }>,
        topProducts: [] as ProductProfitabilityRow[],
        recentPayments: [] as Array<{
          id: string;
          order_id: string;
          payment_type: string;
          method: string;
          amount: number;
          note: string | null;
          created_at: string;
        }>,
      };
    }

    return {
      usingDemoData: false,
      summary: cached.summary,
      methodBreakdown: cached.methodBreakdown,
      hourlySales: cached.hourlySales,
      topProducts: cached.topProducts,
      recentPayments: cached.recentPayments,
    };
  } catch (error) {
    console.error("[financial-insights] failed", error);
    return {
      usingDemoData: false,
      summary: {
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        discountTotal: 0,
        serviceFeeTotal: 0,
        paidOrderCount: 0,
        averageTicket: 0,
        outstandingReceivables: 0,
        cancelledCount: 0,
      },
      methodBreakdown: [] as Array<{ method: string; sales: number; refunds: number; net: number }>,
      hourlySales: [] as Array<{ hour: string; sales: number }>,
      topProducts: [] as ProductProfitabilityRow[],
      recentPayments: [] as Array<{
        id: string;
        order_id: string;
        payment_type: string;
        method: string;
        amount: number;
        note: string | null;
        created_at: string;
      }>,
    };
  }
}

export async function getCurrentCashSession() {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { session: null as CashRegisterSession | null, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  let query = supabase
    .from("cash_register_sessions")
    .select("id, status, opened_at, closed_at, opening_cash, closing_cash, expected_cash, note")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { data, error } = await query.maybeSingle();

  if (error) {
    return { session: null as CashRegisterSession | null, usingDemoData: false };
  }

  return { session: (data as CashRegisterSession | null) ?? null, usingDemoData: false };
}

export async function openCashSession(openingCash: number, note?: string, openedBy?: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kasa oturumu pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let activeQuery = supabase.from("cash_register_sessions").select("id").eq("status", "open").limit(1);
  if (!scope.useLegacySchema && scope.businessId) {
    activeQuery = activeQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    activeQuery = activeQuery.eq("branch_id", scope.branchId);
  }
  const { data: active } = await activeQuery;
  if ((active ?? []).length > 0) {
    return { ok: false, error: "AÃƒÂ§Ã„Â±k kasa oturumu zaten var." };
  }

  let insert = await supabase
    .from("cash_register_sessions")
    .insert({
      business_id: scope.businessId,
      branch_id: scope.branchId,
      opened_by: openedBy ?? null,
      opening_cash: Math.max(0, Number(openingCash || 0)),
      note: note ?? null,
      status: "open",
    })
    .select("id")
    .maybeSingle();
  if (insert.error?.message?.toLowerCase().includes("business_id")) {
    insert = await supabase
      .from("cash_register_sessions")
      .insert({
        opened_by: openedBy ?? null,
        opening_cash: Math.max(0, Number(openingCash || 0)),
        note: note ?? null,
        status: "open",
      })
      .select("id")
      .maybeSingle();
  }
  const error = insert.error;

  if (error) {
    return { ok: false, error: error.message };
  }

  const sessionId = (insert.data as { id: string } | null)?.id ?? "cash-register-session";
  await logAuditEvent({
    actorId: openedBy ?? null,
    entityType: "cash_register_session",
    entityId: sessionId,
    action: "open",
    details: {
      businessId: scope.businessId,
      branchId: scope.branchId,
      openingCash: Math.max(0, Number(openingCash || 0)),
    },
  });

  return { ok: true };
}

export async function closeCashSession(input: {
  sessionId: string;
  closingCash: number;
  note?: string;
  closedBy?: string;
}) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda kasa kapatma pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let sessionQuery = supabase
    .from("cash_register_sessions")
    .select("id, opened_at, opening_cash")
    .eq("id", input.sessionId);
  if (!scope.useLegacySchema && scope.businessId) {
    sessionQuery = sessionQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    sessionQuery = sessionQuery.eq("branch_id", scope.branchId);
  }
  const { data: sessionRow, error: sessionError } = await sessionQuery.maybeSingle();
  if (sessionError || !sessionRow) {
    return { ok: false, error: sessionError?.message ?? "Kasa oturumu bulunamadi." };
  }

  const { settings: applicationSettings } = await getApplicationSettings();
  if (applicationSettings.requireNoOpenChecksForSessionClose) {
    let openOrdersQuery = supabase
      .from("orders")
      .select("id")
      .in("status", ["pending", "preparing", "ready", "served", "partially_paid"])
      .limit(1);
    if (!scope.useLegacySchema && scope.businessId) {
      openOrdersQuery = openOrdersQuery.eq("business_id", scope.businessId);
    }
    if (scope.branchId) {
      openOrdersQuery = openOrdersQuery.eq("branch_id", scope.branchId);
    }
    const { data: openOrderRows, error: openOrderError } = await openOrdersQuery;
    if (openOrderError) {
      return { ok: false, error: openOrderError.message };
    }
    if ((openOrderRows?.length ?? 0) > 0) {
      return { ok: false, error: "Gun sonu kapatilamadi. AÃƒÂ§Ã„Â±k adisyon bulunuyor." };
    }
  }

  let cashQuery = supabase
    .from("payments")
    .select("amount, payment_type")
    .eq("method", "cash")
    .gte("created_at", sessionRow.opened_at);
  if (!scope.useLegacySchema && scope.businessId) {
    cashQuery = cashQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    cashQuery = cashQuery.eq("branch_id", scope.branchId);
  }
  const { data: cashSales } = await cashQuery;

  const expectedCash = (cashSales ?? []).reduce((sum, row) => {
    if (row.payment_type === "refund") {
      return sum - Number(row.amount);
    }
    return sum + Number(row.amount);
  }, Math.max(0, Number(sessionRow.opening_cash ?? 0)));

  const closingCash = Math.max(0, Number(input.closingCash || 0));
  const variance = closingCash - expectedCash;
  const envThreshold = Number(process.env.CASH_RECONCILIATION_DIFF_ALERT);
  const mismatchThreshold = Number.isFinite(envThreshold) && envThreshold >= 0 ? envThreshold : 50;
  const shouldSendMismatchAlert = Math.abs(variance) >= mismatchThreshold;

  let closeQuery = supabase
    .from("cash_register_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closing_cash: closingCash,
      expected_cash: expectedCash,
      note: input.note ?? null,
      closed_by: input.closedBy ?? null,
    })
    .eq("id", input.sessionId);
  if (!scope.useLegacySchema && scope.businessId) {
    closeQuery = closeQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    closeQuery = closeQuery.eq("branch_id", scope.branchId);
  }
  const { error } = await closeQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  let mismatchAlertSent = false;
  if (shouldSendMismatchAlert) {
    const alertPayload = {
      sessionId: input.sessionId,
      businessId: scope.businessId,
      branchId: scope.branchId,
      expectedCash,
      closingCash,
      variance,
      threshold: mismatchThreshold,
      closedAt: new Date().toISOString(),
    };
    const alertResult = await setAlertDispatch("cash_reconciliation_mismatch", alertPayload);
    mismatchAlertSent = Boolean(alertResult.ok);
  }

  await logAuditEvent({
    actorId: input.closedBy ?? null,
    entityType: "cash_register_session",
    entityId: input.sessionId,
    action: shouldSendMismatchAlert ? "close_mismatch" : "close",
    details: {
      businessId: scope.businessId,
      branchId: scope.branchId,
      expectedCash,
      closingCash,
      variance,
      threshold: mismatchThreshold,
      mismatchAlertSent,
    },
  });

  return {
    ok: true,
    expectedCash,
    variance,
    mismatchThreshold,
    mismatchAlertSent,
  };
}

export async function getPaymentOverview() {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return {
      today: { cashSale: 0, cardSale: 0, mixedSale: 0, refunds: 0, net: 0 },
      usingDemoData: true,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const scope = await getDefaultBusinessScope();
  const paymentResult = await listScopedFinancePayments({
    supabase,
    startIso: todayStart.toISOString(),
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  if (paymentResult.error) {
    return {
      today: { cashSale: 0, cardSale: 0, mixedSale: 0, refunds: 0, net: 0 },
      usingDemoData: false,
    };
  }
  const aggregation = aggregateFinancePayments(paymentResult.rows);
  const cashSale = aggregation.methodMap.get("cash")?.sales ?? 0;
  const cardSale = aggregation.methodMap.get("card")?.sales ?? 0;
  const mixedSale = aggregation.methodMap.get("mixed")?.sales ?? 0;
  const refunds = aggregation.refunds;

  return {
    today: {
      cashSale,
      cardSale,
      mixedSale,
      refunds,
      net: aggregation.netSales,
    },
    usingDemoData: false,
  };
}

function createEmptyOpsSnapshotAggregate(): OpsSnapshotAggregate {
  return {
    pending_orders: 0,
    preparing_orders: 0,
    served_orders: 0,
    delayed_kitchen_orders: 0,
    critical_kitchen_orders: 0,
    occupied_tables: 0,
    empty_tables: 0,
    open_service_requests: 0,
    today_revenue: 0,
  };
}

function normalizeOpsSnapshotAggregateRow(row: Partial<OpsSnapshotAggregate> | null | undefined): OpsSnapshotAggregate {
  if (!row) {
    return createEmptyOpsSnapshotAggregate();
  }
  return {
    pending_orders: Math.max(0, Number(row.pending_orders ?? 0)),
    preparing_orders: Math.max(0, Number(row.preparing_orders ?? 0)),
    served_orders: Math.max(0, Number(row.served_orders ?? 0)),
    delayed_kitchen_orders: Math.max(0, Number(row.delayed_kitchen_orders ?? 0)),
    critical_kitchen_orders: Math.max(0, Number(row.critical_kitchen_orders ?? 0)),
    occupied_tables: Math.max(0, Number(row.occupied_tables ?? 0)),
    empty_tables: Math.max(0, Number(row.empty_tables ?? 0)),
    open_service_requests: Math.max(0, Number(row.open_service_requests ?? 0)),
    today_revenue: toMoney(Number(row.today_revenue ?? 0)),
  };
}

function buildOpsSnapshotMetrics(aggregate: OpsSnapshotAggregate) {
  const pendingOrders = Math.max(0, Number(aggregate.pending_orders ?? 0));
  const preparingOrders = Math.max(0, Number(aggregate.preparing_orders ?? 0));
  const servedOrders = Math.max(0, Number(aggregate.served_orders ?? 0));
  return {
    openOrders: pendingOrders + preparingOrders + servedOrders,
    pendingOrders,
    preparingOrders,
    servedOrders,
    occupiedTables: Math.max(0, Number(aggregate.occupied_tables ?? 0)),
    emptyTables: Math.max(0, Number(aggregate.empty_tables ?? 0)),
    openServiceRequests: Math.max(0, Number(aggregate.open_service_requests ?? 0)),
    delayedKitchenOrders: Math.max(0, Number(aggregate.delayed_kitchen_orders ?? 0)),
    criticalKitchenOrders: Math.max(0, Number(aggregate.critical_kitchen_orders ?? 0)),
    todayRevenue: toMoney(Number(aggregate.today_revenue ?? 0)),
  };
}

async function getOpsSnapshotAggregateForScope(input: {
  supabase: TenantSupabaseClient;
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}): Promise<OpsSnapshotAggregate> {
  const rpcResult = (await withQueryTimeout(
    input.supabase.rpc("get_ops_snapshot_agg", {
      p_business_id: input.useLegacySchema ? null : input.businessId,
      p_branch_id: input.branchId,
    }),
  )) as {
    data: unknown[] | null;
    error: { message: string } | null;
  };

  if (!rpcResult.error) {
    const firstRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : null;
    return normalizeOpsSnapshotAggregateRow((firstRow ?? null) as Partial<OpsSnapshotAggregate> | null);
  }

  type ScopeQuery = {
    eq: (column: string, value: string) => ScopeQuery;
  };

  const applyScope = (query: unknown) => {
    let scopedQuery = query as ScopeQuery;
    if (!input.useLegacySchema && input.businessId) {
      scopedQuery = scopedQuery.eq("business_id", input.businessId);
    }
    if (input.branchId) {
      scopedQuery = scopedQuery.eq("branch_id", input.branchId);
    }
    return scopedQuery;
  };

  const now = Date.now();
  const delayedPendingBefore = new Date(now - 15 * 60_000).toISOString();
  const delayedPreparingBefore = new Date(now - 20 * 60_000).toISOString();
  const criticalPendingBefore = new Date(now - 25 * 60_000).toISOString();
  const criticalPreparingBefore = new Date(now - 35 * 60_000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  type CountQueryResult = { count: number | null };
  const queryClient = input.supabase;

  const pendingOrdersPromise = applyScope(
    queryClient.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ) as unknown as Promise<CountQueryResult>;
  const preparingOrdersPromise = applyScope(
    queryClient.from("orders").select("id", { count: "exact", head: true }).eq("status", "preparing"),
  ) as unknown as Promise<CountQueryResult>;
  const servedOrdersPromise = applyScope(
    queryClient.from("orders").select("id", { count: "exact", head: true }).in("status", ["ready", "served", "partially_paid"]),
  ) as unknown as Promise<CountQueryResult>;
  const delayedPendingPromise = applyScope(
    queryClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("created_at", delayedPendingBefore),
  ) as unknown as Promise<CountQueryResult>;
  const delayedPreparingPromise = applyScope(
    queryClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "preparing")
      .lte("created_at", delayedPreparingBefore),
  ) as unknown as Promise<CountQueryResult>;
  const criticalPendingPromise = applyScope(
    queryClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("created_at", criticalPendingBefore),
  ) as unknown as Promise<CountQueryResult>;
  const criticalPreparingPromise = applyScope(
    queryClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "preparing")
      .lte("created_at", criticalPreparingBefore),
  ) as unknown as Promise<CountQueryResult>;
  const occupiedTablesPromise = applyScope(
    queryClient.from("tables").select("id", { count: "exact", head: true }).eq("status", "occupied"),
  ) as unknown as Promise<CountQueryResult>;
  const emptyTablesPromise = applyScope(
    queryClient.from("tables").select("id", { count: "exact", head: true }).eq("status", "empty"),
  ) as unknown as Promise<CountQueryResult>;
  const openServiceRequestsPromise = applyScope(
    queryClient.from("table_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
  ) as unknown as Promise<CountQueryResult>;

  const [
    pendingOrdersResult,
    preparingOrdersResult,
    servedOrdersResult,
    delayedPendingResult,
    delayedPreparingResult,
    criticalPendingResult,
    criticalPreparingResult,
    occupiedTablesResult,
    emptyTablesResult,
    openServiceRequestsResult,
    paymentResult,
  ] = await Promise.all([
    pendingOrdersPromise,
    preparingOrdersPromise,
    servedOrdersPromise,
    delayedPendingPromise,
    delayedPreparingPromise,
    criticalPendingPromise,
    criticalPreparingPromise,
    occupiedTablesPromise,
    emptyTablesPromise,
    openServiceRequestsPromise,
    listScopedFinancePayments({
      supabase: input.supabase,
      startIso: todayStart.toISOString(),
      businessId: input.businessId,
      branchId: input.branchId,
      useLegacySchema: input.useLegacySchema,
    }),
  ]);

  const pendingOrders = pendingOrdersResult.count ?? 0;
  const preparingOrders = preparingOrdersResult.count ?? 0;
  const servedOrders = servedOrdersResult.count ?? 0;
  const delayedPendingCount = delayedPendingResult.count ?? 0;
  const delayedPreparingCount = delayedPreparingResult.count ?? 0;
  const criticalPendingCount = criticalPendingResult.count ?? 0;
  const criticalPreparingCount = criticalPreparingResult.count ?? 0;
  const occupiedTables = occupiedTablesResult.count ?? 0;
  const emptyTables = emptyTablesResult.count ?? 0;
  const openServiceRequests = openServiceRequestsResult.count ?? 0;

  const todayRevenue = paymentResult.error ? 0 : aggregateFinancePayments(paymentResult.rows).netSales;
  return normalizeOpsSnapshotAggregateRow({
    pending_orders: pendingOrders,
    preparing_orders: preparingOrders,
    served_orders: servedOrders,
    delayed_kitchen_orders: delayedPendingCount + delayedPreparingCount,
    critical_kitchen_orders: criticalPendingCount + criticalPreparingCount,
    occupied_tables: occupiedTables,
    empty_tables: emptyTables,
    open_service_requests: openServiceRequests,
    today_revenue: todayRevenue,
  });
}

export async function getOpsSummary() {
  const supabase = await getOpsDataClient();
  if (!supabase) {
    return {
      openOrders: demoOrders.filter((order) => ["pending", "preparing", "ready", "served", "partially_paid"].includes(order.status)).length,
      pendingCount: demoOrders.filter((order) => order.status === "pending").length,
      todayRevenue: 0,
      usingDemoData: true,
    };
  }

  const scope = await getDefaultBusinessScope();
  const aggregate = await getOpsSnapshotAggregateForScope({
    supabase,
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  const snapshot = buildOpsSnapshotMetrics(aggregate);

  return {
    openOrders: snapshot.openOrders,
    pendingCount: snapshot.pendingOrders,
    todayRevenue: snapshot.todayRevenue,
    usingDemoData: false,
  };
}

function isKitchenOrderDelayed(order: { status: string; created_at: string }) {
  const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  if (order.status === "pending") return elapsedMin >= 15;
  if (order.status === "preparing") return elapsedMin >= 20;
  return false;
}

function isKitchenOrderCritical(order: { status: string; created_at: string }) {
  const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  if (order.status === "pending") return elapsedMin >= 25;
  if (order.status === "preparing") return elapsedMin >= 35;
  return false;
}

export async function getOpsMetricsSnapshot() {
  const supabase = await getOpsDataClient();
  if (!supabase) {
    const pendingOrders = demoOrders.filter((order) => order.status === "pending" || order.status === "preparing");
    const delayedKitchenOrders = pendingOrders.filter((order) => isKitchenOrderDelayed(order)).length;
    const criticalKitchenOrders = pendingOrders.filter((order) => isKitchenOrderCritical(order)).length;
    const dashboard = await getDashboardData();
    return {
      openOrders: dashboard.metrics.openOrders,
      pendingOrders: dashboard.metrics.pending,
      preparingOrders: dashboard.metrics.preparing,
      servedOrders: dashboard.metrics.served,
      occupiedTables: dashboard.metrics.occupiedTables,
      emptyTables: dashboard.metrics.emptyTables,
      todayRevenue: Number(dashboard.metrics.todayRevenue.toFixed(2)),
      openServiceRequests: 0,
      delayedKitchenOrders,
      criticalKitchenOrders,
    };
  }

  const scope = await getDefaultBusinessScope();
  const cached = await getCachedOpsPageRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  const snapshot = buildOpsSnapshotMetrics(
    normalizeOpsSnapshotAggregateRow((cached?.opsAggregate ?? null) as Partial<OpsSnapshotAggregate> | null),
  );

  return {
    openOrders: snapshot.openOrders,
    pendingOrders: snapshot.pendingOrders,
    preparingOrders: snapshot.preparingOrders,
    servedOrders: snapshot.servedOrders,
    occupiedTables: snapshot.occupiedTables,
    emptyTables: snapshot.emptyTables,
    todayRevenue: snapshot.todayRevenue,
    openServiceRequests: snapshot.openServiceRequests,
    delayedKitchenOrders: snapshot.delayedKitchenOrders,
    criticalKitchenOrders: snapshot.criticalKitchenOrders,
  };
}

export async function getOpsPageSnapshot(options?: { includeSetup?: boolean }) {
  const includeSetup = options?.includeSetup ?? true;
  const supabase = await getOpsDataClient();
  if (!supabase) {
    const dashboard = await getDashboardData();
    const setup = includeSetup
      ? await getSetupChecklistSummary()
      : {
          usingDemoData: true,
          counts: { businesses: 0, products: 0, tables: 0, staff: 0, leads: 0 },
        };
    const pendingOrders = demoOrders.filter((order) => order.status === "pending" || order.status === "preparing");
    const delayedKitchenOrders = pendingOrders.filter((order) => isKitchenOrderDelayed(order)).length;
    const criticalKitchenOrders = pendingOrders.filter((order) => isKitchenOrderCritical(order)).length;

    return {
      dashboard,
      ops: {
        openOrders: dashboard.metrics.openOrders,
        pendingOrders: dashboard.metrics.pending,
        preparingOrders: dashboard.metrics.preparing,
        servedOrders: dashboard.metrics.served,
        occupiedTables: dashboard.metrics.occupiedTables,
        emptyTables: dashboard.metrics.emptyTables,
        todayRevenue: Number(dashboard.metrics.todayRevenue.toFixed(2)),
        openServiceRequests: 0,
        delayedKitchenOrders,
        criticalKitchenOrders,
      },
      setup,
    };
  }

  const [scope, setup] = await Promise.all([
    getDefaultBusinessScope(),
    includeSetup
      ? getSetupChecklistSummary()
      : Promise.resolve({
          usingDemoData: false,
          counts: { businesses: 0, products: 0, tables: 0, staff: 0, leads: 0 },
        }),
  ]);

  const cached = await getCachedOpsPageRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });

  const recentOrderRows = cached?.recentOrderRows ?? [];
  const lowStockRows = cached?.lowStockRows ?? [];
  const snapshot = buildOpsSnapshotMetrics(
    normalizeOpsSnapshotAggregateRow((cached?.opsAggregate ?? null) as Partial<OpsSnapshotAggregate> | null),
  );
  const pendingCount = snapshot.pendingOrders;
  const preparingCount = snapshot.preparingOrders;
  const servedCount = snapshot.servedOrders;
  const dashboard = {
    usingDemoData: false,
    metrics: {
      openOrders: snapshot.openOrders,
      pending: pendingCount,
      preparing: preparingCount,
      served: servedCount,
      occupiedTables: snapshot.occupiedTables,
      emptyTables: snapshot.emptyTables,
      todayRevenue: snapshot.todayRevenue,
    },
    recentOrders: ((recentOrderRows ?? []) as OrderRow[]).map((row) => ({
      id: row.id,
      check_number: row.check_number ?? null,
      table_id: row.table_id,
      table_number: getTableNumber(row.tables),
      table_name: getTableName(row.tables),
      table_zone_name: getTableZoneName(row.tables),
      channel: row.channel ?? "dine_in",
      customer_name: row.customer_name ?? null,
      total_price: Number(row.total_price),
      final_price: Number(row.final_price ?? row.total_price),
      status: row.status,
      created_at: row.created_at,
      items: [],
    })),
    lowStockProducts: (lowStockRows ?? []) as Product[],
  };

  return {
    dashboard,
    ops: {
      openOrders: snapshot.openOrders,
      pendingOrders: snapshot.pendingOrders,
      preparingOrders: snapshot.preparingOrders,
      servedOrders: snapshot.servedOrders,
      occupiedTables: snapshot.occupiedTables,
      emptyTables: snapshot.emptyTables,
      todayRevenue: snapshot.todayRevenue,
      openServiceRequests: snapshot.openServiceRequests,
      delayedKitchenOrders: snapshot.delayedKitchenOrders,
      criticalKitchenOrders: snapshot.criticalKitchenOrders,
    },
    setup,
  };
}

export async function getDashboardData() {
  const supabase = await getOpsDataClient();
  if (!supabase) {
    const pending = demoOrders.filter((order) => order.status === "pending").length;
    const preparing = demoOrders.filter((order) => order.status === "preparing").length;
    const served = demoOrders.filter(
      (order) => order.status === "served" || order.status === "ready" || order.status === "partially_paid",
    ).length;
    const occupiedTables = demoTables.filter((table) => table.status === "occupied").length;
    const emptyTables = demoTables.filter((table) => table.status === "empty").length;
    const lowStockProducts = demoProducts
      .filter((product) => product.stock_count <= 10)
      .sort((a, b) => a.stock_count - b.stock_count);

    return {
      usingDemoData: true,
      metrics: {
        openOrders: pending + preparing + served,
        pending,
        preparing,
        served,
        occupiedTables,
        emptyTables,
        todayRevenue: 0,
      },
      recentOrders: demoOrders.slice(0, 8),
      lowStockProducts,
    };
  }

  const scope = await getDefaultBusinessScope();
  const cached = await getCachedOpsPageRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  const recentOrderRows = cached?.recentOrderRows ?? [];
  const lowStockRows = cached?.lowStockRows ?? [];
  const snapshot = buildOpsSnapshotMetrics(
    normalizeOpsSnapshotAggregateRow((cached?.opsAggregate ?? null) as Partial<OpsSnapshotAggregate> | null),
  );

  const recentOrders = ((recentOrderRows ?? []) as OrderRow[]).map((row) => ({
    id: row.id,
    check_number: row.check_number ?? null,
    table_id: row.table_id,
    table_number: getTableNumber(row.tables),
    table_name: getTableName(row.tables),
    table_zone_name: getTableZoneName(row.tables),
    channel: row.channel ?? "dine_in",
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    delivery_address: row.delivery_address ?? null,
    courier_id: row.courier_id ?? null,
    courier_name: row.courier_name ?? null,
    fulfillment_status: row.fulfillment_status ?? "not_applicable",
    total_price: Number(row.total_price),
    final_price: Number(row.final_price ?? row.total_price),
    status: row.status,
    created_at: row.created_at,
    items: [],
  }));

  return {
    usingDemoData: false,
    metrics: {
      openOrders: snapshot.openOrders,
      pending: snapshot.pendingOrders,
      preparing: snapshot.preparingOrders,
      served: snapshot.servedOrders,
      occupiedTables: snapshot.occupiedTables,
      emptyTables: snapshot.emptyTables,
      todayRevenue: snapshot.todayRevenue,
    },
    recentOrders,
    lowStockProducts: (lowStockRows ?? []) as Product[],
  };
}

export async function getAlertDispatchByType(alertType: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { dispatch: null as AlertDispatch | null, usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("alert_dispatches")
    .select("id, alert_type, last_sent_at, last_payload, created_at, updated_at")
    .eq("alert_type", alertType)
    .maybeSingle();

  if (error) {
    return { dispatch: null as AlertDispatch | null, usingDemoData: false };
  }

  return {
    dispatch: (data as AlertDispatch | null) ?? null,
    usingDemoData: false,
  };
}

export async function setAlertDispatch(alertType: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda alert dispatch pasif." };
  }

  const { error } = await supabase.from("alert_dispatches").upsert(
    {
      alert_type: alertType,
      last_sent_at: new Date().toISOString(),
      last_payload: payload,
    },
    { onConflict: "alert_type" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

const demoSalesLeads: SalesLead[] = [
  {
    id: "demo-lead-1",
    company_name: "Mavi Fincan Cafe",
    contact_name: "Elif Yilmaz",
    phone: "+90 532 111 11 11",
    email: "elif@mavifincan.com",
    branch_count: 2,
    note: "QR menÃƒÂ¼ ve stok takibiyle ilgileniyor.",
    status: "qualified",
    source: "landing_form",
    created_at: minutesAgo(180),
    updated_at: minutesAgo(120),
  },
  {
    id: "demo-lead-2",
    company_name: "Gusto Bakery",
    contact_name: "Burak Aslan",
    phone: "+90 533 222 22 22",
    email: "burak@gusto.com",
    branch_count: 1,
    note: "Kasa ve vardiya modulu soruldu.",
    status: "contacted",
    source: "whatsapp_cta",
    created_at: minutesAgo(70),
    updated_at: minutesAgo(50),
  },
];

const demoLeadNotes: SalesLeadNote[] = [
  {
    id: "demo-lead-note-1",
    lead_id: "demo-lead-1",
    note: "Cuma gunu demo takvimi iÃƒÂ§in aranacak.",
    created_at: minutesAgo(110),
  },
  {
    id: "demo-lead-note-2",
    lead_id: "demo-lead-2",
    note: "Ilk Ã…Å¸ube iÃƒÂ§in QR menÃƒÂ¼ ve vardiya takibi oncelikli.",
    created_at: minutesAgo(35),
  },
];

const demoMediaAssets: MediaAsset[] = [
  {
    id: "demo-media-1",
    title: "Cloud POS Hero",
    file_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    alt_text: "Cafe operasyon ekrani",
    kind: "image",
    created_at: minutesAgo(500),
    updated_at: minutesAgo(500),
  },
];

const demoBlogPosts: BlogPost[] = [
  {
    id: "demo-blog-1",
    title: "Cafe operasyonunda ilk dijital kurulum nasÃ„Â±l yapilir?",
    slug: "cafe-operasyonunda-ilk-dijital-kurulum",
    excerpt: "Masa, ÃƒÂ¼rÃƒÂ¼n, ekip ve raporlama akislarini tek gunde nasÃ„Â±l toparlayabilecegini anlatiyor.",
    body: "Cloud POS ile ilk kurulumda ÃƒÂ¶nce iÃ…Å¸letme yapisini, sonra masa planini, ardindan ÃƒÂ¼rÃƒÂ¼n ve personel rollerini tanimlayin. Bu akÃ„Â±Ã…Å¸Ã„Â± takip ettiginizde landing, demo ve operasyon paneli ayni veri modelini kullanir.",
    cover_image_url: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80",
    status: "published",
    published_at: minutesAgo(1440),
    created_at: minutesAgo(1440),
    updated_at: minutesAgo(1440),
  },
];

export async function createSalesLead(input: {
  companyName: string;
  contactName: string;
  phone?: string;
  email?: string;
  branchCount?: number;
  note?: string;
  source?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda lead kaydÃ„Â± veritabanina yazilamaz." };
  }

  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!companyName || !contactName) {
    return { ok: false, error: "Ã„Â°Ã…Å¸letme adi ve yetkili gerekli." };
  }

  const branchCount = Math.max(1, Number(input.branchCount ?? 1) || 1);
  const { data, error } = await supabase
    .from("sales_leads")
    .insert({
      company_name: companyName,
      contact_name: contactName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      branch_count: branchCount,
      note: input.note?.trim() || null,
      source: input.source?.trim() || "landing_form",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "sales_lead",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { companyName, contactName, branchCount },
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function listSalesLeads() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { leads: demoSalesLeads, usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, company_name, contact_name, phone, email, branch_count, note, status, source, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { leads: [] as SalesLead[], usingDemoData: false };
  }

  return { leads: (data ?? []) as SalesLead[], usingDemoData: false };
}

export async function updateSalesLeadStatus(leadId: string, status: SalesLeadStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda lead guncelleme pasif." };
  }

  const { error } = await supabase.from("sales_leads").update({ status }).eq("id", leadId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "sales_lead",
    entityId: leadId,
    action: "status_update",
    details: { status },
  });

  return { ok: true };
}

export async function getSetupChecklistSummary() {
  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const cached = await getCachedSetupChecklistSummary();

    return {
      usingDemoData: false,
      counts: {
        businesses: cached?.businesses ?? 0,
        products: cached?.products ?? 0,
        tables: cached?.tables ?? 0,
        staff: cached?.staff ?? 0,
        leads: cached?.leads ?? 0,
      },
    };
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return {
      usingDemoData: true,
      counts: {
        businesses: 1,
        products: demoProducts.length,
        tables: demoTables.length,
        staff: demoStaffAccounts.length,
        leads: demoSalesLeads.length,
      },
    };
  }

  const [
    { count: businesses },
    { count: products },
    { count: tables },
    { count: staff },
    { count: leads },
  ] = await Promise.all([
    authClient.from("businesses").select("id", { count: "exact", head: true }).eq("is_active", true),
    authClient.from("products").select("id", { count: "exact", head: true }),
    authClient.from("tables").select("id", { count: "exact", head: true }),
    authClient.from("profiles").select("id", { count: "exact", head: true }),
    authClient.from("sales_leads").select("id", { count: "exact", head: true }),
  ]);

  return {
    usingDemoData: false,
    counts: {
      businesses: businesses ?? 0,
      products: products ?? 0,
      tables: tables ?? 0,
      staff: staff ?? 0,
      leads: leads ?? 0,
    },
  };
}

export async function getLandingContent() {
  return getSitePageContent("home");
}

export async function getDemoPageContent() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { content: defaultDemoPageContent, usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("site_content")
    .select("id, key, content, created_at, updated_at")
    .eq("key", "demo_page")
    .maybeSingle();

  if (error) {
    return { content: defaultDemoPageContent, usingDemoData: false };
  }

  const row = data as SiteContent | null;
  return {
    content: normalizeDemoPageContent((row?.content as Partial<DemoPageContent> | null) ?? null),
    usingDemoData: false,
  };
}

function normalizeSitePageSlug(slug?: string) {
  const normalized = (slug || "home")
    .trim()
    .toLowerCase()
    .replace(/Ã„Â±/g, "i")
    .replace(/Ã„Å¸/g, "g")
    .replace(/ÃƒÂ¼/g, "u")
    .replace(/Ã…Å¸/g, "s")
    .replace(/ÃƒÂ¶/g, "o")
    .replace(/ÃƒÂ§/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "home";
}

function buildSitePageKey(slug?: string) {
  const normalizedSlug = normalizeSitePageSlug(slug);
  return normalizedSlug === "home" ? "landing_page" : `site_page:${normalizedSlug}`;
}

async function getCachedOpsPageRow(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}) {
  const queryOpsPageRow = async (supabase: TenantSupabaseClient) => {
    const recentOrderLimit = 6;

    const [opsAggregate, { data: recentOrderRows }, { data: lowStockRows }] = await Promise.all([
      getOpsSnapshotAggregateForScope({
        supabase,
        businessId: input.businessId,
        branchId: input.branchId,
        useLegacySchema: input.useLegacySchema,
      }),
      !input.useLegacySchema && input.businessId
        ? (input.branchId
            ? supabase
                .from("orders")
                .select("id, check_number, table_id, total_price, final_price, channel, customer_name, status, created_at, tables(table_number,name,table_zones(name))")
                .eq("business_id", input.businessId)
                .eq("branch_id", input.branchId)
                .order("created_at", { ascending: false })
                .limit(recentOrderLimit)
            : supabase
                .from("orders")
                .select("id, check_number, table_id, total_price, final_price, channel, customer_name, status, created_at, tables(table_number,name,table_zones(name))")
                .eq("business_id", input.businessId)
                .order("created_at", { ascending: false })
                .limit(recentOrderLimit))
        : supabase
            .from("orders")
            .select("id, check_number, table_id, total_price, final_price, channel, customer_name, status, created_at, tables(table_number,name,table_zones(name))")
            .order("created_at", { ascending: false })
            .limit(recentOrderLimit),
      !input.useLegacySchema && input.businessId
        ? supabase
            .from("products")
            .select("id, name, stock_count")
            .eq("business_id", input.businessId)
            .lte("stock_count", 10)
            .order("stock_count", { ascending: true })
            .limit(4)
        : supabase.from("products").select("id, name, stock_count").lte("stock_count", 10).order("stock_count", { ascending: true }).limit(4),
    ]);

    return {
      opsAggregate,
      recentOrderRows: (recentOrderRows ?? []) as Array<OrderRow>,
      lowStockRows: (lowStockRows ?? []) as Array<Pick<Product, "id" | "name" | "stock_count">>,
    };
  };

  const serviceClient = getRequestScopedServiceDataClient();
  if (serviceClient) {
    const cacheKey = `ops-page:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
    const reader = unstable_cache(
      async () => queryOpsPageRow(serviceClient),
      [cacheKey],
      { revalidate: 12, tags: ["dashboard-snapshot"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return null;
  }

  return queryOpsPageRow(authClient);
}

const getCachedSetupChecklistSummary = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const [
      { count: businesses },
      { count: products },
      { count: tables },
      { count: staff },
      { count: leads },
    ] = await Promise.all([
      supabase.from("businesses").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("tables").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("sales_leads").select("id", { count: "exact", head: true }),
    ]);

    return {
      businesses: businesses ?? 0,
      products: products ?? 0,
      tables: tables ?? 0,
      staff: staff ?? 0,
      leads: leads ?? 0,
    };
  },
  ["setup-checklist-summary"],
  { revalidate: 30, tags: ["setup-checklist-summary"] },
);

const getCachedSitePagesRows = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("site_content")
      .select("key, content, updated_at")
      .or("key.eq.landing_page,key.like.site_page:%")
      .order("updated_at", { ascending: false });

    if (error) {
      return { error: true as const, rows: [] };
    }

    return {
      error: false as const,
      rows: (data ?? []) as Array<{ key: string; content: Partial<LandingContent> | null; updated_at: string | null }>,
    };
  },
  ["site-content-pages"],
  { tags: ["site-content-pages"] },
);

async function getCachedSitePageRow(slug?: string) {
  const key = buildSitePageKey(slug);
  const cachedReader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from("site_content")
        .select("id, key, content, created_at, updated_at")
        .eq("key", key)
        .maybeSingle();

      if (error) {
        return { error: true as const, row: null };
      }

      return { error: false as const, row: (data as SiteContent | null) ?? null };
    },
    [`site-content-page-${key}`],
    { tags: ["site-content-pages", `site-content-page:${key}`] },
  );

  return cachedReader();
}

async function readSitePageRow(slug?: string) {
  const key = buildSitePageKey(slug);
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("site_content")
    .select("id, key, content, created_at, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return { error: true as const, row: null };
  }

  return { error: false as const, row: (data as SiteContent | null) ?? null };
}

export async function listSitePages() {
  const cached = await getCachedSitePagesRows();
  if (!cached) {
    return {
      pages: [
        {
          slug: "home",
          path: "/",
          key: "landing_page",
          title: defaultLandingContent.pageTitle,
          updatedAt: null,
          isHome: true,
        },
      ],
      usingDemoData: true,
    };
  }

  if (cached.error) {
    return { pages: [] as Array<{ slug: string; path: string; key: string; title: string; updatedAt: string | null; isHome: boolean }>, usingDemoData: false };
  }

  const rows = cached.rows;
  const pages = rows.map((row) => {
    const slug = row.key === "landing_page" ? "home" : row.key.replace(/^site_page:/, "");
    const normalizedContent = normalizeLandingContent(row.content ?? null);
    return {
      slug,
      path: slug === "home" ? "/" : `/${slug}`,
      key: row.key,
      title: normalizedContent.pageTitle || (slug === "home" ? "Ana Sayfa" : slug),
      updatedAt: row.updated_at ?? null,
      isHome: slug === "home",
    };
  });

  if (!pages.some((page) => page.slug === "home")) {
    pages.unshift({
      slug: "home",
      path: "/",
      key: "landing_page",
      title: defaultLandingContent.pageTitle,
      updatedAt: null,
      isHome: true,
    });
  }

  return { pages, usingDemoData: false };
}

export async function getSitePageContent(slug?: string) {
  const normalizedSlug = normalizeSitePageSlug(slug);
  const cached =
    normalizedSlug === "home"
      ? await readSitePageRow(slug)
      : await getCachedSitePageRow(slug);
  if (!cached) {
    return { content: defaultLandingContent, usingDemoData: true };
  }

  if (cached.error) {
    return { content: defaultLandingContent, usingDemoData: false, found: false };
  }

  const row = cached.row;
  return {
    content: normalizeLandingContent((row?.content as Partial<LandingContent> | null) ?? null),
    usingDemoData: false,
    found: Boolean(row),
  };
}

export async function createSitePage(input: { slug: string; pageTitle: string }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sayfa olusturulamaz." };
  }

  const requestedSlug = input.slug?.trim() ? input.slug : input.pageTitle;
  const slug = normalizeSitePageSlug(requestedSlug);
  const key = buildSitePageKey(slug);
  const existing = await supabase
    .from("site_content")
    .select("key")
    .eq("key", key)
    .maybeSingle();

  if (existing.data) {
    return { ok: false, error: "Bu slug ile bir sayfa zaten var." };
  }

  const content = normalizeLandingContent({
    ...emptyLandingContent,
    pageTitle: input.pageTitle.trim() || (slug === "home" ? "Ana Sayfa" : requestedSlug?.trim() || slug),
    sections: [],
  });

  const { error } = await supabase.from("site_content").insert({
    key,
    content,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "site_content",
    entityId: key,
    action: "create",
    details: { key, slug },
  });

  revalidateTag("site-content-pages", "max");
  revalidateTag(`site-content-page:${key}`, "max");

  return { ok: true, slug };
}

export async function updateLandingContent(content: LandingContent, slug?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda landing icerigi guncellenemez." };
  }

  const normalized = normalizeLandingContent(content);
  const { error } = await supabase.from("site_content").upsert(
    {
      key: buildSitePageKey(slug),
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "site_content",
    entityId: buildSitePageKey(slug),
    action: "update",
    details: { key: buildSitePageKey(slug), slug: normalizeSitePageSlug(slug) },
  });

  const key = buildSitePageKey(slug);
  revalidateTag("site-content-pages", "max");
  revalidateTag(`site-content-page:${key}`, "max");

  return { ok: true };
}

export async function deleteSitePage(slug?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sayfa silinemez." };
  }

  const normalizedSlug = normalizeSitePageSlug(slug);
  if (normalizedSlug === "home") {
    return { ok: false, error: "Ana sayfa silinemez." };
  }

  const key = buildSitePageKey(normalizedSlug);
  const { error } = await supabase.from("site_content").delete().eq("key", key);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "site_content",
    entityId: key,
    action: "delete",
    details: { key, slug: normalizedSlug },
  });

  revalidateTag("site-content-pages", "max");
  revalidateTag(`site-content-page:${key}`, "max");

  return { ok: true };
}

export async function resetSitePageToEmpty(slug?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sayfa sifirlanamaz." };
  }

  const normalizedSlug = normalizeSitePageSlug(slug);
  const key = buildSitePageKey(normalizedSlug);
  const pageTitle = normalizedSlug === "home" ? "Ana Sayfa" : normalizedSlug;
  const content = normalizeLandingContent({
    ...emptyLandingContent,
    pageTitle,
    sections: [],
  });

  const { error } = await supabase.from("site_content").upsert(
    {
      key,
      content,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "site_content",
    entityId: key,
    action: "reset",
    details: { key, slug: normalizedSlug },
  });

  revalidateTag("site-content-pages", "max");
  revalidateTag(`site-content-page:${key}`, "max");

  return { ok: true };
}

export async function updateDemoPageContent(content: DemoPageContent) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda demo icerigi guncellenemez." };
  }

  const normalized = normalizeDemoPageContent(content);
  const { error } = await supabase.from("site_content").upsert(
    {
      key: "demo_page",
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "site_content",
    entityId: "demo_page",
    action: "update",
    details: { key: "demo_page" },
  });

  return { ok: true };
}

export async function getApplicationSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { settings: defaultApplicationSettings, usingDemoData: true };
  }

  const cached = await getCachedApplicationSettingsRow();
  if (!cached || cached.error) {
    return { settings: defaultApplicationSettings, usingDemoData: false };
  }

  return {
    settings: normalizeApplicationSettings((cached.row?.content as Partial<ApplicationSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export async function updateApplicationSettings(settings: ApplicationSettings) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo fallback modunda uygulama ayarlari guncellenemez." };
  }

  const normalized = normalizeApplicationSettings(settings);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "application_settings",
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTag("app-settings-application", "max");

  await logAuditEvent({
    entityType: "app_settings",
    entityId: "application_settings",
    action: "update",
    details: normalized,
  });

  return { ok: true };
}

export async function ensureDemoOperationsData() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: true, usingDemoData: true };
  }

  const [{ tables }, { products }, { session }, scope] = await Promise.all([
    getTableMap(),
    getProductManagementData(),
    getCurrentCashSession(),
    getDefaultBusinessScope(),
  ]);

  if (!session) {
    await openCashSession(500, "Demo mod kasa oturumu");
  }

  if (products.length === 0 || tables.length === 0) {
    return { ok: false, error: "Demo mod iÃƒÂ§in en az bir masa ve ÃƒÂ¼rÃƒÂ¼n olmali." };
  }

  const primary = products[0];
  const secondary = products[1] ?? products[0];
  const makeItems = (quantityOne = 1, quantityTwo = 1): OrderItem[] => [
    {
      product_id: primary.id,
      name: primary.name,
      quantity: quantityOne,
      unit_price: Number(primary.price),
      line_total: Number(primary.price) * quantityOne,
    },
    {
      product_id: secondary.id,
      name: secondary.name,
      quantity: quantityTwo,
      unit_price: Number(secondary.price),
      line_total: Number(secondary.price) * quantityTwo,
    },
  ];

  const availableTables = [...tables].sort((a, b) => a.table_number - b.table_number);
  const tableOne = availableTables[0] ?? null;
  const tableTwo = availableTables[1] ?? tableOne;
  const businessId = tableOne?.business_id ?? scope.businessId ?? undefined;
  const demoNames = [
    "Demo Mutfak Bekleyen",
    "Demo Mutfak Hazirlaniyor",
    "Demo Kasa Testi",
    "Demo Split Ornegi",
    "Demo Paket Musterisi",
  ];

  let existingQuery = supabase.from("orders").select("id, customer_name").in("customer_name", demoNames);
  if (!scope.useLegacySchema && scope.businessId) {
    existingQuery = existingQuery.eq("business_id", scope.businessId);
  }
  const { data: existingRows } = await existingQuery;
  const existingNames = new Set((existingRows ?? []).map((row) => String((row as { customer_name?: string | null }).customer_name ?? "")));

  function getCreatedOrderId(result: Awaited<ReturnType<typeof createOrder>>) {
    return result.ok && "id" in result && typeof result.id === "string" ? result.id : null;
  }

  if (tableOne && !existingNames.has("Demo Mutfak Bekleyen")) {
    const items = makeItems(1, 1);
    await createOrder({
      tableId: tableOne.id,
      businessId,
      items,
      totalPrice: items.reduce((sum, item) => sum + item.line_total, 0),
      channel: "dine_in",
      customerName: "Demo Mutfak Bekleyen",
    });
  }

  if (tableTwo && !existingNames.has("Demo Mutfak Hazirlaniyor")) {
    const items = makeItems(2, 1);
    const created = await createOrder({
      tableId: tableTwo.id,
      businessId,
      items,
      totalPrice: items.reduce((sum, item) => sum + item.line_total, 0),
      channel: "dine_in",
      customerName: "Demo Mutfak Hazirlaniyor",
    });
    const orderId = getCreatedOrderId(created);
    if (orderId) {
      await updateOrderStatus(orderId, "preparing");
    }
  }

  if (tableOne && !existingNames.has("Demo Kasa Testi")) {
    const items = makeItems(1, 2);
    const created = await createOrder({
      tableId: tableOne.id,
      businessId,
      items,
      totalPrice: items.reduce((sum, item) => sum + item.line_total, 0),
      channel: "dine_in",
      customerName: "Demo Kasa Testi",
    });
    const orderId = getCreatedOrderId(created);
    if (orderId) {
      await updateOrderStatus(orderId, "preparing");
      await updateOrderStatus(orderId, "served");
      await applyOrderFinancials({
        orderId,
        discountAmount: 0,
        serviceFee: 15,
      });
    }
  }

  if (tableTwo && !existingNames.has("Demo Split Ornegi")) {
    const items = makeItems(2, 1);
    const total = items.reduce((sum, item) => sum + item.line_total, 0);
    const created = await createOrder({
      tableId: tableTwo.id,
      businessId,
      items,
      totalPrice: total,
      channel: "dine_in",
      customerName: "Demo Split Ornegi",
    });
    const orderId = getCreatedOrderId(created);
    if (orderId) {
      await updateOrderStatus(orderId, "preparing");
      await updateOrderStatus(orderId, "served");
      const half = Math.round((total / 2) * 100) / 100;
      await completeOrderPayment({ orderId, method: "cash", amount: half, note: "DEMO split cash" });
    }
  }

  if (!existingNames.has("Demo Paket Musterisi")) {
    const items = makeItems(1, 1);
    await createOrder({
      businessId,
      items,
      totalPrice: items.reduce((sum, item) => sum + item.line_total, 0),
      channel: "delivery",
      customerName: "Demo Paket Musterisi",
      customerPhone: "+90 555 111 22 33",
      deliveryAddress: "Demo Mahallesi No:1",
      deliveryNote: "Kapidan teslim",
    });
  }

  const { couriers } = await listCouriers();
  if (couriers.length === 0) {
    await createCourier({ fullName: "Demo Kurye", phone: "+90 555 000 99 88" });
  }

  return { ok: true, usingDemoData: false };
}

export async function clearDemoOperationsData() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo fallback modunda kayÃ„Â±t temizleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  const demoNames = [
    "Demo Mutfak Bekleyen",
    "Demo Mutfak Hazirlaniyor",
    "Demo Kasa Testi",
    "Demo Split Ornegi",
    "Demo Paket Musterisi",
  ];

  let ordersQuery = supabase
    .from("orders")
    .select("id, table_id")
    .in("customer_name", demoNames);
  if (!scope.useLegacySchema && scope.businessId) {
    ordersQuery = ordersQuery.eq("business_id", scope.businessId);
  }
  const { data: orderRows, error: orderFindError } = await ordersQuery;
  if (orderFindError) {
    return { ok: false, error: orderFindError.message };
  }

  const orderIds = ((orderRows ?? []) as Array<{ id: string; table_id: string | null }>).map((row) => row.id);
  const tableIds = ((orderRows ?? []) as Array<{ id: string; table_id: string | null }>)
    .map((row) => row.table_id)
    .filter((value): value is string => Boolean(value));

  if (orderIds.length > 0) {
    await supabase.from("order_item_modifiers").delete().in("order_id", orderIds);
    await supabase.from("order_items").delete().in("order_id", orderIds);
    await supabase.from("payments").delete().in("order_id", orderIds);

    let deleteOrders = supabase.from("orders").delete().in("id", orderIds);
    if (!scope.useLegacySchema && scope.businessId) {
      deleteOrders = deleteOrders.eq("business_id", scope.businessId);
    }
    const { error: deleteOrdersError } = await deleteOrders;
    if (deleteOrdersError) {
      return { ok: false, error: deleteOrdersError.message };
    }
  }

  if (tableIds.length > 0) {
    await supabase.from("tables").update({ status: "empty" as TableStatus }).in("id", tableIds);
  }

  let deleteCouriers = supabase.from("couriers").delete().eq("full_name", "Demo Kurye");
  if (!scope.useLegacySchema && scope.businessId) {
    deleteCouriers = deleteCouriers.eq("business_id", scope.businessId);
  }
  await deleteCouriers;

  let deleteSessions = supabase.from("cash_register_sessions").delete().eq("note", "Demo mod kasa oturumu");
  if (!scope.useLegacySchema && scope.businessId) {
    deleteSessions = deleteSessions.eq("business_id", scope.businessId);
  }
  await deleteSessions;

  await logAuditEvent({
    entityType: "app_settings",
    entityId: "application_settings",
    action: "demo_cleanup",
    details: { clearedOrders: orderIds.length, clearedTables: tableIds.length },
  });

  return { ok: true, clearedOrders: orderIds.length };
}

export async function clearBusinessOperationalData(options?: { deleteTables?: boolean }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo fallback modunda iÃ…Å¸letme temizligi pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const deleteTables = Boolean(options?.deleteTables);

  const { data: tableRows, error: tableRowsError } = await supabase
    .from("tables")
    .select("id")
    .eq("business_id", scope.businessId);
  if (tableRowsError) {
    return { ok: false, error: tableRowsError.message };
  }

  const tableIds = ((tableRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  const { data: orderRows, error: orderRowsError } = await supabase
    .from("orders")
    .select("id")
    .eq("business_id", scope.businessId);
  if (orderRowsError) {
    return { ok: false, error: orderRowsError.message };
  }

  const orderIds = ((orderRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  if (tableIds.length > 0) {
    const { error: tableRequestsError } = await supabase
      .from("table_requests")
      .delete()
      .in("table_id", tableIds);
    if (tableRequestsError) {
      return { ok: false, error: tableRequestsError.message };
    }
  }

  if (orderIds.length > 0) {
    const { error: modifierDeleteError } = await supabase
      .from("order_item_modifiers")
      .delete()
      .in("order_id", orderIds);
    if (modifierDeleteError) {
      return { ok: false, error: modifierDeleteError.message };
    }

    const { error: itemDeleteError } = await supabase
      .from("order_items")
      .delete()
      .in("order_id", orderIds);
    if (itemDeleteError) {
      return { ok: false, error: itemDeleteError.message };
    }

    const { error: paymentDeleteError } = await supabase
      .from("payments")
      .delete()
      .in("order_id", orderIds);
    if (paymentDeleteError) {
      return { ok: false, error: paymentDeleteError.message };
    }

    const { error: orderDeleteError } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds)
      .eq("business_id", scope.businessId);
    if (orderDeleteError) {
      return { ok: false, error: orderDeleteError.message };
    }
  }

  const { error: courierDeleteError } = await supabase
    .from("couriers")
    .delete()
    .eq("business_id", scope.businessId);
  if (courierDeleteError) {
    return { ok: false, error: courierDeleteError.message };
  }

  const { error: sessionDeleteError } = await supabase
    .from("cash_register_sessions")
    .delete()
    .eq("business_id", scope.businessId);
  if (sessionDeleteError) {
    return { ok: false, error: sessionDeleteError.message };
  }

  if (deleteTables) {
    if (tableIds.length > 0) {
      const { error: tableDeleteError } = await supabase
        .from("tables")
        .delete()
        .in("id", tableIds)
        .eq("business_id", scope.businessId);
      if (tableDeleteError) {
        return { ok: false, error: tableDeleteError.message };
      }
    }
  } else if (tableIds.length > 0) {
    const { error: tableResetError } = await supabase
      .from("tables")
      .update({ status: "empty" as TableStatus })
      .in("id", tableIds)
      .eq("business_id", scope.businessId);
    if (tableResetError) {
      return { ok: false, error: tableResetError.message };
    }
  }

  await logAuditEvent({
    entityType: "business",
    entityId: scope.businessId,
    action: deleteTables ? "reset_operational_data_and_tables" : "reset_operational_data",
    details: {
      clearedOrders: orderIds.length,
      clearedTables: deleteTables ? tableIds.length : 0,
      resetTableStatuses: deleteTables ? 0 : tableIds.length,
    },
  });

  revalidateOperationsCaches();
  return {
    ok: true,
    clearedOrders: orderIds.length,
    clearedTables: deleteTables ? tableIds.length : 0,
    resetTableStatuses: deleteTables ? 0 : tableIds.length,
  };
}

export async function getGeneralSettings(options?: { scope?: GeneralSettingsScope }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { settings: defaultGeneralSettings, usingDemoData: true };
  }

  const scope = options?.scope ?? "global";
  const activeBusinessSlug = scope === "active-business" ? await getActiveBusinessSlug() : undefined;
  const settingsKey = buildGeneralSettingsKey(scope, activeBusinessSlug);

  let cached = await getCachedGeneralSettingsRowByKey(settingsKey);
  if (scope === "active-business" && (!cached || cached.error || !cached.row)) {
    cached = await getCachedGeneralSettingsRowByKey("general_settings");
  }

  if (!cached || cached.error) {
    return { settings: defaultGeneralSettings, usingDemoData: false };
  }

  return {
    settings: normalizeGeneralSettings((cached.row?.content as Partial<GeneralSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export async function updateGeneralSettings(settings: GeneralSettings, options?: { scope?: GeneralSettingsScope }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda genel ayarlar guncellenemez." };
  }

  const scope = options?.scope ?? "global";
  const activeBusinessSlug = scope === "active-business" ? await getActiveBusinessSlug() : undefined;
  const settingsKey = buildGeneralSettingsKey(scope, activeBusinessSlug);
  const normalized = normalizeGeneralSettings(settings);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: settingsKey,
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTag("app-settings-general", "max");
  revalidateTag(`app-settings-general:${settingsKey}`, "max");

  await logAuditEvent({
    entityType: "app_settings",
    entityId: settingsKey,
    action: "update",
    details: { key: settingsKey, scope },
  });

  return { ok: true };
}

export async function getSmtpSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { settings: defaultSmtpSettings, usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("id, key, content, created_at, updated_at")
    .eq("key", "smtp_settings")
    .maybeSingle();

  if (error) {
    return { settings: defaultSmtpSettings, usingDemoData: false };
  }

  const row = data as SiteContent | null;
  return {
    settings: normalizeSmtpSettings((row?.content as Partial<SmtpSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export async function updateSmtpSettings(settings: SmtpSettings) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda SMTP ayarlari guncellenemez." };
  }

  const normalized = normalizeSmtpSettings(settings);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "smtp_settings",
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "app_settings",
    entityId: "smtp_settings",
    action: "update",
    details: { key: "smtp_settings" },
  });

  return { ok: true };
}

export async function getSeoSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { settings: defaultSeoSettings, usingDemoData: true };
  }

  const cached = await getCachedSeoSettingsRow();
  if (!cached || cached.error) {
    return { settings: defaultSeoSettings, usingDemoData: false };
  }

  return {
    settings: normalizeSeoSettings((cached.row?.content as Partial<SeoSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export async function updateSeoSettings(settings: SeoSettings) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda SEO ayarlari guncellenemez." };
  }

  const normalized = normalizeSeoSettings(settings);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "seo_settings",
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTag("app-settings-seo", "max");

  await logAuditEvent({
    entityType: "app_settings",
    entityId: "seo_settings",
    action: "update",
    details: { key: "seo_settings" },
  });

  return { ok: true };
}

export async function listMediaAssets() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { assets: demoMediaAssets, usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("media_assets")
    .select("id, title, file_url, alt_text, kind, storage_bucket, storage_path, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { assets: [] as MediaAsset[], usingDemoData: false };
  }

  return { assets: (data ?? []) as MediaAsset[], usingDemoData: false };
}

export async function createMediaAsset(input: {
  title: string;
  fileUrl: string;
  altText?: string;
  kind?: MediaAsset["kind"];
  storageBucket?: string | null;
  storagePath?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda medya eklenemez." };
  }

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      title: input.title.trim(),
      file_url: input.fileUrl.trim(),
      alt_text: input.altText?.trim() || null,
      kind: input.kind ?? "image",
      storage_bucket: input.storageBucket ?? null,
      storage_path: input.storagePath ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "media_asset",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { title: input.title.trim() },
  });

  return { ok: true };
}

function sanitizeMediaFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferTitleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[-_]+/g, " ").trim();
}

export async function uploadMediaFile(file: File) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda dosya yuklenemez." };
  }

  if (!file || file.size <= 0) {
    return { ok: false, error: "Gecerli bir dosya secin." };
  }

  const bucket = process.env.SUPABASE_MEDIA_BUCKET || "media";
  const safeName = sanitizeMediaFilename(file.name || "upload");
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName || "upload"}`;

  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) {
    return { ok: false, error: bucketListError.message };
  }

  if (!(buckets ?? []).some((item) => item.name === bucket)) {
    const { error: bucketCreateError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    if (bucketCreateError && !bucketCreateError.message.toLowerCase().includes("already exists")) {
      return { ok: false, error: bucketCreateError.message };
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    ok: true,
    fileUrl: data.publicUrl,
    storageBucket: bucket,
    storagePath: path,
    title: inferTitleFromFilename(file.name || "Dosya"),
  };
}

export async function deleteMediaAsset(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda medya silinemez." };
  }

  const { data: asset, error: fetchError } = await supabase
    .from("media_assets")
    .select("id, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (asset?.storage_bucket && asset.storage_path) {
    const { error: storageError } = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
    if (storageError && !storageError.message.toLowerCase().includes("not found")) {
      return { ok: false, error: storageError.message };
    }
  }

  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function listBlogPosts(includeDrafts = true) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const posts = includeDrafts ? demoBlogPosts : demoBlogPosts.filter((post) => post.status === "published");
    return { posts, usingDemoData: true };
  }

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, body, cover_image_url, status, published_at, created_at, updated_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!includeDrafts) {
    query = query.eq("status", "published");
  }

  const { data, error } = await query;
  if (error) {
    return { posts: [] as BlogPost[], usingDemoData: false };
  }

  return { posts: (data ?? []) as BlogPost[], usingDemoData: false };
}

export async function getBlogPostBySlug(slug: string, includeDraft = false) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const match = demoBlogPosts.find((post) => post.slug === slug && (includeDraft || post.status === "published"));
    return { post: match ?? null, usingDemoData: true };
  }

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, body, cover_image_url, status, published_at, created_at, updated_at")
    .eq("slug", slug);
  if (!includeDraft) {
    query = query.eq("status", "published");
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    return { post: null as BlogPost | null, usingDemoData: false };
  }

  return { post: (data as BlogPost | null) ?? null, usingDemoData: false };
}

export async function upsertBlogPost(input: {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
  status: BlogPostStatus;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda blog kaydÃ„Â± guncellenemez." };
  }

  const payload = {
    title: input.title.trim(),
    slug: normalizeBusinessSlug(input.slug).replace(/^-+|-+$/g, ""),
    excerpt: input.excerpt?.trim() || null,
    body: input.body.trim(),
    cover_image_url: input.coverImageUrl?.trim() || null,
    status: input.status,
    published_at: input.status === "published" ? new Date().toISOString() : null,
  };

  const query = input.id
    ? supabase.from("blog_posts").update(payload).eq("id", input.id)
    : supabase.from("blog_posts").insert(payload);

  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteBlogPost(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda blog kaydÃ„Â± silinemez." };
  }

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "blog_post",
    entityId: id,
    action: "delete",
  });

  return { ok: true };
}

export async function listLeadNotes(leadId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { notes: demoLeadNotes.filter((note) => note.lead_id === leadId), usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("sales_lead_notes")
    .select("id, lead_id, note, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    return { notes: [] as SalesLeadNote[], usingDemoData: false };
  }

  return { notes: (data ?? []) as SalesLeadNote[], usingDemoData: false };
}

export async function createLeadNote(input: { leadId: string; note: string }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda lead notu eklenemez." };
  }

  const { error } = await supabase.from("sales_lead_notes").insert({
    lead_id: input.leadId,
    note: input.note.trim(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "sales_lead_note",
    entityId: input.leadId,
    action: "create",
    details: { note: input.note.trim() },
  });

  return { ok: true };
}

export async function getOnboardingSnapshot() {
  const [{ counts }, { settings: generalSettings }, { settings: seoSettings }, { posts }, { assets }] = await Promise.all([
    getSetupChecklistSummary(),
    getGeneralSettings(),
    getSeoSettings(),
    listBlogPosts(false),
    listMediaAssets(),
  ]);

  return {
    counts,
    generalSettings,
    seoSettings,
    publishedPosts: posts.length,
    mediaAssets: assets.length,
    checklist: [
      { id: "brand", title: "Marka ayarlari", done: Boolean(generalSettings.siteName && generalSettings.contactPhone), href: "/studio/settings" },
      { id: "seo", title: "SEO ayarlari", done: Boolean(seoSettings.metaTitle && seoSettings.metaDescription), href: "/studio/seo" },
      { id: "content", title: "Landing icerigi", done: counts.leads >= 0, href: "/studio/content" },
      { id: "media", title: "Medya kutuphanesi", done: assets.length > 0, href: "/studio/media" },
      { id: "blog", title: "Blog / duyuru", done: posts.length > 0, href: "/studio/blog" },
      { id: "ops", title: "Operasyon verisi", done: counts.businesses > 0 && counts.products > 0 && counts.tables > 0, href: "/admin/setup" },
    ],
  };
}

export async function getStudioAccessByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { hasAccess: false as const, role: null as StudioRole | null };
  }

  const privilegedEmails = getPrivilegedEmails(process.env.STUDIO_ADMIN_EMAILS);
  if (privilegedEmails.has(normalizedEmail)) {
    return { hasAccess: true as const, role: "owner" as StudioRole };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { hasAccess: false as const, role: null as StudioRole | null };
  }

  const { data } = await supabase
    .from("studio_access_users")
    .select("email, role, is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  return {
    hasAccess: Boolean(data),
    role: (data?.role as StudioRole | undefined) ?? null,
  };
}

export async function getPlatformAccessByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      hasAccess: false as const,
      role: null as PlatformRole | null,
      permissions: [] as PlatformPermission[],
    };
  }

  const privilegedEmails = getPrivilegedEmails(process.env.PLATFORM_OWNER_EMAILS);
  if (privilegedEmails.has(normalizedEmail)) {
    return {
      hasAccess: true as const,
      role: "platform_owner" as PlatformRole,
      permissions: normalizePlatformPermissions("platform_owner"),
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      hasAccess: false as const,
      role: null as PlatformRole | null,
      permissions: [] as PlatformPermission[],
    };
  }

  const { data } = await supabase
    .from("platform_access_users")
    .select("email, role, permissions, is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  const role = (data?.role as PlatformRole | undefined) ?? null;
  return {
    hasAccess: Boolean(data),
    role,
    permissions: role ? normalizePlatformPermissions(role, (data?.permissions as string[] | undefined) ?? []) : [],
  };
}

export async function listPlatformAccessUsers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { users: [] as PlatformAccessUser[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("platform_access_users")
    .select("id, email, full_name, role, permissions, is_active, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { users: [] as PlatformAccessUser[], usingDemoData: false };
  }

  return {
    users: ((data ?? []) as Array<Omit<PlatformAccessUser, "permissions"> & { permissions: string[] | null }>).map((user) => ({
      ...user,
      permissions: normalizePlatformPermissions(user.role, user.permissions ?? []),
    })),
    usingDemoData: false,
  };
}

export async function upsertPlatformAccessUser(input: {
  email: string;
  fullName?: string;
  role?: PlatformRole;
  permissions?: PlatformPermission[];
  isActive?: boolean;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda platform kullanicisi eklenemez." };
  }

  const email = input.email.trim().toLowerCase();
  const role = input.role ?? "observer";
  if (!email) {
    return { ok: false, error: "E-posta gerekli." };
  }

  const permissions = normalizePlatformPermissions(role, input.permissions ?? []);
  const { error } = await supabase.from("platform_access_users").upsert(
    {
      email,
      full_name: input.fullName?.trim() || null,
      role,
      permissions,
      is_active: input.isActive ?? true,
    },
    { onConflict: "email" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "platform_access.upserted",
    entityType: "platform_access_user",
    entityId: email,
    details: { role, permissions, isActive: input.isActive ?? true },
  });

  return { ok: true };
}

export async function setPlatformAccessUserStatus(id: string, isActive: boolean) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda platform kullanicisi guncellenemez." };
  }

  const { error } = await supabase.from("platform_access_users").update({ is_active: isActive }).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "platform_access.status_updated",
    entityType: "platform_access_user",
    entityId: id,
    details: { isActive },
  });

  return { ok: true };
}

export async function setPlatformAccessUserRole(id: string, role: PlatformRole) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda platform kullanicisi guncellenemez." };
  }

  const permissions = normalizePlatformPermissions(role);
  const { error } = await supabase.from("platform_access_users").update({ role, permissions }).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "platform_access.role_updated",
    entityType: "platform_access_user",
    entityId: id,
    details: { role, permissions },
  });

  return { ok: true };
}

export async function listStudioAccessUsers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { users: [] as StudioAccessUser[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("studio_access_users")
    .select("id, email, full_name, role, is_active, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { users: [] as StudioAccessUser[], usingDemoData: false };
  }

  return {
    users: (data ?? []) as StudioAccessUser[],
    usingDemoData: false,
  };
}

export async function upsertStudioAccessUser(input: { email: string; fullName?: string; role?: StudioRole; isActive?: boolean }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda studio kullanicisi eklenemez." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "E-posta gerekli." };
  }

  const { error } = await supabase.from("studio_access_users").upsert(
      {
        email,
        full_name: input.fullName?.trim() || null,
        role: input.role ?? "editor",
        is_active: input.isActive ?? true,
      },
    { onConflict: "email" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function setStudioAccessUserStatus(id: string, isActive: boolean) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda studio kullanicisi guncellenemez." };
  }

  const { error } = await supabase
    .from("studio_access_users")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function setStudioAccessUserRole(id: string, role: StudioRole) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda studio rol guncellenemez." };
  }

  const { error } = await supabase
    .from("studio_access_users")
    .update({ role })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function getSupportAccessByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { hasAccess: false as const, role: null as SupportRole | null };
  }

  const privilegedEmails = getPrivilegedEmails(process.env.SUPPORT_ADMIN_EMAILS);
  if (privilegedEmails.has(normalizedEmail)) {
    return { hasAccess: true as const, role: "support_admin" as SupportRole };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { hasAccess: false as const, role: null as SupportRole | null };
  }

  const { data } = await supabase
    .from("support_access_users")
    .select("email, role, is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  return {
    hasAccess: Boolean(data),
    role: (data?.role as SupportRole | undefined) ?? null,
  };
}

export async function listSupportAccessUsers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { users: [] as SupportAccessUser[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("support_access_users")
    .select("id, email, full_name, role, is_active, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { users: [] as SupportAccessUser[], usingDemoData: false };
  }

  return {
    users: (data ?? []) as SupportAccessUser[],
    usingDemoData: false,
  };
}

export async function upsertSupportAccessUser(input: { email: string; fullName?: string; role?: SupportRole; isActive?: boolean }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda support kullanicisi eklenemez." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "E-posta gerekli." };
  }

  const { error } = await supabase.from("support_access_users").upsert(
    {
      email,
      full_name: input.fullName?.trim() || null,
      role: input.role ?? "support_agent",
      is_active: input.isActive ?? true,
    },
    { onConflict: "email" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "support_access.upserted",
    entityType: "support_access_user",
    entityId: email,
    details: {
      role: input.role ?? "support_agent",
      isActive: input.isActive ?? true,
    },
  });

  return { ok: true };
}

export async function setSupportAccessUserStatus(id: string, isActive: boolean) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda support kullanicisi guncellenemez." };
  }

  const { error } = await supabase
    .from("support_access_users")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "support_access.status_updated",
    entityType: "support_access_user",
    entityId: id,
    details: { isActive },
  });

  return { ok: true };
}

export async function setSupportAccessUserRole(id: string, role: SupportRole) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda support rol guncellenemez." };
  }

  const { error } = await supabase
    .from("support_access_users")
    .update({ role })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "support_access.role_updated",
    entityType: "support_access_user",
    entityId: id,
    details: { role },
  });

  return { ok: true };
}

async function getCurrentSupportActor() {
  const supabase = getSupabaseServerClient();
  const context = await getRequestAppContext();
  const email = context.user?.email?.trim().toLowerCase() ?? "";
  const privilegedEmails = getPrivilegedEmails(process.env.SUPPORT_ADMIN_EMAILS);

  if (!supabase || !email) {
    return {
      id: null as string | null,
      email,
      full_name: context.user?.email ?? null,
      role: (privilegedEmails.has(email) ? "support_admin" : null) as SupportRole | null,
      profile_id: context.user?.id ?? null,
    };
  }

  const { data } = await supabase
    .from("support_access_users")
    .select("id, email, full_name, role")
    .eq("email", email)
    .maybeSingle();

  if (data) {
    return {
      id: String(data.id),
      email: String(data.email),
      full_name: (data.full_name as string | null | undefined) ?? null,
      role: (data.role as SupportRole | undefined) ?? null,
      profile_id: context.user?.id ?? null,
    };
  }

  return {
    id: null as string | null,
    email,
    full_name: context.user?.email ?? null,
    role: (privilegedEmails.has(email) ? "support_admin" : null) as SupportRole | null,
    profile_id: context.user?.id ?? null,
  };
}

async function writeSupportAuditLog(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  businessId?: string | null;
  details?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const actor = await getCurrentSupportActor();
  await supabase.from("support_audit_logs").insert({
    support_user_id: actor.id,
    business_id: input.businessId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    details: input.details ?? {},
  });
}

export async function updateUserActivity(userId: string, table: "platform_access_users" | "studio_access_users" | "support_access_users" | "profiles") {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  await supabase.from(table).update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
}

async function enrichSupportTickets(tickets: SupportTicket[]) {
  if (!tickets.length) {
    return tickets;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return tickets;
  }

  const businessIds = [...new Set(tickets.map((ticket) => ticket.business_id).filter(Boolean))];
  const supportUserIds = [...new Set(tickets.map((ticket) => ticket.assigned_to_support_user_id).filter(Boolean))] as string[];

  const [businessesResult, supportUsersResult] = await Promise.all([
    businessIds.length
      ? supabase.from("businesses").select("id, name").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    supportUserIds.length
      ? supabase.from("support_access_users").select("id, email, full_name").in("id", supportUserIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const businessMap = new Map(
    ((businessesResult.data ?? []) as Array<{ id: string; name: string }>).map((business) => [business.id, business.name]),
  );
  const supportMap = new Map(
    ((supportUsersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [
      user.id,
      user.full_name || user.email,
    ]),
  );

  return tickets.map((ticket) => enrichTicketSla({
    ...ticket,
    business_name: businessMap.get(ticket.business_id) ?? ticket.business_name,
    assigned_support_name:
      (ticket.assigned_to_support_user_id ? supportMap.get(ticket.assigned_to_support_user_id) : null) ?? ticket.assigned_support_name ?? null,
  }));
}

async function enrichSupportPlanRequests(requests: SupportPlanRequest[]) {
  if (!requests.length) {
    return requests;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return requests;
  }

  const businessIds = [...new Set(requests.map((request) => request.business_id).filter(Boolean))];
  const reviewerIds = [...new Set(requests.map((request) => request.reviewed_by_support_user_id).filter(Boolean))] as string[];

  const [businessesResult, reviewersResult] = await Promise.all([
    businessIds.length
      ? supabase.from("businesses").select("id, name").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
    reviewerIds.length
      ? supabase.from("support_access_users").select("id, email, full_name").in("id", reviewerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const businessMap = new Map(
    ((businessesResult.data ?? []) as Array<{ id: string; name: string }>).map((business) => [business.id, business.name]),
  );
  const reviewerMap = new Map(
    ((reviewersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [
      user.id,
      user.full_name || user.email,
    ]),
  );

  return requests.map((request) => ({
    ...request,
    business_name: businessMap.get(request.business_id) ?? request.business_name,
    reviewed_by_support_name:
      (request.reviewed_by_support_user_id ? reviewerMap.get(request.reviewed_by_support_user_id) : null) ?? request.reviewed_by_support_name ?? null,
  }));
}

export async function createSupportTicket(input: {
  type?: SupportTicketType;
  priority?: SupportTicketPriority;
  subject: string;
  description: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda destek talebi olusturulamaz." };
  }

  const context = await getRequestAppContext();
  if (!context.businessId) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const subject = input.subject.trim();
  const description = input.description.trim();
  if (!subject || !description) {
    return { ok: false, error: "Konu ve aciklama zorunlu." };
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      business_id: context.businessId,
      type: input.type ?? "support",
      priority: input.priority ?? "normal",
      status: "open",
      subject,
      description,
      created_by_profile_id: context.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("support_ticket_messages").insert({
    ticket_id: data.id,
    author_type: "tenant",
    author_profile_id: context.user?.id ?? null,
    message: description,
    is_internal_note: false,
  });

  await writeSupportAuditLog({
    action: "ticket.created",
    entityType: "support_ticket",
    entityId: String(data?.id ?? ""),
    businessId: context.businessId,
    details: {
      type: input.type ?? "support",
      priority: input.priority ?? "normal",
    },
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function listSupportTickets(status?: SupportTicketStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { tickets: [] as SupportTicket[], usingDemoData: true };
  }

  let query = supabase
    .from("support_tickets")
    .select("id, business_id, type, priority, status, subject, description, created_by_profile_id, assigned_to_support_user_id, created_at, updated_at, resolved_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return { tickets: [] as SupportTicket[], usingDemoData: false };
  }

  const tickets = await enrichSupportTickets((data ?? []) as SupportTicket[]);
  return {
    tickets,
    usingDemoData: false,
  };
}

export async function getSupportTicketDetail(ticketId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ticket: null as SupportTicket | null,
      messages: [] as SupportTicketMessage[],
      auditLogs: [] as SupportAuditLogEntry[],
      usingDemoData: true,
    };
  }

  const { data: ticketRow, error } = await supabase
    .from("support_tickets")
    .select("id, business_id, type, priority, status, subject, description, created_by_profile_id, assigned_to_support_user_id, created_at, updated_at, resolved_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !ticketRow) {
    return {
      ticket: null as SupportTicket | null,
      messages: [] as SupportTicketMessage[],
      auditLogs: [] as SupportAuditLogEntry[],
      usingDemoData: false,
    };
  }

  const [messagesResult, auditResult] = await Promise.all([
    supabase
      .from("support_ticket_messages")
      .select("id, ticket_id, author_type, author_support_user_id, author_profile_id, message, is_internal_note, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase
      .from("support_audit_logs")
      .select("id, support_user_id, business_id, action, entity_type, entity_id, details, created_at")
      .eq("entity_type", "support_ticket")
      .eq("entity_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const ticket = (await enrichSupportTickets([ticketRow as SupportTicket]))[0] ?? null;

  const supportIds = [...new Set(((messagesResult.data ?? []) as Array<{ author_support_user_id: string | null }>).map((row) => row.author_support_user_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(((messagesResult.data ?? []) as Array<{ author_profile_id: string | null }>).map((row) => row.author_profile_id).filter(Boolean))] as string[];
  const auditSupportIds = [...new Set(((auditResult.data ?? []) as Array<{ support_user_id: string | null }>).map((row) => row.support_user_id).filter(Boolean))] as string[];
  const allSupportIds = [...new Set([...supportIds, ...auditSupportIds])];

  const [supportUsersResult, profilesResult, businessesResult] = await Promise.all([
    allSupportIds.length
      ? supabase.from("support_access_users").select("id, email, full_name").in("id", allSupportIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    ticket?.business_id
      ? supabase.from("businesses").select("id, name").eq("id", ticket.business_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const supportMap = new Map(
    ((supportUsersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [
      user.id,
      user.full_name || user.email,
    ]),
  );
  const profileMap = new Map(
    ((profilesResult.data ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [profile.id, profile.full_name || "Tenant kullanicisi"]),
  );

  const messages = ((messagesResult.data ?? []) as SupportTicketMessage[]).map((message) => ({
    ...message,
    author_name:
      message.author_type === "support"
        ? (message.author_support_user_id ? supportMap.get(message.author_support_user_id) : null) ?? "Support"
        : message.author_type === "tenant"
          ? (message.author_profile_id ? profileMap.get(message.author_profile_id) : null) ?? "Tenant"
          : "Sistem",
  }));

  const businessName = (businessesResult.data as { id: string; name: string } | null)?.name ?? ticket?.business_name ?? null;
  const auditLogs = ((auditResult.data ?? []) as SupportAuditLogEntry[]).map((entry) => ({
    ...entry,
    actor_name: entry.support_user_id ? supportMap.get(entry.support_user_id) ?? "Support" : "Sistem",
    business_name: businessName,
  }));

  return {
    ticket,
    messages,
    auditLogs,
    usingDemoData: false,
  };
}

export async function createSupportTicketMessage(input: {
  ticketId: string;
  message: string;
  isInternalNote?: boolean;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda ticket notu eklenemez." };
  }

  const actor = await getCurrentSupportActor();
  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "Mesaj boÃ…Å¸ olamaz." };
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, business_id")
    .eq("id", input.ticketId)
    .maybeSingle();

  if (!ticket) {
    return { ok: false, error: "Ticket bulunamadi." };
  }

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: input.ticketId,
    author_type: "support",
    author_support_user_id: actor.id,
    author_profile_id: actor.profile_id,
    message,
    is_internal_note: input.isInternalNote ?? true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: input.isInternalNote ? "ticket.internal_note_added" : "ticket.reply_added",
    entityType: "support_ticket",
    entityId: input.ticketId,
    businessId: String(ticket.business_id),
    details: { isInternalNote: input.isInternalNote ?? true },
  });

  return { ok: true };
}

export async function setSupportTicketStatus(id: string, status: SupportTicketStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda destek talebi guncellenemez." };
  }

  const payload = {
    status,
    resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("support_tickets").update(payload).eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "ticket.status_updated",
    entityType: "support_ticket",
    entityId: id,
    details: { status },
  });

  return { ok: true };
}

export async function assignSupportTicket(id: string, supportUserId: string | null) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda destek talebi atanamaz." };
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({
      assigned_to_support_user_id: supportUserId,
      status: supportUserId ? "in_progress" : "open",
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "ticket.assigned",
    entityType: "support_ticket",
    entityId: id,
    details: { supportUserId },
  });

  return { ok: true };
}

export async function listSupportTenantSummaries() {
  const supabase = getSupabaseServerClient();
  const authClient = supabase ? null : await getSupabaseAuthServerClient();
  const client = supabase ?? authClient;
  if (!client) {
    return { tenants: [] as SupportTenantSummary[], usingDemoData: true };
  }

  let { data: businesses, error } = await client
    .from("businesses")
    .select("id, name, slug, plan, business_type, is_active")
    .order("name", { ascending: true });

  if (error?.message?.toLowerCase().includes("business_type")) {
    const fallback = await client
      .from("businesses")
      .select("id, name, slug, plan, is_active")
      .order("name", { ascending: true });
    businesses = fallback.data as typeof businesses;
    error = fallback.error as typeof error;
  }

  if (error) {
    return { tenants: [] as SupportTenantSummary[], usingDemoData: false };
  }

  const tenants = await Promise.all(
    ((businesses ?? []) as Array<{ id: string; name: string; slug: string; plan: BusinessPlan; business_type?: string; is_active: boolean }>).map(async (business) => {
      const [branchRowsResult, ticketResult] = await Promise.all([
        client.from("branches").select("id").eq("business_id", business.id).eq("is_active", true),
        client.from("support_tickets").select("id", { count: "exact", head: true }).eq("business_id", business.id).neq("status", "closed"),
      ]);
      const branchCount = (branchRowsResult.data ?? []).length;
      const restaurantBranchCount = branchCount;
      const enterpriseMarketBranchCount = 0;
      const tenantModel: TenantModel = "restaurant_only";

      return {
        business_id: business.id,
        business_name: business.name,
        business_slug: business.slug,
        plan: business.plan,
        business_type: (business.business_type === "self_service_coffee" ? "self_service_coffee" : "restaurant_cafe") as BusinessType,
        is_active: business.is_active,
        branch_count: branchCount,
        tenant_model: tenantModel,
        restaurant_branch_count: restaurantBranchCount,
        enterprise_market_branch_count: enterpriseMarketBranchCount,
        support_ticket_count: ticketResult.count ?? 0,
      } satisfies SupportTenantSummary;
    }),
  );

  return { tenants, usingDemoData: false };
}

export async function listSupportHealthSummaries() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { health: [] as SupportHealthSummary[], usingDemoData: true };
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, plan")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { health: [] as SupportHealthSummary[], usingDemoData: false };
  }

  const health = await Promise.all(
    ((businesses ?? []) as Array<{ id: string; name: string; plan: BusinessPlan }>).map(async (business) => {
      const [orderResult, paymentResult, ticketResult] = await Promise.all([
        supabase.from("orders").select("created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("payments").select("created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("business_id", business.id).in("status", ["open", "in_progress"]),
      ]);

      const lastOrderAt = (orderResult.data?.created_at as string | undefined) ?? null;
      const lastPaymentAt = (paymentResult.data?.created_at as string | undefined) ?? null;
      const openTicketCount = ticketResult.count ?? 0;
      const reference = lastOrderAt || lastPaymentAt;
      const daysSinceActivity = reference ? Math.floor((Date.now() - new Date(reference).getTime()) / 86400000) : 999;
      const health_status =
        openTicketCount >= 3 || daysSinceActivity > 14 ? "critical" : openTicketCount > 0 || daysSinceActivity > 7 ? "warning" : "healthy";

      return {
        business_id: business.id,
        business_name: business.name,
        plan: business.plan,
        health_status,
        last_order_at: lastOrderAt,
        last_payment_at: lastPaymentAt,
        open_ticket_count: openTicketCount,
      } satisfies SupportHealthSummary;
    }),
  );

  return { health, usingDemoData: false };
}

export async function listSupportOnboardingSummaries() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { tenants: [] as SupportOnboardingSummary[], usingDemoData: true };
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, business_type")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { tenants: [] as SupportOnboardingSummary[], usingDemoData: false };
  }

  const tenants = await Promise.all(
    ((businesses ?? []) as Array<{ id: string; name: string; business_type: string }>).map(async (business) => {
      const [productsResult, tablesResult, staffResult, branchesResult] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("tables").select("id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("staff_branch_access").select("profile_id", { count: "exact", head: true }).eq("business_id", business.id),
        supabase.from("branches").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("is_active", true),
      ]);

      const products = productsResult.count ?? 0;
      const tables = tablesResult.count ?? 0;
      const staff = staffResult.count ?? 0;
      const branches = branchesResult.count ?? 0;
      const score = [products > 0, tables > 0, staff > 0, branches > 0].filter(Boolean).length;

      return {
        business_id: business.id,
        business_name: business.name,
        business_type: business.business_type as BusinessType,
        products,
        tables,
        staff,
        branches,
        completion_score: Math.round((score / 4) * 100),
      } satisfies SupportOnboardingSummary;
    }),
  );

  return { tenants, usingDemoData: false };
}

export async function getSupportTenantDetail(businessId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { tenant: null, usingDemoData: true };
  }

  let { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, slug, plan, business_type, is_active, created_at, updated_at")
    .eq("id", businessId)
    .maybeSingle();

  if (error?.message?.toLowerCase().includes("business_type")) {
    const fallback = await supabase
      .from("businesses")
      .select("id, name, slug, plan, is_active, created_at, updated_at")
      .eq("id", businessId)
      .maybeSingle();
    business = fallback.data as typeof business;
    error = fallback.error as typeof error;
  }

  if (error || !business) {
    return { tenant: null, usingDemoData: false };
  }

  const normalizedBusinessType: BusinessType =
    (business as { business_type?: string }).business_type === "self_service_coffee"
      ? "self_service_coffee"
      : "restaurant_cafe";

  const [branchResult, branchListResult, ticketResult, recentTicketsResult, orderResult, paymentResult, planRequestsResult, auditResult, incidentsResult, profileResult, featureFlagsResult, staffResult] = await Promise.all([
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("is_active", true),
    supabase
      .from("branches")
      .select("id, business_id, name, slug, branch_profile, is_active, created_at, updated_at")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["open", "in_progress"]),
    supabase
      .from("support_tickets")
      .select("id, business_id, type, priority, status, subject, description, created_by_profile_id, assigned_to_support_user_id, created_at, updated_at, resolved_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("orders").select("created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("payments").select("created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("support_plan_requests").select("id, business_id, current_plan, requested_plan, reason, status, requested_by_profile_id, reviewed_by_support_user_id, created_at, updated_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10),
    supabase.from("support_audit_logs").select("id, support_user_id, business_id, action, entity_type, entity_id, details, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10),
    supabase.from("support_incidents").select("id, business_id, title, summary, severity, status, owner_support_user_id, started_at, resolved_at, created_at, updated_at").eq("business_id", businessId).order("started_at", { ascending: false }).limit(10),
    supabase.from("support_tenant_profiles").select("business_id, lifecycle_stage, owner_name, owner_email, account_manager_name, renewal_date, billing_status, risk_level, account_notes, created_at, updated_at").eq("business_id", businessId).maybeSingle(),
    supabase.from("support_feature_flag_overrides").select("id, business_id, feature_key, enabled, note, created_at, updated_at").eq("business_id", businessId).order("updated_at", { ascending: false }),
    supabase.from("staff_branch_access").select("profile_id").eq("business_id", businessId),
  ]);

  const profileIds = [...new Set(((staffResult.data ?? []) as Array<{ profile_id: string }>).map((p) => p.profile_id))];
  const staffActivityData = profileIds.length 
    ? await supabase.from("profiles").select("id, full_name, last_seen_at").in("id", profileIds)
    : { data: [], error: null };

  const [planRequests, recentTickets] = await Promise.all([
    enrichSupportPlanRequests((planRequestsResult.data ?? []) as SupportPlanRequest[]),
    enrichSupportTickets((recentTicketsResult.data ?? []) as SupportTicket[]),
  ]);
  const auditSupportIds = [...new Set(((auditResult.data ?? []) as Array<{ support_user_id: string | null }>).map((row) => row.support_user_id).filter(Boolean))] as string[];
  const incidentOwnerIds = [...new Set(((incidentsResult.data ?? []) as Array<{ owner_support_user_id: string | null }>).map((row) => row.owner_support_user_id).filter(Boolean))] as string[];
  const allSupportIds = [...new Set([...auditSupportIds, ...incidentOwnerIds])];
  const supportUsersResult = allSupportIds.length
    ? await supabase.from("support_access_users").select("id, email, full_name").in("id", allSupportIds)
    : { data: [], error: null };
  const supportMap = new Map(
    ((supportUsersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [
      user.id,
      user.full_name || user.email,
    ]),
  );
  const normalizeBranchProfile = (value?: BranchProfile | null): BranchProfile => {
    void value;
    return "restaurant";
  };
  let hasResolvedBranchRows = false;
  let activeBranches = [] as Array<{ id: string; name: string; slug: string; branch_profile: BranchProfile }>;
  if (branchListResult.error?.message?.toLowerCase().includes("branch_profile")) {
    const fallbackBranchRows = await supabase
      .from("branches")
      .select("id, name, slug")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (!fallbackBranchRows.error) {
      hasResolvedBranchRows = true;
      activeBranches = ((fallbackBranchRows.data ?? []) as Array<{ id: string; name: string; slug: string }>).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        branch_profile: "restaurant",
      }));
    }
  } else if (!branchListResult.error) {
    hasResolvedBranchRows = true;
    activeBranches = (
      (branchListResult.data ?? []) as Array<{ id: string; name: string; slug: string; branch_profile?: BranchProfile | null }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      branch_profile: normalizeBranchProfile(row.branch_profile),
    }));
  }
  const branchProfileSummary = hasResolvedBranchRows
    ? activeBranches.reduce(
        (acc, row) => {
          if (row.branch_profile === "enterprise_market") {
            acc.enterprise_market += 1;
          } else {
            acc.restaurant += 1;
          }
          return acc;
        },
        { restaurant: 0, enterprise_market: 0 },
      )
    : { restaurant: branchResult.count ?? 0, enterprise_market: 0 };
  const activeBranchCount = hasResolvedBranchRows ? activeBranches.length : (branchResult.count ?? 0);

  return {
    tenant: {
      ...(business as Business),
      business_type: normalizedBusinessType,
      branch_count: activeBranchCount,
      branch_profile_summary: branchProfileSummary,
      branches: activeBranches,
      open_ticket_count: ticketResult.count ?? 0,
      last_order_at: (orderResult.data?.created_at as string | undefined) ?? null,
      last_payment_at: (paymentResult.data?.created_at as string | undefined) ?? null,
      staff_activity: (staffActivityData.data ?? []) as Array<{ id: string; full_name: string | null; last_seen_at: string | null }>,
      profile: profileResult.data ?? {
        business_id: businessId,
        lifecycle_stage: "active",
        owner_name: null,
        owner_email: null,
        account_manager_name: null,
        renewal_date: null,
        billing_status: "healthy",
        risk_level: "low",
        account_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      plan_requests: planRequests,
      incidents: ((incidentsResult.data ?? []) as SupportIncident[]).map((incident) => ({
        ...incident,
        business_name: business.name,
        owner_support_name: incident.owner_support_user_id ? supportMap.get(incident.owner_support_user_id) ?? null : null,
      })),
      recent_tickets: recentTickets.map((ticket) => ({
        ...ticket,
        business_name: business.name,
        assigned_support_name: ticket.assigned_to_support_user_id ? supportMap.get(ticket.assigned_to_support_user_id) ?? null : null,
      })),
      feature_flags: ((featureFlagsResult.data ?? []) as SupportFeatureFlagOverride[]).map((flag) => ({
        ...flag,
        business_name: business.name,
      })),
      diagnostics: {
        last_order_at: (orderResult.data?.created_at as string | undefined) ?? null,
        last_payment_at: (paymentResult.data?.created_at as string | undefined) ?? null,
        branch_count: activeBranchCount,
        restaurant_branch_count: branchProfileSummary.restaurant,
        enterprise_market_branch_count: branchProfileSummary.enterprise_market,
        open_ticket_count: ticketResult.count ?? 0,
        feature_flag_count: (featureFlagsResult.data ?? []).length,
        open_incident_count: ((incidentsResult.data ?? []) as SupportIncident[]).filter((incident) => incident.status === "open" || incident.status === "monitoring").length,
      },
      recent_audit_logs: ((auditResult.data ?? []) as SupportAuditLogEntry[]).map((entry) => ({
        ...entry,
        actor_name: entry.support_user_id ? supportMap.get(entry.support_user_id) ?? "Support" : "Sistem",
        business_name: business.name,
      })),
    },
    usingDemoData: false,
  };
}

export async function createSupportPlanRequest(input: {
  requestedPlan: BusinessPlan;
  reason?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda paket talebi olusturulamaz." };
  }

  const context = await getRequestAppContext();
  if (!context.businessId || !context.activeBusiness?.plan) {
    return { ok: false, error: "Aktif iÃ…Å¸letme bulunamadi." };
  }

  const { data, error } = await supabase
    .from("support_plan_requests")
    .insert({
      business_id: context.businessId,
      current_plan: context.activeBusiness.plan,
      requested_plan: input.requestedPlan,
      reason: input.reason?.trim() || null,
      status: "open",
      requested_by_profile_id: context.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "plan_request.created",
    entityType: "support_plan_request",
    entityId: String(data?.id ?? ""),
    businessId: context.businessId,
    details: {
      currentPlan: context.activeBusiness.plan,
      requestedPlan: input.requestedPlan,
    },
  });

  await createSupportTicket({
    type: "plan_change",
    priority: "normal",
    subject: `Paket degisikligi talebi: ${context.activeBusiness.plan} -> ${input.requestedPlan}`,
    description: input.reason?.trim() || "Tenant paket degisikligi talebi olusturdu.",
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function listSupportPlanRequests(status?: SupportPlanRequestStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { requests: [] as SupportPlanRequest[], usingDemoData: true };
  }

  let query = supabase
    .from("support_plan_requests")
    .select("id, business_id, current_plan, requested_plan, reason, status, requested_by_profile_id, reviewed_by_support_user_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return { requests: [] as SupportPlanRequest[], usingDemoData: false };
  }

  const requests = await enrichSupportPlanRequests((data ?? []) as SupportPlanRequest[]);
  return {
    requests,
    usingDemoData: false,
  };
}

export async function setSupportPlanRequestStatus(id: string, status: SupportPlanRequestStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda paket talebi guncellenemez." };
  }

  const actor = await getCurrentSupportActor();
  const { data: requestRow, error: requestError } = await supabase
    .from("support_plan_requests")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return { ok: false, error: requestError?.message ?? "Paket talebi bulunamadi." };
  }

  const { error } = await supabase
    .from("support_plan_requests")
    .update({ status, reviewed_by_support_user_id: actor.id })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "plan_request.status_updated",
    entityType: "support_plan_request",
    entityId: id,
    businessId: String(requestRow.business_id),
    details: { status },
  });

  return { ok: true };
}

export async function listSupportAuditLogs(input?: { businessId?: string; limit?: number }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { logs: [] as SupportAuditLogEntry[], usingDemoData: true };
  }

  let query = supabase
    .from("support_audit_logs")
    .select("id, support_user_id, business_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50);

  if (input?.businessId) {
    query = query.eq("business_id", input.businessId);
  }

  const { data, error } = await query;
  if (error) {
    return { logs: [] as SupportAuditLogEntry[], usingDemoData: false };
  }

  const logs = (data ?? []) as SupportAuditLogEntry[];
  if (!logs.length) {
    return { logs, usingDemoData: false };
  }

  const supportIds = [...new Set(logs.map((log) => log.support_user_id).filter(Boolean))] as string[];
  const businessIds = [...new Set(logs.map((log) => log.business_id).filter(Boolean))] as string[];
  const [supportUsersResult, businessesResult] = await Promise.all([
    supportIds.length
      ? supabase.from("support_access_users").select("id, email, full_name").in("id", supportIds)
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase.from("businesses").select("id, name").in("id", businessIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const supportMap = new Map(
    ((supportUsersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [
      user.id,
      user.full_name || user.email,
    ]),
  );
  const businessMap = new Map(
    ((businessesResult.data ?? []) as Array<{ id: string; name: string }>).map((business) => [business.id, business.name]),
  );

  return {
    logs: logs.map((log) => ({
      ...log,
      actor_name: log.support_user_id ? supportMap.get(log.support_user_id) ?? "Support" : "Sistem",
      business_name: log.business_id ? businessMap.get(log.business_id) ?? null : null,
    })),
    usingDemoData: false,
  };
}

async function ensureSupportTenantProfile(businessId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("support_tenant_profiles")
    .upsert({ business_id: businessId }, { onConflict: "business_id" })
    .select("business_id, lifecycle_stage, owner_name, owner_email, account_manager_name, renewal_date, billing_status, risk_level, account_notes, created_at, updated_at")
    .single();

  return (data ?? null) as SupportTenantProfile | null;
}

export async function listSupportBillingSummaries() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { tenants: [] as Array<SupportTenantProfile & { business_name: string; plan: BusinessPlan }>, usingDemoData: true };
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, plan")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { tenants: [] as Array<SupportTenantProfile & { business_name: string; plan: BusinessPlan }>, usingDemoData: false };
  }

  const profiles = await Promise.all(
    ((businesses ?? []) as Array<{ id: string; name: string; plan: BusinessPlan }>).map(async (business) => {
      const profile = (await ensureSupportTenantProfile(business.id)) ?? {
        business_id: business.id,
        lifecycle_stage: "active" as TenantLifecycleStage,
        owner_name: null,
        owner_email: null,
        account_manager_name: null,
        renewal_date: null,
        billing_status: "healthy" as SupportBillingStatus,
        risk_level: "low" as SupportRiskLevel,
        account_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return {
        ...profile,
        business_name: business.name,
        plan: business.plan,
      };
    }),
  );

  return { tenants: profiles, usingDemoData: false };
}

export async function updateSupportTenantProfile(input: {
  businessId: string;
  lifecycleStage: TenantLifecycleStage;
  ownerName?: string;
  ownerEmail?: string;
  accountManagerName?: string;
  renewalDate?: string;
  billingStatus: SupportBillingStatus;
  riskLevel: SupportRiskLevel;
  accountNotes?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda tenant profili guncellenemez." };
  }

  const { error } = await supabase.from("support_tenant_profiles").upsert(
    {
      business_id: input.businessId,
      lifecycle_stage: input.lifecycleStage,
      owner_name: input.ownerName?.trim() || null,
      owner_email: input.ownerEmail?.trim().toLowerCase() || null,
      account_manager_name: input.accountManagerName?.trim() || null,
      renewal_date: input.renewalDate || null,
      billing_status: input.billingStatus,
      risk_level: input.riskLevel,
      account_notes: input.accountNotes?.trim() || null,
    },
    { onConflict: "business_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "tenant_profile.updated",
    entityType: "support_tenant_profile",
    entityId: input.businessId,
    businessId: input.businessId,
    details: {
      lifecycleStage: input.lifecycleStage,
      billingStatus: input.billingStatus,
      riskLevel: input.riskLevel,
    },
  });

  return { ok: true };
}

export async function updateSupportTenantBusinessType(input: {
  businessId: string;
  businessType: BusinessType;
}) {
  const supabase = getSupabaseServerClient();
  const authClient = supabase ? null : await getSupabaseAuthServerClient();
  const client = supabase ?? authClient;
  if (!client) {
    return { ok: false, error: "Demo modda isletme tipi guncellenemez." };
  }

  const { error } = await client
    .from("businesses")
    .update({ business_type: input.businessType })
    .eq("id", input.businessId);

  if (error) {
    if (error.message.toLowerCase().includes("business_type")) {
      return { ok: false, error: "business_type kolonu bulunamadi. Lutfen 20260509_add_business_type.sql migration'ini calistirin." };
    }
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "tenant.business_type.updated",
    entityType: "business",
    entityId: input.businessId,
    businessId: input.businessId,
    details: {
      businessType: input.businessType,
    },
  });

  return { ok: true };
}

export async function listSupportIncidents(status?: SupportIncidentStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { incidents: [] as SupportIncident[], usingDemoData: true };
  }

  let query = supabase
    .from("support_incidents")
    .select("id, business_id, title, summary, severity, status, owner_support_user_id, started_at, resolved_at, created_at, updated_at")
    .order("started_at", { ascending: false });
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return { incidents: [] as SupportIncident[], usingDemoData: false };
  }

  const incidents = (data ?? []) as SupportIncident[];
  if (!incidents.length) {
    return { incidents, usingDemoData: false };
  }

  const businessIds = [...new Set(incidents.map((incident) => incident.business_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(incidents.map((incident) => incident.owner_support_user_id).filter(Boolean))] as string[];
  const [businessesResult, ownersResult] = await Promise.all([
    businessIds.length ? supabase.from("businesses").select("id, name").in("id", businessIds) : Promise.resolve({ data: [], error: null }),
    ownerIds.length ? supabase.from("support_access_users").select("id, email, full_name").in("id", ownerIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const businessMap = new Map(((businessesResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  const ownerMap = new Map(((ownersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((row) => [row.id, row.full_name || row.email]));

  return {
    incidents: incidents.map((incident) => ({
      ...incident,
      business_name: incident.business_id ? businessMap.get(incident.business_id) ?? null : null,
      owner_support_name: incident.owner_support_user_id ? ownerMap.get(incident.owner_support_user_id) ?? null : null,
    })),
    usingDemoData: false,
  };
}

export async function createSupportIncident(input: {
  businessId?: string | null;
  title: string;
  summary: string;
  severity: SupportIncidentSeverity;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda incident olusturulamaz." };
  }

  const actor = await getCurrentSupportActor();
  const { data, error } = await supabase
    .from("support_incidents")
    .insert({
      business_id: input.businessId ?? null,
      title: input.title.trim(),
      summary: input.summary.trim(),
      severity: input.severity,
      status: "open",
      owner_support_user_id: actor.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "incident.created",
    entityType: "support_incident",
    entityId: String(data?.id ?? ""),
    businessId: input.businessId ?? null,
    details: { severity: input.severity },
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function setSupportIncidentStatus(id: string, status: SupportIncidentStatus) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda incident guncellenemez." };
  }

  const { data: incident } = await supabase.from("support_incidents").select("business_id").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("support_incidents")
    .update({ status, resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "incident.status_updated",
    entityType: "support_incident",
    entityId: id,
    businessId: (incident?.business_id as string | null | undefined) ?? null,
    details: { status },
  });

  return { ok: true };
}

export async function getSupportIncidentDetail(incidentId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      incident: null as SupportIncident | null,
      updates: [] as SupportIncidentUpdate[],
      usingDemoData: true,
    };
  }

  const { data: incidentRow, error } = await supabase
    .from("support_incidents")
    .select("id, business_id, title, summary, severity, status, owner_support_user_id, started_at, resolved_at, created_at, updated_at")
    .eq("id", incidentId)
    .maybeSingle();

  if (error || !incidentRow) {
    return { incident: null as SupportIncident | null, updates: [] as SupportIncidentUpdate[], usingDemoData: false };
  }

  const { incidents } = await listSupportIncidents();
  const incident = incidents.find((item) => item.id === incidentId) ?? (incidentRow as SupportIncident);

  const { data: updatesData } = await supabase
    .from("support_incident_updates")
    .select("id, incident_id, author_support_user_id, message, status, created_at")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  const supportIds = [...new Set(((updatesData ?? []) as Array<{ author_support_user_id: string | null }>).map((row) => row.author_support_user_id).filter(Boolean))] as string[];
  const supportUsersResult = supportIds.length
    ? await supabase.from("support_access_users").select("id, email, full_name").in("id", supportIds)
    : { data: [], error: null };
  const supportMap = new Map(((supportUsersResult.data ?? []) as Array<{ id: string; email: string; full_name: string | null }>).map((user) => [user.id, user.full_name || user.email]));

  return {
    incident,
    updates: ((updatesData ?? []) as SupportIncidentUpdate[]).map((update) => ({
      ...update,
      author_name: update.author_support_user_id ? supportMap.get(update.author_support_user_id) ?? "Support" : "Sistem",
    })),
    usingDemoData: false,
  };
}

export async function createSupportIncidentUpdate(input: {
  incidentId: string;
  message: string;
  status?: SupportIncidentStatus;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda incident guncellenemez." };
  }

  const actor = await getCurrentSupportActor();
  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "Mesaj gerekli." };
  }

  const { data: incident } = await supabase.from("support_incidents").select("business_id").eq("id", input.incidentId).maybeSingle();
  const { error } = await supabase.from("support_incident_updates").insert({
    incident_id: input.incidentId,
    author_support_user_id: actor.id,
    message,
    status: input.status ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (input.status) {
    await supabase
      .from("support_incidents")
      .update({ status: input.status, resolved_at: input.status === "resolved" || input.status === "closed" ? new Date().toISOString() : null })
      .eq("id", input.incidentId);
  }

  await writeSupportAuditLog({
    action: "incident.update_added",
    entityType: "support_incident",
    entityId: input.incidentId,
    businessId: (incident?.business_id as string | null | undefined) ?? null,
    details: { status: input.status ?? null },
  });

  return { ok: true };
}

export async function listSupportFeatureFlagOverrides() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { overrides: [] as SupportFeatureFlagOverride[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("support_feature_flag_overrides")
    .select("id, business_id, feature_key, enabled, note, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return { overrides: [] as SupportFeatureFlagOverride[], usingDemoData: false };
  }

  const overrides = (data ?? []) as SupportFeatureFlagOverride[];
  const businessIds = [...new Set(overrides.map((item) => item.business_id).filter(Boolean))];
  const businessResult = businessIds.length
    ? await supabase.from("businesses").select("id, name").in("id", businessIds)
    : { data: [], error: null };
  const businessMap = new Map(((businessResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));

  return {
    overrides: overrides.map((override) => ({
      ...override,
      business_name: businessMap.get(override.business_id) ?? override.business_name,
    })),
    usingDemoData: false,
  };
}

export async function upsertSupportFeatureFlagOverride(input: {
  businessId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  note?: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda feature flag guncellenemez." };
  }

  const { error } = await supabase.from("support_feature_flag_overrides").upsert(
    {
      business_id: input.businessId,
      feature_key: input.featureKey,
      enabled: input.enabled,
      note: input.note?.trim() || null,
    },
    { onConflict: "business_id,feature_key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: "feature_flag.updated",
    entityType: "support_feature_flag_override",
    entityId: `${input.businessId}:${input.featureKey}`,
    businessId: input.businessId,
    details: { featureKey: input.featureKey, enabled: input.enabled },
  });

  return { ok: true };
}

export async function listSupportTeamSummaries() {
  const [platformResult, ticketsResult, incidentsResult] = await Promise.all([
    listPlatformAccessUsers(),
    listSupportTickets(),
    listSupportIncidents(),
  ]);

  const openTicketCounts = new Map<string, number>();
  const openIncidentCounts = new Map<string, number>();

  for (const ticket of ticketsResult.tickets.filter((item) => item.status === "open" || item.status === "in_progress")) {
    if (ticket.assigned_to_support_user_id) {
      openTicketCounts.set(ticket.assigned_to_support_user_id, (openTicketCounts.get(ticket.assigned_to_support_user_id) ?? 0) + 1);
    }
  }

  for (const incident of incidentsResult.incidents.filter((item) => item.status === "open" || item.status === "monitoring")) {
    if (incident.owner_support_user_id) {
      openIncidentCounts.set(incident.owner_support_user_id, (openIncidentCounts.get(incident.owner_support_user_id) ?? 0) + 1);
    }
  }

  return {
    members: platformResult.users.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      open_ticket_count: openTicketCounts.get(user.id) ?? 0,
      open_incident_count: openIncidentCounts.get(user.id) ?? 0,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at,
    })) as SupportTeamMemberSummary[],
    usingDemoData: platformResult.usingDemoData,
  };
}

export async function listSupportKnowledgeArticles() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { articles: [] as SupportKnowledgeArticle[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("support_knowledge_articles")
    .select("id, title, category, summary, body, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return { articles: [] as SupportKnowledgeArticle[], usingDemoData: false };
  }

  return {
    articles: (data ?? []) as SupportKnowledgeArticle[],
    usingDemoData: false,
  };
}

export async function upsertSupportKnowledgeArticle(input: {
  id?: string;
  title: string;
  category: string;
  summary: string;
  body: string;
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda knowledge kaydÃ„Â± guncellenemez." };
  }

  const payload = {
    id: input.id ?? undefined,
    title: input.title.trim(),
    category: input.category.trim() || "general",
    summary: input.summary.trim(),
    body: input.body.trim(),
  };

  const { error } = await supabase.from("support_knowledge_articles").upsert(payload, input.id ? { onConflict: "id" } : undefined);
  if (error) {
    return { ok: false, error: error.message };
  }

  await writeSupportAuditLog({
    action: input.id ? "knowledge.updated" : "knowledge.created",
    entityType: "support_knowledge_article",
    entityId: input.id ?? null,
    details: { category: payload.category },
  });

  return { ok: true };
}

export async function getSupportDashboardSnapshot() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      metrics: {
        activeBusinesses: 0,
        activeSupportUsers: 0,
        openTickets: 0,
        openPlanRequests: 0,
        criticalTenants: 0,
        openIncidents: 0,
        atRiskTenants: 0,
        overdueBilling: 0,
        myOpenTickets: 0,
        breachedTickets: 0,
        urgentTickets: 0,
      },
      recentTickets: [] as SupportTicket[],
      recentPlanRequests: [] as SupportPlanRequest[],
      recentIncidents: [] as SupportIncident[],
      usingDemoData: true,
    };
  }

  const [businessesResult, usersResult, ticketsResult, requestsResult, healthResult, incidentsResult, billingResult] = await Promise.all([
    supabase.from("businesses").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("platform_access_users").select("id", { count: "exact", head: true }).eq("is_active", true),
    listSupportTickets(),
    listSupportPlanRequests("open"),
    listSupportHealthSummaries(),
    listSupportIncidents(),
    listSupportBillingSummaries(),
  ]);
  const actor = await getCurrentSupportActor();
  const activeTickets = ticketsResult.tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress");

  return {
    metrics: {
      activeBusinesses: businessesResult.count ?? 0,
      activeSupportUsers: usersResult.count ?? 0,
      openTickets: activeTickets.length,
      openPlanRequests: requestsResult.requests.length,
      criticalTenants: healthResult.health.filter((item) => item.health_status === "critical").length,
      openIncidents: incidentsResult.incidents.filter((incident) => incident.status === "open" || incident.status === "monitoring").length,
      atRiskTenants: billingResult.tenants.filter((tenant) => tenant.risk_level === "high" || tenant.lifecycle_stage === "at_risk").length,
      overdueBilling: billingResult.tenants.filter((tenant) => tenant.billing_status === "overdue").length,
      myOpenTickets: actor.id ? activeTickets.filter((ticket) => ticket.assigned_to_support_user_id === actor.id).length : 0,
      breachedTickets: activeTickets.filter((ticket) => ticket.sla_status === "breached").length,
      urgentTickets: activeTickets.filter((ticket) => ticket.priority === "urgent" || ticket.sla_status === "due_soon").length,
    },
    recentTickets: ticketsResult.tickets.slice(0, 6),
    recentPlanRequests: requestsResult.requests.slice(0, 6),
    recentIncidents: incidentsResult.incidents.slice(0, 6),
    usingDemoData: false,
  };
}




export async function getPickupBoardSnapshot() {
  const [preparingResult, readyResult] = await Promise.all([
    listOrders(["pending", "preparing"], { limit: 240, ascending: true }),
    listOrders(["ready"], { limit: 240, ascending: true }),
  ]);
  const preparing = preparingResult.orders.filter((order) => order.channel === "pickup");
  const ready = readyResult.orders.filter((order) => order.channel === "pickup");
  return {
    preparing,
    ready,
  };
} 
