import { DemoPageRenderer } from "@/components/demo-page-renderer";
import { getDemoPageContent } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function DemoPage() {
  const [locale, { content }] = await Promise.all([getCurrentLocale(), getDemoPageContent()]);

  return <DemoPageRenderer content={content} locale={locale} />;
}
