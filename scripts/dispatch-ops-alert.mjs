const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const endpoint = process.env.ALERT_DISPATCH_ENDPOINT || `${appUrl.replace(/\/$/, "")}/api/alerts/dispatch`;
const secret = process.env.ALERT_DISPATCH_SECRET || "";

async function run() {
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-alert-secret"] = secret;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[alerts:dispatch] failed (${response.status}) ${text}`);
    process.exit(1);
  }

  console.log(`[alerts:dispatch] success ${text}`);
}

run().catch((error) => {
  console.error("[alerts:dispatch] error", error);
  process.exit(1);
});
