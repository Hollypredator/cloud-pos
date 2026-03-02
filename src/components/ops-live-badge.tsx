"use client";

import dynamic from "next/dynamic";

const LiveOpsBridge = dynamic(() => import("@/components/live-ops-bridge").then((mod) => mod.LiveOpsBridge), {
  ssr: false,
  loading: () => (
    <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Realtime Yukleniyor</span>
  ),
});

export function OpsLiveBadge() {
  return <LiveOpsBridge tables={["orders", "tables", "products"]} />;
}
