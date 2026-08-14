"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";
import {
  discardFailed,
  listFailed,
  onQueueChanged,
  retryFailed,
  type QueuedCommand,
} from "@/lib/offline-queue";

/**
 * Gonderilemeyen komutlarin paneli.
 *
 * Rozet yalnizca sayi gosteriyordu; kasiyer neyin takildigini goremiyor, kaydi
 * ne yeniden deneyebiliyor ne de kapatabiliyordu. Basarisiz bir odeme, kimsenin
 * bakmadigi bir sayidan ibaret kalirsa para sessizce kaybolur.
 */

const COMMAND_LABELS: Record<string, string> = {
  ORDER_CREATE: "Sipariş",
  PAYMENT_SALE_CASH: "Ödeme",
  ORDER_REFUND_CASH: "İade",
  ORDER_CANCEL: "Sipariş iptali",
};

function describe(command: QueuedCommand) {
  const label = COMMAND_LABELS[command.type] ?? command.type;
  const total = command.payload?.total_price;
  if (typeof total === "number") {
    return `${label} · ${total.toFixed(2)} TL`;
  }
  const method = command.payload?.method;
  if (typeof method === "string") {
    return `${label} · ${method === "cash" ? "Nakit" : method === "card" ? "Kart" : method}`;
  }
  return label;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("tr-TR");
}

export function OfflineQueuePanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<QueuedCommand[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    void listFailed()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    return onQueueChanged(refresh);
  }, [refresh]);

  return (
    <div className="border-b border-red-500/30 bg-red-950/40">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold text-red-200">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          Gönderilemeyen kayıtlar ({items.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Paneli kapat"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-white/50">Bekleyen sorunlu kayıt yok.</p>
      ) : (
        <ul className="space-y-2 px-4 pb-3">
          {items.map((command) => (
            <li
              key={command.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{describe(command)}</p>
                <p className="text-[11px] text-white/50">{formatTime(command.createdAt)}</p>
                {command.lastError ? (
                  <p className="mt-1 text-xs text-red-300">{command.lastError}</p>
                ) : null}
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busyId === command.id}
                  onClick={async () => {
                    if (command.id === undefined) return;
                    setBusyId(command.id);
                    await retryFailed(command.id);
                    setBusyId(null);
                    refresh();
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Tekrar dene
                </button>
                <button
                  type="button"
                  disabled={busyId === command.id}
                  onClick={async () => {
                    if (command.id === undefined) return;
                    setBusyId(command.id);
                    await discardFailed(command.id);
                    setBusyId(null);
                    refresh();
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/50 px-3 text-xs font-bold text-red-200 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
