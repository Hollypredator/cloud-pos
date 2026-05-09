import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ALL_BRANCHES_VALUE, DEFAULT_BUSINESS_SLUG, normalizeBusinessSlug } from "@/lib/business";
import { getActiveBranchId } from "@/lib/branch-server";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { getActiveStationProfile } from "@/lib/station-server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Branch, BranchProfile, Business, BusinessType, StaffAccessScope, StaffBranchAccess, StationProfile } from "@/lib/types";
import { updateUserActivity } from "@/lib/data";
import { resolveOperatingProfile, getOperatingProfileCapabilities } from "@/lib/operating-profile";

const DEFAULT_BUSINESS_TYPE: BusinessType = "restaurant_cafe";

function normalizeBusinessType(value: unknown): BusinessType {
  return value === "self_service_coffee" ? "self_service_coffee" : DEFAULT_BUSINESS_TYPE;
}

const demoBusiness: Business = {
  id: "demo-business-1",
  name: "Demo Business",
  slug: DEFAULT_BUSINESS_SLUG,
  plan: "growth",
  business_type: DEFAULT_BUSINESS_TYPE,
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const demoBranches: Branch[] = [
  {
    id: "demo-branch-1",
    business_id: "demo-business-1",
    name: "Merkez Şube",
    slug: "merkez",
    branch_profile: "restaurant",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "demo-branch-2",
    business_id: "demo-business-1",
    name: "Bahce Şube",
    slug: "bahce",
    branch_profile: "restaurant",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

type ActiveBusinessSummary = Pick<Business, "id" | "name" | "slug" | "plan" | "business_type">;
type AppShellBranchSummary = { id: string; name: string; branch_profile: BranchProfile };

function inferBranchProfileFromIdentity(input: { name?: string | null; slug?: string | null }): BranchProfile {
  void input;
  return "restaurant";
}

const resolveBusinessBySlug = cache(async (businessSlug?: string) => {
  const slug = normalizeBusinessSlug(businessSlug);
  const cacheKey = `business-by-slug:${slug}`;

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
          business_type: normalizeBusinessType((data as { business_type?: unknown }).business_type),
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
    business_type: normalizeBusinessType((data as { business_type?: unknown }).business_type),
  } satisfies Business;

  return {
    business: normalizedBusiness,
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

    let { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, plan, business_type")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error?.message?.toLowerCase().includes("business_type")) {
      const fallback = await supabase
        .from("businesses")
        .select("id, name, slug, plan")
        .eq("is_active", true)
        .order("name", { ascending: true });
      data = fallback.data as typeof data;
      error = fallback.error as typeof error;
    }

    if (error) {
      return {
        error: true as const,
        useLegacySchema: error.message.toLowerCase().includes("businesses"),
        businesses: [] as Array<Pick<Business, "id" | "name" | "slug" | "plan" | "business_type">>,
      };
    }

    return {
      error: false as const,
      useLegacySchema: false,
      businesses: ((data ?? []) as Array<Pick<Business, "id" | "name" | "slug" | "plan"> & { business_type?: unknown }>).map(
        (business) => ({
          ...business,
          business_type: normalizeBusinessType(business.business_type),
        }),
      ),
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

  let { data, error } = await authClient
    .from("businesses")
    .select("id, name, slug, plan, business_type")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error?.message?.toLowerCase().includes("business_type")) {
    const fallback = await authClient
      .from("businesses")
      .select("id, name, slug, plan")
      .eq("is_active", true)
      .order("name", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error as typeof error;
  }

  if (error) {
    return {
      error: true as const,
      useLegacySchema: error.message.toLowerCase().includes("businesses"),
      businesses: [] as Array<Pick<Business, "id" | "name" | "slug" | "plan" | "business_type">>,
    };
  }

  return {
    error: false as const,
    useLegacySchema: false,
    businesses: ((data ?? []) as Array<Pick<Business, "id" | "name" | "slug" | "plan"> & { business_type?: unknown }>).map(
      (business) => ({
        ...business,
        business_type: normalizeBusinessType(business.business_type),
      }),
    ),
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
      .select("id, name, branch_profile")
      .eq("is_active", true)
      .eq("business_id", input.businessId)
      .order("name", { ascending: true });

    if (input.accessScope !== "business") {
      if (normalizedBranchAccessIds.length === 0) {
        return { branches: [] as AppShellBranchSummary[] };
      }
      query = query.in("id", normalizedBranchAccessIds);
    }

    let { data, error } = await query;
    if (error?.message?.toLowerCase().includes("branch_profile")) {
      let fallbackQuery = supabase
        .from("branches")
        .select("id, name, slug")
        .eq("is_active", true)
        .eq("business_id", input.businessId)
        .order("name", { ascending: true });
      if (input.accessScope !== "business") {
        if (normalizedBranchAccessIds.length === 0) {
          return { branches: [] as AppShellBranchSummary[] };
        }
        fallbackQuery = fallbackQuery.in("id", normalizedBranchAccessIds);
      }
      const fallbackResult = await fallbackQuery;
      data = (fallbackResult.data ?? []).map((row) => ({
        id: (row as { id: string }).id,
        name: (row as { name: string }).name,
        branch_profile: inferBranchProfileFromIdentity({
          name: (row as { name?: string | null }).name,
          slug: (row as { slug?: string | null }).slug,
        }),
      }));
      error = fallbackResult.error;
    }
    if (error) {
      return {
        branches: error.message.toLowerCase().includes("branches")
          ? ([] as AppShellBranchSummary[])
          : demoBranches.map((branch) => ({
              id: branch.id,
              name: branch.name,
              branch_profile: branch.branch_profile ?? "restaurant",
            })),
      };
    }

    return {
      branches: ((data ?? []) as Array<{ id: string; name: string }>).map((row) => ({
        id: row.id,
        name: row.name,
        branch_profile: "restaurant" as BranchProfile,
      })),
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
  const activeStationProfile = (await getActiveStationProfile()) as StationProfile;
  const authClient = await getSupabaseAuthServerClient();

  if (!authClient) {
    const demoBusinesses: ActiveBusinessSummary[] = [{
      id: demoBusiness.id,
      name: demoBusiness.name,
      slug: demoBusiness.slug,
      plan: demoBusiness.plan,
      business_type: demoBusiness.business_type,
    }];
    const demoBranchRows: AppShellBranchSummary[] = demoBranches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      branch_profile: branch.branch_profile ?? "restaurant",
    }));
    const demoBranchProfiles = [...new Set(demoBranchRows.map((branch) => branch.branch_profile ?? "restaurant"))] as BranchProfile[];
    const demoHasMixedBranchProfiles = demoBranchProfiles.length > 1;
    const demoWantsAllBranches = activeBranchCookie === ALL_BRANCHES_VALUE;
    const demoForcedBranchSelectionFromAll = demoWantsAllBranches && demoHasMixedBranchProfiles;
    const demoSelectedBranchId =
      demoWantsAllBranches && !demoForcedBranchSelectionFromAll
        ? ALL_BRANCHES_VALUE
        : demoBranchRows[0]?.id || "";
    const demoActiveBranchProfile =
      demoBranchRows.find((branch) => branch.id === demoSelectedBranchId)?.branch_profile ?? "restaurant";
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
      hasMixedBranchProfiles: demoHasMixedBranchProfiles,
      forcedBranchSelectionFromAll: demoForcedBranchSelectionFromAll,
      branches: demoBranchRows,
      activeBranchId: demoSelectedBranchId,
      activeBranchProfile: demoActiveBranchProfile,
      activeStationProfile,
      branchId: demoSelectedBranchId === ALL_BRANCHES_VALUE ? null : demoSelectedBranchId || null,
      activeBranchSelection:
        demoSelectedBranchId === ALL_BRANCHES_VALUE ? ALL_BRANCHES_VALUE : demoSelectedBranchId || null,
    };
  }

  const [
    {
      data: { user },
    },
    businessesResult,
  ] = await Promise.all([authClient.auth.getUser(), getActiveBusinessesRowForRequest()]);

  if (user) {
    // Only update activity if we have a real user.
    // In a production app, we would throttle this update.
    updateUserActivity(user.id, "platform_access_users").catch(() => {});
    updateUserActivity(user.id, "profiles").catch(() => {});
  }

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
              business_type: fallbackContext.business.business_type,
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
      hasMixedBranchProfiles: false,
      forcedBranchSelectionFromAll: false,
      branches: [] as AppShellBranchSummary[],
      activeBranchId: "",
      activeBranchProfile: "restaurant" as BranchProfile,
      activeStationProfile,
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
      hasMixedBranchProfiles: false,
      forcedBranchSelectionFromAll: false,
      branches: [] as AppShellBranchSummary[],
      activeBranchId: "",
      activeBranchProfile: "restaurant" as BranchProfile,
      activeStationProfile,
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

  const hasMixedBranchProfiles = false;
  const wantsAllBranches = activeBranchCookie === ALL_BRANCHES_VALUE && accessScope === "business";
  const forcedBranchSelectionFromAll = false;
  const canUseAllBranches = wantsAllBranches;
  const activeBranchId =
    canUseAllBranches
      ? ALL_BRANCHES_VALUE
      : branches.some((branch) => branch.id === activeBranchCookie)
        ? (activeBranchCookie as string)
        : branches.find((branch) => branch.id === primaryBranchId)?.id ?? branches[0]?.id ?? "";
  const branchId =
    accessScope === "branch"
      ? primaryBranchId ?? activeBranchCookie ?? null
      : canUseAllBranches
        ? null
        : activeBranchId || null;
  const activeBranchProfile = "restaurant" as BranchProfile;

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
    hasMixedBranchProfiles,
    forcedBranchSelectionFromAll,
    branches,
    activeBranchId,
    activeBranchProfile,
    activeStationProfile,
    branchId,
    activeBranchSelection: canUseAllBranches ? ALL_BRANCHES_VALUE : branchId,
  };
});

export const getDefaultBusinessScope = cache(async () => {
  const context = await getRequestAppContext();
  return {
    activeSlug: context.activeSlug,
    businessId: context.businessId,
    activeBusinessType: context.activeBusiness?.business_type ?? DEFAULT_BUSINESS_TYPE,
    branchId: context.branchId,
    activeBranchProfile: context.activeBranchProfile,
    activeBranchSelection: context.activeBranchSelection,
    useLegacySchema: context.useLegacySchema,
    accessScope: context.accessScope,
    branchAccessIds: context.branchAccessIds,
    canAccessAllBranches: context.canAccessAllBranches,
  };
});

export const getAppShellSnapshot = cache(async () => {
  const context = await getRequestAppContext();
  const operatingProfile = resolveOperatingProfile(context.activeBusiness?.business_type);
  const operatingCapabilities = getOperatingProfileCapabilities(operatingProfile);

  return {
    sessionUserId: context.user?.id ?? null,
    sessionBusinessId: context.businessId ?? null,
    sessionBranchId: context.branchId ?? null,
    role: context.role,
    hasUser: context.hasUser,
    usingDemoData: context.usingDemoData,
    accessScope: context.accessScope,
    primaryBranchId: context.primaryBranchId,
    businesses: context.businesses.map((item) => ({
      slug: item.slug,
      name: item.name,
      plan: item.plan,
      business_type: item.business_type ?? "restaurant_cafe",
    })),
    activeBusinessSlug: context.activeSlug,
    activeBusinessType: context.activeBusiness?.business_type ?? "restaurant_cafe",
    operatingProfile,
    operatingCapabilities,
    branches: context.branches,
    activeBranchId: context.activeBranchId,
    activeBranchProfile: context.activeBranchProfile,
    activeStationProfile: context.activeStationProfile,
    hasMixedBranchProfiles: context.hasMixedBranchProfiles,
    forcedBranchSelectionFromAll: context.forcedBranchSelectionFromAll,
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
