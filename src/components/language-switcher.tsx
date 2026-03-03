"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLocaleOptions, type AppLocale } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  label,
  compact = false,
}: {
  locale: AppLocale;
  label: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const options = getLocaleOptions();

  if (options.length <= 1) {
    return null;
  }

  return (
    <label className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} font-medium text-slate-600`}>
      <span>{label}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value;
          startTransition(async () => {
            await fetch("/api/locale", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locale: nextLocale }),
            });
            router.refresh();
            router.replace(pathname);
          });
        }}
        className="rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
