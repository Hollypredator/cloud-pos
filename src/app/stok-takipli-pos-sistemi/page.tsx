import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "stok-takipli-pos-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function StokTakipliPosSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
