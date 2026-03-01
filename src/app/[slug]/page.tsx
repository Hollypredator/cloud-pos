import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page-renderer";
import { getGeneralSettings, getSitePageContent } from "@/lib/data";

export default async function ManagedSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ content, found }, { settings }] = await Promise.all([getSitePageContent(slug), getGeneralSettings()]);

  if (!found) {
    notFound();
  }

  return <LandingPageRenderer content={content} settings={settings} />;
}
