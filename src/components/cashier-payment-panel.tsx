"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { OrderItem } from "@/lib/types";

function buildSplitSummary(items: OrderItem[], selectedQuantities: number[]) {
  return items
    .map((item, index) => ({ item, quantity: selectedQuantities[index] ?? 0 }))
    .filter((row) => row.quantity > 0)
    .map((row) => `${row.quantity}x ${row.item.name}`)
    .join(", ");
}

export function CashierPaymentPanel({
  orderId,
  returnOrderId,
  defaultAmount,
  items,
  requestKey,
  action,
  onSubmit,
  submitIdleLabel = "Ödeme Al",
  submitPendingLabel = "Ödeme Isleniyor...",
  forcePending = false,
}: {
  orderId: string;
  returnOrderId?: string;
  defaultAmount: number;
  items: OrderItem[];
  requestKey?: string;
  action?: (formData: FormData) => void | Promise<void>;
  onSubmit?: (input: {
    orderId: string;
    returnOrderId?: string;
    requestKey: string;
    method: "cash" | "card" | "mixed";
    amount: number;
    note?: string;
  }) => void | Promise<void>;
  submitIdleLabel?: string;
  submitPendingLabel?: string;
  forcePending?: boolean;
}) {
  const [amount, setAmount] = useState(defaultAmount.toFixed(2));
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [selectedQuantities, setSelectedQuantities] = useState<number[]>(() => items.map(() => 0));
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const prevOrderIdRef = useRef(orderId);
  const prevDefaultAmountRef = useRef(defaultAmount);
  const resolvedRequestKey = useMemo(() => {
    if (requestKey) {
      return requestKey;
    }
    return `${orderId}-${crypto.randomUUID()}`;
  }, [orderId, requestKey]);

  const splitSummary = useMemo(() => buildSplitSummary(items, selectedQuantities), [items, selectedQuantities]);
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0;
  const remainingAfterPayment = Math.max(0, defaultAmount - safeAmount);

  useEffect(() => {
    const isOrderChanged = prevOrderIdRef.current !== orderId;
    const amountChanged = Math.abs(prevDefaultAmountRef.current - defaultAmount) > 0.009;

    if (isOrderChanged) {
      prevOrderIdRef.current = orderId;
      prevDefaultAmountRef.current = defaultAmount;
      setAmount(defaultAmount.toFixed(2));
      setNote("");
      setSelectedQuantities(items.map(() => 0));
      return;
    }

    if (amountChanged) {
      prevDefaultAmountRef.current = defaultAmount;
      setAmount(defaultAmount.toFixed(2));
      setNote("");
    }

    setSelectedQuantities((prev) => (prev.length === items.length ? prev : items.map(() => 0)));
  }, [defaultAmount, items, orderId]);

  function applySplit(splitCount: number) {
    const share = Math.max(0.01, defaultAmount / splitCount);
    setAmount(share.toFixed(2));
  }

  function updateSelectedQuantity(index: number, quantity: number) {
    setSelectedQuantities((prev) => {
      const next = [...prev];
      next[index] = quantity;
      return next;
    });
  }

  function applySelectedItems() {
    const selectedTotal = items.reduce((sum, item, index) => {
      const quantity = selectedQuantities[index] ?? 0;
      if (quantity <= 0) {
        return sum;
      }
      const unitPrice = Number(item.line_total) / Math.max(1, Number(item.quantity));
      return sum + unitPrice * quantity;
    }, 0);

    if (selectedTotal > 0) {
      setAmount(Math.min(defaultAmount, selectedTotal).toFixed(2));
    }
  }

  const finalNote = [note.trim(), splitSummary ? `split_items:${splitSummary}` : ""].filter(Boolean).join(" | ");
  const pending = forcePending || isClientSubmitting;

  async function handleClientSubmit(event: FormEvent<HTMLFormElement>) {
    if (!onSubmit) {
      return;
    }

    event.preventDefault();
    if (pending) {
      return;
    }

    setIsClientSubmitting(true);
    try {
      await onSubmit({
        orderId,
        returnOrderId,
        requestKey: resolvedRequestKey,
        method,
        amount: safeAmount,
        note: finalNote || undefined,
      });
    } finally {
      setIsClientSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Esit Paylastir</p>
              <p className="mt-1 text-sm text-slate-500">Tek dokunusta kisi basi tahsilat oluştur.</p>
            </div>
            <span className="rounded-full bg-[#fff2ee] px-3 py-1 text-xs font-semibold text-[#ff5a34]">Split Bill</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[2, 3, 4].map((splitCount) => (
              <button
                key={splitCount}
                type="button"
                onClick={() => applySplit(splitCount)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                {splitCount} Kisi
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500">
            <p>2 kisi: {(defaultAmount / 2).toFixed(2)} TL</p>
            <p>3 kisi: {(defaultAmount / 3).toFixed(2)} TL</p>
            <p>4 kisi: {(defaultAmount / 4).toFixed(2)} TL</p>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Hızlı Tutar</p>
              <p className="mt-1 text-sm text-slate-500">Kalan bakiyeden tek hamlede tutar sec.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Kalan {defaultAmount.toFixed(2)} TL
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: "Tamami", value: defaultAmount },
              { label: "Yarisi", value: defaultAmount / 2 },
              { label: "25%", value: defaultAmount * 0.25 },
              { label: "75%", value: defaultAmount * 0.75 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAmount(Math.max(0.01, preset.value).toFixed(2))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ürün Bazli Bol</p>
            <p className="mt-1 text-sm text-slate-500">Bu odemeye dahil olacak ürün miktarlarini sec.</p>
          </div>
          <button
            type="button"
            onClick={applySelectedItems}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 sm:w-auto"
          >
            Secilenleri Tutarla
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.product_id}-${index}`}
              className="grid items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 sm:grid-cols-[1fr_92px]"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} adet - {Number(item.line_total).toFixed(2)} TL
                </p>
              </div>
              <select
                value={selectedQuantities[index] ?? 0}
                onChange={(event) => updateSelectedQuantity(index, Number(event.target.value))}
                className="rounded-xl border border-slate-300 px-2 py-2 text-sm"
              >
                {Array.from({ length: item.quantity + 1 }, (_, value) => (
                  <option key={value} value={value}>
                    {value} adet
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {splitSummary ? <p className="mt-3 text-xs text-slate-500">Secilen: {splitSummary}</p> : null}
      </div>

      <form action={onSubmit ? undefined : action} onSubmit={handleClientSubmit} className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4">
        <input type="hidden" name="orderId" value={orderId} />
        {returnOrderId ? <input type="hidden" name="returnOrderId" value={returnOrderId} /> : null}
        <input type="hidden" name="requestKey" value={resolvedRequestKey} />
        <input type="hidden" name="note" value={finalNote} />
        <input type="hidden" name="method" value={method} />

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ödeme Tipi</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["cash", "Nakit"],
              ["card", "Kart"],
              ["mixed", "Karma"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value as "cash" | "card" | "mixed")}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  method === value
                    ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white shadow-[0_10px_20px_rgba(255,111,60,0.24)]"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-900"
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ödeme notu (opsiyonel)"
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
          />
        </div>

        <div className="grid gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
          <p className="flex items-center justify-between text-slate-700">
            <span>Bu islemin tutari</span>
            <span className="font-semibold">{safeAmount.toFixed(2)} TL</span>
          </p>
          <p className="flex items-center justify-between text-emerald-800">
            <span>İşlem sonrasi kalan</span>
            <span className="font-semibold">{remainingAfterPayment.toFixed(2)} TL</span>
          </p>
        </div>

        {onSubmit ? (
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? submitPendingLabel : submitIdleLabel}
          </button>
        ) : (
          <PendingSubmitButton
            idleLabel={submitIdleLabel}
            pendingLabel={submitPendingLabel}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(16,185,129,0.24)]"
          />
        )}
      </form>
    </div>
  );
}
