# Faz 5 - Dayanıklılık ve Hata Yönetimi

Durum: `completed`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Retry/timeout/race/duplicate hatalarinda yarim kalmis işlem riskini dusurmek.
- Sipariş durumunu ödeme kayitlariyla tutarlı tutmak.

## P0 Görevleri
1. Kritik ödeme mutasyonlarinda retry stratejisi
2. Ödeme kaydı sonrası durumun DB ozetinden yeniden hesaplanmasi
3. Runtime sipariş-durum tutarlılık kontrolü

## Bu Fazda Yapılanlar
- [x] Retryable mutation yardimcilari eklendi (`retryMutation`, `isRetryableMutationError`).
- [x] `completeOrderPayment` ödeme sonrası net tutarı DB'den tekrar okuyup status hesaplayacak şekilde güncellendi.
- [x] `refundOrder` ödeme sonrası net tutarı DB'den tekrar okuyup status hesaplayacak şekilde güncellendi.
- [x] `cancelOrder` update/table bosaltma adımları retry stratejisine baglandi.
- [x] Durum uzlasmazliginda operasyonel alert kaydı eklendi (`payment_status_reconcile_failed`).
- [x] Faz 5 runtime consistency scripti eklendi: `npm run phase5:consistency`.

## Açık Kalanlar
- [x] CI entegrasyonu (env varsa phase5 runtime check calissin)
- [x] `payment_status_reconcile_failed` için support runbook adimi
