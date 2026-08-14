"use client";

/**
 * Yerel yazici servisine (scripts/local-print-daemon.mjs) baglanan istemci.
 *
 * Servis kasa makinesinde 127.0.0.1:9100 uzerinde calisir. Internet gerekmez —
 * cevrimdisiyken de fis basar ve cekmece acilir.
 */

const DAEMON_BASE = process.env.NEXT_PUBLIC_PRINT_DAEMON_URL ?? "http://127.0.0.1:9100";
const REQUEST_TIMEOUT_MS = 6000;

export type ReceiptItem = {
  name: string;
  qty: number;
  lineTotal: number;
  modifiers?: string[];
};

export type ReceiptRequest = {
  businessName?: string;
  branchName?: string;
  cashierName?: string;
  orderNo?: string | null;
  customerName?: string | null;
  items: ReceiptItem[];
  subtotal?: number;
  discount?: number;
  total: number;
  paymentLabel?: string;
  footerNote?: string;
  printerIp?: string;
  /** Fis basildiktan sonra kasa cekmecesini de acar. */
  openDrawer?: boolean;
};

export type PrintOutcome = { ok: true } | { ok: false; error: string };

async function postToDaemon(path: string, body: unknown): Promise<PrintOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${DAEMON_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    // Servis yazici hatasini 502 ile bildirir. Basarisizligi sessizce yutmak,
    // kasiyerin fisin ciktigini sanmasina yol acar.
    if (!response.ok) {
      let error = `Yazıcı servisi hata döndürdü (HTTP ${response.status}).`;
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) error = data.error;
      } catch {}
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Yazıcı servisi yanıt vermedi (zaman aşımı)." };
    }
    return {
      ok: false,
      error: "Yerel yazıcı servisine ulaşılamadı. Servisin çalıştığından emin olun (npm run print:daemon).",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Fis basar. `openDrawer: true` ile ayni komutta cekmeceyi de acar. */
export function printReceipt(request: ReceiptRequest): Promise<PrintOutcome> {
  return postToDaemon("/print", request);
}

/** Yalnizca kasa cekmecesini acar (fis basmadan). */
export function openCashDrawer(printerIp?: string): Promise<PrintOutcome> {
  return postToDaemon("/drawer", { printerIp });
}

/** Servis ayakta mi? Ayarlar ekraninda durum gostermek icin. */
export async function checkPrintDaemon(): Promise<boolean> {
  try {
    const response = await fetch(`${DAEMON_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}
