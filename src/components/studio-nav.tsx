"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/studio", label: "Genel Bakış" },
  { href: "/studio/content", label: "İçerik" },
  { href: "/studio/demo", label: "Demo" },
  { href: "/studio/settings", label: "Ayarlar" },
  { href: "/studio/seo", label: "SEO" },
  { href: "/studio/media", label: "Medya" },
  { href: "/studio/blog", label: "Blog" },
  { href: "/studio/leads", label: "Leadler" },
  { href: "/studio/access", label: "Erişim" },
  { href: "/studio/onboarding", label: "Wizard" },
];

export function StudioNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition ${
              active
                ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                : "border border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
