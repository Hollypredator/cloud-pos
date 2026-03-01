import { NextResponse } from "next/server";
import {
  getAlertDispatchByType,
  getOpsMetricsSnapshot,
  setAlertDispatch,
} from "@/lib/data";

async function evaluateOps() {
  const snapshot = await getOpsMetricsSnapshot();
  return {
    delayed: snapshot.delayedKitchenOrders,
    critical: snapshot.criticalKitchenOrders,
    openRequests: snapshot.openServiceRequests,
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
}

function misconfigured() {
  return NextResponse.json({ ok: false, message: "Alert secret tanimli degil." }, { status: 503 });
}

function checkSecret(request: Request) {
  const secret = process.env.ALERT_DISPATCH_SECRET;
  if (!secret) return null;
  const header = request.headers.get("x-alert-secret");
  return header === secret;
}

export async function GET(request: Request) {
  const secretValid = checkSecret(request);
  if (secretValid === null) {
    return misconfigured();
  }
  if (!secretValid) {
    return unauthorized();
  }

  const state = await evaluateOps();
  const shouldAlert = state.critical > 0 || state.delayed >= 3 || state.openRequests >= 5;
  return NextResponse.json({
    ok: true,
    shouldAlert,
    state,
  });
}

export async function POST(request: Request) {
  const secretValid = checkSecret(request);
  if (secretValid === null) {
    return misconfigured();
  }
  if (!secretValid) {
    return unauthorized();
  }

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, message: "ALERT_WEBHOOK_URL tanimli degil." },
      { status: 500 },
    );
  }

  const state = await evaluateOps();
  const shouldAlert = state.critical > 0 || state.delayed >= 3 || state.openRequests >= 5;
  if (!shouldAlert) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Esik asilmadi.", state });
  }

  const { dispatch } = await getAlertDispatchByType("ops_summary");
  const cooldownMs = 10 * 60 * 1000;
  if (dispatch) {
    const lastSentAt = new Date(dispatch.last_sent_at).getTime();
    if (Date.now() - lastSentAt < cooldownMs) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Cooldown aktif.", state });
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
    return NextResponse.json(
      { ok: false, message: "Webhook gonderimi basarisiz.", status: response.status },
      { status: 502 },
    );
  }

  await setAlertDispatch("ops_summary", payload);
  return NextResponse.json({ ok: true, sent: true, state });
}
