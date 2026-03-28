import Link from "next/link";

const links = [
  { href: "/studio/content", label: "Icerik" },
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
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
