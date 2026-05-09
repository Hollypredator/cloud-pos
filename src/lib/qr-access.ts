import { createHmac, timingSafeEqual } from "crypto";

type QrAccessPayload = {
  qr: string;
  b: string;
  exp: number;
};

export const DEFAULT_QR_ACCESS_TTL_SECONDS = 60 * 20;
const DEV_FALLBACK_SECRET = "dev-insecure-qr-access-secret";

function getQrAccessSecret() {
  const configuredSecret = process.env.QR_ACCESS_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  // Keep production strict while making local/dev QR testing work out of the box.
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_SECRET;
  }

  return "";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createQrAccessToken(input: {
  qrCodeIdentifier: string;
  businessSlug?: string;
  ttlSeconds?: number;
}) {
  const secret = getQrAccessSecret();
  if (!secret) {
    return null;
  }

  const payload: QrAccessPayload = {
    qr: input.qrCodeIdentifier,
    b: (input.businessSlug ?? "").trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? DEFAULT_QR_ACCESS_TTL_SECONDS),
  };
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded, secret);
  return `${payloadEncoded}.${signature}`;
}

export function getQrAccessTokenExpiryDate(input?: { ttlSeconds?: number }) {
  const ttlSeconds = input?.ttlSeconds ?? DEFAULT_QR_ACCESS_TTL_SECONDS;
  return new Date(Date.now() + ttlSeconds * 1000);
}

export type QrAccessFailureReason = "misconfigured" | "missing" | "invalid" | "expired" | "mismatch";

export function getQrAccessFailurePayload(reason: QrAccessFailureReason) {
  if (reason === "misconfigured") {
    return {
      status: 503,
      code: "QR_TOKEN_MISCONFIGURED",
      message: "QR erisim token ayari eksik.",
    } as const;
  }
  if (reason === "missing") {
    return {
      status: 403,
      code: "QR_TOKEN_MISSING",
      message: "QR erisim oturumu bulunamadi. Lutfen QR kodu yeniden okutun.",
    } as const;
  }
  if (reason === "expired") {
    return {
      status: 403,
      code: "QR_TOKEN_EXPIRED",
      message: "QR erisim oturumu suresi doldu. Lutfen QR kodu yeniden okutun.",
    } as const;
  }
  if (reason === "mismatch") {
    return {
      status: 403,
      code: "QR_TOKEN_MISMATCH",
      message: "QR erisim dogrulanamadi. Lutfen QR kodu yeniden okutun.",
    } as const;
  }
  return {
    status: 403,
    code: "QR_TOKEN_INVALID",
    message: "QR erisim token gecersiz.",
  } as const;
}

export function verifyQrAccessToken(input: {
  token?: string | null;
  qrCodeIdentifier: string;
  businessSlug?: string;
}) {
  const secret = getQrAccessSecret();
  if (!secret) {
    return { ok: false as const, reason: "misconfigured" as const };
  }

  if (!input.token) {
    return { ok: false as const, reason: "missing" as const };
  }

  const [payloadEncoded, receivedSignature] = input.token.split(".");
  if (!payloadEncoded || !receivedSignature) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const expectedSignature = signPayload(payloadEncoded, secret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return { ok: false as const, reason: "invalid" as const };
  }

  let parsed: QrAccessPayload;
  try {
    parsed = JSON.parse(fromBase64Url(payloadEncoded)) as QrAccessPayload;
  } catch {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false as const, reason: "expired" as const };
  }

  const expectedBusinessSlug = (input.businessSlug ?? "").trim().toLowerCase();
  if (parsed.qr !== input.qrCodeIdentifier || parsed.b !== expectedBusinessSlug) {
    return { ok: false as const, reason: "mismatch" as const };
  }

  return { ok: true as const };
}
