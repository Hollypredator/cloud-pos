import { getAppBaseUrl } from "@/lib/app-url";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { generateQrSignature } from "@/lib/qr-security";

export async function buildQrTarget(identifier: string) {
  const base = getAppBaseUrl();
  const businessSlug = await getActiveBusinessSlug();
  const t = Date.now().toString();
  const sig = generateQrSignature(identifier, t);
  return `${base}/${businessSlug}/qr/${identifier}?sig=${sig}&t=${t}`;
}

export async function buildQrImage(identifier: string, prebuiltTarget?: string) {
  const target = encodeURIComponent(prebuiltTarget ?? (await buildQrTarget(identifier)));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${target}`;
}
