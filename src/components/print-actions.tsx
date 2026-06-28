"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type PrintActionsProps = {
  baseHref: string;
};

export function PrintActions({ baseHref }: PrintActionsProps) {
  const searchParams = useSearchParams();
  const layoutParam = searchParams?.get("layout");
  const layout =
    layoutParam === "thermal" || layoutParam === "thermal58"
      ? layoutParam
      : "a4";
  const hideLogo = searchParams?.get("logo") === "0";

  useEffect(() => {
    if (typeof document === "undefined") return;

    const styleId = "receipt-print-style-force-global";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    // Clean body classes
    document.body.classList.remove("receipt-print-80", "receipt-print-58", "receipt-print-a4");

    if (layout === "thermal" || layout === "thermal58") {
      const sizeValue = layout === "thermal58" ? "58mm" : "80mm";
      document.body.classList.add(layout === "thermal58" ? "receipt-print-58" : "receipt-print-80");
      
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
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
    } else {
      document.body.classList.add("receipt-print-a4");
      if (styleEl) {
        styleEl.remove();
      }
    }

    return () => {
      document.body.classList.remove("receipt-print-80", "receipt-print-58", "receipt-print-a4");
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [layout]);

  return (
    <div className="no-print mt-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`${baseHref}?layout=a4${hideLogo ? "&logo=0" : ""}`}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            layout === "a4"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          A4 Adisyon
        </Link>
        <Link
          href={`${baseHref}?layout=thermal${hideLogo ? "&logo=0" : ""}`}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            layout === "thermal"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          80mm Fiş
        </Link>
        <Link
          href={`${baseHref}?layout=thermal58${hideLogo ? "&logo=0" : ""}`}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            layout === "thermal58"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          58mm Dar Fiş
        </Link>
        <Link
          href={`${baseHref}?layout=${layout}${hideLogo ? "" : "&logo=0"}`}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {hideLogo ? "Logo Aç" : "Logo Kapat"}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-2 text-sm font-semibold text-white"
          type="button"
        >
          {layout === "a4" ? "Yazdır / PDF" : "Yazdır"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Test yazicisi olmadan da bu sayfayi tarayicidan yazdırabilir veya PDF olarak kaydedebilirsin.
      </p>
    </div>
  );
}
