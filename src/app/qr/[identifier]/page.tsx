import { redirect } from "next/navigation";
import { normalizeBusinessSlug } from "@/lib/business";

export default async function LegacyQrPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const defaultSlug = normalizeBusinessSlug();
  redirect(`/${encodeURIComponent(defaultSlug)}/qr/${encodeURIComponent(identifier)}`);
}
