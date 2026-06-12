"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export function LogoutButton({
  redirectPath = "/login",
  className,
  label = "Çıkış",
  showIcon = false,
}: {
  redirectPath?: string;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
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

    window.dispatchEvent(new CustomEvent("app-shell:sw-clear"));
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("ops-")).map((key) => caches.delete(key)));
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
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
      }
    >
      {showIcon ? <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} /> : null}
      {label}
    </button>
  );
}
