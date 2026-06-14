import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, NoticeBanner, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { getCurrentUserWithRole, requireExactRole } from "@/lib/auth";
import { createBranch, deleteBranch, listBranches, setBranchActiveStatus, updateBranch } from "@/lib/data";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import type { BranchProfile } from "@/lib/types";

function normalizeBranchProfile(value: FormDataEntryValue | null): BranchProfile {
  void value;
  return "restaurant";
}

function feedbackHref(tone: "success" | "error", message: string, branchId?: string) {
  const params = new URLSearchParams({ tone, feedback: message });
  if (branchId) params.set("branch", branchId);
  return `/admin/businesses?${params.toString()}`;
}

async function createBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const name = formData.get("name");
  const slug = formData.get("slug");
  const branchProfile = normalizeBranchProfile(formData.get("branchProfile"));
  if (typeof name !== "string" || typeof slug !== "string") {
    redirect(feedbackHref("error", "Şube bilgileri eksik."));
  }

  const result = await createBranch({ name, slug, branchProfile });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Şube oluşturulamadı."));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Yeni şube oluşturuldu.", result.id));
}

async function updateBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  const name = formData.get("name");
  const slug = formData.get("slug");
  const branchProfile = normalizeBranchProfile(formData.get("branchProfile"));
  if (typeof branchId !== "string" || typeof name !== "string" || typeof slug !== "string") {
    redirect(feedbackHref("error", "Güncellenecek şube bulunamadı."));
  }

  const result = await updateBranch({ branchId, name, slug, branchProfile });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Şube güncellenemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Şube bilgileri güncellendi.", branchId));
}

async function toggleBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  const isActive = formData.get("isActive") === "true";
  if (typeof branchId !== "string") {
    redirect(feedbackHref("error", "Şube bulunamadı."));
  }

  const result = await setBranchActiveStatus({ branchId, isActive });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Şube durumu güncellenemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", isActive ? "Şube aktif edildi." : "Şube pasife alındı.", branchId));
}

async function deleteBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  if (typeof branchId !== "string") {
    redirect(feedbackHref("error", "Silinecek şube bulunamadı."));
  }

  const result = await deleteBranch(branchId);
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Şube silinemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Şube silindi."));
}

type BranchParams = {
  branch?: string;
  feedback?: string;
  tone?: "success" | "error";
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<BranchParams>;
}) {
  await requireExactRole(["owner"], "/admin/businesses");
  const authContextResult = await measureAsync("current_user", () => getCurrentUserWithRole());
  const authContext = authContextResult.value;
  if (authContext.accessScope === "branch") {
    redirect("/ops");
  }
  const featureAccessResult = await measureAsync("feature_access", () => getFeatureAccess("multi_branch"));
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    logServerPerf("/admin/businesses", [authContextResult, featureAccessResult]);
    return (
      <BackofficePage title="Şubeler" description="Çoklu şube ve merkezden yönetim">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }

  const { branch: selectedBranchId, feedback, tone } = await searchParams;
  const branchesResult = await measureAsync("list_branches", () => listBranches());
  const { branches, activeBranchId, usingDemoData } = branchesResult.value;
  logServerPerf("/admin/businesses", [authContextResult, featureAccessResult, branchesResult]);
  const selectedBranch = selectedBranchId ? branches.find((branch) => branch.id === selectedBranchId) ?? null : null;
  const activeCount = branches.filter((branch) => branch.is_active).length;

  return (
    <BackofficePage
      title="Şube Yönetimi"
      description="Sublere ayrilan operasyonlari merkezden duzenle ve aktif/pasif durumunu yönet."
      sidebar={
        <SidebarPanel title="Şube Özet" description="Çoklu şube kullanıminda aktif yapinin dengeli kalmasini sagla.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Toplam Şube</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{branches.length}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Aktif</p>
                <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Seçili</p>
                <p className="mt-2 text-lg font-semibold">{branches.find((branch) => branch.id === activeBranchId)?.name ?? "-"}</p>
              </div>
            </div>
          </div>
          <WorkflowGuide
            title="Şubeyi 3 Adimda Hazırla"
            steps={[
              { title: "Şube kaydini ac", description: "Ad ve slug ile yeni şubeyi oluştur." },
              { title: "Durumunu belirle", description: "Kullanilmiyorsa pasif yap, operasyon açıksa aktif tut." },
              { title: "Operasyonu ayir", description: "Masalar, siparişler ve vardiyalar seçili şubede çalışır." },
            ]}
          />
        </SidebarPanel>
      }
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Panele Dön
        </Link>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Şube işlemi tamamlanamadi" : "Şube işlemi tamamlandı"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <NoticeBanner tone="warning" title="Demo mod aktif" description="Şube listesi Örnek veriyle gösteriliyor." />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Toplam Şube" value={String(branches.length)} hint="Bu işletmede tanimli şube sayısı" tone="accent" />
        <SummaryCard label="Aktif Şube" value={String(activeCount)} hint="Operasyonda kullanilan şubeler" tone="success" />
        <SummaryCard label="Seçili Şube" value={branches.find((branch) => branch.id === activeBranchId)?.name ?? "-"} hint="Shell uzerindeki aktif operasyon şubesi" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ContentCard title="Yeni Şube Ekle">
          <form action={createBranchAction} className="grid gap-3">
            <input name="name" required placeholder="Şube adi" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            <input name="slug" required placeholder="şube-slug" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              Şube Oluştur
            </button>
          </form>
        </ContentCard>

        <ContentCard title="Şube Listesi">
          {branches.length === 0 ? (
            <EmptyPanel title="Şube yok" description="Ilk şubeyi ekledikten sonra operasyon ayrimi burada baslar." />
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <article key={branch.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{branch.name}</p>
                      <p className="mt-1 text-sm text-slate-500">/{branch.slug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Restaurant
                      </span>
                      {branch.id === activeBranchId ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Seçili</span>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${branch.is_active ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-700"}`}>
                        {branch.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/admin/businesses?branch=${branch.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                      Yonet
                    </Link>
                    <form action={toggleBranchAction}>
                      <input type="hidden" name="branchId" value={branch.id} />
                      <input type="hidden" name="isActive" value={branch.is_active ? "false" : "true"} />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                        {branch.is_active ? "Pasife Al" : "Aktif Et"}
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ContentCard>
      </section>

      {selectedBranch ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-3xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Şube Yönetimi</p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{selectedBranch.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Slug: /{selectedBranch.slug}</p>
              </div>
              <Link href="/admin/businesses" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Kapat
              </Link>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <ContentCard title="Şube Bilgileri">
                <form action={updateBranchAction} className="grid gap-3">
                  <input type="hidden" name="branchId" value={selectedBranch.id} />
                  <input name="name" defaultValue={selectedBranch.name} required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <input name="slug" defaultValue={selectedBranch.slug} required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                    Şube Bilgilerini Kaydet
                  </button>
                </form>
              </ContentCard>

              <ContentCard title="Şubeyi Kaldır">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Şube silinmeden önce bu şubeye bağlı masa, sipariş ve kurye kayıtları temizlenmis olmalidir.
                  </div>
                  <form action={deleteBranchAction}>
                    <input type="hidden" name="branchId" value={selectedBranch.id} />
                    <button type="submit" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      Şubeyi Sil
                    </button>
                  </form>
                </div>
              </ContentCard>
            </div>
          </div>
        </div>
      ) : null}
    </BackofficePage>
  );
}


