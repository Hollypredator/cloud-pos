import type { OpsCommandResultStatus, OpsCommandType, OrderStatus, TableStatus } from "@/lib/types";

export type PosQueueScope = "tables" | "cashier";
export type PosQueueStatus = "queued" | "sending" | "retry";

export type TablesOptimisticEntry = {
  status: TableStatus;
  commandId: string;
};

export type TablesCommittedEntry = {
  status: TableStatus;
  updatedAt: number;
};

export type CashierOptimisticEntry = {
  commandId: string;
  status?: OrderStatus;
  amountPaidDelta?: number;
  remainingDelta?: number;
  discountAmount?: number;
  serviceFee?: number;
  finalPrice?: number;
};

export type CashierCommittedEntry = {
  status?: OrderStatus;
  amountPaid?: number;
  remaining?: number;
  discountAmount?: number;
  serviceFee?: number;
  finalPrice?: number;
  updatedAt: number;
};

export type PosQueueOptimisticPatch = {
  table?: {
    tableId: string;
    previousStatus: TableStatus;
    nextStatus: TableStatus;
  };
  cashier?: {
    orderId: string;
    apply: Omit<CashierOptimisticEntry, "commandId">;
  };
};

export type PosQueueItem = {
  commandId: string;
  idempotencyKey: string;
  type: OpsCommandType;
  payload: Record<string, unknown>;
  scope: PosQueueScope;
  status: PosQueueStatus;
  retryCount: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  optimistic?: PosQueueOptimisticPatch;
  rollback?: {
    tablePrevious?: TablesOptimisticEntry | null;
    cashierPrevious?: CashierOptimisticEntry | null;
  };
  lastMessage?: string;
};

export type PosQueueResolution = {
  commandId: string;
  scope: PosQueueScope;
  status: OpsCommandResultStatus;
  message?: string;
  at: number;
};

export type PosQueueHttpResult = {
  status: OpsCommandResultStatus;
  message?: string;
  retryAfterMs?: number;
  data?: Record<string, unknown>;
};
