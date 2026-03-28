# Faz 4 - Finans Doğruluğu ve Mutabakat

Durum: `completed`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Finans metriklerini tek hesap kaynagindan uretmek.
- Gün sonu mutabakat farklarini threshold ile izlemek.

## P0 Görevleri
1. Finans metriklerinde tek aggregation kaynağı
2. Gün sonu mutabakat farkı runtime kontrolü
3. Dashboard/rapor ekranlarinda ayni net hesap patikasi

## Bu Fazda Yapılanlar
- [x] Ortak payment aggregation helper eklendi (`listScopedFinancePayments`, `aggregateFinancePayments`).
- [x] `getSalesReportSummary` bu helper üzerine alındı.
- [x] `getFinancialInsights` bu helper üzerine alındı.
- [x] `getPaymentOverview` bu helper üzerine alındı.
- [x] `getOpsSummary.todayRevenue` bu helper üzerine alındı.
- [x] Faz 4 mutabakat kontrol scripti eklendi: `npm run phase4:reconciliation`.
- [x] Finans hesaplama UAT checklist dokümanı eklendi: `docs/finance-uat-checklist.md`.
- [x] Faz 4 mutabakat kontrolü CI'da staging secret'leriyle ayri job olarak baglandi.

## Açık Kalanlar
- [x] Finans UAT checklistinin staging ortaminda calistirilip onaylanmasi
