# Faz 2 - Yetki ve Veri Güvenliği Sertleştirme

Durum: `completed`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Kritik write endpoint'lerde guard eksiklerini kapatmak.
- Tenant/branch izolasyonunu otomatik kontrolle dogrulamak.
- Kasa gun sonu mutabakat farklarini operasyonel alarma baglamak.

## P0 Görevleri
1. Tenant isolation negatif testleri
2. Kritik write endpoint'lerde guard + audit coverage taramasi
3. Gün sonu mutabakat fark alarmi

## Bu Fazda Yapılanlar
- [x] `/api/business/active` için kimlik doğrulaması zorunlu hale getirildi.
- [x] `/api/branch/active` için kimlik doğrulaması zorunlu hale getirildi.
- [x] `closeCashSession` beklenen kasa hesabi açılış nakdini icerecek şekilde duzeltildi.
- [x] `closeCashSession` mutabakat farkı esigi (`CASH_RECONCILIATION_DIFF_ALERT`, default `50`) eklendi.
- [x] Mutabakat farkı aşımında `cash_reconciliation_mismatch` alert dispatch kaydı eklendi.
- [x] Kasa açılış/kapanış işlemleri için audit log kayıtları eklendi.
- [x] Write route guard tarama scripti eklendi: `scripts/check-write-route-guards.mjs`.
- [x] Tenant izolasyon tarama scripti eklendi: `scripts/check-tenant-isolation.mjs`.
- [x] Write route audit policy allowlist tanımlandı (public/cookie endpointleri hariç audit zorunlu).
- [x] `phase2:checks` CI workflow gate adimina eklendi (`.github/workflows/ci.yml`).

## Komutlar
- `npm run phase2:guards`
- `npm run phase2:isolation`
- `npm run phase2:checks`
- `npm run phase2:runtime` (uygulama çalışır durumda olmalı)

## Açık Kalanlar
- [x] Tenant isolation için runtime testlerin (integration/e2e) eklenmesi
