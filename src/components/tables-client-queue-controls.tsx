"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { enqueuePosCommand, flushPosCommandQueue } from "@/lib/pos/queue/engine";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { TableStatus } from "@/lib/types";

const COMMITTED_TABLE_STATUS_TTL_MS = 45_000;

const statusStyles: Record<TableStatus, string> = {
  empty: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-800",
  reserved: "bg-sky-100 text-sky-800",
};

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Boş";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function resolveNextStatus(currentStatus: TableStatus, preferredNextStatus: "empty" | "reserved") {
  if (currentStatus === "occupied") {
    return null;
  }
  if (currentStatus === preferredNextStatus) {
    return currentStatus === "reserved" ? "empty" : "reserved";
  }
  return preferredNextStatus;
}

function resolveCommittedStatus(status: TableStatus | undefined, updatedAt: number | undefined) {
  if (!status || typeof updatedAt !== "number") {
    return null;
  }
  return Date.now() - updatedAt <= COMMITTED_TABLE_STATUS_TTL_MS ? status : null;
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
  const committed = usePosCommandQueueStore((state) => state.tablesCommittedState[tableId]);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) => item.scope === "tables" && item.optimistic?.table?.tableId === tableId,
    ),
  );

  const committedStatus = resolveCommittedStatus(committed?.status, committed?.updatedAt);
  const status = optimistic?.status ?? committedStatus ?? initialStatus;

  return (
    <span className={`${className} ${statusStyles[status]}`}>
      {tableStatusLabel(status)}
      {pending ? " · İşleniyor" : ""}
    </span>
  );
}

export function TableStatusQueueButton({
  tableId,
  currentStatus,
  nextStatus,
  idleLabel,
  pendingLabel,
  className,
}: {
  tableId: string;
  currentStatus: TableStatus;
  nextStatus: "empty" | "reserved";
  returnStatusFilter?: "all" | TableStatus;
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const clearLastResult = usePosCommandQueueStore((state) => state.clearLastResult);
  const lastResult = usePosCommandQueueStore((state) => state.commandQueueState.lastResult);
  const optimistic = usePosCommandQueueStore((state) => state.tablesOptimisticState[tableId]);
  const committed = usePosCommandQueueStore((state) => state.tablesCommittedState[tableId]);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) => item.scope === "tables" && item.optimistic?.table?.tableId === tableId,
    ),
  );
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const hasHandledResultRef = useRef(false);
  const committedStatus = resolveCommittedStatus(committed?.status, committed?.updatedAt);
  const effectiveCurrentStatus = optimistic?.status ?? committedStatus ?? currentStatus;
  const effectiveNextStatus = useMemo(
    () => resolveNextStatus(effectiveCurrentStatus, nextStatus),
    [effectiveCurrentStatus, nextStatus],
  );
  const successMessage = useMemo(() => {
    if (effectiveNextStatus === "reserved") {
      return "Masa rezerveye alındı.";
    }
    return "Masa tekrar boş duruma alındı.";
  }, [effectiveNextStatus]);

  useEffect(() => {
    if (!trackedCommandId || !lastResult) {
      return;
    }
    if (lastResult.commandId !== trackedCommandId || hasHandledResultRef.current) {
      return;
    }

    hasHandledResultRef.current = true;
    if (lastResult.status === "ACK") {
      toast.success(successMessage);
    } else if (lastResult.status === "CONFLICT" || lastResult.status === "REJECT") {
      toast.error(lastResult.message ?? "Masa durumu güncellenemedi.");
    }
    clearLastResult();
  }, [clearLastResult, lastResult, successMessage, trackedCommandId]);

  function handleClick() {
    if (pending || !effectiveNextStatus) {
      return;
    }

    hasHandledResultRef.current = false;
    const queued = enqueuePosCommand({
      scope: "tables",
      type: "TABLE_STATUS_SET",
      payload: {
        table_id: tableId,
        status: effectiveNextStatus,
      },
      optimistic: {
        table: {
          tableId,
          previousStatus: effectiveCurrentStatus,
          nextStatus: effectiveNextStatus,
        },
      },
    });

    setTrackedCommandId(queued.commandId);
    toast.success("Masa komutu kuyruga alındı.");
    void flushPosCommandQueue();
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending || !effectiveNextStatus} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function TableReservationToggleQueueButton({
  tableId,
  initialStatus,
  reserveLabel,
  releaseLabel,
  pendingLabel,
  className,
}: {
  tableId: string;
  initialStatus: TableStatus;
  reserveLabel: string;
  releaseLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const optimistic = usePosCommandQueueStore((state) => state.tablesOptimisticState[tableId]);
  const committed = usePosCommandQueueStore((state) => state.tablesCommittedState[tableId]);
  const committedStatus = resolveCommittedStatus(committed?.status, committed?.updatedAt);
  const effectiveStatus = optimistic?.status ?? committedStatus ?? initialStatus;

  if (effectiveStatus === "occupied") {
    return null;
  }

  const nextStatus = effectiveStatus === "reserved" ? "empty" : "reserved";
  const idleLabel = nextStatus === "reserved" ? reserveLabel : releaseLabel;

  return (
    <TableStatusQueueButton
      tableId={tableId}
      currentStatus={effectiveStatus}
      nextStatus={nextStatus}
      idleLabel={idleLabel}
      pendingLabel={pendingLabel}
      className={className}
    />
  );
}
