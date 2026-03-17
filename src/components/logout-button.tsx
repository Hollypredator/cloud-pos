"use client";

import { useRouter } from "next/navigation";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export function LogoutButton({ redirectPath = "/login" }: { redirectPath?: string }) {
  const router = useRouter();

  async function onLogout() {
    const supabase = getSupabaseAuthBrowserClient();
    if (!supabase) {
      return;
    }
    try {
      const storage = window.sessionStorage;
      const keysToDelete: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (typeof key === "string" && key.startsWith("app-shell-cache")) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        storage.removeItem(key);
      }
    } catch {}

    await supabase.auth.signOut();
    window.dispatchEvent(new CustomEvent("app-shell:refresh"));
    router.replace(redirectPath);
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
