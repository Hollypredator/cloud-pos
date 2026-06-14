import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "qr-menü";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function QrMenuPage() {
  return <SeoLandingRoute slug={slug} />;
}
