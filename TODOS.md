# TODOS

Ertelenen işler. Her madde `/plan-eng-review` (2026-08-06) turunda bilinçli olarak
kapsam dışına alındı — unutulmuş değil, sıraya konmuş.

---

## 1. Playwright E2E test paketi

**Ne:** 6 kritik akış için uçtan uca tarayıcı testi:
ödeme→mali fiş, ÖKC arızası + kasiyer kurtarma, çevrimdışı kuyruk senkronu,
şube değiştirme (profil geçişi), mobil/masaüstü regresyon, yetkisiz şube erişimi.

**Neden:** Rota ikizlerinin birleştirilmesi (`/cashier` + `/m/cashier` vb.) ÖKC ve
pilot sonrasına alındı (karar T4=C). O refactor başladığında E2E olmadan regresyon
yakalanamaz — altı `pwa:*` npm kontrol script'i mevcut dosya yapısına bağlı ve
birleştirmeyle geçersiz kalacak.

**Artı:** Birleştirme refactor'ü güvenceye alınır; teslim öncesi gerçek güven.
**Eksi:** Playwright altyapısı + test verisi + CI koleksiyonu sıfırdan kurulacak;
E2E bakım maliyeti süreklidir.

**Bağımlı:** S9=B birim/entegrasyon testleri önce oturmalı. Test DB sağlama kararı
(gerçek Postgres + RLS politikaları) verilmeli — RLS izolasyon testleri birim testle
yapılamaz.

**Nereden başlanır:** `vitest.config.ts` kurulduktan sonra `playwright.config.ts`;
mevcut `scripts/mobile-*-check.mjs` dosyaları hangi davranışın doğrulandığına dair
iyi bir başlangıç listesi.

---

## 2. SaaS dağıtım katmanı

**Ne:** Tenant onboarding akışı, faturalandırma, tenant/şube başına ÖKC cihaz
tedariki ve eşleştirmesi (tip, IP, seri no), destek erişim modeli.

**Neden:** "Dışarıya dağıtıma açık olacak" hedefi bunları zorunlu kılıyor ama
mevcut planda hiç yok. `src/app/support/tenants/*` iskeleti var, tamamlanmamış ve
zaten `self_service_coffee`'ye göre dallanıyor — yani profil uzlaştırması (T5) bu
alanı da kapsamalı.

**Artı:** İkinci müşteride bloklayıcı olan iş önceden görünür olur.
**Eksi:** Özellikle ÖKC cihaz modeli tenant başına; sonradan eklemek şema
değişikliği gerektirebilir.

**Bağımlı:** İlk müşteri teslimi ve tek şube pilotu önce. İkinci müşteriden önce
gerekli.

**Not:** ÖKC cihaz kaydı modeli S2 fiscal ledger'ı ile doğal olarak birlikte gider —
ledger zaten hangi cihazın hangi fişi bastığını bilmek zorunda. Ledger yazılırken
cihaz tablosunu da modellemek, sonradan migration yazmaktan ucuz olabilir.

---

## 3. Gerçek çevrimdışı: Tauri + yerel veri replikası

**Ne:** Şube içi yerel veri replikası (Postgres/SQLite) + iki yönlü senkron,
Tauri paketleme, Windows kod imzalama sertifikası, otomatik güncelleme (updater
endpoint), sürüm-şema uyum politikası.

**Neden:** T1=A kararıyla ilk teslim daemon + kiosk tarayıcı ile yapılıyor.
Gerekçe: Tauri + Next standalone sidecar her okuma için yine Supabase buluta gider,
yani çevrimdışı vermez — sadece yazıcı (port 9100) ve ÖKC (port 9200) yerel
erişimi kazandırır, ikisi de zaten daemon deseniyle mevcut. Kod imzalama, updater
ve 8 şubeye installer dağıtımı maliyeti bu iki kazanım için ödenmez.

Gerçek çevrimdışı dayanıklılık istiyorsak asıl eksik bileşen yerel veri replikası.
Bu, projenin en zor işi (çakışma çözümü, şema senkronu, veri bütünlüğü) ve tüm
innovation token'ları oraya gider.

**Artı:** İnternet kesintisinde şube tam kapasite çalışır; SaaS'ta ciddi
farklılaştırıcı.
**Eksi:** Teslim tarihini aylarca geciktirir; çakışma çözümü kalıcı bakım yükü.

**Bağımlı:** T5 migration taban çizgisi şart — sürüm-şema uyumu onsuz çözülemez
(8 kurulu masaüstü uygulaması, tek migrate edilen bulut Postgres). Pilot sonuçları
gerekli: gerçekte kaç kesinti oluyor, ne kadar sürüyor?

**Yeniden değerlendirme:** Pilot verisiyle. Kesintiler nadir ve kısaysa kiosk
mimarisi kalıcı olabilir.
