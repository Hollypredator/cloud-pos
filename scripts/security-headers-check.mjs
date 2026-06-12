import { readFileSync } from "node:fs";

const files = {
  middleware: readFileSync("middleware.ts", "utf8"),
  nextConfig: readFileSync("next.config.ts", "utf8"),
  securityHeaders: readFileSync("src/lib/security-headers.ts", "utf8"),
  serviceWorker: readFileSync("public/sw.js", "utf8"),
};

const checks = [
  {
    name: "middleware uses the shared security header source",
    pass: files.middleware.includes('from "@/lib/security-headers"') && files.middleware.includes("getSecurityHeaders()"),
  },
  {
    name: "next config uses the shared security header source",
    pass: files.nextConfig.includes('from "./src/lib/security-headers"') && files.nextConfig.includes("getSecurityHeaders({ includeHsts: true"),
  },
  {
    name: "strict CSP mode is available without changing code",
    pass:
      files.securityHeaders.includes("SECURITY_CSP_STRICT_MODE") &&
      files.securityHeaders.includes("strictMode ? [\"'self'\", \"https:\", \"wss:\"]"),
  },
  {
    name: "production CSP does not unconditionally allow unsafe-eval",
    pass:
      files.securityHeaders.includes("!isProduction && !strictMode") &&
      !files.middleware.includes("'unsafe-eval'") &&
      !files.nextConfig.includes("'unsafe-eval'"),
  },
  {
    name: "operation write and sync APIs have rate-limit rules",
    pass:
      files.middleware.includes('prefix: "/api/ops/command"') &&
      files.middleware.includes('prefix: "/api/sync/push"') &&
      files.middleware.includes('prefix: "/api/qr/token/refresh"') &&
      files.middleware.includes('prefix: "/api/cashier/session/auto-close"'),
  },
  {
    name: "specific rate-limit prefixes are matched before broad prefixes",
    pass: files.middleware.includes(".sort((left, right) => right.prefix.length - left.prefix.length)"),
  },
  {
    name: "PWA ops cache version was bumped for shell changes",
    pass: files.serviceWorker.includes('const OPS_CACHE_VERSION = "v9";'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Security/header hardening check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Security/header hardening check passed (${checks.length} checks).`);
