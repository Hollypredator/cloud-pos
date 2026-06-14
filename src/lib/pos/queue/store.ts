"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { OpsCommandResultStatus, OpsCommandType, OrderStatus, TableStatus } from "@/lib/types";
import type {
  CashierCommittedEntry,
  CashierOptimisticEntry,
  PosQueueItem,
  PosQueueOptimisticPatch,
  PosQueueResolution,
  PosQueueScope,
  TablesCommittedEntry,
  TablesOptimisticEntry,
} from "@/lib/pos/queue/types";

type QueueResultInput = {
  status: OpsCommandResultStatus;
  message?: string;
  data?: Record<string, unknown>;
};

type PosCommandQueueStore = {
  tablesOptimisticState: Record<string, TablesOptimisticEntry>;
  tablesCommittedState: Record<string, TablesCommittedEntry>;
  cashierOptimisticState: Record<string, CashierOptimisticEntry>;
  cashierCommittedState: Record<string, CashierCommittedEntry>;
  commandQueueState: {
    items: PosQueueItem[];
    lastFlushAt: number | null;
    lastResult: PosQueueResolution | null;
  };
  enqueue: (input: {
    commandId: string;
    idempotencyKey: string;
    type: OpsCommandType;
    payload: Record<string, unknown>;
    scope: PosQueueScope;
    optimistic?: PosQueueOptimisticPatch;
  }) => { commandId: string; duplicate: boolean };
  markSending: (commandId: string) => void;
  markRetry: (commandId: string, options: { retryAfterMs: number; message?: string }) => void;
  resolve: (commandId: string, result: QueueResultInput) => void;
  touchFlush: () => void;
  clearLastResult: () => void;
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage<PosCommandQueueStore>(() =>
  typeof window === "undefined" ? noopStorage : window.localStorage,
);

function mergeCashierOptimisticEntry(
  current: CashierOptimisticEntry | undefined,
  commandId: string,
  patch: Omit<CashierOptimisticEntry, "commandId">,
): CashierOptimisticEntry {
  const next: CashierOptimisticEntry = {
    ...(current ?? {}),
    commandId,
  };

  if (typeof patch.status === "string") {
    next.status = patch.status;
  }
  if (typeof patch.amountPaidDelta === "number") {
    next.amountPaidDelta = (current?.amountPaidDelta ?? 0) + patch.amountPaidDelta;
  }
  if (typeof patch.remainingDelta === "number") {
    next.remainingDelta = (current?.remainingDelta ?? 0) + patch.remainingDelta;
  }
  if (typeof patch.discountAmount === "number") {
    next.discountAmount = patch.discountAmount;
  }
  if (typeof patch.serviceFee === "number") {
    next.serviceFee = patch.serviceFee;
  }
  if (typeof patch.finalPrice === "number") {
    next.finalPrice = patch.finalPrice;
  }
  return next;
}

function mergeCashierCommittedEntry(
  current: CashierCommittedEntry | undefined,
  patch: Partial<Omit<CashierCommittedEntry, "updatedAt">>,
): CashierCommittedEntry {
  const next: CashierCommittedEntry = {
    ...(current ?? {}),
    updatedAt: Date.now(),
  };

  if (typeof patch.status === "string") {
    next.status = patch.status;
  }
  if (typeof patch.amountPaid === "number") {
    next.amountPaid = patch.amountPaid;
  }
  if (typeof patch.remaining === "number") {
    next.remaining = patch.remaining;
  }
  if (typeof patch.discountAmount === "number") {
    next.discountAmount = patch.discountAmount;
  }
  if (typeof patch.serviceFee === "number") {
    next.serviceFee = patch.serviceFee;
  }
  if (typeof patch.finalPrice === "number") {
    next.finalPrice = patch.finalPrice;
  }

  return next;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function asOrderStatus(value: unknown): OrderStatus | null {
  if (
    value === "pending" ||
    value === "preparing" ||
    value === "ready" ||
    value === "served" ||
    value === "partially_paid" ||
    value === "paid" ||
    value === "partially_refunded" ||
    value === "cancelled" ||
    value === "refunded"
  ) {
    return value;
  }
  return null;
}

function asTableStatus(value: unknown): TableStatus | null {
  if (value === "empty" || value === "occupied" || value === "reserved") {
    return value;
  }
  return null;
}

function buildCommittedSnapshotsFromAck(command: PosQueueItem, resultData: Record<string, unknown>) {
  const nextTables: Record<string, TablesCommittedEntry> = {};
  const nextCashier: Record<string, Partial<Omit<CashierCommittedEntry, "updatedAt">>> = {};
  const resolvedAt = Date.now();
  const orderId = asString(command.payload.order_id);

  if (command.type === "TABLE_STATUS_SET") {
    const tableId = asString(command.payload.table_id) ?? command.optimistic?.table?.tableId ?? null;
    const status =
      asTableStatus(resultData?.status) ??
      asTableStatus(command.payload.status) ??
      command.optimistic?.table?.nextStatus ??
      null;
    if (tableId && status) {
      nextTables[tableId] = {
        status,
        updatedAt: resolvedAt,
      };
    }
  }

  if (orderId) {
    if (command.type === "ORDER_FINANCIALS_SET") {
      const finalPrice = asNumber(resultData?.finalPrice ?? resultData?.final_price);
      const discountAmount = asNumber(command.payload.discount_amount);
      const serviceFee = asNumber(command.payload.service_fee);
      nextCashier[orderId] = {
        ...(discountAmount === null ? {} : { discountAmount }),
        ...(serviceFee === null ? {} : { serviceFee }),
        ...(finalPrice === null ? {} : { finalPrice }),
      };
    }

    if (command.type === "PAYMENT_SALE_CASH") {
      const status = asOrderStatus(resultData?.status);
      const amountPaid = asNumber(resultData?.amountPaid ?? resultData?.amount_paid);
      const remaining = asNumber(resultData?.remaining ?? resultData?.remaining_balance);
      nextCashier[orderId] = {
        ...(status ? { status } : {}),
        ...(amountPaid === null ? {} : { amountPaid }),
        ...(remaining === null ? {} : { remaining }),
      };
    }

    if (command.type === "ORDER_REFUND_CASH") {
      const status = asOrderStatus(resultData?.status);
      if (status) {
        nextCashier[orderId] = {
          status,
        };
      }
    }

    if (command.type === "ORDER_CANCEL") {
      nextCashier[orderId] = {
        status: "cancelled",
        remaining: 0,
      };
    }
  }

  return { nextTables, nextCashier };
}

function removeQueueItem(items: PosQueueItem[], commandId: string) {
  return items.filter((item) => item.commandId !== commandId);
}

function toResolution(command: PosQueueItem, status: OpsCommandResultStatus, message?: string): PosQueueResolution {
  return {
    commandId: command.commandId,
    scope: command.scope,
    status,
    message,
    at: Date.now(),
  };
}

export const usePosCommandQueueStore = create<PosCommandQueueStore>()(
  persist(
    (set, get) => ({
      tablesOptimisticState: {},
      tablesCommittedState: {},
      cashierOptimisticState: {},
      cashierCommittedState: {},
      commandQueueState: {
        items: [],
        lastFlushAt: null,
        lastResult: null,
      },

      enqueue: (input) => {
        const state = get();
        const duplicate = state.commandQueueState.items.find((item) => item.idempotencyKey === input.idempotencyKey);
        if (duplicate) {
          return { commandId: duplicate.commandId, duplicate: true };
        }

        const optimistic = input.optimistic;
        const tablePrevious =
          optimistic?.table && optimistic.table.tableId in state.tablesOptimisticState
            ? state.tablesOptimisticState[optimistic.table.tableId]
            : null;
        const cashierPrevious =
          optimistic?.cashier && optimistic.cashier.orderId in state.cashierOptimisticState
            ? state.cashierOptimisticState[optimistic.cashier.orderId]
            : null;

        const item: PosQueueItem = {
          commandId: input.commandId,
          idempotencyKey: input.idempotencyKey,
          type: input.type,
          payload: input.payload,
          scope: input.scope,
          status: "queued",
          retryCount: 0,
          nextAttemptAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          optimistic,
          rollback: {
            tablePrevious,
            cashierPrevious,
          },
        };

        const nextTables = { ...state.tablesOptimisticState };
        const nextCashier = { ...state.cashierOptimisticState };

        if (optimistic?.table) {
          nextTables[optimistic.table.tableId] = {
            status: optimistic.table.nextStatus,
            commandId: input.commandId,
          };
        }

        if (optimistic?.cashier) {
          const current = nextCashier[optimistic.cashier.orderId];
          nextCashier[optimistic.cashier.orderId] = mergeCashierOptimisticEntry(
            current,
            input.commandId,
            optimistic.cashier.apply,
          );
        }

        set({
          tablesOptimisticState: nextTables,
          cashierOptimisticState: nextCashier,
          commandQueueState: {
            ...state.commandQueueState,
            items: [...state.commandQueueState.items, item],
          },
        });

        return { commandId: input.commandId, duplicate: false };
      },

      markSending: (commandId) => {
        const state = get();
        const nextItems = state.commandQueueState.items.map((item) =>
          item.commandId === commandId
            ? {
                ...item,
                status: "sending" as const,
                updatedAt: Date.now(),
              }
            : item,
        );
        set({
          commandQueueState: {
            ...state.commandQueueState,
            items: nextItems,
          },
        });
      },

      markRetry: (commandId, options) => {
        const state = get();
        const now = Date.now();
        const nextItems = state.commandQueueState.items.map((item) => {
          if (item.commandId !== commandId) {
            return item;
          }
          return {
            ...item,
            status: "retry" as const,
            retryCount: item.retryCount + 1,
            nextAttemptAt: now + options.retryAfterMs,
            updatedAt: now,
            lastMessage: options.message,
          };
        });

        set({
          commandQueueState: {
            ...state.commandQueueState,
            items: nextItems,
          },
        });
      },

      resolve: (commandId, result) => {
        const state = get();
        const command = state.commandQueueState.items.find((item) => item.commandId === commandId);
        if (!command) {
          return;
        }

        const nextTables = { ...state.tablesOptimisticState };
        const nextCommittedTables = { ...state.tablesCommittedState };
        const nextCashier = { ...state.cashierOptimisticState };
        const nextCommittedCashier = { ...state.cashierCommittedState };

        if (command.optimistic?.table) {
          const tableId = command.optimistic.table.tableId;
          const current = nextTables[tableId];
          if (current?.commandId === command.commandId) {
            if (result.status === "ACK") {
              delete nextTables[tableId];
            } else if (command.rollback?.tablePrevious) {
              nextTables[tableId] = command.rollback.tablePrevious;
            } else {
              delete nextTables[tableId];
            }
          }
        }

        if (command.optimistic?.cashier) {
          const orderId = command.optimistic.cashier.orderId;
          const current = nextCashier[orderId];
          if (current?.commandId === command.commandId) {
            if (result.status === "ACK") {
              delete nextCashier[orderId];
            } else if (command.rollback?.cashierPrevious) {
              nextCashier[orderId] = command.rollback.cashierPrevious;
            } else {
              delete nextCashier[orderId];
            }
          }
        }

        if (result.status === "ACK") {
          const committed = buildCommittedSnapshotsFromAck(command, result.data ?? {});
          for (const [tableId, entry] of Object.entries(committed.nextTables)) {
            nextCommittedTables[tableId] = entry;
          }
          for (const [orderId, patch] of Object.entries(committed.nextCashier)) {
            nextCommittedCashier[orderId] = mergeCashierCommittedEntry(nextCommittedCashier[orderId], patch);
          }
        }

        set({
          tablesOptimisticState: nextTables,
          tablesCommittedState: nextCommittedTables,
          cashierOptimisticState: nextCashier,
          cashierCommittedState: nextCommittedCashier,
          commandQueueState: {
            ...state.commandQueueState,
            items: removeQueueItem(state.commandQueueState.items, commandId),
            lastResult: toResolution(command, result.status, result.message),
          },
        });
      },

      touchFlush: () => {
        const state = get();
        set({
          commandQueueState: {
            ...state.commandQueueState,
            lastFlushAt: Date.now(),
          },
        });
      },

      clearLastResult: () => {
        const state = get();
        set({
          commandQueueState: {
            ...state.commandQueueState,
            lastResult: null,
          },
        });
      },
    }),
    {
      name: "cloudpos-pos-command-queue",
      storage,
    },
  ),
);
