import { redirect } from "next/navigation";
import { normalizeBusinessSlug } from "@/lib/business";

export default async function LegacyQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { identifier } = await params;
  const query = await searchParams;
  const defaultSlug = normalizeBusinessSlug();

  // Imza parametreleri korunur: aksi halde imzali bir eski-format baglanti
  // yonlendirmeden sonra imzasiz kalir ve hedef sayfa onu reddeder.
  const forwarded = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      forwarded.set(key, value);
    } else if (Array.isArray(value) && value[0] !== undefined) {
      forwarded.set(key, value[0]);
    }
  }

  const suffix = forwarded.toString();
  const target = `/${encodeURIComponent(defaultSlug)}/qr/${encodeURIComponent(identifier)}`;
  redirect(suffix ? `${target}?${suffix}` : target);
}
