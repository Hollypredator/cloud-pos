import type { Metadata } from "next";
import Link from "next/link";
import { PublicTopNav } from "@/components/public-top-nav";
import { getSeoSettings, listBlogPosts } from "@/lib/data";
import { buildPageMetadata, publicSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSeoSettings();

  return buildPageMetadata({
    title: publicSeo.blogTitle,
    description: publicSeo.blogDescription,
    path: "/blog",
    seoSettings: settings,
    image: settings.ogImageUrl || publicSeo.ogImage,
  });
}

function formatDate(value: string | null, fallback: string) {
  return new Date(value ?? fallback).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function readingTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 200));
}

export default async function BlogIndexPage() {
  const { posts } = await listBlogPosts(false);
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-3 py-5 sm:px-4 sm:py-8 md:px-8 md:py-10">
      <main className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <header className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Cloud POS Blog</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Duyurular, operasyon notlari ve saha icgoruleri</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
              Restoran operasyonu, QR sipariş, kasa akislar ve sahada ogrendigimiz karar kaliplariyla ilgili yayinlar.
            </p>
          </div>
          <PublicTopNav />
        </header>

        {featured ? (
          <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:rounded-[2rem]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-5 sm:p-7 md:p-10">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  One cikan yazi • {formatDate(featured.published_at, featured.created_at)} • {readingTime(featured.body)} dk
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{featured.title}</h2>
                <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{featured.excerpt || featured.body.slice(0, 240)}</p>
                <Link href={`/blog/${featured.slug}`} className="mt-8 inline-flex w-full rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white sm:w-auto">
                  Yaziyi Oku
                </Link>
              </div>
              {featured.cover_image_url ? (
                <img src={featured.cover_image_url} alt={featured.title} className="h-full min-h-[320px] w-full object-cover" />
              ) : (
                <div className="bg-slate-950/95 p-6 text-white sm:p-10">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Kapak yok</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">{featured.title}</p>
                </div>
              )}
            </div>
          </article>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm sm:rounded-[1.75rem]">
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt={post.title} className="h-52 w-full object-cover" />
              ) : (
                <div className="h-52 bg-slate-900" />
              )}
              <div className="p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  {formatDate(post.published_at, post.created_at)} • {readingTime(post.body)} dk
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">{post.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{post.excerpt || post.body.slice(0, 160)}</p>
                <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Devamini Oku
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
