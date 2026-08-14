import crypto from "crypto";

/**
 * Masa QR kodu imzalama.
 *
 * Neden gerekli: QR hedefi `/{isletme}/qr/masa-5` gibi tahmin edilebilir bir
 * URL. Imza olmadan musteri adres cubugunda `masa-5`'i `masa-12` yapip baska
 * masanin adisyonuna urun ekleyebilir. Imza, URL'in sunucu tarafindan
 * uretildigini kanitlar.
 *
 * Zaman damgasi (`t`) imzaya dahildir ama TAZELIK KONTROLU YAPILMAZ — bu
 * bilincli. Masa QR kodlari basilip masaya yapistiriliyor; sure asimi
 * koyarsak her basili QR bir sure sonra olur ve isletme hepsini yeniden
 * basmak zorunda kalir. `t` burada yalnizca surum/nonce alanidir: gerekirse
 * QR_SECRET degistirilerek tum eski kodlar topluca gecersiz kilinir.
 */

const DEV_FALLBACK_SECRET = "cloudpos-qr-secure-seating-key-2026";

function getQrSecret() {
  const configured = (process.env.QR_SECRET || process.env.JWT_SECRET || "").trim();
  if (configured) {
    return configured;
  }

  // Yerel gelistirmede QR test edilebilsin diye sabit bir anahtara duser.
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_SECRET;
  }

  return "";
}

export function generateQrSignature(identifier: string, timestamp: string): string {
  const secret = getQrSecret();
  if (!secret) {
    // Uretimde anahtar yoksa imza URETILMEZ. Bos anahtarla HMAC hesaplamak
    // teknik olarak calisir ama sonucu herkes hesaplayabilir — imza guvenlik
    // saglamadigi halde sagliyormus gibi gorunurdu. Sessiz sahte guvenlik
    // yerine gorunur ariza tercih edildi.
    throw new Error("QR_SECRET tanımlı değil: üretimde imzalı QR üretilemez.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${identifier}:${timestamp}`)
    .digest("hex");
}

export function verifyQrSignature(identifier: string, timestamp: string, signature: string): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  const secret = getQrSecret();
  if (!secret) {
    // Anahtar yoksa hicbir imza dogrulanamaz. Fail-closed: uretimde yanlis
    // yapilandirma erisimi acmaz, kapatir.
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${identifier}:${timestamp}`)
      .digest("hex");

    // Sabit zamanli karsilastirma: baytlarin nerede ayrildigi sure
    // farkindan okunamasin.
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

/** Uretimde imza uretilebilir mi? Cagiran taraf QR basmadan once uyarabilir. */
export function isQrSigningConfigured() {
  return Boolean(getQrSecret());
}
