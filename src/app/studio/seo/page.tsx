import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/auth";
import { getSeoSettings, updateSeoSettings } from "@/lib/data";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function updateSeoSettingsAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/seo");

  await updateSeoSettings({
    metaTitle: readString(formData, "metaTitle"),
    metaDescription: readString(formData, "metaDescription"),
    ogTitle: readString(formData, "ogTitle"),
    ogDescription: readString(formData, "ogDescription"),
    ogImageUrl: readString(formData, "ogImageUrl"),
    twitterHandle: readString(formData, "twitterHandle"),
    canonicalUrl: readString(formData, "canonicalUrl"),
    indexable: formData.get("indexable") === "on",
  });

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/studio/seo");
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} defaultValue={defaultValue} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
    </label>
  );
}

export default async function AdminSeoPage() {
  await requireStudioAccess("/studio/seo");
  const { settings } = await getSeoSettings();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio SEO</p>
            <h1 className="text-3xl font-semibold text-slate-900">Meta ve indeksleme ayarlari</h1>
          </div>
          <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Siteyi Ac</Link>
        </header>

        <form action={updateSeoSettingsAction} className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-4">
            <Field label="Meta title" name="metaTitle" defaultValue={settings.metaTitle} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Meta description</span>
              <textarea
                name="metaDescription"
                rows={4}
                defaultValue={settings.metaDescription}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Open Graph title" name="ogTitle" defaultValue={settings.ogTitle} />
              <Field label="Twitter handle" name="twitterHandle" defaultValue={settings.twitterHandle} />
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Open Graph description</span>
              <textarea
                name="ogDescription"
                rows={4}
                defaultValue={settings.ogDescription}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Open Graph image URL" name="ogImageUrl" defaultValue={settings.ogImageUrl} />
              <Field label="Canonical URL" name="canonicalUrl" defaultValue={settings.canonicalUrl} />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" name="indexable" defaultChecked={settings.indexable} />
              Arama motorlari sayfayi indekslesin
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
              SEO Ayarlarini Kaydet
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
