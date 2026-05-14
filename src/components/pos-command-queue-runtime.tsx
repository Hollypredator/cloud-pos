"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { flushPosCommandQueue } from "@/lib/pos/queue/engine";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";

const FLUSH_INTERVAL_MS = 2_500;

export function PosCommandQueueRuntime() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pendingCount = usePosCommandQueueStore((state) => state.commandQueueState.items.length);
  const refreshRoute = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (pendingCount <= 0) {
      return;
    }

    void flushPosCommandQueue({ queryClient, onResolved: refreshRoute });
  }, [pendingCount, queryClient, refreshRoute]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const flush = () => flushPosCommandQueue({ queryClient, onResolved: refreshRoute });

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
  }, [queryClient, refreshRoute]);

  return null;
}
