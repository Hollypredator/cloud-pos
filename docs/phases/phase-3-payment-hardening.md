# Faz 3 - POS'suz Ödeme Akışı Sağlamlaştırma

Durum: `completed`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Nakit/kart/karma ödeme akışlarını idempotent hale getirmek.
- Split, iade ve iptal senaryolarinda finansal tutarsizliklari engellemek.

## P0 Görevleri
1. Ödeme ve iade işlemlerinde request-key idempotency
2. İade tutarı üst limit doğrulaması (over-refund engeli)
3. Tahsilat alinmis siparişte iptal blokaji

## Bu Fazda Yapılanlar
- [x] `payments.idempotency_key` kolonu ve unique index migration'i eklendi.
- [x] `completeOrderPayment` idempotency kontrolü eklendi (`requestKey`).
- [x] `refundOrder` idempotency kontrolü ve duplicate replay handling eklendi.
- [x] `cancelOrder` idempotency kontrolü (cancel note tekrarini engelleme) eklendi.
- [x] `refundOrder` iade edilebilir bakiye kontrolü eklendi.
- [x] `cancelOrder` için "net tahsilat varsa iptal etme" kurali eklendi.
- [x] Kasa UI formlarinda `requestKey` hidden alanları eklendi.
- [x] Faz 3 runtime finansal butunluk kontrol scripti eklendi: `npm run phase3:runtime`.

## Açık Kalanlar
- [x] Ödeme aksiyonlari için kullaniciya operasyon sonucu geri bildirimi (idempotent replay, limit asimi vb.)
- [x] Faz 3 runtime test seti (payment duplicate + refund limit + cancel block)
