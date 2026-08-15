# PLAN — Masaüstü Uygulama (.exe), USB Yazıcı ve ÖKÇ Entegrasyonu

**Tarih:** 2026-08-15
**Dal:** `restart-from-49b0f83`
**Durum:** İleriye dönük hazırlık — aktif geliştirme değil, karar öncesi netleştirme

---

## Bugünkü durum

| Katman | Durum |
|---|---|
| Web uygulaması (Next.js, tarayıcıda çalışır) | var, PWA yüklenebilir |
| Fiş yazıcı (`scripts/local-print-daemon.mjs`) | **var, çalışıyor** — yerel Node servisi, 127.0.0.1:9100 |
| Yazıcı bağlantı tipi | **sadece ağ/IP (RAW/JetDirect, port 9100)** — USB/seri yok |
| Kasa çekmecesi açma | var (`DRAWER_KICK`, yazıcıya RJ11 ile bağlı çekmece varsayımıyla) |
| ÖKÇ (mali kasa) entegrasyonu | **yok** — kod kendi yorumunda bunu itiraf ediyor (`local-print-daemon.mjs:15-16`): ÖKÇ bağlı değilse basılan şey adisyon/bilgi fişidir, mali fiş değildir |
| Daemon paketleme/dağıtım | **yok** — `npm run print:daemon` ile elle başlatılıyor, otomatik başlama yok, tepsi ikonu yok, kurulum paketi yok |
| Masaüstü .exe / Electron/Tauri sarmalayıcı | yok |

İstemci tarafı: `src/lib/receipt-print.ts` — `printReceipt()`, `openCashDrawer()`, `checkPrintDaemon()`. Kullanan yerler: `src/app/admin/orders/page.tsx`, `src/components/self-service-checkout.tsx`. Bu istemci kodu **değişmeden** kalabilir; `DAEMON_BASE` (`NEXT_PUBLIC_PRINT_DAEMON_URL`, varsayılan `http://127.0.0.1:9100`) üzerinden konuşuyor — daemon nasıl paketlenirse paketlensin, aynı adreste ayakta durduğu sürece istemci kodunun haberi olmaz.

---

## Neden bu plan şimdi yazılıyor, ama uygulanmıyor

Kullanıcı onayı: "ileriye dönük hazırlık sadece". Yani şu an **acil, gerçek bir müşteride mali fiş zorunluluğu yok** — ama önden mimari netleştirilsin isteniyor ki gerçek ihtiyaç çıktığında hazır bir plana göre ilerlensin, sıfırdan araştırmaya gerek kalmasın.

Bu yüzden bu belge **kilitli bir spesifikasyon değil**, kararı üç bilinmeyene bağlı bırakıyor (aşağıda). Gerçek ihtiyaç doğduğunda önce o üç soru cevaplanmalı, sonra "Fazlı yol haritası" bölümü uygulamaya alınmalı.

---

## Açık kararlar / bilinmeyenler (uygulamadan önce netleşmesi şart)

### 1. ÖKÇ (mali kasa) — hangi cihaz/model?

Bu tek başına en riskli ve en regüle madde. Türkiye'de "Yeni Nesil ÖKC" mevzuatı GİB (Gelir İdaresi Başkanlığı) tarafından belirleniyor; entegrasyon iki koldan biri olur:

- **Donanım ÖKC** (Ingenico, yerli üreticiler vb.) — üreticinin kendi SDK/protokol dokümanı gerekir, cihaz modeline göre komut seti değişir. Üretici dokümanı ve mümkünse test cihazı olmadan kod yazılamaz.
- **Yazılım tabanlı / bulut ÖKC** ("Sanal ÖKC" modelleri, bazı ödeme sağlayıcılar üzerinden) — API tabanlı olabilir, entegrasyonu görece daha basit ama sağlayıcıya bağımlı.

**Bu plan bu kararı vermiyor.** Gerçek ihtiyaç çıktığında önce hangi ÖKÇ/sağlayıcı seçildiği netleşmeli, sonra bu bölüm gerçek bir teknik tasarıma dönüşmeli.

### 2. USB fiş yazıcı — hangi marka/model?

Mevcut daemon sadece ağ yazıcısı biliyor. USB yazıcı eklemek Node tarafında ek bir bağımlılık ister (örn. `node-usb`/`escpos-usb` veya işletim sistemi yazdırma kuyruğu üzerinden). Hangi marka/model (Epson TM-T20 gibi yaygın ESC/POS uyumlu bir model mi, yoksa özel bir sürücü isteyen bir cihaz mı) bilinmeden kütüphane seçimi yapılamaz. Çoğu yaygın termal fiş yazıcı ESC/POS uyumlu olduğu için mevcut `buildReceipt()` fonksiyonu byte üretimi tarafında **değişmeden** kalabilir — değişen sadece "byte'lar nereye gönderiliyor" katmanı (`sendToPrinter()`).

### 3. Kapsam: sadece daemon paketleme mi, tüm uygulama Electron mu?

İki farklı büyüklükte iş:

- **Dar kapsam:** Sadece `local-print-daemon.mjs`'i bir Windows servisi/.exe olarak paketle (otomatik başlasın, tepsi ikonu olsun). Web uygulaması yine tarayıcıda/PWA olarak açık kalır, sadece arka planda sessizce çalışan bir yazıcı köprüsü eklenmiş olur.
- **Geniş kapsam:** Tüm web uygulamasını Electron/Tauri ile masaüstü penceresinde aç, daemon'u onun içine göm, kiosk modu/otomatik güncelleme/tek kurulum dosyası sağla.

Aşağıdaki "Mimari seçenekler" bu ikisini karşılaştırıyor.

---

## Mimari seçenekler

### Seçenek A — Sadece daemon'u paketle (önerilen ilk adım)

`local-print-daemon.mjs`'i bağımsız bir .exe'ye derle (`pkg` veya Node'un kendi `node --experimental-sea-config` single-executable özelliği), Windows'ta:
- Görev Zamanlayıcı veya `nssm` ile Windows servisi olarak kaydet (bilgisayar açılışında otomatik başlar, kullanıcı oturum açmadan da ayakta durur).
- Basit bir sistem tepsisi ikonu ekle (durum: yazıcı bağlı/bağlı değil), isteğe bağlı.

**Artıları:** Küçük, düşük riskli, mevcut web uygulamasına (tarayıcı/PWA) hiç dokunmuyor. Kasiyer hâlâ tarayıcıdan çalışır, sadece arka planda görünmez bir servis fiş basar.
**Eksileri:** "Masaüstü uygulaması" hissi vermez — kullanıcı yine tarayıcı açıyor. Kiosk kilidi gibi ihtiyaçları karşılamaz.

### Seçenek B — Tüm uygulamayı Electron/Tauri ile sarmala, daemon'u içine göm

Web uygulamasını bir masaüstü penceresinde aç (Electron veya Tauri — Tauri daha küçük/hafif ama Rust toolchain ister, Electron daha yaygın/dokümante), `local-print-daemon.mjs`'in mantığını ana süreç (main process) içine taşı, tek kurulum dosyası (.exe/.msi) üret.

**Artıları:** Tek kurulum, otomatik güncelleme (Electron'un `autoUpdater`'ı), kiosk modu/tam ekran kilit mümkün, masaüstü kısayolu ile "gerçek program" hissi.
**Eksileri:** Çok daha büyük iş (haftalar, ay değil ama günler de değil), web uygulamasının kendisi zaten Next.js/React ile çalışıyor — Electron'un `BrowserWindow`'u pratikte "tarayıcıyı yeniden ambalajlamak" demek, gerçek bir kazanç yalnızca kiosk kilidi/otomatik güncelleme/tek exe isteniyorsa devreye girer.

### Öneri

**Önce Seçenek A.** Gerçek ihtiyaç şu an "yazıcı+ÖKÇ çalışsın" — kiosk kilidi veya otomatik güncelleme gibi Electron'un asıl kazandırdığı şeyler şu an istenmiyor (kullanıcı onayı: sadece hazırlık). Seçenek A, Seçenek B'nin daemon kısmını zaten kapsıyor; ileride gerçekten "tam masaüstü uygulaması" isteği netleşirse Seçenek B'ye geçmek Seçenek A'nın üstüne eklenir, çöpe atılmaz.

---

## Fazlı yol haritası (gerçek ihtiyaç çıktığında uygulanacak sıra)

1. **Faz 0 — Netleştirme (kod yazmadan önce şart):** ÖKÇ modeli/sağlayıcısı seçilir, USB yazıcı marka/modeli doğrulanır. Bu faz bitmeden Faz 2/3'e geçilemez.
2. **Faz 1 — Daemon paketleme:** `local-print-daemon.mjs` → tek .exe, Windows servisi olarak kurulum betiği, sistem tepsisi durum göstergesi. Mevcut ağ yazıcı davranışı hiç değişmez, sadece dağıtım şekli değişir. Bağımsız test edilebilir, düşük risk.
3. **Faz 2 — USB yazıcı desteği:** `sendToPrinter()`'a ikinci bir hedef tipi eklenir (`printerIp` yerine/yanında `usbVendorId`/`usbProductId` veya işletim sistemi yazdırma kuyruğu). `buildReceipt()` (byte üretimi) değişmez.
4. **Faz 3 — ÖKÇ entegrasyonu:** Faz 0'da seçilen cihaz/sağlayıcıya göre ayrı bir modül. Muhtemelen `/print` uç noktasına ek bir adım olarak (adisyon fişi + mali fiş ayrı komutlar) eklenir. Kapsamı Faz 0 netleşmeden tahmin edilemez.
5. **Faz 4 (opsiyonel, talep gelirse) — Electron/Tauri sarmalayıcı:** Seçenek B'ye geçiş, kiosk modu/otomatik güncelleme gerçekten isteniyorsa.

---

## Kapsam dışı (bu plan kapsamında değil)

- ÖKÇ cihaz/sağlayıcı seçimi (Faz 0'ın kendisi, bu planın ürettiği bir çıktı değil, ön koşulu)
- Mali mevzuat danışmanlığı (GİB onay süreci, hangi ÖKÇ'nin yasal olarak zorunlu olduğu) — muhasebe/mali müşavir konusu, bu plan sadece teknik entegrasyonu kapsar
- iOS/Android native uygulama (ayrı konu, PWA zaten mobilde çalışıyor)
- Mevcut ağ yazıcı akışında değişiklik (Faz 1-3 boyunca dokunulmuyor)

---

## Riskler

- **ÖKÇ mevzuatı** yanlış anlaşılırsa (örn. hangi işletme büyüklüğü/türü ÖKÇ'ye tabi) baştan yanlış cihaz seçilebilir — Faz 0'da mali müşavir teyidi önerilir, bu planın kapsamı dışında.
- **USB yazıcı çeşitliliği**: her marka aynı ESC/POS alt kümesini desteklemeyebilir; Faz 2'de gerçek cihazla test şart, simülasyonla geçilemez.
- **Windows servis paketleme**: kullanıcı ortamında antivirüs/SmartScreen imzasız .exe'yi engelleyebilir — kod imzalama sertifikası ihtiyacı Faz 1'de değerlendirilmeli.

---

## Sonraki adım

Gerçek ihtiyaç doğduğunda (bir müşteri mali fiş/USB yazıcı zorunlu kılınca) bu belgeye dönülüp önce "Açık kararlar" bölümündeki 3 madde netleştirilir, sonra `/spec` ile Faz 1'den başlayarak gerçek, uygulanabilir bir issue/spec üretilir.
