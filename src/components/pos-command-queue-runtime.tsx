"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { flushPosCommandQueue } from "@/lib/pos/queue/engine";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";

const FLUSH_INTERVAL_MS = 2_500;

export function PosCommandQueueRuntime() {
  const queryClient = useQueryClient();
  const pendingCount = usePosCommandQueueStore((state) => state.commandQueueState.items.length);

  useEffect(() => {
    if (pendingCount <= 0) {
      return;
    }

    void flushPosCommandQueue({ queryClient });
  }, [pendingCount, queryClient]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const flush = () => flushPosCommandQueue({ queryClient });

    intervalId = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    const onOnline = () => {
      void flush();
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [queryClient]);

  return null;
}
