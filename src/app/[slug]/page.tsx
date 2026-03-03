import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { getGeneralSettings, getSitePageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function ManagedSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, { content, found }, { settings }] = await Promise.all([getCurrentLocale(), getSitePageContent(slug), getGeneralSettings()]);

  if (!found) {
    notFound();
  }

  return <LandingPageRenderer content={content} settings={settings} locale={locale} />;
}
