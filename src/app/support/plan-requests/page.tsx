import { revalidatePath } from "next/cache";
import { requireSupportAccess } from "@/lib/auth";
import { listSupportPlanRequests, setSupportPlanRequestStatus } from "@/lib/data";
import type { SupportPlanRequestStatus } from "@/lib/types";

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
        <p className="text-sm text-slate-500">Plan Requests</p>
        <h1 className="text-3xl font-semibold text-slate-900">Paket degisikligi talepleri</h1>
      </header>

      <form className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_120px]">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Tenant, paket veya gerekce ara"
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm"
        />
        <select name="status" defaultValue={statusFilter || "all"} className="rounded-xl border border-slate-300 px-4 py-3 text-sm">
          <option value="all">Tum durumlar</option>
          <option value="open">Open</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Filtrele</button>
      </form>

      <section className="space-y-4">
        {filteredRequests.map((request) => (
          <article key={request.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{request.current_plan} {"->"} {request.requested_plan}</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{request.business_name || request.business_id}</h2>
                <p className="mt-2 text-sm text-slate-600">{request.reason || "Aciklama girilmedi."}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{request.status}</span>
            </div>
            <form action={updatePlanRequestStatusAction} className="mt-4 flex items-center gap-2">
              <input type="hidden" name="id" value={request.id} />
              <select name="status" defaultValue={request.status} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-xs">
                <option value="open">Open</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button type="submit" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Guncelle</button>
            </form>
          </article>
        ))}
        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
            Filtreye uygun paket talebi bulunamadi.
          </div>
        ) : null}
      </section>
    </main>
  );
}
