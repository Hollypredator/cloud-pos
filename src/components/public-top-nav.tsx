"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPublicCopy, type AppLocale } from "@/lib/i18n";

function linkClass(active: boolean, tone: "light" | "dark") {
  if (tone === "dark") {
    return active
      ? "rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
      : "rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10";
  }

    return active
      ? "w-full rounded-2xl bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto"
      : "w-full rounded-2xl border border-slate-300/80 bg-white/70 px-4 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white sm:w-auto";
  }

export function PublicTopNav({
  items,
  className = "",
  tone = "light",
  locale = "tr",
}: {
  items?: Array<{ href: string; label: string }>;
  className?: string;
  tone?: "light" | "dark";
  locale?: AppLocale;
}) {
  const pathname = usePathname();
  const copy = getPublicCopy(locale);
  const navItems = items ?? [
    { href: "/", label: copy.nav.home },
    { href: "/blog", label: copy.nav.blog },
    { href: "/demo", label: copy.nav.demo },
    { href: "/login", label: copy.nav.staffLogin },
  ];

  return (
    <div className={`flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap ${className}`.trim()}>
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={linkClass(active, tone)}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
