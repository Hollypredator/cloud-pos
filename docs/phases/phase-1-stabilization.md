# Faz 1 - Stabilization ve Scope Freeze

Durum: `in_progress`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Urunu "ozellik ekleme" modundan cikarip "stabilizasyon" moduna almak.
- Kritik operasyon akislarini kilitlemek.
- Faz 2-8 icin net ve oncelikli backlog hazirlamak.

## Scope Freeze
### In Scope
- Guvenlik, performans, tutarlilik, kalite ve operasyonel iyilestirmeler
- Kritik akislardaki bug fix ve hata mesaji iyilestirmeleri
- Test, CI gate ve dokumantasyon iyilestirmeleri

### Out of Scope
- Yeni is modulu eklemek
- Fiziksel POS entegrasyonu
- e-Fatura / e-Arsiv entegrasyonu
- Yeni pazarlama sayfasi/tema calismalari

## Kritik Operasyon Akislari (Kilidi Acik)
1. Siparis olusturma: `/admin/orders` -> `/api/orders`
2. Mutfak akisi: `/kitchen` (pending -> preparing -> served)
3. Kasa tahsilat akisi: `/cashier` (odeme, split, iade)
4. Vardiya akisi: `/cashier/session` (gun basi / gun sonu)
5. Masa operasyonu: `/admin/tables` (ekle, guncelle, tasi, sil)
6. Servis talepleri: `/service-requests` + `/api/table-requests`
7. Operasyon saglik ve alert: `/api/health`, `/api/alerts/dispatch`

## Definition of Done (DoD)
- Kod:
  - `npm run typecheck` basarili
  - `npm run lint` basarili
  - Degisiklikler kritik akislari bozmayacak sekilde test edildi
- Guvenlik:
  - Endpoint yetki kontrolleri dogrulandi
  - Tenant/branch scope ihlali yok
- Dokumantasyon:
  - Etkilenen akisin notu README veya ilgili docs dosyasina islendi

## Onceliklendirilmis Backlog (Faz 2 icin giris listesi)
### P0
- Tenant isolation negatif test seti
- Kritik write endpoint'lerde audit coverage taramasi
- Gun sonu mutabakat fark alarmi

### P1
- Kasa akisinda idempotency ve duplicate request korumalari
- Ops metrikleri icin p95 ve error-rate dashboard
- Support tespit ekranlarinda hata sinifi etiketleme

### P2
- Operasyon ekranlarinda UX hizlandirma (kasa/mutfak)
- Faz bazli release note otomasyonu

## Faz 1 Gorev Takibi
- [x] 8 faz master plan dokumani olusturuldu (`docs/productization-8-phases.md`)
- [x] Faz 1 scope freeze yazildi
- [x] Kritik akis listesi netlestirildi
- [x] DoD tanimlandi
- [x] Faz 2 giris backlog'u P0/P1/P2 olarak siniflandi
- [ ] Ekip onayi alindi

## Notlar
- Faz 1 tamamlandiginda bu dosya `completed` olarak isaretlenecek ve Faz 2 calisma dosyasi acilacak.

