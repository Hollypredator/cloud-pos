# Faz 6 - Operasyonel Gözlemlenebilirlik ve Support

Durum: `completed`  
Başlangıç tarihi: `2026-03-11`  
Hedef bitiş: `1 hafta`

## Hedef
- Kritik API akışlarında correlation id ile iz sürülebilirlik sağlamak.
- Operasyon ekibi için log ve runbook akışını daha hızlı uygulanabilir hale getirmek.

## P0 Görevleri
1. Middleware ve API yanitlarinda correlation id standardi
2. Kritik endpointlerde structured log olayi
3. Faz 6 observability check ve CI entegrasyonu

## Bu Fazda Yapılanlar
- [x] Middleware'de `x-correlation-id` uretimi/iletimi ve tum yanitlara eklenmesi tamamlandı.
- [x] Güvenlik header seti correlation id ile birlikte standart hale getirildi.
- [x] `orders`, `table-requests`, `alerts/dispatch`, `metrics/ops`, `health` endpointlerinde structured log event'leri eklendi.
- [x] Kritik endpoint yanitlarinda `x-correlation-id` geri donusu eklendi.
- [x] Faz 6 static kontrol scripti eklendi: `npm run phase6:observability`.
- [x] CI quality gate'e Faz 6 observability check adimi eklendi.

## Açık Kalanlar
- [x] Incident runbook'a correlation id ile log takip adımları eklendi
