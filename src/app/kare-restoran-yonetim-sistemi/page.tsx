import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "kare-restoran-yonetim-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function KareRestoranYönetimSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
