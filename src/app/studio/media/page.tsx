import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/auth";
import { createMediaAsset, deleteMediaAsset, listMediaAssets, uploadMediaFile } from "@/lib/data";
import type { MediaAsset } from "@/lib/types";

async function createMediaAssetAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/media");

  const file = formData.get("file");
  const fileUpload = file instanceof File && file.size > 0 ? await uploadMediaFile(file) : null;

  if (fileUpload && !fileUpload.ok) {
    throw new Error(fileUpload.error);
  }

  const titleInput = String(formData.get("title") ?? "").trim();
  const fileUrlInput = String(formData.get("fileUrl") ?? "").trim();
  const resolvedFileUrl = fileUpload?.fileUrl ?? fileUrlInput;

  await createMediaAsset({
    title: titleInput || fileUpload?.title || "Yeni medya",
    fileUrl: resolvedFileUrl,
    altText: String(formData.get("altText") ?? ""),
    kind: (String(formData.get("kind") ?? "image") as MediaAsset["kind"]),
    storageBucket: fileUpload?.storageBucket ?? null,
    storagePath: fileUpload?.storagePath ?? null,
  });
  revalidatePath("/studio/media");
}

async function deleteMediaAssetAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/media");
  await deleteMediaAsset(String(formData.get("id") ?? ""));
  revalidatePath("/studio/media");
}

export default async function AdminMediaPage() {
  await requireStudioAccess("/studio/media");
  const { assets, usingDemoData } = await listMediaAssets();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Studio Medya</p>
            <h1 className="text-3xl font-semibold text-slate-900">Medya kutuphanesi</h1>
          </div>
          <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Siteyi Ac</Link>
        </header>

        {usingDemoData ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo medya kayitlari gosteriliyor.</p> : null}

        <form action={createMediaAssetAction} encType="multipart/form-data" className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <input name="title" placeholder="Baslik" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
            <select name="kind" className="rounded-xl border border-slate-300 px-4 py-3 text-sm">
              <option value="image">Gorsel</option>
              <option value="document">Dokuman</option>
              <option value="video">Video</option>
              <option value="other">Diger</option>
            </select>
            <label className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-800">Masaustunden dosya sec</span>
              <input name="file" type="file" className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white" />
            </label>
            <input name="fileUrl" placeholder="Dosya URL" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
            <input name="altText" placeholder="Alt metin" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Dosya secersen once Supabase Storage&apos;a yuklenir. URL alani harici medya icin kullanilabilir.</p>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Medya Ekle</button>
          </div>
        </form>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article key={asset.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{asset.kind}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{asset.title}</p>
              <p className="mt-2 break-all text-sm text-slate-600">{asset.file_url}</p>
              {asset.alt_text ? <p className="mt-2 text-sm text-slate-500">{asset.alt_text}</p> : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <a href={asset.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-700 underline">
                  Ac
                </a>
                <form action={deleteMediaAssetAction}>
                  <input type="hidden" name="id" value={asset.id} />
                  <button type="submit" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    Sil
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
