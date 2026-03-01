import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, NoticeBanner, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { getCurrentUserWithRole, requireExactRole } from "@/lib/auth";
import { createBranch, deleteBranch, listBranches, setBranchActiveStatus, updateBranch } from "@/lib/data";
import { getFeatureAccess } from "@/lib/plan-access";

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
  if (typeof name !== "string" || typeof slug !== "string") {
    redirect(feedbackHref("error", "Sube bilgileri eksik."));
  }

  const result = await createBranch({ name, slug });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Sube olusturulamadi."));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Yeni sube olusturuldu.", result.id));
}

async function updateBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  const name = formData.get("name");
  const slug = formData.get("slug");
  if (typeof branchId !== "string" || typeof name !== "string" || typeof slug !== "string") {
    redirect(feedbackHref("error", "Guncellenecek sube bulunamadi."));
  }

  const result = await updateBranch({ branchId, name, slug });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Sube guncellenemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Sube bilgileri guncellendi.", branchId));
}

async function toggleBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  const isActive = formData.get("isActive") === "true";
  if (typeof branchId !== "string") {
    redirect(feedbackHref("error", "Sube bulunamadi."));
  }

  const result = await setBranchActiveStatus({ branchId, isActive });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Sube durumu guncellenemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", isActive ? "Sube aktif edildi." : "Sube pasife alindi.", branchId));
}

async function deleteBranchAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/businesses");

  const branchId = formData.get("branchId");
  if (typeof branchId !== "string") {
    redirect(feedbackHref("error", "Silinecek sube bulunamadi."));
  }

  const result = await deleteBranch(branchId);
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Sube silinemedi.", branchId));
  }

  revalidatePath("/admin/businesses");
  redirect(feedbackHref("success", "Sube silindi."));
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
  const authContext = await getCurrentUserWithRole();
  if (authContext.accessScope === "branch") {
    redirect("/ops");
  }
  const featureAccess = await getFeatureAccess("multi_branch");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title="Subeler" description="Coklu sube ve merkezden yonetim">
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
  const { branches, activeBranchId, usingDemoData } = await listBranches();
  const selectedBranch = selectedBranchId ? branches.find((branch) => branch.id === selectedBranchId) ?? null : null;
  const activeCount = branches.filter((branch) => branch.is_active).length;

  return (
    <BackofficePage
      title="Sube Yonetimi"
      description="Sublere ayrilan operasyonlari merkezden duzenle ve aktif/pasif durumunu yonet."
      sidebar={
        <SidebarPanel title="Sube Ozet" description="Coklu sube kullaniminda aktif yapinin dengeli kalmasini sagla.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Toplam Sube</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">{branches.length}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Aktif</p>
                <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Secili</p>
                <p className="mt-2 text-lg font-semibold">{branches.find((branch) => branch.id === activeBranchId)?.name ?? "-"}</p>
              </div>
            </div>
          </div>
          <WorkflowGuide
            title="Subeyi 3 Adimda Hazirla"
            steps={[
              { title: "Sube kaydini ac", description: "Ad ve slug ile yeni subeyi olustur." },
              { title: "Durumunu belirle", description: "Kullanilmiyorsa pasif yap, operasyon aciksa aktif tut." },
              { title: "Operasyonu ayir", description: "Masalar, siparisler ve vardiyalar secili subede calisir." },
            ]}
          />
        </SidebarPanel>
      }
      actions={
        <Link href="/ops" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
          Panele Don
        </Link>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Sube islemi tamamlanamadi" : "Sube islemi tamamlandi"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <NoticeBanner tone="warning" title="Demo mod aktif" description="Sube listesi ornek veriyle gosteriliyor." />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Toplam Sube" value={String(branches.length)} hint="Bu isletmede tanimli sube sayisi" tone="accent" />
        <SummaryCard label="Aktif Sube" value={String(activeCount)} hint="Operasyonda kullanilan subeler" tone="success" />
        <SummaryCard label="Secili Sube" value={branches.find((branch) => branch.id === activeBranchId)?.name ?? "-"} hint="Shell uzerindeki aktif operasyon subesi" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ContentCard title="Yeni Sube Ekle">
          <form action={createBranchAction} className="grid gap-3">
            <input name="name" required placeholder="Sube adi" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            <input name="slug" required placeholder="sube-slug" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              Sube Olustur
            </button>
          </form>
        </ContentCard>

        <ContentCard title="Sube Listesi">
          {branches.length === 0 ? (
            <EmptyPanel title="Sube yok" description="Ilk subeyi ekledikten sonra operasyon ayrimi burada baslar." />
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
                      {branch.id === activeBranchId ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Secili</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/42 p-4 backdrop-blur-[2px]">
          <div className="panel-surface max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[32px] p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sube Yonetimi</p>
                <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">{selectedBranch.name}</h2>
                <p className="mt-1 text-sm text-slate-500">Slug: /{selectedBranch.slug}</p>
              </div>
              <Link href="/admin/businesses" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Kapat
              </Link>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <ContentCard title="Sube Bilgileri">
                <form action={updateBranchAction} className="grid gap-3">
                  <input type="hidden" name="branchId" value={selectedBranch.id} />
                  <input name="name" defaultValue={selectedBranch.name} required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <input name="slug" defaultValue={selectedBranch.slug} required className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                    Sube Bilgilerini Kaydet
                  </button>
                </form>
              </ContentCard>

              <ContentCard title="Subeyi Kaldir">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Sube silinmeden once bu subeye bagli masa, siparis ve kurye kayitlari temizlenmis olmalidir.
                  </div>
                  <form action={deleteBranchAction}>
                    <input type="hidden" name="branchId" value={selectedBranch.id} />
                    <button type="submit" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      Subeyi Sil
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
