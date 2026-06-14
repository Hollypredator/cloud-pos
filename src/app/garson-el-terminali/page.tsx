import { generateSeoLandingMetadata, SeoLandingRoute } from "@/app/seo-landing-route";

const slug = "garson-el-terminali";

export function generateMetadata() {
  return generateSeoLandingMetadata(slug);
}

export default function GarsonElTerminaliPage() {
  return <SeoLandingRoute slug={slug} />;
}
