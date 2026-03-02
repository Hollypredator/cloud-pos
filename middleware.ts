import { NextResponse, type NextRequest } from "next/server";

function normalizeHost(host: string | null) {
  return (host ?? "").toLowerCase().split(":")[0];
}

function withHostRouting(request: NextRequest) {
  const studioHost = normalizeHost(process.env.STUDIO_HOST ?? null);
  const appHost = normalizeHost(process.env.APP_HOST ?? null);
  const currentHost = normalizeHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  if (studioHost && currentHost === studioHost) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/studio", request.url));
    }
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/studio/login", request.url));
    }
  }

  if (appHost && currentHost === appHost) {
    if (pathname === "/studio") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const hostResponse = withHostRouting(request);
  if (hostResponse) {
    return hostResponse;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
