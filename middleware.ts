import { NextResponse, type NextRequest } from "next/server";

type RateLimitRule = {
  prefix: string;
  windowMs: number;
  max: number;
};

type RateLimitStore = Map<string, number[]>;

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { prefix: "/api/orders", windowMs: 60_000, max: 40 },
  { prefix: "/api/orders/latest", windowMs: 60_000, max: 80 },
  { prefix: "/api/orders/history", windowMs: 60_000, max: 80 },
  { prefix: "/api/table-requests", windowMs: 60_000, max: 30 },
  { prefix: "/api/alerts/dispatch", windowMs: 60_000, max: 12 },
];

function getRateLimitStore() {
  const scope = globalThis as typeof globalThis & { __posRateLimitStore?: RateLimitStore };
  if (!scope.__posRateLimitStore) {
    scope.__posRateLimitStore = new Map<string, number[]>();
  }
  return scope.__posRateLimitStore;
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const matchedRule = RATE_LIMIT_RULES.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`));
  if (!matchedRule) {
    return null;
  }

  const now = Date.now();
  const windowStart = now - matchedRule.windowMs;
  const key = `${matchedRule.prefix}:${getClientIp(request)}`;
  const store = getRateLimitStore();
  const existingHits = store.get(key) ?? [];
  const validHits = existingHits.filter((timestamp) => timestamp >= windowStart);
  validHits.push(now);
  store.set(key, validHits);

  if (validHits.length <= matchedRule.max) {
    return null;
  }

  return NextResponse.json(
    { ok: false, message: "Cok fazla istek gonderildi. Lutfen kisa bir sure sonra tekrar deneyin." },
    { status: 429 },
  );
}

function normalizeHost(host: string | null) {
  return (host ?? "").toLowerCase().split(":")[0];
}

function withHostRouting(request: NextRequest) {
  const studioHost = normalizeHost(process.env.STUDIO_HOST ?? null);
  const appHost = normalizeHost(process.env.APP_HOST ?? null);
  const currentHost = normalizeHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  if (studioHost && currentHost === studioHost) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/studio", request.url));
    }
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/studio/login", request.url));
    }
  }

  if (appHost && currentHost === appHost) {
    if (pathname === "/studio") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const hostResponse = withHostRouting(request);
  if (hostResponse) {
    return hostResponse;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
