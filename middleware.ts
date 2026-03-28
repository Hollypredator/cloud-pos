import { NextResponse, type NextRequest } from "next/server";
import { withCorrelationId } from "@/lib/observability";

type RateLimitRule = {
  prefix: string;
  windowMs: number;
  max: number;
};

type RateLimitStore = Map<string, number[]>;
type RateLimitMeta = {
  requestCount: number;
};

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { prefix: "/auth/login", windowMs: 60_000, max: 15 },
  { prefix: "/api/orders", windowMs: 60_000, max: 40 },
  { prefix: "/api/orders/latest", windowMs: 60_000, max: 80 },
  { prefix: "/api/orders/history", windowMs: 60_000, max: 80 },
  { prefix: "/api/table-requests", windowMs: 60_000, max: 30 },
  { prefix: "/api/alerts/dispatch", windowMs: 60_000, max: 12 },
  { prefix: "/api/metrics/ops", windowMs: 60_000, max: 60 },
  { prefix: "/api/reports/sales.csv", windowMs: 60_000, max: 20 },
  { prefix: "/api/health", windowMs: 60_000, max: 120 },
];
const MAX_RATE_LIMIT_WINDOW_MS = Math.max(...RATE_LIMIT_RULES.map((rule) => rule.windowMs));
const RATE_LIMIT_SWEEP_INTERVAL = 200;

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "connect-src 'self' https: wss:",
  ].join("; "));
  return response;
}

function withSecurityAndCorrelation(response: NextResponse, correlationId: string) {
  return withCorrelationId(applySecurityHeaders(response), correlationId);
}

function getRateLimitStore() {
  const scope = globalThis as typeof globalThis & {
    __posRateLimitStore?: RateLimitStore;
    __posRateLimitMeta?: RateLimitMeta;
  };
  if (!scope.__posRateLimitStore) {
    scope.__posRateLimitStore = new Map<string, number[]>();
  }
  if (!scope.__posRateLimitMeta) {
    scope.__posRateLimitMeta = { requestCount: 0 };
  }
  return { store: scope.__posRateLimitStore, meta: scope.__posRateLimitMeta };
}

function sweepRateLimitStore(store: RateLimitStore, now: number) {
  const keepAfter = now - MAX_RATE_LIMIT_WINDOW_MS;
  for (const [key, hits] of store.entries()) {
    const kept = hits.filter((timestamp) => timestamp >= keepAfter);
    if (kept.length === 0) {
      store.delete(key);
      continue;
    }
    if (kept.length !== hits.length) {
      store.set(key, kept);
    }
  }
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(request: NextRequest, correlationId: string) {
  const pathname = request.nextUrl.pathname;
  const matchedRule = RATE_LIMIT_RULES.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
  if (!matchedRule) {
    return null;
  }

  const now = Date.now();
  const windowStart = now - matchedRule.windowMs;
  const key = `${matchedRule.prefix}:${getClientIp(request)}`;
  const { store, meta } = getRateLimitStore();
  meta.requestCount += 1;
  if (meta.requestCount % RATE_LIMIT_SWEEP_INTERVAL === 0) {
    sweepRateLimitStore(store, now);
  }
  const existingHits = store.get(key) ?? [];
  const validHits = existingHits.filter((timestamp) => timestamp >= windowStart);
  validHits.push(now);
  store.set(key, validHits);

  if (validHits.length <= matchedRule.max) {
    return null;
  }

  if (pathname === "/auth/login" || pathname.startsWith("/auth/login/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "Çok fazla giriş denemesi. Lütfen 1 dakika bekleyip tekrar deneyin.");
    return withSecurityAndCorrelation(NextResponse.redirect(redirectUrl), correlationId);
  }

  return withSecurityAndCorrelation(
    NextResponse.json(
      { ok: false, message: "Çok fazla istek gönderildi. Lütfen kısa bir süre sonra tekrar deneyin." },
      { status: 429 },
    ),
    correlationId,
  );
}

function normalizeHost(host: string | null) {
  return (host ?? "").toLowerCase().split(":")[0];
}

function withHostRouting(request: NextRequest, correlationId: string) {
  const studioHost = normalizeHost(process.env.STUDIO_HOST ?? null);
  const appHost = normalizeHost(process.env.APP_HOST ?? null);
  const currentHost = normalizeHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  if (studioHost && currentHost === studioHost) {
    if (pathname === "/") {
      return withSecurityAndCorrelation(NextResponse.redirect(new URL("/studio", request.url)), correlationId);
    }
    if (pathname === "/login") {
      return withSecurityAndCorrelation(NextResponse.redirect(new URL("/studio/login", request.url)), correlationId);
    }
  }

  if (appHost && currentHost === appHost) {
    if (pathname === "/studio") {
      return withSecurityAndCorrelation(NextResponse.redirect(new URL("/", request.url)), correlationId);
    }
  }

  return null;
}

function withLegacyMobilePathRedirect(request: NextRequest, correlationId: string) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/m") {
    return withSecurityAndCorrelation(NextResponse.redirect(new URL(`/ops${search}`, request.url)), correlationId);
  }
  if (!pathname.startsWith("/m/")) {
    return null;
  }

  const targetPath = pathname.slice(2);
  const normalizedPath = targetPath && targetPath !== "/" ? targetPath : "/ops";
  return withSecurityAndCorrelation(
    NextResponse.redirect(new URL(`${normalizedPath}${search}`, request.url)),
    correlationId,
  );
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const correlationId =
    requestHeaders.get("x-correlation-id") ?? requestHeaders.get("x-request-id") ?? crypto.randomUUID();
  requestHeaders.set("x-correlation-id", correlationId);

  const rateLimitResponse = checkRateLimit(request, correlationId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const hostResponse = withHostRouting(request, correlationId);
  if (hostResponse) {
    return hostResponse;
  }
  const legacyMobilePathResponse = withLegacyMobilePathRedirect(request, correlationId);
  if (legacyMobilePathResponse) {
    return legacyMobilePathResponse;
  }
  const response = withSecurityAndCorrelation(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    correlationId,
  );
  if (request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|map|woff|woff2)$).*)",
  ],
};
