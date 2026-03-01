import { notFound } from "next/navigation";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/business";
import { getMenu, getTableByQr } from "@/lib/data";
import { QrOrderingClient } from "@/components/qr-ordering-client";

export default async function QrPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const businessSlug = DEFAULT_BUSINESS_SLUG;
  const table = await getTableByQr(identifier, businessSlug);
  if (!table) {
    notFound();
  }

  const { categories, products, modifierGroups, modifierOptions, usingDemoData } = await getMenu(businessSlug);

  return (
    <div className="min-h-screen bg-slate-100">
      {usingDemoData ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo veri modu aktif. Supabase env değişkenlerini ekleyince canlı veriye geçer.
        </div>
      ) : null}
      <QrOrderingClient
        businessSlug={businessSlug}
        qrCodeIdentifier={identifier}
        tableId={table.id}
        categories={categories}
        products={products}
        modifierGroups={modifierGroups}
        modifierOptions={modifierOptions}
      />
    </div>
  );
}
