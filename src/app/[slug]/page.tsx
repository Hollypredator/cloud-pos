import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { getGeneralSettings, getSeoSettings, getSitePageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { buildPageMetadata, publicSeo } from "@/lib/seo";

function sectionSummary(content: Awaited<ReturnType<typeof getSitePageContent>>["content"]) {
  const text = content.sections
    .flatMap((section) => {
      if ("body" in section && typeof section.body === "string") return [section.body];
      return [];
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text || publicSeo.homeDescription;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [{ content, found }, { settings }] = await Promise.all([getSitePageContent(slug), getSeoSettings()]);

  if (!found) {
    return buildPageMetadata({
      title: "Sayfa bulunamadı",
      description: publicSeo.homeDescription,
      path: `/${slug}`,
      seoSettings: settings,
    });
  }

  return buildPageMetadata({
    title: content.pageTitle,
    description: sectionSummary(content).slice(0, 160),
    path: `/${slug}`,
    seoSettings: settings,
    image: settings.ogImageUrl || publicSeo.ogImage,
  });
}

export default async function ManagedSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, { content, found }, { settings }] = await Promise.all([
    getCurrentLocale(),
    getSitePageContent(slug),
    getGeneralSettings(),
  ]);

  if (!found) {
    notFound();
  }

  return <LandingPageRenderer content={content} settings={settings} locale={locale} />;
}
