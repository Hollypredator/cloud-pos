import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { getGeneralSettings, getSitePageContent } from "@/lib/data";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  const [{ content }, { settings }] = await Promise.all([getSitePageContent("home"), getGeneralSettings()]);

  return <LandingPageRenderer content={content} settings={settings} leadStatus={lead} />;
}
