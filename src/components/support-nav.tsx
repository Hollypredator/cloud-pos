"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/support", label: "Genel Bakış" },
  { href: "/support/tenants", label: "Tenantlar" },
  { href: "/support/tickets", label: "Talepler" },
  { href: "/support/incidents", label: "Incidentler" },
  { href: "/support/billing", label: "Billing" },
  { href: "/support/plan-requests", label: "Paket Talepleri" },
  { href: "/support/onboarding", label: "Onboarding" },
  { href: "/support/health", label: "Sağlık" },
  { href: "/support/feature-flags", label: "Flags" },
  { href: "/support/team", label: "Ekip" },
  { href: "/support/knowledge", label: "Bilgi Bankası" },
  { href: "/support/audit", label: "Audit" },
  { href: "/support/access", label: "Erişim" },
];

export function SupportNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition ${
              active
                ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                : "border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
