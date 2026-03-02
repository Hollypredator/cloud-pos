"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
}: {
  items?: Array<{ href: string; label: string }>;
  className?: string;
  tone?: "light" | "dark";
}) {
  const pathname = usePathname();
  const navItems = items ?? [
    { href: "/", label: "Ana Sayfa" },
    { href: "/blog", label: "Blog" },
    { href: "/demo", label: "Demo" },
    { href: "/login", label: "Personel Girisi" },
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
