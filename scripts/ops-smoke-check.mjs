const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const alertSecret = process.env.ALERT_DISPATCH_SECRET || "";
const autoSessionCloseSecret = process.env.AUTO_SESSION_CLOSE_SECRET || "";
const apiBudgetMs = Number(process.env.SMOKE_API_BUDGET_MS || 200);
const operationBudgetMs = Number(process.env.SMOKE_OPERATION_BUDGET_MS || 500);

async function checkJson(url, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  return { response, text, payload, elapsedMs: Date.now() - startedAt };
}

async function run() {
  const health = await checkJson(`${appUrl}/api/health`);
  if (!health.response.ok || !health.payload?.ok) {
    throw new Error(`health check failed (${health.response.status}) ${health.text}`);
  }
  if (health.elapsedMs > apiBudgetMs) {
    throw new Error(`health latency budget exceeded (${health.elapsedMs}ms > ${apiBudgetMs}ms)`);
  }

  if (alertSecret) {
    const alert = await checkJson(`${appUrl}/api/alerts/dispatch`, {
      method: "GET",
      headers: { "x-alert-secret": alertSecret },
    });
    if (!alert.response.ok || !alert.payload?.ok) {
      throw new Error(`alert check failed (${alert.response.status}) ${alert.text}`);
    }
    if (alert.elapsedMs > operationBudgetMs) {
      throw new Error(`alert latency budget exceeded (${alert.elapsedMs}ms > ${operationBudgetMs}ms)`);
    }
  }

  if (autoSessionCloseSecret) {
    const autoClose = await checkJson(`${appUrl}/api/cashier/session/auto-close`, {
      method: "GET",
      headers: { "x-auto-close-secret": autoSessionCloseSecret },
    });
    if (!autoClose.response.ok || !autoClose.payload?.ok) {
      throw new Error(`auto close check failed (${autoClose.response.status}) ${autoClose.text}`);
    }
    if (autoClose.elapsedMs > operationBudgetMs) {
      throw new Error(`auto close latency budget exceeded (${autoClose.elapsedMs}ms > ${operationBudgetMs}ms)`);
    }
  }

  console.log("[ops:smoke] ok");
}

run().catch((error) => {
  console.error("[ops:smoke] failed", error);
  process.exit(1);
});
