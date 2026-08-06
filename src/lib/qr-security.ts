import crypto from "crypto";

const DEV_FALLBACK_SECRET = "cloudpos-qr-secure-seating-key-2026";

function getQrSecret() {
  const configured = (process.env.QR_SECRET || process.env.JWT_SECRET || "").trim();
  if (configured) {
    return configured;
  }

  // Keep production strict while making local/dev QR testing work out of the box.
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_SECRET;
  }

  return "";
}

export function generateQrSignature(identifier: string, timestamp: string): string {
  return crypto
    .createHmac("sha256", getQrSecret())
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
