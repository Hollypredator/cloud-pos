"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import type { ApplicationSettings } from "@/lib/app-settings";
import type { AppRole, BusinessPlan, StaffAccessScope } from "@/lib/types";

const shellPrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

type AppShellPayload = {
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
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [shellData, setShellData] = useState<AppShellPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const showShell = useMemo(
    () => (pathname ? shellPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) : false),
    [pathname],
  );

  useEffect(() => {
    if (!showShell || shellData || loading) {
      return;
    }

    void loadShellData();
  }, [loading, shellData, showShell]);

  useEffect(() => {
    if (!showShell) {
      return;
    }

    function handleRefresh() {
      void loadShellData(true);
    }

    window.addEventListener("app-shell:refresh", handleRefresh);
    return () => window.removeEventListener("app-shell:refresh", handleRefresh);
  }, [showShell]);

  async function loadShellData(force = false) {
    if (!force && loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/app-shell", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as AppShellPayload;
      setShellData(data);
    } finally {
      setLoading(false);
    }
  }

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#f4f6f9_0%,#eceff4_100%)] md:flex">
      {shellData ? (
        <AppNav
          role={shellData.role}
          hasUser={shellData.hasUser}
          usingDemoData={shellData.usingDemoData}
          activeBusinessSlug={shellData.activeBusinessSlug}
          businesses={shellData.businesses}
          activeBranchId={shellData.activeBranchId}
          branches={shellData.branches}
          currentPlan={shellData.currentPlan}
          branchAccessScope={shellData.branchAccessScope}
          canSwitchBranches={shellData.canSwitchBranches}
          brandName={shellData.brandName}
          logoUrl={shellData.logoUrl}
          sidebarTheme={shellData.sidebarTheme}
          sidebarAccentColor={shellData.sidebarAccentColor}
          ownerSidebarOrder={shellData.ownerSidebarOrder}
          adminSidebarOrder={shellData.adminSidebarOrder}
        />
      ) : (
        <div className="hidden w-[252px] shrink-0 border-r border-slate-200 bg-white/70 md:block" />
      )}
      <div className="min-w-0 flex-1 overflow-x-clip pb-28 md:pb-0">{children}</div>
    </div>
  );
}
