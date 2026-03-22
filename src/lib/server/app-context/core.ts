import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ALL_BRANCHES_VALUE, DEFAULT_BUSINESS_SLUG, normalizeBusinessSlug } from "@/lib/business";
import { getActiveBranchId } from "@/lib/branch-server";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Branch, Business, StaffAccessScope, StaffBranchAccess } from "@/lib/types";

const demoBusiness: Business = {
  id: "demo-business-1",
  name: "Demo Business",
  slug: DEFAULT_BUSINESS_SLUG,
  plan: "growth",
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const demoBranches: Branch[] = [
  {
    id: "demo-branch-1",
    business_id: "demo-business-1",
    name: "Merkez Sube",
    slug: "merkez",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "demo-branch-2",
    business_id: "demo-business-1",
    name: "Bahce Sube",
    slug: "bahce",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

type ActiveBusinessSummary = Pick<Business, "id" | "name" | "slug" | "plan">;
type AppShellBranchSummary = { id: string; name: string };

const resolveBusinessBySlug = cache(async (businessSlug?: string) => {
  const slug = normalizeBusinessSlug(businessSlug);
  const cacheKey = `business-by-slug:${slug}`;

  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const reader = unstable_cache(
      async () => {
        const { data, error } = await serviceClient
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
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { business: demoBusiness, usingDemoData: true, useLegacySchema: false };
  }

  const { data, error } = await authClient
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
});

const getCachedActiveBusinessesRow = unstable_cache(
  async () => {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, plan")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return {
        error: true as const,
        useLegacySchema: error.message.toLowerCase().includes("businesses"),
        businesses: [] as Array<Pick<Business, "id" | "name" | "slug" | "plan">>,
      };
    }

    return {
      error: false as const,
      useLegacySchema: false,
      businesses: (data ?? []) as Array<Pick<Business, "id" | "name" | "slug" | "plan">>,
    };
  },
  ["active-businesses"],
  { revalidate: 30, tags: ["businesses"] },
);

async function getActiveBusinessesRowForRequest() {
  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    return getCachedActiveBusinessesRow();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return null;
  }

  const { data, error } = await authClient
    .from("businesses")
    .select("id, name, slug, plan")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return {
      error: true as const,
      useLegacySchema: error.message.toLowerCase().includes("businesses"),
      businesses: [] as Array<Pick<Business, "id" | "name" | "slug" | "plan">>,
    };
  }

  return {
    error: false as const,
    useLegacySchema: false,
    businesses: (data ?? []) as Array<Pick<Business, "id" | "name" | "slug" | "plan">>,
  };
}

async function getCachedResolvedUserScope(input: {
  userId: string;
  businessId: string | null;
  roleHint: AppRole | null;
}) {
  if (!input.businessId) {
    return {
      role: input.roleHint,
      accessScope: (input.roleHint === "owner" ? "business" : "branch") as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
    };
  }

  const readWithClient = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>> | NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>,
  ) => {
    const [{ data: roleData }, accessResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", input.userId).maybeSingle(),
      supabase
        .from("staff_branch_access")
        .select("branch_id, access_scope, is_primary")
        .eq("profile_id", input.userId)
        .eq("business_id", input.businessId),
    ]);

    const role = ((roleData as { role?: AppRole | null } | null)?.role ?? input.roleHint ?? null) as AppRole | null;
    const accessRows = (accessResult.data ?? []) as Array<Pick<StaffBranchAccess, "branch_id" | "access_scope" | "is_primary">>;
    const accessScope =
      accessRows.length > 0
        ? accessRows.some((row) => row.access_scope === "business")
          ? ("business" as StaffAccessScope)
          : ("branch" as StaffAccessScope)
        : role === "owner"
          ? ("business" as StaffAccessScope)
          : ("branch" as StaffAccessScope);
    const branchAccessIds = accessRows
      .map((row) => row.branch_id)
      .filter((branchId): branchId is string => Boolean(branchId));
    const primaryBranchId =
      accessRows.find((row) => row.is_primary && row.branch_id)?.branch_id ??
      branchAccessIds[0] ??
      null;

    return {
      role,
      accessScope,
      primaryBranchId,
      branchAccessIds,
    };
  };

  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const cacheKey = `app-context-scope:${input.userId}:${input.businessId}:${input.roleHint ?? "none"}`;
    const reader = unstable_cache(
      async () => readWithClient(serviceClient),
      [cacheKey],
      { revalidate: 30, tags: ["staff-branch-access", "profiles"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return {
      role: input.roleHint,
      accessScope: (input.roleHint === "owner" ? "business" : "branch") as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
    };
  }

  return readWithClient(authClient);
}

async function getCachedUserBusinessIds(userId: string) {
  const readWithClient = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>> | NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>,
  ) => {
    const { data, error } = await supabase
      .from("staff_branch_access")
      .select("business_id")
      .eq("profile_id", userId);

    if (error) {
      return {
        businessIds: [] as string[],
        hasError: true as const,
        errorMessage: error.message,
      };
    }

    const businessIds = [...new Set(((data ?? []) as Array<{ business_id: string | null }>).map((row) => row.business_id).filter(Boolean))] as string[];
    return { businessIds, hasError: false as const };
  };

  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const cacheKey = `user-business-access:${userId}`;
    const reader = unstable_cache(
      async () => readWithClient(serviceClient),
      [cacheKey],
      { revalidate: 45, tags: ["staff-branch-access"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { businessIds: [] as string[], hasError: false as const };
  }

  return readWithClient(authClient);
}

async function getCachedScopedBranches(input: {
  businessId: string | null;
  accessScope: StaffAccessScope;
  branchAccessIds: string[];
}) {
  if (!input.businessId) {
    return { branches: [] as AppShellBranchSummary[] };
  }

  const normalizedBranchAccessIds = [...input.branchAccessIds].sort();
  const readWithClient = async (
    supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>> | NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>,
  ) => {
    let query = supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .eq("business_id", input.businessId)
      .order("name", { ascending: true });

    if (input.accessScope !== "business") {
      if (normalizedBranchAccessIds.length === 0) {
        return { branches: [] as AppShellBranchSummary[] };
      }
      query = query.in("id", normalizedBranchAccessIds);
    }

    const { data, error } = await query;
    if (error) {
      return {
        branches: error.message.toLowerCase().includes("branches")
          ? ([] as AppShellBranchSummary[])
          : demoBranches.map((branch) => ({ id: branch.id, name: branch.name })),
      };
    }

    return {
      branches: (data ?? []) as AppShellBranchSummary[],
    };
  };

  const serviceClient = getSupabaseServerClient();
  if (serviceClient) {
    const cacheKey = `scoped-branches:${input.businessId}:${input.accessScope}:${normalizedBranchAccessIds.join(",") || "none"}`;
    const reader = unstable_cache(
      async () => readWithClient(serviceClient),
      [cacheKey],
      { revalidate: 45, tags: ["branches"] },
    );

    return reader();
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { branches: [] as AppShellBranchSummary[] };
  }

  return readWithClient(authClient);
}

export const getRequestAppContext = cache(async () => {
  const activeSlug = (await getActiveBusinessSlug()) || DEFAULT_BUSINESS_SLUG;
  const activeBranchCookie = await getActiveBranchId();
  const authClient = await getSupabaseAuthServerClient();

  if (!authClient) {
    const demoBusinesses: ActiveBusinessSummary[] = [{ id: demoBusiness.id, name: demoBusiness.name, slug: demoBusiness.slug, plan: demoBusiness.plan }];
    const demoBranchRows: AppShellBranchSummary[] = demoBranches.map((branch) => ({ id: branch.id, name: branch.name }));
    return {
      user: null,
      role: null as AppRole | null,
      hasUser: false,
      usingDemoData: true,
      activeSlug,
      activeBranchCookie,
      businesses: demoBusinesses,
      activeBusiness: demoBusinesses[0] ?? null,
      businessId: demoBusinesses[0]?.id ?? null,
      useLegacySchema: false,
      accessScope: "business" as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
      canAccessAllBranches: true,
      branches: demoBranchRows,
      activeBranchId: activeBranchCookie || demoBranchRows[0]?.id || "",
      branchId: activeBranchCookie || null,
      activeBranchSelection: activeBranchCookie || null,
    };
  }

  const [
    {
      data: { user },
    },
    businessesResult,
  ] = await Promise.all([authClient.auth.getUser(), getActiveBusinessesRowForRequest()]);

  const cachedBusinesses = businessesResult?.businesses ?? [];
  const fallbackContext =
    cachedBusinesses.length === 0 ? await resolveBusinessBySlug(activeSlug || DEFAULT_BUSINESS_SLUG) : null;
  const allBusinesses: ActiveBusinessSummary[] =
    cachedBusinesses.length > 0
      ? cachedBusinesses
      : fallbackContext?.business
        ? [
            {
              id: fallbackContext.business.id,
              name: fallbackContext.business.name,
              slug: fallbackContext.business.slug,
              plan: fallbackContext.business.plan,
            },
          ]
        : [];
  const defaultActiveBusiness = allBusinesses.find((item) => item.slug === activeSlug) ?? allBusinesses[0] ?? null;
  const defaultActiveSlug = defaultActiveBusiness?.slug ?? activeSlug;
  const useLegacySchema = Boolean(businessesResult?.error ? businessesResult.useLegacySchema : fallbackContext?.useLegacySchema);

  if (!user) {
    return {
      user: null,
      role: null as AppRole | null,
      hasUser: false,
      usingDemoData: false,
      activeSlug: defaultActiveSlug,
      activeBranchCookie,
      businesses: allBusinesses,
      activeBusiness: defaultActiveBusiness,
      businessId: defaultActiveBusiness?.id ?? null,
      useLegacySchema,
      accessScope: "business" as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
      canAccessAllBranches: true,
      branches: [] as AppShellBranchSummary[],
      activeBranchId: "",
      branchId: activeBranchCookie || null,
      activeBranchSelection: activeBranchCookie || null,
    };
  }

  const userBusinessAccess = await getCachedUserBusinessIds(user.id);
  const businesses =
    userBusinessAccess.hasError && userBusinessAccess.errorMessage?.toLowerCase().includes("staff_branch_access")
      ? allBusinesses
      : userBusinessAccess.businessIds.length > 0
        ? allBusinesses.filter((business) => userBusinessAccess.businessIds.includes(business.id))
        : [];
  const activeBusiness = businesses.find((item) => item.slug === activeSlug) ?? businesses[0] ?? null;
  const resolvedActiveSlug = activeBusiness?.slug ?? defaultActiveSlug;

  const { role, accessScope, primaryBranchId, branchAccessIds } = await getCachedResolvedUserScope({
    userId: user.id,
    businessId: activeBusiness?.id ?? null,
    roleHint: null,
  });

  if (activeBusiness?.id && accessScope !== "business" && branchAccessIds.length === 0) {
    return {
      user,
      role,
      hasUser: true,
      usingDemoData: false,
      activeSlug: resolvedActiveSlug,
      activeBranchCookie,
      businesses,
      activeBusiness,
      businessId: activeBusiness.id,
      useLegacySchema,
      accessScope,
      primaryBranchId,
      branchAccessIds,
      canAccessAllBranches: false,
      branches: [] as AppShellBranchSummary[],
      activeBranchId: "",
      branchId: primaryBranchId ?? activeBranchCookie ?? null,
      activeBranchSelection: primaryBranchId ?? activeBranchCookie ?? null,
    };
  }

  const cachedBranches = activeBusiness?.id
    ? await getCachedScopedBranches({
        businessId: activeBusiness.id,
        accessScope,
        branchAccessIds,
      })
    : { branches: [] as AppShellBranchSummary[] };
  const branches = cachedBranches.branches;

  const wantsAllBranches = activeBranchCookie === ALL_BRANCHES_VALUE && accessScope === "business";
  const activeBranchId =
    wantsAllBranches
      ? ALL_BRANCHES_VALUE
      : branches.some((branch) => branch.id === activeBranchCookie)
        ? (activeBranchCookie as string)
        : branches.find((branch) => branch.id === primaryBranchId)?.id ?? branches[0]?.id ?? "";
  const branchId =
    accessScope === "branch"
      ? primaryBranchId ?? activeBranchCookie ?? null
      : wantsAllBranches
        ? null
        : activeBranchId || null;

  return {
    user,
    role,
    hasUser: true,
    usingDemoData: false,
    activeSlug: resolvedActiveSlug,
    activeBranchCookie,
    businesses,
    activeBusiness,
    businessId: activeBusiness?.id ?? null,
    useLegacySchema,
    accessScope,
    primaryBranchId,
    branchAccessIds,
    canAccessAllBranches: accessScope === "business",
    branches,
    activeBranchId,
    branchId,
    activeBranchSelection: wantsAllBranches ? ALL_BRANCHES_VALUE : branchId,
  };
});

export const getDefaultBusinessScope = cache(async () => {
  const context = await getRequestAppContext();
  return {
    activeSlug: context.activeSlug,
    businessId: context.businessId,
    branchId: context.branchId,
    activeBranchSelection: context.activeBranchSelection,
    useLegacySchema: context.useLegacySchema,
    accessScope: context.accessScope,
    branchAccessIds: context.branchAccessIds,
    canAccessAllBranches: context.canAccessAllBranches,
  };
});

export const getAppShellSnapshot = cache(async () => {
  const context = await getRequestAppContext();
  return {
    sessionUserId: context.user?.id ?? null,
    sessionBusinessId: context.businessId ?? null,
    sessionBranchId: context.branchId ?? null,
    role: context.role,
    hasUser: context.hasUser,
    usingDemoData: context.usingDemoData,
    accessScope: context.accessScope,
    primaryBranchId: context.primaryBranchId,
    businesses: context.businesses.map((item) => ({ slug: item.slug, name: item.name, plan: item.plan })),
    activeBusinessSlug: context.activeSlug,
    branches: context.branches,
    activeBranchId: context.activeBranchId,
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
