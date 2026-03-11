import Link from "next/link";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { BackofficePage, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { getMenu } from "@/lib/domains/orders";
import { getTableMap } from "@/lib/domains/tables";
import { translateUiText } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";

export default async function AdminOrdersPage() {
  await requireRole(["admin", "cashier", "waiter"], "/admin/orders");
  const locale = await getCurrentLocale();
  const businessSlug = await getActiveBusinessSlug();
  const [{ categories, products, modifierGroups, modifierOptions, usingDemoData: usingMenuDemo }, { tables, usingDemoData: usingTablesDemo }] = await Promise.all([
    getMenu(businessSlug),
    getTableMap(),
  ]);
  const availableProducts = products.filter((product) => product.is_available).length;

  return (
    <BackofficePage
      title={translateUiText("Siparis Girisi", locale)}
      description={translateUiText("Masa, gel-al ve paket servis siparislerini tek ekrandan ac.", locale)}
      sidebar={
        <SidebarPanel title={translateUiText("Hazirlik", locale)} description={translateUiText("Siparis girmeden once masa ve menu durumunu kontrol et.", locale)}>
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{translateUiText("Aktif Isletme", locale)}</p>
            <p className="mt-4 break-all text-2xl font-semibold tracking-tight sm:text-3xl">{businessSlug}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">{translateUiText("Masa", locale)}</p>
                <p className="mt-2 text-2xl font-semibold">{tables.length}</p>
              </div>
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
              {translateUiText("Kasa Ekranina Git", locale)}
            </Link>
          </div>
        </SidebarPanel>
      }
      actions={
        <Link href="/ops" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          {translateUiText("Panele Don", locale)}
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label={translateUiText("Kategori", locale)} value={String(categories.length)} hint={translateUiText("Menu kategorileri", locale)} tone="accent" />
        <SummaryCard label={translateUiText("Aktif Urun", locale)} value={String(availableProducts)} hint={translateUiText("Siparise acik urunler", locale)} />
        <SummaryCard label={translateUiText("Masa", locale)} value={String(tables.length)} hint={translateUiText("Siparis acilabilecek masa sayisi", locale)} tone="success" />
      </section>

      <WorkflowGuide
        title={translateUiText("Siparis Girisi 3 Adim", locale)}
        description={translateUiText("Sistemi ilk kez goren biri de siparisi dogru kanal uzerinden kolayca acabilsin.", locale)}
        steps={[
          { title: translateUiText("Siparis kanalini sec", locale), description: translateUiText("Masa, gel-al veya paket servis secenegiyle siparisin hangi akisa ait oldugunu belirle.", locale) },
          { title: translateUiText("Urunleri sepete ekle", locale), description: translateUiText("Kategori icinden urun sec, gerekirse secenekleri tamamla ve sagdaki sepete ekle.", locale) },
          { title: translateUiText("Siparisi ac", locale), description: translateUiText("Toplam ve sepet kalemlerini kontrol edip Siparisi Ac butonuyla mutfak veya servise gonder.", locale) },
        ]}
      />

      {usingMenuDemo || usingTablesDemo ? (
          <p className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {translateUiText("Demo verisi ile siparis girisi onizleniyor.", locale)}
          </p>
        ) : null}

        <AdminOrderEntry
          businessSlug={businessSlug}
          categories={categories}
          products={products}
          modifierGroups={modifierGroups}
          modifierOptions={modifierOptions}
          tables={tables}
        />
    </BackofficePage>
  );
}
