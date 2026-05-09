import { notFound } from "next/navigation";
import { getBusinessContextBySlug, getMenu, getTableByQr } from "@/lib/domains/orders";
import { normalizeBusinessSlug } from "@/lib/business";
import { QrOrderingClient } from "@/components/qr-ordering-client";
import { createQrAccessToken } from "@/lib/qr-access";
import { isQrConfirmationEnabledForBusinessSlug } from "@/lib/qr-confirmation";
import { resolveOperatingProfile } from "@/lib/operating-profile";

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

  const [{ categories, products, modifierGroups, modifierOptions, usingDemoData }, businessContext] = await Promise.all([
    getMenu(businessSlug),
    getBusinessContextBySlug(businessSlug),
  ]);
  const operatingProfile = resolveOperatingProfile(businessContext.business?.business_type);
  const qrConfirmationEnabled = isQrConfirmationEnabledForBusinessSlug(businessSlug);
  const qrAccessToken = createQrAccessToken({
    qrCodeIdentifier: identifier,
    businessSlug,
  });

  return (
    <div className={operatingProfile === "coffee_self_service"
      ? "min-h-screen bg-[radial-gradient(circle_at_top,#3a1d0f_0%,#1f130d_48%,#120d09_100%)]"
      : "min-h-screen bg-[radial-gradient(circle_at_top,#1f2c56_0%,#0b1224_52%,#090f1f_100%)]"}
    >
      {usingDemoData ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Demo veri modu aktif. Supabase env degiskenlerini ekleyince canli veriye gecer.
        </div>
      ) : null}
      <QrOrderingClient
        categories={categories}
        products={products}
        modifierGroups={modifierGroups}
        modifierOptions={modifierOptions}
        businessSlug={businessSlug}
        qrCodeIdentifier={identifier}
        qrAccessToken={qrAccessToken ?? undefined}
        qrConfirmationEnabled={qrConfirmationEnabled}
        operatingProfile={operatingProfile}
      />
    </div>
  );
}
