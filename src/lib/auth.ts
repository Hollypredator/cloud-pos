import { redirect } from "next/navigation";
import { cache } from "react";
import type { AppRole, PlatformPermission, StaffAccessScope, StudioRole, SupportRole } from "@/lib/types";
import { getPlatformAccessByEmail, getStudioAccessByEmail, getSupportAccessByEmail, hasPlatformPermission } from "@/lib/data";
import { getRequestAppContext } from "@/lib/server/app-context";

const DIRECT_PLATFORM_OWNER_EMAILS = new Set(["msamedcbn@gmail.com"]);

export function hasRoleAccess(role: AppRole | null, allowedRoles: AppRole[]) {
  return !!role && (allowedRoles.includes(role) || (role === "owner" && allowedRoles.includes("admin")));
}

export function hasExactRoleAccess(role: AppRole | null, allowedRoles: AppRole[]) {
  return !!role && allowedRoles.includes(role);
}

export const getCurrentUserIdentity = cache(async () => {
  const context = await getRequestAppContext();
  return {
    user: context.user,
    role: context.role,
    usingDemoData: context.usingDemoData,
  };
});

export const getCurrentUserWithRole = cache(async () => {
  const context = await getRequestAppContext();
  if (context.usingDemoData) {
    return {
      user: null,
      role: null as AppRole | null,
      accessScope: "business" as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
      usingDemoData: true,
    };
  }

  if (!context.user) {
    return {
      user: null,
      role: context.role,
      accessScope: "business" as StaffAccessScope,
      primaryBranchId: null as string | null,
      branchAccessIds: [] as string[],
      usingDemoData: false,
    };
  }

  return {
    user: context.user,
    role: context.role,
    accessScope: context.accessScope,
    primaryBranchId: context.primaryBranchId,
    branchAccessIds: context.branchAccessIds,
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
  if (DIRECT_PLATFORM_OWNER_EMAILS.has(email)) {
    return { bypass: false as const, role: context.role, email, studioRole: "owner" as StudioRole, platformRole: "platform_owner" as const };
  }

  const platformAccess = await getPlatformAccessByEmail(email);
  if (platformAccess.hasAccess) {
    const requiredPermission: PlatformPermission =
      allowedRoles && allowedRoles.includes("owner") ? "studio.publish" : "studio.write";
    if (hasPlatformPermission(platformAccess, requiredPermission)) {
      return { bypass: false as const, role: context.role, email, studioRole: "owner" as StudioRole, platformRole: platformAccess.role };
    }
  }

  const studioAccess = await getStudioAccessByEmail(email);
  if (!email || !studioAccess.hasAccess) {
    redirect("/unauthorized");
  }

  if (allowedRoles && (!studioAccess.role || !allowedRoles.includes(studioAccess.role))) {
    redirect("/unauthorized");
  }

  return { bypass: false as const, role: context.role, email, studioRole: studioAccess.role };
}

export async function requireSupportAccess(nextPath: string, allowedRoles?: SupportRole[]) {
  const context = await getCurrentUserWithRole();
  if (context.usingDemoData) {
    return { bypass: true as const };
  }

  if (!context.user) {
    redirect(`/support/login?next=${encodeURIComponent(nextPath)}`);
  }

  const email = context.user.email?.toLowerCase() ?? "";
  if (DIRECT_PLATFORM_OWNER_EMAILS.has(email)) {
    return { bypass: false as const, role: context.role, email, supportRole: "support_admin" as SupportRole, platformRole: "platform_owner" as const };
  }

  const platformAccess = await getPlatformAccessByEmail(email);
  if (platformAccess.hasAccess) {
    const requiredPermission: PlatformPermission =
      allowedRoles?.includes("support_admin")
        ? "support.access.manage"
        : allowedRoles?.includes("billing_agent")
          ? "support.billing"
          : allowedRoles?.includes("support_agent")
            ? "support.write"
            : "support.read";
    if (hasPlatformPermission(platformAccess, requiredPermission)) {
      return { bypass: false as const, role: context.role, email, supportRole: "support_admin" as SupportRole, platformRole: platformAccess.role };
    }
  }

  const supportAccess = await getSupportAccessByEmail(email);
  if (!email || !supportAccess.hasAccess) {
    redirect("/unauthorized");
  }

  if (allowedRoles && (!supportAccess.role || !allowedRoles.includes(supportAccess.role))) {
    redirect("/unauthorized");
  }

  return { bypass: false as const, role: context.role, email, supportRole: supportAccess.role };
}
