"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBarcodeScanner } from "@/lib/client/use-barcode-scanner";

type CashierBarcodeCandidate = {
  id: string;
  check_number?: string | null;
};

function normalizeToken(value?: string | null) {
  return (value ?? "").trim().toLocaleLowerCase("tr");
}

export function CashierBarcodeListener({
  orders,
}: {
  orders: CashierBarcodeCandidate[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<{ tone: "neutral" | "success" | "error"; message: string }>({
    tone: "neutral",
    message: "Barkod modu aktif. Cihazdan okutulan kodu Enter ile tamamlayin.",
  });

  const candidates = useMemo(
    () =>
      orders.map((order) => ({
        id: order.id,
        id8: order.id.slice(0, 8).toLocaleLowerCase("tr"),
        checkNumber: normalizeToken(order.check_number),
      })),
    [orders],
  );

  useBarcodeScanner({
    enabled: true,
    minLength: 3,
    idleMs: 140,
    onScan: (raw) => {
      const token = normalizeToken(raw);
      if (!token) {
        return;
      }

      const byCheck = candidates.filter((candidate) => candidate.checkNumber && candidate.checkNumber === token);
      if (byCheck.length === 1) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("order", byCheck[0].id);
        router.replace(`${pathname}?${params.toString()}`);
        setStatus({ tone: "success", message: `Adisyon seçildi (check): ${raw}` });
        return;
      }
      if (byCheck.length > 1) {
        setStatus({ tone: "error", message: `Aynı check numarasinda birden fazla adısyon var: ${raw}` });
        return;
      }

      const byId = candidates.filter((candidate) => candidate.id8 === token || candidate.id.toLocaleLowerCase("tr").startsWith(token));
      if (byId.length === 1) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("order", byId[0].id);
        router.replace(`${pathname}?${params.toString()}`);
        setStatus({ tone: "success", message: `Adisyon seçildi (id): ${raw}` });
        return;
      }
      if (byId.length > 1) {
        setStatus({ tone: "error", message: `Kod birden fazla adısyona eslesti: ${raw}` });
        return;
      }

      setStatus({ tone: "error", message: `Adisyon bulunamadı: ${raw}` });
    },
  });

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        status.tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : status.tone === "error"
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {status.message}
    </div>
  );
}
