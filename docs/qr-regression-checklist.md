# QR Regression Checklist

## 1) Duplicate Submit Guard
- Ayni sepetle "Siparisi Onayla" butonuna hizli sekilde 3 kez bas.
- Beklenen: Tek siparis olusur, ikinci/ucuncu istek conflict veya idempotent handling ile yeni siparis acmaz.

## 2) Expired Token Retry
- Gecersiz veya suresi dolmus token ile siparis gondermeyi dene.
- Beklenen: Ilk istek 403 alir, istemci token refresh endpointini cagirir, ikinci denemede siparis ACK olur.

## 3) Network Retry Safety
- Siparis gonderimi sirasinda agi kes/kapat-ac senaryosu uygula.
- Beklenen: Kullanici tekrar denediginde ayni idempotency key ile duplicate siparis acilmaz.

## 4) Cart Persistence
- Sepete urun ekle, sayfayi yenile.
- Beklenen: Sepet kaybolmaz.
- Farkli masa slug/identifier ac.
- Beklenen: Sepet izolasyonu korunur (farkli masada onceki sepet gelmez).

## 5) QR Badge in Ops
- QR'dan olusan dine_in siparisi mutfak ve kasa ekranlarinda ac.
- Beklenen: Siparis kaynak satirinda QR rozeti gorunur.

## 6) Delay Alerts and Observability
- Pending/preparing siparisleri esik ustune tasiyarak gecikme olustur.
- Beklenen: `orders.latest.delay_alert` ve `kitchen.delay.alert` log eventleri uretilir.
- `x-correlation-id` ve `x-operation-ms` basliklarini API cevaplarinda dogrula.

## 7) Legacy Route Redirect
- `/qr/<identifier>` ile acilis yap.
- Beklenen: `/{defaultSlug}/qr/<identifier>` yoluna yonlenir ve siparis akisi acilir.
