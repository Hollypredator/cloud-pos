"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosCommandQueueRuntime } from "@/components/pos-command-queue-runtime";
import { QueryProvider } from "@/components/query-provider";
import type { AppShellPayload } from "@/lib/app-shell";

const APP_RUNTIME_PREFIXES = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];
const MOBILE_ROUTE_REDIRECTS = new Map([
  ["/ops", "/m/ops"],
  ["/tables", "/m/tables"],
  ["/cashier", "/m/cashier"],
  ["/kitchen", "/m/kitchen"],
  ["/delivery", "/m/delivery"],
  ["/service-requests", "/m/service-requests"],
]);

export function AppRuntimeWrapper({
  children,
  initialShellData,
}: {
  children: React.ReactNode;
  initialShellData: AppShellPayload | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [viewportChecked, setViewportChecked] = useState(false);
  const useAppRuntime = APP_RUNTIME_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const mobileRedirectTarget = pathname ? MOBILE_ROUTE_REDIRECTS.get(pathname) : undefined;

  useEffect(() => {
    if (!mobileRedirectTarget) {
      setViewportChecked(true);
      return;
    }

    const pointerMedia = window.matchMedia("(hover: none) and (pointer: coarse)");
    const viewportMedia = window.matchMedia("(max-width: 1024px)");
    const shouldUseMobileRoute = pointerMedia.matches || viewportMedia.matches;
    if (shouldUseMobileRoute) {
      const query = searchParams?.toString();
      window.location.replace(query ? `${mobileRedirectTarget}?${query}` : mobileRedirectTarget);
      return;
    }

    setViewportChecked(true);
  }, [mobileRedirectTarget, searchParams]);

  if (mobileRedirectTarget && !viewportChecked) {
    return (
      <QueryProvider>
        <div className="min-h-screen bg-slate-100" />
      </QueryProvider>
    );
  }

  if (!useAppRuntime) {
    return <QueryProvider>{children}</QueryProvider>;
  }

  return (
    <QueryProvider>
      <PosCommandQueueRuntime />
      <AppShell initialData={initialShellData}>{children}</AppShell>
    </QueryProvider>
  );
}
