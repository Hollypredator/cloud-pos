import { redirect } from "next/navigation";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/business";
import { getActiveBusinessSlug } from "@/lib/business-server";
import type { AppRole, StaffAccessScope, StudioRole } from "@/lib/types";
import { getStudioAccessByEmail } from "@/lib/data";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export function hasRoleAccess(role: AppRole | null, allowedRoles: AppRole[]) {
  return !!role && (allowedRoles.includes(role) || (role === "owner" && allowedRoles.includes("admin")));
}

export async function getCurrentUserWithRole() {
  const supabase = await getSupabaseAuthServerClient();
  if (!supabase) {
    return { user: null, role: null as AppRole | null, usingDemoData: true };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, role: null as AppRole | null, usingDemoData: false };
  }

  const serverClient = getSupabaseServerClient();
  if (!serverClient) {
    return { user, role: null as AppRole | null, usingDemoData: false };
  }

  const { data: profile } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const activeSlug = (await getActiveBusinessSlug()) || DEFAULT_BUSINESS_SLUG;
  const { data: business } = await serverClient
    .from("businesses")
    .select("id")
    .eq("slug", activeSlug)
    .maybeSingle();

  let accessScope: StaffAccessScope =
    (profile?.role as AppRole | undefined) === "owner" ? "business" : "branch";
  let primaryBranchId: string | null = null;
  let branchAccessIds: string[] = [];

  if (business?.id) {
    const { data: accessRows } = await serverClient
      .from("staff_branch_access")
      .select("branch_id, access_scope, is_primary")
      .eq("profile_id", user.id)
      .eq("business_id", business.id);

    const rows = (accessRows ?? []) as Array<{
      branch_id: string | null;
      access_scope: StaffAccessScope;
      is_primary: boolean;
    }>;

    if (rows.length > 0) {
      accessScope = rows.some((row) => row.access_scope === "business") ? "business" : "branch";
      branchAccessIds = rows
        .map((row) => row.branch_id)
        .filter((branchId): branchId is string => Boolean(branchId));
      primaryBranchId =
        rows.find((row) => row.is_primary && row.branch_id)?.branch_id ??
        branchAccessIds[0] ??
        null;
    }
  }

  return {
    user,
    role: (profile?.role as AppRole | undefined) ?? null,
    accessScope,
    primaryBranchId,
    branchAccessIds,
    usingDemoData: false,
  };
}

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
