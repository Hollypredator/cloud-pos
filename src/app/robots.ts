import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/blog", "/reviews"],
        disallow: ["/admin", "/api", "/cashier", "/kitchen", "/m", "/ops", "/studio", "/support"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
