import crypto from "crypto";

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || "cloudpos-qr-secure-seating-key-2026";

export function generateQrSignature(identifier: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${identifier}:${timestamp}`)
    .digest("hex");
}

export function verifyQrSignature(identifier: string, timestamp: string, signature: string): boolean {
  if (!signature || !timestamp) {
    return false;
  }
  try {
    const expected = generateQrSignature(identifier, timestamp);
    // Constant time comparison to prevent timing attacks
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
