import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const LOGIN_TIMEOUT_MS = 15_000;
const AJAX_LOGIN_MODE_HEADER = "x-cloudpos-login-mode";
const AJAX_LOGIN_MODE_VALUE = "ajax";

function normalizeRetryEmail(rawEmail: string) {
  return rawEmail
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeRetryPassword(rawPassword: string) {
  return rawPassword
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function toFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya sifre hatali görünuyor. Kopyala-yapistir yaptiysaniz basta/sonda bosluk olmadigindan emin olun.";
  }
  if (normalized.includes("email not confirmed")) {
    return "E-posta dogrulamasi tamamlanmamis. Lütfen e-posta kutunuzu kontrol edin.";
  }
  return message;
}

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
    const retryEmail = normalizeRetryEmail(email);
    const retryPassword = normalizeRetryPassword(password);

    const firstAttempt = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      LOGIN_TIMEOUT_MS,
      "Giriş isteği zaman aşımına uğradı.",
    );

    let signInError = firstAttempt.error ?? null;
    if (
      signInError &&
      signInError.message.toLowerCase().includes("invalid login credentials") &&
      (retryEmail !== email || retryPassword !== password)
    ) {
      const retryAttempt = await withTimeout(
        supabase.auth.signInWithPassword({ email: retryEmail, password: retryPassword }),
        LOGIN_TIMEOUT_MS,
        "Giriş isteği zaman aşımına uğradı.",
      );
      signInError = retryAttempt.error ?? null;
    }

    if (signInError) {
      const friendlyMessage = toFriendlyAuthError(signInError.message);
      return buildErrorResponse(`/login?error=${encodeURIComponent(friendlyMessage)}`, friendlyMessage);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Giriş isteği başarısız.";
    return buildErrorResponse(`/login?error=${encodeURIComponent(message)}`, message);
  }

  const hasAuthCookie = successResponse.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));
  if (!hasAuthCookie) {
    return buildErrorResponse(
      "/login?error=Oturum%20oluşturulamad?.%20Lütfen%20tekrar%20deneyin.",
      "Oturum oluşturulamad?. Lütfen tekrar deneyin.",
    );
  }

  return successResponse;
}
