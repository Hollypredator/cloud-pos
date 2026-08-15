import { NextResponse } from "next/server";
import {
  getAlertDispatchByType,
  getStockRiskOverview,
  setAlertDispatch,
} from "@/lib/data";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

/**
 * Dusuk stok alarmi (CEO review D3.4).
 *
 * `/api/alerts/dispatch` (ops_summary) ile ayni desen: sirlanmis cron
 * cagrisi, webhook'a POST, cooldown ile spam onlenir. Yeni kanal kurulmadi —
 * ayni ALERT_WEBHOOK_URL / alert_dispatches altyapisi, farkli alert_type.
 */
async function evaluateStock() {
  const overview = await getStockRiskOverview();
  return {
    schemaReady: overview.schemaReady,
    lowStockCount: overview.lowStockRows.length,
    lowStockItems: overview.lowStockRows.map((row) => ({
      ingredientId: row.ingredientId,
      name: row.name,
      quantity: row.quantity,
      minQuantity: row.minQuantity,
      unit: row.unit,
      daysOfCover: row.daysOfCover,
    })),
  };
}

function unauthorized(correlationId: string) {
  logApiEvent("warn", "alerts.dispatch_stock.unauthorized", { correlationId });
  return withCorrelationId(NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 }), correlationId);
}

function misconfigured(correlationId: string) {
  logApiEvent("error", "alerts.dispatch_stock.secret_missing", { correlationId });
  return withCorrelationId(
    NextResponse.json({ ok: false, message: "Alert secret tanımlı değil." }, { status: 503 }),
    correlationId,
  );
}

function checkSecret(request: Request) {
  const secret = process.env.ALERT_DISPATCH_SECRET;
  if (!secret) return null;
  const header = request.headers.get("x-alert-secret");
  return header === secret;
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);

  const secretValid = checkSecret(request);
  if (secretValid === null) {
    return misconfigured(correlationId);
  }
  if (!secretValid) {
    return unauthorized(correlationId);
  }

  try {
    const state = await evaluateStock();
    const shouldAlert = state.schemaReady && state.lowStockCount > 0;
    logApiEvent("info", "alerts.dispatch_stock.preview", { correlationId, shouldAlert });
    return json({ ok: true, shouldAlert, state });
  } catch (error) {
    logApiEvent("error", "alerts.dispatch_stock.preview_failed", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Alert preview alinmadi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);
  const json = (body: unknown, init?: ResponseInit) =>
    withCorrelationId(NextResponse.json(body, init), correlationId);

  const secretValid = checkSecret(request);
  if (secretValid === null) {
    return misconfigured(correlationId);
  }
  if (!secretValid) {
    return unauthorized(correlationId);
  }

  try {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      logApiEvent("error", "alerts.dispatch_stock.webhook_missing", { correlationId });
      return json({ ok: false, message: "ALERT_WEBHOOK_URL tanımlı değil." }, { status: 500 });
    }

    const state = await evaluateStock();
    const shouldAlert = state.schemaReady && state.lowStockCount > 0;
    if (!shouldAlert) {
      logApiEvent("info", "alerts.dispatch_stock.skipped_threshold", { correlationId });
      return json({ ok: true, skipped: true, reason: "Düşük stok yok.", state });
    }

    const { dispatch } = await getAlertDispatchByType("low_stock");
    const cooldownMs = 60 * 60 * 1000;
    if (dispatch) {
      const lastSentAt = new Date(dispatch.last_sent_at).getTime();
      if (Date.now() - lastSentAt < cooldownMs) {
        logApiEvent("info", "alerts.dispatch_stock.skipped_cooldown", { correlationId });
        return json({ ok: true, skipped: true, reason: "Cooldown aktif.", state });
      }
    }

    const payload = {
      text: "QUAPOS Dusuk Stok Uyarisi",
      timestamp: new Date().toISOString(),
      state,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logApiEvent("error", "alerts.dispatch_stock.webhook_failed", { correlationId, status: response.status });
      return json({ ok: false, message: "Webhook günderimi başarısız.", status: response.status }, { status: 502 });
    }

    await setAlertDispatch("low_stock", payload);
    logApiEvent("info", "alerts.dispatch_stock.sent", { correlationId });
    return json({ ok: true, sent: true, state });
  } catch (error) {
    logApiEvent("error", "alerts.dispatch_stock.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Alert dispatch sırasında beklenmeyen hata oluştu." }, { status: 500 });
  }
}
