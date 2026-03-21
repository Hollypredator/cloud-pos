import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth";
import { ACTIVE_BRANCH_COOKIE, ALL_BRANCHES_VALUE, normalizeBranchId } from "@/lib/business";

type Body = {
  branchId?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const branchId = normalizeBranchId(body.branchId);
  const auth = await getCurrentUserWithRole();
  if (!auth.user) {
    return NextResponse.json({ ok: false, message: "Yetkisiz" }, { status: 401 });
  }
  if (auth.accessScope === "branch") {
    if (!auth.primaryBranchId || (branchId && branchId !== auth.primaryBranchId)) {
      return NextResponse.json({ ok: false, message: "Bu kullanici yalnizca atanmis subeyi gorebilir." }, { status: 403 });
    }
  } else if (branchId === ALL_BRANCHES_VALUE) {
    // allowed only for business-scope users
  }
  const requestProtocolRaw = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const secureCookie = requestProtocolRaw.split(",")[0]?.trim().toLowerCase() === "https";
  const response = NextResponse.json({ ok: true, branchId });
  response.cookies.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
