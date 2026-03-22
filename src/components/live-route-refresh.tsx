"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { addLivePosEventListener, type LivePosEvent } from "@/lib/live-events";

type LiveRouteRefreshProps = {
  tables: string[];
  debounceMs?: number;
  minIntervalMs?: number;
};

const MOBILE_DEBOUNCE_FLOOR_MS = 650;
const MOBILE_MIN_INTERVAL_FLOOR_MS = 3200;
const DESKTOP_DEBOUNCE_FLOOR_MS = 600;
const DESKTOP_MIN_INTERVAL_FLOOR_MS = 6000;
const USER_INTERACTION_COOLDOWN_MS = 1800;

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
  const coarsePointerRef = useRef(false);
  const lastUserInteractionAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const apply = () => {
      coarsePointerRef.current = media.matches;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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

  const queueRefresh = useEffectEvent(() => {
    const effectiveDebounceMs = coarsePointerRef.current
      ? Math.max(debounceMs, MOBILE_DEBOUNCE_FLOOR_MS)
      : Math.max(debounceMs, DESKTOP_DEBOUNCE_FLOOR_MS);
    const effectiveMinIntervalMs = coarsePointerRef.current
      ? Math.max(minIntervalMs, MOBILE_MIN_INTERVAL_FLOOR_MS)
      : Math.max(minIntervalMs, DESKTOP_MIN_INTERVAL_FLOOR_MS);
    const elapsed = Date.now() - lastRefreshAtRef.current;
    const timeSinceInteraction = Date.now() - lastUserInteractionAtRef.current;
    const interactionGuardMs = timeSinceInteraction < USER_INTERACTION_COOLDOWN_MS
      ? USER_INTERACTION_COOLDOWN_MS - timeSinceInteraction
      : 0;
    const waitMs = Math.max(effectiveDebounceMs, effectiveMinIntervalMs - elapsed, interactionGuardMs);
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
      const duplicateWindowMs = coarsePointerRef.current ? 1800 : 1200;
      if (fingerprint === lastFingerprintRef.current && event.at - lastEventAtRef.current < duplicateWindowMs) {
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
