import { NextResponse } from "next/server";
import {
  getAlertDispatchByType,
  getOpsMetricsSnapshot,
  setAlertDispatch,
} from "@/lib/domains/finance";
import { getCorrelationId, logApiEvent, withCorrelationId } from "@/lib/observability";

async function evaluateOps() {
  const snapshot = await getOpsMetricsSnapshot();
  return {
    delayed: snapshot.delayedKitchenOrders,
    critical: snapshot.criticalKitchenOrders,
    openRequests: snapshot.openServiceRequests,
  };
}

function unauthorized(correlationId: string) {
  logApiEvent("warn", "alerts.dispatch.unauthorized", { correlationId });
  return withCorrelationId(NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 }), correlationId);
}

function misconfigured(correlationId: string) {
  logApiEvent("error", "alerts.dispatch.secret_missing", { correlationId });
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
    const state = await evaluateOps();
    const shouldAlert = state.critical > 0 || state.delayed >= 3 || state.openRequests >= 5;
    logApiEvent("info", "alerts.dispatch.preview", { correlationId, shouldAlert });
    return json({
      ok: true,
      shouldAlert,
      state,
    });
  } catch (error) {
    logApiEvent("error", "alerts.dispatch.preview_failed", {
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
      logApiEvent("error", "alerts.dispatch.webhook_missing", { correlationId });
      return json(
        { ok: false, message: "ALERT_WEBHOOK_URL tanımlı değil." },
        { status: 500 },
      );
    }

    const state = await evaluateOps();
    const shouldAlert = state.critical > 0 || state.delayed >= 3 || state.openRequests >= 5;
    if (!shouldAlert) {
      logApiEvent("info", "alerts.dispatch.skipped_threshold", { correlationId });
      return json({ ok: true, skipped: true, reason: "Eşik aşılmadı.", state });
    }

    const { dispatch } = await getAlertDispatchByType("ops_summary");
    const cooldownMs = 10 * 60 * 1000;
    if (dispatch) {
      const lastSentAt = new Date(dispatch.last_sent_at).getTime();
      if (Date.now() - lastSentAt < cooldownMs) {
        logApiEvent("info", "alerts.dispatch.skipped_cooldown", { correlationId });
        return json({ ok: true, skipped: true, reason: "Cooldown aktif.", state });
      }
    }

    const payload = {
      text: "Cloud POS Operasyon Alarmi",
      timestamp: new Date().toISOString(),
      state,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logApiEvent("error", "alerts.dispatch.webhook_failed", {
        correlationId,
        status: response.status,
      });
      return json(
        { ok: false, message: "Webhook günderimi başarısız.", status: response.status },
        { status: 502 },
      );
    }

    await setAlertDispatch("ops_summary", payload);
    logApiEvent("info", "alerts.dispatch.sent", { correlationId });
    return json({ ok: true, sent: true, state });
  } catch (error) {
    logApiEvent("error", "alerts.dispatch.unhandled", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ ok: false, message: "Alert dispatch sırasında beklenmeyen hata oluştu." }, { status: 500 });
  }
}
