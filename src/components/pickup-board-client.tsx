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

  const preparingNumberClass = "text-[clamp(1.2rem,2vw,2.2rem)]";
  const preparingLabelClass = "text-[clamp(0.7rem,1vw,1.1rem)]";
  const preparingCardClass = "rounded-[1.5rem] p-4 uupm-liquid-glass";

  const readyNumberClass = "text-[clamp(1.2rem,2.2vw,2.4rem)]";
  const readyLabelClass = "text-[clamp(0.7rem,1vw,1.1rem)]";
  const readyCardClass = "rounded-[1.5rem] p-4";

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

  const bandGlow = (ageMinutes: number) => {
    if (ageMinutes >= 10) return "uupm-glow-danger";
    if (ageMinutes >= 6) return "uupm-glow-warning";
    return "";
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2">
      <div className="flex min-h-0 flex-col border-r border-white/5 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-white/80" style={{ fontFamily: "var(--font-sora)" }}>
            Hazırlaniyor
          </h2>
          <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-rose-400">
            Preparing
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="grid h-full gap-3"
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
                  className={`${preparingCardClass} ${bandGlow(ageMinutes)} h-full`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className={`truncate font-black text-white ${preparingNumberClass}`}>
                      {resolveOrderNumber(order)}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${band.className}`}>
                      {band.label}
                    </span>
                  </div>
                  <div className={`truncate font-semibold text-white/70 ${preparingLabelClass}`}>
                    {resolveOrderLabel(order, "Sipariş Hazırlaniyor")}
                  </div>
                  <div className="mt-1.5 text-[11px] text-white/40">{ageMinutes} dk bekliyor</div>
                </div>
              );
            })}
          </div>
          {prioritizedPreparing.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-2xl font-medium text-white/20" style={{ fontFamily: "var(--font-sora)" }}>
                Henüz yeni sipariş yok...
              </p>
            </div>
          ) : null}
        </div>

        {preparingTotalPages > 1 ? (
          <div className="mt-4 text-right text-sm font-semibold text-white/30">
            {preparingPage + 1}/{preparingTotalPages}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col bg-[#0a0f1e] p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-400" style={{ fontFamily: "var(--font-sora)" }}>
            Afiyet Olsun!
          </h2>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400">
            Ready
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="grid h-full gap-3"
            style={{
              gridTemplateColumns: `repeat(${readyLayout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${readyLayout.rows}, minmax(0, 1fr))`,
            }}
          >
            {readyPageItems.map((order) => (
              <div
                key={order.id}
                className={`${readyCardClass} relative h-full overflow-hidden bg-[linear-gradient(135deg,rgba(16,185,129,0.12)_0%,rgba(5,150,105,0.06)_100%)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-emerald-500/25`}
              >
                <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                <div className={`mb-1.5 truncate font-black drop-shadow-[0_0_16px_rgba(16,185,129,0.35)] text-emerald-400 ${readyNumberClass}`}>
                  {resolveOrderNumber(order)}
                </div>
                <div className={`truncate font-bold text-white/80 ${readyLabelClass}`}>
                  {resolveOrderLabel(order, "Teslim Alabilirsiniz")}
                </div>
              </div>
            ))}
          </div>
          {ready.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-2xl font-medium text-white/15" style={{ fontFamily: "var(--font-sora)" }}>
                Bekleyen hazır sipariş yok.
              </p>
            </div>
          ) : null}
        </div>

        {readyTotalPages > 1 ? (
          <div className="mt-4 text-right text-sm font-semibold text-emerald-300/40">
            {readyPage + 1}/{readyTotalPages}
          </div>
        ) : null}
      </div>
    </div>
  );
}
