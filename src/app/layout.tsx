import type { Metadata } from "next";
import { Sora, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getApplicationSettings, getAppShellSnapshot, getGeneralSettings, getSeoSettings } from "@/lib/data";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  const [shellSnapshot, { settings: generalSettings }, { settings: applicationSettings }] = await Promise.all([
    getAppShellSnapshot(),
    getGeneralSettings(),
    getApplicationSettings(),
  ]);
  const activeBusiness =
    shellSnapshot.businesses.find((item) => item.slug === shellSnapshot.activeBusinessSlug) ??
    shellSnapshot.businesses[0];

  return (
    <html lang="tr">
      <body
        className={`${sora.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell
          role={shellSnapshot.role}
          hasUser={!!shellSnapshot.user}
          usingDemoData={shellSnapshot.usingDemoData}
          activeBusinessSlug={shellSnapshot.activeBusinessSlug}
          businesses={shellSnapshot.businesses.map((item) => ({ slug: item.slug, name: item.name }))}
          activeBranchId={shellSnapshot.activeBranchId ?? ""}
          branches={shellSnapshot.branches.map((item) => ({ id: item.id, name: item.name }))}
          currentPlan={activeBusiness?.plan ?? "growth"}
          branchAccessScope={shellSnapshot.accessScope ?? "business"}
          canSwitchBranches={shellSnapshot.usingDemoData || shellSnapshot.accessScope !== "branch"}
          brandName={generalSettings.siteName}
          logoUrl={generalSettings.logoUrl || undefined}
          sidebarTheme={applicationSettings.sidebarTheme}
          sidebarAccentColor={applicationSettings.sidebarAccentColor}
          ownerSidebarOrder={applicationSettings.ownerSidebarOrder}
          adminSidebarOrder={applicationSettings.adminSidebarOrder}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
