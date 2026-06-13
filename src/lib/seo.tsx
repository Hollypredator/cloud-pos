import type { Metadata } from "next";
import type { SeoSettings } from "@/lib/app-settings";

const DEFAULT_SITE_URL = "http://localhost:3000";

export const publicSeo = {
  siteName: "Cloud POS",
  homeTitle: "Cloud POS | Self servis ve kafe restoran POS platformu",
  homeDescription:
    "Cloud POS; self servis, QR sipariş, kafe restoran POS, mutfak ekranı, kasa, stok, müşteri ve çok şubeli operasyonları tek bulut panelinde toplar.",
  demoTitle: "Cloud POS Demo | POS modüllerini gerçek ekranlarla inceleyin",
  demoDescription:
    "Cloud POS demo sayfasında operasyon paneli, POS arayüzü, mobil PWA, mutfak, stok, rapor ve çok şube modüllerini gerçek ürün ekranlarıyla inceleyin.",
  blogTitle: "Cloud POS Blog | POS, self servis ve restoran operasyon notları",
  blogDescription:
    "Self servis, QR sipariş, kafe restoran POS, mutfak operasyonu, kasa, stok ve raporlama üzerine Cloud POS ürün notları.",
  ogImage: "/landing-assets/operasyon-paneli-desktop.png",
};

export const protectedRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

function normalizeBaseUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return "";
  }
}

export function getSiteBaseUrl(settings?: Partial<SeoSettings> | null) {
  return (
    normalizeBaseUrl(settings?.canonicalUrl) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    DEFAULT_SITE_URL
  );
}

export function absoluteUrl(path = "/", settings?: Partial<SeoSettings> | null) {
  return new URL(path, getSiteBaseUrl(settings)).toString();
}

export function buildPageMetadata({
  title,
  description,
  path = "/",
  seoSettings,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: {
  title: string;
  description: string;
  path?: string;
  seoSettings?: Partial<SeoSettings> | null;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
}): Metadata {
  const canonical = absoluteUrl(path, seoSettings);
  const imageUrl = image ? absoluteUrl(image, seoSettings) : absoluteUrl(publicSeo.ogImage, seoSettings);
  const robots = seoSettings?.indexable === false ? protectedRobots : { index: true, follow: true };

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots,
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: publicSeo.siteName,
      locale: "tr_TR",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      publishedTime: type === "article" ? publishedTime ?? undefined : undefined,
      modifiedTime: type === "article" ? modifiedTime ?? undefined : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      creator: seoSettings?.twitterHandle || undefined,
    },
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
