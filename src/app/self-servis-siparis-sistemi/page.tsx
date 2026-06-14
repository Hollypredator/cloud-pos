import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "self-servis-siparis-sistemi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function SelfServisSiparisSistemiPage() {
  return <SeoLandingRoute slug={slug} />;
}
