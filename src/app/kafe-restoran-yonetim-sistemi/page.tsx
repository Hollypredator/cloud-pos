import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "kafe-restoran-yonetim-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function KafeRestoranYonetimSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
