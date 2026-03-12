const baseUrl = process.env.SYNTHETIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

if (!baseUrl) {
  console.error("SYNTHETIC_BASE_URL veya NEXT_PUBLIC_SITE_URL tanimli degil.");
  process.exit(1);
}

const targets = [
  { name: "health", path: "/api/health", timeoutMs: 5000 },
  { name: "ops", path: "/ops", timeoutMs: 7000 },
  { name: "delivery", path: "/delivery", timeoutMs: 7000 },
];

async function timedFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "cloud-pos-synthetic-check/1.0",
      },
    });
    const elapsedMs = Date.now() - startedAt;
    return { ok: response.ok, status: response.status, elapsedMs };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return { ok: false, status: 0, elapsedMs, error: error instanceof Error ? error.message : "unknown_error" };
  } finally {
    clearTimeout(timer);
  }
}

let hasFailure = false;

for (const target of targets) {
  const url = new URL(target.path, baseUrl).toString();
  const result = await timedFetch(url, target.timeoutMs);
  const statusText = result.ok ? "ok" : "fail";
  const detail = result.error ? ` error=${result.error}` : "";
  console.log(`[synthetic] target=${target.name} status=${statusText} code=${result.status} ms=${result.elapsedMs}${detail}`);
  if (!result.ok) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}
