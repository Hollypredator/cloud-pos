# Cloud POS Ticari Paket (Anlık Durum + Yol Haritasi)

## 1) Anlık Sistem Özellikleri (Hazır Olanlar)

### Operasyon
- QR ile masa bazlı sipariş alma
- Mutfak akışı (pending/preparing/served)
- Kasa akışı (ödeme alma, iade, adisyon kapama)
- Gün basi/gun sonu kasa oturumu
- Servis talepleri (garson cagir, hesap iste)
- Masa yönetimi (ekle/güncelle/sil/taşıma)

### Yönetim
- Rol bazlı erişim (owner/admin/cashier/kitchen/waiter)
- Coklu şube kapsamlandirmasi (branch scope)
- Ürün/kategori/stok yönetimi
- Raporlama ve finans özetleri
- Audit log ve operasyon izleri

### Güvenlik ve Dayanıklılık
- Endpoint guard + role kontrolü
- Tenant/branch isolation sertlestirmeleri
- Rate limit + security headers
- Idempotent ödeme kayıtları
- Retry/reconciliation kontrolleri
- Correlation id + structured logging

### Operasyonel Hazırlık
- Health endpoint
- Alert dispatch endpoint
- Ops smoke scriptleri
- Faz 1-8 engineering gate kontrolleri

## 2) Ek Geliştirme Paketleri (Ticari Büyüme İçin)

### Paket A - Fiziksel POS Entegrasyonu (Faz 9)
- Terminalden tutar gonderme
- Ön provizyon/satış/iptal/iade akışları
- Cihaz timeout/retry/idempotency
- Kasa mutabakatinda terminal referansi
- Cihaz bazlı log ve hata kodu haritalama

### Paket B - Pazar Yeri Entegrasyonlari (Faz 10)
- Trendyol Yemek entegrasyonu
- Yemeksepeti entegrasyonu
- Sipariş cekme, durum guncelleme, iptal akışı
- Menu/fiyat/stok senkronizasyonu
- Kanal bazlı komisyon ve kar marji raporu

### Paket C - Muhasebe ve Belge Entegrasyonlari (Faz 11)
- e-Fatura / e-Arsiv entegrasyonu
- ERP/muhasebe aktarimlari
- Gün sonu e-defter uyumlu export

### Paket D - Kurumsal Ölçek ve SLA (Faz 12)
- SLO/SLA tanimlari
- Destek masasi ve otomatik ticket akışı
- Failover ve DR tatbikatlari
- Gözlemlenebilirlik paneli (SRE odaklı)

## 3) Önerilen Is Planı

### Faz 9 (4-6 hafta)
- POS cihaz entegrasyon çekirdeği
- Tek marka/model ile pilot
- UAT + saha testleri

### Faz 10 (4-6 hafta)
- Trendyol Yemek + Yemeksepeti baglantisi
- Kanal sipariş orkestrasyonu
- Kanal bazlı raporlama

### Faz 11 (3-5 hafta)
- e-Fatura/e-Arsiv
- Finans export ve mutabakat iyileştirme

### Faz 12 (2-4 hafta)
- Kurumsal operasyon ve SLA
- DR/backup tatbikatlari + runbook kapanisi

## 4) Teknik Mimari Notu (Entegrasyonlar İçin)

- `Integration Gateway` katmanı ile her kanal/cihaz adaptör olarak baglanmali.
- Çekirdek sipariş ve ödeme domaini tek kalmali, kanal bagimliligi domain icine alinmamali.
- Her dis entegrasyon için:
  - idempotency key
  - correlation id
  - timeout/retry policy
  - dead letter / reconcile job
  zorunlu olmalidir.

## 5) Ticari Konumlandirma

- Bugünkü ürün: POS'suz ticari kullanımda uygulanabilir.
- Sonraki büyüme: cihaz + pazar yeri + e-belge ile tam ekosistem POS platformu.
- Satış modeli:
  - Kurulum + lisans
  - Aylık bakım/SLA
  - Kanal/entegrasyon bazlı ek paketleme
