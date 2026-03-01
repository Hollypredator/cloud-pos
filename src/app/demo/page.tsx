import { DemoPageRenderer } from "@/components/demo-page-renderer";
import { getDemoPageContent } from "@/lib/data";

export default async function DemoPage() {
  const { content } = await getDemoPageContent();

  return <DemoPageRenderer content={content} />;
}
