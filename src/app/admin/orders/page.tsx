import Link from "next/link";
import { AdminOrderEntry } from "@/components/admin-order-entry";
import { BackofficePage, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getActiveBusinessSlug } from "@/lib/business-server";
import { getMenu, getTableMap } from "@/lib/data";

export default async function AdminOrdersPage() {
  await requireRole(["admin", "cashier", "waiter"], "/admin/orders");
  const businessSlug = await getActiveBusinessSlug();
  const [{ categories, products, modifierGroups, modifierOptions, usingDemoData: usingMenuDemo }, { tables, usingDemoData: usingTablesDemo }] = await Promise.all([
    getMenu(businessSlug),
    getTableMap(),
  ]);
  const availableProducts = products.filter((product) => product.is_available).length;

  return (
    <BackofficePage
      title="Siparis Girisi"
      description="Masa, gel-al ve paket servis siparislerini tek ekrandan ac."
      sidebar={
        <SidebarPanel title="Hazirlik" description="Siparis girmeden once masa ve menu durumunu kontrol et.">
          <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Aktif Isletme</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{businessSlug}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Masa</p>
                <p className="mt-2 text-2xl font-semibold">{tables.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Urun</p>
                <p className="mt-2 text-2xl font-semibold">{availableProducts}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <Link href="/ops" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              Operasyon Merkezine Don
            </Link>
            <Link href="/cashier" className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              Kasa Ekranina Git
            </Link>
          </div>
        </SidebarPanel>
      }
      actions={
        <Link href="/ops" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
          Panele Don
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Kategori" value={String(categories.length)} hint="Menu kategorileri" tone="accent" />
        <SummaryCard label="Aktif Urun" value={String(availableProducts)} hint="Siparise acik urunler" />
        <SummaryCard label="Masa" value={String(tables.length)} hint="Siparis acilabilecek masa sayisi" tone="success" />
      </section>

      <WorkflowGuide
        title="Siparis Girisi 3 Adim"
        description="Sistemi ilk kez goren biri de siparisi dogru kanal uzerinden kolayca acabilsin."
        steps={[
          { title: "Siparis kanalini sec", description: "Masa, gel-al veya paket servis secenegiyle siparisin hangi akisa ait oldugunu belirle." },
          { title: "Urunleri sepete ekle", description: "Kategori icinden urun sec, gerekirse secenekleri tamamla ve sagdaki sepete ekle." },
          { title: "Siparisi ac", description: "Toplam ve sepet kalemlerini kontrol edip Siparisi Ac butonuyla mutfak veya servise gonder." },
        ]}
      />

      {usingMenuDemo || usingTablesDemo ? (
          <p className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Demo verisi ile siparis girisi onizleniyor.
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
