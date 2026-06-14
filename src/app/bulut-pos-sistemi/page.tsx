import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "bulut-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function BulutPosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
