"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

type LiveOpsBridgeProps = {
  tables: string[];
  enableSound?: boolean;
};

const LIVE_REFRESH_DEBOUNCE_MS = 300;
const LIVE_REFRESH_MIN_INTERVAL_MS = 1200;
const OPS_REFRESH_DEBOUNCE_MS = 700;
const OPS_REFRESH_MIN_INTERVAL_MS = 3500;

function getRefreshProfile(pathname: string | null) {
  if (pathname === "/ops") {
    return {
      debounceMs: OPS_REFRESH_DEBOUNCE_MS,
      minIntervalMs: OPS_REFRESH_MIN_INTERVAL_MS,
    };
  }

  return {
    debounceMs: LIVE_REFRESH_DEBOUNCE_MS,
    minIntervalMs: LIVE_REFRESH_MIN_INTERVAL_MS,
  };
}

export function LiveOpsBridge({ tables, enableSound = false }: LiveOpsBridgeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const channelKey = useMemo(() => [...tables].sort().join("-"), [tables]);
  const refreshProfile = useMemo(() => getRefreshProfile(pathname), [pathname]);

  const queueRefresh = useEffectEvent(() => {
    const elapsed = Date.now() - lastRefreshAtRef.current;
    const waitMs = Math.max(refreshProfile.debounceMs, refreshProfile.minIntervalMs - elapsed);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (isRefreshingRef.current) {
        return;
      }

      isRefreshingRef.current = true;
      lastRefreshAtRef.current = Date.now();
      window.dispatchEvent(new CustomEvent("live-ops:update", { detail: { pathname, tables } }));
      startTransition(() => {
        router.refresh();
      });
      window.setTimeout(() => {
        isRefreshingRef.current = false;
      }, 500);
    }, waitMs);
  });

  useEffect(() => {
    const supabase = getSupabaseAuthBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(`ops-live-${channelKey}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (typeof document !== "undefined" && document.hidden) {
            return;
          }
          if (pathname === "/ops" && table === "products" && payload.eventType !== "INSERT" && payload.eventType !== "DELETE") {
            return;
          }
          if (enableSound && table === "orders" && payload.eventType === "INSERT") {
            playAlertTone();
          }
          queueRefresh();
        },
      );
    }

    channel.subscribe((status) => {
      setConnected(status === "SUBSCRIBED");
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [channelKey, enableSound, pathname, refreshProfile, tables]);

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
      }`}
    >
      {connected ? "Realtime Acik" : "Realtime Kapali"}
    </span>
  );
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
