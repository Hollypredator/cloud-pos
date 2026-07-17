import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
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
        faqEyebrow: "FAQ",
        faqTitle: "Questions to answer before choosing a POS system",
        relatedEyebrow: "Related solution pages",
        relatedTitle: "Other Cloud POS pages for similar search intent",
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
        faqEyebrow: "Sık sorulanlar",
        faqTitle: "Karar vermeden önce netleşmesi gerekenler",
        relatedEyebrow: "İlgili çözüm sayfaları",
        relatedTitle: "Benzer arama niyetleri için diğer Cloud POS sayfaları",
        relatedCta: "Ürünü canlı akışla incele",
        navItems: undefined,
      };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Light Glass Header */}
      <header className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="inline-flex items-center gap-3 text-sm font-bold text-slate-900">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <span className="font-extrabold text-sm">CP</span>
          </div>
          Cloud POS
        </Link>
        <PublicTopNav items={copy.navItems} />
      </header>

      <main>
        {/* Clean Hero Layout */}
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl space-y-6">
            <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
              {page.eyebrow}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.1]">
              {page.heroTitle}
            </h1>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">{page.heroLead}</p>
            <div className="flex flex-col gap-3 sm:flex-row pt-4">
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 cursor-pointer">
                {copy.demo}
                <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer">
                {copy.login}
              </Link>
            </div>
          </div>

          {/* Premium Tablet Mockup Replacing Placeholder Aside */}
          <div className="relative flex items-center justify-center lg:pl-10">
            <div className="relative rounded-[2rem] overflow-hidden border border-slate-200 bg-white p-3 shadow-2xl w-full">
              <Image 
                className="w-full h-auto rounded-2xl border border-slate-100" 
                alt="Cloud POS Tablet Register Arayüzü"
                src="/landing-assets/operasyon-paneli-desktop.png"
                width={780}
                height={520}
                priority
              />
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-12 md:grid-cols-3">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{section.body}</p>
              </div>
              <ul className="mt-6 space-y-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5 text-xs font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        {/* FAQ Section */}
        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr] border-t border-slate-200/50">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{copy.faqEyebrow}</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-4">
            {page.faq.map((item) => (
              <article key={item.question} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-bold text-slate-900">{item.question}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Bottom Banner */}
        <section className="mx-auto max-w-7xl px-6 pb-16 pt-4">
          <div className="rounded-[2rem] bg-slate-900 p-8 text-white sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">{copy.relatedEyebrow}</p>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{copy.relatedTitle}</h2>
              </div>
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-950 hover:bg-slate-50 cursor-pointer">
                {copy.relatedCta}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {relatedPages.map((item) => (
                <Link key={item.slug} href={`/${item.slug}`} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10 flex flex-col justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{item.title}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  </div>
                  <span className="text-xs text-amber-300 font-semibold mt-4 inline-flex items-center gap-1">İncele <ArrowRight className="w-3.5 h-3.5" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}
