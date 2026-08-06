import { requireRole } from "@/lib/auth";
import { getOpsPageSnapshot } from "@/lib/data";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getAppShellContext, getBusinessScopeContext, type AppShellContext } from "@/lib/server/app-context";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { MobileOpsDashboard } from "@/components/mobile-ops-dashboard";

export default async function MobileOpsPage() {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "cashier", "kitchen"], "/m/ops");
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = resolveOperatingProfile(businessScope?.activeBusinessType) === "coffee_self_service";
  const snapshotResult = await measureAsync("m_ops_snapshot", () => getOpsPageSnapshot({ includeSetup: false }));
  logServerPerf("/m/ops", [snapshotResult]);

  const {
    dashboard: { metrics, recentOrders, lowStockProducts, usingDemoData },
    ops,
  } = snapshotResult.value;

  // Takeaway görünümü işletme ve şube adını gösteriyor. getAppShellSnapshot
  // cache()'li — aynı istekte zaten çözülmüş oluyor, ek sorgu maliyeti yok.
  const shell = await getAppShellContext();
  const activeBusinessName =
    shell.businesses.find((item: AppShellContext["businesses"][number]) => item.slug === shell.activeBusinessSlug)
      ?.name ?? undefined;
  const activeBranchName =
    shell.branches.find((branch: AppShellContext["branches"][number]) => branch.id === shell.activeBranchId)
      ?.name ?? undefined;

  return (
    <>
      <LiveOpsBridge tables={["orders", "tables", "table_requests", "payments"]} />
      <LiveRouteRefresh tables={["orders", "table_requests", "payments", "tables"]} debounceMs={260} minIntervalMs={1500} />
      <MobileOpsDashboard 
        metrics={metrics}
        recentOrders={recentOrders}
        lowStockProducts={lowStockProducts}
        usingDemoData={usingDemoData}
        ops={ops}
        isSelfServiceCoffee={isSelfServiceCoffee}
        businessName={activeBusinessName}
        branchName={activeBranchName}
      />
    </>
  );
}
