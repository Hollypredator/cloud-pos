import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { BackofficePage, ContentCard, EmptyPanel, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { getCurrentUserWithRole } from "@/lib/auth";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { getOpsPageSnapshot } from "@/lib/data";

function statusTone(status: string) {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "preparing") return "bg-sky-100 text-sky-800";
  if (status === "served") return "bg-emerald-100 text-emerald-800";
  if (status === "paid") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "preparing") return "Hazirlaniyor";
  if (status === "served") return "Servise Hazir";
  if (status === "paid") return "Kapandi";
  return status;
}

function orderSourceLabel(order: {
  channel?: string;
  table_number?: number;
  customer_name?: string | null;
}) {
  if (order.channel === "delivery") {
    return order.customer_name ? `Paket / ${order.customer_name}` : "Paket servis";
  }
  if (order.channel === "pickup") {
    return order.customer_name ? `Gel-al / ${order.customer_name}` : "Gel-al";
  }
  return `Masa ${order.table_number ?? "-"}`;
}

function formatCurrency(value: number) {
  return `${value.toFixed(2)} TL`;
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function checklistTone(done: boolean) {
  return done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800";
}

export default async function OpsPage() {
  const activeBusinessSlug = await getActiveBusinessSlug();
  const [opsSnapshot, auth] = await Promise.all([
    getOpsPageSnapshot(),
    getCurrentUserWithRole(),
  ]);
  const {
    dashboard: { metrics, recentOrders, lowStockProducts, usingDemoData },
    ops,
    setup,
  } = opsSnapshot;

  if (!auth.usingDemoData && !auth.user) {
    redirect("/login");
  }

  const role = auth.role;
  const allowAll = auth.usingDemoData;
  const isManagement = role === "owner" || role === "admin";
  const canAdmin = allowAll || isManagement;
  const canOwner = allowAll || role === "owner";
  const canKitchen = allowAll || isManagement || role === "kitchen";
  const canCashier = allowAll || isManagement || role === "cashier";
  const canWaiterOps = allowAll || isManagement || role === "waiter" || role === "cashier";
  const roleLabel = allowAll ? "Demo" : role ?? "Guest";
  const showSetupPrompt =
    canAdmin && (setup.counts.businesses === 0 || setup.counts.products === 0 || setup.counts.tables === 0 || setup.counts.staff < 4);
  const setupSteps = [
    {
      label: "Isletme bilgileri",
      description: "Marka, telefon, adres ve demo modu ayarlari",
      done: setup.counts.businesses > 0,
      href: "/admin/onboarding",
      cta: "Kurulum merkezine git",
    },
    {
      label: "Urun katalugu",
      description: "Kategori, urun ve modifier kurulumunu tamamla",
      done: setup.counts.products > 0,
      href: "/admin/products",
      cta: "Urunleri ac",
    },
    {
      label: "Salon ve masalar",
      description: "Masa isimleri, QR ve aktif salon yapisi",
      done: setup.counts.tables > 0,
      href: "/admin/tables",
      cta: "Masalari ac",
    },
    {
      label: "Ekip ve roller",
      description: "Kasiyer, garson ve mutfak hesaplarini hazirla",
      done: setup.counts.staff >= 4,
      href: "/admin/roles",
      cta: "Personeli ac",
      ownerOnly: true,
    },
    {
      label: "Ilk siparis testi",
      description: "Manuel siparis, mutfak, kasa ve tahsilati uctan uca dene",
      done: metrics.openOrders > 0 || metrics.todayRevenue > 0,
      href: "/admin/orders",
      cta: "Siparis gir",
    },
  ];
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;

  const priorityWarnings = [
    {
      label: "Mutfak Gecikmesi",
      value: String(ops.delayedKitchenOrders),
      hint: `${ops.criticalKitchenOrders} kritik siparis`,
      tone: ops.criticalKitchenOrders > 0 ? ("danger" as const) : ("accent" as const),
    },
    {
      label: "Masa Talepleri",
      value: String(ops.openServiceRequests),
      hint: "Acik garson ve hesap talepleri",
      tone: ops.openServiceRequests > 0 ? ("accent" as const) : ("neutral" as const),
    },
    {
      label: "Kasada Bekleyen",
      value: String(ops.servedOrders),
      hint: "Tahsilat icin hazir siparis",
      tone: ops.servedOrders > 0 ? ("success" as const) : ("neutral" as const),
    },
  ];

  return (
    <BackofficePage
      title="Operasyon Merkezi"
      description="Canli siparis, masa, mutfak ve kasayi tek ekrandan izle."
      actions={
        <>
          <span className="inline-flex rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white sm:px-4 sm:text-xs">
            Rol {roleLabel}
          </span>
          {usingDemoData ? (
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 sm:px-4 sm:text-xs">
              Demo veri acik
            </span>
          ) : null}
          <LiveOpsBridge tables={["orders", "tables", "products"]} />
        </>
      }
      sidebar={
        <div className="space-y-5">
          <WorkflowGuide
            title="Bugun Nasil Kullanilir?"
            description="Sistemi ilk kez kullanan biri icin gunluk operasyon sirasi."
            steps={[
              { title: "Masalari ve urunleri kontrol et", description: "Servise baslamadan once masa, urun ve kritik stok durumunu buradan hizlica kontrol et." },
              { title: "Siparis akisina bak", description: "Bekleyen siparis varsa mutfaga, kasada bekleyen varsa tahsilata yonel." },
              { title: "Gun sonunda rapora don", description: "Vardiya sonunda kasa ve rapor ekranlarindan tahsilat ve net sonucu kontrol et." },
            ]}
          />
          <SidebarPanel title="Anlik Durum" description="Bugunku operasyon nabzi ve risk odaklari.">
            <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Gunluk Ciro</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{formatCurrency(metrics.todayRevenue)}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Dolu Masa</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.occupiedTables}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Bos Masa</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics.emptyTables}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {priorityWarnings
                .filter((item) => (item.label === "Mutfak Gecikmesi" ? canKitchen || canAdmin : item.label === "Kasada Bekleyen" ? canCashier : canWaiterOps))
                .map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                        <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
                      </div>
                      <span
                        className={
                          item.tone === "danger"
                            ? "rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700"
                            : item.tone === "accent"
                              ? "rounded-2xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700"
                              : item.tone === "success"
                                ? "rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"
                                : "rounded-2xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        }
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </SidebarPanel>

          <SidebarPanel title="Hizli Aksiyonlar" description="En sik kullanilan operasyon gecisleri.">
            <div className="grid gap-3">
              <Link href={`/${activeBusinessSlug}/qr/table-1`} className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                QR Siparis Ekrani
              </Link>
              {canKitchen ? (
                <Link href="/kitchen" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Mutfak Board
                </Link>
              ) : null}
              {canCashier ? (
                <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Kasa Ekrani
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/delivery" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Teslimat Board
                </Link>
              ) : null}
              {canWaiterOps ? (
                <Link href="/service-requests" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Masa Talepleri
                </Link>
              ) : null}
              {canAdmin ? (
                <Link href="/admin/orders" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Manuel Siparis Gir
                </Link>
              ) : null}
            </div>
          </SidebarPanel>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Acik Siparis" value={String(metrics.openOrders)} hint="Pending, hazirlaniyor ve kasada bekleyen toplam siparis" tone="accent" />
        <SummaryCard label="Bekleyen" value={String(metrics.pending)} hint="Mutfaga yeni dusen isler" tone="danger" />
        <SummaryCard label="Hazirlaniyor" value={String(metrics.preparing)} hint="Aktif mutfak uretimi" tone="accent" />
        <SummaryCard label="Servise Hazir" value={String(ops.servedOrders)} hint="Kasada kapanis bekleyen adisyonlar" tone="success" />
      </section>

      {showSetupPrompt ? (
        <section className="rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-[0_10px_20px_rgba(251,191,36,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Ilk Kurulum</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Canli operasyon icin tamamlanmasi gereken adimlar var</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Urun, masa, ekip ve ilk test siparisi tamamlanmadan sistem tam operasyon hazir sayilmaz. Eksik kalan adimlari bu merkezden bitir.
              </p>
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-white/80 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Kurulum Ilerlemesi</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                {completedSetupSteps}/{setupSteps.length}
              </p>
              <p className="mt-2 text-sm text-slate-600">Temel operasyon adimi tamamlandi</p>
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
                    {step.done ? "Hazir" : "Eksik"}
                  </span>
                </div>
                <div className="mt-4">
              <Link href={step.href} className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                {step.cta}
              </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ContentCard title="Anlik Siparis Akisi">
          {recentOrders.length === 0 ? (
            <EmptyPanel title="Siparis akisi bos" description="Bu vardiyada izlenecek yeni siparis olustugunda burada gune ait son siparisler gorunur." />
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{orderSourceLabel(order)}</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Siparis #{order.id.slice(0, 8)}</h3>
                      <p className="mt-2 text-sm text-slate-500">{formatClock(order.created_at)} olusturuldu</p>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                      <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase ${statusTone(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {formatCurrency(Number(order.final_price ?? order.total_price))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <div className="space-y-5">
          <ContentCard title="Masa Durumu">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Dolu</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-900">{metrics.occupiedTables}</p>
                <p className="mt-2 text-sm text-amber-700">Aktif servis alan masalar</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Bos</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-900">{metrics.emptyTables}</p>
                <p className="mt-2 text-sm text-emerald-700">Yeni oturum icin hazir masalar</p>
              </div>
            </div>
            <Link href="/admin/tables" className="mt-4 inline-flex rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              Masa operasyonunu ac
            </Link>
          </ContentCard>

          <ContentCard title="Kritik Stok">
            {lowStockProducts.length === 0 ? (
              <EmptyPanel title="Kritik stok yok" description="Esik altina dusen urun olmadigi icin bu vardiyada stok riski gorunmuyor." />
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Kritik stok seviyesinde</p>
                    </div>
                    <span className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-rose-700">{product.stock_count}</span>
                  </div>
                ))}
                <Link href="/admin/stock" className="inline-flex rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                  Stok ekranina git
                </Link>
              </div>
            )}
          </ContentCard>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <ContentCard title="Operasyon Isaretleri">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Servis Talepleri</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openServiceRequests}</p>
              <p className="mt-2 text-sm text-slate-500">Garson cagir, hesap iste ve benzeri talepler</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kritik Mutfak</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.criticalKitchenOrders}</p>
              <p className="mt-2 text-sm text-slate-500">Esik ustu gecikmis siparis sayisi</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Bugunku Acik Siparis</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.openOrders}</p>
              <p className="mt-2 text-sm text-slate-500">Operasyonda halen kapanmamis siparisler</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kasa Bekleyen</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{ops.servedOrders}</p>
              <p className="mt-2 text-sm text-slate-500">Tahsilat bekleyen servisler</p>
            </div>
          </div>
        </ContentCard>

        <ContentCard title="Yonetim Gecisleri">
          <div className="grid gap-3 sm:grid-cols-2">
            {canCashier ? (
              <Link href="/cashier/session" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Kasa Acilis / Kapanis
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/products" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Urun Yonetimi
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/reports" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Satis Raporlari
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/finance" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Gelir / Gider
              </Link>
            ) : null}
            {canOwner ? (
              <Link href="/admin/settings" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Isletme Ayarlari
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/orders" className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white">
                Siparis Girisi
              </Link>
            ) : null}
          </div>
        </ContentCard>
      </section>
    </BackofficePage>
  );
}
