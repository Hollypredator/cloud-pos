import { revalidatePath } from "next/cache";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportKnowledgeArticles, upsertSupportKnowledgeArticle } from "@/lib/data";

async function upsertKnowledgeAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/knowledge", ["support_admin"]);
  await upsertSupportKnowledgeArticle({
    id: String(formData.get("id") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? "general"),
    summary: String(formData.get("summary") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  revalidatePath("/support/knowledge");
  revalidatePath("/support/audit");
}

export default async function SupportKnowledgePage() {
  await requireSupportAccess("/support/knowledge");
  const { articles } = await listSupportKnowledgeArticles();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Knowledge</p>
        <h1 className="text-3xl font-semibold text-slate-900">Playbook ve referans merkezi</h1>
      </header>

      <form action={upsertKnowledgeAction} className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <input name="title" placeholder="Makale basligi" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
          <input name="category" placeholder="Kategori" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="summary" placeholder="Kisa ozet" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <textarea name="body" rows={5} placeholder="Makale icerigi" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Makale Kaydet</button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <article key={article.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{article.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{article.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{article.summary}</p>
            <p className="mt-4 text-sm text-slate-500">{article.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
