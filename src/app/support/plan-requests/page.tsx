import { revalidatePath } from "next/cache";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportPlanRequests, setSupportPlanRequestStatus } from "@/lib/domains/support";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import type { SupportPlanRequestStatus } from "@/lib/types";
import { SupportEmptyState, SupportFilterBar } from "@/components/support-ui";

async function updatePlanRequestStatusAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/plan-requests", ["support_admin", "billing_agent"]);
  await setSupportPlanRequestStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? "open") as SupportPlanRequestStatus);
  revalidatePath("/support/plan-requests");
  revalidatePath("/support/tenants");
  revalidatePath("/support/audit");
}

export default async function SupportPlanRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const locale = await getCurrentLocale();
  await requireSupportAccess("/support/plan-requests");
  const { requests } = await listSupportPlanRequests();
  const filters = (await searchParams) ?? {};
  const q = (filters.q ?? "").trim().toLowerCase();
  const statusFilter = (filters.status ?? "all").trim().toLowerCase();
  const filteredRequests = requests.filter((request) => {
    const matchesQuery =
      !q ||
      (request.business_name ?? request.business_id).toLowerCase().includes(q) ||
      request.current_plan.toLowerCase().includes(q) ||
      request.requested_plan.toLowerCase().includes(q) ||
      (request.reason ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">{translateUiText("Plan Requests", locale)}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{translateUiText("Paket degisikligi talepleri", locale)}</h1>
      </header>

      <SupportFilterBar
        queryDefaultValue={filters.q ?? ""}
        queryPlaceholder={translateUiText("Tenant, paket veya gerekce ara", locale)}
        selects={[
          {
            name: "status",
            defaultValue: statusFilter || "all",
            options: [
              { value: "all", label: translateUiText("Tüm durumlar", locale) },
              { value: "open", label: translateUiText("Open", locale) },
              { value: "approved", label: translateUiText("Approved", locale) },
              { value: "rejected", label: translateUiText("Rejected", locale) },
              { value: "cancelled", label: translateUiText("Cancelled", locale) },
            ],
          },
        ]}
        submitLabel={translateUiText("Filtrele", locale)}
      />

      <section className="space-y-4">
        {filteredRequests.map((request) => (
          <article key={request.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{request.current_plan} {"->"} {request.requested_plan}</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{request.business_name || request.business_id}</h2>
                <p className="mt-2 text-sm text-slate-600">{request.reason || translateUiText("Açıklama girilmedi.", locale)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{translateUiText(request.status, locale)}</span>
            </div>
            <form action={updatePlanRequestStatusAction} className="mt-4 flex items-center gap-2">
              <input type="hidden" name="id" value={request.id} />
              <select name="status" defaultValue={request.status} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-xs">
                <option value="open">{translateUiText("Open", locale)}</option>
                <option value="approved">{translateUiText("Approved", locale)}</option>
                <option value="rejected">{translateUiText("Rejected", locale)}</option>
                <option value="cancelled">{translateUiText("Cancelled", locale)}</option>
              </select>
              <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{translateUiText("Güncelle", locale)}</button>
            </form>
          </article>
        ))}
        {filteredRequests.length === 0 ? (
          <SupportEmptyState>{translateUiText("Filtreye uygun paket talebi bulunamadı.", locale)}</SupportEmptyState>
        ) : null}
      </section>
    </main>
  );
}

