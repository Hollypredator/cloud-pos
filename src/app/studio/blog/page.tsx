import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioAccess } from "@/lib/auth";
import { deleteBlogPost, listBlogPosts, upsertBlogPost } from "@/lib/data";

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function estimateReadingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function saveBlogPostAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/blog");

  const title = String(formData.get("title") ?? "");
  const manualSlug = String(formData.get("slug") ?? "");
  const result = await upsertBlogPost({
    id: String(formData.get("id") ?? "") || undefined,
    title,
    slug: manualSlug || toSlug(title),
    excerpt: String(formData.get("excerpt") ?? ""),
    body: String(formData.get("body") ?? ""),
    coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
    status: String(formData.get("status") ?? "draft") as "draft" | "published",
  });

  revalidatePath("/studio/blog");
  revalidatePath("/blog");

  if (!result.ok) {
    redirect(`/studio/blog?error=${encodeURIComponent(result.error ?? "Yazi kaydedilemedi.")}`);
  }

  redirect(`/studio/blog?edit=${encodeURIComponent(manualSlug || toSlug(title))}`);
}

async function deleteBlogPostAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/blog");

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/studio/blog?error=Silinecek yazi bulunamadi.");
  }

  const result = await deleteBlogPost(id);
  revalidatePath("/studio/blog");
  revalidatePath("/blog");

  if (!result.ok) {
    redirect(`/studio/blog?error=${encodeURIComponent(result.error ?? "Yazi silinemedi.")}`);
  }

  redirect("/studio/blog");
}

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  await requireStudioAccess("/studio/blog");
  const { edit, error } = await searchParams;
  const { posts, usingDemoData } = await listBlogPosts(true);
  const selectedPost = edit ? posts.find((post) => post.slug === edit) ?? null : posts[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio Blog</p>
            <h1 className="text-3xl font-semibold text-slate-900">Blog ve duyuru merkezi</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/blog" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Blogu Ac
            </Link>
            <Link href="/studio/blog" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Yeni Yazi
            </Link>
          </div>
        </header>

        {usingDemoData ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo blog verisi gosteriliyor.</p> : null}
        {error ? <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900">{error}</p> : null}

        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Yazi Havuzu</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{posts.length} yazi</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/studio/blog?edit=${encodeURIComponent(post.slug)}`}
                  className={`block rounded-2xl border p-4 transition ${
                    selectedPost?.id === post.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${selectedPost?.id === post.id ? "bg-white/10 text-slate-200" : "bg-white text-slate-500"}`}>
                      {post.status}
                    </span>
                    <span className={`text-xs ${selectedPost?.id === post.id ? "text-slate-300" : "text-slate-500"}`}>
                      {estimateReadingTime(post.body)} dk
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
                  <p className={`mt-2 line-clamp-2 text-sm leading-6 ${selectedPost?.id === post.id ? "text-slate-300" : "text-slate-600"}`}>
                    {post.excerpt || post.body}
                  </p>
                </Link>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Editor</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {selectedPost ? "Yaziyi duzenle" : "Yeni yazi olustur"}
                  </h2>
                </div>
                {selectedPost ? (
                  <div className="flex gap-3">
                    <Link href={`/blog/${selectedPost.slug}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      Public Ac
                    </Link>
                    <form action={deleteBlogPostAction}>
                      <input type="hidden" name="id" value={selectedPost.id} />
                      <button type="submit" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                        Sil
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

              <form action={saveBlogPostAction} className="mt-6">
                <input type="hidden" name="id" value={selectedPost?.id ?? ""} />

                <div className="grid gap-4">
                  <input
                    name="title"
                    defaultValue={selectedPost?.title ?? ""}
                    placeholder="Yazi basligi"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <input
                      name="slug"
                      defaultValue={selectedPost?.slug ?? ""}
                      placeholder="slug"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                    <select
                      name="status"
                      defaultValue={selectedPost?.status ?? "draft"}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    >
                      <option value="draft">Taslak</option>
                      <option value="published">Yayinlandi</option>
                    </select>
                  </div>
                  <input
                    name="coverImageUrl"
                    defaultValue={selectedPost?.cover_image_url ?? ""}
                    placeholder="Kapak gorsel URL"
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <textarea
                    name="excerpt"
                    defaultValue={selectedPost?.excerpt ?? ""}
                    placeholder="Kisa ozet"
                    rows={3}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                  <textarea
                    name="body"
                    defaultValue={selectedPost?.body ?? ""}
                    placeholder="Yazi icerigi"
                    rows={16}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    {selectedPost ? `Son guncelleme: ${new Date(selectedPost.updated_at).toLocaleString("tr-TR")}` : "Yeni yazi olusturuyorsun."}
                  </div>
                  <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                    Yaziyi Kaydet
                  </button>
                </div>
              </form>
            </div>

            {selectedPost ? (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Onizleme</p>
                {selectedPost.cover_image_url ? (
                  <img src={selectedPost.cover_image_url} alt={selectedPost.title} className="mt-4 h-64 w-full rounded-[1.5rem] object-cover" />
                ) : null}
                <h3 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">{selectedPost.title}</h3>
                {selectedPost.excerpt ? <p className="mt-3 text-lg leading-8 text-slate-600">{selectedPost.excerpt}</p> : null}
                <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-slate-700">{selectedPost.body}</div>
              </article>
            ) : null}
          </section>
        </section>
      </main>
    </div>
  );
}
