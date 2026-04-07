"use client";

import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { OrderStatus } from "@/lib/types";

export function OptimisticVisibility({
  orderId,
  children,
  hideOnStatuses = ["paid", "cancelled", "refunded"],
}: {
  orderId: string;
  children: React.ReactNode;
  hideOnStatuses?: OrderStatus[];
}) {
  const optimisticStatus = usePosCommandQueueStore((state) => 
    state.cashierOptimisticState[orderId]?.status as OrderStatus | undefined
  );

  if (optimisticStatus && hideOnStatuses.includes(optimisticStatus)) {
    return null; /* Hide instantly on optimistic change */
  }

  return <>{children}</>;
}
