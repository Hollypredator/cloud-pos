type SecurityHeaderOptions = {
  includeHsts?: boolean;
  isProduction?: boolean;
  strictMode?: boolean;
};

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isStrictCspModeEnabled() {
  return readBooleanEnv("SECURITY_CSP_STRICT_MODE", false);
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}) {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const strictMode = options.strictMode ?? isStrictCspModeEnabled();
  const scriptSrc = ["'self'", "'unsafe-inline'", "https:"];
  const connectSrc = strictMode ? ["'self'", "https:", "wss:"] : ["'self'", "https:", "http:", "wss:", "ws:"];

  if (!isProduction && !strictMode) {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function getSecurityHeaders(options: SecurityHeaderOptions = {}) {
  const headers = [
    ["X-Frame-Options", "DENY"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-XSS-Protection", "1; mode=block"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ["X-DNS-Prefetch-Control", "off"],
    ["Cross-Origin-Resource-Policy", "same-origin"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Content-Security-Policy", buildContentSecurityPolicy(options)],
  ] as const;

  if (!options.includeHsts) {
    return headers;
  }

  return [
    ...headers,
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"] as const,
  ];
}
