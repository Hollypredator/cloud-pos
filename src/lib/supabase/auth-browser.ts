"use client";

import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseAuthBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, anonKey);
}

