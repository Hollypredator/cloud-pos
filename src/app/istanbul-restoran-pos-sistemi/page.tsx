import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "istanbul-restoran-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function IstanbulRestoranPosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
