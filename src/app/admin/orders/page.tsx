import Link from "next/link";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { BackofficePage, SidebarPanel, SummaryCard } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getMenu } from "@/lib/domains/orders";
import { getTableMap } from "@/lib/domains/tables";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import { resolveOperatingProfile, getOperatingProfileCapabilities } from "@/lib/operating-profile";
import { getBusinessScopeContext } from "@/lib/server/app-context";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; mode?: string }>;
}) {
  await requireRole(["owner", "admin", "cashier", "waiter"], "/admin/orders");
  const locale = await getCurrentLocale();
  const { table: preselectedTableId, mode } = await searchParams;
  const isTabletMode = mode === "tablet";
  const businessScope = await getBusinessScopeContext();
  const businessSlug = businessScope.activeSlug;
  const businessType = businessScope.activeBusinessType ?? "restaurant_cafe";
  const operatingProfile = resolveOperatingProfile(businessType);
  const operatingCapabilities = getOperatingProfileCapabilities(operatingProfile);
  const isSelfServiceCoffee = operatingProfile === "coffee_self_service";
  const entryLayoutMode = isSelfServiceCoffee ? "auto" : "tablet_3pane";
  const pageDescription = isSelfServiceCoffee
    ? translateUiText("Gel-al siparislerini tek ekrandan yonet.", locale)
    : translateUiText("Masa, gel-al ve paket servis siparislerini tek ekrandan ac.", locale);
  const sidebarDescription = isSelfServiceCoffee
    ? translateUiText("Siparis oncesi menu ve urun durumunu kontrol et.", locale)
    : translateUiText("Siparis girmeden once masa ve menu durumunu kontrol et.", locale);

  const [
    { categories, products, modifierGroups, modifierOptions, usingDemoData: usingMenuDemo },
    { tables, usingDemoData: usingTablesDemo },
  ] = await Promise.all([getMenu(businessSlug), getTableMap()]);

  const availableProducts = products.filter((product) => product.is_available).length;

  const orderEntry = (
    <AdminOrderEntry
      businessSlug={businessSlug}
      categories={categories}
      products={products}
      modifierGroups={modifierGroups}
      modifierOptions={modifierOptions}
      tables={tables}
      initialTableId={preselectedTableId}
      entryMode={isSelfServiceCoffee ? "classic" : "table_first"}
      layoutMode={entryLayoutMode}
      initialView={operatingCapabilities.hide_table_ui ? "composer" : preselectedTableId ? "composer" : "table_picker"}
      operatingProfile={operatingProfile}
      operatingCapabilities={operatingCapabilities}
    />
  );

  if (isSelfServiceCoffee) {
    return <main className="coffee-pos-mode h-screen w-screen overflow-hidden bg-slate-950">{orderEntry}</main>;
  }

  return (
    <BackofficePage
      title={translateUiText("Siparis Girisi", locale)}
      description={pageDescription}
      minimal={isTabletMode}
      sidebar={
        isTabletMode ? undefined : (
          <SidebarPanel
            title={translateUiText("Hazirlik", locale)}
            description={sidebarDescription}
          >
            <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{translateUiText("Aktif Isletme", locale)}</p>
              <p className="mt-4 break-all text-2xl font-semibold tracking-tight sm:text-3xl">{businessSlug}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {!operatingCapabilities.hide_table_ui ? (
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Masa", locale)}</p>
                    <p className="mt-2 text-2xl font-semibold">{tables.length}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Urun", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{availableProducts}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <Link href="/ops" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                {translateUiText("Operasyon Merkezine Don", locale)}
              </Link>
              <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                {isSelfServiceCoffee ? translateUiText("Siparis Yonetimine Git", locale) : translateUiText("Kasa Ekranina Git", locale)}
              </Link>
            </div>
          </SidebarPanel>
        )
      }
      actions={
        isTabletMode ? undefined : (
          <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Panele Don", locale)}
          </Link>
        )
      }
    >
      {!isTabletMode ? (
        <>
          <section className="app-mobile-hide grid gap-4 xl:grid-cols-3">
            <SummaryCard label={translateUiText("Kategori", locale)} value={String(categories.length)} hint={translateUiText("Menu kategorileri", locale)} tone="accent" />
            <SummaryCard label={translateUiText("Aktif Urun", locale)} value={String(availableProducts)} hint={translateUiText("Siparise acik urunler", locale)} />
            {!operatingCapabilities.hide_table_ui ? (
              <SummaryCard label={translateUiText("Masa", locale)} value={String(tables.length)} hint={translateUiText("Siparis acilabilecek masa sayisi", locale)} tone="success" />
            ) : null}
          </section>

          <section className="app-mobile-only">
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {translateUiText("Mobil siparis modunda ekran dogrudan urun secimi ve sepete odaklanir.", locale)}
            </p>
          </section>

          {usingMenuDemo || usingTablesDemo ? (
            <p className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {translateUiText("Demo verisi ile siparis girisi onizleniyor.", locale)}
            </p>
          ) : null}

          {isSelfServiceCoffee ? (
            <p className="rounded-[24px] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900">
              Self-service coffee profili aktif: siparis akisi pickup ve barkod odakli calisir.
            </p>
          ) : null}
        </>
      ) : null}

      {orderEntry}
    </BackofficePage>
  );
}
