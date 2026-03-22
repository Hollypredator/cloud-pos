import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const LOGIN_TIMEOUT_MS = 15_000;
const AJAX_LOGIN_MODE_HEADER = "x-cloudpos-login-mode";
const AJAX_LOGIN_MODE_VALUE = "ajax";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/ops");
  const mode = String(formData.get("mode") ?? "").trim().toLowerCase();
  const normalizedNext = next.startsWith("/") ? next : "/ops";
  const safeNext = normalizedNext;
  const wantsAjaxLoginResponse =
    request.headers.get(AJAX_LOGIN_MODE_HEADER) === AJAX_LOGIN_MODE_VALUE || mode === AJAX_LOGIN_MODE_VALUE;
  const buildErrorResponse = (path: string, message?: string) => {
    if (!wantsAjaxLoginResponse) {
      return NextResponse.redirect(new URL(path, request.url), 303);
    }
    return NextResponse.json(
      {
        ok: false,
        redirectTo: path,
        ...(message ? { message } : {}),
      },
      { status: 200 },
    );
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return buildErrorResponse("/login?error=Supabase%20env%20degiskenleri%20eksik.", "Supabase ayarlari eksik.");
  }

  if (!email || !password) {
    return buildErrorResponse("/login?error=E-posta%20ve%20sifre%20zorunlu.", "E-posta ve sifre zorunlu.");
  }

  const successResponse = wantsAjaxLoginResponse
    ? NextResponse.json({ ok: true, redirectTo: safeNext }, { status: 200 })
    : NextResponse.redirect(new URL(safeNext, request.url), 303);
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          successResponse.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      LOGIN_TIMEOUT_MS,
      "Giris istegi zaman asimina ugradi.",
    );
    if (error) {
      return buildErrorResponse(`/login?error=${encodeURIComponent(error.message)}`, error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Giris istegi basarisiz.";
    return buildErrorResponse(`/login?error=${encodeURIComponent(message)}`, message);
  }

  const hasAuthCookie = successResponse.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));
  if (!hasAuthCookie) {
    return buildErrorResponse(
      "/login?error=Oturum%20olusturulamadi.%20Lutfen%20tekrar%20deneyin.",
      "Oturum olusturulamadi. Lutfen tekrar deneyin.",
    );
  }

  return successResponse;
}
