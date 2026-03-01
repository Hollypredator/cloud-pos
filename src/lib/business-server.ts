import { cookies } from "next/headers";
import { ACTIVE_BUSINESS_COOKIE, normalizeBusinessSlug } from "@/lib/business";

export async function getActiveBusinessSlug() {
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_BUSINESS_COOKIE)?.value;
  return normalizeBusinessSlug(cookieValue);
}
