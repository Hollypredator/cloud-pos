import type { Metadata } from "next";
import { ProductLandingPage } from "@/components/product-landing-page";
import { getGeneralSettings, getSeoSettings, getSitePageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { absoluteUrl, buildPageMetadata, JsonLd, publicSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSeoSettings();

  return buildPageMetadata({
    title: settings.metaTitle || publicSeo.homeTitle,
    description: settings.metaDescription || publicSeo.homeDescription,
    path: "/",
    seoSettings: settings,
    image: settings.ogImageUrl || publicSeo.ogImage,
  });
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  const [locale, , { settings }, { settings: seoSettings }] = await Promise.all([
    getCurrentLocale(),
    getSitePageContent("home"),
    getGeneralSettings(),
    getSeoSettings(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Cloud POS",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, iOS, Android, Windows",
            url: absoluteUrl("/", seoSettings),
            description: publicSeo.homeDescription,
            offers: {
              "@type": "Offer",
              category: "SaaS",
              availability: "https://schema.org/InStock",
            },
            featureList: [
              "Self servis ve QR sipariş akışı",
              "Kafe restoran POS arayüzü",
              "Mutfak ekranı",
              "Kasa ve adisyon yönetimi",
              "Stok, müşteri ve raporlama",
              "Çok şubeli operasyon yönetimi",
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: settings.siteName,
            url: absoluteUrl("/", seoSettings),
            contactPoint: settings.contactPhone
              ? {
                  "@type": "ContactPoint",
                  telephone: settings.contactPhone,
                  contactType: "sales",
                  areaServed: "TR",
                  availableLanguage: ["tr"],
                }
              : undefined,
          },
        ]}
      />
      <ProductLandingPage settings={settings} leadStatus={lead} locale={locale} />
    </>
  );
}
