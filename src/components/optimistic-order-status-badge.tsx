"use client";

import { useState, useEffect } from "react";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { OrderStatus } from "@/lib/types";

const COMMITTED_STATUS_TTL_MS = 45_000;

function resolveStatusTone(status: OrderStatus) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "partially_paid") return "bg-blue-100 text-blue-700";
  if (status === "partially_refunded") return "bg-rose-100 text-rose-700";
  if (status === "ready") return "bg-[#fff2ee] text-[#ff5a34]";
  if (status === "served") return "bg-[#fff2ee] text-[#ff5a34]";
  if (status === "preparing") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function resolveStatusLabel(status: OrderStatus) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazırlaniyor";
  if (status === "ready") return "Hazır";
  if (status === "served") return "Teslim edildi";
  if (status === "cancelled") return "İptal";
  if (status === "paid") return "Kapandı";
  return status;
}

export function OptimisticOrderStatusBadge({
  orderId,
  baseStatus,
  className,
}: {
  orderId: string;
  baseStatus: OrderStatus;
  className: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const optimisticStatus = usePosCommandQueueStore(
    (state) => state.cashierOptimisticState[orderId]?.status as OrderStatus | undefined,
  );
  const committedEntry = usePosCommandQueueStore((state) => state.cashierCommittedState[orderId]);
  const committedStatus =
    committedEntry && Date.now() - committedEntry.updatedAt <= COMMITTED_STATUS_TTL_MS
      ? (committedEntry.status as OrderStatus | undefined)
      : undefined;
  const resolvedStatus = mounted
    ? optimisticStatus ?? committedStatus ?? baseStatus
    : baseStatus;

  return (
    <span className={`${className} ${resolveStatusTone(resolvedStatus)}`}>
      {resolveStatusLabel(resolvedStatus)}
    </span>
  );
}

