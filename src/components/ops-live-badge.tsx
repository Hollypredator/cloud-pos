"use client";

import dynamic from "next/dynamic";

const LiveOpsBridge = dynamic(() => import("@/components/live-ops-bridge").then((mod) => mod.LiveOpsBridge), {
  ssr: false,
  loading: () => (
    <span className="inline-flex w-full justify-center rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 sm:w-auto">
      Realtime Yukleniyor
    </span>
  ),
});

const LiveRouteRefresh = dynamic(() => import("@/components/live-route-refresh").then((mod) => mod.LiveRouteRefresh), {
  ssr: false,
});

export function OpsLiveBadge() {
  return (
    <>
      <LiveOpsBridge tables={["orders", "tables", "products", "table_requests", "payments"]} fallbackIntervalMs={1400} />
      <LiveRouteRefresh tables={["orders", "tables", "products", "table_requests", "payments"]} debounceMs={260} minIntervalMs={1500} />
    </>
  );
}
