# Faz 1 - Stabilization ve Scope Freeze

Durum: `in_progress`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Ürünü "özellik ekleme" modundan çıkarıp "stabilizasyon" moduna almak.
- Kritik operasyon akışlarını kilitlemek.
- Faz 2-8 için net ve oncelikli backlog hazirlamak.

## Scope Freeze
### In Scope
- Güvenlik, performans, tutarlılık, kalite ve operasyonel iyileştirmeler
- Kritik akislardaki bug fix ve hata mesaji iyilestirmeleri
- Test, CI gate ve dokümantasyon iyilestirmeleri

### Out of Scope
- Yeni is modulu eklemek
- Fiziksel POS entegrasyonu
- e-Fatura / e-Arsiv entegrasyonu
- Yeni pazarlama sayfasi/tema calismalari

## Kritik Operasyon Akışları (Kilidi Açık)
1. Sipariş oluşturma: `/admin/orders` -> `/api/orders`
2. Mutfak akışı: `/kitchen` (pending -> preparing -> served)
3. Kasa tahsilat akışı: `/cashier` (ödeme, split, iade)
4. Vardiya akışı: `/cashier/session` (gun basi / gun sonu)
5. Masa operasyonu: `/admin/tables` (ekle, güncelle, taşı, sil)
6. Servis talepleri: `/service-requests` + `/api/table-requests`
7. Operasyon saglik ve alert: `/api/health`, `/api/alerts/dispatch`

## Definition of Done (DoD)
- Kod:
  - `npm run typecheck` basarili
  - `npm run lint` basarili
  - Değişiklikler kritik akışları bozmayacak şekilde test edildi
- Güvenlik:
  - Endpoint yetki kontrolleri dogrulandi
  - Tenant/branch scope ihlali yok
- Dokumantasyon:
  - Etkilenen akisin notu README veya ilgili docs dosyasina islendi

## Önceliklendirilmiş Backlog (Faz 2 için giriş listesi)
### P0
- Tenant isolation negatif test seti
- Kritik write endpoint'lerde audit coverage taramasi
- Gün sonu mutabakat fark alarmi

### P1
- Kasa akışında idempotency ve duplicate request korumalari
- Ops metrikleri için p95 ve error-rate dashboard
- Support tespit ekranlarinda hata sınıfı etiketleme

### P2
- Operasyon ekranlarinda UX hizlandirma (kasa/mutfak)
- Faz bazlı release note otomasyonu

## Faz 1 Gorev Takibi
- [x] 8 faz master plan dokümanı oluşturuldu (`docs/productization-8-phases.md`)
- [x] Faz 1 scope freeze yazildi
- [x] Kritik akis listesi netlestirildi
- [x] DoD tanımlandı
- [x] Faz 2 giriş backlog'u P0/P1/P2 olarak siniflandi
- [ ] Ekip onayı alındı

## Notlar
- Faz 1 tamamlandiginda bu dosya `completed` olarak isaretlenecek ve Faz 2 calisma dosyasi acilacak.

