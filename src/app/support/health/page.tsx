import { requireSupportAccess } from "@/lib/auth";
import { listSupportHealthSummaries } from "@/lib/domains/support";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { SupportEmptyState, SupportFilterBar } from "@/components/support-ui";

export default async function SupportHealthPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/health");
  const { health } = await listSupportHealthSummaries();
  const filters = (await searchParams) ?? {};
  const q = (filters.q ?? "").trim().toLowerCase();
  const statusFilter = (filters.status ?? "all").trim().toLowerCase();
  const filteredHealth = health.filter((item) => {
    const matchesQuery = !q || item.business_name.toLowerCase().includes(q) || item.plan.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || item.health_status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Tenant Health", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Sağlık görünümü", locale)}</h1>
      </header>

      <SupportFilterBar
        queryDefaultValue={filters.q ?? ""}
        queryPlaceholder={translateUiText("Tenant veya paket ara", locale)}
        selects={[
          {
            name: "status",
            defaultValue: statusFilter || "all",
            options: [
              { value: "all", label: translateUiText("Tüm durumlar", locale) },
              { value: "healthy", label: translateUiText("Healthy", locale) },
              { value: "warning", label: translateUiText("Warning", locale) },
              { value: "critical", label: translateUiText("Critical", locale) },
            ],
          },
        ]}
        submitLabel={translateUiText("Filtrele", locale)}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredHealth.map((item) => (
          <article key={item.business_id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-slate-900">{item.business_name}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.health_status === "healthy"
                  ? "bg-emerald-100 text-emerald-700"
                  : item.health_status === "warning"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-700"
              }`}>
                {translateUiText(item.health_status, locale)}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>{translateUiText("Paket", locale)}: {item.plan}</p>
              <p>{translateUiText("Son sipariş", locale)}: {item.last_order_at ? new Date(item.last_order_at).toLocaleString("tr-TR") : "-"}</p>
              <p>{translateUiText("Son ödeme", locale)}: {item.last_payment_at ? new Date(item.last_payment_at).toLocaleString("tr-TR") : "-"}</p>
              <p>{translateUiText("Açık ticket", locale)}: {item.open_ticket_count}</p>
            </div>
          </article>
        ))}
        {filteredHealth.length === 0 ? (
          <SupportEmptyState className="md:col-span-2 xl:col-span-3">
            {translateUiText("Filtreye uygun tenant health kaydı bulunamadı.", locale)}
          </SupportEmptyState>
        ) : null}
      </section>
    </main>
  );
}

