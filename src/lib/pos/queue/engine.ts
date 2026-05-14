"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { OpsCommandResultStatus, OpsCommandType } from "@/lib/types";
import { posQueryKeys } from "@/lib/pos/query-keys";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { PosQueueHttpResult, PosQueueItem, PosQueueOptimisticPatch, PosQueueScope } from "@/lib/pos/queue/types";

type FlushQueueOptions = {
  queryClient?: QueryClient;
  onResolved?: () => void;
};

type EnqueuePosCommandInput = {
  scope: PosQueueScope;
  type: OpsCommandType;
  payload: Record<string, unknown>;
  optimistic?: PosQueueOptimisticPatch;
  idempotencyKey?: string;
  commandId?: string;
};

const POS_DEVICE_ID_STORAGE_KEY = "cloudpos.pos_device_id";
let flushInFlight: Promise<void> | null = null;
let activeQueryClient: QueryClient | undefined;
let onResolvedCallbacks: Array<() => void> = [];

function asObject(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function asStatus(input: unknown): OpsCommandResultStatus | null {
  if (input === "ACK" || input === "CONFLICT" || input === "RETRY" || input === "REJECT") {
    return input;
  }
  return null;
}

function getRetryBackoffMs(retryCount: number) {
  return Math.min(30_000, 700 * 2 ** Math.max(0, retryCount));
}

function shouldRetry(status: OpsCommandResultStatus) {
  return status === "RETRY";
}

function getDeviceId() {
  if (typeof window === "undefined") {
    return "web-online";
  }

  const existing = window.localStorage.getItem(POS_DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const generated = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `web-${Date.now()}`;
  window.localStorage.setItem(POS_DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

async function postCommand(item: PosQueueItem): Promise<PosQueueHttpResult> {
  const body = {
    type: item.type,
    payload: item.payload,
    command_id: item.commandId,
    idempotency_key: item.idempotencyKey,
    device_id: getDeviceId(),
  };

  const response = await fetch("/api/ops/command", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  });

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = asObject(await response.json());
  } catch {
    parsedBody = null;
  }

  const result = asObject(parsedBody?.result);
  const parsedStatus = asStatus(result?.status);
  const fallbackStatus = response.ok ? "ACK" : response.status === 409 ? "CONFLICT" : response.status === 503 ? "RETRY" : "REJECT";
  const status = parsedStatus ?? fallbackStatus;

  return {
    status,
    message: typeof result?.message === "string" ? result.message : typeof parsedBody?.message === "string" ? parsedBody.message : undefined,
    retryAfterMs: typeof result?.retry_after_ms === "number" ? result.retry_after_ms : undefined,
    data: asObject(result?.data) ?? undefined,
  };
}

async function invalidateQueriesForScope(scope: PosQueueScope, queryClient?: QueryClient) {
  if (!queryClient) {
    return;
  }
  if (scope === "tables") {
    await queryClient.invalidateQueries({ queryKey: posQueryKeys.tablesSnapshot });
    await queryClient.invalidateQueries({ queryKey: posQueryKeys.opsMetrics });
    return;
  }

  if (scope === "cashier") {
    await queryClient.invalidateQueries({ queryKey: posQueryKeys.cashierSnapshot });
    await queryClient.invalidateQueries({ queryKey: posQueryKeys.opsMetrics });
  }
}

function queueOnResolvedCallback(callback?: () => void) {
  if (!callback) {
    return;
  }
  onResolvedCallbacks.push(callback);
}

function drainOnResolvedCallbacks() {
  const callbacks = onResolvedCallbacks;
  onResolvedCallbacks = [];
  for (const callback of callbacks) {
    try {
      callback();
    } catch {
      // noop
    }
  }
}

async function flushInternal() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  const store = usePosCommandQueueStore;
  let resolvedAny = false;

  while (true) {
    const state = store.getState();
    const now = Date.now();
    const next = [...state.commandQueueState.items]
      .filter((item) => (item.status === "queued" || item.status === "retry") && item.nextAttemptAt <= now)
      .sort((left, right) => left.createdAt - right.createdAt)[0];

    if (!next) {
      break;
    }

    state.markSending(next.commandId);

    try {
      const result = await postCommand(next);
      if (shouldRetry(result.status)) {
        const retryAfterMs = result.retryAfterMs ?? getRetryBackoffMs(next.retryCount);
        store.getState().markRetry(next.commandId, {
          retryAfterMs,
          message: result.message,
        });
        continue;
      }

      store.getState().resolve(next.commandId, {
        status: result.status,
        message: result.message,
        data: result.data,
      });
      await invalidateQueriesForScope(next.scope, activeQueryClient);
      resolvedAny = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Komut gonderimi başarısız.";
      store.getState().markRetry(next.commandId, {
        retryAfterMs: getRetryBackoffMs(next.retryCount),
        message,
      });
    }
  }

  store.getState().touchFlush();
  if (resolvedAny) {
    drainOnResolvedCallbacks();
  } else {
    onResolvedCallbacks = [];
  }
}

export function enqueuePosCommand(input: EnqueuePosCommandInput) {
  const commandId = input.commandId ?? crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? commandId;
  const result = usePosCommandQueueStore.getState().enqueue({
    commandId,
    idempotencyKey,
    type: input.type,
    payload: input.payload,
    scope: input.scope,
    optimistic: input.optimistic,
  });
  return {
    commandId: result.commandId,
    idempotencyKey,
    duplicate: result.duplicate,
  };
}

export function flushPosCommandQueue(options?: FlushQueueOptions) {
  if (options?.queryClient) {
    activeQueryClient = options.queryClient;
  }
  queueOnResolvedCallback(options?.onResolved);

  if (flushInFlight) {
    return flushInFlight;
  }
  flushInFlight = flushInternal().finally(() => {
    flushInFlight = null;
    activeQueryClient = undefined;
  });
  return flushInFlight;
}

export function hasPendingQueueItems(scope?: PosQueueScope) {
  const items = usePosCommandQueueStore.getState().commandQueueState.items;
  if (!scope) {
    return items.length > 0;
  }
  return items.some((item) => item.scope === scope);
}
