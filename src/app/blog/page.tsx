import Link from "next/link";
import { listBlogPosts } from "@/lib/data";

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-10 md:px-8">
      <main className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Cloud POS Blog</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Duyurular, operasyon notlari ve saha icgoruleri</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              Restoran operasyonu, QR siparis, kasa akislar ve sahada ogrendigimiz karar kaliplariyla ilgili yayinlar.
            </p>
          </div>
          <Link href="/" className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Ana Sayfa
          </Link>
        </header>

        {featured ? (
          <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-8 md:p-10">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  One cikan yazi • {formatDate(featured.published_at, featured.created_at)} • {readingTime(featured.body)} dk
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">{featured.title}</h2>
                <p className="mt-4 text-lg leading-8 text-slate-600">{featured.excerpt || featured.body.slice(0, 240)}</p>
                <Link href={`/blog/${featured.slug}`} className="mt-8 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                  Yaziyi Oku
                </Link>
              </div>
              {featured.cover_image_url ? (
                <img src={featured.cover_image_url} alt={featured.title} className="h-full min-h-[320px] w-full object-cover" />
              ) : (
                <div className="bg-slate-950/95 p-10 text-white">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Kapak yok</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">{featured.title}</p>
                </div>
              )}
            </div>
          </article>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt={post.title} className="h-52 w-full object-cover" />
              ) : (
                <div className="h-52 bg-slate-900" />
              )}
              <div className="p-6">
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
