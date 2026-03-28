"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { normalizeLocale, translateUiText } from "@/lib/i18n";

const links = [
  { href: "/support", label: "Genel Bakis" },
  { href: "/support/tenants", label: "Tenantlar" },
  { href: "/support/tickets", label: "Talepler" },
  { href: "/support/incidents", label: "Incidents" },
  { href: "/support/billing", label: "Billing" },
  { href: "/support/plan-requests", label: "Paket Talepleri" },
  { href: "/support/onboarding", label: "Onboarding" },
  { href: "/support/health", label: "Health" },
  { href: "/support/feature-flags", label: "Flags" },
  { href: "/support/team", label: "Ekip" },
  { href: "/support/knowledge", label: "Knowledge" },
  { href: "/support/audit", label: "Audit" },
  { href: "/support/access", label: "Erişim" },
];

export function SupportNav() {
  const pathname = usePathname();
  const locale = typeof document === "undefined" ? "tr" : normalizeLocale(document.documentElement.lang || "tr");

  return (
    <nav className="flex flex-wrap gap-3">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {translateUiText(link.label, locale)}
          </Link>
        );
      })}
    </nav>
  );
}
