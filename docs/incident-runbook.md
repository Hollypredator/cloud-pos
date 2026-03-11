# Incident Runbook

## 1. Tespit
- Alarm kaynagini not et (`alert_type`, timestamp, etkilenen endpoint/sube).
- Etkiyi siniflandir:
  - `sev-1`: siparis/tahsilat tamamen durdu
  - `sev-2`: kritik akista yavaslama veya bolgesel hata
  - `sev-3`: ikincil fonksiyon bozulmasi

## 2. Ilk Tepki (0-10 dk)
- `/api/health` cevabini kontrol et.
- Son deploy ve migration kaydini kontrol et.
- Hata kapsaminda auth, db, webhook, rate limit etkisini ayristir.

## 3. Koruma
- Gerekirse etkilenen aksiyonu gecici kapat:
  - `ALERT_DISPATCH_SECRET` dogrulamasi
  - API seviyesinde gecici blok/rate limit arttirimi
- Veri tutarliligi riski varsa yazma islemlerini durdur.

## 4. Kök Neden ve Duzeltme
- Hata sinifi:
  - auth/permission
  - schema/migration
  - entegrasyon/webhook
  - performans/zaman asimi
- Fix branch ac, `typecheck + lint + build` gecmeden production'a alma.

## 5. Geri Donus / Onay
- Fix deploy sonrasi:
  - `/api/health`
  - kritik ekranlar: `/ops`, `/cashier`, `/kitchen`, `/admin/tables`
  - alert durumu: `/api/alerts/dispatch` (secret ile)

## 6. Postmortem
- 24 saat icinde su maddeleri kaydet:
  - olay zamani (baslangic/bitis)
  - etki (tenant/sube/istek sayisi)
  - kök neden
  - kalici aksiyonlar


## 7. Ozel Prosedur - `payment_status_reconcile_failed`
- Semptom:
  - `alert_dispatches.alert_type = payment_status_reconcile_failed`
  - Odeme/iade alindigi halde siparis durumu beklenen seviyeye gecmiyor.
- Ilk kontrol:
  - Etkilenen `orderId` icin `payments` kayitlarini listele.
  - `orders.status`, `orders.final_price` ile odeme netini karsilastir.
  - `idempotency_key` tekrarlarini kontrol et.
- Acil aksiyon:
  - `npm run phase5:consistency` calistir.
  - Tutarsiz order'lari manuel olarak net odeme sonucuna gore `served/paid/refunded` durumuna cek.
  - Gerekirse ilgili table status'unu (`empty/occupied`) duzelt.
- Kalici aksiyon:
  - Retryable hata tipini loglardan siniflandir.
  - Gerekli ise timeout/retry limitlerini revize et.
  - Olayi postmortem'e "finans durum uzlasmazligi" basligiyla ekle.
