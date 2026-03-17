"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { addLivePosEventListener, type LivePosEvent } from "@/lib/live-events";

type LiveRouteRefreshProps = {
  tables: string[];
  debounceMs?: number;
  minIntervalMs?: number;
};

function isRelevant(event: LivePosEvent, tables: string[]) {
  if (event.type === "heartbeat") {
    return false;
  }
  return tables.includes(event.sourceTable);
}

export function LiveRouteRefresh({
  tables,
  debounceMs = 220,
  minIntervalMs = 1400,
}: LiveRouteRefreshProps) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const lastFingerprintRef = useRef<string | null>(null);
  const lastEventAtRef = useRef(0);

  const queueRefresh = useEffectEvent(() => {
    const elapsed = Date.now() - lastRefreshAtRef.current;
    const waitMs = Math.max(debounceMs, minIntervalMs - elapsed);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      lastRefreshAtRef.current = Date.now();
      router.refresh();
    }, waitMs);
  });

  useEffect(() => {
    const unsubscribe = addLivePosEventListener((event) => {
      if (!isRelevant(event, tables)) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      const fingerprint = `${event.sourceTable}:${event.sourceEvent}:${event.type}:${event.orderId ?? "no-order"}:${event.tableId ?? "no-table"}`;
      if (fingerprint === lastFingerprintRef.current && event.at - lastEventAtRef.current < 1200) {
        return;
      }
      lastFingerprintRef.current = fingerprint;
      lastEventAtRef.current = event.at;
      queueRefresh();
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [minIntervalMs, queueRefresh, tables]);

  return null;
}

