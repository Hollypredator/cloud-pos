import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSupportAccess } from "@/lib/auth";
import { createSupportTenantProvision } from "@/lib/domains/support";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";

function feedbackHref(tone: "success" | "error", message: string) {
  const params = new URLSearchParams({ tone, feedback: message });
  return `/support/tenants/new?${params.toString()}`;
}

async function createTenantAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/tenants/new", ["support_admin"]);

  const businessName = formData.get("businessName");
  const businessSlug = formData.get("businessSlug");
  const plan = formData.get("plan");
  const branchName = formData.get("branchName");
  const branchSlug = formData.get("branchSlug");
  const ownerEmail = formData.get("ownerEmail");
  const ownerFullName = formData.get("ownerFullName");
  const ownerPassword = formData.get("ownerPassword");

  if (
    typeof businessName !== "string" ||
    typeof businessSlug !== "string" ||
    typeof branchName !== "string" ||
    typeof ownerEmail !== "string"
  ) {
    redirect(feedbackHref("error", "Zorunlu alanlar eksik."));
  }

  const result = await createSupportTenantProvision({
    businessName,
    businessSlug,
    plan: typeof plan === "string" && ["starter", "growth", "custom"].includes(plan)
      ? (plan as "starter" | "growth" | "custom")
      : "growth",
    branchName,
    branchSlug: typeof branchSlug === "string" ? branchSlug : undefined,
    branchProfile: "restaurant",
    ownerEmail,
    ownerFullName: typeof ownerFullName === "string" ? ownerFullName : undefined,
    ownerPassword: typeof ownerPassword === "string" ? ownerPassword : undefined,
  });

  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Tenant olusturulamadi."));
  }

  revalidatePath("/support/tenants");
  const passwordNote = result.temporaryPassword ? ` Gecici sifre: ${result.temporaryPassword}` : "";
  redirect(feedbackHref("success", `Tenant olusturuldu.${passwordNote}`));
}

export default async function SupportTenantCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ tone?: "success" | "error"; feedback?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/tenants/new", ["support_admin"]);
  const params = (await searchParams) ?? {};

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{translateUiText("Tenant Provisioning", locale)}</p>
          <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Yeni tenant olustur", locale)}</h1>
        </div>
        <Link
          href="/support/tenants"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {translateUiText("Tenant listesine don", locale)}
        </Link>
      </header>

      {params.feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            params.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {params.feedback}
        </div>
      ) : null}

      <form action={createTenantAction} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Tenant bilgileri</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="businessName"
            required
            placeholder="Isletme adi"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            name="businessSlug"
            required
            placeholder="isletme-slug"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <select name="plan" defaultValue="growth" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2">
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <h2 className="text-lg font-semibold text-slate-900">Ilk sube</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="branchName"
            required
            defaultValue="Merkez Sube"
            placeholder="Sube adi"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            name="branchSlug"
            placeholder="merkez"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
        </div>

        <h2 className="text-lg font-semibold text-slate-900">Owner hesabi</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="email"
            name="ownerEmail"
            required
            placeholder="owner@firma.com"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            name="ownerFullName"
            placeholder="Ad Soyad"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />
          <input
            type="text"
            name="ownerPassword"
            placeholder="Opsiyonel gecici sifre (bossa otomatik uretilir)"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2"
          />
        </div>

        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          Tenant Olustur
        </button>
      </form>
    </main>
  );
}
