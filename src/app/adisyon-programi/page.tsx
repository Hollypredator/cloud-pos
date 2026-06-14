import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "adisyon-programi";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function AdisyonProgramiPage() {
  return <SeoLandingRoute slug={slug} />;
}
