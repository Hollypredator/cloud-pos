/**
 * Gün Sonu (Z Raporu) & Satış Detayları Excel (.xlsx / CSV) Döküm Servisi
 */

export type EndOfDayReportData = {
  date: string;
  businessName: string;
  totalSalesCount: number;
  totalRevenue: number;
  cashTotal: number;
  creditCardTotal: number;
  mealCardTotal: number;
  vat1Total: number;
  vat10Total: number;
  vat20Total: number;
  cancelTotal: number;
  discountTotal: number;
  categories: Array<{ name: string; qty: number; revenue: number }>;
  items: Array<{ name: string; category: string; qty: number; revenue: number }>;
};

/**
 * Rapor verilerini formatlı Excel (.csv / .xls) dosyasına dönüştürür ve tarayıcıda indirmeyi başlatır.
 */
export function exportEndOfDayToExcel(data: EndOfDayReportData) {
  const filename = `Z_RAPORU_${data.businessName.replace(/\s+/g, "_")}_${data.date}.csv`;

  const rows: string[][] = [];

  // Başlık Bilgisi
  rows.push([`GÜN SONU Z-RAPORU DÖKÜMÜ - ${data.businessName}`]);
  rows.push([`Tarih / Saat`, data.date]);
  rows.push([]);

  // Finansal Özet Tablosu
  rows.push(["FİNANSAL ÖZET", "TUTAR (TL)"]);
  rows.push(["Toplam Sipariş Sayısı", String(data.totalSalesCount)]);
  rows.push(["TOPLAM CİRO", `${data.totalRevenue.toFixed(2)} TL`]);
  rows.push(["Nakit Tahsilat", `${data.cashTotal.toFixed(2)} TL`]);
  rows.push(["Kredi Kartı Tahsilat", `${data.creditCardTotal.toFixed(2)} TL`]);
  rows.push(["Yemek Kartı Tahsilat", `${data.mealCardTotal.toFixed(2)} TL`]);
  rows.push(["İptal & İade Toplamı", `${data.cancelTotal.toFixed(2)} TL`]);
  rows.push(["İndirim & İkram Toplamı", `${data.discountTotal.toFixed(2)} TL`]);
  rows.push([]);

  // KDV Dağılımı
  rows.push(["KDV ORANI", "MATRAH / KDV TUTARI"]);
  rows.push(["KDV %1", `${data.vat1Total.toFixed(2)} TL`]);
  rows.push(["KDV %10", `${data.vat10Total.toFixed(2)} TL`]);
  rows.push(["KDV %20", `${data.vat20Total.toFixed(2)} TL`]);
  rows.push([]);

  // Kategori Bazlı Satışlar
  rows.push(["KATEGORİ BAZLI SATIŞLAR", "ADET", "TOPLAM TUTAR"]);
  data.categories.forEach((cat) => {
    rows.push([cat.name, String(cat.qty), `${cat.revenue.toFixed(2)} TL`]);
  });
  rows.push([]);

  // Ürün Bazlı Satış Detayı
  rows.push(["ÜRÜN DETAY RAPORU", "KATEGORİ", "SATILAN ADET", "TOPLAM TUTAR"]);
  data.items.forEach((item) => {
    rows.push([item.name, item.category, String(item.qty), `${item.revenue.toFixed(2)} TL`]);
  });

  // CSV Kodlama & UTF-8 BOM ekleme (Excel'de Türkçe karakterlerin düzgün görünmesi için)
  const csvContent =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(";")
      )
      .join("\n");

  // Indirme Tetikleyici
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
