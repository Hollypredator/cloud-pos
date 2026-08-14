import { getAppBaseUrl } from "@/lib/app-url";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { generateQrSignature, isQrSigningConfigured } from "@/lib/qr-security";

/**
 * Masa QR hedefi. Imza masa tahrifatini engeller (bkz. lib/qr-security.ts).
 *
 * DIKKAT: her cagri yeni bir zaman damgasi uretir, dolayisiyla farkli bir URL.
 * Ayni masa icin hem baglantiyi hem QR gorselini gosterecekseniz bu fonksiyonu
 * BIR KEZ cagirip sonucu `buildQrImage`'e verin; iki kez cagirmak ekranda
 * gorunen adresle karekodun icindeki adresi birbirinden ayirir.
 */
export async function buildQrTarget(identifier: string) {
  const base = getAppBaseUrl();
  const businessSlug = await getActiveBusinessSlug();
  const plain = `${base}/${businessSlug}/qr/${identifier}`;

  // Anahtar yoksa (uretimde yanlis yapilandirma) imzasiz URL uretilir; QR
  // sayfasi bunu zaten reddeder. Burada patlamak yerine yoneticiye QR
  // ekraninda uyari gostermek tercih edildi — `isQrSigningConfigured`.
  if (!isQrSigningConfigured()) {
    return plain;
  }

  const t = Date.now().toString();
  const sig = generateQrSignature(identifier, t);
  return `${plain}?sig=${sig}&t=${t}`;
}

export async function buildQrImage(identifier: string, prebuiltTarget?: string) {
  const target = encodeURIComponent(prebuiltTarget ?? (await buildQrTarget(identifier)));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${target}`;
}
