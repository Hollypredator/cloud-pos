import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security-headers";

const isProduction = process.env.NODE_ENV === "production";

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
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/(.*)",
        headers: getSecurityHeaders({ includeHsts: true, isProduction }).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
