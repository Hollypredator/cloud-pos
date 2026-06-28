const OPS_CACHE_VERSION = "v9";
const OPS_NAV_CACHE = `ops-nav-${OPS_CACHE_VERSION}`;
const OPS_API_CACHE = `ops-api-${OPS_CACHE_VERSION}`;
const OPS_ASSET_CACHE = `ops-asset-${OPS_CACHE_VERSION}`;
const OPS_CACHE_PREFIX = "ops-";
const CURRENT_OPS_CACHES = new Set([OPS_NAV_CACHE, OPS_API_CACHE, OPS_ASSET_CACHE]);
const OPS_NAV_PREFIXES = [
  "/ops",
  "/tables",
  "/cashier",
  "/kitchen",
  "/delivery",
  "/service-requests",
  "/admin/orders",
  "/admin/tables",
  "/m",
];
const OPS_API_PATHS = new Set(["/api/app-shell", "/api/metrics/ops"]);
const STATIC_ASSET_PREFIXES = ["/_next/static/"];
const STATIC_ASSET_PATHS = new Set(["/favicon.ico", "/icon", "/manifest.webmanifest", "/manifest.json"]);

function isOpsPath(pathname) {
  return OPS_NAV_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isOpsApiPath(pathname) {
  if (OPS_API_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/api/admin/tables/") && pathname.endsWith("/history")) {
    return true;
  }

  if (pathname.startsWith("/api/admin/orders/") && pathname.endsWith("/receipt")) {
    return true;
  }

  return false;
}

function isStaticAssetPath(pathname, destination) {
  if (STATIC_ASSET_PATHS.has(pathname)) {
    return true;
  }

  if (STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return destination === "script" || destination === "style" || destination === "image" || destination === "font";
}

async function clearOpsCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(OPS_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

async function cleanupOldOpsCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(OPS_CACHE_PREFIX) && !CURRENT_OPS_CACHES.has(key))
      .map((key) => caches.delete(key)),
  );
}

async function putInCache(cache, request, response) {
  if (!response || !response.ok) {
    return;
  }

  try {
    await cache.put(request, response.clone());
  } catch {}
}

async function networkFirstNavigation(request, url) {
  const cache = await caches.open(OPS_NAV_CACHE);
  try {
    const networkResponse = await fetch(request);
    await putInCache(cache, request, networkResponse);
    return networkResponse;
  } catch {
    const cached = (await cache.match(request)) ?? (await cache.match(request, { ignoreSearch: true }));
    if (cached) {
      return cached;
    }

    const fallbackPath = url.pathname.startsWith("/m/") ? "/m/ops" : "/ops";
    const fallback = await cache.match(fallbackPath);
    if (fallback) {
      return fallback;
    }

    return new Response("Offline. Bağlantı gerekli.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      await putInCache(cache, request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  const contentType = cacheName === OPS_API_CACHE ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
  const body = cacheName === OPS_API_CACHE ? JSON.stringify({ error: "offline" }) : "offline";
  return new Response(body, { status: 503, headers: { "Content-Type": contentType } });
}

async function networkFirstApi(request) {
  const cache = await caches.open(OPS_API_CACHE);
  const noStoreRequest = new Request(request, { cache: "no-store" });

  try {
    const networkResponse = await fetch(noStoreRequest);
    await putInCache(cache, request, networkResponse);
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldOpsCaches();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" && isOpsPath(url.pathname)) {
    event.respondWith(networkFirstNavigation(request, url));
    return;
  }

  if (isOpsApiPath(url.pathname)) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (isStaticAssetPath(url.pathname, request.destination)) {
    event.respondWith(staleWhileRevalidate(request, OPS_ASSET_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "OPS_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }

  if (event.data?.type === "OPS_CLEAR_CACHES") {
    event.waitUntil(clearOpsCaches());
  }
});
