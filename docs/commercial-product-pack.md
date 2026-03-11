# Cloud POS Ticari Paket (Anlik Durum + Yol Haritasi)

## 1) Anlik Sistem Ozellikleri (Hazir Olanlar)

### Operasyon
- QR ile masa bazli siparis alma
- Mutfak akisi (pending/preparing/served)
- Kasa akisi (odeme alma, iade, adisyon kapama)
- Gun basi/gun sonu kasa oturumu
- Servis talepleri (garson cagir, hesap iste)
- Masa yonetimi (ekle/guncelle/sil/tasima)

### Yonetim
- Rol bazli erisim (owner/admin/cashier/kitchen/waiter)
- Coklu sube kapsamlandirmasi (branch scope)
- Urun/kategori/stok yonetimi
- Raporlama ve finans ozetleri
- Audit log ve operasyon izleri

### Guvenlik ve Dayaniklilik
- Endpoint guard + role kontrolu
- Tenant/branch isolation sertlestirmeleri
- Rate limit + security headers
- Idempotent odeme kayitlari
- Retry/reconciliation kontrolleri
- Correlation id + structured logging

### Operasyonel Hazirlik
- Health endpoint
- Alert dispatch endpoint
- Ops smoke scriptleri
- Faz 1-8 engineering gate kontrolleri

## 2) Ek Gelistirme Paketleri (Ticari Buyume Icin)

### Paket A - Fiziksel POS Entegrasyonu (Faz 9)
- Terminalden tutar gonderme
- On provizyon/satis/iptal/iade akislari
- Cihaz timeout/retry/idempotency
- Kasa mutabakatinda terminal referansi
- Cihaz bazli log ve hata kodu haritalama

### Paket B - Pazar Yeri Entegrasyonlari (Faz 10)
- Trendyol Yemek entegrasyonu
- Yemeksepeti entegrasyonu
- Siparis cekme, durum guncelleme, iptal akisi
- Menu/fiyat/stok senkronizasyonu
- Kanal bazli komisyon ve kar marji raporu

### Paket C - Muhasebe ve Belge Entegrasyonlari (Faz 11)
- e-Fatura / e-Arsiv entegrasyonu
- ERP/muhasebe aktarimlari
- Gun sonu e-defter uyumlu export

### Paket D - Kurumsal Olcek ve SLA (Faz 12)
- SLO/SLA tanimlari
- Destek masasi ve otomatik ticket akisi
- Failover ve DR tatbikatlari
- Gozlemlenebilirlik paneli (SRE odakli)

## 3) Onerilen Is Plani

### Faz 9 (4-6 hafta)
- POS cihaz entegrasyon cekirdegi
- Tek marka/model ile pilot
- UAT + saha testleri

### Faz 10 (4-6 hafta)
- Trendyol Yemek + Yemeksepeti baglantisi
- Kanal siparis orkestrasyonu
- Kanal bazli raporlama

### Faz 11 (3-5 hafta)
- e-Fatura/e-Arsiv
- Finans export ve mutabakat iyilestirme

### Faz 12 (2-4 hafta)
- Kurumsal operasyon ve SLA
- DR/backup tatbikatlari + runbook kapanisi

## 4) Teknik Mimari Notu (Entegrasyonlar Icin)

- `Integration Gateway` katmani ile her kanal/cihaz adaptor olarak baglanmali.
- Cekirdek siparis ve odeme domaini tek kalmali, kanal bagimliligi domain icine alinmamali.
- Her dis entegrasyon icin:
  - idempotency key
  - correlation id
  - timeout/retry policy
  - dead letter / reconcile job
  zorunlu olmalidir.

## 5) Ticari Konumlandirma

- Bugunku urun: POS'suz ticari kullanimda uygulanabilir.
- Sonraki buyume: cihaz + pazar yeri + e-belge ile tam ekosistem POS platformu.
- Satis modeli:
  - Kurulum + lisans
  - Aylik bakim/SLA
  - Kanal/entegrasyon bazli ek paketleme
