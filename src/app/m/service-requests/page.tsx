import { revalidatePath } from "next/cache";
import Link from "next/link";
import { 
  Bell, 
  HandPlatter, 
  Receipt, 
  Clock, 
  StickyNote, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle 
} from "lucide-react";
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
  if (type === "call_waiter") return "Garson Çağır";
  if (type === "request_bill") return "Hesap İste";
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
        <div className="m-card m-banner-warning border border-amber-300 rounded-[20px] bg-amber-50 p-4 shadow-sm mb-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">
            Demo modda masa talebi verisi üretilmiyor. Canlı akışta QR ve masa ekranından bu kuyruk dolar.
          </p>
        </div>
      ) : null}

      {/* Service Request stats board */}
      <section className="m-grid-3">
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{activeStatus === "open" ? "Açık" : "Çözülen"}</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900 uupm-monospace-num">{requests.length}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Garson Çağrı</p>
          <p className="mt-1.5 text-2xl font-black text-sky-600 uupm-monospace-num">{waiterCalls}</p>
        </article>
        <article className="uupm-card-interactive rounded-[22px] border border-slate-200 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Hesap İste</p>
          <p className="mt-1.5 text-2xl font-black text-emerald-600 uupm-monospace-num">{billCalls}</p>
        </article>
      </section>

      {/* Status Segment Switcher */}
      <section className="m-card m-segment-wrap rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm mt-3.5">
        <div className="m-segment-row">
          <Link href={statusHref("open")} data-active={activeStatus === "open"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Açık Talepler
          </Link>
          <Link href={statusHref("resolved")} data-active={activeStatus === "resolved"} className="m-segment-pill rounded-xl transition-all duration-200 active:scale-95 text-xs font-extrabold px-4.5 py-3">
            Çözülen Talepler
          </Link>
        </div>
      </section>

      {/* Selected view header card */}
      <section className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm mt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Servis Talepleri</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900">
              {activeStatus === "open" ? "Yanıt Bekleyen Bildirimler" : "Tamamlanan Çağrılar"}
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {activeStatus === "open" ? "Çağrı yapan masayı bulun ve müdahale ettikten sonra çözüldü yapın." : "Çözümlenmiş çağrıların vardiya geçmişi."}
            </p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
            delayedCalls > 0 && activeStatus === "open" 
              ? "bg-rose-500 text-white uupm-glow-danger" 
              : "bg-slate-200 text-slate-800"
          }`}>
            {activeStatus === "open" ? `${delayedCalls} Geciken` : `Sayfa ${page}`}
          </span>
        </div>
      </section>

      {/* Requests Queue stack */}
      <section className="m-stack mt-3.5">
        {requests.length === 0 ? (
          <article className="m-card border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center rounded-[24px]">
            <p className="text-sm font-bold text-slate-800">{activeStatus === "open" ? "Açık talep bulunmuyor." : "Çözülen talep bulunmuyor."}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">QR menüden garson veya hesap isteği geldiğinde burada görünür.</p>
          </article>
        ) : (
          requests.map((request) => {
            const elapsed = elapsedLabel(request.created_at);
            const isDelayed = elapsed !== "Yeni";
            const RequestIcon = request.request_type === "request_bill" ? Receipt : HandPlatter;

            if (activeStatus === "open") {
              return (
                <SwipeableActionCard
                  key={request.id}
                  action={resolveMobileRequestAction}
                  actionLabel="✓ Çözüldü Olarak İşaretle"
                  actionBgClass="bg-emerald-600"
                  hiddenInputs={{ requestId: request.id }}
                  className={isDelayed ? "uupm-pulsing-critical" : ""}
                  cardClassName={`m-card uupm-card-interactive rounded-[24px] border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                    isDelayed ? "border-amber-400" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 shrink-0">
                        <RequestIcon className="h-5 w-5" strokeWidth={2.4} />
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Masa {request.table_number ?? "-"}</p>
                        <h2 className="mt-0.5 text-sm font-black text-slate-900">{toLabel(request.request_type)}</h2>
                        <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                          <p className="text-[10px] font-bold uppercase tracking-wider">{new Date(request.created_at).toLocaleTimeString("tr-TR", {hour: "2-digit", minute: "2-digit"})}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest ${
                      isDelayed ? "bg-amber-500 text-white uupm-glow-warning" : "bg-slate-200 text-slate-700"
                    }`}>{elapsed}</span>
                  </div>

                  {request.note?.trim() ? (
                    <div className="mt-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold text-slate-700 flex items-start gap-2">
                      <StickyNote className="h-4.5 w-4.5 text-slate-400 shrink-0" strokeWidth={2.2} />
                      <span>{request.note}</span>
                    </div>
                  ) : null}

                  <form action={resolveMobileRequestAction} className="mt-4">
                    <input type="hidden" name="requestId" value={request.id} />
                    <PendingSubmitButton
                      idleLabel="Çözüldü Yap (veya sağa kaydır)"
                      pendingLabel="Çözülüyor..."
                      showToastOnClick={true}
                      className="mobile-cta-primary bg-gradient-to-r from-slate-900 to-slate-800 text-white w-full inline-flex items-center justify-center py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm active:scale-98 transition-all"
                    />
                  </form>
                </SwipeableActionCard>
              );
            }

            return (
              <article key={request.id} className="m-card rounded-[24px] border border-slate-200 bg-white p-4.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 shrink-0">
                      <RequestIcon className="h-5 w-5" strokeWidth={2.4} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Masa {request.table_number ?? "-"}</p>
                      <h2 className="mt-0.5 text-sm font-black text-slate-900">{toLabel(request.request_type)}</h2>
                      <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                        <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                        <p className="text-[10px] font-bold uppercase tracking-wider">{new Date(request.created_at).toLocaleTimeString("tr-TR", {hour: "2-digit", minute: "2-digit"})}</p>
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{elapsed}</span>
                </div>

                {request.note?.trim() ? (
                  <div className="mt-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs font-bold text-slate-600 flex items-start gap-2">
                    <StickyNote className="h-4.5 w-4.5 text-slate-400 shrink-0" strokeWidth={2.2} />
                    <span>{request.note}</span>
                  </div>
                ) : null}

                <div className="mt-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 p-3.5 flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                  <span>Talep Çözümlenmiş</span>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Pagination control footer */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {hasPreviousPage ? (
          <Link 
            href={statusHref(activeStatus, page - 1)} 
            className="mobile-cta-secondary border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-extrabold transition-all active:scale-95"
          >
            <ChevronLeft className="h-4.5 w-4.5 shrink-0 text-slate-600" strokeWidth={2.4} />
            Önceki Sayfa
          </Link>
        ) : (
          <span className="mobile-cta-secondary border border-slate-100 bg-slate-100/50 text-slate-400 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-extrabold cursor-not-allowed">
            <ChevronLeft className="h-4.5 w-4.5 shrink-0 text-slate-300" strokeWidth={2.4} />
            Önceki Sayfa
          </span>
        )}
        {hasNextPage ? (
          <Link 
            href={statusHref(activeStatus, page + 1)} 
            className="mobile-cta-secondary border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-extrabold transition-all active:scale-95"
          >
            Sonraki Sayfa
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-600" strokeWidth={2.4} />
          </Link>
        ) : (
          <span className="mobile-cta-secondary border border-slate-100 bg-slate-100/50 text-slate-400 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-xs font-extrabold cursor-not-allowed">
            Sonraki Sayfa
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-300" strokeWidth={2.4} />
          </span>
        )}
      </div>

      <div className="h-4" aria-hidden="true" />
    </>
  );
}
