import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "izmir-qr-menü";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function IzmirQrMenuPage() {
  return <SeoLandingRoute slug={slug} />;
}
