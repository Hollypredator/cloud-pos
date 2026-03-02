import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug, listBlogPosts } from "@/lib/data";

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

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ post }, { posts }] = await Promise.all([getBlogPostBySlug(slug, false), listBlogPosts(false)]);

  if (!post) {
    notFound();
  }

  const relatedPosts = posts.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-3 py-5 sm:px-4 sm:py-8 md:px-8 md:py-10">
      <main className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <Link href="/blog" className="inline-flex w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 sm:w-auto">
          Bloga Don
        </Link>

        <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:rounded-[2rem]">
          {post.cover_image_url ? (
            <img src={post.cover_image_url} alt={post.title} className="h-[220px] w-full object-cover sm:h-[320px] md:h-[420px]" />
          ) : null}
          <div className="p-5 sm:p-7 md:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {formatDate(post.published_at, post.created_at)} • {readingTime(post.body)} dk okuma
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">{post.title}</h1>
            {post.excerpt ? <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{post.excerpt}</p> : null}
            <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">{post.body}</div>
          </div>
        </article>

        {relatedPosts.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ilgili Yazilar</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Okumaya devam et</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedPosts.map((item) => (
                <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    {formatDate(item.published_at, item.created_at)} • {readingTime(item.body)} dk
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.excerpt || item.body.slice(0, 120)}</p>
                  <Link href={`/blog/${item.slug}`} className="mt-4 inline-flex w-full rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">
                    Ac
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
