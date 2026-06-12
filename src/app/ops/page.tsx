import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { BackofficePage, ContentCard, EmptyPanel, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { ClientRouteRedirect } from "@/components/client-route-redirect";
import { MobileTaskCard, MobileTaskList } from "@/components/mobile-ops-ui";
import { OpsLiveBadge } from "@/components/ops-live-badge";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { isLikelyMobileUserAgent } from "@/lib/device";
import { getCurrentUserWithRole, requireRole } from "@/lib/auth";
import { getOpsPageSnapshot, getSetupChecklistSummary } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { resolveOperatingProfile } from "@/lib/operating-profile";
import { formatOrderSourceLabel } from "@/lib/order-label";
import { logServerPerf, measureAsync } from "@/lib/perf";
import { getBusinessScopeContext } from "@/lib/server/app-context";
import { getWebPerfProfile } from "@/lib/web-perf-profile";

function statusTone(status: string) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "ready") return "bg-emerald-100 text-emerald-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "partially_paid") return "bg-blue-100 text-blue-700";
  if (status === "paid") return "bg-slate-200 text-slate-700";
  if (status === "partially_refunded") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: string, locale: "tr" | "en" | "fr") {
  if (status === "pending") return translateUiText("Bekliyor", locale);
  if (status === "preparing") return translateUiText("Hazırlaniyor", locale);
  if (status === "ready") return translateUiText("Servise Hazır", locale);
  if (status === "served") return translateUiText("Servise Hazır", locale);
  if (status === "partially_paid") return translateUiText("Kısmi Ödeme", locale);
  if (status === "paid") return translateUiText("Kapandi", locale);
  if (status === "partially_refunded") return translateUiText("Kısmi İade", locale);
  return status;
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  table_name?: string | null;
  table_zone_name?: string | null;
  customer_name?: string | null;
}, locale: "tr" | "en" | "fr") {
  return formatOrderSourceLabel(order, {
    deliveryLabel: translateUiText("Paket servis", locale),
    pickupLabel: translateUiText("Gel-al", locale),
    customerSeparator: " / ",
    tableFallbackLabel: translateUiText("Masa", locale),
  });
}

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

function formatCurrency(value: number) {
  return `${value.toFixed(2)} TL`;
}

function getIntlLocale(locale: "tr" | "en" | "fr") {
  if (locale === "en") return "en-US";
  if (locale === "fr") return "fr-FR";
  return "tr-TR";
}

function formatClock(value: string, locale: "tr" | "en" | "fr") {
  return new Date(value).toLocaleTimeString(getIntlLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

function checklistTone(done: boolean) {
  return done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800";
}

function resolveNextPickupStatus(currentStatus: string): "preparing" | "ready" | "served" | null {
  if (currentStatus === "pending") return "preparing";
  if (currentStatus === "preparing") return "ready";
  if (currentStatus === "ready") return "served";
  return null;
}

function resolvePickupActionLabel(currentStatus: string, locale: "tr" | "en" | "fr") {
  if (currentStatus === "pending") return translateUiText("Hazırlanmaya Al", locale);
  if (currentStatus === "preparing") return translateUiText("Sipariş Hazır", locale);
  if (currentStatus === "ready") return translateUiText("Teslim Edildi", locale);
  return null;
}

async function movePickupOrderStatus(formData: FormData) {
  "use server";
  await requireRole(["admin", "kitchen", "cashier"], "/ops");

  const orderId = formData.get("orderId");
  const nextStatus = formData.get("nextStatus");
  if (
    typeof orderId !== "string" ||
    (nextStatus !== "preparing" && nextStatus !== "ready" && nextStatus !== "served")
  ) {
    return;
  }

  await executeWebOpsCommand({
    type: "ORDER_STATUS_SET",
    payload: {
      order_id: orderId,
      status: nextStatus,
    },
  });

  revalidatePath("/ops");
  revalidatePath("/pickup-board");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
}

async function DeferredSetupPrompt({
  canOwner,
  locale,
  metricsOpenOrders,
  metricsTodayRevenue,
}: {
  canOwner: boolean;
  locale: "tr" | "en" | "fr";
  metricsOpenOrders: number;
  metricsTodayRevenue: number;
}) {
  const setup = await getSetupChecklistSummary();
  const showSetupPrompt =
    setup.counts.businesses === 0 ||
    setup.counts.products === 0 ||
    setup.counts.tables === 0 ||
    setup.counts.staff < 4;

  if (!showSetupPrompt) {
    return null;
  }

  const setupSteps = [
    {
      label: translateUiText("İşletme bilgileri", locale),
      description: translateUiText("Marka, telefon, adres ve demo modu ayarlari", locale),
      done: setup.counts.businesses > 0,
      href: "/admin/onboarding",
      cta: translateUiText("Kurulum merkezine git", locale),
    },
    {
      label: translateUiText("Ürün katalogu", locale),
      description: translateUiText("Kategori, ürün ve modifier kurulumunu tamamla", locale),
      done: setup.counts.products > 0,
      href: "/admin/products",
      cta: translateUiText("Ürünleri ac", locale),
    },
    {
      label: translateUiText("Salon ve masalar", locale),
      description: translateUiText("Masa isimleri, QR ve aktif salon yapısı", locale),
      done: setup.counts.tables > 0,
      href: "/admin/tables",
      cta: translateUiText("Masalari ac", locale),
    },
    {
      label: translateUiText("Ekip ve roller", locale),
      description: translateUiText("Kasiyer, garson ve mutfak hesaplarini hazırla", locale),
      done: setup.counts.staff >= 4,
      href: "/admin/roles",
      cta: translateUiText("Personeli ac", locale),
      ownerOnly: true,
    },
    {
      label: translateUiText("İlk sipariş testi", locale),
      description: translateUiText("Manuel sipariş, mutfak, kasa ve tahsilati uctan uca dene", locale),
      done: metricsOpenOrders > 0 || metricsTodayRevenue > 0,
      href: "/admin/orders",
      cta: translateUiText("Sipariş gir", locale),
    },
  ];
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;

  return (
    <section className="app-mobile-hide rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-[0_10px_20px_rgba(251,191,36,0.12)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{translateUiText("İlk Kurulum", locale)}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{translateUiText("Canli operasyon için tamamlanmasi gereken adımlar var", locale)}</h2>
          <p className="mt-3 text-sm leadıng-7 text-slate-600">
            {translateUiText("Ürün, masa, ekip ve ilk test siparişi tamamlanmadan sistem tam operasyon hazır sayilmaz. Eksik kalan adımlari bu merkezden bitir.", locale)}
          </p>
        </div>
        <div className="w-full rounded-[24px] border border-amber-200 bg-white/80 px-5 py-4 sm:w-auto">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{translateUiText("Kurulum Ilerlemesi", locale)}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            {completedSetupSteps}/{setupSteps.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">{translateUiText("Temel operasyon adımi tamamlandı", locale)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {setupSteps.filter((step) => !step.ownerOnly || canOwner).map((step) => (
          <div key={step.label} className="rounded-[24px] border border-amber-200 bg-white/85 px-4 py-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <p className="text-base font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm text-slate-500">{step.description}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checklistTone(step.done)}`}>
                {step.done ? translateUiText("Hazır", locale) : translateUiText("Eksik", locale)}
              </span>
            </div>
            <div className="mt-4">
              <Link href={step.href} className="inline-flex w-full justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto">
                {step.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ ordersPage?: string }>;
}) {
  const includeSetupInInitialPaint = false;
  const requestHeaders = await headers();
  const renderMobileMarkup = isLikelyMobileUserAgent(requestHeaders.get("user-agent"));
  const locale = await getCurrentLocale();
  const { ordersPage: ordersPageParam } = await searchParams;

  if (renderMobileMarkup) {
    const params = new URLSearchParams();
    if (ordersPageParam) {
      params.set("ordersPage", ordersPageParam);
    }
    const query = params.toString();
    return <ClientRouteRedirect href={query ? `/m/ops?${query}` : "/m/ops"} />;
  }

  const ordersPage = Number.isFinite(Number(ordersPageParam)) ? Math.max(1, Number(ordersPageParam)) : 1;
  const ordersPageSize = 6;
  const opsSnapshotPromise = measureAsync("ops_snapshot", () =>
    getOpsPageSnapshot({ includeSetup: includeSetupInInitialPaint }),
  );
  const authResult = await measureAsync("current_user", () => getCurrentUserWithRole());
  const auth = authResult.value;

  if (!auth.usingDemoData && !auth.user) {
    return <ClientRouteRedirect href="/login" />;
  }

  if (!auth.usingDemoData && !auth.role) {
    return <ClientRouteRedirect href="/unauthorized" />;
  }

  if (!auth.usingDemoData && auth.accessScope === "branch" && auth.branchAccessIds.length === 0) {
    return <ClientRouteRedirect href="/unauthorized" />;
  }

  const role = auth.role;
  const businessScope = await getBusinessScopeContext();
  const isSelfServiceCoffee = resolveOperatingProfile(businessScope?.activeBusinessType) === "coffee_self_service";
  const allowAll = auth.usingDemoData;
  if (!allowAll && role === "waiter") {
    redirect("/admin/orders");
  }
  const isManagement = role === "owner" || role === "admin";
  const canAdmin = allowAll || isManagement;
  const perfProfile = getWebPerfProfile("/ops");
  const opsSnapshotResult = await opsSnapshotPromise;
  logServerPerf(`/ops profile=${perfProfile.mode}:${perfProfile.bucket}`, [authResult, opsSnapshotResult]);
  const opsSnapshot = opsSnapshotResult.value;
  const {
    dashboard: { metrics, recentOrders, lowStockProducts, usingDemoData },
    ops,
  } = opsSnapshot;
  const canOwner = allowAll || role === "owner";
  const canKitchen = allowAll || isManagement || role === "kitchen";
  const canCashier = allowAll || isManagement || role === "cashier";
  const canWaiterOps = allowAll || isManagement || role === "waiter" || role === "cashier";
  const roleLabel = allowAll ? translateUiText("Demo", locale) : role ? translateUiText(role, locale) : translateUiText("Guest", locale);

  const priorityWarnings = [
    {
      key: "kitchen_delay",
      label: translateUiText("Mutfak Gecikmesi", locale),
      value: String(ops.delayedKitchenOrders),
      hint: `${ops.criticalKitchenOrders} ${translateUiText("Kritik", locale).toLowerCase()} ${translateUiText("Ürün", locale).toLowerCase() === "product" ? "orders" : "sipariş"}`,
      tone: ops.criticalKitchenOrders > 0 ? ("danger" as const) : ("accent" as const),
    },
    {
      key: "service_requests",
      label: translateUiText("Masa Talepleri", locale),
      value: String(ops.openServiceRequests),
      hint: translateUiText("Açık garson ve hesap talepleri", locale),
      tone: ops.openServiceRequests > 0 ? ("accent" as const) : ("neutral" as const),
    },
    {
      key: "cashier_queue",
      label: isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi Kuyrugu", locale) : translateUiText("Kasada Bekleyen", locale),
      value: String(ops.servedOrders),
      hint: isSelfServiceCoffee ? translateUiText("Durum güncelleme bekleyen pickup siparişler", locale) : translateUiText("Tahsilat icin hazir sipariş", locale),
      tone: ops.servedOrders > 0 ? ("success" as const) : ("neutral" as const),
    },
  ];
  const recentOrdersStart = (ordersPage - 1) * ordersPageSize;
  const pagedRecentOrders = recentOrders.slice(recentOrdersStart, recentOrdersStart + ordersPageSize);
  const hasNextRecentOrdersPage = recentOrders.length > recentOrdersStart + ordersPageSize;
  const hasPreviousRecentOrdersPage = ordersPage > 1;
  type PriorityQueueItem = {
    key: string;
    title: string;
    value: number;
    hint: string;
    href: string;
    tone: string;
    cta: string;
  };
  const priorityQueue = [
    canKitchen || canAdmin
      ? {
          key: "kitchen",
          title: translateUiText("Mutfakta Bekleyen Kritikler", locale),
          value: ops.delayedKitchenOrders,
          hint: translateUiText("Gecikmeyi azaltmak için mutfak istasyonuna gec.", locale),
          href: "/kitchen",
          tone: ops.criticalKitchenOrders > 0 ? "mobile-tone-critical" : "mobile-tone-warning",
          cta: translateUiText("Mutfaga Git", locale),
        }
      : null,
    canCashier
      ? {
          key: "cashier",
          title: isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi Kuyrugu", locale) : translateUiText("Kasada Tahsilat Kuyrugu", locale),
          value: ops.servedOrders,
          hint: isSelfServiceCoffee ? translateUiText("Durum güncelleme bekleyen pickup siparişler", locale) : translateUiText("Servise hazir adısyonlar kapanis bekliyor.", locale),
          href: "/cashier",
          tone: ops.servedOrders > 0 ? "mobile-tone-warning" : "mobile-tone-neutral",
          cta: isSelfServiceCoffee ? translateUiText("Sipariş Yönetimine Gec", locale) : translateUiText("Tahsilata Gec", locale),
        }
      : null,
    canWaiterOps
      ? {
          key: "service",
          title: translateUiText("Masa Talepleri", locale),
          value: ops.openServiceRequests,
          hint: translateUiText("Açık talepleri kapat ve kuyrugu temizle.", locale),
          href: "/service-requests",
          tone: ops.openServiceRequests > 0 ? "mobile-tone-warning" : "mobile-tone-neutral",
          cta: translateUiText("Talep Ekranina Gec", locale),
        }
      : null,
    {
      key: "tables",
      title: translateUiText("Masa Akışı", locale),
      value: metrics.occupiedTables,
      hint: `${metrics.emptyTables} ${translateUiText("boş masa", locale).toLowerCase()}`,
      href: "/tables",
      tone: metrics.occupiedTables > metrics.emptyTables ? "mobile-tone-warning" : "mobile-tone-success",
      cta: translateUiText("Masalari Ac", locale),
    },
  ].filter((item): item is PriorityQueueItem => item !== null);

  return (
    <BackofficePage
      title={translateUiText("Operasyon Merkezi", locale)}
      description={translateUiText("Canli sipariş, masa, mutfak ve kasayi tek ekrandan izle.", locale)}
      actions={
        <>
          <span className="inline-flex w-full justify-center rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white sm:w-auto sm:px-4 sm:text-xs">
            {translateUiText("Personel", locale)} {roleLabel}
          </span>
          {usingDemoData ? (
            <span className="inline-flex w-full justify-center rounded-full bg-amber-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 sm:w-auto sm:px-4 sm:text-xs">
              {translateUiText("Demo veri açık", locale)}
            </span>
          ) : null}
          <OpsLiveBadge />
        </>
      }
      sidebar={
        <div className="flex flex-col gap-4">
          <WorkflowGuide
            className="order-3"
            title={translateUiText("Bugün Nasıl Kullanılır?", locale)}
            description={translateUiText("Sistemi ilk kez kullanan biri için gunluk operasyon sirasi.", locale)}
            steps={[
              { title: translateUiText("Masalari ve ürünleri kontrol et", locale), description: translateUiText("Servise baslamadan önce masa, ürün ve kritik stok durumunu buradan hizlica kontrol et.", locale) },
              { title: translateUiText("Sipariş akışına bak", locale), description: translateUiText("Bekleyen sipariş varsa mutfaga, kasada bekleyen varsa tahsilata yönel.", locale) },
              { title: translateUiText("Gün sonunda rapora don", locale), description: translateUiText("Vardiya sonunda kasa ve rapor ekranlarından tahsilat ve net sonucu kontrol et.", locale) },
            ]}
          />
          <SidebarPanel title={translateUiText("Anlik Durum", locale)} description={translateUiText("Günluk operasyon nabzi ve risk odaklari.", locale)}>
            <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-sm sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{translateUiText("Günluk Ciro", locale)}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{formatCurrency(metrics.todayRevenue)}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Dolu Masa", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.occupiedTables}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Boş Masa", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.emptyTables}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {priorityWarnings
                .filter((item) => (item.key === "kitchen_delay" ? canKitchen || canAdmin : item.key === "cashier_queue" ? canCashier : canWaiterOps))
                .map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-white">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{item.value}</p>
                        <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
                      </div>
                      <span
                        className={
                          item.tone === "danger"
                            ? "inline-flex w-full justify-center rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 sm:w-auto"
                            : item.tone === "accent"
                              ? "inline-flex w-full justify-center rounded-xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700 sm:w-auto"
                              : item.tone === "success"
                                ? "inline-flex w-full justify-center rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 sm:w-auto"
                                : "inline-flex w-full justify-center rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto"
                        }
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </SidebarPanel>

          <SidebarPanel title={translateUiText("Hızlı Aksiyonlar", locale)} description={translateUiText("En sik kullanilan operasyon gecisleri.", locale)}>
            <div className="grid gap-3">
              <Link href="/admin/tables" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                {translateUiText("Masa QR Yönetimi", locale)}
              </Link>
              {canKitchen ? (
                <Link href="/kitchen" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                  {translateUiText("Mutfak Board", locale)}
                </Link>
              ) : null}
              {canCashier ? (
                <Link href="/cashier" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                  {isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi", locale) : translateUiText("Kasa Ekrani", locale)}
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/delivery" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                  {translateUiText("Teslimat Board", locale)}
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/service-requests" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                  {translateUiText("Masa Talepleri", locale)}
                </Link>
              ) : null}
              {canAdmin ? (
                <Link href="/admin/orders" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-white sm:text-left">
                  {translateUiText("Manuel Sipariş Gir", locale)}
                </Link>
              ) : null}
            </div>
          </SidebarPanel>
        </div>
      }
    >
        <MobileTaskList>
        <MobileTaskCard
          title={translateUiText("Canli Operasyon", locale)}
          subtitle={translateUiText("Öncelik kuyruğu", locale)}
        >
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-amber-50 px-2 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">{translateUiText("Bekleyen", locale)}</p>
              <p className="mt-1 text-lg font-semibold text-amber-900">{ops.pendingOrders}</p>
            </div>
            <div className="rounded-xl bg-sky-50 px-2 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">{translateUiText("Hazır", locale)}</p>
              <p className="mt-1 text-lg font-semibold text-sky-900">{ops.servedOrders}</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-2 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">{translateUiText("Kritik", locale)}</p>
              <p className="mt-1 text-lg font-semibold text-rose-900">{ops.criticalKitchenOrders}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-2 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{translateUiText("Ciro", locale)}</p>
              <p className="mt-1 text-lg font-semibold text-emerald-900">{Math.round(ops.todayRevenue)}</p>
            </div>
          </div>
        </MobileTaskCard>

        {priorityQueue.map((item) => (
          <MobileTaskCard key={item.key}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.95rem] font-semibold tracking-tight text-slate-900">{item.title}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>{item.value}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{item.hint}</p>
            <Link href={item.href} className="mobile-cta-primary mt-3 inline-flex w-full items-center justify-center px-4 py-3 text-sm">
              {item.cta}
            </Link>
          </MobileTaskCard>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <Link href="/tables" className="mobile-cta-secondary inline-flex items-center justify-center px-3 py-3 text-sm font-semibold">
            {translateUiText("Masa Akışı", locale)}
          </Link>
          <Link href="/cashier" className="mobile-cta-secondary inline-flex items-center justify-center px-3 py-3 text-sm font-semibold">
            {isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi", locale) : translateUiText("Tahsilat", locale)}
          </Link>
        </div>
      </MobileTaskList>

      <section className="app-mobile-hide grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={translateUiText("Açık Sipariş", locale)} value={String(metrics.openOrders)} hint={translateUiText("Pending, hazirlaniyor ve kasada bekleyen toplam sipariş", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Bekleyen", locale)} value={String(metrics.pending)} hint={translateUiText("Mutfaga yeni dusen isler", locale)} tone="danger" />
        <SummaryCard label={translateUiText("Hazırlaniyor", locale)} value={String(metrics.preparing)} hint={translateUiText("Aktif mutfak uretimi", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Servise Hazır", locale)} value={String(ops.servedOrders)} hint={translateUiText("Kasada kapanış bekleyen adısyonlar", locale)} tone="success" />
      </section>

      {canAdmin ? (
        <Suspense fallback={null}>
          <DeferredSetupPrompt
            canOwner={canOwner}
            locale={locale}
            metricsOpenOrders={metrics.openOrders}
            metricsTodayRevenue={metrics.todayRevenue}
          />
        </Suspense>
      ) : null}

      <section className="app-mobile-hide grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ContentCard title={translateUiText("Anlik Sipariş Akışı", locale)}>
          {recentOrders.length === 0 ? (
            <EmptyPanel title={translateUiText("Sipariş akışı boş", locale)} description={translateUiText("Bu vardiyada izlenecek yeni sipariş oluştugunda burada gune ait son siparişler gorunur.", locale)} />
          ) : (
            <div className="space-y-3">
              {pagedRecentOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-slate-300">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order, locale)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Sipariş #{orderRef(order)}</h3>
                      <p className="mt-2 text-sm text-slate-500">{formatClock(order.created_at, locale)} {translateUiText("oluşturuldu", locale)}</p>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                      <span className={`inline-flex w-full justify-center rounded-full px-3 py-2 text-xs font-semibold uppercase sm:w-auto ${statusTone(order.status)}`}>
                        {statusLabel(order.status, locale)}
                      </span>
                      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {formatCurrency(Number(order.final_price ?? order.total_price))}
                      </p>
                    </div>
                  </div>
                  {order.channel === "pickup" ? (
                    (() => {
                      const nextPickupStatus = resolveNextPickupStatus(order.status);
                      const pickupActionLabel = resolvePickupActionLabel(order.status, locale);
                      if (!nextPickupStatus || !pickupActionLabel) {
                        return null;
                      }
                      return (
                        <form action={movePickupOrderStatus} className="mt-3">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="nextStatus" value={nextPickupStatus} />
                          <PendingSubmitButton
                            idleLabel={pickupActionLabel}
                            pendingLabel={translateUiText("Güncelleniyor...", locale)}
                            showToastOnClick
                            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white sm:w-auto ${
                              nextPickupStatus === "preparing"
                                ? "bg-gradient-to-r from-[#ff5a34] to-[#f0b14f]"
                                : nextPickupStatus === "ready"
                                  ? "bg-slate-900"
                                  : "bg-emerald-700"
                            }`}
                          />
                        </form>
                      );
                    })()
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {hasPreviousRecentOrdersPage ? (
                  <Link href={`/ops?ordersPage=${ordersPage - 1}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    Önceki
                  </Link>
                ) : (
                  <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Önceki</span>
                )}
                {hasNextRecentOrdersPage ? (
                  <Link href={`/ops?ordersPage=${ordersPage + 1}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    Sonraki
                  </Link>
                ) : (
                  <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Sonraki</span>
                )}
              </div>
            </div>
          )}
        </ContentCard>

        <div className="space-y-4">
        <ContentCard title={translateUiText("Masa Durumu", locale)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{translateUiText("Dolu", locale)}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-900">{metrics.occupiedTables}</p>
                <p className="mt-2 text-sm text-amber-700">{translateUiText("Aktif servis alan masalar", locale)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{translateUiText("Boş", locale)}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-900">{metrics.emptyTables}</p>
                <p className="mt-2 text-sm text-emerald-700">{translateUiText("Yeni oturum için hazır masalar", locale)}</p>
              </div>
            </div>
            <Link href="/admin/tables" className="mt-4 inline-flex w-full rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:w-auto">
              {translateUiText("Masa operasyonunu ac", locale)}
            </Link>
          </ContentCard>

          <ContentCard title={translateUiText("Kritik Stok", locale)}>
            {lowStockProducts.length === 0 ? (
              <EmptyPanel title={translateUiText("Kritik stok yok", locale)} description={translateUiText("Eşik altina dusen ürün olmadıgi için bu vardiyada stok riski gorunmuyor.", locale)} />
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <div key={product.id} className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{translateUiText("Kritik stok seviyesinde", locale)}</p>
                    </div>
                    <span className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-rose-700">{product.stock_count}</span>
                  </div>
                ))}
                <Link href="/admin/stock" className="inline-flex w-full rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:w-auto">
                  {translateUiText("Stok ekranina git", locale)}
                </Link>
              </div>
            )}
          </ContentCard>
        </div>
      </section>

      <section className="app-mobile-hide grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <ContentCard title={translateUiText("Operasyon Isaretleri", locale)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Servis Talepleri", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openServiceRequests}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Garson cagir, hesap iste ve benzeri talepler", locale)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kritik Mutfak", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.criticalKitchenOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Eşik üstü gecikmiş sipariş sayısı", locale)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Bugunku Açık Sipariş", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Operasyonda halen kapanmamis siparişler", locale)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi", locale) : translateUiText("Kasa Bekleyen", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.servedOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{isSelfServiceCoffee ? translateUiText("Durum güncelleme bekleyen pickup siparişler", locale) : translateUiText("Tahsilat bekleyen servisler", locale)}</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title={translateUiText("Yönetim Gecisleri", locale)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {canCashier ? (
              <Link href="/cashier/session" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {isSelfServiceCoffee ? translateUiText("Sipariş Yönetimi", locale) : translateUiText("Kasa Acilis / Kapanis", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/products" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Ürün Yönetimi", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/reports" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Satis Raporlari", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/finance" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Gelir / Gider", locale)}
              </Link>
            ) : null}
            {canOwner ? (
              <Link href="/admin/settings" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("İşletme Ayarlari", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/orders" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Sipariş Girişi", locale)}
              </Link>
            ) : null}
          </div>
        </ContentCard>
      </section>
    </BackofficePage>
  );
}
