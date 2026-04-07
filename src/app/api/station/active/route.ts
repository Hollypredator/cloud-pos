import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth";
import { ACTIVE_STATION_PROFILE_COOKIE, normalizeStationProfile } from "@/lib/business";

type Body = {
  stationProfile?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const auth = await getCurrentUserWithRole();
  if (!auth.user) {
    return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
  }

  const stationProfile = normalizeStationProfile(body.stationProfile);
  const requestProtocolRaw = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const secureCookie = requestProtocolRaw.split(",")[0]?.trim().toLowerCase() === "https";

  const response = NextResponse.json({ ok: true, stationProfile });
  response.cookies.set(ACTIVE_STATION_PROFILE_COOKIE, stationProfile, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
