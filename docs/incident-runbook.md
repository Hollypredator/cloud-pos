# Incident Runbook

## 1. Tespit
- Alarm kaynağını not et (`alert_type`, timestamp, etkilenen endpoint/şube).
- Etkiyi sınıflandır:
  - `sev-1`: sipariş/tahsilat tamamen durdu
  - `sev-2`: kritik akışta yavaşlama veya bölgesel hata
  - `sev-3`: ikincil fonksiyon bozulması

## 2. İlk Tepki (0-10 dk)
- `/api/health` cevabini kontrol et.
- Son deploy ve migration kaydini kontrol et.
- Hata kapsaminda auth, db, webhook, rate limit etkisini ayristir.
- API cevabindaki `x-correlation-id` degerini kaydet ve log taramasini bu id ile yap.

## 3. Koruma
- Gerekirse etkilenen aksiyonu gecici kapat:
  - `ALERT_DISPATCH_SECRET` doğrulaması
  - API seviyesinde gecici blok/rate limit arttirimi
- Veri tutarlılığı riski varsa yazma işlemlerini durdur.

## 4. Kök Neden ve Duzeltme
- Hata sınıfı:
  - auth/permission
  - schema/migration
  - entegrasyon/webhook
  - performans/zaman asimi
- Log inceleme:
  - `event` bazlı filtreleme yap (`orders.create.*`, `table_requests.create.*`, `alerts.dispatch.*`, `metrics.ops.*`).
  - Aynı `correlationId` ile request zincirini uç noktaya kadar takip et.
- Fix branch ac, `typecheck + lint + build` gecmeden production'a alma.

## 5. Geri Dönüş / Onay
- Fix deploy sonrası:
  - `/api/health`
  - kritik ekranlar: `/ops`, `/cashier`, `/kitchen`, `/admin/tables`
  - alert durumu: `/api/alerts/dispatch` (secret ile)

## 6. Postmortem
- 24 saat içinde su maddeleri kaydet:
  - olay zamanı (başlangıç/bitiş)
  - etki (tenant/şube/istek sayısı)
  - kök neden
  - kalıcı aksiyonlar


## 7. Özel Prosedur - `payment_status_reconcile_failed`
- Semptom:
  - `alert_dispatches.alert_type = payment_status_reconcile_failed`
  - Ödeme/iade alındığı halde sipariş durumu beklenen seviyeye geçmiyor.
- İlk kontrol:
  - Etkilenen `orderId` için `payments` kayitlarini listele.
  - `orders.status`, `orders.final_price` ile ödeme netini karsilastir.
  - `idempotency_key` tekrarlarını kontrol et.
- Acil aksiyon:
  - `npm run phase5:consistency` calistir.
  - Tutarsız order'lari manuel olarak net ödeme sonucuna göre `served/paid/refunded` durumuna cek.
  - Gerekirse ilgili table status'unu (`empty/occupied`) düzelt.
- Kalici aksiyon:
  - Retryable hata tipini loglardan sınıflandır.
  - Gerekli ise timeout/retry limitlerini revize et.
  - Olayi postmortem'e "finans durum uzlasmazligi" basligiyla ekle.
