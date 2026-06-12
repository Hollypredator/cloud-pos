"use client";

import Image from "next/image";
import { useState } from "react";

export function TableQrActions({
  tableNumber,
  tableName,
  qrTarget,
  qrImage,
  printHref,
}: {
  tableNumber: number;
  tableName: string;
  qrTarget: string;
  qrImage: string;
  printHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"preview" | "qr">("preview");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qrTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700"
      >
        QR Ac
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-0 py-0 sm:items-center sm:px-4 sm:py-8">
          <div className="w-full max-w-5xl rounded-none border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-[28px] sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Masa QR</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{tableName}</h3>
                <p className="mt-1 text-sm text-slate-500">Masa {tableNumber} için müşteri deneyimini ayni ekranda onizle.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 sm:w-auto"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setView("preview")}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                  view === "preview" ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                Sayfa Onizleme
              </button>
              <button
                type="button"
                onClick={() => setView("qr")}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                  view === "qr" ? "bg-[#ff5a34] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                QR Görseli
              </button>
            </div>

            {view === "preview" ? (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                <iframe
                  src={qrTarget}
                  title={`${tableName} QR onizleme`}
                  className="h-[560px] w-full bg-white"
                />
              </div>
            ) : (
              <div className="mt-5 flex justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6">
                <Image src={qrImage} alt={`${tableName} QR`} width={280} height={280} className="h-64 w-64 rounded-2xl object-cover" unoptimized />
              </div>
            )}

            <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">QR Hedef Linki</p>
              <p className="mt-2 break-all text-sm text-slate-700">{qrTarget}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
              >
                {copied ? "Link Kopyalandi" : "Linki Kopyala"}
              </button>
              <a
                href={qrImage}
                download={`masa-${tableNumber}-qr.png`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800"
              >
                QR Indir
              </a>
              <a
                href={printHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800"
              >
                Yazdir
              </a>
              <a
                href={qrTarget}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Yeni Sekmede Ac
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
