"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { CashierPaymentPanel } from "@/components/cashier-payment-panel";
import { enqueuePosCommand, flushPosCommandQueue } from "@/lib/pos/queue/engine";
import { usePosCommandQueueStore } from "@/lib/pos/queue/store";
import type { OrderItem, PaymentMethod } from "@/lib/types";

let queuedRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let lastQueuedRefreshAt = 0;

function queueSoftRefresh(router: { refresh: () => void }, debounceMs = 140, minIntervalMs = 900) {
  const elapsed = Date.now() - lastQueuedRefreshAt;
  const waitMs = Math.max(debounceMs, minIntervalMs - elapsed);
  if (queuedRefreshTimer) {
    clearTimeout(queuedRefreshTimer);
  }
  queuedRefreshTimer = setTimeout(() => {
    queuedRefreshTimer = null;
    lastQueuedRefreshAt = Date.now();
    router.refresh();
  }, waitMs);
}

function toNumber(input: FormDataEntryValue | null, fallback = 0) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function useTrackedCommandResult(commandId: string | null, onResolve: (status: "ACK" | "CONFLICT" | "REJECT", message?: string) => void) {
  const result = usePosCommandQueueStore((state) => state.commandQueueState.lastResult);

  useEffect(() => {
    if (!commandId || !result || result.commandId !== commandId) {
      return;
    }
    if (result.status === "ACK" || result.status === "CONFLICT" || result.status === "REJECT") {
      onResolve(result.status, result.message);
    }
  }, [commandId, onResolve, result]);
}

export function CashierPaymentQueuePanel({
  orderId,
  returnOrderId,
  defaultAmount,
  items,
}: {
  orderId: string;
  returnOrderId?: string;
  defaultAmount: number;
  items: OrderItem[];
}) {
  const router = useRouter();
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) =>
        item.scope === "cashier" &&
        item.type === "PAYMENT_SALE_CASH" &&
        typeof item.payload.order_id === "string" &&
        item.payload.order_id === orderId,
    ),
  );

  useTrackedCommandResult(trackedCommandId, (status, message) => {
    if (status === "ACK") {
      toast.success("Odeme kaydedildi.");
    } else {
      toast.error(message ?? "Odeme alinamadi.");
    }
    queueSoftRefresh(router);
    setTrackedCommandId(null);
  });

  return (
    <CashierPaymentPanel
      orderId={orderId}
      returnOrderId={returnOrderId}
      defaultAmount={defaultAmount}
      items={items}
      forcePending={pending}
      onSubmit={async (payload) => {
        const amount = Math.max(0, payload.amount);
        const nextStatus = amount >= Math.max(0, defaultAmount - 0.009) ? "paid" : "partially_paid";
        const queued = enqueuePosCommand({
          scope: "cashier",
          type: "PAYMENT_SALE_CASH",
          idempotencyKey: payload.requestKey,
          payload: {
            order_id: payload.orderId,
            method: payload.method,
            amount,
            note: payload.note,
          },
          optimistic: {
            cashier: {
              orderId: payload.orderId,
              apply: {
                status: nextStatus,
                amountPaidDelta: amount,
                remainingDelta: -amount,
              },
            },
          },
        });
        setTrackedCommandId(queued.commandId);
        toast.success("Odeme kuyruga alindi.");
        void flushPosCommandQueue({
          onResolved: () => queueSoftRefresh(router),
        });
      }}
    />
  );
}

export function CashierFinancialsQueueForm({
  orderId,
  returnOrderId,
  defaultDiscountAmount,
  defaultServiceFee,
  className,
}: {
  orderId: string;
  returnOrderId?: string;
  defaultDiscountAmount: number;
  defaultServiceFee: number;
  className: string;
}) {
  const router = useRouter();
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) =>
        item.scope === "cashier" &&
        item.type === "ORDER_FINANCIALS_SET" &&
        typeof item.payload.order_id === "string" &&
        item.payload.order_id === orderId,
    ),
  );

  useTrackedCommandResult(trackedCommandId, (status, message) => {
    if (status === "ACK") {
      toast.success("Finans guncellendi.");
    } else {
      toast.error(message ?? "Finans guncellenemedi.");
    }
    queueSoftRefresh(router);
    setTrackedCommandId(null);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const discountAmount = Math.max(0, toNumber(formData.get("discountAmount"), 0));
    const serviceFee = Math.max(0, toNumber(formData.get("serviceFee"), 0));
    const queued = enqueuePosCommand({
      scope: "cashier",
      type: "ORDER_FINANCIALS_SET",
      payload: {
        order_id: orderId,
        discount_amount: discountAmount,
        service_fee: serviceFee,
      },
      optimistic: {
        cashier: {
          orderId,
          apply: {
            discountAmount,
            serviceFee,
          },
        },
      },
    });
    setTrackedCommandId(queued.commandId);
    toast.success("Finans komutu kuyruga alindi.");
    void flushPosCommandQueue({
      onResolved: () => queueSoftRefresh(router),
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="orderId" value={orderId} />
      <input
        name="discountAmount"
        type="number"
        min="0"
        step="0.01"
        defaultValue={defaultDiscountAmount}
        placeholder="Indirim"
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
      />
      <input
        name="serviceFee"
        type="number"
        min="0"
        step="0.01"
        defaultValue={defaultServiceFee}
        placeholder="Servis"
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Isleniyor..." : "Finans Güncelle"}
      </button>
    </form>
  );
}

export function CashierCancelOrderQueueForm({
  orderId,
  returnOrderId,
  className,
  id,
}: {
  orderId: string;
  returnOrderId?: string;
  className: string;
  id?: string;
}) {
  const router = useRouter();
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) =>
        item.scope === "cashier" &&
        item.type === "ORDER_CANCEL" &&
        typeof item.payload.order_id === "string" &&
        item.payload.order_id === orderId,
    ),
  );

  useTrackedCommandResult(trackedCommandId, (status, message) => {
    if (status === "ACK") {
      toast.success("Siparis iptal edildi.");
    } else {
      toast.error(message ?? "Siparis iptal edilemedi.");
    }
    queueSoftRefresh(router);
    setTrackedCommandId(null);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const note = formData.get("note");
    const queued = enqueuePosCommand({
      scope: "cashier",
      type: "ORDER_CANCEL",
      payload: {
        order_id: orderId,
        note: typeof note === "string" ? note : undefined,
      },
      optimistic: {
        cashier: {
          orderId,
          apply: {
            status: "cancelled",
          },
        },
      },
    });
    setTrackedCommandId(queued.commandId);
    toast.success("Iptal komutu kuyruga alindi.");
    void flushPosCommandQueue({
      onResolved: () => queueSoftRefresh(router),
    });
  }

  return (
    <form id={id} onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="orderId" value={orderId} />
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Adisyon Iptal</p>
      <input
        name="note"
        placeholder="Iptal nedeni"
        className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Isleniyor..." : "Iptal"}
      </button>
    </form>
  );
}

export function CashierOrderItemCancelQueueButton({
  orderId,
  returnOrderId,
  productId,
  className,
}: {
  orderId: string;
  returnOrderId?: string;
  productId: string;
  className: string;
}) {
  const router = useRouter();
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) =>
        item.scope === "cashier" &&
        item.type === "ORDER_ITEM_CANCEL" &&
        typeof item.payload.order_id === "string" &&
        item.payload.order_id === orderId &&
        typeof item.payload.product_id === "string" &&
        item.payload.product_id === productId,
    ),
  );

  useTrackedCommandResult(trackedCommandId, (status, message) => {
    if (status === "ACK") {
      toast.success("Urun islemi kaydedildi.");
    } else {
      toast.error(message ?? "Urun iptal edilemedi.");
    }
    queueSoftRefresh(router);
    setTrackedCommandId(null);
  });

  function handleClick() {
    if (pending) {
      return;
    }

    const queued = enqueuePosCommand({
      scope: "cashier",
      type: "ORDER_ITEM_CANCEL",
      payload: {
        order_id: orderId,
        product_id: productId,
      },
    });
    setTrackedCommandId(queued.commandId);
    toast.success("Urun komutu kuyruga alindi.");
    void flushPosCommandQueue({
      onResolved: () => queueSoftRefresh(router),
    });
  }

  return (
    <button type="button" title="Urunu dus veya iptal et" onClick={handleClick} disabled={pending} className={className}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
      </svg>
    </button>
  );
}

export function CashierRefundQueueForm({
  orderId,
  returnOrderId,
  defaultAmount,
  className,
}: {
  orderId: string;
  returnOrderId?: string;
  defaultAmount: number;
  className: string;
}) {
  const router = useRouter();
  const [trackedCommandId, setTrackedCommandId] = useState<string | null>(null);
  const pending = usePosCommandQueueStore((state) =>
    state.commandQueueState.items.some(
      (item) =>
        item.scope === "cashier" &&
        item.type === "ORDER_REFUND_CASH" &&
        typeof item.payload.order_id === "string" &&
        item.payload.order_id === orderId,
    ),
  );

  useTrackedCommandResult(trackedCommandId, (status, message) => {
    if (status === "ACK") {
      toast.success("Iade islemi kaydedildi.");
    } else {
      toast.error(message ?? "Iade tamamlanamadi.");
    }
    queueSoftRefresh(router);
    setTrackedCommandId(null);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const methodValue = formData.get("method");
    const amount = Math.max(0, toNumber(formData.get("amount"), defaultAmount));
    const note = formData.get("note");
    const method = methodValue === "card" || methodValue === "mixed" ? methodValue : "cash";

    const queued = enqueuePosCommand({
      scope: "cashier",
      type: "ORDER_REFUND_CASH",
      payload: {
        order_id: orderId,
        method: method as PaymentMethod,
        amount,
        note: typeof note === "string" ? note : undefined,
      },
      optimistic: {
        cashier: {
          orderId,
          apply: {
            status: "partially_refunded",
            amountPaidDelta: -amount,
            remainingDelta: amount,
          },
        },
      },
    });
    setTrackedCommandId(queued.commandId);
    toast.success("Iade komutu kuyruga alindi.");
    void flushPosCommandQueue({
      onResolved: () => queueSoftRefresh(router),
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="orderId" value={orderId} />
      <select name="method" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="cash">Nakit</option>
        <option value="card">Kart</option>
        <option value="mixed">Karma</option>
      </select>
      <input
        name="amount"
        type="number"
        min="0"
        step="0.01"
        defaultValue={defaultAmount}
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
      />
      <input
        name="note"
        placeholder="Iade notu"
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Isleniyor..." : "Iade Baslat"}
      </button>
    </form>
  );
}
