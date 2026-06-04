"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PosCommandQueueRuntime } from "@/components/pos-command-queue-runtime";
import { QueryProvider } from "@/components/query-provider";
import type { AppShellPayload } from "@/lib/app-shell";

const APP_RUNTIME_PREFIXES = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

export function AppRuntimeWrapper({
  children,
  initialShellData,
}: {
  children: React.ReactNode;
  initialShellData: AppShellPayload | null;
}) {
  const pathname = usePathname();
  const useAppRuntime = APP_RUNTIME_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!useAppRuntime) {
    return <>{children}</>;
  }

  return (
    <QueryProvider>
      <PosCommandQueueRuntime />
      <AppShell initialData={initialShellData}>{children}</AppShell>
    </QueryProvider>
  );
}
