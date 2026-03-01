"use client";

import { useEffect, useState } from "react";

type HistoryOrder = {
  id: string;
  status: string;
  totalPrice: number;
  finalPrice: number;
  createdAt: string;
};

export function OrderHistoryWidget({
  businessSlug,
  qrCodeIdentifier,
}: {
  businessSlug?: string;
  qrCodeIdentifier: string;
}) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchHistory() {
      try {
        const response = await fetch(
          `/api/orders/history?qr=${encodeURIComponent(qrCodeIdentifier)}${businessSlug ? `&b=${encodeURIComponent(businessSlug)}` : ""}`,
          {
          cache: "no-store",
          },
        );
        const data = (await response.json()) as { ok: boolean; orders: HistoryOrder[] };
        if (!mounted || !data.ok) return;
        setOrders(data.orders);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchHistory();
    const timer = setInterval(fetchHistory, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [businessSlug, qrCodeIdentifier]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Son Siparis Gecmisi</h2>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Gecmis yukleniyor...</p>
      ) : orders.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Kayit bulunmuyor.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">#{order.id.slice(0, 8)}</span>
                <span className="uppercase text-slate-500">{order.status}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-600">
                <span>{new Date(order.createdAt).toLocaleString("tr-TR")}</span>
                <span>{Number(order.finalPrice).toFixed(2)} TL</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
