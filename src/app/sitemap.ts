import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/seo";

const publicRoutes = ["/", "/demo", "/blog", "/reviews"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
