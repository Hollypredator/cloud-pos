"use client";

import { useMemo, useState } from "react";
import { formatOrderSourceLabel } from "@/lib/order-label";
import type { Order, OrderItem } from "@/lib/types";

type LayoutMode = "a4" | "thermal" | "thermal58";

type ReceiptPreviewLauncherProps = {
  order: Order;
  receiptLink: string;
  showShareLink?: boolean;
  compactButtons?: boolean;
};

function sourceLabel(order: Pick<Order, "channel" | "table_number" | "table_name" | "table_zone_name" | "customer_name">) {
  return formatOrderSourceLabel(order);
}

function orderRef(order: Pick<Order, "id" | "check_number">) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

export function ReceiptPreviewLauncher({
  order,
  receiptLink,
  showShareLink = true,
  compactButtons = false,
}: ReceiptPreviewLauncherProps) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>("a4");
  const [copied, setCopied] = useState(false);

  const totals = useMemo(() => {
    const subtotal = Number(order.total_price ?? 0);
    const discount = Number(order.discount_amount ?? 0);
    const service = Number(order.service_fee ?? 0);
    const final = Number(order.final_price ?? subtotal);
    const paid = Number(order.amount_paid ?? 0);
    const remaining = Number(order.remaining_balance ?? Math.max(0, final - paid));
    return { subtotal, discount, service, final, paid, remaining };
  }, [order]);

  const handlePrint = () => {
    const layoutClass =
      layout === "thermal58" ? "receipt-print-58" : layout === "thermal" ? "receipt-print-80" : "receipt-print-a4";
    const sizeValue = layout === "thermal58" ? "58mm" : layout === "thermal" ? "80mm" : "auto";
    const styleId = "receipt-print-style-force-launcher";
    
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    if (layout === "a4") {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: auto !important;
            margin: 8mm !important;
          }
        }
      `;
    } else {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: ${sizeValue} auto !important;
            margin: 0 !important;
          }
          html, body {
            width: ${sizeValue} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `;
    }

    const clear = () => {
      document.body.classList.remove("printing-inline-receipt", "receipt-print-a4", "receipt-print-80", "receipt-print-58");
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };

    clear();
    document.body.classList.add("printing-inline-receipt", layoutClass);
    window.addEventListener("afterprint", clear, { once: true });
    window.print();
    window.setTimeout(clear, 700);
  };

  const sheetClass =
    layout === "thermal58" ? "max-w-[280px]" : layout === "thermal" ? "max-w-[360px]" : "max-w-[760px]";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(receiptLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Adisyon linkini kopyalayin:", receiptLink);
    }
  };

  return (
    <>
      {showShareLink ? (
        <button
          type="button"
          onClick={handleCopyLink}
          className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
        >
          {copied ? "Link Kopyalandi" : "Linki Kopyala / Paylas"}
        </button>
      ) : null}
      <div className={`${showShareLink ? "mt-3" : "mt-0"} grid gap-2 sm:grid-cols-2`}>
        <button
          type="button"
          onClick={() => {
            setLayout("a4");
            setOpen(true);
          }}
          className={`rounded-2xl border border-slate-200 bg-white text-center font-semibold text-slate-700 ${
            compactButtons ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
          }`}
        >
          Adisyon Yazdır
        </button>
        <button
          type="button"
          onClick={() => {
            setLayout("thermal");
            setOpen(true);
          }}
          className={`rounded-2xl border border-slate-200 bg-white text-center font-semibold text-slate-700 ${
            compactButtons ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
          }`}
        >
          Fiş Yazdır
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-5xl overflow-auto rounded-none p-4 sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] sm:p-5">
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLayout("a4")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${layout === "a4" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>A4</button>
                <button type="button" onClick={() => setLayout("thermal")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${layout === "thermal" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>80mm</button>
                <button type="button" onClick={() => setLayout("thermal58")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${layout === "thermal58" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>58mm</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handlePrint} className="rounded-xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-3 py-2 text-xs font-semibold text-white">
                  {layout === "a4" ? "Yazdır / PDF" : "Yazdır"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Kapat</button>
              </div>
            </div>

            <main className={`receipt-inline-sheet mx-auto rounded-2xl border border-slate-200 bg-white p-4 ${sheetClass}`}>
              <header className="border-b border-slate-200 pb-3">
                <p className="text-2xl font-semibold tracking-tight text-slate-900">QUAPOS Cafe</p>
                <p className="text-sm text-slate-600">Adisyon</p>
                <p className="mt-1 text-sm text-slate-600">Sipariş #{orderRef(order)} - {sourceLabel(order)}</p>
                <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString("tr-TR")}</p>
              </header>

              <ul className="mt-3 space-y-2">
                {(order.items as OrderItem[]).map((item, index) => (
                  <li key={`${order.id}-${item.product_id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words text-slate-700">{item.quantity}x {item.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{Number(item.line_total).toFixed(2)} TL</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
                <p className="flex justify-between"><span>Ara Toplam</span><span>{totals.subtotal.toFixed(2)} TL</span></p>
                <p className="flex justify-between"><span>İndirim</span><span>-{totals.discount.toFixed(2)} TL</span></p>
                <p className="flex justify-between"><span>Servis Ucreti</span><span>+{totals.service.toFixed(2)} TL</span></p>
                <p className="flex justify-between text-base font-semibold text-slate-900"><span>Toplam</span><span>{totals.final.toFixed(2)} TL</span></p>
                <p className="flex justify-between text-emerald-700"><span>Ödenen</span><span>{totals.paid.toFixed(2)} TL</span></p>
                <p className="flex justify-between font-semibold text-[#ff5a34]"><span>Kalan</span><span>{totals.remaining.toFixed(2)} TL</span></p>
              </div>
            </main>
          </div>
        </div>
      ) : null}
    </>
  );
}
