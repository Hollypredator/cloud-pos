# Productization Plan (8 Faz)

Durum: `Faz 8 engineering tamamlandı, operasyonel pilot onayı bekleniyor`  
Not: Fiziksel POS, e-Fatura ve e-Arsiv entegrasyonlari son fazlara saklanmistir.

## Faz Özeti
1. Faz 1 - Stabilization ve Scope Freeze
2. Faz 2 - Yetki ve Veri Güvenliği Sertleştirme
3. Faz 3 - POS'suz Ödeme Akışı Sağlamlaştırma
4. Faz 4 - Finans Doğruluğu ve Mutabakat
5. Faz 5 - Dayanıklılık ve Hata Yönetimi
6. Faz 6 - Operasyonel Gözlemlenebilirlik ve Support
7. Faz 7 - Staging UAT ve Pilot Hazırlık
8. Faz 8 - POS'suz Pilot Canlıya Geçiş

## Faz 1 - Stabilization ve Scope Freeze
- Amaç: Ürün kapsamını döndürüp kritik operasyon akışlarını tek listede kilitlemek.
- Çıkış kriteri:
  - Scope freeze dokümanı onayli
  - Kritik akis listesi tamam
  - Definition of Done (DoD) tanımlı
  - Önceliklendirilmiş backlog hazır

## Faz 2 - Yetki ve Veri Güvenliği Sertleştirme
- Amaç: Endpoint, tenant ve branch izolasyonunun testle garanti altina alinmasi.
- Çıkış kriteri:
  - Tum kritik write endpoint'lerde guard + audit
  - Tenant isolation negatif testleri yesil

## Faz 3 - POS'suz Ödeme Akışı Sağlamlaştırma
- Amaç: Nakit/kart/karma ödeme akışını cihaz bağımsız şekilde güvenli hale getirmek.
- Çıkış kriteri:
  - Idempotent ödeme işlemleri
  - Split, iade, iptal senaryoları tutarlı

## Faz 4 - Finans Doğruluğu ve Mutabakat
- Amaç: Rapor ve operasyon ekranlarinda finans tutarlılığı.
- Çıkış kriteri:
  - Gün sonu mutabakat farklari kabul edilen esigin altında
  - Finans metrikleri tek kaynak uzerinden uretiliyor

## Faz 5 - Dayanıklılık ve Hata Yönetimi
- Amaç: Retry/timeout/race/duplicate gibi hata siniflarini kontrol altina almak.
- Çıkış kriteri:
  - Kritik akislarda "yarim kalmis işlem" problemi kalmiyor

## Faz 6 - Operasyonel Gözlemlenebilirlik ve Support
- Amaç: Olay tespiti ve mudahele suresini dusurmek.
- Çıkış kriteri:
  - Structured log + correlation id
  - Alert akışı ve runbook operasyonel

## Faz 7 - Staging UAT ve Pilot Hazırlık
- Amaç: Gercek işletme senaryolariyla onayli staging testi.
- Çıkış kriteri:
  - `docs/staging-uat.md` checklist tamamlanıyor
  - Bloklayici hata kalmiyor

## Faz 8 - POS'suz Pilot Canlıya Geçiş
- Amaç: Cihaz entegrasyonu olmadan ilk ticari kullanımın güvenli açılışı.
- Çıkış kriteri:
  - Pilot subede kritik incident yok
  - KPI ve gun sonu mutabakat hedefleri sağlanıyor

## Sonraki Asama (Faz 9+)
- Fiziksel POS cihaz baglantisi
- e-Fatura / e-Arsiv entegrasyonlari
- Bu asamalar Faz 1-8 tamamlandiktan sonra acilacak.
