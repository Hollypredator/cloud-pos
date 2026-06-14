import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "restoran-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function RestoranPosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
