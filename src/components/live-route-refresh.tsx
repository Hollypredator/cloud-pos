"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addLivePosEventListener, type LivePosEvent } from "@/lib/live-events";
import { getWebPerfProfile } from "@/lib/web-perf-profile";

type LiveRouteRefreshProps = {
  tables: string[];
  debounceMs?: number;
  minIntervalMs?: number;
};

function isRelevant(event: LivePosEvent, tables: string[]) {
  if (event.sourceEvent === "POLL") {
    return true;
  }
  if (event.type === "heartbeat") {
    return false;
  }
  return tables.includes(event.sourceTable);
}

export function LiveRouteRefresh({
  tables,
  debounceMs,
  minIntervalMs,
}: LiveRouteRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledRefreshAtRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const lastFingerprintRef = useRef<string | null>(null);
  const lastEventAtRef = useRef(0);
  const lastUserInteractionAtRef = useRef(0);
  const pendingHiddenRefreshRef = useRef(false);
  const profileRef = useRef(getWebPerfProfile(pathname));

  useEffect(() => {
    profileRef.current = getWebPerfProfile(pathname);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const markInteraction = () => {
      lastUserInteractionAtRef.current = Date.now();
    };

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };
  }, []);

  const queueRefresh = useEffectEvent((event?: Pick<LivePosEvent, "sourceEvent" | "type">) => {
    const profile = profileRef.current;
    const effectiveDebounceMs = debounceMs ?? profile.refreshDebounceMs;
    const effectiveMinIntervalMs = minIntervalMs ?? profile.refreshMinIntervalMs;
    const elapsed = Date.now() - lastRefreshAtRef.current;
    const timeSinceInteraction = Date.now() - lastUserInteractionAtRef.current;
    const skipInteractionGuard = event?.sourceEvent === "POLL" || event?.type === "order_created";
    const interactionGuardMs = timeSinceInteraction < profile.interactionGuardMs
      ? (skipInteractionGuard ? 0 : profile.interactionGuardMs - timeSinceInteraction)
      : 0;
    const waitMs = Math.max(effectiveDebounceMs, effectiveMinIntervalMs - elapsed, interactionGuardMs);
    const targetAt = Date.now() + waitMs;
    if (timeoutRef.current && scheduledRefreshAtRef.current > 0 && scheduledRefreshAtRef.current <= targetAt) {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    scheduledRefreshAtRef.current = targetAt;
    timeoutRef.current = setTimeout(() => {
      scheduledRefreshAtRef.current = 0;
      timeoutRef.current = null;
      if (typeof document !== "undefined" && document.hidden) {
        pendingHiddenRefreshRef.current = true;
        return;
      }
      lastRefreshAtRef.current = Date.now();
      router.refresh();
    }, waitMs);
  });

  const flushPendingIfVisible = useEffectEvent(() => {
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    if (!pendingHiddenRefreshRef.current) {
      return;
    }
    pendingHiddenRefreshRef.current = false;
    queueRefresh();
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      flushPendingIfVisible();
    };

    const handleWindowFocus = () => {
      flushPendingIfVisible();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    scheduledRefreshAtRef.current = 0;
    const unsubscribe = addLivePosEventListener((event) => {
      if (!isRelevant(event, tables)) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        pendingHiddenRefreshRef.current = true;
        return;
      }
      const fingerprint = `${event.sourceTable}:${event.sourceEvent}:${event.type}:${event.orderId ?? "no-order"}:${event.tableId ?? "no-table"}:${event.status ?? "no-status"}`;
      const profile = profileRef.current;
      const duplicateWindowMs = event.sourceEvent === "POLL" ? Math.min(300, profile.duplicateWindowMs) : profile.duplicateWindowMs;
      if (fingerprint === lastFingerprintRef.current && event.at - lastEventAtRef.current < duplicateWindowMs) {
        return;
      }
      lastFingerprintRef.current = fingerprint;
      lastEventAtRef.current = event.at;
      queueRefresh(event);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      scheduledRefreshAtRef.current = 0;
    };
  }, [tables]);

  return null;
}
