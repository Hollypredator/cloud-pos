"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";

type BoardLayout = {
  rows: number;
  cols: number;
  capacity: number;
};

const POLL_INTERVAL_MS = 2000;
const PAGE_ROTATE_INTERVAL_MS = 4500;
const BOARD_ROWS = 6;
const BOARD_COLS = 5;

function buildBoardLayout(): BoardLayout {
  return {
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    capacity: BOARD_ROWS * BOARD_COLS,
  };
}

function getPageSlice<T>(items: T[], page: number, capacity: number) {
  if (capacity <= 0 || items.length === 0) {
    return [] as T[];
  }
  const totalPages = Math.max(1, Math.ceil(items.length / capacity));
  const safePage = page % totalPages;
  const start = safePage * capacity;
  return items.slice(start, start + capacity);
}

function getOrderAgeMinutes(order: Order) {
  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
}

function getWaitBand(ageMinutes: number) {
  if (ageMinutes >= 10) {
    return { label: "Kirmizi", className: "border-rose-400/50 bg-rose-500/15 text-rose-200" };
  }
  if (ageMinutes >= 6) {
    return { label: "Sari", className: "border-amber-300/50 bg-amber-500/15 text-amber-100" };
  }
  return { label: "Yesil", className: "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" };
}

export function PickupBoardClient({
  initialPreparing,
  initialReady,
}: {
  initialPreparing: Order[];
  initialReady: Order[];
}) {
  const [preparing, setPreparing] = useState(initialPreparing);
  const [ready, setReady] = useState(initialReady);
  const [preparingPage, setPreparingPage] = useState(0);
  const [readyPage, setReadyPage] = useState(0);

  const resolveOrderLabel = (order: Order, fallback: string) => {
    const value = typeof order.customer_name === "string" ? order.customer_name.trim() : "";
    return value.length > 0 ? value : fallback;
  };

  const resolveOrderNumber = (order: Order) => {
    const checkNumber = typeof order.check_number === "string" ? order.check_number.trim() : "";
    if (checkNumber.length > 0) {
      return `#${checkNumber}`;
    }
    const short = order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    return `#${short || "----"}`;
  };

  const preparingLayout = useMemo(() => buildBoardLayout(), []);
  const readyLayout = useMemo(() => buildBoardLayout(), []);

  const prioritizedPreparing = useMemo(
    () => [...preparing].sort((a, b) => getOrderAgeMinutes(b) - getOrderAgeMinutes(a)),
    [preparing],
  );
  const preparingTotalPages = Math.max(1, Math.ceil(prioritizedPreparing.length / preparingLayout.capacity));
  const readyTotalPages = Math.max(1, Math.ceil(ready.length / readyLayout.capacity));
  const preparingPageItems = useMemo(
    () => getPageSlice(prioritizedPreparing, preparingPage, preparingLayout.capacity),
    [preparingLayout.capacity, preparingPage, prioritizedPreparing],
  );
  const readyPageItems = useMemo(
    () => getPageSlice(ready, readyPage, readyLayout.capacity),
    [ready, readyPage, readyLayout.capacity],
  );

  useEffect(() => {
    setPreparingPage((current) => (preparingTotalPages > 0 ? current % preparingTotalPages : 0));
  }, [preparingTotalPages]);

  useEffect(() => {
    setReadyPage((current) => (readyTotalPages > 0 ? current % readyTotalPages : 0));
  }, [readyTotalPages]);

  useEffect(() => {
    if (preparingTotalPages <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setPreparingPage((current) => (current + 1) % preparingTotalPages);
    }, PAGE_ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [preparingTotalPages]);

  useEffect(() => {
    if (readyTotalPages <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setReadyPage((current) => (current + 1) % readyTotalPages);
    }, PAGE_ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [readyTotalPages]);

  const preparingNumberClass = "text-[clamp(1rem,1.8vw,2rem)]";
  const preparingLabelClass = "text-[clamp(0.65rem,1vw,1rem)]";
  const preparingCardClass = "rounded-xl p-3";

  const readyNumberClass = "text-[clamp(1rem,2vw,2.2rem)]";
  const readyLabelClass = "text-[clamp(0.65rem,1vw,1rem)]";
  const readyCardClass = "rounded-xl p-3";

  useEffect(() => {
    let disposed = false;
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`/api/ops/pickup-snapshot?ts=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
        });
        if (!res.ok || disposed) {
          return;
        }
        const data = await res.json();
        if (disposed) {
          return;
        }
        setPreparing(Array.isArray(data.preparing) ? data.preparing : []);
        setReady(Array.isArray(data.ready) ? data.ready : []);
      } catch (error) {
        console.error("Failed to poll pickup snapshot", error);
      }
    };

    void fetchSnapshot();
    const interval = setInterval(async () => {
      void fetchSnapshot();
    }, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchSnapshot();
      }
    };
    const handleFocus = () => {
      void fetchSnapshot();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <div className="grid h-screen grid-cols-2">
      <div className="flex min-h-0 flex-col border-r border-white/5 bg-[#111114] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-slate-300">Hazirlaniyor</h2>
          <div className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-400">
            Preparing
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="grid h-full gap-2"
            style={{
              gridTemplateColumns: `repeat(${preparingLayout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${preparingLayout.rows}, minmax(0, 1fr))`,
            }}
          >
            {preparingPageItems.map((order) => {
              const ageMinutes = getOrderAgeMinutes(order);
              const band = getWaitBand(ageMinutes);
              return (
                <div
                  key={order.id}
                  className={`${preparingCardClass} h-full border border-white/5 bg-white/5 shadow-[0_6px_16px_rgba(0,0,0,0.2)]`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className={`truncate font-black text-white ${preparingNumberClass}`}>
                      {resolveOrderNumber(order)}
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${band.className}`}>
                      {band.label}
                    </span>
                  </div>
                  <div className={`truncate font-semibold text-slate-200 ${preparingLabelClass}`}>
                    {resolveOrderLabel(order, "Siparis Hazirlaniyor")}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{ageMinutes} dk bekliyor</div>
                </div>
              );
            })}
          </div>
          {prioritizedPreparing.length === 0 ? <div className="mt-12 text-2xl font-medium text-slate-600">Henuz yeni siparis yok...</div> : null}
        </div>

        {preparingTotalPages > 1 ? (
          <div className="mt-4 text-right text-sm font-semibold text-slate-500">
            {preparingPage + 1}/{preparingTotalPages}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col bg-[#0a0a0c] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-400">Afiyet Olsun!</h2>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400">
            Ready
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="grid h-full gap-2"
            style={{
              gridTemplateColumns: `repeat(${readyLayout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${readyLayout.rows}, minmax(0, 1fr))`,
            }}
          >
            {readyPageItems.map((order) => (
              <div
                key={order.id}
                className={`${readyCardClass} relative h-full overflow-hidden border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.1)_0%,rgba(5,150,105,0.05)_100%)] shadow-[0_10px_20px_rgba(16,185,129,0.15)]`}
              >
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" />
                <div className={`mb-1 truncate font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)] ${readyNumberClass}`}>
                  {resolveOrderNumber(order)}
                </div>
                <div className={`truncate font-bold text-white ${readyLabelClass}`}>
                  {resolveOrderLabel(order, "Teslim Alabilirsiniz")}
                </div>
              </div>
            ))}
          </div>
          {ready.length === 0 ? <div className="mt-12 text-2xl font-medium text-slate-700">Bekleyen hazir siparis yok.</div> : null}
        </div>

        {readyTotalPages > 1 ? (
          <div className="mt-4 text-right text-sm font-semibold text-emerald-300/70">
            {readyPage + 1}/{readyTotalPages}
          </div>
        ) : null}
      </div>
    </div>
  );
}
