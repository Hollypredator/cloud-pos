"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readCustomerDisplaySnapshot,
  resolveCustomerDisplaySessionByPairCode,
  subscribeCustomerDisplay,
  type CustomerDisplaySessionRecord,
} from "@/lib/customer-display";
import type { CustomerDisplayConnectionState, CustomerDisplaySnapshot } from "@/lib/types";

const DISCONNECT_TIMEOUT_MS = 120000;
const ORDER_CREATED_CLEAR_MS = 4000;

function orderRef(snapshot: CustomerDisplaySnapshot | null) {
  if (!snapshot) {
    return null;
  }
  if (snapshot.checkNumber?.trim()) {
    return snapshot.checkNumber;
  }
  return null;
}

function statusLabel(status: CustomerDisplaySnapshot["status"]) {
  if (status === "submitting") return "Siparis Aliniyor";
  if (status === "created") return "Siparis Alindi";
  if (status === "error") return "Islem Hatasi";
  if (status === "composing") return "Siparis Hazirlaniyor";
  return "Hazir";
}

function resolveInitialCustomerDisplayState() {
  if (typeof window === "undefined") {
    return {
      pairCode: "",
      session: null as CustomerDisplaySessionRecord | null,
      snapshot: null as CustomerDisplaySnapshot | null,
      connectionState: "waiting" as CustomerDisplayConnectionState,
      lastUpdateAt: 0,
    };
  }
  const pairCode = new URLSearchParams(window.location.search).get("code") ?? "";
  if (!pairCode) {
    return {
      pairCode: "",
      session: null as CustomerDisplaySessionRecord | null,
      snapshot: null as CustomerDisplaySnapshot | null,
      connectionState: "waiting" as CustomerDisplayConnectionState,
      lastUpdateAt: 0,
    };
  }
  const session = resolveCustomerDisplaySessionByPairCode(pairCode);
  if (!session) {
    return {
      pairCode,
      session: null as CustomerDisplaySessionRecord | null,
      snapshot: null as CustomerDisplaySnapshot | null,
      connectionState: "waiting" as CustomerDisplayConnectionState,
      lastUpdateAt: 0,
    };
  }
  const snapshot = readCustomerDisplaySnapshot(session.sessionId);
  return {
    pairCode,
    session,
    snapshot,
    connectionState: snapshot ? ("connected" as CustomerDisplayConnectionState) : ("waiting" as CustomerDisplayConnectionState),
    lastUpdateAt: snapshot?.updatedAt ?? 0,
  };
}

export function CustomerDisplayClient() {
  const [initialState] = useState(resolveInitialCustomerDisplayState);
  const [pairCode, setPairCode] = useState(initialState.pairCode);
  const [session, setSession] = useState<CustomerDisplaySessionRecord | null>(initialState.session);
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot | null>(initialState.snapshot);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<CustomerDisplayConnectionState>(initialState.connectionState);
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(initialState.lastUpdateAt);

  useEffect(() => {
    if (!session) {
      return;
    }

    const unsubscribe = subscribeCustomerDisplay(session.sessionId, (event) => {
      if (event.type !== "snapshot" || !event.snapshot) {
        return;
      }
      setSnapshot(event.snapshot);
      setLastUpdateAt(event.snapshot.updatedAt);
      setConnectionState("connected");
    });

    return unsubscribe;
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const timer = setInterval(() => {
      if (!lastUpdateAt) {
        setConnectionState("waiting");
        return;
      }
      const delta = Date.now() - lastUpdateAt;
      if (delta > DISCONNECT_TIMEOUT_MS) {
        setConnectionState("disconnected");
      } else {
        setConnectionState("connected");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [lastUpdateAt, session]);

  useEffect(() => {
    if (!snapshot || snapshot.status !== "created") {
      return;
    }
    const createdSnapshotUpdatedAt = snapshot.updatedAt;
    const timer = window.setTimeout(() => {
      setSnapshot((current) => {
        if (!current || current.status !== "created" || current.updatedAt !== createdSnapshotUpdatedAt) {
          return current;
        }
        return {
          ...current,
          status: "idle",
          items: [],
          subtotal: 0,
          total: 0,
          orderId: null,
          checkNumber: null,
          message: "Yeni siparis icin hazir.",
        };
      });
    }, ORDER_CREATED_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  const orderNumber = useMemo(() => orderRef(snapshot), [snapshot]);
  const lineCount = useMemo(
    () => (snapshot ? snapshot.items.reduce((sum, item) => sum + item.quantity, 0) : 0),
    [snapshot],
  );

  function connectWithPairCode() {
    const nextSession = resolveCustomerDisplaySessionByPairCode(pairCode);
    if (!nextSession) {
      setError("Eslesme kodu bulunamadi ya da suresi doldu.");
      setSession(null);
      setSnapshot(null);
      setConnectionState("waiting");
      return;
    }
    setError(null);
    setSession(nextSession);
    const initialSnapshot = readCustomerDisplaySnapshot(nextSession.sessionId);
    if (initialSnapshot) {
      setSnapshot(initialSnapshot);
      setLastUpdateAt(initialSnapshot.updatedAt);
      setConnectionState("connected");
    } else {
      setSnapshot(null);
      setConnectionState("waiting");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1f2937_0%,#0b1220_42%,#050812_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Musteri Ekrani</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Self-Servis Siparis Takip</h1>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
              connectionState === "connected"
                ? "bg-emerald-500/20 text-emerald-200"
                : connectionState === "disconnected"
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-slate-500/20 text-slate-200"
            }`}
          >
            {connectionState === "connected"
              ? "Bagli"
              : connectionState === "disconnected"
                ? "Baglanti Koptu"
                : "Bekleniyor"}
          </span>
        </header>

        {!session ? (
          <section className="mx-auto mt-12 w-full max-w-[520px] rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Kasiyer ekranindaki 6 haneli eslesme kodunu girin.</p>
            <div className="mt-4 flex gap-2">
              <input
                value={pairCode}
                onChange={(event) => setPairCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="h-12 flex-1 rounded-2xl border border-white/20 bg-slate-900/70 px-4 text-lg tracking-[0.24em] text-white"
              />
              <button
                type="button"
                onClick={connectWithPairCode}
                className="h-12 rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900"
              >
                Baglan
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          </section>
        ) : (
          <section className="mt-6 grid flex-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Siparis Detaylari</h2>
                <span className="rounded-full bg-slate-800/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200">
                  {snapshot ? statusLabel(snapshot.status) : "Bekleniyor"}
                </span>
              </div>
              {snapshot?.items.length ? (
                <ul className="mt-4 space-y-3">
                  {snapshot.items.map((item) => (
                    <li key={item.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                      <p className="text-lg font-medium">
                        {item.quantity}x {item.name}
                      </p>
                      <p className="text-lg font-semibold">{item.lineTotal.toFixed(2)} TL</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-slate-950/20 px-4 py-6 text-sm text-slate-300">
                  Kasiyer urun ekledikce siparis detaylari burada gorunecek.
                </div>
              )}
            </article>

            <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="rounded-2xl bg-slate-900/50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Toplam Kalem</p>
                <p className="mt-2 text-3xl font-semibold">{lineCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Ara Toplam</p>
                <p className="mt-2 text-3xl font-semibold">{Number(snapshot?.subtotal ?? 0).toFixed(2)} TL</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/20 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-100">Toplam</p>
                <p className="mt-2 text-4xl font-semibold text-emerald-100">{Number(snapshot?.total ?? 0).toFixed(2)} TL</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Siparis Numarasi</p>
                <p className="mt-2 text-4xl font-black tracking-[0.08em] text-white">{orderNumber ? `#${orderNumber}` : "--"}</p>
                <p className="mt-2 text-xs text-slate-300">{snapshot?.message ?? "Siparis onayi bekleniyor."}</p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
