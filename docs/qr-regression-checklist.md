# QR Regression Checklist

## 1) Duplicate Submit Guard
- Ayn? sepetle "Siparişi Onayla" butonuna hizli sekilde 3 kez bas.
- Beklenen: Tek sipariş olusur, ikinci/ucuncu istek conflict veya idempotent handling ile yeni sipariş acmaz.

## 2) Expired Token Retry
- Gecersiz veya süresi dolmus token ile sipariş gündermeyi dene.
- Beklenen: Ilk istek 403 alir, istemci token refresh endpointini cagirir, ikinci denemede sipariş ACK olur.

## 3) Network Retry Safety
- Sipariş günderimi sırasında agi kes/kapat-ac senaryosu uygula.
- Beklenen: Kullanici tekrar denediginde ayn? idempotency key ile duplicate sipariş acilmaz.

## 4) Cart Persistence
- Sepete Ürün ekle, sayfayi yenile.
- Beklenen: Sepet kaybolmaz.
- Farkli masa slug/identifier ac.
- Beklenen: Sepet izolasyonu korunur (farkli masada onceki sepet gelmez).

## 5) QR Badge in Ops
- QR'dan oluşan dine_in siparişi mutfak ve kasa ekranlarinda ac.
- Beklenen: Sipariş kaynak satirinda QR rozeti görünur.

## 6) Delay Alerts and Observability
- Pending/preparing siparişleri esik ustune taşıyarak gecikme olustur.
- Beklenen: `orders.latest.delay_alert` ve `kitchen.delay.alert` log eventleri uretilir.
- `x-correlation-id` ve `x-operation-ms` basliklarini API cevaplarinda dogrula.

## 7) Legacy Route Redirect
- `/qr/<identifier>` ile acilis yap.
- Beklenen: `/{defaultSlug}/qr/<identifier>` yoluna yonlenir ve sipariş akışı acilir.
