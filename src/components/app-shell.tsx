"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import type { AppShellPayload } from "@/lib/app-shell";

const shellPrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

const APP_SHELL_CACHE_KEY = "app-shell-cache";
const APP_SHELL_CACHE_TTL_MS = 300_000;

type AppShellCacheEntry = {
  data: AppShellPayload;
  updatedAt: number;
};

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
      setShellData(data);
      try {
        const cacheEntry: AppShellCacheEntry = { data, updatedAt: Date.now() };
        window.sessionStorage.setItem(APP_SHELL_CACHE_KEY, JSON.stringify(cacheEntry));
      } catch {}
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!initialData) {
      return;
    }

    try {
      const cacheEntry: AppShellCacheEntry = { data: initialData, updatedAt: Date.now() };
      window.sessionStorage.setItem(APP_SHELL_CACHE_KEY, JSON.stringify(cacheEntry));
    } catch {}
  }, [initialData]);

  useEffect(() => {
    if (!showShell) {
      setShellData(null);
      return;
    }

    let usedCachedEntry = false;
    try {
      const cached = window.sessionStorage.getItem(APP_SHELL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AppShellPayload | AppShellCacheEntry;
        if ("data" in parsed && "updatedAt" in parsed) {
          if (Date.now() - parsed.updatedAt < APP_SHELL_CACHE_TTL_MS) {
            setShellData(parsed.data);
            usedCachedEntry = true;
          }
        } else {
          setShellData(parsed);
          usedCachedEntry = true;
        }
      }
    } catch {}

    if (usedCachedEntry) {
      // Revalidate in the background to avoid showing stale auth state after a fresh login/logout.
      void loadShellData();
      return;
    }

    setShellData(initialData ?? null);
    if (!initialData) {
      void loadShellData();
    }
  }, [initialData, pathname, showShell]);

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
