import { CustomerDisplayClient } from "@/components/customer-display-client";
import { getAppShellContext, type AppShellContext } from "@/lib/server/app-context";

export const dynamic = "force-dynamic";

/**
 * Müşteri ekranı — kasanın karşısına dönük ikinci ekran.
 *
 * İşletme adı aktif oturum bağlamından gelir. Daha önce sabit "Holy Cup Coffee"
 * yazıyordu ve hangi işletme olursa olsun o görünüyordu.
 *
 * Örnek sepet yalnızca ?demo=1 ile açılır. Üretimde kasa oturumu yokken ekran
 * boş bekleme durumunu gösterir: müşteriye kendi siparişi olmayan bir liste
 * göstermek, ödemesinin karıştığını düşündürür (tasarım kararı 3=A).
 */
export default async function CustomerDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const [{ demo }, shell] = await Promise.all([searchParams, getAppShellContext()]);

  const businessName =
    shell.businesses.find((item: AppShellContext["businesses"][number]) => item.slug === shell.activeBusinessSlug)
      ?.name ?? undefined;

  return <CustomerDisplayClient businessName={businessName} showSampleCart={demo === "1"} />;
}
