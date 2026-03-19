import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { getGeneralSettings, getSitePageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  const [locale, { content }, { settings }] = await Promise.all([
    getCurrentLocale(),
    getSitePageContent("home"),
    getGeneralSettings(),
  ]);

  return <LandingPageRenderer content={content} settings={settings} leadStatus={lead} locale={locale} />;
}
