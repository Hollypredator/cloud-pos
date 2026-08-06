import type { Metadata } from "next";
import { TakeawayAppLauncher } from "@/components/takeaway-app-launcher";

/**
 * Takeaway ürün vitrini — firma görüşmelerinde gösterilen demo.
 *
 * Daha önce `/` ve `/ops` rotalarını eziyordu; sitenin kök adresi pazarlama
 * sayfası yerine bu demoyu gösteriyordu. Kendi rotasına taşındı: vitrin duruyor,
 * ana sayfa ve operasyon panosu geri geldi.
 *
 * İçerideki rakamlar hâlâ sabit (takeaway-app-launcher.tsx). Gerçek veriye
 * bağlanması D12 görevinde.
 */
export const metadata: Metadata = {
  // Layout şablonu " | Cloud POS" ekini kendisi ekliyor, burada tekrarlanmaz.
  title: "Takeaway Demo",
  description: "Takeaway kasa ve yönetim akışı tanıtım ekranı.",
  // Demo ekranı arama sonuçlarına düşmemeli — gerçek ürün sayfalarıyla yarışır.
  robots: { index: false, follow: false },
};

export default function TakeawayDemoPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <TakeawayAppLauncher
        businessName="Holy Cup Coffee"
        cashierName="Kasa 1"
        branchName="Takeaway Merkez Şube"
      />
    </main>
  );
}
