import { cache } from "react";
import { cookies } from "next/headers";
import { ACTIVE_STATION_PROFILE_COOKIE, normalizeStationProfile } from "@/lib/business";

export const getActiveStationProfile = cache(async () => {
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_STATION_PROFILE_COOKIE)?.value;
  return normalizeStationProfile(cookieValue);
});
