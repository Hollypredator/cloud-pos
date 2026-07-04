import Link from "next/link";
import { headers } from "next/headers";
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
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const isMobileUA = /mobile|android|iphone|ipad|phone/i.test(userAgent);

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
    ? translateUiText("Gel-al siparişlerini tek ekrandan yönet.", locale)
    : translateUiText("Masa, gel-al ve paket servis siparişlerini tek ekrandan ac.", locale);
  const sidebarDescription = isSelfServiceCoffee
    ? translateUiText("Sipariş öncesi menü ve Ürün durumunu kontrol et.", locale)
    : translateUiText("Sipariş girmeden once masa ve menü durumunu kontrol et.", locale);

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
      layoutMode={isMobileUA ? "mobile_stack" : entryLayoutMode}
      initialView={operatingCapabilities.hide_table_ui ? "composer" : preselectedTableId ? "composer" : "table_picker"}
      operatingProfile={operatingProfile}
      operatingCapabilities={operatingCapabilities}
      mobilePresentation={isMobileUA ? "stack" : "default"}
    />
  );

  if (isSelfServiceCoffee) {
    return <main className="coffee-pos-mode h-screen w-full overflow-hidden">{orderEntry}</main>;
  }

  if (isMobileUA) {
    return <main className="h-screen w-screen overflow-hidden bg-slate-50">{orderEntry}</main>;
  }

  return (
    <BackofficePage
      title={translateUiText("Sipariş Girişi", locale)}
      description={pageDescription}
      minimal={isTabletMode}
      sidebar={
        isTabletMode ? undefined : (
          <SidebarPanel
            title={translateUiText("Hazırlık", locale)}
            description={sidebarDescription}
          >
            <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{translateUiText("Aktif İşletme", locale)}</p>
              <p className="mt-4 break-all text-2xl font-semibold tracking-tight sm:text-3xl">{businessSlug}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {!operatingCapabilities.hide_table_ui ? (
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Masa", locale)}</p>
                    <p className="mt-2 text-2xl font-semibold">{tables.length}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Ürün", locale)}</p>
                  <p className="mt-2 text-2xl font-semibold">{availableProducts}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <Link href="/ops" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                {translateUiText("Operasyon Merkezine Dön", locale)}
              </Link>
              <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
                {isSelfServiceCoffee ? translateUiText("Sipariş Yönetimine Git", locale) : translateUiText("Kasa Ekranına Git", locale)}
              </Link>
            </div>
          </SidebarPanel>
        )
      }
      actions={
        isTabletMode ? undefined : (
          <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
            {translateUiText("Panele Dön", locale)}
          </Link>
        )
      }
    >
      {!isTabletMode ? (
        <>
          <section className="app-mobile-hide shrink-0 grid gap-4 xl:grid-cols-3">
            <SummaryCard label={translateUiText("Kategori", locale)} value={String(categories.length)} hint={translateUiText("Menu kategorileri", locale)} tone="accent" />
            <SummaryCard label={translateUiText("Aktif Ürün", locale)} value={String(availableProducts)} hint={translateUiText("Siparişe açık Ürünler", locale)} />
            {!operatingCapabilities.hide_table_ui ? (
              <SummaryCard label={translateUiText("Masa", locale)} value={String(tables.length)} hint={translateUiText("Sipariş açılabilecek masa sayısı", locale)} tone="success" />
            ) : null}
          </section>

          <section className="app-mobile-only shrink-0">
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {translateUiText("Mobil sipariş modunda ekran doğrudan Ürün seçimi ve sepete odaklanir.", locale)}
            </p>
          </section>

          {usingMenuDemo || usingTablesDemo ? (
            <p className="shrink-0 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {translateUiText("Demo verisi ile sipariş girisi önizleniyor.", locale)}
            </p>
          ) : null}

          {isSelfServiceCoffee ? (
            <p className="shrink-0 rounded-[24px] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900">
              Self-service coffee profili aktif: sipariş akışı pickup ve barkod odakli calisir.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        {orderEntry}
      </div>
    </BackofficePage>
  );
}
