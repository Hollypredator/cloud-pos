"use client";

export function ReceiptPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
      type="button"
    >
      Yazdır
    </button>
  );
}

