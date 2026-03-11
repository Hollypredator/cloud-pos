import Link from "next/link";
import { BackofficePage, ContentCard, EmptyPanel, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { requireRole } from "@/lib/auth";
import { listTableRequests, resolveTableRequest } from "@/lib/domains/tables";

async function resolveAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "waiter", "cashier"], "/service-requests");

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return;
  }

  await resolveTableRequest(requestId);
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

export default async function ServiceRequestsPage() {
  await requireRole(["admin", "waiter", "cashier"], "/service-requests");
  const { requests, usingDemoData } = await listTableRequests("open");

  const waiterCalls = requests.filter((request) => request.request_type === "call_waiter").length;
  const billCalls = requests.filter((request) => request.request_type === "request_bill").length;

  return (
    <BackofficePage
      title="Masa Talepleri"
      description="Garson cagri ve hesap isteklerini tek kuyrukta yonet."
      sidebar={
        <SidebarPanel title="Servis Durumu" description="Acil talepleri gecikmeden kapat.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Acik Talepler</p>
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
              Operasyon Merkezine Don
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
            {requests.length} aktif talep
          </span>
        </>
      }
    >
      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda masa talebi verisi uretilmiyor. Canli akista QR ve masa ekranindan bu kuyruk dolar.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Toplam Talep" value={String(requests.length)} hint="Acik servis kuyrugu" tone="accent" />
        <SummaryCard label="Garson" value={String(waiterCalls)} hint="Mudahale isteyen masa" />
        <SummaryCard label="Hesap" value={String(billCalls)} hint="Tahsilata yonlenecek masa" tone="success" />
        <SummaryCard label="Acil" value={String(requests.filter((request) => elapsedLabel(request.created_at) !== "Yeni").length)} hint="1 dk ustu bekleyen talep" tone="danger" />
      </section>

      <WorkflowGuide
        title="Servis Talepleri 3 Adim"
        description="Servis ekranini ilk kez acan biri hangi talepe nasil bakacagini hemen anlasin."
        steps={[
          { title: "Masa numarasina bak", description: "Kartin ustundeki masa numarasi talebin hangi masadan geldigini gosterir." },
          { title: "Talep tipini ayirt et", description: "Garson Cagir ise masaya git; Hesap Istegi ise gerekirse kasaya veya adisyona yonel." },
          { title: "Is bitince kapat", description: "Talep cozuldugunde Cozuldu Olarak Isaretle butonuna bas; kuyruk temiz kalsin." },
        ]}
      />

      <ContentCard title="Acik Talepler">
        {requests.length === 0 ? (
          <EmptyPanel title="Acik talep yok" description="Garson cagri veya hesap istegi geldikce bu kuyrukta gorunecek." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {requests.map((request) => (
              <article key={request.id} className="rounded-[24px] border border-slate-200 bg-[#fbfbfc] p-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa {request.table_number ?? "-"}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{toLabel(request.request_type)}</h3>
                    <p className="mt-1 text-sm text-slate-500">{new Date(request.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold uppercase text-amber-800">
                    {elapsedLabel(request.created_at)}
                  </span>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Talep Notu</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{request.note?.trim() ? request.note : "Ek not yok."}</p>
                </div>

                <form action={resolveAction} className="mt-4">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-4 py-3 text-sm font-semibold text-white">
                    Cozuldu Olarak Isaretle
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </ContentCard>
    </BackofficePage>
  );
}
