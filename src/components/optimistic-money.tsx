"use client";

import { usePosCommandQueueStore } from "@/lib/pos/queue/store";

export function OptimisticMoney({
  orderId,
  baseAmount,
  field = "remaining",
}: {
  orderId: string;
  baseAmount: number;
  field?: "remaining" | "paid" | "final";
}) {
  const patch = usePosCommandQueueStore((state) => state.cashierOptimisticState[orderId]);
  
  let val = baseAmount;
  if (patch) {
     if (field === "remaining" && patch.remainingDelta) val += patch.remainingDelta;
     if (field === "paid" && patch.amountPaidDelta) val += patch.amountPaidDelta;
     if (field === "final" && patch.finalPrice !== undefined) val = patch.finalPrice;
  }
  
  return <>{Math.max(0, val).toFixed(2)} TL</>;
}
