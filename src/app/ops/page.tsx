import Link from "next/link";
import { redirect } from "next/navigation";
import { BackofficePage, ContentCard, EmptyPanel, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { OpsLiveBadge } from "@/components/ops-live-badge";
import { getCurrentUserIdentity } from "@/lib/auth";
import { getOpsPageSnapshot } from "@/lib/data";
import { getCurrentLocale } from "@/lib/i18n-server";
import { translateUiText } from "@/lib/i18n";
import { logServerPerf, measureAsync } from "@/lib/perf";

function statusTone(status: string) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "paid") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: string, locale: "tr" | "en" | "fr") {
  if (status === "pending") return translateUiText("Bekliyor", locale);
  if (status === "preparing") return translateUiText("Hazirlaniyor", locale);
  if (status === "served") return translateUiText("Servise Hazir", locale);
  if (status === "paid") return translateUiText("Kapandi", locale);
  return status;
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  customer_name?: string | null;
}, locale: "tr" | "en" | "fr") {
  if (order.channel === "delivery") {
    return order.customer_name ? `${translateUiText("Paket servis", locale)} / ${order.customer_name}` : translateUiText("Paket servis", locale);
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `${translateUiText("Gel-al", locale)} / ${order.customer_name}` : translateUiText("Gel-al", locale);
  }
  return `${translateUiText("Masa", locale)} ${order.table_number ?? "-"}`;
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

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ ordersPage?: string }>;
}) {
  const locale = await getCurrentLocale();
  const { ordersPage: ordersPageParam } = await searchParams;
  const ordersPage = Number.isFinite(Number(ordersPageParam)) ? Math.max(1, Number(ordersPageParam)) : 1;
  const ordersPageSize = 6;
  const authResult = await measureAsync("current_user", () => getCurrentUserIdentity());
  const auth = authResult.value;

  if (!auth.usingDemoData && !auth.user) {
    redirect("/login");
  }

  const role = auth.role;
  const allowAll = auth.usingDemoData;
  const isManagement = role === "owner" || role === "admin";
  const canAdmin = allowAll || isManagement;
  const showInlineSetup = canAdmin;
  const opsSnapshotResult = await measureAsync("ops_snapshot", () => getOpsPageSnapshot({ includeSetup: showInlineSetup }));
  logServerPerf("/ops", [authResult, opsSnapshotResult]);
  const opsSnapshot = opsSnapshotResult.value;
  const {
    dashboard: { metrics, recentOrders, lowStockProducts, usingDemoData },
    ops,
    setup,
  } = opsSnapshot;
  const canOwner = allowAll || role === "owner";
  const canKitchen = allowAll || isManagement || role === "kitchen";
  const canCashier = allowAll || isManagement || role === "cashier";
  const canWaiterOps = allowAll || isManagement || role === "waiter" || role === "cashier";
  const roleLabel = allowAll ? translateUiText("Demo", locale) : role ? translateUiText(role, locale) : translateUiText("Guest", locale);
  const showSetupPrompt =
    showInlineSetup &&
    canAdmin && (setup.counts.businesses === 0 || setup.counts.products === 0 || setup.counts.tables === 0 || setup.counts.staff < 4);
  const setupSteps = [
    {
      label: translateUiText("Isletme bilgileri", locale),
      description: translateUiText("Marka, telefon, adres ve demo modu ayarlari", locale),
      done: setup.counts.businesses > 0,
      href: "/admin/onboarding",
      cta: translateUiText("Kurulum merkezine git", locale),
    },
    {
      label: translateUiText("Urun katalogu", locale),
      description: translateUiText("Kategori, urun ve modifier kurulumunu tamamla", locale),
      done: setup.counts.products > 0,
      href: "/admin/products",
      cta: translateUiText("Urunleri ac", locale),
    },
    {
      label: translateUiText("Salon ve masalar", locale),
      description: translateUiText("Masa isimleri, QR ve aktif salon yapisi", locale),
      done: setup.counts.tables > 0,
      href: "/admin/tables",
      cta: translateUiText("Masalari ac", locale),
    },
    {
      label: translateUiText("Ekip ve roller", locale),
      description: translateUiText("Kasiyer, garson ve mutfak hesaplarini hazirla", locale),
      done: setup.counts.staff >= 4,
      href: "/admin/roles",
      cta: translateUiText("Personeli ac", locale),
      ownerOnly: true,
    },
    {
      label: translateUiText("Ilk siparis testi", locale),
      description: translateUiText("Manuel siparis, mutfak, kasa ve tahsilati uctan uca dene", locale),
      done: metrics.openOrders > 0 || metrics.todayRevenue > 0,
      href: "/admin/orders",
      cta: translateUiText("Siparis gir", locale),
    },
  ];
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;

  const priorityWarnings = [
    {
      key: "kitchen_delay",
      label: translateUiText("Mutfak Gecikmesi", locale),
      value: String(ops.delayedKitchenOrders),
      hint: `${ops.criticalKitchenOrders} ${translateUiText("Kritik", locale).toLowerCase()} ${translateUiText("Urun", locale).toLowerCase() === "product" ? "orders" : "siparis"}`,
      tone: ops.criticalKitchenOrders > 0 ? ("danger" as const) : ("accent" as const),
    },
    {
      key: "service_requests",
      label: translateUiText("Masa Talepleri", locale),
      value: String(ops.openServiceRequests),
      hint: translateUiText("Acik garson ve hesap talepleri", locale),
      tone: ops.openServiceRequests > 0 ? ("accent" as const) : ("neutral" as const),
    },
    {
      key: "cashier_queue",
      label: translateUiText("Kasada Bekleyen", locale),
      value: String(ops.servedOrders),
      hint: translateUiText("Tahsilat icin hazir siparis", locale),
      tone: ops.servedOrders > 0 ? ("success" as const) : ("neutral" as const),
    },
  ];
  const recentOrdersStart = (ordersPage - 1) * ordersPageSize;
  const pagedRecentOrders = recentOrders.slice(recentOrdersStart, recentOrdersStart + ordersPageSize);
  const hasNextRecentOrdersPage = recentOrders.length > recentOrdersStart + ordersPageSize;
  const hasPreviousRecentOrdersPage = ordersPage > 1;

  return (
    <BackofficePage
      title={translateUiText("Operasyon Merkezi", locale)}
      description={translateUiText("Canli siparis, masa, mutfak ve kasayi tek ekrandan izle.", locale)}
      actions={
        <>
          <span className="inline-flex w-full justify-center rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white sm:w-auto sm:px-4 sm:text-xs">
            {translateUiText("Personel", locale)} {roleLabel}
          </span>
          {usingDemoData ? (
            <span className="inline-flex w-full justify-center rounded-full bg-amber-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 sm:w-auto sm:px-4 sm:text-xs">
              {translateUiText("Demo veri acik", locale)}
            </span>
          ) : null}
          <OpsLiveBadge />
        </>
      }
      sidebar={
        <div className="space-y-5">
          <WorkflowGuide
            title={translateUiText("Bugun Nasil Kullanilir?", locale)}
            description={translateUiText("Sistemi ilk kez kullanan biri icin gunluk operasyon sirasi.", locale)}
            steps={[
              { title: translateUiText("Masalari ve urunleri kontrol et", locale), description: translateUiText("Servise baslamadan once masa, urun ve kritik stok durumunu buradan hizlica kontrol et.", locale) },
              { title: translateUiText("Siparis akisina bak", locale), description: translateUiText("Bekleyen siparis varsa mutfaga, kasada bekleyen varsa tahsilata yonel.", locale) },
              { title: translateUiText("Gun sonunda rapora don", locale), description: translateUiText("Vardiya sonunda kasa ve rapor ekranlarindan tahsilat ve net sonucu kontrol et.", locale) },
            ]}
          />
          <SidebarPanel title={translateUiText("Anlik Durum", locale)} description={translateUiText("Gunluk operasyon nabzi ve risk odaklari.", locale)}>
            <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{translateUiText("Gunluk Ciro", locale)}</p>
              <p className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">{formatCurrency(metrics.todayRevenue)}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Dolu Masa", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.occupiedTables}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Bos Masa", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.emptyTables}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {priorityWarnings
                .filter((item) => (item.key === "kitchen_delay" ? canKitchen || canAdmin : item.key === "cashier_queue" ? canCashier : canWaiterOps))
                .map((item) => (
                  <div key={item.key} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{item.value}</p>
                        <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
                      </div>
                      <span
                        className={
                          item.tone === "danger"
                            ? "inline-flex w-full justify-center rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 sm:w-auto"
                            : item.tone === "accent"
                              ? "inline-flex w-full justify-center rounded-2xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700 sm:w-auto"
                              : item.tone === "success"
                                ? "inline-flex w-full justify-center rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 sm:w-auto"
                                : "inline-flex w-full justify-center rounded-2xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto"
                        }
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </SidebarPanel>

          <SidebarPanel title={translateUiText("Hizli Aksiyonlar", locale)} description={translateUiText("En sik kullanilan operasyon gecisleri.", locale)}>
            <div className="grid gap-3">
              <Link href="/admin/tables" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                {translateUiText("Masa QR Yonetimi", locale)}
              </Link>
              {canKitchen ? (
                <Link href="/kitchen" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                  {translateUiText("Mutfak Board", locale)}
                </Link>
              ) : null}
              {canCashier ? (
                <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                  {translateUiText("Kasa Ekrani", locale)}
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/delivery" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                  {translateUiText("Teslimat Board", locale)}
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/service-requests" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                  {translateUiText("Masa Talepleri", locale)}
                </Link>
              ) : null}
              {canAdmin ? (
                <Link href="/admin/orders" className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:text-left">
                  {translateUiText("Manuel Siparis Gir", locale)}
                </Link>
              ) : null}
            </div>
          </SidebarPanel>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={translateUiText("Acik Siparis", locale)} value={String(metrics.openOrders)} hint={translateUiText("Pending, hazirlaniyor ve kasada bekleyen toplam siparis", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Bekleyen", locale)} value={String(metrics.pending)} hint={translateUiText("Mutfaga yeni dusen isler", locale)} tone="danger" />
        <SummaryCard label={translateUiText("Hazirlaniyor", locale)} value={String(metrics.preparing)} hint={translateUiText("Aktif mutfak uretimi", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Servise Hazir", locale)} value={String(ops.servedOrders)} hint={translateUiText("Kasada kapanis bekleyen adisyonlar", locale)} tone="success" />
      </section>

      {showSetupPrompt ? (
        <section className="rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-[0_10px_20px_rgba(251,191,36,0.12)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{translateUiText("Ilk Kurulum", locale)}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{translateUiText("Canli operasyon icin tamamlanmasi gereken adimlar var", locale)}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {translateUiText("Urun, masa, ekip ve ilk test siparisi tamamlanmadan sistem tam operasyon hazir sayilmaz. Eksik kalan adimlari bu merkezden bitir.", locale)}
              </p>
            </div>
            <div className="w-full rounded-[24px] border border-amber-200 bg-white/80 px-5 py-4 sm:w-auto">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{translateUiText("Kurulum Ilerlemesi", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                {completedSetupSteps}/{setupSteps.length}
              </p>
              <p className="mt-2 text-sm text-slate-600">{translateUiText("Temel operasyon adimi tamamlandi", locale)}</p>
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
                    {step.done ? translateUiText("Hazir", locale) : translateUiText("Eksik", locale)}
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
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ContentCard title={translateUiText("Anlik Siparis Akisi", locale)}>
          {recentOrders.length === 0 ? (
            <EmptyPanel title={translateUiText("Siparis akisi bos", locale)} description={translateUiText("Bu vardiyada izlenecek yeni siparis olustugunda burada gune ait son siparisler gorunur.", locale)} />
          ) : (
            <div className="space-y-3">
              {pagedRecentOrders.map((order) => (
                <div key={order.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order, locale)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
                      <p className="mt-2 text-sm text-slate-500">{formatClock(order.created_at, locale)} {translateUiText("olusturuldu", locale)}</p>
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
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {hasPreviousRecentOrdersPage ? (
                  <Link href={`/ops?ordersPage=${ordersPage - 1}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    Onceki
                  </Link>
                ) : (
                  <span className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Onceki</span>
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

        <div className="space-y-5">
        <ContentCard title={translateUiText("Masa Durumu", locale)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{translateUiText("Dolu", locale)}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-900">{metrics.occupiedTables}</p>
                <p className="mt-2 text-sm text-amber-700">{translateUiText("Aktif servis alan masalar", locale)}</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{translateUiText("Bos", locale)}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-900">{metrics.emptyTables}</p>
                <p className="mt-2 text-sm text-emerald-700">{translateUiText("Yeni oturum icin hazir masalar", locale)}</p>
              </div>
            </div>
            <Link href="/admin/tables" className="mt-4 inline-flex w-full rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:w-auto">
              {translateUiText("Masa operasyonunu ac", locale)}
            </Link>
          </ContentCard>

          <ContentCard title={translateUiText("Kritik Stok", locale)}>
            {lowStockProducts.length === 0 ? (
              <EmptyPanel title={translateUiText("Kritik stok yok", locale)} description={translateUiText("Esik altina dusen urun olmadigi icin bu vardiyada stok riski gorunmuyor.", locale)} />
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <div key={product.id} className="flex flex-col items-start justify-between gap-3 rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center">
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

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <ContentCard title={translateUiText("Operasyon Isaretleri", locale)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Servis Talepleri", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openServiceRequests}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Garson cagir, hesap iste ve benzeri talepler", locale)}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kritik Mutfak", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.criticalKitchenOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Esik ustu gecikmis siparis sayisi", locale)}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Bugunku Acik Siparis", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Operasyonda halen kapanmamis siparisler", locale)}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{translateUiText("Kasa Bekleyen", locale)}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.servedOrders}</p>
              <p className="mt-2 text-sm text-slate-500">{translateUiText("Tahsilat bekleyen servisler", locale)}</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title={translateUiText("Yonetim Gecisleri", locale)}>
          <div className="grid gap-3 sm:grid-cols-2">
            {canCashier ? (
              <Link href="/cashier/session" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Kasa Acilis / Kapanis", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/products" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Urun Yonetimi", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/reports" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Satis Raporlari", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/finance" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Gelir / Gider", locale)}
              </Link>
            ) : null}
            {canOwner ? (
              <Link href="/admin/settings" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Isletme Ayarlari", locale)}
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/orders" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white sm:text-left">
                {translateUiText("Siparis Girisi", locale)}
              </Link>
            ) : null}
          </div>
        </ContentCard>
      </section>
    </BackofficePage>
  );
}
