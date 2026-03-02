import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Sora, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getGeneralSettings, getSeoSettings } from "@/lib/data";
import { getAppShellPayload } from "@/lib/server/app-shell";

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
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
  const initialShellData = hasAuthCookie ? await getAppShellPayload() : null;

  return (
    <html lang="tr">
      <body
        className={`${sora.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell initialData={initialShellData}>{children}</AppShell>
      </body>
    </html>
  );
}
