import { getAppBaseUrl } from "@/lib/app-url";
import { getActiveBusinessSlug } from "@/lib/business-server";

export async function buildQrTarget(identifier: string) {
  const base = getAppBaseUrl();
  const businessSlug = await getActiveBusinessSlug();
  return `${base}/${businessSlug}/qr/${identifier}`;
}

export async function buildQrImage(identifier: string, prebuiltTarget?: string) {
  const target = encodeURIComponent(prebuiltTarget ?? (await buildQrTarget(identifier)));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${target}`;
}
