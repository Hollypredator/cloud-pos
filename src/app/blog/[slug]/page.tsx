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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-10 md:px-8">
      <main className="mx-auto max-w-6xl space-y-8">
        <Link href="/blog" className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Bloga Don
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          {post.cover_image_url ? (
            <img src={post.cover_image_url} alt={post.title} className="h-[320px] w-full object-cover md:h-[420px]" />
          ) : null}
          <div className="p-8 md:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {formatDate(post.published_at, post.created_at)} • {readingTime(post.body)} dk okuma
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">{post.title}</h1>
            {post.excerpt ? <p className="mt-5 text-lg leading-8 text-slate-600">{post.excerpt}</p> : null}
            <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-700">{post.body}</div>
          </div>
        </article>

        {relatedPosts.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ilgili Yazilar</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Okumaya devam et</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {relatedPosts.map((item) => (
                <article key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    {formatDate(item.published_at, item.created_at)} • {readingTime(item.body)} dk
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.excerpt || item.body.slice(0, 120)}</p>
                  <Link href={`/blog/${item.slug}`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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
