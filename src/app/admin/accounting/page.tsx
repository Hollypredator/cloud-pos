import { 
  listSuppliers, 
  listPurchases, 
  listExpenses, 
  listIngredients, 
  listProducts 
} from "@/lib/server/procurement-data";
import { 
  BackofficePage, 
  ContentCard, 
  SegmentedTabs, 
  SidebarPanel, 
  SummaryCard,
  EmptyPanel
} from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { 
  createSupplier, 
  createPurchase, 
  addPurchaseItem, 
  finalizePurchase, 
  createExpense 
} from "@/lib/server/procurement-data";
import { revalidatePath } from "next/cache";

type AccountingTab = "summary" | "suppliers" | "purchases" | "expenses";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["admin"], "/admin/accounting");
  const { tab } = await searchParams;
  const activeTab = (tab as AccountingTab) || "summary";

  const [suppliers, purchases, expenses, ingredients, products] = await Promise.all([
    listSuppliers(),
    listPurchases(),
    listExpenses(),
    listIngredients(),
    listProducts()
  ]);

  // Server Actions for Forms
  async function addSupplierAction(formData: FormData) {
    "use server";
    await createSupplier({
      name: formData.get("name") as string,
      contact_person: formData.get("contact") as string,
      phone: formData.get("phone") as string,
      category: formData.get("category") as string,
    });
  }

  async function addPurchaseAction(formData: FormData) {
    "use server";
    await createPurchase({
      supplier_id: formData.get("supplierId") as string || null,
      invoice_number: formData.get("invoiceNumber") as string,
      purchase_date: formData.get("date") as string,
      payment_status: "draft"
    });
  }

  async function addExpenseAction(formData: FormData) {
    "use server";
    await createExpense({
      title: formData.get("title") as string,
      category: formData.get("category") as string,
      amount: Number(formData.get("amount")),
      expense_date: formData.get("date") as string,
      payment_method: formData.get("method") as any,
    });
  }

  const totalPurchases = purchases.filter(p => p.payment_status !== 'draft').reduce((sum, p) => sum + Number(p.total_amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const grandTotalOut = totalPurchases + totalExpenses;

  async function addPurchaseItemAction(formData: FormData) {
    "use server";
    const purchaseId = formData.get("purchaseId") as string;
    const ingredientId = formData.get("ingredientId") as string || null;
    const productId = formData.get("productId") as string || null;
    const quantity = Number(formData.get("quantity"));
    const unitPrice = Number(formData.get("unitPrice"));
    
    await addPurchaseItem({
      purchase_id: purchaseId,
      ingredient_id: ingredientId,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice
    });
  }

  const draftPurchases = purchases.filter(p => p.payment_status === 'draft');

  return (
    <BackofficePage 
      title="Muhasebe ve Satın Alma" 
      description="Tedarikçiler, alış faturaları ve genel işletme giderleri yönetimi."
      sidebar={
        <SidebarPanel title="Hızlı İşlemler">
          <div className="space-y-4">
             <div className="rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Toplam Gider (Bakiye)</p>
                <p className="mt-2 text-2xl font-bold">{grandTotalOut.toFixed(2)} TL</p>
             </div>
             <p className="text-xs text-slate-500">Bu toplam, tamamlanmış alış faturalarını ve işletme giderlerini kapsar.</p>
          </div>
        </SidebarPanel>
      }
    >
      <SegmentedTabs 
        tabs={[
          { label: "Özet", active: activeTab === "summary", href: "/admin/accounting?tab=summary" },
          { label: "Tedarikçiler", active: activeTab === "suppliers", href: "/admin/accounting?tab=suppliers" },
          { label: "Alışlar", active: activeTab === "purchases", href: "/admin/accounting?tab=purchases" },
          { label: "Giderler", active: activeTab === "expenses", href: "/admin/accounting?tab=expenses" },
        ]}
      />

      {activeTab === "summary" && (
        <div className="grid gap-6">
          <section className="grid gap-4 sm:grid-cols-3">
             <SummaryCard label="Malzeme Alışları" value={`${totalPurchases.toFixed(2)} TL`} tone="accent" />
             <SummaryCard label="İşletme Giderleri" value={`${totalExpenses.toFixed(2)} TL`} tone="danger" />
             <SummaryCard label="Toplam Çıkış" value={`${grandTotalOut.toFixed(2)} TL`} tone="neutral" />
          </section>

          <ContentCard title="Gider Dağılımı">
             <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                   <span className="font-semibold text-slate-700">Ürün/Malzeme Tedariği</span>
                   <span className="font-bold text-slate-900">%{grandTotalOut > 0 ? ((totalPurchases / grandTotalOut) * 100).toFixed(0) : 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                   <span className="font-semibold text-slate-700">Genel Giderler</span>
                   <span className="font-bold text-slate-900">%{grandTotalOut > 0 ? ((totalExpenses / grandTotalOut) * 100).toFixed(0) : 0}</span>
                </div>
             </div>
          </ContentCard>
        </div>
      )}

      {activeTab === "suppliers" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          <ContentCard title="Tedarikçi Listesi">
            {suppliers.length === 0 ? (
              <EmptyPanel title="Tedarikçi Yok" description="Henüz bir tedarikçi kaydı oluşturmadınız." />
            ) : (
              <div className="grid gap-3">
                {suppliers.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.category || 'Genel'} • {s.contact_person || 'İletişim yok'}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-600">{s.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>

          <ContentCard title="Yeni Tedarikçi">
            <form action={addSupplierAction} className="space-y-3">
               <input name="name" placeholder="Firma Adı" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <input name="contact" placeholder="Yetkili Kişi" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <input name="phone" placeholder="Telefon" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <select name="category" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="">Kategori seç</option>
                  <option value="Kasap">Kasap</option>
                  <option value="Manav">Manav</option>
                  <option value="İçecek">İçecek</option>
                  <option value="Kuru Gıda">Kuru Gıda</option>
                  <option value="Temizlik">Temizlik</option>
               </select>
               <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Kaydet</button>
            </form>
          </ContentCard>
        </div>
      )}

      {activeTab === "purchases" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          <div className="space-y-6">
            <ContentCard title="Alış Faturaları">
              {purchases.length === 0 ? (
                <EmptyPanel title="Fatura Yok" description="Henüz bir alış faturası girmediniz." />
              ) : (
                <div className="grid gap-4">
                  {purchases.map(p => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                       <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-400">{new Date(p.purchase_date).toLocaleDateString('tr-TR')}</p>
                            <h4 className="text-lg font-bold text-slate-900">{p.suppliers?.name || 'Bilinmeyen Tedarikçi'}</h4>
                            <p className="text-xs text-slate-500">No: {p.invoice_number || '-'}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-lg font-bold text-slate-900">{p.total_amount.toFixed(2)} TL</p>
                             <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${p.payment_status === 'completed' || p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {p.payment_status.toUpperCase()}
                             </span>
                          </div>
                       </div>
                       
                       {p.payment_status === 'draft' && (
                         <div className="mt-4 flex gap-2">
                            <form action={async () => { "use server"; await finalizePurchase(p.id); }}>
                               <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white uppercase">Tamamla ve Maliyetleri Güncelle</button>
                            </form>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </ContentCard>
          </div>

          <div className="space-y-6">
            <ContentCard title="Yeni Fatura Kaydı">
              <form action={addPurchaseAction} className="space-y-3">
                 <select name="supplierId" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <option value="">Tedarikçi seç</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <input name="invoiceNumber" placeholder="Fatura No" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                 <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                 <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Fatura Oluştur</button>
              </form>
              <p className="mt-2 text-center text-[10px] text-slate-400">Not: Fatura oluşturduktan sonra ürün/malzeme kalemlerini ekleyebilirsiniz.</p>
            </ContentCard>

            {draftPurchases.length > 0 && (
              <ContentCard title="Faturaya Kalem Ekle">
                <form action={addPurchaseItemAction} className="space-y-3">
                   <select name="purchaseId" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Fatura seç</option>
                      {draftPurchases.map(p => <option key={p.id} value={p.id}>{p.suppliers?.name} ({p.invoice_number})</option>)}
                   </select>
                   <select name="ingredientId" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Malzeme seç (Opsiyonel)</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                   </select>
                   <input name="quantity" type="number" step="0.0001" placeholder="Miktar" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                   <input name="unitPrice" type="number" step="0.01" placeholder="Birim Fiyat" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
                   <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Kalemi Ekle</button>
                </form>
              </ContentCard>
            )}
          </div>
        </div>
      )}

      {activeTab === "expenses" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
           <ContentCard title="Gider Hareketleri">
            {expenses.length === 0 ? (
              <EmptyPanel title="Gider Yok" description="Henüz bir genel gider kaydı oluşturmadınız." />
            ) : (
              <div className="responsive-table-shell rounded-2xl border border-slate-200">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 text-slate-500">
                     <tr>
                       <th className="px-4 py-3">Tarih</th>
                       <th className="px-4 py-3">Başlık</th>
                       <th className="px-4 py-3">Kategori</th>
                       <th className="px-4 py-3 text-right">Tutar</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {expenses.map(e => (
                        <tr key={e.id}>
                          <td className="px-4 py-3 text-slate-500">{new Date(e.expense_date).toLocaleDateString('tr-TR')}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{e.title}</td>
                          <td className="px-4 py-3 text-slate-600">{e.category}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{e.amount.toFixed(2)} TL</td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>
            )}
          </ContentCard>

          <ContentCard title="Gider Ekle">
            <form action={addExpenseAction} className="space-y-3">
               <input name="title" placeholder="Gider Başlığı (Örn: Kira)" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <select name="category" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="Rent">Kira</option>
                  <option value="Electricity">Elektrik</option>
                  <option value="Water">Su</option>
                  <option value="Salary">Personel Maaş</option>
                  <option value="Internet">İnternet</option>
                  <option value="Tax">Vergi</option>
                  <option value="Other">Diğer</option>
               </select>
               <input name="amount" type="number" step="0.01" placeholder="Tutar" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
               <select name="method" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="cash">Nakit</option>
                  <option value="card">Banka Kartı</option>
                  <option value="bank_transfer">EFT/Havale</option>
               </select>
               <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Kaydet</button>
            </form>
          </ContentCard>
        </div>
      )}
    </BackofficePage>
  );
}
