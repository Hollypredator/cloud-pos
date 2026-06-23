"use client";

import { useState, useEffect } from "react";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";

const COMMITTED_MONEY_TTL_MS = 45_000;

export function OptimisticMoney({
  orderId,
  baseAmount,
  field = "remaining",
}: {
  orderId: string;
  baseAmount: number;
  field?: "remaining" | "paid" | "final";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const patch = usePosCommandQueueStore((state) => state.cashierOptimisticState[orderId]);
  const committedEntry = usePosCommandQueueStore((state) => state.cashierCommittedState[orderId]);
  const committed =
    committedEntry && Date.now() - committedEntry.updatedAt <= COMMITTED_MONEY_TTL_MS
      ? committedEntry
      : null;

  if (!mounted) {
    return <>{Math.max(0, baseAmount).toFixed(2)} TL</>;
  }

  let val = baseAmount;
  if (field === "remaining" && typeof committed?.remaining === "number") {
    val = committed.remaining;
  }
  if (field === "paid" && typeof committed?.amountPaid === "number") {
    val = committed.amountPaid;
  }
  if (field === "final" && typeof committed?.finalPrice === "number") {
    val = committed.finalPrice;
  }

  if (patch) {
    if (field === "remaining" && patch.remainingDelta) val += patch.remainingDelta;
    if (field === "paid" && patch.amountPaidDelta) val += patch.amountPaidDelta;
    if (field === "final" && patch.finalPrice !== undefined) val = patch.finalPrice;
  }

  return <>{Math.max(0, val).toFixed(2)} TL</>;
}
