"use client";

export type LivePosEventType =
  | "order_created"
  | "order_updated"
  | "order_paid"
  | "order_refunded"
  | "table_updated"
  | "kitchen_status_changed"
  | "heartbeat";

export type LivePosEvent = {
  type: LivePosEventType;
  sourceTable: string;
  sourceEvent: "INSERT" | "UPDATE" | "DELETE" | "POLL";
  at: number;
  orderId?: string;
  tableId?: string;
  status?: string;
  paymentType?: "sale" | "refund";
  payload?: Record<string, unknown>;
};

const LIVE_POS_EVENT_NAME = "pos:live-event";

export function emitLivePosEvent(event: LivePosEvent) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<LivePosEvent>(LIVE_POS_EVENT_NAME, { detail: event }));
}

export function addLivePosEventListener(listener: (event: LivePosEvent) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<LivePosEvent>).detail;
    if (!detail) {
      return;
    }
    listener(detail);
  };
  window.addEventListener(LIVE_POS_EVENT_NAME, handler);
  return () => window.removeEventListener(LIVE_POS_EVENT_NAME, handler);
}

