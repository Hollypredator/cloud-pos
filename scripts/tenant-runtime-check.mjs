const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function callJson(path, init = {}) {
  const response = await fetch(`${appUrl}${path}`, init);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  return { response, payload, text };
}

function assertStatusOneOf(result, allowedStatuses, label) {
  if (!allowedStatuses.includes(result.response.status)) {
    throw new Error(
      `[tenant-runtime] ${label} status mismatch. expected=${allowedStatuses.join("|")} actual=${result.response.status} body=${result.text}`,
    );
  }
}

async function checkServerReachable() {
  try {
    const health = await callJson("/api/health");
    if (!health.response.ok) {
      throw new Error(`health status=${health.response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[tenant-runtime] Uygulamaya baglanilamadi (${appUrl}). Once uygulamayi calistirin veya CI icinde start adimi ekleyin. Detay: ${message}`,
    );
  }
}

async function run() {
  await checkServerReachable();

  const businessActive = await callJson("/api/business/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "default" }),
  });
  assertStatusOneOf(businessActive, [401], "business active unauthorized");

  const branchActive = await callJson("/api/branch/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId: "all" }),
  });
  assertStatusOneOf(branchActive, [401], "branch active unauthorized");

  const tableRequest = await callJson("/api/table-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessSlug: "default",
      qrCodeIdentifier: "table-1",
      accessToken: "invalid-token",
      requestType: "call_waiter",
    }),
  });
  assertStatusOneOf(tableRequest, [403, 503], "table requests token guard");

  const latestOrder = await callJson("/api/orders/latest?qr=table-1&b=default&t=invalid-token");
  assertStatusOneOf(latestOrder, [403, 503], "orders latest token guard");

  const orderHistory = await callJson("/api/orders/history?qr=table-1&b=default&t=invalid-token");
  assertStatusOneOf(orderHistory, [403, 503], "orders history token guard");

  console.log("[tenant-runtime] ok");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
