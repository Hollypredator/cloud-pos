"use client";

import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { OrderStatus } from "@/lib/types";

const COMMITTED_STATUS_TTL_MS = 45_000;

export function OptimisticVisibility({
  orderId,
  children,
  hideOnStatuses = ["paid", "cancelled", "refunded"],
}: {
  orderId: string;
  children: React.ReactNode;
  hideOnStatuses?: OrderStatus[];
}) {
  const optimisticStatus = usePosCommandQueueStore(
    (state) => state.cashierOptimisticState[orderId]?.status as OrderStatus | undefined,
  );
  const committedEntry = usePosCommandQueueStore((state) => state.cashierCommittedState[orderId]);
  const committedStatus =
    committedEntry && Date.now() - committedEntry.updatedAt <= COMMITTED_STATUS_TTL_MS
      ? (committedEntry.status as OrderStatus | undefined)
      : undefined;
  const resolvedStatus = optimisticStatus ?? committedStatus;

  if (resolvedStatus && hideOnStatuses.includes(resolvedStatus)) {
    return null; /* Hide instantly on optimistic change */
  }

  return <>{children}</>;
}
