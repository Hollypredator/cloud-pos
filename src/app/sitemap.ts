import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/seo";
import { seoLandingPages } from "@/lib/seo-landing-pages";

const publicRoutes = ["/", "/demo", "/blog", "/reviews"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteBaseUrl();
  const now = new Date();

  const staticEntries = publicRoutes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified: now,
    changeFrequency: route === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "/" ? 1 : route === "/demo" ? 0.85 : 0.7,
  }));

  const seoEntries = seoLandingPages.map((page) => ({
    url: new URL(`/${page.slug}`, baseUrl).toString(),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: page.locality ? 0.72 : 0.8,
  }));

  return [...staticEntries, ...seoEntries];
}
