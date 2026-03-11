# Faz 3 - POS'suz Odeme Akisi Saglamlastirma

Durum: `completed`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Nakit/kart/karma odeme akislarini idempotent hale getirmek.
- Split, iade ve iptal senaryolarinda finansal tutarsizliklari engellemek.

## P0 Gorevleri
1. Odeme ve iade islemlerinde request-key idempotency
2. Iade tutari ust limit dogrulamasi (over-refund engeli)
3. Tahsilat alinmis sipariste iptal blokaji

## Bu Fazda Yapilanlar
- [x] `payments.idempotency_key` kolonu ve unique index migration'i eklendi.
- [x] `completeOrderPayment` idempotency kontrolu eklendi (`requestKey`).
- [x] `refundOrder` idempotency kontrolu ve duplicate replay handling eklendi.
- [x] `cancelOrder` idempotency kontrolu (cancel note tekrarini engelleme) eklendi.
- [x] `refundOrder` iade edilebilir bakiye kontrolu eklendi.
- [x] `cancelOrder` icin "net tahsilat varsa iptal etme" kurali eklendi.
- [x] Kasa UI formlarinda `requestKey` hidden alanlari eklendi.
- [x] Faz 3 runtime finansal butunluk kontrol scripti eklendi: `npm run phase3:runtime`.

## Acik Kalanlar
- [x] Odeme aksiyonlari icin kullaniciya operasyon sonucu geri bildirimi (idempotent replay, limit asimi vb.)
- [x] Faz 3 runtime test seti (payment duplicate + refund limit + cancel block)
