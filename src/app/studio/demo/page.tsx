import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/auth";
import { DemoVisualEditor } from "@/components/demo-visual-editor";
import { getDemoPageContent, updateDemoPageContent } from "@/lib/data";
import { defaultDemoPageContent, normalizeDemoPageContent, type DemoPageContent } from "@/lib/demo";

function readValue(formData: FormData, key: string, fallback: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(formData: FormData, key: string, fallback: boolean) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return fallback;
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readDemoContent(formData: FormData): DemoPageContent {
  return normalizeDemoPageContent({
    heroEyebrow: readValue(formData, "heroEyebrow", defaultDemoPageContent.heroEyebrow),
    heroTitle: readValue(formData, "heroTitle", defaultDemoPageContent.heroTitle),
    heroBody: readValue(formData, "heroBody", defaultDemoPageContent.heroBody),
    previewBadge: readValue(formData, "previewBadge", defaultDemoPageContent.previewBadge),
    opsCtaLabel: readValue(formData, "opsCtaLabel", defaultDemoPageContent.opsCtaLabel),
    loginCtaLabel: readValue(formData, "loginCtaLabel", defaultDemoPageContent.loginCtaLabel),
    showMetrics: readBoolean(formData, "showMetrics", defaultDemoPageContent.showMetrics),
    showPresentationFlow: readBoolean(formData, "showPresentationFlow", defaultDemoPageContent.showPresentationFlow),
    flowEyebrow: readValue(formData, "flowEyebrow", defaultDemoPageContent.flowEyebrow),
    flowTitle: readValue(formData, "flowTitle", defaultDemoPageContent.flowTitle),
    showStaffAccounts: readBoolean(formData, "showStaffAccounts", defaultDemoPageContent.showStaffAccounts),
    accountsEyebrow: readValue(formData, "accountsEyebrow", defaultDemoPageContent.accountsEyebrow),
    accountsTitle: readValue(formData, "accountsTitle", defaultDemoPageContent.accountsTitle),
    accountsBody: readValue(formData, "accountsBody", defaultDemoPageContent.accountsBody),
    showRecentOrders: readBoolean(formData, "showRecentOrders", defaultDemoPageContent.showRecentOrders),
    recentOrdersTitle: readValue(formData, "recentOrdersTitle", defaultDemoPageContent.recentOrdersTitle),
    recentOrdersCtaLabel: readValue(formData, "recentOrdersCtaLabel", defaultDemoPageContent.recentOrdersCtaLabel),
    showTableStatus: readBoolean(formData, "showTableStatus", defaultDemoPageContent.showTableStatus),
    tableStatusTitle: readValue(formData, "tableStatusTitle", defaultDemoPageContent.tableStatusTitle),
    showLowStock: readBoolean(formData, "showLowStock", defaultDemoPageContent.showLowStock),
    lowStockTitle: readValue(formData, "lowStockTitle", defaultDemoPageContent.lowStockTitle),
    lowStockLabel: readValue(formData, "lowStockLabel", defaultDemoPageContent.lowStockLabel),
    showPackages: readBoolean(formData, "showPackages", defaultDemoPageContent.showPackages),
    showClosingCta: readBoolean(formData, "showClosingCta", defaultDemoPageContent.showClosingCta),
    closingCtaTitle: readValue(formData, "closingCtaTitle", defaultDemoPageContent.closingCtaTitle),
    closingCtaBody: readValue(formData, "closingCtaBody", defaultDemoPageContent.closingCtaBody),
    closingCtaPrimaryLabel: readValue(formData, "closingCtaPrimaryLabel", defaultDemoPageContent.closingCtaPrimaryLabel),
    closingCtaSecondaryLabel: readValue(formData, "closingCtaSecondaryLabel", defaultDemoPageContent.closingCtaSecondaryLabel),
    sectionStyles: readJsonField(formData, "sectionStylesJson", defaultDemoPageContent.sectionStyles),
    packages: readJsonField(formData, "packagesJson", defaultDemoPageContent.packages),
    presentationFlow: readJsonField(formData, "presentationFlowJson", defaultDemoPageContent.presentationFlow),
    staffAccounts: readJsonField(formData, "staffAccountsJson", defaultDemoPageContent.staffAccounts),
  });
}

async function updateDemoPageContentAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/demo");

  const content = readDemoContent(formData);
  await updateDemoPageContent(content);

  revalidatePath("/demo");
  revalidatePath("/studio/demo");
}

export default async function StudioDemoPage() {
  await requireStudioAccess("/studio/demo");
  const { content, usingDemoData } = await getDemoPageContent();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio Demo</p>
            <h1 className="text-3xl font-semibold text-slate-900">Demo panel icerigi</h1>
          </div>
          <Link href="/demo" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Demo Sayfasini Ac
          </Link>
        </header>

        {usingDemoData ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Varsayilan demo icerigi gosteriliyor.</p> : null}

        <DemoVisualEditor content={content} action={updateDemoPageContentAction} />
      </main>
    </div>
  );
}
