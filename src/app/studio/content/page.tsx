import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowRight, Eye, Image, LayoutDashboard, PenLine, Smartphone, Store } from "lucide-react";
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
    redirect(`/studio/content?slug=${encodeURIComponent(slug)}&error=${encodeURIComponent(result.error ?? "Sayfa sıfırlanamadı.")}`);
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

  if (activeSlug === "home") {
    return (
      <div className="min-h-screen bg-[#f7f8fb] px-4 py-6 md:px-6">
        <main className="mx-auto w-full max-w-7xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Studio CMS</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Ana sayfa yönetimi</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Ana sayfa artık yeni Türkçe ürün vitriniyle render ediliyor. Eski visual builder bu sayfa için kapatıldı, çünkü yayındaki ana sayfayı temsil etmiyordu.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                Ana sayfayı aç
                <ArrowRight size={16} />
              </Link>
              <Link href="/studio/media" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800">
                Görseller
              </Link>
            </div>
          </header>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">{error}</p> : null}

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Aktif ana sayfa</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Cloud POS ürün vitrini</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Bu sayfa; self servis / QR akışı, kafe-restoran POS modülü, mobil PWA ekranları ve gerçek ürün görselleriyle hazırlanmış özel bir React yüzeyidir.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Store, title: "Ürün mesajı", body: "Self servis + kafe restoran POS" },
                  { icon: LayoutDashboard, title: "Gerçek dashboard", body: "Operasyon paneli ekran görüntüsü" },
                  { icon: Smartphone, title: "Mobil PWA", body: "Mobil operasyon ve sipariş görselleri" },
                  { icon: Image, title: "Asset yönetimi", body: "public/landing-assets üzerinden" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-3xl border border-slate-200 bg-[#f7f8fb] p-4">
                      <Icon size={22} className="text-orange-600" />
                      <p className="mt-3 text-sm font-bold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{item.body}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-950">Not</p>
                <p className="mt-2 text-sm leading-7 text-amber-900">
                  Ana sayfanın metin ve section yapısı şu anda CMS builder’dan değil, <code className="rounded bg-white/70 px-1">ProductLandingPage</code> component’inden geliyor. Bu yüzden eski builder burada gösterilmiyor.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-950/8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Canlı önizleme</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Yayındaki ana sayfa</h2>
                </div>
                <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800">
                  <Eye size={16} />
                  Aç
                </Link>
              </div>
              <div className="bg-slate-100 p-3">
                <iframe
                  src="/"
                  title="Ana sayfa canlı önizleme"
                  className="h-[680px] w-full rounded-[1.5rem] border border-slate-200 bg-white"
                />
              </div>
            </article>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Alt sayfalar</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Visual builder sadece ek sayfalar için kullanılır.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Eski builder; hakkımızda, kampanya veya özel landing gibi ek public sayfalar için aktif kalır.
                </p>
              </div>
              <form action={createSitePageAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-[#f7f8fb] p-4 md:grid-cols-[180px_220px_auto]">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Slug</label>
                  <input name="slug" placeholder="Örnek-sayfa" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sayfa başlığı</label>
                  <input name="pageTitle" placeholder="Hakkımızda" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
                </div>
                <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Yeni sayfa aç</button>
              </form>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {pages.map((page) => (
                <div key={page.slug} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${page.isHome ? "border-orange-200 bg-orange-50 text-orange-900" : "border-slate-200 bg-white text-slate-800"}`}>
                  <div>
                    <p className="text-sm font-bold">{page.isHome ? "Ana Sayfa" : page.title}</p>
                    <p className="text-xs font-semibold text-slate-500">{page.path}</p>
                  </div>
                  {page.isHome ? (
                    <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-orange-700">Özel tasarım</span>
                  ) : (
                    <Link href={`/studio/content?slug=${encodeURIComponent(page.slug)}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                      <PenLine size={14} />
                      Builder
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <main className="mx-auto w-full max-w-[2240px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio CMS</p>
            <h1 className="text-3xl font-semibold text-slate-900">Landing Builder</h1>
            {activePage ? (
              <p className="mt-2 text-sm text-slate-600">
                Düzenlenen sayfa: <span className="font-semibold text-slate-900">{activePage.isHome ? "Ana Sayfa" : activePage.title}</span>{" "}
                <span className="text-slate-400">({activePage.path})</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={activeSlug === "home" ? "/" : `/${activeSlug}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Sayfayı Aç
            </Link>
          </div>
        </header>

        {error ? <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
        {usingDemoData ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
            `site_content` tablosu okunamadı. Varsayılan landing içeriği gösteriliyor.
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
                          İçerik başlığı: {page.title}
                        </p>
                      ) : null}
                      </div>
                    <Link
                      href={`/studio/content?slug=${encodeURIComponent(page.slug)}`}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        page.slug === activeSlug ? "bg-white text-slate-950" : "border border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      Düzenle
                    </Link>
                    <Link
                      href={page.path}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        page.slug === activeSlug
                          ? "border border-white/25 text-white"
                          : "border border-slate-300 bg-slate-100 text-slate-700"
                      }`}
                    >
                      Aç
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
                  placeholder="Boş bırakırsan başlıktan üretilir"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sayfa Başlığı</label>
                <input
                  name="pageTitle"
                  placeholder="Hakkımızda"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                Yeni Sayfa Aç
              </button>
            </form>
          </div>
        </section>

        {activePage ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sayfa İşlemleri</p>
              <p className="mt-1 text-sm text-slate-600">
                {activePage.path} için builder içeriğini yönetiyorsun. Test sayfaları için boş bir canvas gerekiyorsa buradan sıfırlayabilirsin.
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
                    Boş Sayfaya Sıfırla
                  </button>
                </form>
              ) : null}
              <Link
                href={activePage.path}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Public Sayfayı Aç
              </Link>
            </div>
          </section>
        ) : null}

        <LandingVisualEditor pageSlug={activeSlug} content={content} settings={settings} action={updateLandingContentAction} />
      </main>
    </div>
  );
}
