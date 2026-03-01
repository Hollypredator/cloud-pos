"use client";

import { useRouter } from "next/navigation";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    const supabase = getSupabaseAuthBrowserClient();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
    >
      Cikis
    </button>
  );
}

