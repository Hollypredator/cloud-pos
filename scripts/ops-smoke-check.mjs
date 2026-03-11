const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const alertSecret = process.env.ALERT_DISPATCH_SECRET || "";

async function checkJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  return { response, text, payload };
}

async function run() {
  const health = await checkJson(`${appUrl}/api/health`);
  if (!health.response.ok || !health.payload?.ok) {
    throw new Error(`health check failed (${health.response.status}) ${health.text}`);
  }

  if (alertSecret) {
    const alert = await checkJson(`${appUrl}/api/alerts/dispatch`, {
      method: "GET",
      headers: { "x-alert-secret": alertSecret },
    });
    if (!alert.response.ok || !alert.payload?.ok) {
      throw new Error(`alert check failed (${alert.response.status}) ${alert.text}`);
    }
  }

  console.log("[ops:smoke] ok");
}

run().catch((error) => {
  console.error("[ops:smoke] failed", error);
  process.exit(1);
});

