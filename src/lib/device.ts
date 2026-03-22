const MOBILE_USER_AGENT_PATTERN =
  /\b(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|silk|kindle)\b/i;

export function isLikelyMobileUserAgent(userAgent: string | null | undefined) {
  return MOBILE_USER_AGENT_PATTERN.test(userAgent ?? "");
}
