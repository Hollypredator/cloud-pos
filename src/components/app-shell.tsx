"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import type { AppShellPayload } from "@/lib/app-shell";

const shellPrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

export function AppShell({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: AppShellPayload | null;
}) {
  const pathname = usePathname();
  const [shellData, setShellData] = useState<AppShellPayload | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const hasRequestedInitialRef = useRef(false);

  const showShell = useMemo(
    () => (pathname ? shellPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) : false),
    [pathname],
  );

  const loadShellData = useEffectEvent(async (force = false) => {
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
      setShellData((prev) => {
        if (!prev) {
          return data;
        }
        if (
          prev.sessionUserId === data.sessionUserId &&
          prev.sessionBusinessId === data.sessionBusinessId &&
          prev.sessionBranchId === data.sessionBranchId &&
          prev.role === data.role &&
          prev.hasUser === data.hasUser &&
          prev.activeBusinessSlug === data.activeBusinessSlug &&
          prev.activeBranchId === data.activeBranchId &&
          prev.sidebarTheme === data.sidebarTheme &&
          prev.sidebarAccentColor === data.sidebarAccentColor &&
          prev.brandName === data.brandName &&
          prev.logoUrl === data.logoUrl &&
          prev.currentPlan === data.currentPlan
        ) {
          return prev;
        }
        return data;
      });
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!showShell) {
      return;
    }
    if (initialData) {
      setShellData(initialData);
      hasRequestedInitialRef.current = true;
      return;
    }
    if (hasRequestedInitialRef.current) {
      return;
    }
    hasRequestedInitialRef.current = true;
    void loadShellData(true);
  }, [initialData, loadShellData, showShell]);

  useEffect(() => {
    if (!showShell || shellData) {
      return;
    }

    void loadShellData();
  }, [pathname, shellData, showShell]);

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
