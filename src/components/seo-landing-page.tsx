import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { PublicTopNav } from "@/components/public-top-nav";
import type { SeoLandingPage } from "@/lib/seo-landing-pages";

export function SeoLandingPageView({
  page,
  relatedPages,
}: {
  page: SeoLandingPage;
  relatedPages: Array<Pick<SeoLandingPage, "slug" | "title" | "description">>;
}) {
  const isEnglish = page.locale === "en";
  const copy = isEnglish
    ? {
        demo: "View demo",
        login: "Operations panel login",
        searchFocus: "Search focus",
        lightweightTitle: "Lightweight SEO page",
        lightweightBody: "This page is powered by static content, metadata and FAQ schema; it does not run extra operations queries.",
        faqEyebrow: "FAQ",
        faqTitle: "Questions to answer before choosing a POS system",
        relatedEyebrow: "Related solution pages",
        relatedTitle: "Other QUAPOS pages for similar search intent",
        relatedCta: "Explore the product flow",
        navItems: [
          { href: "/", label: "Home" },
          { href: "/en/restaurant-pos-system", label: "Restaurant POS" },
          { href: "/en/qr-menü-system", label: "QR menü" },
          { href: "/demo", label: "Demo" },
        ],
      }
    : {
        demo: "Demoyu incele",
        login: "Operasyon paneli girişi",
        searchFocus: "Arama odağı",
        lightweightTitle: "Yük bindirmeyen sayfa",
        lightweightBody: "Bu sayfa statik içerik, metadata ve FAQ şemasıyla çalışır; ekstra operasyon sorgusu çalıştırmaz.",
        faqEyebrow: "Sık sorulanlar",
        faqTitle: "Karar vermeden önce netleşmesi gerekenler",
        relatedEyebrow: "İlgili çözüm sayfaları",
        relatedTitle: "Benzer arama niyetleri için diğer QUAPOS sayfaları",
        relatedCta: "Ürünü canlı akışla incele",
        navItems: undefined,
      };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_48%,#ffffff_100%)] text-slate-950">
      <header className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3 text-sm font-bold text-slate-950">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white">CP</span>
          QUAPOS
        </Link>
        <PublicTopNav items={copy.navItems} />
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-16 lg:pt-10">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">
              {page.eyebrow}
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {page.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{page.heroLead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                {copy.demo}
                <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400">
                {copy.login}
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{copy.searchFocus}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{page.primaryKeyword}</p>
              </div>
              <Search aria-hidden="true" className="h-7 w-7 text-cyan-600" strokeWidth={2.1} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {page.relatedKeywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  {keyword}
                </span>
              ))}
            </div>
            {page.locality ? (
              <div className="mt-5 rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">{page.locality.region}</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{page.locality.city}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{page.locality.scenario}</p>
              </div>
            ) : null}
            <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" strokeWidth={2.1} />
                <div>
                  <p className="font-semibold">{copy.lightweightTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{copy.lightweightBody}</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
              <ul className="mt-5 space-y-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm font-medium text-slate-800">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.2} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{copy.faqEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {page.faq.map((item) => (
              <article key={item.question} className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-950">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">{copy.relatedEyebrow}</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{copy.relatedTitle}</h2>
              </div>
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
                {copy.relatedCta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              </Link>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {relatedPages.map((item) => (
                <Link key={item.slug} href={`/${item.slug}`} className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
