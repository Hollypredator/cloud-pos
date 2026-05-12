import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PosCommandQueueRuntime } from "@/components/pos-command-queue-runtime";
import { QueryProvider } from "@/components/query-provider";
import { getGeneralSettings, getSeoSettings } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { Toaster } from "react-hot-toast";
import { getAppShellPayload } from "@/lib/server/app-shell";

const APP_SHELL_FETCH_BUDGET_MS = 220;
const APP_RUNTIME_PREFIXES = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin"];

function shouldUseAppRuntime(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return APP_RUNTIME_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

async function getAppShellPayloadWithBudget() {
  try {
    return await Promise.race([
      getAppShellPayload(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), APP_SHELL_FETCH_BUDGET_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ settings: generalSettings }, { settings: seoSettings }] = await Promise.all([
    getGeneralSettings(),
    getSeoSettings(),
  ]);

  return {
    title: seoSettings.metaTitle || generalSettings.siteName,
    description: seoSettings.metaDescription,
    applicationName: generalSettings.siteName,
    robots: seoSettings.indexable ? "index, follow" : "noindex, nofollow",
    alternates: seoSettings.canonicalUrl ? { canonical: seoSettings.canonicalUrl } : undefined,
    openGraph: {
      title: seoSettings.ogTitle || seoSettings.metaTitle || generalSettings.siteName,
      description: seoSettings.ogDescription || seoSettings.metaDescription,
      images: seoSettings.ogImageUrl ? [{ url: seoSettings.ogImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seoSettings.ogTitle || seoSettings.metaTitle || generalSettings.siteName,
      description: seoSettings.ogDescription || seoSettings.metaDescription,
      images: seoSettings.ogImageUrl ? [seoSettings.ogImageUrl] : undefined,
      creator: seoSettings.twitterHandle || undefined,
    },
    appleWebApp: {
      title: generalSettings.siteName,
      capable: true,
      statusBarStyle: "default",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const locale = await getCurrentLocale();
  const pathname = headerStore.get("x-pathname");
  const useAppRuntime = shouldUseAppRuntime(pathname);
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
  const initialShellData = useAppRuntime && hasAuthCookie ? await getAppShellPayloadWithBudget() : null;

  return (
    <html lang={locale}>
      <body className="antialiased">
        {useAppRuntime ? (
          <QueryProvider>
            <PosCommandQueueRuntime />
            <AppShell initialData={initialShellData}>{children}</AppShell>
          </QueryProvider>
        ) : (
          children
        )}
        <Toaster position="top-center" />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
