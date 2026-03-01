"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

type LiveOpsBridgeProps = {
  tables: string[];
  enableSound?: boolean;
};

export function LiveOpsBridge({ tables, enableSound = false }: LiveOpsBridgeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const channelKey = useMemo(() => [...tables].sort().join("-"), [tables]);

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
          if (enableSound && table === "orders" && payload.eventType === "INSERT") {
            playAlertTone();
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            if (isRefreshingRef.current) {
              return;
            }
            isRefreshingRef.current = true;
            router.refresh();
            window.setTimeout(() => {
              isRefreshingRef.current = false;
            }, 800);
          }, 450);
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
  }, [channelKey, enableSound, pathname, router, tables]);

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
