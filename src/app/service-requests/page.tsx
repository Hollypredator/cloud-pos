import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BackofficePage, ContentCard, EmptyPanel, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { MobileTaskCard, MobileTaskList } from "@/components/mobile-ops-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireRole } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/i18n-server";
import { listTableRequests } from "@/lib/domains/tables";
import { executeWebOpsCommand } from "@/lib/ops/server-action";

async function resolveAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/service-requests");

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
  revalidatePath("/service-requests");
  revalidatePath("/ops");
}

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

type RequestStatusFilter = "open" | "resolved";

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
  return `/service-requests?${params.toString()}`;
}

export default async function ServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await requireRole(["admin", "cashier"], "/service-requests");
  const locale = await getCurrentLocale();
  const localeCode = locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : "tr-TR";
  const { page: pageParam, status: statusParam } = await searchParams;
  const activeStatus = parseStatusFilter(statusParam);
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
  const { requests, usingDemoData, hasNextPage, hasPreviousPage } = await listTableRequests(activeStatus, { page, limit: 24 });

  const waiterCalls = requests.filter((request) => request.request_type === "call_waiter").length;
  const billCalls = requests.filter((request) => request.request_type === "request_bill").length;

  return (
    <BackofficePage
      title="Masa Talepleri"
      description="Garson cagri ve hesap isteklerini tek kuyrukta yönet."
      sidebar={
        <SidebarPanel title="Servis Durumu" description="Acil talepleri gecikmeden kapat.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Açık Talepler</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{requests.length}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Garson</p>
                <p className="mt-2 text-2xl font-semibold">{waiterCalls}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hesap</p>
                <p className="mt-2 text-2xl font-semibold">{billCalls}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <Link href="/ops" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              Operasyon Merkezine Dön
            </Link>
            <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              Adisyonlara Git
            </Link>
          </div>
        </SidebarPanel>
      }
      actions={
        <>
          <LiveOpsBridge tables={["table_requests"]} />
          <span className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800">
            {requests.length} {activeStatus === "open" ? "aktif talep" : "cozulmus talep"}
          </span>
          <span className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            Sayfa {page}
          </span>
        </>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda masa talebi verisi uretilmiyor. Canlı akışta QR ve masa ekranindan bu kuyruk dolar.
        </div>
      ) : null}

      <section className="app-mobile-hide grid gap-4 xl:grid-cols-4">
        <SummaryCard
          label={activeStatus === "open" ? "Toplam Talep" : "Cozulen Talep"}
          value={String(requests.length)}
          hint={activeStatus === "open" ? "Açık servis kuyrugu" : "Kapanan servis geçmişi"}
          tone="accent"
        />
        <SummaryCard label="Garson" value={String(waiterCalls)} hint="Mudahale isteyen masa" />
        <SummaryCard label="Hesap" value={String(billCalls)} hint="Tahsilata yonlenecek masa" tone="success" />
        <SummaryCard
          label={activeStatus === "open" ? "Acil" : "Bekleme Suresi"}
          value={String(requests.filter((request) => elapsedLabel(request.created_at) !== "Yeni").length)}
          hint={activeStatus === "open" ? "1 dk üstü bekleyen talep" : "1 dk üzeri kayitlar"}
          tone="danger"
        />
      </section>

      <MobileTaskList>
        <div className="mobile-task-tabs">
          <Link href={statusHref("open")} data-active={activeStatus === "open"} className="mobile-task-tab">
            Açık
          </Link>
          <Link href={statusHref("resolved")} data-active={activeStatus === "resolved"} className="mobile-task-tab">
            Cozuldu
          </Link>
        </div>
        <MobileTaskCard
          title="Servis Kuyrugu"
          subtitle={activeStatus === "open" ? "Mudahale Bekleyen Talepler" : "Kapanan Talepler"}
        >
          <p className="mt-1 text-sm text-slate-500">
            {activeStatus === "open"
              ? "Garson ve hesap isteklerini tek dokunuşla çöz."
              : "Cozulen talepleri vardiya takibi için incele."}
          </p>
        </MobileTaskCard>

        {requests.length === 0 ? (
          <MobileTaskCard subtitle="Açık talep yok">
            <p className="text-sm text-slate-500">Garson cagri veya hesap isteği geldikce bu kuyrukta görünecek.</p>
          </MobileTaskCard>
        ) : (
          requests.map((request) => (
            <MobileTaskCard key={`mobile-request-${request.id}`} title={`Masa ${request.table_number ?? "-"}`} subtitle={toLabel(request.request_type)}>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(request.created_at).toLocaleString(localeCode)}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold uppercase text-amber-800">{elapsedLabel(request.created_at)}</span>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                {request.note?.trim() ? request.note : "Ek not yok."}
              </div>
              {activeStatus === "open" ? (
                <form action={resolveAction} className="mt-3">
                  <input type="hidden" name="requestId" value={request.id} />
                  <PendingSubmitButton
                    idleLabel="Cozuldu Olarak Isaretle"
                    pendingLabel="Kapatiliyor..."
                    className="mobile-cta-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                  />
                </form>
              ) : (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Talep cozulmus.</div>
              )}
            </MobileTaskCard>
          ))
        )}

        <div className="grid grid-cols-2 gap-2">
          {hasPreviousPage ? (
            <Link href={statusHref(activeStatus, page - 1)} className="mobile-cta-secondary inline-flex items-center justify-center border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              önceki
            </Link>
          ) : (
            <span className="mobile-cta-secondary inline-flex items-center justify-center border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">önceki</span>
          )}
          {hasNextPage ? (
            <Link href={statusHref(activeStatus, page + 1)} className="mobile-cta-secondary inline-flex items-center justify-center border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              Sonraki
            </Link>
          ) : (
            <span className="mobile-cta-secondary inline-flex items-center justify-center border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">Sonraki</span>
          )}
        </div>
      </MobileTaskList>

      <WorkflowGuide
        title="Servis Talepleri 3 Adim"
        description="Servis ekranini ilk kez acan biri hangi talepe nasıl bakacagini hemen anlasin."
        className="app-mobile-hide"
        steps={[
          { title: "Masa numarasina bak", description: "Kartin ustundeki masa numarasi talebin hangi masadan geldigini gösterir." },
          { title: "Talep tipini ayirt et", description: "Garson Cagir ise masaya git; Hesap Istegi ise gerekirse kasaya veya adisyona yonel." },
          { title: "Is bitince kapat", description: "Talep cozuldugunde Cozuldu Olarak Isaretle butonuna bas; kuyruk temiz kalsin." },
        ]}
      />

      <ContentCard title="Açık Talepler" className="app-mobile-hide">
        {requests.length === 0 ? (
          <EmptyPanel title="Açık talep yok" description="Garson cagri veya hesap isteği geldikce bu kuyrukta görünecek." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {requests.map((request) => (
                <article key={request.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa {request.table_number ?? "-"}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{toLabel(request.request_type)}</h3>
                      <p className="mt-1 text-sm text-slate-500">{new Date(request.created_at).toLocaleString(localeCode)}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold uppercase text-amber-800">
                      {elapsedLabel(request.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Talep Notu</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{request.note?.trim() ? request.note : "Ek not yok."}</p>
                  </div>

                  {activeStatus === "open" ? (
                    <form action={resolveAction} className="mt-4">
                      <input type="hidden" name="requestId" value={request.id} />
                      <PendingSubmitButton
                        idleLabel="Cozuldu Olarak Isaretle"
                        pendingLabel="Kapatiliyor..."
                        className="mobile-cta-primary w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white"
                      />
                    </form>
                  ) : (
                    <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      Talep cozulmus.
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasPreviousPage ? (
                <Link href={statusHref(activeStatus, page - 1)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  önceki
                </Link>
              ) : (
                <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">önceki</span>
              )}
              {hasNextPage ? (
                <Link href={statusHref(activeStatus, page + 1)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Sonraki
                </Link>
              ) : (
                <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Sonraki</span>
              )}
            </div>
          </div>
        )}
      </ContentCard>
    </BackofficePage>
  );
}

