import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeLocale, type AppLocale } from "@/lib/i18n";

export async function getCurrentLocale(): Promise<AppLocale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE_NAME)?.value);
}
