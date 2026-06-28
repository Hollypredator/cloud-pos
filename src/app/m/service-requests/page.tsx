import { revalidatePath } from "next/cache";
import Link from "next/link";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { LiveRouteRefresh } from "@/components/live-route-refresh";
import { MobileAuthRedirect } from "@/components/mobile-auth-redirect";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SwipeableActionCard } from "@/components/swipeable-action-card";
import { requireRole } from "@/lib/auth";
import { listTableRequests } from "@/lib/domains/tables";
import { getCurrentLocale } from "@/lib/i18n-server";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { shouldUseMobileClientAuthRedirect } from "@/lib/server/mobile-auth-guard";

type RequestStatusFilter = "open" | "resolved";

function toLabel(type: string) {
  if (type === "call_waiter") return "Garson Cagir";
  if (type === "request_bill") return "Hesap Istegi";
  return type;
}

function elapsedLabel(createdAt: string) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (diff < 1) return "Yeni";
  return `${diff} dk`;
}

function parseStatusFilter(value?: string | null): RequestStatusFilter {
  if (value === "resolved" || value === "open") {
    return value;
  }
  return "open";
}

function statusHref(status: RequestStatusFilter, page = 1) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (page > 1) {
    params.set("page", String(page));
  }
  return `/m/service-requests?${params.toString()}`;
}

async function resolveMobileRequestAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/m/service-requests");

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return;
  }

  await executeWebOpsCommand({
    type: "TABLE_REQUEST_RESOLVE",
    payload: {
      request_id: requestId,
    },
  });
  revalidatePath("/m/service-requests");
  revalidatePath("/service-requests");
  revalidatePath("/m/ops");
  revalidatePath("/ops");
}

export default async function MobileServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  if (await shouldUseMobileClientAuthRedirect()) {
    return <MobileAuthRedirect />;
  }

  await requireRole(["admin", "cashier"], "/m/service-requests");
  const locale = await getCurrentLocale();
  const localeCode = locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : "tr-TR";
  const { page: pageParam, status: statusParam } = await searchParams;
  const activeStatus = parseStatusFilter(statusParam);
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
  const { requests, usingDemoData, hasNextPage, hasPreviousPage } = await listTableRequests(activeStatus, {
    page,
    limit: 18,
  });

  const waiterCalls = requests.filter((request) => request.request_type === "call_waiter").length;
  const billCalls = requests.filter((request) => request.request_type === "request_bill").length;
  const delayedCalls = requests.filter((request) => elapsedLabel(request.created_at) !== "Yeni").length;

  return (
    <>
      <LiveOpsBridge tables={["table_requests"]} fallbackIntervalMs={1200} />
      <LiveRouteRefresh tables={["table_requests"]} debounceMs={220} minIntervalMs={1000} />

      {usingDemoData ? (
        <div className="m-card m-banner-warning">
          Demo modda masa talebi verisi uretilmiyor. Canlı akışta QR ve masa ekranindan bu kuyruk dolar.
        </div>
      ) : null}

      <section className="m-grid-3 mt-3">
        <article className="m-card text-center">
          <p className="m-label">{activeStatus === "open" ? "Açık" : "Cozulen"}</p>
          <p className="m-value text-orange-700">{requests.length}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Garson</p>
          <p className="m-value text-sky-700">{waiterCalls}</p>
        </article>
        <article className="m-card text-center">
          <p className="m-label">Hesap</p>
          <p className="m-value text-emerald-700">{billCalls}</p>
        </article>
      </section>

      <section className="m-card m-segment-wrap mt-3">
        <div className="m-segment-row">
          <Link href={statusHref("open")} data-active={activeStatus === "open"} className="m-segment-pill">
            Açık
          </Link>
          <Link href={statusHref("resolved")} data-active={activeStatus === "resolved"} className="m-segment-pill">
            Cozuldu
          </Link>
        </div>
      </section>

      <section className="m-card mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-label">Servis Kuyrugu</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {activeStatus === "open" ? "Mudahale Bekleyen Talepler" : "Kapanan Talepler"}
            </h2>
            <p className="m-muted mt-1">
              {activeStatus === "open" ? "Masa numarasını gor, talebi kapat." : "Cozulen talepleri vardiya icin izle."}
            </p>
          </div>
          <span className={`m-pill ${delayedCalls > 0 && activeStatus === "open" ? "m-tone-critical" : "m-tone-neutral"}`}>
            {activeStatus === "open" ? `${delayedCalls} geciken` : `Sayfa ${page}`}
          </span>
        </div>
      </section>

      <section className="m-stack mt-3">
        {requests.length === 0 ? (
          <article className="m-card">
            <p className="m-value-sm">{activeStatus === "open" ? "Açık talep yok." : "Cozulen talep yok."}</p>
            <p className="m-muted mt-1">Garson cagri veya hesap istegi geldiginde burada görünur.</p>
          </article>
        ) : (
          requests.map((request) => {
            const elapsed = elapsedLabel(request.created_at);
            const isDelayed = elapsed !== "Yeni";

            if (activeStatus === "open") {
              return (
                <SwipeableActionCard
                  key={request.id}
                  action={resolveMobileRequestAction}
                  actionLabel="✓ Çözüldü Olarak İşaretle"
                  actionBgClass="bg-emerald-600"
                  hiddenInputs={{ requestId: request.id }}
                  className={isDelayed ? "uupm-pulsing-critical" : ""}
                  cardClassName={`m-card ${isDelayed ? "border-amber-300 bg-amber-50/20" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-label">Masa {request.table_number ?? "-"}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">{toLabel(request.request_type)}</h2>
                      <p className="m-muted mt-1">{new Date(request.created_at).toLocaleString(localeCode)}</p>
                    </div>
                    <span className={`m-pill ${isDelayed ? "m-tone-warning" : "m-tone-neutral"}`}>{elapsed}</span>
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-700">
                    {request.note?.trim() ? request.note : "Ek not yok."}
                  </div>

                  <form action={resolveMobileRequestAction} className="mt-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <PendingSubmitButton
                      idleLabel="Çözüldü Olarak İşaretle (veya sağa kaydır)"
                      pendingLabel="Kapatılıyor..."
                      showToastOnClick={true}
                      className="m-btn-primary w-full"
                    />
                  </form>
                </SwipeableActionCard>
              );
            }

            return (
              <article key={request.id} className="m-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-label">Masa {request.table_number ?? "-"}</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">{toLabel(request.request_type)}</h2>
                    <p className="m-muted mt-1">{new Date(request.created_at).toLocaleString(localeCode)}</p>
                  </div>
                  <span className="m-pill m-tone-neutral">{elapsed}</span>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-700">
                  {request.note?.trim() ? request.note : "Ek not yok."}
                </div>

                <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">Talep çözülmüş.</div>
              </article>
            );
          })
        )}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {hasPreviousPage ? (
          <Link href={statusHref(activeStatus, page - 1)} className="m-btn-secondary inline-flex items-center justify-center">
            önceki
          </Link>
        ) : (
          <span className="m-btn-secondary inline-flex items-center justify-center bg-slate-100 text-slate-400">önceki</span>
        )}
        {hasNextPage ? (
          <Link href={statusHref(activeStatus, page + 1)} className="m-btn-secondary inline-flex items-center justify-center">
            Sonraki
          </Link>
        ) : (
          <span className="m-btn-secondary inline-flex items-center justify-center bg-slate-100 text-slate-400">Sonraki</span>
        )}
      </div>

      <div className="h-2" aria-hidden="true" />
    </>
  );
}
