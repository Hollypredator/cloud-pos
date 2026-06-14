import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "kafe-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function KafePosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
