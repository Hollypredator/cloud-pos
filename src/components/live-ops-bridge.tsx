"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { emitLivePosEvent, type LivePosEvent } from "@/lib/live-events";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";
import { getWebPerfProfile } from "@/lib/web-perf-profile";

type LiveOpsBridgeProps = {
  tables: string[];
  enableSound?: boolean;
  fallbackIntervalMs?: number;
};

const LIVE_REFRESH_DEBOUNCE_MS = 300;
const LIVE_REFRESH_MIN_INTERVAL_MS = 1200;
const OPS_REFRESH_DEBOUNCE_MS = 700;
const OPS_REFRESH_MIN_INTERVAL_MS = 3500;
const REALTIME_CONNECTING_TIMEOUT_MS = 8000;
const REALTIME_DISCONNECT_GRACE_MS = 15000;
const REALTIME_POST_CONNECT_HOLD_MS = 12000;
const FALLBACK_HIDDEN_INTERVAL_MS = 10000;

export function LiveOpsBridge({ tables, enableSound = false, fallbackIntervalMs }: LiveOpsBridgeProps) {
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRealtimeFingerprintRef = useRef<string | null>(null);
  const lastRealtimeEventAtRef = useRef(0);
  const lastDispatchAtRef = useRef(0);
  const lastSubscribedAtRef = useRef(0);
  const lastConnectionStateChangedAtRef = useRef(0);
  const hasSubscribedÖnceRef = useRef(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "online" | "offline">("connecting");
  const connectionStateRef = useRef<"connecting" | "online" | "offline">("connecting");
  const channelKey = useMemo(() => [...tables].sort().join("-"), [tables]);
  const stableTables = useMemo(() => [...tables].sort(), [tables]);
  const refreshProfile = useMemo(() => {
    const profile = getWebPerfProfile(pathname);
    return {
      debounceMs:
        profile.mode === "ferrari_safe" ? profile.bridgeDebounceMs : (pathname === "/ops" ? OPS_REFRESH_DEBOUNCE_MS : LIVE_REFRESH_DEBOUNCE_MS),
      minIntervalMs:
        profile.mode === "ferrari_safe" ? profile.bridgeMinIntervalMs : (pathname === "/ops" ? OPS_REFRESH_MIN_INTERVAL_MS : LIVE_REFRESH_MIN_INTERVAL_MS),
      duplicateWindowMs: profile.duplicateWindowMs,
      connectionStateMinHoldMs: profile.connectionStateMinHoldMs,
    };
  }, [pathname]);
  const disconnectGraceMs = Math.max(REALTIME_DISCONNECT_GRACE_MS, Number(fallbackIntervalMs ?? 0) || 0);
  const fallbackVisibleIntervalMs = Math.max(600, Number(fallbackIntervalMs ?? 0) || 0);
  const clearFallbackTimer = useEffectEvent(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  });
  const clearConnectionTimers = useEffectEvent(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
    if (stateTransitionRef.current) {
      clearTimeout(stateTransitionRef.current);
      stateTransitionRef.current = null;
    }
  });
  const commitConnectionState = useEffectEvent((nextState: "connecting" | "online" | "offline") => {
    if (connectionStateRef.current === nextState) {
      return;
    }
    connectionStateRef.current = nextState;
    lastConnectionStateChangedAtRef.current = Date.now();
    setConnectionState(nextState);
  });
  const requestConnectionState = useEffectEvent((nextState: "connecting" | "online" | "offline") => {
    if (connectionStateRef.current === nextState) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastConnectionStateChangedAtRef.current;
    const holdMs = Math.max(0, refreshProfile.connectionStateMinHoldMs - elapsed);

    if (stateTransitionRef.current) {
      clearTimeout(stateTransitionRef.current);
      stateTransitionRef.current = null;
    }

    if (holdMs <= 0 || lastConnectionStateChangedAtRef.current === 0) {
      commitConnectionState(nextState);
      return;
    }

    stateTransitionRef.current = setTimeout(() => {
      stateTransitionRef.current = null;
      commitConnectionState(nextState);
    }, holdMs);
  });
  const handleRealtimeChannelStatus = useEffectEvent((status: string) => {
    if (status === "SUBSCRIBED") {
      hasSubscribedÖnceRef.current = true;
      lastSubscribedAtRef.current = Date.now();
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      requestConnectionState("online");
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      if (disconnectTimeoutRef.current) {
        return;
      }
      requestConnectionState("connecting");
      const elapsedSinceSubscribe = Date.now() - lastSubscribedAtRef.current;
      const holdMs = Math.max(
        disconnectGraceMs,
        Math.max(0, REALTIME_POST_CONNECT_HOLD_MS - elapsedSinceSubscribe),
      );
      disconnectTimeoutRef.current = setTimeout(
        () => {
          disconnectTimeoutRef.current = null;
          requestConnectionState(hasSubscribedÖnceRef.current ? "offline" : "connecting");
        },
        holdMs,
      );
      return;
    }

    if (!hasSubscribedÖnceRef.current) {
      requestConnectionState("connecting");
    }
  });

  const queueLiveEvent = useEffectEvent((event?: LivePosEvent) => {
    const elapsed = Date.now() - lastDispatchAtRef.current;
    const waitMs = Math.max(refreshProfile.debounceMs, refreshProfile.minIntervalMs - elapsed);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const now = Date.now();
      const isHeartbeat = !event || event.type === "heartbeat";
      const payload: LivePosEvent =
        event ??
        ({
          type: "heartbeat",
          sourceTable: "poller",
          sourceEvent: "POLL",
          at: now,
        } satisfies LivePosEvent);
      lastDispatchAtRef.current = now;
      emitLivePosEvent(payload);
      if (!isHeartbeat) {
        window.dispatchEvent(
          new CustomEvent("live-ops:update", {
            detail: {
              pathname,
              tables: stableTables,
              at: now,
            },
          }),
        );
      }
    }, waitMs);
  });

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  const scheduleFallbackTick = useEffectEvent(() => {
    if (!fallbackVisibleIntervalMs) {
      clearFallbackTimer();
      return;
    }

    const scheduleNext = () => {
      const intervalMs = typeof document !== "undefined" && document.hidden
        ? FALLBACK_HIDDEN_INTERVAL_MS
        : fallbackVisibleIntervalMs;
      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        queueLiveEvent();
        scheduleNext();
      }, intervalMs);
    };

    clearFallbackTimer();
    scheduleNext();
  });

  useEffect(() => {
    if (!fallbackVisibleIntervalMs) {
      clearFallbackTimer();
      return;
    }

    const handleVisibilityChange = () => {
      scheduleFallbackTick();
    };

    scheduleFallbackTick();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleVisibilityChange);
    }

    return () => {
      clearFallbackTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleVisibilityChange);
      }
    };
  }, [fallbackVisibleIntervalMs]);

  useEffect(() => {
    const supabase = getSupabaseAuthBrowserClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (supabase) {
      requestConnectionState("connecting");
      connectTimeoutRef.current = setTimeout(() => {
        if (!hasSubscribedÖnceRef.current) {
          requestConnectionState("offline");
        }
      }, REALTIME_CONNECTING_TIMEOUT_MS);
      channel = supabase.channel(`ops-live-${channelKey}`);
      for (const table of stableTables) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
            const rowId =
              String(
                (payload.new as { id?: string } | undefined)?.id ??
                (payload.old as { id?: string } | undefined)?.id ??
                "",
              ) || "no-id";
            const status = typeof row.status === "string" ? row.status : "no-status";
            const lockVersion = Number.isFinite(Number(row.lock_version)) ? String(Number(row.lock_version)) : "no-lock";
            const fingerprint = `${table}:${payload.eventType}:${rowId}:${status}:${lockVersion}`;
            const now = Date.now();
            if (
              fingerprint === lastRealtimeFingerprintRef.current &&
              now - lastRealtimeEventAtRef.current < refreshProfile.duplicateWindowMs
            ) {
              return;
            }
            lastRealtimeFingerprintRef.current = fingerprint;
            lastRealtimeEventAtRef.current = now;
            if (!shouldBroadcastRealtimeEvent(pathname, table, payload)) {
              return;
            }
            if (enableSound && table === "orders" && payload.eventType === "INSERT") {
              playAlertTone();
            }
            queueLiveEvent(mapRealtimeEvent(table, payload));
          },
        );
      }

      channel.subscribe((status) => {
        handleRealtimeChannelStatus(status);
      });
    } else {
      requestConnectionState("offline");
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearFallbackTimer();
      clearConnectionTimers();
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [channelKey, enableSound, pathname, refreshProfile.duplicateWindowMs, stableTables]);

  return (
    <span
      className={`inline-flex min-w-[118px] justify-center rounded-full px-2 py-1 text-xs font-semibold ${
        connectionState === "online"
          ? "bg-emerald-100 text-emerald-700"
          : connectionState === "connecting"
            ? "bg-sky-100 text-sky-700"
            : "bg-slate-200 text-slate-600"
      }`}
    >
      {connectionState === "online"
        ? "Realtime Açık"
        : connectionState === "connecting"
          ? "Realtime Baglaniyor"
          : "Realtime Kapali"}
    </span>
  );
}

function toFiniteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isOpsDashboardPath(pathname: string | null) {
  return pathname === "/ops" || pathname === "/m/ops";
}

function shouldBroadcastRealtimeEvent(
  pathname: string | null,
  table: string,
  payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  },
) {
  if (!isOpsDashboardPath(pathname) || table !== "products") {
    return true;
  }

  const nextStock = toFiniteNumber((payload.new as Record<string, unknown> | undefined)?.stock_count);
  const prevStock = toFiniteNumber((payload.old as Record<string, unknown> | undefined)?.stock_count);
  const wasLow = prevStock !== null ? prevStock <= 10 : false;
  const isLow = nextStock !== null ? nextStock <= 10 : false;

  if (payload.eventType === "UPDATE") {
    return wasLow !== isLow;
  }
  if (payload.eventType === "INSERT") {
    return isLow;
  }
  if (payload.eventType === "DELETE") {
    return wasLow;
  }
  return false;
}

function mapRealtimeEvent(
  table: string,
  payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  },
): LivePosEvent {
  const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
  const status = typeof row.status === "string" ? row.status : undefined;
  const paymentType = row.payment_type === "sale" || row.payment_type === "refund" ? row.payment_type : undefined;
  const orderId =
    typeof row.order_id === "string"
      ? row.order_id
      : table === "orders" && typeof row.id === "string"
        ? row.id
        : undefined;
  const tableId =
    table === "tables"
      ? (typeof row.id === "string" ? row.id : undefined)
      : (typeof row.table_id === "string" ? row.table_id : undefined);
  let type: LivePosEvent["type"] = "heartbeat";
  if (table === "orders") {
    if (payload.eventType === "INSERT") {
      type = "order_created";
    } else if (status === "paid" || status === "partially_paid") {
      type = "order_paid";
    } else if (status === "refunded" || status === "partially_refunded") {
      type = "order_refunded";
    } else if (status === "pending" || status === "preparing" || status === "ready" || status === "served") {
      type = "kitchen_status_changed";
    } else {
      type = "order_updated";
    }
  } else if (table === "payments") {
    type = paymentType === "refund" ? "order_refunded" : "order_paid";
  } else if (table === "tables") {
    type = "table_updated";
  }

  return {
    type,
    sourceTable: table,
    sourceEvent: payload.eventType,
    at: Date.now(),
    orderId,
    tableId,
    status,
    paymentType,
    payload: row,
  };
}

function playAlertTone() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.04;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
}
