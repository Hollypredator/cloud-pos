import Link from "next/link";
import { BackofficePage, ContentCard, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getApplicationSettings } from "@/lib/data";
import { getCurrentCashSession } from "@/lib/domains/finance";
import { listOrders } from "@/lib/domains/orders";

export default async function PrintCenterPage() {
  await requireRole(["admin", "cashier"], "/admin/print-center");

  const [{ settings }, { orders }, { orders: kitchenOrders }, { session }] = await Promise.all([
    getApplicationSettings(),
    listOrders(["served", "paid", "preparing", "pending"], { includeItems: false, limit: 3, ascending: false }),
    listOrders(["pending", "preparing", "served"], { includeItems: false, limit: 1, ascending: false }),
    getCurrentCashSession(),
  ]);

  const latestOrder = orders[0] ?? null;
  const latestKitchenOrder = kitchenOrders[0] ?? null;

  return (
    <BackofficePage
      title="Yazdirma Merkezi"
      description="Yazici olmadan adisyon, fis ve QR cikti akisini onizle ve test et"
      actions={
        <Link href="/admin/settings" className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 sm:w-auto">
          Ayarlara Don
        </Link>
      }
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Yazdirma Modu" value={settings.appPrintingEnabled ? "Uygulama" : "Tarayici"} hint="Mevcut yazdirma davranisi" tone="accent" />
        <SummaryCard label="Test Yontemi" value="PDF" hint="Yazicisiz dogrulama icin uygun" tone="success" />
        <SummaryCard label="Son Adisyon" value={latestOrder ? `#${latestOrder.id.slice(0, 8)}` : "Yok"} hint={latestOrder ? "Teste hazir" : "Ornek siparis olustur"} />
      </section>

      <WorkflowGuide
        title="Yazicisiz Test"
        description="Gercek yazici olmasa da print pipeline'i dogrulayabilirsin."
        steps={[
          { title: "Duzeni sec", description: "A4 adisyon veya 80mm fis gorunumunu ac." },
          { title: "Tarayicidan yazdir", description: "Yazdir / PDF ile cikti diyalogunu ac ve gorunumu kontrol et." },
          { title: "PDF kaydet", description: "Sistem yazicisi gelmeden once sablon, bosluk ve okunabilirligi PDF ile dogrula." },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ContentCard title="Adisyon ve Fis Testleri">
          <div className="space-y-3">
            {latestOrder ? (
              <>
                <Link href={`/receipt/${latestOrder.id}?layout=a4`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu A4 gorunumde ac
                </Link>
                <Link href={`/receipt/${latestOrder.id}?layout=thermal`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu 80mm fis gorunumde ac
                </Link>
                <Link href={`/receipt/${latestOrder.id}?layout=thermal58`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son adisyonu 58mm dar fis gorunumde ac
                </Link>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                Test icin henuz siparis yok. Once bir siparis olusturup sonra bu ekrandan fişi ac.
              </p>
            )}
            <Link href="/admin/print-center/test-slip" className="block rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f0b14f] px-5 py-4 text-sm font-semibold text-white">
              Ornek test fisi ac
            </Link>
          </div>
        </ContentCard>

        <ContentCard title="QR ve Masa Karti">
          <div className="space-y-3">
            <Link href="/admin/tables" className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
              Masa QR popup ve yazdirma akisini test et
            </Link>
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              Bu merkez fis ve adisyon sablonunu dogrular. Masa QR kartlari icin `Bolge ve Masa` ekranindaki `Masa Yonet` popup&apos;ini kullan.
            </p>
          </div>
        </ContentCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ContentCard title="Mutfak Siparis Fisi">
          <div className="space-y-3">
            {latestKitchenOrder ? (
              <>
                <Link href={`/admin/print-center/kitchen/${latestKitchenOrder.id}?layout=thermal`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son mutfak siparisini 80mm fis olarak ac
                </Link>
                <Link href={`/admin/print-center/kitchen/${latestKitchenOrder.id}?layout=thermal58`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-800">
                  Son mutfak siparisini 58mm dar fis olarak ac
                </Link>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                Mutfak kuyrugunda siparis yok. Test icin bir siparis olustur ve mutfaga dusur.
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
              {session ? "Acik oturumdaki nakit ve satis ozeti bu ciktiya yansir." : "Acik oturum yoksa bugunun satis ozeti kullanilir."}
            </p>
          </div>
        </ContentCard>
      </div>
    </BackofficePage>
  );
}
