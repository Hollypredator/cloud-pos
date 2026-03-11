# Faz 6 - Operasyonel Gozlemlenebilirlik ve Support

Durum: `completed`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Kritik API akislarinda correlation id ile iz surulebilirlik saglamak.
- Operasyon ekibi icin log ve runbook akisini daha hizli uygulanabilir hale getirmek.

## P0 Gorevleri
1. Middleware ve API yanitlarinda correlation id standardi
2. Kritik endpointlerde structured log olayi
3. Faz 6 observability check ve CI entegrasyonu

## Bu Fazda Yapilanlar
- [x] Middleware'de `x-correlation-id` uretimi/iletimi ve tum yanitlara eklenmesi tamamlandi.
- [x] Guvenlik header seti correlation id ile birlikte standart hale getirildi.
- [x] `orders`, `table-requests`, `alerts/dispatch`, `metrics/ops`, `health` endpointlerinde structured log event'leri eklendi.
- [x] Kritik endpoint yanitlarinda `x-correlation-id` geri donusu eklendi.
- [x] Faz 6 static kontrol scripti eklendi: `npm run phase6:observability`.
- [x] CI quality gate'e Faz 6 observability check adimi eklendi.

## Acik Kalanlar
- [x] Incident runbook'a correlation id ile log takip adimlari eklendi
