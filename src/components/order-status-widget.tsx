"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "partially_paid"
  | "paid"
  | "partially_refunded"
  | "cancelled"
  | "refunded";

type LatestOrder = {
  id: string;
  checkNumber?: string | null;
  status: OrderStatus;
  totalPrice: number;
  finalPrice: number;
  createdAt: string;
  items: Array<{ productId: string; name: string; quantity: number }>;
};

function orderRef(order: Pick<LatestOrder, "id" | "checkNumber">) {
  return order.checkNumber?.trim() ? order.checkNumber : order.id.slice(0, 8);
}

function statusLabel(status: OrderStatus) {
  if (status === "pending") return "Siparis alindi";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "ready") return "Servise hazir";
  if (status === "served") return "Servise hazir";
  if (status === "partially_paid") return "Kismi odeme";
  if (status === "paid") return "Odeme tamamlandi";
  if (status === "partially_refunded") return "Kismi iade";
  if (status === "cancelled") return "Iptal edildi";
  if (status === "refunded") return "Iade edildi";
  return status;
}

function statusClass(status: OrderStatus) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "ready") return "bg-emerald-100 text-emerald-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "partially_paid") return "bg-blue-100 text-blue-700";
  if (status === "paid") return "bg-slate-100 text-slate-700";
  if (status === "partially_refunded") return "bg-rose-100 text-rose-700";
  return "bg-rose-100 text-rose-700";
}

export function OrderStatusWidget({
  businessSlug,
  qrCodeIdentifier,
  qrAccessToken,
}: {
  businessSlug?: string;
  qrCodeIdentifier: string;
  qrAccessToken: string;
}) {
  const [order, setOrder] = useState<LatestOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const lastFetchedAtRef = useRef(0);

  const fetchLatest = useEffectEvent(async (force = false) => {
    if (inFlightRef.current) {
      return;
    }
    if (!force && Date.now() - lastFetchedAtRef.current < 1200) {
      return;
    }
    inFlightRef.current = true;
    try {
      const response = await fetch(
        `/api/orders/latest?qr=${encodeURIComponent(qrCodeIdentifier)}${businessSlug ? `&b=${encodeURIComponent(businessSlug)}` : ""}&t=${encodeURIComponent(qrAccessToken)}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as { ok: boolean; order: LatestOrder | null };
      if (!data.ok) return;
      setOrder(data.order);
      lastFetchedAtRef.current = Date.now();
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  });

  useEffect(() => {
    let active = true;

    async function syncLatest() {
      if (!active) {
        return;
      }
      await fetchLatest();
      if (!active) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(syncLatest, document.hidden ? 15000 : 8000);
    }

    function handleAttentionRefresh(event?: Event) {
      if (document.hidden) {
        return;
      }
      const detail = (event as CustomEvent<{ tables?: string[] }> | undefined)?.detail;
      if (detail && Array.isArray(detail.tables) && !detail.tables.includes("orders")) {
        return;
      }
      void fetchLatest(true);
    }

    void syncLatest();
    window.addEventListener("focus", handleAttentionRefresh);
    document.addEventListener("visibilitychange", handleAttentionRefresh);
    window.addEventListener("live-ops:update", handleAttentionRefresh);

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      window.removeEventListener("focus", handleAttentionRefresh);
      document.removeEventListener("visibilitychange", handleAttentionRefresh);
      window.removeEventListener("live-ops:update", handleAttentionRefresh);
    };
  }, [businessSlug, qrCodeIdentifier, qrAccessToken]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Siparis Durumu</h2>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Durum yukleniyor...</p>
      ) : !order ? (
        <p className="mt-2 text-sm text-slate-500">Bu masa icin aktif siparis bulunmuyor.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-slate-900">#{orderRef(order)}</p>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusClass(order.status)}`}>
              {statusLabel(order.status)}
            </span>
          </div>
          <StatusTimeline status={order.status} />
          <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("tr-TR")}</p>
          <p className="text-xs text-slate-500">Tahmini kalan sure: {estimateEta(order.status, order.createdAt)}</p>
          <p className="text-sm text-slate-700">Toplam: {Number(order.finalPrice).toFixed(2)} TL</p>
        </div>
      )}
    </section>
  );
}

function StatusTimeline({ status }: { status: OrderStatus }) {
  const steps: Array<{ key: OrderStatus | "done"; label: string }> = [
    { key: "pending", label: "Alindi" },
    { key: "preparing", label: "Hazirlaniyor" },
    { key: "ready", label: "Hazir" },
    { key: "paid", label: "Odeme" },
  ];
  const timelineStatus: OrderStatus = status === "served" ? "ready" : status;
  const order = ["pending", "preparing", "ready", "paid"] as const;
  const currentIdx = order.indexOf(timelineStatus as (typeof order)[number]);

  return (
    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((step, idx) => {
        const done = currentIdx >= 0 && idx <= currentIdx;
        return (
          <div key={step.key} className={`rounded px-2 py-1 text-center text-[10px] ${done ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

function estimateEta(status: OrderStatus, createdAt: string) {
  if (
    status === "ready" ||
    status === "served" ||
    status === "paid" ||
    status === "partially_paid" ||
    status === "cancelled" ||
    status === "refunded" ||
    status === "partially_refunded"
  ) {
    return "0 dk";
  }
  const baseMinutes = status === "pending" ? 20 : 10;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const remaining = Math.max(1, baseMinutes - elapsedMinutes);
  return `${remaining} dk`;
}
