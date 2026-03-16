import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, NoticeBanner, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUserWithRole, hasRoleAccess, requireRole } from "@/lib/auth";
import { getTableMap, getTableZones, listLatestOrdersByTableIds, listTableRequests, updateTableStatus } from "@/lib/domains/tables";
import type { TableStatus } from "@/lib/types";

const statusStyles: Record<TableStatus, string> = {
  empty: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-800",
  reserved: "bg-sky-100 text-sky-800",
};

type TableFilter = "all" | TableStatus;

function parseTableFilter(value?: string | null): TableFilter {
  if (value === "empty" || value === "occupied" || value === "reserved") {
    return value;
  }
  return "all";
}

function filterHref(filter: TableFilter) {
  return filter === "all" ? "/tables" : `/tables?status=${filter}`;
}

function feedbackHref(tone: "success" | "error", message: string, filter: TableFilter) {
  const params = new URLSearchParams();
  params.set("tone", tone);
  params.set("feedback", message);
  if (filter !== "all") {
    params.set("status", filter);
  }
  return `/tables?${params.toString()}`;
}

function tableStatusLabel(status: TableStatus) {
  if (status === "empty") return "Bos";
  if (status === "occupied") return "Dolu";
  return "Rezerve";
}

function orderStatusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "served") return "Servise Hazir";
  if (status === "paid") return "Kapandi";
  if (status === "cancelled") return "Iptal";
  if (status === "refunded") return "Iade";
  return status;
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function isOpenOrderStatus(status: string) {
  return status === "pending" || status === "preparing" || status === "served";
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} TL`;
}

async function setTableStatusAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "waiter", "cashier"], "/tables");

  const tableId = String(formData.get("tableId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  const returnFilter = parseTableFilter(String(formData.get("returnStatusFilter") ?? "").trim());

  if (!tableId || (nextStatus !== "empty" && nextStatus !== "reserved")) {
    redirect(feedbackHref("error", "Masa durumu guncellenemedi.", returnFilter));
  }

  const result = await updateTableStatus({
    tableId,
    status: nextStatus as "empty" | "reserved",
  });

  if (!result.ok) {
    redirect(feedbackHref("error", result.error ?? "Masa durumu guncellenemedi.", returnFilter));
  }

  revalidatePath("/tables");
  revalidatePath("/ops");
  revalidatePath("/admin/tables");

  redirect(
    feedbackHref(
      "success",
      nextStatus === "reserved" ? "Masa rezerveye alindi." : "Masa tekrar bos duruma alindi.",
      returnFilter,
    ),
  );
}

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; feedback?: string; tone?: "success" | "error" }>;
}) {
  await requireRole(["admin", "waiter", "cashier", "kitchen"], "/tables");
  const { status: rawFilter, feedback, tone } = await searchParams;
  const activeFilter = parseTableFilter(rawFilter);
  const currentUser = await getCurrentUserWithRole();
  const allowAll = currentUser.usingDemoData;

  const canOpenOrders = allowAll || hasRoleAccess(currentUser.role, ["admin", "waiter", "cashier"]);
  const canUseCashier = allowAll || hasRoleAccess(currentUser.role, ["admin", "cashier"]);
  const canOpenServiceRequests = allowAll || hasRoleAccess(currentUser.role, ["admin", "waiter", "cashier"]);
  const canOpenKitchen = allowAll || hasRoleAccess(currentUser.role, ["admin", "kitchen"]);
  const canManageReservations = allowAll || hasRoleAccess(currentUser.role, ["admin", "waiter", "cashier"]);
  const canManageTables = allowAll || hasRoleAccess(currentUser.role, ["admin"]);

  const { tables, usingDemoData: usingTablesDemo } = await getTableMap();
  const sortedTables = [...tables].sort((left, right) => left.table_number - right.table_number);
  const tableIds = sortedTables.map((table) => table.id);

  const [
    { ordersByTableId, usingDemoData: usingOrdersDemo },
    { requests: openRequests, hasNextPage: hasMoreOpenRequests, usingDemoData: usingRequestsDemo },
    { zones, usingDemoData: usingZonesDemo },
  ] = await Promise.all([
    listLatestOrdersByTableIds(tableIds),
    listTableRequests("open", { limit: 200, page: 1 }),
    getTableZones(),
  ]);

  const usingDemoData = usingTablesDemo || usingOrdersDemo || usingRequestsDemo || usingZonesDemo;
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.name]));
  const requestCountByTableId = new Map<string, number>();
  for (const request of openRequests) {
    const currentCount = requestCountByTableId.get(request.table_id) ?? 0;
    requestCountByTableId.set(request.table_id, currentCount + 1);
  }

  const filteredTables =
    activeFilter === "all" ? sortedTables : sortedTables.filter((table) => table.status === activeFilter);
  const emptyCount = sortedTables.filter((table) => table.status === "empty").length;
  const occupiedCount = sortedTables.filter((table) => table.status === "occupied").length;
  const reservedCount = sortedTables.filter((table) => table.status === "reserved").length;
  const openOrderCount = [...ordersByTableId.values()].filter((order) => isOpenOrderStatus(order.status)).length;
  const openRequestCountLabel = hasMoreOpenRequests ? `${openRequests.length}+` : String(openRequests.length);

  return (
    <BackofficePage
      title="Masa Takip ve Hizli Islem"
      description="Masa durumlarini izle, adisyon ve servis akisina tek ekrandan gec"
      sidebar={
        <div className="space-y-5">
          <WorkflowGuide
            title="Masa Akisi 3 Adim"
            description="Servis ekibi masayi gorup dogru aksiyona hizli gecsin."
            steps={[
              { title: "Durumu kontrol et", description: "Bos, dolu ve rezerve masa dagilimini kartlardan anlik izle." },
              { title: "Aksiyona gec", description: "Bos masada Siparis Ac, dolu masada adisyona veya mutfaga gec." },
              { title: "Kuyrugu temizle", description: "Masa taleplerini kapat ve rezervasyonlari vardiya akisina gore guncelle." },
            ]}
          />

          <SidebarPanel title="Hizli Gecis" description="Masa akisi disina cikmadan kritik ekranlara ulas.">
            <div className="grid gap-3">
              <Link href="/ops" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                Operasyon Merkezine Don
              </Link>
              {canOpenOrders ? (
                <Link href="/admin/orders" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Siparis Girisine Git
                </Link>
              ) : null}
              {canUseCashier ? (
                <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Adisyonlara Git
                </Link>
              ) : null}
              {canOpenServiceRequests ? (
                <Link href="/service-requests" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Masa Taleplerini Ac
                </Link>
              ) : null}
            </div>
          </SidebarPanel>
        </div>
      }
      actions={
        <>
          <LiveOpsBridge tables={["tables", "orders", "table_requests"]} />
          {canManageTables ? (
            <Link href="/admin/tables" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
              Masa Yonetimi
            </Link>
          ) : null}
          <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            Panele Don
          </Link>
        </>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Masa islemi tamamlanamadi" : "Masa islemi tamamlandi"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo veri modu aktif.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-5">
        <SummaryCard label="Toplam Masa" value={String(sortedTables.length)} hint="Aktif sube masa adedi" tone="accent" />
        <SummaryCard label="Bos Masa" value={String(emptyCount)} hint="Yeni servis icin hazir" tone="success" />
        <SummaryCard label="Dolu Masa" value={String(occupiedCount)} hint="Aktif adisyon var" />
        <SummaryCard label="Rezerve Masa" value={String(reservedCount)} hint="Misafir bekleyen masa" />
        <SummaryCard label="Acik Talep" value={openRequestCountLabel} hint={hasMoreOpenRequests ? "Ilk 200 talep gosteriliyor" : "Acik garson/hesap talepleri"} tone="danger" />
      </section>

      <ContentCard title="Masa Filtreleri">
        <div className="flex flex-wrap gap-2">
          {([
            { value: "all" as const, label: "Tum Masalar" },
            { value: "empty" as const, label: "Bos" },
            { value: "occupied" as const, label: "Dolu" },
            { value: "reserved" as const, label: "Rezerve" },
          ]).map((tab) => (
            <Link
              key={tab.value}
              href={filterHref(tab.value)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                activeFilter === tab.value
                  ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {tab.label}
            </Link>
          ))}
          <span className="ml-auto rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Acik adisyon: {openOrderCount}
          </span>
        </div>
      </ContentCard>

      <ContentCard title="Masa Operasyon Kartlari">
        {filteredTables.length === 0 ? (
          <EmptyPanel title="Masa bulunamadi" description="Bu filtrede gosterilecek masa yok." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTables.map((table) => {
              const latestOrder = ordersByTableId.get(table.id);
              const requestCount = requestCountByTableId.get(table.id) ?? 0;
              const zoneName = table.zone_id ? zoneNameById.get(table.zone_id) ?? "Bolge silinmis" : "Bolgesiz";
              const hasOpenOrder = latestOrder ? isOpenOrderStatus(latestOrder.status) : false;

              return (
                <article key={table.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Masa {table.table_number}</p>
                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{table.name || `Masa ${table.table_number}`}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusStyles[table.status]}`}>
                      {tableStatusLabel(table.status)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-500">
                    <p>Bolge: <span className="font-medium text-slate-700">{zoneName}</span></p>
                    <p className="break-all">QR: <span className="font-medium text-slate-700">{table.qr_code_identifier}</span></p>
                  </div>

                  {latestOrder ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Acik Adisyon</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">#{orderRef(latestOrder)}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {orderStatusLabel(latestOrder.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Kalan:{" "}
                        <span className="font-semibold text-emerald-700">
                          {formatMoney(Number(latestOrder.remaining_balance ?? latestOrder.final_price ?? latestOrder.total_price))}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Bu masada acik adisyon yok.
                    </div>
                  )}

                  {requestCount > 0 ? (
                    <div className="mt-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">
                      Bu masada {requestCount} acik servis talebi var.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {canOpenOrders ? (
                      <Link
                        href={`/admin/orders?table=${encodeURIComponent(table.id)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a3d] to-[#f2b44f] px-4 py-3 text-center text-sm font-semibold text-white"
                      >
                        {latestOrder && hasOpenOrder ? "Siparise Ekle" : "Siparis Ac"}
                      </Link>
                    ) : null}

                    {canUseCashier && latestOrder && hasOpenOrder ? (
                      <Link
                        href={`/cashier?order=${encodeURIComponent(latestOrder.id)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800"
                      >
                        Adisyona Git
                      </Link>
                    ) : null}

                    {canOpenKitchen && latestOrder && hasOpenOrder ? (
                      <Link
                        href="/kitchen"
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800"
                      >
                        Mutfaga Git
                      </Link>
                    ) : null}

                    {canOpenServiceRequests && requestCount > 0 ? (
                      <Link
                        href="/service-requests"
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800"
                      >
                        Talepleri Ac
                      </Link>
                    ) : null}

                    {canManageReservations && table.status === "empty" ? (
                      <form action={setTableStatusAction}>
                        <input type="hidden" name="tableId" value={table.id} />
                        <input type="hidden" name="status" value="reserved" />
                        <input type="hidden" name="returnStatusFilter" value={activeFilter} />
                        <PendingSubmitButton
                          idleLabel="Rezerveye Al"
                          pendingLabel="Isleniyor..."
                          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
                        />
                      </form>
                    ) : null}

                    {canManageReservations && table.status === "reserved" ? (
                      <form action={setTableStatusAction}>
                        <input type="hidden" name="tableId" value={table.id} />
                        <input type="hidden" name="status" value="empty" />
                        <input type="hidden" name="returnStatusFilter" value={activeFilter} />
                        <PendingSubmitButton
                          idleLabel="Rezervasyonu Kaldir"
                          pendingLabel="Isleniyor..."
                          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
                        />
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ContentCard>
    </BackofficePage>
  );
}
