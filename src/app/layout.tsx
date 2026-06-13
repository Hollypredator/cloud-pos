import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { getGeneralSettings, getSeoSettings } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { Toaster } from "react-hot-toast";
import { getAppShellPayload } from "@/lib/server/app-shell";
import { AppRuntimeWrapper } from "@/components/app-runtime-wrapper";
import { absoluteUrl, getSiteBaseUrl, publicSeo } from "@/lib/seo";

const APP_SHELL_FETCH_BUDGET_MS = 220;

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
    metadataBase: new URL(getSiteBaseUrl(seoSettings)),
    title: {
      default: seoSettings.metaTitle || publicSeo.homeTitle,
      template: `%s | ${generalSettings.siteName}`,
    },
    description: seoSettings.metaDescription || publicSeo.homeDescription,
    applicationName: generalSettings.siteName,
    keywords: [
      "Cloud POS",
      "self servis POS",
      "kafe restoran POS",
      "QR sipariş",
      "bulut POS",
      "mutfak ekranı",
      "çok şubeli POS",
      "stok takip",
    ],
    authors: [{ name: generalSettings.siteName }],
    creator: generalSettings.siteName,
    publisher: generalSettings.siteName,
    category: "restaurant point of sale software",
    robots: seoSettings.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      title: seoSettings.ogTitle || seoSettings.metaTitle || publicSeo.homeTitle,
      description: seoSettings.ogDescription || seoSettings.metaDescription || publicSeo.homeDescription,
      siteName: generalSettings.siteName,
      locale: "tr_TR",
      url: absoluteUrl("/", seoSettings),
      images: [
        {
          url: seoSettings.ogImageUrl || absoluteUrl(publicSeo.ogImage, seoSettings),
          width: 1200,
          height: 630,
          alt: generalSettings.siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoSettings.ogTitle || seoSettings.metaTitle || publicSeo.homeTitle,
      description: seoSettings.ogDescription || seoSettings.metaDescription || publicSeo.homeDescription,
      images: [seoSettings.ogImageUrl || absoluteUrl(publicSeo.ogImage, seoSettings)],
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
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
  const initialShellData = hasAuthCookie ? await getAppShellPayloadWithBudget() : null;

  return (
    <html lang={locale}>
      <body className="antialiased">
        <AppRuntimeWrapper initialShellData={initialShellData}>
          {children}
        </AppRuntimeWrapper>
        <Toaster position="top-center" />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
