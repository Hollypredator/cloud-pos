import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const scriptSrc = ["'self'", "'unsafe-inline'", "https:"];
if (!isProduction) {
  scriptSrc.push("'unsafe-eval'");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' https: data:",
  "style-src 'self' 'unsafe-inline' https:",
  `script-src ${scriptSrc.join(" ")}`,
  "connect-src 'self' https:",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  async redirects() {
    return [
      { source: '/admin/seo', destination: '/studio/seo', permanent: true },
      { source: '/admin/media', destination: '/studio/media', permanent: true },
      { source: '/admin/blog', destination: '/studio/blog', permanent: true },
      { source: '/admin/leads', destination: '/studio/leads', permanent: true },
      { source: '/admin/content', destination: '/studio/content', permanent: true },
      { source: '/admin/onboarding', destination: '/studio/onboarding', permanent: true },
    ];
  },
  env: {
    NEXT_PUBLIC_WEB_PERF_FERRARI_CASHIER:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_CASHIER ?? process.env.WEB_PERF_FERRARI_CASHIER ?? "",
    NEXT_PUBLIC_WEB_PERF_FERRARI_KITCHEN:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_KITCHEN ?? process.env.WEB_PERF_FERRARI_KITCHEN ?? "",
    NEXT_PUBLIC_WEB_PERF_FERRARI_OPS:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_OPS ?? process.env.WEB_PERF_FERRARI_OPS ?? "",
    NEXT_PUBLIC_WEB_PERF_FERRARI_TABLES:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_TABLES ?? process.env.WEB_PERF_FERRARI_TABLES ?? "",
    NEXT_PUBLIC_WEB_PERF_FERRARI_SERVICE:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_SERVICE ?? process.env.WEB_PERF_FERRARI_SERVICE ?? "",
    NEXT_PUBLIC_WEB_PERF_FERRARI_DELIVERY:
      process.env.NEXT_PUBLIC_WEB_PERF_FERRARI_DELIVERY ?? process.env.WEB_PERF_FERRARI_DELIVERY ?? "",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
