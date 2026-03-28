import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth";
import { ACTIVE_BUSINESS_COOKIE, normalizeBusinessSlug } from "@/lib/business";

type Body = {
  slug?: string;
};

export async function POST(request: Request) {
  const auth = await getCurrentUserWithRole();
  if (!auth.user) {
    return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Geçersiz istek govdesi." }, { status: 400 });
  }

  if (!body.slug) {
    return NextResponse.json({ ok: false, message: "slug gerekli." }, { status: 400 });
  }

  const slug = normalizeBusinessSlug(body.slug);
  const requestProtocolRaw = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const secureCookie = requestProtocolRaw.split(",")[0]?.trim().toLowerCase() === "https";
  const response = NextResponse.json({ ok: true, slug });
  response.cookies.set(ACTIVE_BUSINESS_COOKIE, slug, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
