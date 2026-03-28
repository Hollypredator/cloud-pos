# Cloud POS Sunum Metni (Kopyala-Kullan)

## Slide 1 - Baslik
- Cloud POS
- Kafe/Restoran operasyonu için yeni nesil POS platformu
- QR sipariş + operasyon paneli + finans kontrolü

## Slide 2 - Problem
- Sipariş, mutfak, kasa ve servis akışları dağınık
- Kanal cogaldikca operasyon karmasasi artiyor
- Rapor ve mutabakat manuel takipte hataya açık

## Slide 3 - Çözüm
- Tek panelde siparisten tahsilata uç uca akışı yönetiyoruz
- Rol bazlı ekranlar ile ekipler sadece kendi akisina odaklaniyor
- Finans ve operasyon metrikleri merkezi izleniyor

## Slide 4 - Bugün Hazır Olan Ürün
- QR masa sipariş
- Mutfak kuyruğu
- Kasa ve ödeme işlemleri (POS'suz/manual)
- Servis talep yönetimi
- Raporlama ve audit
- Coklu şube ve rol yetkileri

## Slide 5 - Güvenlik ve Dayanıklılık
- Tenant/branch isolation
- Rate limiting + security headers
- Idempotent ödeme yapisi
- Retry ve tutarlılık kontrolleri
- Correlation id ile izlenebilirlik

## Slide 6 - Ticari Kullanım Durumu
- Mevcut haliyle manuel POS kullanan isletmeler için uygun
- Faz 1-8 engineering tamam
- Operasyonel izleme ve alert otomasyonu aktif tasarlandi

## Slide 7 - Sonraki Büyüme: Faz 9-12
- Faz 9: Fiziksel POS cihaz entegrasyonu
- Faz 10: Trendyol Yemek + Yemeksepeti entegrasyonu
- Faz 11: e-Fatura/e-Arsiv
- Faz 12: Kurumsal SLA, DR ve ölçekleme

## Slide 8 - Pazar Yeri Entegrasyon Vizyonu
- Tek panelden tum kanal siparislerinin yönetimi
- Menu/fiyat/stok senkronizasyonu
- Kanal komisyonu ve net kar takibi
- Sipariş durumlarının çift yönlü senkronu

## Slide 9 - Is Modeli
- Kurulum + lisans bedeli
- Aylık bakım/SLA
- Entegrasyon bazlı ek paketler
- Şube/kanal artışına bağlı upsell modeli

## Slide 10 - Kapanış
- Hedef: POS yazılımı değil, tam operasyon platformu
- Yol haritasi net: manuel POS'tan tam entegre ekosisteme
- Bir sonraki adım: Faz 9 kapsam/fiyat onayı ile başlangıç
