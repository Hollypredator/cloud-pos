import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LandingVisualEditor } from "@/components/landing-visual-editor";
import { requireStudioAccess } from "@/lib/auth";
import {
  createSitePage,
  deleteSitePage,
  getGeneralSettings,
  getSitePageContent,
  listSitePages,
  resetSitePageToEmpty,
  updateLandingContent,
} from "@/lib/data";
import { defaultLandingContent, normalizeLandingContent, type LandingContent } from "@/lib/site-content";

function readValue(formData: FormData, key: string, fallback: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLandingContent(formData: FormData): LandingContent {
  return normalizeLandingContent({
    pageTitle: readValue(formData, "pageTitle", defaultLandingContent.pageTitle),
    topLoginLabel: readValue(formData, "topLoginLabel", defaultLandingContent.topLoginLabel),
    topDemoLabel: readValue(formData, "topDemoLabel", defaultLandingContent.topDemoLabel),
    businessPhone: readValue(formData, "businessPhone", defaultLandingContent.businessPhone),
    sections: readJsonField(formData, "sectionsJson", defaultLandingContent.sections),
  });
}

async function updateLandingContentAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/content");

  const slug = readValue(formData, "pageSlug", "home");
  const content = readLandingContent(formData);
  await updateLandingContent(content, slug);

  revalidatePath("/");
  if (slug !== "home") {
    revalidatePath(`/${slug}`);
  }
  revalidatePath("/studio/content");
}

async function createSitePageAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/content");

  const slug = readValue(formData, "slug", "");
  const pageTitle = readValue(formData, "pageTitle", "Yeni Sayfa");
  const result = await createSitePage({ slug, pageTitle });
  if (!result.ok || !result.slug) {
    redirect(`/studio/content?error=${encodeURIComponent(result.error ?? "Sayfa oluşturulamadı.")}`);
  }

  revalidatePath("/");
  revalidatePath("/studio/content");
  redirect(`/studio/content?slug=${encodeURIComponent(result.slug)}`);
}

async function deleteSitePageAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/content");

  const slug = readValue(formData, "slug", "");
  const result = await deleteSitePage(slug);
  if (!result.ok) {
    redirect(`/studio/content?error=${encodeURIComponent(result.error ?? "Sayfa silinemedi.")}`);
  }

  revalidatePath("/");
  revalidatePath(slug ? `/${slug}` : "/");
  revalidatePath("/studio/content");
  redirect("/studio/content");
}

async function resetSitePageAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/content");

  const slug = readValue(formData, "slug", "home");
  const result = await resetSitePageToEmpty(slug);
  if (!result.ok) {
    redirect(`/studio/content?slug=${encodeURIComponent(slug)}&error=${encodeURIComponent(result.error ?? "Sayfa sifirlanamadi.")}`);
  }

  revalidatePath("/");
  if (slug !== "home") {
    revalidatePath(`/${slug}`);
  }
  revalidatePath("/studio/content");
  redirect(`/studio/content?slug=${encodeURIComponent(slug)}`);
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; error?: string }>;
}) {
  await requireStudioAccess("/studio/content");
  const { slug, error } = await searchParams;
  const activeSlug = typeof slug === "string" && slug.trim() ? slug.trim() : "home";
  const [{ content, usingDemoData }, { settings }, { pages }] = await Promise.all([
    getSitePageContent(activeSlug),
    getGeneralSettings(),
    listSitePages(),
  ]);
  const activePage = pages.find((page) => page.slug === activeSlug) ?? pages[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <main className="mx-auto w-full max-w-[2240px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio CMS</p>
            <h1 className="text-3xl font-semibold text-slate-900">Landing Builder</h1>
            {activePage ? (
              <p className="mt-2 text-sm text-slate-600">
                Duzenlenen sayfa: <span className="font-semibold text-slate-900">{activePage.isHome ? "Ana Sayfa" : activePage.title}</span>{" "}
                <span className="text-slate-400">({activePage.path})</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={activeSlug === "home" ? "/" : `/${activeSlug}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Sayfayi Ac
            </Link>
          </div>
        </header>

        {error ? <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            `site_content` tablosu okunamadi. Varsayilan landing icerigi gosteriliyor.
          </p>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sayfalar</p>
              <div className="flex flex-wrap gap-3">
                {pages.map((page) => (
                    <div
                      key={page.slug}
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
                        page.slug === activeSlug ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{page.isHome ? "Ana Sayfa" : page.title}</p>
                      <p className={`text-xs ${page.slug === activeSlug ? "text-white/70" : "text-slate-500"}`}>{page.path}</p>
                      {page.isHome && page.title && page.title !== "Ana Sayfa" ? (
                        <p className={`text-[11px] ${page.slug === activeSlug ? "text-white/55" : "text-slate-400"}`}>
                          Icerik basligi: {page.title}
                        </p>
                      ) : null}
                      </div>
                    <Link
                      href={`/studio/content?slug=${encodeURIComponent(page.slug)}`}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        page.slug === activeSlug ? "bg-white text-slate-950" : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      Duzenle
                    </Link>
                    <Link
                      href={page.path}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        page.slug === activeSlug
                          ? "border border-white/25 text-white"
                          : "border border-slate-300 bg-slate-100 text-slate-700"
                      }`}
                    >
                      Ac
                    </Link>
                    {!page.isHome ? (
                      <form action={deleteSitePageAction}>
                        <input type="hidden" name="slug" value={page.slug} />
                        <button
                          type="submit"
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            page.slug === activeSlug
                              ? "border border-rose-300/40 bg-rose-500/10 text-rose-100"
                              : "border border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          Sil
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <form action={createSitePageAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[180px_220px_auto]">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug</label>
                <input
                  name="slug"
                  placeholder="Bos birakirsan basliktan uretilir"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sayfa Basligi</label>
                <input
                  name="pageTitle"
                  placeholder="Hakkimizda"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                Yeni Sayfa Ac
              </button>
            </form>
          </div>
        </section>

        {activePage ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sayfa Islemeleri</p>
              <p className="mt-1 text-sm text-slate-600">
                {activePage.path} için builder icerigini yonetiyorsun. Test sayfalari için boş bir canvas gerekiyorsa buradan sifirlayabilirsin.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!activePage.isHome ? (
                <form action={resetSitePageAction}>
                  <input type="hidden" name="slug" value={activePage.slug} />
                  <button
                    type="submit"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
                  >
                    Bos Sayfaya Sifirla
                  </button>
                </form>
              ) : null}
              <Link
                href={activePage.path}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Public Sayfayi Ac
              </Link>
            </div>
          </section>
        ) : null}

        <LandingVisualEditor pageSlug={activeSlug} content={content} settings={settings} action={updateLandingContentAction} />
      </main>
    </div>
  );
}
