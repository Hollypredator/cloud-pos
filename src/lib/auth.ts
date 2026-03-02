import { redirect } from "next/navigation";
import { cache } from "react";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/business";
import { getActiveBusinessSlug } from "@/lib/business-server";
import type { AppRole, StaffAccessScope, StudioRole } from "@/lib/types";
import { getDefaultBusinessScope, getStudioAccessByEmail } from "@/lib/data";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

async function getCurrentRoleFromClient(authClient: NonNullable<Awaited<ReturnType<typeof getSupabaseAuthServerClient>>>) {
  const { data, error } = await authClient.rpc("current_app_role");
  if (error) {
    return null as AppRole | null;
  }

  return (data as AppRole | null) ?? null;
}

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
  const [role, scope] = await Promise.all([getCurrentRoleFromClient(tenantClient), getDefaultBusinessScope()]);
  const accessScope: StaffAccessScope =
    (scope.accessScope as StaffAccessScope | undefined) ?? (role === "owner" ? "business" : "branch");
  const primaryBranchId = scope.branchId ?? null;
  const branchAccessIds = scope.branchAccessIds ?? [];

  return {
    user,
    role,
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
