# Faz 2 - Yetki ve Veri Guvenligi Sertlestirme

Durum: `completed`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Kritik write endpoint'lerde guard eksiklerini kapatmak.
- Tenant/branch izolasyonunu otomatik kontrolle dogrulamak.
- Kasa gun sonu mutabakat farklarini operasyonel alarma baglamak.

## P0 Gorevleri
1. Tenant isolation negatif testleri
2. Kritik write endpoint'lerde guard + audit coverage taramasi
3. Gun sonu mutabakat fark alarmi

## Bu Fazda Yapilanlar
- [x] `/api/business/active` icin kimlik dogrulamasi zorunlu hale getirildi.
- [x] `/api/branch/active` icin kimlik dogrulamasi zorunlu hale getirildi.
- [x] `closeCashSession` beklenen kasa hesabi acilis nakdini icerecek sekilde duzeltildi.
- [x] `closeCashSession` mutabakat farki esigi (`CASH_RECONCILIATION_DIFF_ALERT`, default `50`) eklendi.
- [x] Mutabakat farki asiminda `cash_reconciliation_mismatch` alert dispatch kaydi eklendi.
- [x] Kasa acilis/kapanis islemleri icin audit log kayitlari eklendi.
- [x] Write route guard tarama scripti eklendi: `scripts/check-write-route-guards.mjs`.
- [x] Tenant izolasyon tarama scripti eklendi: `scripts/check-tenant-isolation.mjs`.
- [x] Write route audit policy allowlist tanimlandi (public/cookie endpointleri haric audit zorunlu).
- [x] `phase2:checks` CI workflow gate adimina eklendi (`.github/workflows/ci.yml`).

## Komutlar
- `npm run phase2:guards`
- `npm run phase2:isolation`
- `npm run phase2:checks`
- `npm run phase2:runtime` (uygulama calisir durumda olmali)

## Acik Kalanlar
- [x] Tenant isolation icin runtime testlerin (integration/e2e) eklenmesi
