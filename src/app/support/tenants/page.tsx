import Link from "next/link";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportTenantSummaries } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";

export default async function SupportTenantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; state?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/tenants");
  const { tenants } = await listSupportTenantSummaries();
  const filters = (await searchParams) ?? {};
  const q = (filters.q ?? "").trim().toLowerCase();
  const state = (filters.state ?? "all").trim().toLowerCase();
  const filteredTenants = tenants.filter((tenant) => {
    const matchesQuery =
      !q ||
      tenant.business_name.toLowerCase().includes(q) ||
      tenant.business_slug.toLowerCase().includes(q) ||
      tenant.plan.toLowerCase().includes(q);
    const matchesState =
      state === "all" ||
      (state === "active" && tenant.is_active) ||
      (state === "inactive" && !tenant.is_active);

    return matchesQuery && matchesState;
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Tenant Directory", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Musteri isletmeleri", locale)}</h1>
      </header>

      <form className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_120px]">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={translateUiText("Isletme, slug veya paket ara", locale)}
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
        />
        <select name="state" defaultValue={state || "all"} className="rounded-xl border border-slate-300 px-4 py-3 text-sm">
          <option value="all">{translateUiText("Tum durumlar", locale)}</option>
          <option value="active">{translateUiText("Aktif", locale)}</option>
          <option value="inactive">{translateUiText("Pasif", locale)}</option>
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">{translateUiText("Filtrele", locale)}</button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTenants.map((tenant) => (
          <article key={tenant.business_id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{tenant.business_name}</p>
                <p className="mt-1 text-sm text-slate-500">/{tenant.business_slug}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tenant.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                {tenant.is_active ? translateUiText("Aktif", locale) : translateUiText("Pasif", locale)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{translateUiText("Paket", locale)}: {tenant.plan}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{translateUiText("Sube", locale)}: {tenant.branch_count}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                {translateUiText("Acik destek kaydi", locale)}: {tenant.support_ticket_count}
              </div>
            </div>
            <Link href={`/support/tenants/${tenant.business_id}`} className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              {translateUiText("Detay Ac", locale)}
            </Link>
          </article>
        ))}
        {filteredTenants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            {translateUiText("Filtreye uygun tenant bulunamadi.", locale)}
          </div>
        ) : null}
      </section>
    </main>
  );
}
