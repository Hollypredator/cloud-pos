# Cloud POS Sunum Metni (Kopyala-Kullan)

## Slide 1 - Baslik
- Cloud POS
- Kafe/Restoran operasyonu icin yeni nesil POS platformu
- QR siparis + operasyon paneli + finans kontrolu

## Slide 2 - Problem
- Siparis, mutfak, kasa ve servis akislari daginik
- Kanal cogaldikca operasyon karmasasi artiyor
- Rapor ve mutabakat manuel takipte hataya acik

## Slide 3 - Cozum
- Tek panelde siparisten tahsilata uc uca akisi yonetiyoruz
- Rol bazli ekranlar ile ekipler sadece kendi akisina odaklaniyor
- Finans ve operasyon metrikleri merkezi izleniyor

## Slide 4 - Bugun Hazir Olan Urun
- QR masa siparis
- Mutfak kuyrugu
- Kasa ve odeme islemleri (POS'suz/manual)
- Servis talep yonetimi
- Raporlama ve audit
- Coklu sube ve rol yetkileri

## Slide 5 - Guvenlik ve Dayaniklilik
- Tenant/branch isolation
- Rate limiting + security headers
- Idempotent odeme yapisi
- Retry ve tutarlilik kontrolleri
- Correlation id ile izlenebilirlik

## Slide 6 - Ticari Kullanim Durumu
- Mevcut haliyle manuel POS kullanan isletmeler icin uygun
- Faz 1-8 engineering tamam
- Operasyonel izleme ve alert otomasyonu aktif tasarlandi

## Slide 7 - Sonraki Buyume: Faz 9-12
- Faz 9: Fiziksel POS cihaz entegrasyonu
- Faz 10: Trendyol Yemek + Yemeksepeti entegrasyonu
- Faz 11: e-Fatura/e-Arsiv
- Faz 12: Kurumsal SLA, DR ve olcekleme

## Slide 8 - Pazar Yeri Entegrasyon Vizyonu
- Tek panelden tum kanal siparislerinin yonetimi
- Menu/fiyat/stok senkronizasyonu
- Kanal komisyonu ve net kar takibi
- Siparis durumlarinin cift yonlu senkronu

## Slide 9 - Is Modeli
- Kurulum + lisans bedeli
- Aylik bakim/SLA
- Entegrasyon bazli ek paketler
- Sube/kanal artisina bagli upsell modeli

## Slide 10 - Kapanis
- Hedef: POS yazilimi degil, tam operasyon platformu
- Yol haritasi net: manuel POS'tan tam entegre ekosisteme
- Bir sonraki adim: Faz 9 kapsam/fiyat onayi ile baslangic
