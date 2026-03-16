const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const endpoint =
  process.env.AUTO_SESSION_CLOSE_ENDPOINT || `${appUrl.replace(/\/$/, "")}/api/cashier/session/auto-close`;
const secret = process.env.AUTO_SESSION_CLOSE_SECRET || "";

async function run() {
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-auto-close-secret"] = secret;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[sessions:auto-close] failed (${response.status}) ${text}`);
    process.exit(1);
  }

  console.log(`[sessions:auto-close] success ${text}`);
}

run().catch((error) => {
  console.error("[sessions:auto-close] error", error);
  process.exit(1);
});
