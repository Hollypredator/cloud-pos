import Link from "next/link";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportTenantSummaries } from "@/lib/domains/support";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";
import { SupportEmptyState, SupportFilterBar } from "@/components/support-ui";

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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{translateUiText("Tenant Directory", locale)}</p>
          <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Müşteri işletmeleri", locale)}</h1>
        </div>
        <Link href="/support/tenants/new" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          Yeni Tenant
        </Link>
      </header>

      <SupportFilterBar
        queryDefaultValue={filters.q ?? ""}
        queryPlaceholder={translateUiText("İşletme, slug veya paket ara", locale)}
        selects={[
          {
            name: "state",
            defaultValue: state || "all",
            options: [
              { value: "all", label: translateUiText("Tüm durumlar", locale) },
              { value: "active", label: translateUiText("Aktif", locale) },
              { value: "inactive", label: translateUiText("Pasif", locale) },
            ],
          },
        ]}
        submitLabel={translateUiText("Filtrele", locale)}
      />

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
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{translateUiText("Şube", locale)}: {tenant.branch_count}</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                İşletme tipi: {tenant.business_type === "self_service_coffee" ? "Self-Service Coffee" : "Restaurant / Cafe"}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                {translateUiText("Açık destek kaydı", locale)}: {tenant.support_ticket_count}
              </div>
            </div>
            <Link href={`/support/tenants/${tenant.business_id}`} className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              {translateUiText("Detay Aç", locale)}
            </Link>
          </article>
        ))}
        {filteredTenants.length === 0 ? (
          <SupportEmptyState className="md:col-span-2 xl:col-span-3">
            {translateUiText("Filtreye uygun tenant bulunamadı.", locale)}
          </SupportEmptyState>
        ) : null}
      </section>
    </main>
  );
}
