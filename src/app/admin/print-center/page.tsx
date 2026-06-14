import Link from "next/link";
import { BackofficePage, ContentCard, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getApplicationSettings } from "@/lib/data";
import { getCurrentCashSession } from "@/lib/domains/finance";
import { listOrders } from "@/lib/domains/orders";

function orderRef(order: { id: string; check_number?: string | null }) {
  return order.check_number?.trim() ? order.check_number : order.id.slice(0, 8);
}

export default async function PrintCenterPage() {
  await requireRole(["admin", "cashier"], "/admin/print-center");

  const [{ settings }, { orders }, { orders: kitchenOrders }, { session }] = await Promise.all([
    getApplicationSettings(),
    listOrders(["ready", "served", "paid", "partially_paid", "preparing", "pending"], { includeItems: false, limit: 3, ascending: false }),
    listOrders(["pending", "preparing", "ready", "served"], { includeItems: false, limit: 1, ascending: false }),
    getCurrentCashSession(),
  ]);

  const latestOrder = orders[0] ?? null;
  const latestKitchenOrder = kitchenOrders[0] ?? null;

  return (
    <BackofficePage
      title="Yazdırma Merkezi"
      description="Yazıcı olmadan adisyon, fis ve QR çıktı akışını onizle ve test et"
      actions={
        <Link href="/admin/settings" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Ayarlara Don
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Yazdırma Modu" value={settings.appPrintingEnabled ? "Uygulama" : "Tarayici"} hint="Mevcut yazdırma davranisi" tone="accent" />
        <SummaryCard label="Test Yontemi" value="PDF" hint="Yazicisiz doğrulama için uygun" tone="success" />
        <SummaryCard label="Son Adisyon" value={latestOrder ? `#${orderRef(latestOrder)}` : "Yok"} hint={latestOrder ? "Teste hazır" : "Örnek sipariş oluştur"} />
      </section>

      <WorkflowGuide
        title="Yazicisiz Test"
        description="Gerçek yazıcı olmasa da print pipeline'i dogrulayabilirsin."
        steps={[
          { title: "Düzeni seç", description: "A4 adisyon veya 80mm fis görünumunu ac." },
          { title: "Tarayıcıdan yazdır", description: "Yazdır / PDF ile çıktı diyalogunu ac ve görünumu kontrol et." },
          { title: "PDF kaydet", description: "Sistem yazicisi gelmeden önce şablon, bosluk ve okunabilirliği PDF ile doğrula." },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ContentCard title="Adisyon ve Fis Testleri">
          <div className="space-y-3">
            {latestOrder ? (
              <>
                <Link href={`/receipt/${latestOrder.id}?layout=a4`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu A4 görünumde ac
                </Link>
                <Link href={`/receipt/${latestOrder.id}?layout=thermal`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu 80mm fis görünumde ac
                </Link>
                <Link href={`/receipt/${latestOrder.id}?layout=thermal58`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu 58mm dar fis görünumde ac
                </Link>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                Test için henüz sipariş yok. Önce bir sipariş olusturup sonra bu ekrandan fişi ac.
              </p>
            )}
            <Link href="/admin/print-center/test-slip" className="block rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-4 text-sm font-semibold text-white">
              Örnek test fisi ac
            </Link>
          </div>
        </ContentCard>

        <ContentCard title="QR ve Masa Karti">
          <div className="space-y-3">
            <Link href="/admin/tables" className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
              Masa QR popup ve yazdırma akışını test et
            </Link>
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              Bu merkez fis ve adisyon sablonunu dogrular. Masa QR kartlari için `Bölge ve Masa` ekranindaki `Masa Yönet` popup&apos;ini kullan.
            </p>
          </div>
        </ContentCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ContentCard title="Mutfak Sipariş Fisi">
          <div className="space-y-3">
            {latestKitchenOrder ? (
              <>
                <Link href={`/admin/print-center/kitchen/${latestKitchenOrder.id}?layout=thermal`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son mutfak siparişini 80mm fis olarak ac
                </Link>
                <Link href={`/admin/print-center/kitchen/${latestKitchenOrder.id}?layout=thermal58`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son mutfak siparişini 58mm dar fis olarak ac
                </Link>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                Mutfak kuyrugunda sipariş yok. Test için bir sipariş oluştur ve mutfaga dusur.
              </p>
            )}
          </div>
        </ContentCard>

        <ContentCard title="Kasa Kapanis Ciktisi">
          <div className="space-y-3">
            <Link href="/admin/print-center/session-report?layout=a4" className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
              Kapanis raporunu A4 olarak ac
            </Link>
            <Link href="/admin/print-center/session-report?layout=thermal" className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
              Kapanis raporunu 80mm fis olarak ac
            </Link>
            <Link href="/admin/print-center/session-report?layout=thermal58" className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
              Kapanis raporunu 58mm dar fis olarak ac
            </Link>
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              {session ? "Açık oturumdaki nakit ve satış özeti bu çıktıya yansir." : "Açık oturum yoksa bugunun satış özeti kullanılır."}
            </p>
          </div>
        </ContentCard>
      </div>
    </BackofficePage>
  );
}
