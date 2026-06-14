import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "ankara-kafe-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function AnkaraKafePosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
