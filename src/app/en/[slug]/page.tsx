import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";
import { seoLandingPages } from "@/lib/seo-landing-pages";

export function generateStaticParams() {
  return seoLandingPages
    .filter((page) => page.locale === "en" && page.slug.startsWith("en/"))
    .map((page) => ({ slug: page.slug.replace("en/", "") }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => generateSeoLandingMetadata(`en/${slug}`));
}

export default async function EnglishSeoLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SeoLandingRoute slug={`en/${slug}`} />;
}
