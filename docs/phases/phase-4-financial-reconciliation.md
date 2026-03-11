# Faz 4 - Finans Dogrulugu ve Mutabakat

Durum: `completed`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Finans metriklerini tek hesap kaynagindan uretmek.
- Gun sonu mutabakat farklarini threshold ile izlemek.

## P0 Gorevleri
1. Finans metriklerinde tek aggregation kaynagi
2. Gun sonu mutabakat farki runtime kontrolu
3. Dashboard/rapor ekranlarinda ayni net hesap patikasi

## Bu Fazda Yapilanlar
- [x] Ortak payment aggregation helper eklendi (`listScopedFinancePayments`, `aggregateFinancePayments`).
- [x] `getSalesReportSummary` bu helper uzerine alindi.
- [x] `getFinancialInsights` bu helper uzerine alindi.
- [x] `getPaymentOverview` bu helper uzerine alindi.
- [x] `getOpsSummary.todayRevenue` bu helper uzerine alindi.
- [x] Faz 4 mutabakat kontrol scripti eklendi: `npm run phase4:reconciliation`.
- [x] Finans hesaplama UAT checklist dokumani eklendi: `docs/finance-uat-checklist.md`.
- [x] Faz 4 mutabakat kontrolu CI'da staging secret'leriyle ayri job olarak baglandi.

## Acik Kalanlar
- [x] Finans UAT checklistinin staging ortaminda calistirilip onaylanmasi
