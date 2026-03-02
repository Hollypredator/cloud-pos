import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import {
  createTableImpl,
  deleteTableImpl,
  getOrderHistoryByTableIdImpl,
  getTableMapImpl,
  listLatestOrdersByTableIdsImpl,
  moveTableOrderImpl,
  updateTableDetailsImpl,
} from "@/lib/server/tables-data";
import {
  createCategoryImpl,
  createProductImpl,
  deleteCategoryImpl,
  deleteProductImpl,
  getProductManagementDataImpl,
  updateProductImpl,
} from "@/lib/server/products-data";
import { ALL_BRANCHES_VALUE, DEFAULT_BUSINESS_SLUG, normalizeBusinessSlug } from "@/lib/business";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { demoStaffAccounts } from "@/lib/demo";
import {
  getBusinessScopeContext as getDefaultBusinessScope,
} from "@/lib/server/app-context";
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
import type {
  AlertDispatch,
  AppRole,
  AuditLog,
  BlogPost,
  BlogPostStatus,
  Business,
  Branch,
  CashRegisterSession,
  Category,
  Courier,
  DiningTable,
  Ingredient,
  MediaAsset,
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  ProductIngredient,
  SalesLead,
  SalesLeadNote,
  SalesLeadStatus,
  BusinessPlan,
  SiteContent,
  StockMovement,
  StudioAccessUser,
  StudioRole,
  StaffAccessScope,
  TableRequest,
  TableRequestType,
  TableStatus,
  FulfillmentStatus,
  OrderItemModifierSelection,
} from "@/lib/types";

type AuthServerClient = NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>;
type ServiceServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
type TenantSupabaseClient = AuthServerClient | ServiceServerClient;

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

async function getTenantDataClient(): Promise<TenantSupabaseClient | null> {
  const authClient = await getSupabaseAuthServerClient();
  if (authClient) {
    return authClient;
  }
  return getSupabaseServerClient();
}

const demoCategories: Category[] = [
  { id: "demo-cat-1", name: "Kahveler", sort_order: 1 },
  { id: "demo-cat-2", name: "Soguk Icecekler", sort_order: 2 },
  { id: "demo-cat-3", name: "Tatli ve Firin", sort_order: 3 },
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
  { id: "demo-ing-1", name: "Espresso", unit: "shot" },
  { id: "demo-ing-2", name: "Sut", unit: "ml" },
  { id: "demo-ing-3", name: "Cheesecake Base", unit: "gram" },
  { id: "demo-ing-4", name: "Cold Brew Concentrate", unit: "ml" },
  { id: "demo-ing-5", name: "Butter Dough", unit: "gram" },
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
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const demoBranches: Branch[] = [
  {
    id: "demo-branch-1",
    business_id: "demo-business-1",
    name: "Merkez Sube",
    slug: "merkez",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-branch-2",
    business_id: "demo-business-1",
    name: "Bahce Sube",
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
  const cacheKey = `business-by-slug:${slug}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return { business: demoBusiness, usingDemoData: true };
      }

      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, slug, plan, is_active, created_at, updated_at")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        if (error.message.toLowerCase().includes("businesses")) {
          return { business: null as Business | null, usingDemoData: false, useLegacySchema: true };
        }
        return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
      }

      if (!data) {
        return { business: null as Business | null, usingDemoData: false, useLegacySchema: false };
      }

      return {
        business: data as Business,
        usingDemoData: false,
        useLegacySchema: false,
      };
    },
    [cacheKey],
    { revalidate: 60, tags: ["businesses"] },
  );

  return reader();
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
  const supabase = await getSupabaseAuthServerClient();
  const scope = await getDefaultBusinessScope();
  const activeBranchId = scope.branchId;
  if (!supabase) {
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

  const cacheKey = `branches:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.canAccessAllBranches ? "all" : scope.branchAccessIds.join(",")}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
        .from("branches")
        .select("id, business_id, name, slug, is_active, created_at, updated_at")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (!scope.useLegacySchema && scope.businessId) {
        query = query.eq("business_id", scope.businessId);
      }
      if (!scope.canAccessAllBranches) {
        query = query.in("id", scope.branchAccessIds);
      }

      const { data, error } = await query;
      return {
        hasError: Boolean(error),
        errorMessage: error?.message ?? null,
        branches: (data ?? []) as Branch[],
      };
    },
    [cacheKey],
    { revalidate: 20, tags: ["branches"] },
  );

  const cached = await reader();
  const data = cached?.branches ?? [];
  const error = cached?.hasError ? { message: cached.errorMessage ?? "branches" } : null;
  if (error) {
    if (error.message.toLowerCase().includes("branches")) {
      return { branches: [] as Branch[], activeBranchId: activeBranchId || "", usingDemoData: false };
    }
    return { branches: demoBranches, activeBranchId: activeBranchId || demoBranches[0]?.id || "", usingDemoData: true };
  }

  const branches = (data ?? []) as Branch[];
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

export async function createBranch(input: { name: string; slug: string }) {
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
  if (!name || !slug) {
    return { ok: false, error: "Sube adi ve slug zorunludur." };
  }

  const { data, error } = await supabase
    .from("branches")
    .insert({
      business_id: scope.businessId,
      name,
      slug,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "branch",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { name, slug },
  });

  return { ok: true, id: String(data?.id ?? "") };
}

export async function updateBranch(input: { branchId: string; name: string; slug: string }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sube guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  const name = input.name.trim();
  const slug = normalizeBusinessSlug(input.slug);
  if (!name || !slug) {
    return { ok: false, error: "Sube adi ve slug zorunludur." };
  }

  let query = supabase
    .from("branches")
    .update({
      name,
      slug,
    })
    .eq("id", input.branchId);
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
    action: "update",
    details: { name, slug },
  });

  return { ok: true };
}

export async function setBranchActiveStatus(input: { branchId: string; isActive: boolean }) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda sube durum guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
      return { ok: false, error: "En az bir aktif sube kalmali." };
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
    return { ok: false, error: "Demo modda sube silme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
  }

  const { count: branchCount, error: countError } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", scope.businessId);
  if (countError) {
    return { ok: false, error: countError.message };
  }
  if ((branchCount ?? 0) <= 1) {
    return { ok: false, error: "Son sube silinemez." };
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
    return { ok: false, error: "Bu subede masa, siparis veya kurye kaydi oldugu icin silinemez." };
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

  const reader = unstable_cache(
    async () => {
      const innerSupabase = await getTenantDataClient();
      if (!innerSupabase) {
        return null;
      }

      const { data, error } = await innerSupabase
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
    return { ok: false, error: "Demo modda isletme olusturma pasif." };
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
    return { ok: false, error: "Isletme olusturulamadi." };
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
    return { ok: false, error: "Demo modda isletme guncelleme pasif." };
  }

  const { data: activeRows } = await supabase
    .from("businesses")
    .select("id")
    .eq("is_active", true);
  const activeCount = (activeRows ?? []).length;
  if (!input.isActive && activeCount <= 1) {
    return { ok: false, error: "En az bir aktif isletme kalmali." };
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

export async function updateActiveBusinessPlan(plan: BusinessPlan) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda plan guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { couriers: demoCouriers, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { couriers: [] as Courier[], usingDemoData: false };
  }
  const cacheKey = `couriers:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = await getTenantDataClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
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
    },
    [cacheKey],
    { revalidate: 12, tags: ["couriers"] },
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
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
    return { ok: false, error: "Aktif teslimati olan kurye silinemez. Once siparisleri kapatin veya baska kuryeye atayin." };
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

export async function getMenu(businessSlug?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      categories: demoCategories,
      products: demoProducts,
      modifierGroups: demoModifierGroups,
      modifierOptions: demoModifierOptions,
      usingDemoData: true,
    };
  }

  const { business, useLegacySchema } = await resolveBusinessBySlug(businessSlug);
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

      const [categoryResult, productResult] = await withQueryTimeout(
        Promise.all([
          useLegacySchema
            ? innerSupabase.from("categories").select("id, name, sort_order").order("sort_order", { ascending: true })
            : innerSupabase
                .from("categories")
                .select("id, business_id, name, sort_order")
                .eq("business_id", business!.id)
                .order("sort_order", { ascending: true }),
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
    { revalidate: 20, tags: ["menu", "product-management"] },
  );

  try {
    const cached = await reader();
    if (!cached || cached.hasError) {
      return {
        categories: demoCategories,
        products: demoProducts,
        modifierGroups: demoModifierGroups,
        modifierOptions: demoModifierOptions,
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
    return {
      categories: demoCategories,
      products: demoProducts,
      modifierGroups: demoModifierGroups,
      modifierOptions: demoModifierOptions,
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
    return { ok: false, error: "Talep olusturulamadi." };
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
  tables: { table_number: number } | { table_number: number }[] | null;
};

export async function listTableRequests(status: "open" | "resolved" = "open") {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { requests: [] as TableRequest[], usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.useLegacySchema && !scope.businessId) {
    return { requests: [] as TableRequest[], usingDemoData: false };
  }
  const cacheKey = `table-requests:${scope.businessId ?? "none"}:${scope.branchId ?? "all"}:${status}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = getSupabaseServerClient();
      if (!innerSupabase) {
        return null;
      }

      let query = innerSupabase
        .from("table_requests")
        .select("id, table_id, request_type, status, note, created_at, resolved_at, tables(table_number)")
        .eq("status", status)
        .order("created_at", { ascending: false });

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
    return { requests: [] as TableRequest[], usingDemoData: false };
  }

  const requests = ((cached.data ?? []) as TableRequestRow[]).map((row) => ({
    id: row.id,
    branch_id: (row as { branch_id?: string | null }).branch_id ?? scope.branchId ?? null,
    table_id: row.table_id,
    table_number: getTableNumber(row.tables),
    request_type: row.request_type,
    status: row.status,
    note: row.note,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  }));

  return { requests, usingDemoData: false };
}

export async function resolveTableRequest(requestId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda talep cozme pasif." };
  }

  const { error } = await supabase
    .from("table_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "table_request",
    entityId: requestId,
    action: "resolve",
  });
  revalidateOperationsCaches();
  return { ok: true };
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
  const fulfillmentStatus =
    input.fulfillmentStatus ?? (channel === "delivery" ? "awaiting_dispatch" : "not_applicable");
  const trimmedCustomerName = input.customerName?.trim() || null;
  const trimmedCustomerPhone = input.customerPhone?.trim() || null;
  const trimmedDeliveryAddress = input.deliveryAddress?.trim() || null;
  const trimmedDeliveryNote = input.deliveryNote?.trim() || null;
  const trimmedCourierName = input.courierName?.trim() || null;
  const trimmedCourierPhone = input.courierPhone?.trim() || null;
  const courierId = input.courierId ?? null;

  const withBusinessPayload = {
    business_id: input.businessId ?? scope.businessId ?? null,
    branch_id: input.branchId ?? scope.branchId ?? null,
    table_id: input.tableId ?? null,
    items: input.items,
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
    items: input.items,
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
    return { ok: false, error: "Siparis olusturulamadi." };
  }

  const orderId = orderData.id as string;
  const payload = input.items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
  }));

  const { error: itemError } = await supabase.from("order_items").insert(payload);
  if (itemError) {
    await supabase.from("orders").delete().eq("id", orderId);
    return { ok: false, error: itemError.message };
  }

  const modifierPayload = input.items.flatMap((item) =>
    (item.modifiers ?? []).map((modifier) => ({
      order_id: orderId,
      product_id: item.product_id,
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
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      return { ok: false, error: modifierInsert.error.message };
    }
  }

  if (input.tableId) {
    await supabase.from("tables").update({ status: "occupied" as TableStatus }).eq("id", input.tableId);
  }
  await logAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "create",
    details: {
      tableId: input.tableId ?? null,
      channel,
      totalPrice: input.totalPrice,
      itemCount: input.items.length,
      customerName: trimmedCustomerName,
      courierId,
    },
  });
  return { ok: true, id: orderId, usingDemoData: false };
}

type OrderRow = {
  id: string;
  branch_id?: string | null;
  table_id: string | null;
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
  tables: { table_number: number } | { table_number: number }[] | null;
};

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

async function getOrderPaymentSummaryMap(supabase: TenantSupabaseClient | null, orderIds: string[]) {
  if (!supabase || orderIds.length === 0) {
    return new Map<string, { paid: number; refunds: number; net: number; count: number }>();
  }

  const { data } = await supabase
    .from("payments")
    .select("order_id, payment_type, amount")
    .in("order_id", orderIds);

  const map = new Map<string, { paid: number; refunds: number; net: number; count: number }>();
  for (const row of (data ?? []) as Array<{ order_id: string; payment_type: "sale" | "refund"; amount: number }>) {
    const current = map.get(row.order_id) ?? { paid: 0, refunds: 0, net: 0, count: 0 };
    const amount = Number(row.amount);
    if (row.payment_type === "refund") {
      current.refunds += amount;
      current.net -= amount;
    } else {
      current.paid += amount;
      current.net += amount;
      current.count += 1;
    }
    map.set(row.order_id, current);
  }
  return map;
}

function applyPaymentSummaryToOrders(
  orders: Order[],
  paymentSummary: Map<string, { paid: number; refunds: number; net: number; count: number }>,
) {
  return orders.map((order) => {
    const summary = paymentSummary.get(order.id);
    const amountPaid = summary?.net ?? 0;
    const finalPrice = Number(order.final_price ?? order.total_price);

    return {
      ...order,
      amount_paid: amountPaid,
      remaining_balance: Math.max(0, finalPrice - amountPaid),
      payment_count: summary?.count ?? 0,
    };
  });
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
    branch_id: row.branch_id ?? null,
    table_id: row.table_id,
    table_number: getTableNumber(row.tables),
    channel: row.channel ?? "dine_in",
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    delivery_address: row.delivery_address ?? null,
    delivery_note: row.delivery_note ?? null,
    courier_id: row.courier_id ?? null,
    courier_name: row.courier_name ?? null,
    courier_phone: row.courier_phone ?? null,
    fulfillment_status: row.fulfillment_status ?? "not_applicable",
    amount_paid: paymentSummary.get(row.id)?.net ?? 0,
    remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
    payment_count: paymentSummary.get(row.id)?.count ?? 0,
    items: groupedItems.get(row.id) ?? [],
    total_price: Number(row.total_price),
    discount_amount: Number(row.discount_amount ?? 0),
    service_fee: Number(row.service_fee ?? 0),
    final_price: Number(row.final_price ?? row.total_price),
    status: row.status,
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
  limit: number | null;
  ascending: boolean;
}) {
  const statusKey = [...input.statuses].sort().join(",");
  const channelKey = input.channels?.length ? [...input.channels].sort().join(",") : "all-channels";
  const cacheKey = `orders-summary:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${statusKey}:${channelKey}:${input.includePaymentSummary ? "payments" : "no-payments"}:${input.limit ?? "all"}:${input.ascending ? "asc" : "desc"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      let ordersQuery = supabase
        .from("orders")
        .select("id, branch_id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number)")
        .in("status", input.statuses)
        .order("created_at", { ascending: input.ascending });
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
        ? await getOrderPaymentSummaryMap(supabase, orderIds)
        : new Map<string, { paid: number; refunds: number; net: number; count: number }>();

      return {
        orders: orders.map((row) => ({
          id: row.id,
          branch_id: row.branch_id ?? null,
          table_id: row.table_id,
          table_number: getTableNumber(row.tables),
          channel: row.channel ?? "dine_in",
          customer_name: row.customer_name ?? null,
          customer_phone: row.customer_phone ?? null,
          delivery_address: row.delivery_address ?? null,
          delivery_note: row.delivery_note ?? null,
          courier_id: row.courier_id ?? null,
          courier_name: row.courier_name ?? null,
          courier_phone: row.courier_phone ?? null,
          fulfillment_status: row.fulfillment_status ?? "not_applicable",
          amount_paid: paymentSummary.get(row.id)?.net ?? 0,
          remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
          payment_count: paymentSummary.get(row.id)?.count ?? 0,
          items: [],
          total_price: Number(row.total_price),
          discount_amount: Number(row.discount_amount ?? 0),
          service_fee: Number(row.service_fee ?? 0),
          final_price: Number(row.final_price ?? row.total_price),
          status: row.status,
          created_at: row.created_at,
        })) as Order[],
        hasError: false,
      };
    },
    [cacheKey],
    { revalidate: 10, tags: ["orders-summary"] },
  );

  return reader();
}

async function getCachedOrderReceiptRow(input: {
  orderId: string;
}) {
  const cacheKey = `order-receipt:${input.orderId}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number)")
        .eq("id", input.orderId)
        .maybeSingle();

      if (error || !data) {
        return { hasError: true as const, order: null as Order | null };
      }

      const [paymentSummary, { data: itemRows }, { data: modifierRows }] = await Promise.all([
        getOrderPaymentSummaryMap(supabase, [input.orderId]),
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

      const tableInfo = data.tables as { table_number: number } | { table_number: number }[] | null;
      const tableNumber = Array.isArray(tableInfo) ? tableInfo[0]?.table_number : tableInfo?.table_number;

      return {
        hasError: false as const,
        order: {
          id: data.id as string,
          table_id: (data.table_id as string | null) ?? null,
          table_number: tableNumber,
          channel: (data.channel as OrderChannel | null) ?? "dine_in",
          customer_name: (data.customer_name as string | null) ?? null,
          customer_phone: (data.customer_phone as string | null) ?? null,
          delivery_address: (data.delivery_address as string | null) ?? null,
          delivery_note: (data.delivery_note as string | null) ?? null,
          courier_id: (data.courier_id as string | null) ?? null,
          courier_name: (data.courier_name as string | null) ?? null,
          courier_phone: (data.courier_phone as string | null) ?? null,
          fulfillment_status: (data.fulfillment_status as FulfillmentStatus | null) ?? "not_applicable",
          amount_paid: paymentSummary.get(input.orderId)?.net ?? 0,
          remaining_balance: Math.max(0, Number(data.final_price ?? data.total_price) - (paymentSummary.get(input.orderId)?.net ?? 0)),
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
          created_at: data.created_at as string,
        } as Order,
      };
    },
    [cacheKey],
    { revalidate: 8, tags: ["order-receipt", "orders-summary"] },
  );

  return reader();
}

async function getCachedKitchenOrdersSnapshot(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}) {
  const statusKey = ["pending", "preparing", "served"].join(",");
  const cacheKey = `kitchen-orders:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${statusKey}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      let ordersQuery = supabase
        .from("orders")
        .select("id, branch_id, table_id, channel, customer_name, delivery_address, fulfillment_status, status, created_at, tables(table_number)")
        .in("status", ["pending", "preparing", "served"])
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
          branch_id: row.branch_id ?? null,
          table_id: row.table_id,
          table_number: getTableNumber(row.tables),
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
          total_price: 0,
          discount_amount: 0,
          service_fee: 0,
          final_price: 0,
          status: row.status,
          created_at: row.created_at,
        })) as Order[],
        hasError: false,
      };
    },
    [cacheKey],
    { revalidate: 8, tags: ["kitchen-orders", "orders-summary"] },
  );

  return reader();
}

export async function listOrders(
  statuses: OrderStatus[],
  options?: { includeItems?: boolean; includePaymentSummary?: boolean; limit?: number; ascending?: boolean; channels?: OrderChannel[] },
) {
  const supabase = await getTenantDataClient();
  const includeItems = options?.includeItems ?? true;
  const includePaymentSummary = options?.includePaymentSummary ?? true;
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

  let ordersQuery = supabase
    .from("orders")
    .select("id, branch_id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number)")
    .in("status", statuses)
    .order("created_at", { ascending });
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
        branch_id: row.branch_id ?? null,
        table_id: row.table_id,
        table_number: getTableNumber(row.tables),
        channel: row.channel ?? "dine_in",
        customer_name: row.customer_name ?? null,
        customer_phone: row.customer_phone ?? null,
        delivery_address: row.delivery_address ?? null,
        delivery_note: row.delivery_note ?? null,
        courier_id: row.courier_id ?? null,
        courier_name: row.courier_name ?? null,
        courier_phone: row.courier_phone ?? null,
        fulfillment_status: row.fulfillment_status ?? "not_applicable",
        amount_paid: paymentSummary.get(row.id)?.net ?? 0,
        remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
        payment_count: paymentSummary.get(row.id)?.count ?? 0,
        items: [],
        total_price: Number(row.total_price),
        discount_amount: Number(row.discount_amount ?? 0),
        service_fee: Number(row.service_fee ?? 0),
        final_price: Number(row.final_price ?? row.total_price),
        status: row.status,
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
        .select("id, table_id, items, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number)")
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
      OrderRow & { items: OrderItem[] | null; tables: { table_number: number } | { table_number: number }[] | null }
    >;
    return {
      orders: fallback.map((row) => ({
        id: row.id,
        branch_id: row.branch_id ?? null,
        table_id: row.table_id,
        table_number: getTableNumber(row.tables),
        channel: row.channel ?? "dine_in",
        customer_name: row.customer_name ?? null,
        customer_phone: row.customer_phone ?? null,
        delivery_address: row.delivery_address ?? null,
        delivery_note: row.delivery_note ?? null,
        courier_id: row.courier_id ?? null,
        courier_name: row.courier_name ?? null,
        courier_phone: row.courier_phone ?? null,
        fulfillment_status: row.fulfillment_status ?? "not_applicable",
        amount_paid: paymentSummary.get(row.id)?.net ?? 0,
        remaining_balance: Math.max(0, Number(row.final_price ?? row.total_price) - (paymentSummary.get(row.id)?.net ?? 0)),
        payment_count: paymentSummary.get(row.id)?.count ?? 0,
        items: row.items ?? [],
        total_price: row.total_price,
        discount_amount: Number(row.discount_amount ?? 0),
        service_fee: Number(row.service_fee ?? 0),
        final_price: Number(row.final_price ?? row.total_price),
        status: row.status,
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
      orders: demoOrders.filter((order) => ["pending", "preparing", "served"].includes(order.status)),
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

  return listOrders(["pending", "preparing", "served"], { includePaymentSummary: false });
}

export async function getCashierPageSnapshot(selectedOrderId?: string) {
  const [servedResult, paidResult, selectedOrderResult, supabase] = await Promise.all([
    listOrders(["served"], { includeItems: false, includePaymentSummary: false }),
    listOrders(["paid"], { includeItems: false, includePaymentSummary: false, limit: 8, ascending: false }),
    typeof selectedOrderId === "string"
      ? getOrderReceipt(selectedOrderId)
      : Promise.resolve({ order: null as Order | null, usingDemoData: false }),
    getTenantDataClient(),
  ]);

  const orderIds = [...servedResult.orders, ...paidResult.orders].map((order) => order.id);
  const paymentSummary = await getOrderPaymentSummaryMap(supabase, orderIds);

  return {
    servedOrders: applyPaymentSummaryToOrders(servedResult.orders, paymentSummary),
    paidOrders: applyPaymentSummaryToOrders(paidResult.orders, paymentSummary),
    selectedOrder: selectedOrderResult.order,
    usingDemoData: servedResult.usingDemoData || paidResult.usingDemoData || selectedOrderResult.usingDemoData,
  };
}

export async function getDeliveryPageSnapshot(selectedOrderId?: string) {
  const [ordersResult, couriersResult, selectedOrderResult] = await Promise.all([
    listOrders(["pending", "preparing", "served"], {
      includeItems: false,
      includePaymentSummary: false,
      channels: ["delivery"],
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
      categories: [] as Array<Pick<Category, "id" | "name">>,
      products: [] as Array<Pick<Product, "id" | "category_id">>,
      usingDemoData: ordersResult.usingDemoData,
    };
  }

  const catalogResult = await getKitchenCatalogSnapshot();

  return {
    orders: ordersResult.orders,
    categories: catalogResult.categories,
    products: catalogResult.products,
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

  const cached = await getCachedOrderReceiptRow({ orderId });
  if (cached && !cached.hasError) {
    return { order: cached.order, usingDemoData: false };
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, table_id, total_price, discount_amount, service_fee, final_price, channel, customer_name, customer_phone, delivery_address, delivery_note, courier_id, courier_name, courier_phone, fulfillment_status, status, created_at, tables(table_number)")
    .eq("id", orderId)
    .maybeSingle();

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

  const tableInfo = data.tables as { table_number: number } | { table_number: number }[] | null;
  const tableNumber = Array.isArray(tableInfo) ? tableInfo[0]?.table_number : tableInfo?.table_number;
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
      table_id: (data.table_id as string | null) ?? null,
      table_number: tableNumber,
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
      created_at: data.created_at as string,
    } as Order,
    usingDemoData: false,
  };
}

function getTableNumber(
  tables: { table_number: number } | { table_number: number }[] | null,
): number | undefined {
  if (!tables) {
    return undefined;
  }
  if (Array.isArray(tables)) {
    return tables[0]?.table_number;
  }
  return tables.table_number;
}

export async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: true, usingDemoData: true };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, table_id").eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Order not found" };
  }

  let updateQuery = supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    updateQuery = updateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    updateQuery = updateQuery.eq("branch_id", scope.branchId);
  }
  const { error } = await updateQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  if (nextStatus === "paid") {
    if (orderRow.table_id) {
      await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", orderRow.table_id);
    }
  }

  await logAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "status_change",
    details: { nextStatus },
  });

  revalidateOperationsCaches();
  revalidateReportCaches();
  return { ok: true, usingDemoData: false };
}

export async function applyOrderFinancials(input: {
  orderId: string;
  discountAmount: number;
  serviceFee: number;
}) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda finansal guncelleme pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, total_price").eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Siparis bulunamadi." };
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
    })
    .eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    financialQuery = financialQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    financialQuery = financialQuery.eq("branch_id", scope.branchId);
  }
  const { error } = await financialQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "order",
    entityId: input.orderId,
    action: "financial_update",
    details: { discountAmount, serviceFee, finalPrice },
  });

  revalidateOperationsCaches();
  revalidateReportCaches();
  return { ok: true, finalPrice };
}

export async function completeOrderPayment(input: {
  orderId: string;
  method: PaymentMethod;
  amount?: number;
  note?: string;
  createdBy?: string;
}) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda odeme islemi pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase
    .from("orders")
    .select("id, table_id, final_price, total_price")
    .eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Siparis bulunamadi." };
  }

  const paymentSummary = await getOrderPaymentSummaryMap(supabase, [input.orderId]);
  const alreadyPaid = paymentSummary.get(input.orderId)?.net ?? 0;
  const targetAmount = Number(orderRow.final_price ?? orderRow.total_price);
  const remaining = Math.max(0, targetAmount - alreadyPaid);
  const amount = Math.max(0, Number(input.amount ?? remaining));
  if (amount <= 0) {
    return { ok: false, error: "Odeme tutari sifirdan buyuk olmali." };
  }
  if (amount > remaining) {
    return { ok: false, error: "Odeme tutari kalan bakiyeden buyuk olamaz." };
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
  };
  const fallbackPayment = {
    order_id: input.orderId,
    payment_type: "sale",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  };
  let paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
  if (paymentInsert.error?.message?.toLowerCase().includes("business_id")) {
    paymentInsert = await supabase.from("payments").insert(fallbackPayment);
  }
  const paymentError = paymentInsert.error;
  if (paymentError) {
    return { ok: false, error: paymentError.message };
  }

  const nextPaidTotal = alreadyPaid + amount;
  const nextStatus = nextPaidTotal >= targetAmount ? ("paid" as OrderStatus) : ("served" as OrderStatus);
  let orderUpdateQuery = supabase.from("orders").update({ status: nextStatus }).eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    orderUpdateQuery = orderUpdateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    orderUpdateQuery = orderUpdateQuery.eq("branch_id", scope.branchId);
  }
  const { error: orderError } = await orderUpdateQuery;
  if (orderError) {
    return { ok: false, error: orderError.message };
  }

  if (nextStatus === "paid" && orderRow.table_id) {
    await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", orderRow.table_id);
  }
  await logAuditEvent({
    entityType: "payment",
    entityId: input.orderId,
    action: "complete_payment",
    details: { method: input.method, amount, nextPaidTotal, remaining: Math.max(0, targetAmount - nextPaidTotal) },
  });
  revalidateOperationsCaches();
  revalidateReportCaches();
  return { ok: true, status: nextStatus, amountPaid: nextPaidTotal, remaining: Math.max(0, targetAmount - nextPaidTotal) };
}

export async function cancelOrder(orderId: string, note?: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda iptal pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase.from("orders").select("id, table_id").eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    findQuery = findQuery.eq("branch_id", scope.branchId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Siparis bulunamadi." };
  }

  let cancelQuery = supabase.from("orders").update({ status: "cancelled" as OrderStatus }).eq("id", orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    cancelQuery = cancelQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    cancelQuery = cancelQuery.eq("branch_id", scope.branchId);
  }
  const { error } = await cancelQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  if (orderRow.table_id) {
    await supabase.from("tables").update({ status: "empty" as TableStatus }).eq("id", orderRow.table_id);
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
    };
    const fallbackPayment = {
      order_id: orderId,
      payment_type: "sale",
      method: "cash" as PaymentMethod,
      amount: 0,
      note: `cancel_note:${note}`,
    };
    const paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
    if (paymentInsert.error?.message?.toLowerCase().includes("business_id")) {
      await supabase.from("payments").insert(fallbackPayment);
    }
  }
  await logAuditEvent({
    entityType: "order",
    entityId: orderId,
    action: "cancel",
    details: { note: note ?? null },
  });
  revalidateOperationsCaches();
  revalidateReportCaches();
  return { ok: true };
}

export async function refundOrder(input: {
  orderId: string;
  method: PaymentMethod;
  amount?: number;
  note?: string;
  createdBy?: string;
}) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda iade pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let findQuery = supabase
    .from("orders")
    .select("id, final_price, total_price")
    .eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    findQuery = findQuery.eq("business_id", scope.businessId);
  }
  const { data: orderRow, error: findError } = await findQuery.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: findError?.message ?? "Siparis bulunamadi." };
  }

  const amount = Math.max(0, Number(input.amount ?? orderRow.final_price ?? orderRow.total_price));
  const withBusinessPayment = {
    business_id: scope.businessId,
    branch_id: scope.branchId,
    order_id: input.orderId,
    payment_type: "refund",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  };
  const fallbackPayment = {
    order_id: input.orderId,
    payment_type: "refund",
    method: input.method,
    amount,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  };
  let paymentInsert = await supabase.from("payments").insert(withBusinessPayment);
  if (paymentInsert.error?.message?.toLowerCase().includes("business_id")) {
    paymentInsert = await supabase.from("payments").insert(fallbackPayment);
  }
  const paymentError = paymentInsert.error;
  if (paymentError) {
    return { ok: false, error: paymentError.message };
  }

  let refundUpdateQuery = supabase.from("orders").update({ status: "refunded" as OrderStatus }).eq("id", input.orderId);
  if (!scope.useLegacySchema && scope.businessId) {
    refundUpdateQuery = refundUpdateQuery.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    refundUpdateQuery = refundUpdateQuery.eq("branch_id", scope.branchId);
  }
  const { error } = await refundUpdateQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  await logAuditEvent({
    entityType: "payment",
    entityId: input.orderId,
    action: "refund",
    details: { method: input.method, amount, note: input.note ?? null },
  });

  revalidateOperationsCaches();
  revalidateReportCaches();
  return { ok: true };
}

export async function assignOrderCourier(input: {
  orderId: string;
  courierId: string;
  courierName: string;
  courierPhone?: string | null;
}) {
  const supabase = await getTenantDataClient();
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
    .eq("channel", "delivery");
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
    entityType: "order",
    entityId: input.orderId,
    action: "assign_courier",
    details: {
      courierId: input.courierId,
      courierName: input.courierName,
      courierPhone: input.courierPhone ?? null,
    },
  });

  revalidateOperationsCaches();
  return { ok: true };
}

export async function markDeliveryCompleted(orderId: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda teslimat tamamlama pasif." };
  }

  const scope = await getDefaultBusinessScope();
  let query = supabase
    .from("orders")
    .update({ fulfillment_status: "completed" as FulfillmentStatus, status: "served" as OrderStatus })
    .eq("id", orderId)
    .eq("channel", "delivery");
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
    entityType: "order",
    entityId: orderId,
    action: "delivery_completed",
  });

  revalidateOperationsCaches();
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

export async function createTable(tableNumber: number, name?: string) {
  return createTableImpl(tableNumber, name, {
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

export async function deleteTable(tableId: string) {
  return deleteTableImpl(tableId, {
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

function revalidateOperationsCaches() {
  revalidateTag("table-map", "max");
  revalidateTag("dashboard-snapshot", "max");
  revalidateTag("orders-summary", "max");
  revalidateTag("kitchen-orders", "max");
  revalidateTag("table-requests", "max");
  revalidateTag("couriers", "max");
  revalidateTag("order-receipt", "max");
}

export async function getProductManagementData(
  options?: {
    tab?: import("@/lib/server/products-data").ProductManagementTab;
  },
) {
  return getProductManagementDataImpl({
    getDefaultBusinessScope,
    logAuditEvent,
    revalidateProductManagementCaches,
    demoCategories,
    demoProducts,
    demoIngredients,
    demoModifierGroups,
    demoModifierOptions,
    demoProductIngredients,
  }, options);
}

export async function getKitchenCatalogSnapshot() {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return {
      categories: demoCategories,
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
      categories: [] as Pick<Category, "id" | "name">[],
      products: [] as Pick<Product, "id" | "category_id">[],
      usingDemoData: false,
    };
  }
  const cacheKey = `kitchen-catalog:${scope.businessId ?? "none"}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerSupabase = await getTenantDataClient();
      if (!innerSupabase) {
        return null;
      }

      let categoriesQuery = innerSupabase.from("categories").select("id, name").order("sort_order", { ascending: true });
      let productsQuery = innerSupabase.from("products").select("id, category_id");

      if (!scope.useLegacySchema && scope.businessId) {
        categoriesQuery = categoriesQuery.eq("business_id", scope.businessId);
        productsQuery = productsQuery.eq("business_id", scope.businessId);
      }

      const [categoryResult, productResult] = await withQueryTimeout(Promise.all([categoriesQuery, productsQuery]));
      if (categoryResult.error || productResult.error) {
        return { hasError: true as const, categories: [] as Array<Pick<Category, "id" | "name">>, products: [] as Array<Pick<Product, "id" | "category_id">> };
      }

      return {
        hasError: false as const,
        categories: (categoryResult.data ?? []) as Array<Pick<Category, "id" | "name">>,
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
        categories: demoCategories,
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
      categories: demoCategories,
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
  const supabase = await getTenantDataClient();
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

  await logAuditEvent({
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
  const supabase = await getTenantDataClient();
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

  await logAuditEvent({
    entityType: "product_modifier_option",
    entityId: String(data?.id ?? ""),
    action: "create",
    details: { groupId: input.groupId, name: input.name.trim(), priceDelta: Number(input.priceDelta ?? 0) },
  });

  revalidateProductManagementCaches();
  return { ok: true };
}

export async function deleteProductModifierGroup(groupId: string) {
  const supabase = await getTenantDataClient();
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
  const supabase = await getTenantDataClient();
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
  description?: string;
  imageUrl?: string;
  isAvailable?: boolean;
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
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
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

export async function createIngredient(name: string, unit: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda malzeme ekleme pasif." };
  }

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name, unit })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProductManagementCaches();
  return { ok: true, id: data.id as string };
}

export async function deleteIngredient(ingredientId: string) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda malzeme silme pasif." };
  }

  const { error } = await supabase.from("ingredients").delete().eq("id", ingredientId);
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
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda urun malzemesi duzenleme pasif." };
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
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda urun malzemesi duzenleme pasif." };
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

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { profiles: [] as Array<{ id: string; full_name: string | null; role: AppRole }>, usingDemoData: false };
  }

  const cacheKey = `profiles:${scope.businessId}:${scope.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const innerAuthClient = await getSupabaseAuthServerClient();
      if (!innerAuthClient) {
        return null;
      }

      const { data: accessRows, error: accessError } = await innerAuthClient
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

      const { data, error } = await innerAuthClient
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
      const { data } = await serviceClient.auth.admin.listUsers();
      return (data?.users ?? []).map((user) => ({
        id: user.id,
        email: user.email ?? null,
      }));
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
}

export async function updateProfileRole(profileId: string, role: AppRole) {
  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { ok: false, error: "Demo modda rol guncelleme pasif." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
    return { ok: false, error: "Bu personel aktif isletme kapsaminda bulunamadi." };
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
      return { ok: false, error: "Sube personeli icin once en az bir aktif sube olusturulmalidir." };
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
  const normalizedAccessScope: StaffAccessScope = input.role === "owner" ? "business" : "branch";
  const normalizedBranchId = normalizedAccessScope === "branch" ? input.branchId ?? null : null;

  if (normalizedAccessScope === "branch" && !normalizedBranchId) {
    return { ok: false, error: "Sube personeli icin bir sube secilmelidir." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
    return { ok: false, error: "Bu personel aktif isletme kapsaminda bulunamadi." };
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
    return { ok: false, error: "Aktif isletme bulunamadi." };
  }

  const { data: accessRows, error: accessError } = await authClient
    .from("staff_branch_access")
    .select("business_id")
    .eq("profile_id", profileId);
  if (accessError || !accessRows || accessRows.length === 0) {
    return { ok: false, error: accessError?.message ?? "Personel erisim kaydi bulunamadi." };
  }

  if (!(accessRows as Array<{ business_id: string }>).some((row) => row.business_id === businessScope.businessId)) {
    return { ok: false, error: "Bu personel aktif isletme kapsaminda bulunamadi." };
  }

  if ((accessRows as Array<{ business_id: string }>).some((row) => row.business_id !== businessScope.businessId)) {
    return { ok: false, error: "Bu hesap birden fazla isletmede kullaniliyor. Guvenlik icin global silme engellendi." };
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
    return { ok: false, error: "Demo modda kullanici olusturma pasif." };
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
    return { ok: false, error: "Sube personeli icin bir sube secilmelidir." };
  }

  const businessScope = await getDefaultBusinessScope();
  if (!businessScope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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
      return { ok: false, error: "Bu e-posta baska bir isletmede kullaniliyor. Tenant guvenligi icin ayni hesap yeniden baglanamaz." };
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
    return { ok: false, error: "Kullanici hesabi olusturulamadi." };
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
      error: `Bazi demo hesaplari olusturulamadi: ${failed.map((item) => item.email).join(", ")}`,
    };
  }

  return { ok: true, count: results.length };
}

export async function createCategory(name: string, sortOrder: number) {
  return createCategoryImpl(name, sortOrder, {
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
  let query = supabase.from("categories").update({ sort_order: sortOrder }).eq("id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  const { error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  await logAuditEvent({
    entityType: "category",
    entityId: categoryId,
    action: "sort_order_update",
    details: { sortOrder },
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
  for (let index = 0; index < categoryIds.length; index += 1) {
    let query = supabase
      .from("categories")
      .update({ sort_order: index + 1 })
      .eq("id", categoryIds[index]);

    if (!scope.useLegacySchema && scope.businessId) {
      query = query.eq("business_id", scope.businessId);
    }

    const { error } = await query;
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  await logAuditEvent({
    entityType: "category",
    entityId: "bulk",
    action: "reorder",
    details: { categoryIds },
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
    return { ok: false, error: "Gecersiz yuzde degeri." };
  }

  const scope = await getDefaultBusinessScope();
  let listQuery = supabase.from("products").select("id, price").eq("category_id", categoryId);
  if (!scope.useLegacySchema && scope.businessId) {
    listQuery = listQuery.eq("business_id", scope.businessId);
  }
  const { data: products, error: listError } = await listQuery;
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

  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, product_id, change_amount, previous_stock, new_stock, reason, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

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

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, entity_type, entity_id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

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
}) {
  const cacheKey = `sales-report-summary:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.days}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (input.days - 1));

      let query = supabase
        .from("payments")
        .select("amount, payment_type, created_at")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true });

      if (!input.useLegacySchema && input.businessId) {
        query = query.eq("business_id", input.businessId);
      }
      if (input.branchId) {
        query = query.eq("branch_id", input.branchId);
      }

      const { data, error } = await query;
      if (error) {
        return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, hasError: true };
      }

      const map = new Map<string, { sales: number; refunds: number }>();
      for (let i = 0; i < input.days; i += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        map.set(day.toISOString().slice(0, 10), { sales: 0, refunds: 0 });
      }

      for (const row of data ?? []) {
        const day = String(row.created_at).slice(0, 10);
        if (!map.has(day)) {
          map.set(day, { sales: 0, refunds: 0 });
        }
        const bucket = map.get(day)!;
        const amount = Number(row.amount);
        if (row.payment_type === "refund") {
          bucket.refunds += amount;
        } else {
          bucket.sales += amount;
        }
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
    { revalidate: 15, tags: ["sales-report-summary"] },
  );

  return reader();
}

export async function getSalesReportSummary(days = 7) {
  const supabase = await getTenantDataClient();
  if (!supabase) {
    return { rows: [] as Array<{ day: string; sales: number; refunds: number; net: number }>, usingDemoData: true };
  }

  try {
    const scope = await getDefaultBusinessScope();
    const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
    const cached = await getCachedSalesReportSummaryRow({
      businessId: scope.businessId,
      branchId: scope.branchId,
      useLegacySchema: scope.useLegacySchema,
      days: safeDays,
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
}) {
  const cacheKey = `financial-insights:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.days}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (input.days - 1));

      const paymentBase = supabase
        .from("payments")
        .select("id, order_id, payment_type, method, amount, note, created_at")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });

      const [{ data: payments, error: paymentsError }] = await Promise.all([
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? paymentBase.eq("business_id", input.businessId).eq("branch_id", input.branchId)
              : paymentBase.eq("business_id", input.businessId))
          : paymentBase,
      ]);

      if (paymentsError) {
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
          topProducts: [] as Array<{ productName: string; qty: number; revenue: number }>,
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

      const paymentRows = (payments ?? []) as Array<{
        id: string;
        order_id: string;
        payment_type: "sale" | "refund";
        method: "cash" | "card" | "mixed";
        amount: number;
        note: string | null;
        created_at: string;
      }>;

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

      for (const row of paymentRows) {
        const amount = Number(row.amount);
        const methodBucket = methodMap.get(row.method) ?? { sales: 0, refunds: 0 };
        if (row.payment_type === "refund") {
          refunds += amount;
          methodBucket.refunds += amount;
        } else {
          grossSales += amount;
          methodBucket.sales += amount;
          const hour = new Date(row.created_at).getHours().toString().padStart(2, "0");
          hourMap.set(hour, (hourMap.get(hour) ?? 0) + amount);
        }
        methodMap.set(row.method, methodBucket);
      }

      const paidOrderIds = [...new Set(paymentRows.filter((row) => row.payment_type === "sale").map((row) => row.order_id).filter(Boolean))];

      let topProducts: Array<{ productName: string; qty: number; revenue: number }> = [];
      if (paidOrderIds.length > 0) {
        const { data: itemRows } = await supabase
          .from("order_items")
          .select("order_id, product_name, quantity, line_total")
          .in("order_id", paidOrderIds);

        const productMap = new Map<string, { qty: number; revenue: number }>();
        for (const row of (itemRows ?? []) as Array<{
          order_id: string;
          product_name: string;
          quantity: number;
          line_total: number;
        }>) {
          const bucket = productMap.get(row.product_name) ?? { qty: 0, revenue: 0 };
          bucket.qty += Number(row.quantity);
          bucket.revenue += Number(row.line_total);
          productMap.set(row.product_name, bucket);
        }
        topProducts = Array.from(productMap.entries())
          .map(([productName, values]) => ({
            productName,
            qty: values.qty,
            revenue: values.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
      }

      const paidOrderCount = paidOrderIds.length;
      const averageTicket = paidOrderCount > 0 ? grossSales / paidOrderCount : 0;

      return {
        hasError: false,
        summary: {
          grossSales,
          refunds,
          netSales: grossSales - refunds,
          discountTotal: 0,
          serviceFeeTotal: 0,
          paidOrderCount,
          averageTicket,
          outstandingReceivables: 0,
          cancelledCount: 0,
        },
        methodBreakdown: Array.from(methodMap.entries()).map(([method, values]) => ({
          method,
          sales: values.sales,
          refunds: values.refunds,
          net: values.sales - values.refunds,
        })),
        hourlySales: Array.from(hourMap.entries()).map(([hour, sales]) => ({
          hour,
          sales,
        })),
        topProducts,
        recentPayments: paymentRows.slice(0, 60),
      };
    },
    [cacheKey],
    { revalidate: 15, tags: ["financial-insights"] },
  );

  return reader();
}

export async function getFinancialInsights(days = 7) {
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
      topProducts: [] as Array<{ productName: string; qty: number; revenue: number }>,
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
    const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
    const cached = await getCachedFinancialInsightsRow({
      businessId: scope.businessId,
      branchId: scope.branchId,
      useLegacySchema: scope.useLegacySchema,
      days: safeDays,
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
        topProducts: [] as Array<{ productName: string; qty: number; revenue: number }>,
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
      topProducts: [] as Array<{ productName: string; qty: number; revenue: number }>,
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
    return { ok: false, error: "Acik kasa oturumu zaten var." };
  }

  let insert = await supabase.from("cash_register_sessions").insert({
    business_id: scope.businessId,
    branch_id: scope.branchId,
    opened_by: openedBy ?? null,
    opening_cash: Math.max(0, Number(openingCash || 0)),
    note: note ?? null,
    status: "open",
  });
  if (insert.error?.message?.toLowerCase().includes("business_id")) {
    insert = await supabase.from("cash_register_sessions").insert({
      opened_by: openedBy ?? null,
      opening_cash: Math.max(0, Number(openingCash || 0)),
      note: note ?? null,
      status: "open",
    });
  }
  const error = insert.error;

  if (error) {
    return { ok: false, error: error.message };
  }
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
  let sessionQuery = supabase.from("cash_register_sessions").select("id, opened_at").eq("id", input.sessionId);
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
  }, 0);

  const closingCash = Math.max(0, Number(input.closingCash || 0));
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

  return { ok: true, expectedCash };
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
  let query = supabase
    .from("payments")
    .select("method, payment_type, amount")
    .gte("created_at", todayStart.toISOString());
  if (!scope.useLegacySchema && scope.businessId) {
    query = query.eq("business_id", scope.businessId);
  }
  if (scope.branchId) {
    query = query.eq("branch_id", scope.branchId);
  }
  const { data, error } = await query;
  if (error) {
    return {
      today: { cashSale: 0, cardSale: 0, mixedSale: 0, refunds: 0, net: 0 },
      usingDemoData: false,
    };
  }

  let cashSale = 0;
  let cardSale = 0;
  let mixedSale = 0;
  let refunds = 0;

  for (const row of data ?? []) {
    const amount = Number(row.amount);
    if (row.payment_type === "refund") {
      refunds += amount;
      continue;
    }
    if (row.method === "cash") {
      cashSale += amount;
    } else if (row.method === "card") {
      cardSale += amount;
    } else {
      mixedSale += amount;
    }
  }

  return {
    today: {
      cashSale,
      cardSale,
      mixedSale,
      refunds,
      net: cashSale + cardSale + mixedSale - refunds,
    },
    usingDemoData: false,
  };
}

export async function getOpsSummary() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      openOrders: demoOrders.filter((order) => ["pending", "preparing", "served"].includes(order.status)).length,
      pendingCount: demoOrders.filter((order) => order.status === "pending").length,
      todayRevenue: 0,
      usingDemoData: true,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const scope = await getDefaultBusinessScope();
  const openBase = supabase.from("orders").select("id, status", { count: "exact" });
  const pendingBase = supabase.from("orders").select("id", { count: "exact" }).eq("status", "pending");
  const paymentBase = supabase
    .from("payments")
    .select("amount, payment_type")
    .gte("created_at", todayStart.toISOString());

  const [{ data: openRows }, { data: pendingRows }, { data: paymentRows }] = await Promise.all([
    !scope.useLegacySchema && scope.businessId
      ? (scope.branchId ? openBase.eq("business_id", scope.businessId).eq("branch_id", scope.branchId) : openBase.eq("business_id", scope.businessId))
      : openBase,
    !scope.useLegacySchema && scope.businessId
      ? (scope.branchId ? pendingBase.eq("business_id", scope.businessId).eq("branch_id", scope.branchId) : pendingBase.eq("business_id", scope.businessId))
      : pendingBase,
    !scope.useLegacySchema && scope.businessId
      ? (scope.branchId ? paymentBase.eq("business_id", scope.businessId).eq("branch_id", scope.branchId) : paymentBase.eq("business_id", scope.businessId))
      : paymentBase,
  ]);

  const todayRevenue = ((paymentRows ?? []) as Array<{ amount: number; payment_type: "sale" | "refund" }>).reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (row.payment_type === "refund" ? -amount : amount);
  }, 0);

  return {
    openOrders:
      (openRows ?? []).filter((row) => {
        const current = (row as { status?: OrderStatus }).status;
        return current === "pending" || current === "preparing" || current === "served";
      }).length ?? 0,
    pendingCount: pendingRows?.length ?? 0,
    todayRevenue,
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

function isPendingKitchenSignal(order: { status?: OrderStatus; created_at: string }): order is { status: "pending" | "preparing"; created_at: string } {
  return order.status === "pending" || order.status === "preparing";
}

export async function getOpsMetricsSnapshot() {
  const supabase = getSupabaseServerClient();
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

  const [dashboard, scope] = await Promise.all([getDashboardData(), getDefaultBusinessScope()]);
  const cached = await getCachedDashboardDataRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });

  const orders = cached?.openRows ?? [];
  const openServiceRequests = cached?.openServiceRequests ?? 0;

  const pendingKitchenOrders = orders.filter(isPendingKitchenSignal);
  const delayedKitchenOrders = pendingKitchenOrders.filter((order) => isKitchenOrderDelayed(order)).length;
  const criticalKitchenOrders = pendingKitchenOrders.filter((order) => isKitchenOrderCritical(order)).length;

  return {
    openOrders: dashboard.metrics.openOrders,
    pendingOrders: dashboard.metrics.pending,
    preparingOrders: dashboard.metrics.preparing,
    servedOrders: dashboard.metrics.served,
    occupiedTables: dashboard.metrics.occupiedTables,
    emptyTables: dashboard.metrics.emptyTables,
    todayRevenue: Number(dashboard.metrics.todayRevenue.toFixed(2)),
    openServiceRequests,
    delayedKitchenOrders,
    criticalKitchenOrders,
  };
}

export async function getOpsPageSnapshot(options?: { includeSetup?: boolean }) {
  const includeSetup = options?.includeSetup ?? true;
  const supabase = getSupabaseServerClient();
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

  const cached = await getCachedDashboardDataRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });

  const orders = cached?.openRows ?? [];
  const paymentRows = cached?.paymentRows ?? [];
  const tablesRows = cached?.tablesRows ?? [];
  const recentOrderRows = cached?.recentOrderRows ?? [];
  const lowStockRows = cached?.lowStockRows ?? [];
  const openServiceRequests = cached?.openServiceRequests ?? 0;
  const pendingKitchenOrders = orders.filter(isPendingKitchenSignal);
  const tableRows = (tablesRows ?? []) as Array<{ id: string; status?: TableStatus }>;
  const occupiedTables = tableRows.filter((row) => row.status === "occupied").length;
  const emptyTables = tableRows.filter((row) => row.status === "empty").length;
  const todayRevenue = ((paymentRows ?? []) as Array<{ amount: number; payment_type: "sale" | "refund" }>).reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (row.payment_type === "refund" ? -amount : amount);
  }, 0);
  const openOrderRows = (orders ?? []) as Array<{ status?: OrderStatus }>;
  const pendingCount = openOrderRows.filter((row) => row.status === "pending").length;
  const preparingCount = openOrderRows.filter((row) => row.status === "preparing").length;
  const servedCount = openOrderRows.filter((row) => row.status === "served").length;
  const dashboard = {
    usingDemoData: false,
    metrics: {
      openOrders: pendingCount + preparingCount + servedCount,
      pending: pendingCount,
      preparing: preparingCount,
      served: servedCount,
      occupiedTables,
      emptyTables,
      todayRevenue,
    },
    recentOrders: ((recentOrderRows ?? []) as OrderRow[]).map((row) => ({
      id: row.id,
      table_id: row.table_id,
      table_number: getTableNumber(row.tables),
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
    })),
    lowStockProducts: (lowStockRows ?? []) as Product[],
  };
  const delayedKitchenOrders = pendingKitchenOrders.filter((order) => isKitchenOrderDelayed(order)).length;
  const criticalKitchenOrders = pendingKitchenOrders.filter((order) => isKitchenOrderCritical(order)).length;

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
      openServiceRequests,
      delayedKitchenOrders,
      criticalKitchenOrders,
    },
    setup,
  };
}

export async function getDashboardData() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const pending = demoOrders.filter((order) => order.status === "pending").length;
    const preparing = demoOrders.filter((order) => order.status === "preparing").length;
    const served = demoOrders.filter((order) => order.status === "served").length;
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
  const cached = await getCachedDashboardDataRow({
    businessId: scope.businessId,
    branchId: scope.branchId,
    useLegacySchema: scope.useLegacySchema,
  });
  const openRows = cached?.openRows ?? [];
  const paymentRows = cached?.paymentRows ?? [];
  const tablesRows = cached?.tablesRows ?? [];
  const recentOrderRows = cached?.recentOrderRows ?? [];
  const lowStockRows = cached?.lowStockRows ?? [];

  const tableRows = (tablesRows ?? []) as Array<{ id: string; status: TableStatus }>;
  const occupiedTables = tableRows.filter((row) => row.status === "occupied").length;
  const emptyTables = tableRows.filter((row) => row.status === "empty").length;
  const todayRevenue = ((paymentRows ?? []) as Array<{ amount: number; payment_type: "sale" | "refund" }>).reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (row.payment_type === "refund" ? -amount : amount);
  }, 0);
  const openOrderRows = (openRows ?? []) as Array<{ status?: OrderStatus }>;
  const pendingCount = openOrderRows.filter((row) => row.status === "pending").length;
  const preparingCount = openOrderRows.filter((row) => row.status === "preparing").length;
  const servedCount = openOrderRows.filter((row) => row.status === "served").length;

  const recentOrders = ((recentOrderRows ?? []) as OrderRow[]).map((row) => ({
    id: row.id,
    table_id: row.table_id,
    table_number: getTableNumber(row.tables),
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
      openOrders: pendingCount + preparingCount + servedCount,
      pending: pendingCount,
      preparing: preparingCount,
      served: servedCount,
      occupiedTables,
      emptyTables,
      todayRevenue,
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
    note: "QR menu ve stok takibiyle ilgileniyor.",
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
    note: "Cuma gunu demo takvimi icin aranacak.",
    created_at: minutesAgo(110),
  },
  {
    id: "demo-lead-note-2",
    lead_id: "demo-lead-2",
    note: "Ilk sube icin QR menu ve vardiya takibi oncelikli.",
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
    title: "Cafe operasyonunda ilk dijital kurulum nasil yapilir?",
    slug: "cafe-operasyonunda-ilk-dijital-kurulum",
    excerpt: "Masa, urun, ekip ve raporlama akislarini tek gunde nasil toparlayabilecegini anlatiyor.",
    body: "Cloud POS ile ilk kurulumda once isletme yapisini, sonra masa planini, ardindan urun ve personel rollerini tanimlayin. Bu akisi takip ettiginizde landing, demo ve operasyon paneli ayni veri modelini kullanir.",
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
    return { ok: false, error: "Demo modda lead kaydi veritabanina yazilamaz." };
  }

  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!companyName || !contactName) {
    return { ok: false, error: "Isletme adi ve yetkili gerekli." };
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
  const supabase = getSupabaseServerClient();
  if (!supabase) {
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
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "home";
}

function buildSitePageKey(slug?: string) {
  const normalizedSlug = normalizeSitePageSlug(slug);
  return normalizedSlug === "home" ? "landing_page" : `site_page:${normalizedSlug}`;
}

async function getCachedDashboardDataRow(input: {
  businessId: string | null;
  branchId: string | null;
  useLegacySchema: boolean;
}) {
  const cacheKey = `dashboard:${input.businessId ?? "none"}:${input.branchId ?? "all"}:${input.useLegacySchema ? "legacy" : "scoped"}`;
  const reader = unstable_cache(
    async () => {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return null;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        { data: openRows },
        { data: paymentRows },
        { data: tablesRows },
        { data: recentOrderRows },
        { data: lowStockRows },
        { count: openServiceRequests },
      ] = await Promise.all([
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? supabase
                  .from("orders")
                  .select("status, created_at")
                  .eq("business_id", input.businessId)
                  .eq("branch_id", input.branchId)
                  .in("status", ["pending", "preparing", "served"])
              : supabase.from("orders").select("status, created_at").eq("business_id", input.businessId).in("status", ["pending", "preparing", "served"]))
          : supabase.from("orders").select("status, created_at").in("status", ["pending", "preparing", "served"]),
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? supabase.from("payments").select("amount, payment_type").eq("business_id", input.businessId).eq("branch_id", input.branchId).gte("created_at", todayStart.toISOString())
              : supabase.from("payments").select("amount, payment_type").eq("business_id", input.businessId).gte("created_at", todayStart.toISOString()))
          : supabase.from("payments").select("amount, payment_type").gte("created_at", todayStart.toISOString()),
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? supabase.from("tables").select("id, status").eq("business_id", input.businessId).eq("branch_id", input.branchId)
              : supabase.from("tables").select("id, status").eq("business_id", input.businessId))
          : supabase.from("tables").select("id, status"),
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? supabase
                  .from("orders")
                  .select("id, table_id, total_price, final_price, channel, customer_name, customer_phone, delivery_address, courier_id, courier_name, fulfillment_status, status, created_at, tables(table_number)")
                  .eq("business_id", input.businessId)
                  .eq("branch_id", input.branchId)
                  .order("created_at", { ascending: false })
                  .limit(8)
              : supabase
                  .from("orders")
                  .select("id, table_id, total_price, final_price, channel, customer_name, customer_phone, delivery_address, courier_id, courier_name, fulfillment_status, status, created_at, tables(table_number)")
                  .eq("business_id", input.businessId)
                  .order("created_at", { ascending: false })
                  .limit(8))
          : supabase
              .from("orders")
              .select("id, table_id, total_price, final_price, channel, customer_name, customer_phone, delivery_address, courier_id, courier_name, fulfillment_status, status, created_at, tables(table_number)")
              .order("created_at", { ascending: false })
              .limit(8),
        !input.useLegacySchema && input.businessId
          ? supabase
              .from("products")
              .select("id, name, stock_count")
              .eq("business_id", input.businessId)
              .lte("stock_count", 10)
              .order("stock_count", { ascending: true })
              .limit(8)
          : supabase.from("products").select("id, name, stock_count").lte("stock_count", 10).order("stock_count", { ascending: true }).limit(8),
        !input.useLegacySchema && input.businessId
          ? (input.branchId
              ? supabase
                  .from("table_requests")
                  .select("id", { count: "exact", head: true })
                  .eq("business_id", input.businessId)
                  .eq("branch_id", input.branchId)
                  .eq("status", "open")
              : supabase.from("table_requests").select("id", { count: "exact", head: true }).eq("business_id", input.businessId).eq("status", "open"))
          : supabase.from("table_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);

      return {
        openRows: (openRows ?? []) as Array<{ status?: OrderStatus; created_at: string }>,
        paymentRows: (paymentRows ?? []) as Array<{ amount: number; payment_type: "sale" | "refund" }>,
        tablesRows: (tablesRows ?? []) as Array<{ id: string; status?: TableStatus }>,
        recentOrderRows: (recentOrderRows ?? []) as Array<OrderRow>,
        lowStockRows: (lowStockRows ?? []) as Array<Pick<Product, "id" | "name" | "stock_count">>,
        openServiceRequests: openServiceRequests ?? 0,
      };
    },
    [cacheKey],
    { revalidate: 10, tags: ["dashboard-snapshot"] },
  );

  return reader();
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
  const cached = await getCachedSitePageRow(slug);
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
    return { ok: false, error: "Demo mod icin en az bir masa ve urun olmali." };
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
    return { ok: false, error: "Demo fallback modunda kayit temizleme pasif." };
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
    return { ok: false, error: "Demo fallback modunda isletme temizligi pasif." };
  }

  const scope = await getDefaultBusinessScope();
  if (!scope.businessId) {
    return { ok: false, error: "Aktif isletme bulunamadi." };
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

export async function getGeneralSettings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { settings: defaultGeneralSettings, usingDemoData: true };
  }

  const cached = await getCachedGeneralSettingsRow();
  if (!cached || cached.error) {
    return { settings: defaultGeneralSettings, usingDemoData: false };
  }

  return {
    settings: normalizeGeneralSettings((cached.row?.content as Partial<GeneralSettings> | null) ?? null),
    usingDemoData: false,
  };
}

export async function updateGeneralSettings(settings: GeneralSettings) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Demo modda genel ayarlar guncellenemez." };
  }

  const normalized = normalizeGeneralSettings(settings);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "general_settings",
      content: normalized,
    },
    { onConflict: "key" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTag("app-settings-general", "max");

  await logAuditEvent({
    entityType: "app_settings",
    entityId: "general_settings",
    action: "update",
    details: { key: "general_settings" },
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
    return { ok: false, error: "Demo modda blog kaydi guncellenemez." };
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
    return { ok: false, error: "Demo modda blog kaydi silinemez." };
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

  const envAllowed = (process.env.STUDIO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (envAllowed.includes(normalizedEmail)) {
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

export async function listStudioAccessUsers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { users: [] as StudioAccessUser[], usingDemoData: true };
  }

  const { data, error } = await supabase
    .from("studio_access_users")
    .select("id, email, full_name, role, is_active, created_at")
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
