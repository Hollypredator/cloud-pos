"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { OrderItem } from "@/lib/types";

function triggerHaptic(pattern: number | number[] = 40) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic feedback failed", e);
    }
  }
}

function buildSplitSummary(items: OrderItem[], selectedQuantities: number[]) {
  return items
    .map((item, index) => ({ item, quantity: selectedQuantities[index] ?? 0 }))
    .filter((row) => row.quantity > 0)
    .map((row) => `${row.quantity}x ${row.item.name}`)
    .join(", ");
}

function VirtualNumpad({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const handlePress = (key: string) => {
    triggerHaptic(30);
    if (key === "DEL") {
      onChange(value.length > 1 ? value.slice(0, -1) : "0");
    } else if (key === ".") {
      if (!value.includes(".")) onChange(value + ".");
    } else {
      if (value === "0" || value === "0.00") onChange(key);
      else onChange(value + key);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePress(key)}
          className="min-h-[44px] rounded-xl border border-rose-100/50 bg-white py-3.5 text-lg font-bold text-rose-950 shadow-sm transition hover:bg-rose-50 active:bg-rose-100 cursor-pointer"
        >
          {key === "DEL" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
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
  submitPendingLabel = "Ödeme İşleniyor...",
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
    triggerHaptic([50, 30, 50]);
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
    <div className="space-y-4 rounded-3xl border border-rose-100 bg-[#FAF7F5]/30 p-4">
      <div className="grid gap-3">
        {/* Equal split tool */}
        <div className="rounded-2xl border border-rose-100/50 bg-white p-4">
          <div className="flex flex-col items-start gap-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Eşit Paylaştır</p>
            <p className="text-[10px] text-slate-500">Tek dokunuşta kişi başı tahsilat oluştur.</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[2, 3, 4].map((splitCount) => (
              <button
                key={splitCount}
                type="button"
                onClick={() => {
                  triggerHaptic(40);
                  applySplit(splitCount);
                }}
                className="min-h-[40px] rounded-xl border border-rose-100 bg-rose-50/10 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-rose-50 cursor-pointer"
              >
                {splitCount} Kişi
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[9px] font-bold text-slate-400">
            <span>2 kişi: {(defaultAmount / 2).toFixed(2)} TL</span>
            <span>3 kişi: {(defaultAmount / 3).toFixed(2)} TL</span>
            <span>4 kişi: {(defaultAmount / 4).toFixed(2)} TL</span>
          </div>
        </div>

        {/* Quick split options */}
        <div className="rounded-2xl border border-rose-100/50 bg-white p-4">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Hızlı Tutar</p>
              <p className="text-[10px] text-slate-500">Kalan bakiyeden oran seç.</p>
            </div>
            <span className="rounded-full bg-rose-900 text-white px-2.5 py-0.5 text-[9px] font-black font-mono">
              Kalan {defaultAmount.toFixed(2)} TL
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Tamamı", value: defaultAmount },
              { label: "Yarısı", value: defaultAmount / 2 },
              { label: "25%", value: defaultAmount * 0.25 },
              { label: "75%", value: defaultAmount * 0.75 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  triggerHaptic(40);
                  setAmount(Math.max(0.01, preset.value).toFixed(2));
                }}
                className="min-h-[40px] rounded-xl border border-rose-100 bg-rose-50/10 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-rose-50 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Item-based split */}
      <div className="rounded-2xl border border-rose-100/50 bg-white p-4">
        <div className="flex items-center justify-between gap-3 border-b border-rose-50 pb-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60">Ürün Bazlı Böl</p>
            <p className="text-[10px] text-slate-500">Ödemeye dahil olacak ürünleri seç.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(40);
              applySelectedItems();
            }}
            className="min-h-[36px] rounded-xl border border-rose-100 bg-rose-50/20 px-3 py-1.5 text-[10px] font-black text-rose-900 cursor-pointer hover:bg-rose-50"
          >
            Hesapla
          </button>
        </div>
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div
              key={`${item.product_id}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-rose-50/5 border border-rose-100/30 px-3 py-2"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">{item.name}</p>
                <p className="text-[9px] font-bold text-slate-400">
                  {item.quantity} adet - {Number(item.line_total).toFixed(2)} TL
                </p>
              </div>
              <select
                value={selectedQuantities[index] ?? 0}
                onChange={(event) => updateSelectedQuantity(index, Number(event.target.value))}
                className="min-h-[36px] rounded-lg border border-rose-150 bg-white px-2 py-1 text-xs font-semibold text-rose-950"
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
        {splitSummary ? <p className="mt-3 text-[9px] font-bold text-rose-800/80">Seçilen: {splitSummary}</p> : null}
      </div>

      {/* Main Payment Submit Form */}
      <form action={onSubmit ? undefined : action} onSubmit={handleClientSubmit} className="space-y-4 rounded-2xl border border-rose-100 bg-white p-4">
        <input type="hidden" name="orderId" value={orderId} />
        {returnOrderId ? <input type="hidden" name="returnOrderId" value={returnOrderId} /> : null}
        <input type="hidden" name="requestKey" value={resolvedRequestKey} />
        <input type="hidden" name="note" value={finalNote} />
        <input type="hidden" name="method" value={method} />

        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60 mb-2">Ödeme Tipi</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["cash", "Nakit"],
              ["card", "Kart"],
              ["mixed", "Karma"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  triggerHaptic(40);
                  setMethod(value as "cash" | "card" | "mixed");
                }}
                className={`min-h-[42px] rounded-xl text-xs font-black transition cursor-pointer ${
                  method === value
                    ? "bg-gradient-to-br from-rose-900 to-rose-800 text-white shadow-md shadow-rose-950/15"
                    : "border border-rose-100 bg-rose-50/10 text-rose-950 hover:bg-rose-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-900/60 mb-2">Tutar Girişi</p>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/5 p-3">
               <VirtualNumpad value={amount} onChange={setAmount} />
               <input type="hidden" name="amount" value={amount} />
            </div>
            
            <div className="space-y-3">
              <div className="rounded-2xl border border-rose-100 bg-white p-4 text-center shadow-sm">
                 <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tahsil Edilecek</p>
                 <div className="mt-1">
                   <span className="text-3xl font-black text-rose-950 font-mono break-all">{amount}</span>
                   <span className="ml-1 text-sm font-black text-rose-950/60">TL</span>
                 </div>
              </div>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ödeme notu (opsiyonel)"
                className="w-full rounded-2xl border border-rose-150 bg-white px-4 py-3 text-xs font-semibold text-rose-950 focus:border-rose-300 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-1.5 rounded-2xl bg-rose-50/30 border border-rose-100/50 px-4 py-3 text-xs">
          <p className="flex items-center justify-between text-rose-900/80 font-bold">
            <span>Bu işlemin tutarı</span>
            <span className="font-extrabold font-mono">{safeAmount.toFixed(2)} TL</span>
          </p>
          <p className="flex items-center justify-between text-rose-950 font-black pt-1.5 border-t border-rose-100/30">
            <span>Kalan bakiye</span>
            <span className="font-black font-mono">{remainingAfterPayment.toFixed(2)} TL</span>
          </p>
        </div>

        {onSubmit ? (
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] w-full rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-white text-xs font-black uppercase tracking-wider shadow-md disabled:cursor-not-allowed disabled:opacity-75 cursor-pointer"
          >
            {pending ? submitPendingLabel : submitIdleLabel}
          </button>
        ) : (
          <PendingSubmitButton
            idleLabel={submitIdleLabel}
            pendingLabel={submitPendingLabel}
            className="min-h-[44px] w-full rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-white text-xs font-black uppercase tracking-wider shadow-md cursor-pointer"
          />
        )}
      </form>
    </div>
  );
}
