"use client";

import { useEffect, useState } from "react";

type OrderStatus = "pending" | "preparing" | "served" | "paid" | "cancelled" | "refunded";

type LatestOrder = {
  id: string;
  status: OrderStatus;
  totalPrice: number;
  finalPrice: number;
  createdAt: string;
  items: Array<{ productId: string; name: string; quantity: number }>;
};

function statusLabel(status: OrderStatus) {
  if (status === "pending") return "Siparis alindi";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "served") return "Servise hazir";
  if (status === "paid") return "Odeme tamamlandi";
  if (status === "cancelled") return "Iptal edildi";
  if (status === "refunded") return "Iade edildi";
  return status;
}

function statusClass(status: OrderStatus) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "paid") return "bg-slate-100 text-slate-700";
  return "bg-rose-100 text-rose-700";
}

export function OrderStatusWidget({
  businessSlug,
  qrCodeIdentifier,
}: {
  businessSlug?: string;
  qrCodeIdentifier: string;
}) {
  const [order, setOrder] = useState<LatestOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchLatest() {
      try {
        const response = await fetch(
          `/api/orders/latest?qr=${encodeURIComponent(qrCodeIdentifier)}${businessSlug ? `&b=${encodeURIComponent(businessSlug)}` : ""}`,
          {
          cache: "no-store",
          },
        );
        const data = (await response.json()) as { ok: boolean; order: LatestOrder | null };
        if (!mounted || !data.ok) return;
        setOrder(data.order);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchLatest();
    const timer = setInterval(fetchLatest, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [businessSlug, qrCodeIdentifier]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Siparis Durumu</h2>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Durum yukleniyor...</p>
      ) : !order ? (
        <p className="mt-2 text-sm text-slate-500">Bu masa icin aktif siparis bulunmuyor.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">#{order.id.slice(0, 8)}</p>
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
    { key: "served", label: "Servis" },
    { key: "paid", label: "Odeme" },
  ];
  const order = ["pending", "preparing", "served", "paid"] as const;
  const currentIdx = order.indexOf(status as (typeof order)[number]);

  return (
    <div className="mt-1 grid grid-cols-4 gap-2">
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
  if (status === "served" || status === "paid" || status === "cancelled" || status === "refunded") {
    return "0 dk";
  }
  const baseMinutes = status === "pending" ? 20 : 10;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const remaining = Math.max(1, baseMinutes - elapsedMinutes);
  return `${remaining} dk`;
}
