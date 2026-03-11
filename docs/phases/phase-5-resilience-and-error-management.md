# Faz 5 - Dayaniklilik ve Hata Yonetimi

Durum: `completed`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Retry/timeout/race/duplicate hatalarinda yarim kalmis islem riskini dusurmek.
- Siparis durumunu odeme kayitlariyla tutarli tutmak.

## P0 Gorevleri
1. Kritik odeme mutasyonlarinda retry stratejisi
2. Odeme kaydi sonrasi durumun DB ozetinden yeniden hesaplanmasi
3. Runtime siparis-durum tutarlilik kontrolu

## Bu Fazda Yapilanlar
- [x] Retryable mutation yardimcilari eklendi (`retryMutation`, `isRetryableMutationError`).
- [x] `completeOrderPayment` odeme sonrasi net tutari DB'den tekrar okuyup status hesaplayacak sekilde guncellendi.
- [x] `refundOrder` odeme sonrasi net tutari DB'den tekrar okuyup status hesaplayacak sekilde guncellendi.
- [x] `cancelOrder` update/table bosaltma adimlari retry stratejisine baglandi.
- [x] Durum uzlasmazliginda operasyonel alert kaydi eklendi (`payment_status_reconcile_failed`).
- [x] Faz 5 runtime consistency scripti eklendi: `npm run phase5:consistency`.

## Acik Kalanlar
- [x] CI entegrasyonu (env varsa phase5 runtime check calissin)
- [x] `payment_status_reconcile_failed` icin support runbook adimi
