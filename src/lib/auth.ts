import { redirect } from "next/navigation";
import { cache } from "react";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/business";
import { getActiveBusinessSlug } from "@/lib/business-server";
import type { AppRole, StaffAccessScope, StudioRole } from "@/lib/types";
import { getStudioAccessByEmail } from "@/lib/data";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export function hasRoleAccess(role: AppRole | null, allowedRoles: AppRole[]) {
  return !!role && (allowedRoles.includes(role) || (role === "owner" && allowedRoles.includes("admin")));
}

export function hasExactRoleAccess(role: AppRole | null, allowedRoles: AppRole[]) {
  return !!role && allowedRoles.includes(role);
}

export const getCurrentUserWithRole = cache(async () => {
  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { user: null, role: null as AppRole | null, usingDemoData: true };
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return { user: null, role: null as AppRole | null, usingDemoData: false };
  }

  const tenantClient = authClient;
  if (!tenantClient) {
    return { user, role: null as AppRole | null, usingDemoData: false };
  }

  const { data: profile } = await tenantClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const activeSlug = (await getActiveBusinessSlug()) || DEFAULT_BUSINESS_SLUG;
  const { data: accessibleBusinesses } = await tenantClient
    .from("businesses")
    .select("id, slug")
    .eq("is_active", true);

  const business =
    (accessibleBusinesses ?? []).find((item) => item.slug === activeSlug) ??
    (accessibleBusinesses ?? [])[0] ??
    null;

  if (!business) {
    return {
      user,
      role: (profile?.role as AppRole | undefined) ?? null,
      accessScope: ((profile?.role as AppRole | undefined) ?? null) === "owner" ? "business" : "branch",
      primaryBranchId: null,
      branchAccessIds: [],
      usingDemoData: false,
    };
  }

  const { data: accessRows } = await tenantClient
    .from("staff_branch_access")
    .select("branch_id, access_scope, is_primary")
    .eq("profile_id", user.id)
    .eq("business_id", business.id);

  let accessScope: StaffAccessScope =
    (profile?.role as AppRole | undefined) === "owner" ? "business" : "branch";
  let primaryBranchId: string | null = null;
  let branchAccessIds: string[] = [];

  const rows = (accessRows ?? []) as Array<{
    branch_id: string | null;
    access_scope: StaffAccessScope;
    is_primary: boolean;
  }>;

  if (rows.length > 0) {
    accessScope = rows.some((row) => row.access_scope === "business") ? "business" : "branch";
    branchAccessIds = rows.map((row) => row.branch_id).filter((branchId): branchId is string => Boolean(branchId));
    primaryBranchId = rows.find((row) => row.is_primary && row.branch_id)?.branch_id ?? branchAccessIds[0] ?? null;
  }

  return {
    user,
    role: (profile?.role as AppRole | undefined) ?? null,
    accessScope,
    primaryBranchId,
    branchAccessIds,
    usingDemoData: false,
  };
});

export async function requireRole(allowedRoles: AppRole[], nextPath: string) {
  const context = await getCurrentUserWithRole();
  if (context.usingDemoData) {
    return { bypass: true as const };
  }

  if (!context.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const roleAllowed =
    hasRoleAccess(context.role, allowedRoles);

  if (!roleAllowed) {
    redirect("/unauthorized");
  }

  return { bypass: false as const, role: context.role };
}

export async function requireExactRole(allowedRoles: AppRole[], nextPath: string) {
  const context = await getCurrentUserWithRole();
  if (context.usingDemoData) {
    return { bypass: true as const };
  }

  if (!context.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!hasExactRoleAccess(context.role, allowedRoles)) {
    redirect("/unauthorized");
  }

  return { bypass: false as const, role: context.role };
}

export async function requireStudioAccess(nextPath: string, allowedRoles?: StudioRole[]) {
  const context = await getCurrentUserWithRole();
  if (context.usingDemoData) {
    return { bypass: true as const };
  }

  if (!context.user) {
    redirect(`/studio/login?next=${encodeURIComponent(nextPath)}`);
  }

  const email = context.user.email?.toLowerCase() ?? "";
  const studioAccess = await getStudioAccessByEmail(email);
  if (!email || !studioAccess.hasAccess) {
    redirect("/unauthorized");
  }

  if (allowedRoles && (!studioAccess.role || !allowedRoles.includes(studioAccess.role))) {
    redirect("/unauthorized");
  }

  return { bypass: false as const, role: context.role, email, studioRole: studioAccess.role };
}
