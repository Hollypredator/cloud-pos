"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import type { AppRole, BusinessPlan, StaffAccessScope } from "@/lib/types";
import type { ApplicationSettings } from "@/lib/app-settings";

const shellPrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

export function AppShell({
  children,
  role,
  hasUser,
  usingDemoData,
  activeBusinessSlug,
  businesses,
  activeBranchId,
  branches,
  currentPlan,
  branchAccessScope,
  canSwitchBranches,
  brandName,
  logoUrl,
  sidebarTheme,
  sidebarAccentColor,
  ownerSidebarOrder,
  adminSidebarOrder,
}: {
  children: React.ReactNode;
  role: AppRole | null;
  hasUser: boolean;
  usingDemoData: boolean;
  activeBusinessSlug: string;
  businesses: Array<{ slug: string; name: string }>;
  activeBranchId: string;
  branches: Array<{ id: string; name: string }>;
  currentPlan: BusinessPlan;
  branchAccessScope: StaffAccessScope;
  canSwitchBranches: boolean;
  brandName: string;
  logoUrl?: string;
  sidebarTheme: ApplicationSettings["sidebarTheme"];
  sidebarAccentColor: ApplicationSettings["sidebarAccentColor"];
  ownerSidebarOrder: ApplicationSettings["ownerSidebarOrder"];
  adminSidebarOrder: ApplicationSettings["adminSidebarOrder"];
}) {
  const pathname = usePathname();
  const showShell = pathname ? shellPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) : false;

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f6f9_0%,#eceff4_100%)] md:flex">
      <AppNav
        role={role}
        hasUser={hasUser}
        usingDemoData={usingDemoData}
        activeBusinessSlug={activeBusinessSlug}
        businesses={businesses}
        activeBranchId={activeBranchId}
        branches={branches}
        currentPlan={currentPlan}
        branchAccessScope={branchAccessScope}
        canSwitchBranches={canSwitchBranches}
        brandName={brandName}
        logoUrl={logoUrl}
        sidebarTheme={sidebarTheme}
        sidebarAccentColor={sidebarAccentColor}
        ownerSidebarOrder={ownerSidebarOrder}
        adminSidebarOrder={adminSidebarOrder}
      />
      <div className="min-w-0 flex-1 pb-28 md:pb-0">{children}</div>
    </div>
  );
}
