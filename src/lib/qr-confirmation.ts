import { normalizeBusinessSlug } from "@/lib/business";

export type QrConfirmationRolloutMode = "off" | "allowlist" | "all";

export const QR_CONFIRMATION_WINDOW_SECONDS = 90;
export const QR_CONFIRMATION_RETENTION_DAYS = 90;
export const QR_CONFIRMATION_UI_VERSION = "qr-confirmation-v1";

function normalizeRolloutMode(value?: string | null): QrConfirmationRolloutMode {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "all") {
    return "all";
  }
  if (normalized === "allowlist") {
    return "allowlist";
  }
  return "off";
}

function parseAllowlist(value?: string | null) {
  const allowlist = new Set<string>();
  for (const segment of (value ?? "").split(",")) {
    const slug = normalizeBusinessSlug(segment);
    if (slug) {
      allowlist.add(slug);
    }
  }
  return allowlist;
}

export function getQrConfirmationRolloutMode() {
  return normalizeRolloutMode(process.env.QR_CONFIRMATION_ROLLOUT);
}

export function isQrConfirmationEnabledForBusinessSlug(businessSlug?: string | null) {
  const mode = getQrConfirmationRolloutMode();
  if (mode === "off") {
    return false;
  }
  if (mode === "all") {
    return true;
  }
  const slug = normalizeBusinessSlug(businessSlug ?? undefined);
  if (!slug) {
    return false;
  }
  return parseAllowlist(process.env.QR_CONFIRMATION_ALLOWLIST_SLUGS).has(slug);
}
