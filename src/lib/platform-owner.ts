function normalizeEmailList(value?: string | null) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getDirectPlatformOwnerEmails() {
  return normalizeEmailList(process.env.PLATFORM_OWNER_EMAILS);
}

