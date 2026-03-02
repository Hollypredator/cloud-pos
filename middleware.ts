import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const authRoutePrefixes = ["/ops", "/kitchen", "/cashier", "/service-requests", "/tables", "/delivery", "/admin", "/studio", "/login", "/auth"];

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

  const needsAuthRefresh = authRoutePrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !needsAuthRefresh) {
    return NextResponse.next();
  }

  let response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
