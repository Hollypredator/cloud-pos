# Productization Plan (8 Faz)

Durum: `Faz 8 engineering tamamlandi, operasyonel pilot onayi bekleniyor`  
Not: Fiziksel POS, e-Fatura ve e-Arsiv entegrasyonlari son fazlara saklanmistir.

## Faz Ozeti
1. Faz 1 - Stabilization ve Scope Freeze
2. Faz 2 - Yetki ve Veri Guvenligi Sertlestirme
3. Faz 3 - POS'suz Odeme Akisi Saglamlastirma
4. Faz 4 - Finans Dogrulugu ve Mutabakat
5. Faz 5 - Dayaniklilik ve Hata Yonetimi
6. Faz 6 - Operasyonel Gozlemlenebilirlik ve Support
7. Faz 7 - Staging UAT ve Pilot Hazirlik
8. Faz 8 - POS'suz Pilot Canliya Gecis

## Faz 1 - Stabilization ve Scope Freeze
- Amac: Urun kapsamini dondurup kritik operasyon akislarini tek listede kilitlemek.
- Cikis kriteri:
  - Scope freeze dokumani onayli
  - Kritik akis listesi tamam
  - Definition of Done (DoD) tanimli
  - Onceliklendirilmis backlog hazir

## Faz 2 - Yetki ve Veri Guvenligi Sertlestirme
- Amac: Endpoint, tenant ve branch izolasyonunun testle garanti altina alinmasi.
- Cikis kriteri:
  - Tum kritik write endpoint'lerde guard + audit
  - Tenant isolation negatif testleri yesil

## Faz 3 - POS'suz Odeme Akisi Saglamlastirma
- Amac: Nakit/kart/karma odeme akisini cihaz bagimsiz sekilde guvenli hale getirmek.
- Cikis kriteri:
  - Idempotent odeme islemleri
  - Split, iade, iptal senaryolari tutarli

## Faz 4 - Finans Dogrulugu ve Mutabakat
- Amac: Rapor ve operasyon ekranlarinda finans tutarliligi.
- Cikis kriteri:
  - Gun sonu mutabakat farklari kabul edilen esigin altinda
  - Finans metrikleri tek kaynak uzerinden uretiliyor

## Faz 5 - Dayaniklilik ve Hata Yonetimi
- Amac: Retry/timeout/race/duplicate gibi hata siniflarini kontrol altina almak.
- Cikis kriteri:
  - Kritik akislarda "yarim kalmis islem" problemi kalmiyor

## Faz 6 - Operasyonel Gozlemlenebilirlik ve Support
- Amac: Olay tespiti ve mudahele suresini dusurmek.
- Cikis kriteri:
  - Structured log + correlation id
  - Alert akisi ve runbook operasyonel

## Faz 7 - Staging UAT ve Pilot Hazirlik
- Amac: Gercek isletme senaryolariyla onayli staging testi.
- Cikis kriteri:
  - `docs/staging-uat.md` checklist tamamlaniyor
  - Bloklayici hata kalmiyor

## Faz 8 - POS'suz Pilot Canliya Gecis
- Amac: Cihaz entegrasyonu olmadan ilk ticari kullanimin guvenli acilisi.
- Cikis kriteri:
  - Pilot subede kritik incident yok
  - KPI ve gun sonu mutabakat hedefleri saglaniyor

## Sonraki Asama (Faz 9+)
- Fiziksel POS cihaz baglantisi
- e-Fatura / e-Arsiv entegrasyonlari
- Bu asamalar Faz 1-8 tamamlandiktan sonra acilacak.
