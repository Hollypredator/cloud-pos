"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type HistoryOrder = {
  id: string;
  checkNumber?: string | null;
  status: string;
  totalPrice: number;
  finalPrice: number;
  createdAt: string;
};

function orderRef(order: Pick<HistoryOrder, "id" | "checkNumber">) {
  return order.checkNumber?.trim() ? order.checkNumber : order.id.slice(0, 8);
}

export function OrderHistoryWidget({
  businessSlug,
  qrCodeIdentifier,
  qrAccessToken,
}: {
  businessSlug?: string;
  qrCodeIdentifier: string;
  qrAccessToken: string;
}) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const lastFetchedAtRef = useRef(0);

  const fetchHistory = useEffectEvent(async (force = false) => {
    if (inFlightRef.current) {
      return;
    }
    if (!force && Date.now() - lastFetchedAtRef.current < 1200) {
      return;
    }
    inFlightRef.current = true;
    try {
      const response = await fetch(
        `/api/orders/history?qr=${encodeURIComponent(qrCodeIdentifier)}${businessSlug ? `&b=${encodeURIComponent(businessSlug)}` : ""}&t=${encodeURIComponent(qrAccessToken)}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as { ok: boolean; orders: HistoryOrder[] };
      if (!data.ok) return;
      setOrders(data.orders);
      lastFetchedAtRef.current = Date.now();
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  });

  useEffect(() => {
    let active = true;

    async function syncHistory() {
      if (!active) {
        return;
      }
      await fetchHistory();
      if (!active) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(syncHistory, document.hidden ? 20000 : 10000);
    }

    function handleAttentionRefresh(event?: Event) {
      if (document.hidden) {
        return;
      }
      const detail = (event as CustomEvent<{ tables?: string[] }> | undefined)?.detail;
      if (detail && Array.isArray(detail.tables) && !detail.tables.includes("orders")) {
        return;
      }
      void fetchHistory(true);
    }

    void syncHistory();
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
      <h2 className="text-sm font-semibold text-slate-900">Son Sipariş Gecmisi</h2>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Geçmiş yukleniyor...</p>
      ) : orders.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Kayıt bulunmuyor.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">#{orderRef(order)}</span>
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
