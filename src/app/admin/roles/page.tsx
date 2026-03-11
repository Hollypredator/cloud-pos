import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, FeatureLockedState, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireExactRole } from "@/lib/auth";
import { createStaffAccount, deleteStaffAccount, listBranches, listProfiles, updateProfileRole, updateStaffAccount } from "@/lib/data";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getFeatureAccess } from "@/lib/plan-access";
import type { AppRole, StaffAccessScope } from "@/lib/types";

const roles: AppRole[] = ["owner", "admin", "waiter", "kitchen", "cashier"];
type StaffProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  email?: string | null;
  access_scope?: StaffAccessScope;
  primary_branch_id?: string | null;
  primary_branch_name?: string | null;
};

function feedbackHref(tone: "success" | "error", message: string, staffId?: string) {
  const params = new URLSearchParams({ tone, feedback: message });
  if (staffId) params.set("staff", staffId);
  return `/admin/roles?${params.toString()}`;
}

async function updateRoleAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/roles");

  const profileId = formData.get("profileId");
  const role = formData.get("role");
  if (typeof profileId !== "string" || typeof role !== "string") {
    return;
  }

  if (!roles.includes(role as AppRole)) {
    return;
  }

  await updateProfileRole(profileId, role as AppRole);
  revalidatePath("/admin/roles");
}

async function createStaffAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/roles");

  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const password = formData.get("password");
  const role = formData.get("role");
  const accessScope = formData.get("accessScope");
  const branchId = formData.get("branchId");
  if (
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof role !== "string" ||
    typeof accessScope !== "string"
  ) {
    return;
  }

  if (!roles.includes(role as AppRole)) {
    return;
  }

  await createStaffAccount({
    fullName,
    email,
    password,
    role: role as AppRole,
    accessScope: accessScope as StaffAccessScope,
    branchId: typeof branchId === "string" ? branchId : null,
  });
  revalidatePath("/admin/roles");
}

async function updateStaffAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/roles");

  const profileId = formData.get("profileId");
  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const password = formData.get("password");
  const role = formData.get("role");
  const accessScope = formData.get("accessScope");
  const branchId = formData.get("branchId");
  if (
    typeof profileId !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof role !== "string" ||
    typeof accessScope !== "string"
  ) {
    redirect(feedbackHref("error", "Guncellenecek personel bulunamadi."));
  }

  const result = await updateStaffAccount({
    profileId,
    fullName,
    email,
    role: role as AppRole,
    accessScope: accessScope as StaffAccessScope,
    branchId: typeof branchId === "string" ? branchId : null,
    password: typeof password === "string" ? password : undefined,
  });
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Personel guncellenemedi.", profileId));
  }

  revalidatePath("/admin/roles");
  redirect(feedbackHref("success", "Personel bilgileri guncellendi.", profileId));
}

async function deleteStaffAction(formData: FormData) {
  "use server";
  await requireExactRole(["owner"], "/admin/roles");

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") {
    redirect(feedbackHref("error", "Silinecek personel bulunamadi."));
  }

  const result = await deleteStaffAccount(profileId);
  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Personel silinemedi.", profileId));
  }

  revalidatePath("/admin/roles");
  redirect(feedbackHref("success", "Personel silindi."));
}

function roleLabel(role: AppRole) {
  if (role === "owner") return "Patron";
  if (role === "admin") return "Yonetici";
  if (role === "cashier") return "Kasa";
  if (role === "kitchen") return "Mutfak";
  return "Servis";
}

function scopeLabel(scope?: StaffAccessScope) {
  return scope === "business" ? "Tum Subeler" : "Tek Sube";
}

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; feedback?: string; tone?: "success" | "error" }>;
}) {
  await requireExactRole(["owner"], "/admin/roles");
  const featureAccessPromise = measureAsync("feature_access", () => getFeatureAccess("staff_management"));
  const profilesPromise = measureAsync("list_profiles", () => listProfiles());
  const branchesPromise = measureAsync("list_branches", () => listBranches());
  const featureAccessResult = await featureAccessPromise;
  const featureAccess = featureAccessResult.value;
  if (!featureAccess.enabled) {
    await Promise.allSettled([profilesPromise, branchesPromise]);
    logServerPerf("/admin/roles", [featureAccessResult]);
    return (
      <BackofficePage title="Personel" description="Ekip ve rol yonetimi">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }
  const { staff: selectedStaffId, feedback, tone } = await searchParams;
  let fetchFeedback: string | null = null;
  let fetchFeedbackTone: "success" | "error" | null = null;
  let profilesResult: Awaited<ReturnType<typeof measureAsync<Awaited<ReturnType<typeof listProfiles>>>>>;
  let branchesResult: Awaited<ReturnType<typeof measureAsync<Awaited<ReturnType<typeof listBranches>>>>>;

  try {
    [profilesResult, branchesResult] = await Promise.all([profilesPromise, branchesPromise]);
  } catch (error) {
    console.error("[admin/roles] data fetch failed", error);
    fetchFeedback = "Personel verileri gecici olarak yuklenemedi. Lutfen sayfayi yenileyin.";
    fetchFeedbackTone = "error";
    profilesResult = {
      label: "list_profiles",
      ms: 0,
      value: {
        profiles: [],
        usingDemoData: false,
      },
    };
    branchesResult = {
      label: "list_branches",
      ms: 0,
      value: {
        branches: [],
        activeBranchId: "",
        usingDemoData: false,
      },
    };
  }
  const { profiles, usingDemoData } = profilesResult.value;
  const { branches } = branchesResult.value;
  logServerPerf("/admin/roles", [featureAccessResult, profilesResult, branchesResult]);
  const staffProfiles = profiles as StaffProfile[];
  const selectedStaff = selectedStaffId ? staffProfiles.find((profile) => profile.id === selectedStaffId) ?? null : null;
  const roleCounts = {
    owner: staffProfiles.filter((profile) => profile.role === "owner").length,
    admin: staffProfiles.filter((profile) => profile.role === "admin").length,
    cashier: staffProfiles.filter((profile) => profile.role === "cashier").length,
    kitchen: staffProfiles.filter((profile) => profile.role === "kitchen").length,
    waiter: staffProfiles.filter((profile) => profile.role === "waiter").length,
  };

  return (
    <BackofficePage
      title="Ekip ve Roller"
      description="Personeli ekle, gorev rolunu belirle ve vardiya dagilimini netlestir."
      sidebar={
        <SidebarPanel title="Ekip Ozet" description="Aktif kadroyu operasyon rollerine gore dengele.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Toplam Personel</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{staffProfiles.length}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Kasa</p>
                <p className="mt-2 text-2xl font-semibold">{roleCounts.cashier}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Mutfak</p>
                <p className="mt-2 text-2xl font-semibold">{roleCounts.kitchen}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Bu ekranda sadece isletme personeli yonetilir. Demo ekip, sunum akisi ve platform notlari gosterilmez.
          </div>
        </SidebarPanel>
      }
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Panele Don
        </Link>
      }
    >
      {feedback || fetchFeedback ? (
        <div
          className={`rounded-[24px] border px-5 py-4 text-sm ${(fetchFeedbackTone ?? tone) === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
        >
          {feedback ?? fetchFeedback}
        </div>
      ) : null}

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda profil listesi sinirlidir.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Patron" value={String(roleCounts.owner)} hint="Tum subeler" tone="accent" />
        <SummaryCard label="Yonetici" value={String(roleCounts.admin)} hint="Atanmis sube" />
        <SummaryCard label="Kasa" value={String(roleCounts.cashier)} hint="Tahsilat ve gun sonu" />
        <SummaryCard label="Mutfak" value={String(roleCounts.kitchen)} hint="Hazirlama kuyrugu" tone="danger" />
      </section>

      <WorkflowGuide
        title="Personeli 3 Adimda Hazirla"
        description="Yeni biri sisteme eklendiginde ekip yapisi hizla kurulabilsin."
        steps={[
          { title: "Yeni kullaniciyi ekle", description: "Ad soyad, e-posta ve gecici sifre ile personel hesabini olustur." },
          { title: "Dogru rolu sec", description: "Patron tum subeleri, yonetici ise atanmis subeyi yonetsin." },
          { title: "Listeden kontrol et", description: "Olusan personeli listeden dogrula ve gerekirse rolu hemen guncelle." },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ContentCard title="Yeni Personel Ekle">
          <form action={createStaffAction} className="grid gap-3">
            <input
              name="fullName"
              required
              placeholder="Ad soyad"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="personel@isletme.com"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            />
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Gecici sifre"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            />
            <select name="role" defaultValue="waiter" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <select name="accessScope" defaultValue="branch" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <option value="branch">Tek Sube Erisimi</option>
              <option value="business">Tum Subeler (yalnizca patron)</option>
            </select>
            <select name="branchId" defaultValue={branches[0]?.id ?? ""} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
              Personel Olustur
            </button>
          </form>
        </ContentCard>

        <ContentCard title="Personel Listesi">
          {staffProfiles.length === 0 ? (
            <EmptyPanel title="Personel yok" description="Ilk kullaniciyi ekledikten sonra ekip listesi burada gorunecek." />
          ) : (
            <div className="space-y-3">
              {staffProfiles.map((profile) => (
                <article key={profile.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{profile.full_name ?? "Isimsiz kullanici"}</p>
                      <p className="mt-1 text-sm text-slate-500">{profile.email ?? "E-posta bilgisi yok"}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {scopeLabel(profile.access_scope)}
                        {profile.primary_branch_name ? ` · ${profile.primary_branch_name}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{roleLabel(profile.role)}</span>
                  </div>
                  <form action={updateRoleAction} className="mt-4 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <select
                      name="role"
                      defaultValue={profile.role}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-auto"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:w-auto">
                      Rol Guncelle
                    </button>
                    <Link href={`/admin/roles?staff=${profile.id}`} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 sm:w-auto">
                      Yonet
                    </Link>
                  </form>
                </article>
              ))}
            </div>
          )}
        </ContentCard>
      </section>

      {selectedStaff ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/42 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="panel-surface h-[100dvh] w-full max-w-4xl overflow-auto rounded-none p-4 sm:max-h-[92vh] sm:h-auto sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Personel Yonetimi</p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{selectedStaff.full_name ?? "Isimsiz kullanici"}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedStaff.email ?? "E-posta bilgisi yok"}</p>
              </div>
              <Link href="/admin/roles" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                Kapat
              </Link>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <ContentCard title="Personel Bilgileri">
                <form action={updateStaffAction} className="grid gap-3">
                  <input type="hidden" name="profileId" value={selectedStaff.id} />
                  <input
                    name="fullName"
                    defaultValue={selectedStaff.full_name ?? ""}
                    required
                    placeholder="Ad soyad"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                  <input
                    type="email"
                    name="email"
                    defaultValue={selectedStaff.email ?? ""}
                    required
                    placeholder="personel@isletme.com"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Yeni sifre (bos birakilabilir)"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                  <select name="role" defaultValue={selectedStaff.role} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                  <select
                    name="accessScope"
                    defaultValue={selectedStaff.access_scope ?? (selectedStaff.role === "owner" ? "business" : "branch")}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  >
                    <option value="branch">Tek Sube Erisimi</option>
                    <option value="business">Tum Subeler (yalnizca patron)</option>
                  </select>
                  <select
                    name="branchId"
                    defaultValue={selectedStaff.primary_branch_id ?? branches[0]?.id ?? ""}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                    Personel Bilgilerini Kaydet
                  </button>
                </form>
              </ContentCard>

              <ContentCard title="Personeli Kaldir">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Personel silinince giris hesabi da kaldirilir. Son patron hesap silinemez.
                  </div>
                  <form action={deleteStaffAction}>
                    <input type="hidden" name="profileId" value={selectedStaff.id} />
                    <button type="submit" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      Personeli Sil
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
