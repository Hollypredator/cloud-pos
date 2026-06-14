import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPageView } from "@/components/seo-landing-page";
import { defaultSeoSettings } from "@/lib/app-settings";
import { absoluteUrl, buildPageMetadata, JsonLd, publicSeo } from "@/lib/seo";
import { getSeoLandingPage, seoLandingPages } from "@/lib/seo-landing-pages";

export const dynamic = "force-static";

export async function generateSeoLandingMetadata(slug: string): Promise<Metadata> {
  const page = getSeoLandingPage(slug);

  if (!page) {
    return buildPageMetadata({
      title: "Sayfa bulunamadı",
      description: publicSeo.homeDescription,
      path: `/${slug}`,
      seoSettings: defaultSeoSettings,
    });
  }

  const metadata = buildPageMetadata({
    title: page.metaTitle,
    description: page.description,
    path: `/${page.canonicalSlug}`,
    seoSettings: defaultSeoSettings,
    image: publicSeo.ogImage,
  });

  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: absoluteUrl(`/${page.canonicalSlug}`, defaultSeoSettings),
      languages: Object.fromEntries(
        Object.entries(page.hreflangAlternates).map(([locale, alternateSlug]) => [
          locale,
          absoluteUrl(`/${alternateSlug}`, defaultSeoSettings),
        ]),
      ),
    },
  };
}

export function SeoLandingRoute({ slug }: { slug: string }) {
  const page = getSeoLandingPage(slug);

  if (!page) {
    notFound();
  }

  const relatedPages = seoLandingPages
    .filter((item) => item.slug !== page.slug && item.locale === page.locale && item.market === page.market)
    .slice(0, 3);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: page.title,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, iOS, Android",
            description: page.description,
            url: absoluteUrl(`/${page.canonicalSlug}`, defaultSeoSettings),
            image: absoluteUrl(publicSeo.ogImage, defaultSeoSettings),
            inLanguage: page.locale === "tr" ? "tr-TR" : "en",
            publisher: {
              "@type": "Organization",
              name: publicSeo.siteName,
            },
            offers: {
              "@type": "Offer",
              availability: "https://schema.org/InStock",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          },
        ]}
      />
      <SeoLandingPageView page={page} relatedPages={relatedPages} />
    </>
  );
}
