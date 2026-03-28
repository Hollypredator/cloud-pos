"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { enqueuePosCommand, flushPosCommandQueue } from "@/lib/pos/queue/engine";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { TableStatus } from "@/lib/types";

type TableFilter = "all" | TableStatus;

const statusStyles: Record<TableStatus, string> = {
  empty: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-800",
  reserved: "bg-sky-100 text-sky-800",
};

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Bos";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function feedbackHref(tone: "success" | "error", message: string, filter: TableFilter) {
  const params = new URLSearchParams();
  params.set("tone", tone);
  params.set("feedback", message);
  if (filter !== "all") {
    params.set("status", filter);
  }
  return `/tables?${params.toString()}`;
}

export function OptimisticTableStatusBadge({
  tableId,
  initialStatus,
  className,
}: {
  tableId: string;
  initialStatus: TableStatus;
  className: string;
}) {
  const optimistic = usePosCommandQueueStore((state) => state.tablesOptimisticState[tableId]);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) => item.scope === "tables" && item.optimistic?.table?.tableId === tableId,
    ),
  );

  const status = optimistic?.status ?? initialStatus;

  return (
    <span className={`${className} ${statusStyles[status]}`}>
      {tableStatusLabel(status)}
      {pending ? " · Isleniyor" : ""}
    </span>
  );
}

export function TableStatusQueueButton({
  tableId,
  currentStatus,
  nextStatus,
  returnStatusFilter,
  idleLabel,
  pendingLabel,
  className,
}: {
  tableId: string;
  currentStatus: TableStatus;
  nextStatus: "empty" | "reserved";
  returnStatusFilter: TableFilter;
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const router = useRouter();
  const clearLastResult = usePosCommandQueueStore((state) => state.clearLastResult);
  const lastResult = usePosCommandQueueStore((state) => state.commandQueueState.lastResult);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) => item.scope === "tables" && item.optimistic?.table?.tableId === tableId,
    ),
  );
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const hasHandledResultRef = useRef(false);

  const successMessage = useMemo(
    () =>
      nextStatus === "reserved"
        ? "Masa rezerveye alındı."
        : "Masa tekrar boş duruma alındı.",
    [nextStatus],
  );

  useEffect(() => {
    if (!trackedCommandId || !lastResult) {
      return;
    }
    if (lastResult.commandId !== trackedCommandId || hasHandledResultRef.current) {
      return;
    }

    hasHandledResultRef.current = true;
    if (lastResult.status === "ACK") {
      router.replace(feedbackHref("success", successMessage, returnStatusFilter), { scroll: false });
      router.refresh();
    } else if (lastResult.status === "CONFLICT" || lastResult.status === "REJECT") {
      router.replace(
        feedbackHref("error", lastResult.message ?? "Masa durumu güncellenemedi.", returnStatusFilter),
        { scroll: false },
      );
      router.refresh();
    }
    clearLastResult();
  }, [clearLastResult, lastResult, returnStatusFilter, router, successMessage, trackedCommandId]);

  function handleClick() {
    if (pending) {
      return;
    }

    hasHandledResultRef.current = false;
    const queued = enqueuePosCommand({
      scope: "tables",
      type: "TABLE_STATUS_SET",
      payload: {
        table_id: tableId,
        status: nextStatus,
      },
      optimistic: {
        table: {
          tableId,
          previousStatus: currentStatus,
          nextStatus,
        },
      },
    });

    setTrackedCommandId(queued.commandId);

    router.replace(feedbackHref("success", "Masa işlemi kuyruga alındı.", returnStatusFilter), { scroll: false });
    void flushPosCommandQueue({
      onResolved: () => router.refresh(),
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
