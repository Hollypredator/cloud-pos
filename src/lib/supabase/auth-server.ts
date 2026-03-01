import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Next.js only allows mutating cookies in Server Actions / Route Handlers.
        // During normal Server Component render, Supabase may still attempt a write.
        // Ignore those writes here and let dedicated auth handlers own cookie updates.
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {}
      },
    },
  });
}
