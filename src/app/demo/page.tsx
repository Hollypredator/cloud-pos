import type { Metadata } from "next";
import { DemoPageRenderer } from "@/components/demo-page-renderer";
import { getDemoPageContent, getSeoSettings } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { absoluteUrl, buildPageMetadata, JsonLd, publicSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSeoSettings();

  return buildPageMetadata({
    title: publicSeo.demoTitle,
    description: publicSeo.demoDescription,
    path: "/demo",
    seoSettings: settings,
    image: publicSeo.ogImage,
  });
}

export default async function DemoPage() {
  const [locale, { content }, { settings }] = await Promise.all([getCurrentLocale(), getDemoPageContent(), getSeoSettings()]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSeo.demoTitle,
          url: absoluteUrl("/demo", settings),
          description: publicSeo.demoDescription,
          isPartOf: {
            "@type": "WebSite",
            name: publicSeo.siteName,
            url: absoluteUrl("/", settings),
          },
        }}
      />
      <DemoPageRenderer content={content} locale={locale} />
    </>
  );
}
