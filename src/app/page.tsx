import { ProductLandingPage } from "@/components/product-landing-page";
import { getGeneralSettings, getSitePageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  const [locale, , { settings }] = await Promise.all([
    getCurrentLocale(),
    getSitePageContent("home"),
    getGeneralSettings(),
  ]);

  return <ProductLandingPage settings={settings} leadStatus={lead} locale={locale} />;
}
