import { notFound } from "next/navigation";
import { getMenu, getTableByQr } from "@/lib/data";
import { normalizeBusinessSlug } from "@/lib/business";
import { QrOrderingClient } from "@/components/qr-ordering-client";

export default async function BusinessQrPage({
  params,
}: {
  params: Promise<{ slug: string; identifier: string }>;
}) {
  const { slug, identifier } = await params;
  const businessSlug = normalizeBusinessSlug(slug);
  const table = await getTableByQr(identifier, businessSlug);
  if (!table) {
    notFound();
  }

  const { categories, products, modifierGroups, modifierOptions, usingDemoData } = await getMenu(businessSlug);

  return (
    <div className="min-h-screen bg-slate-100">
      {usingDemoData ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo veri modu aktif. Supabase env degiskenlerini ekleyince canli veriye gecer.
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
