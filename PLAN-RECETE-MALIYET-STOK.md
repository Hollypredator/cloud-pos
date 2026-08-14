# PLAN — Reçete, Maliyet ve Stok

**Tarih:** 2026-08-09
**Dal:** `restart-from-49b0f83`

---

## Bugünkü durum

| Katman | Durum |
|---|---|
| `ingredients` (ad, birim, `cost`, `business_id`) | var |
| `product_ingredients` (ürün, malzeme, miktar) | var |
| Satışta maliyet anlık kaydı → `order_items.unit_cost_snapshot` | **çalışıyor** |
| Recipe Studio / Malzeme Kütüphanesi arayüzü | var — **kafe tipinde gizliydi, açıldı** |
| Malzeme stok miktarı | **yok** (miktar kolonu bile yok) |
| Satışta stok düşümü | **yok** — ne üründen ne malzemeden |
| Modifier → reçete/maliyet etkisi | **yok** (yalnızca `price_delta`) |
| Alım / stok girişi | **yok** — stok sadece elle sayımla değişir |
| Birim çevrimi (kg↔g) | **yok** |

Maliyet formülü bugün: `products.cost + Σ(product_ingredients.quantity × ingredients.cost)`.
Sipariş anında hesaplanıp `unit_cost_snapshot`'a yazılıyor.

---

## Derin tasarım kararları

### 1. Tüketimi satış anında dondur

En kritik karar bu. Reçete zamanla değişir: porsiyon küçülür, tedarikçi değişir,
yeni malzeme girer. Çevrimdışı sipariş de saatler sonra senkron olabilir.

Stok düşümü senkron anındaki reçeteye göre yapılırsa, satılan kahve ile düşülen
malzeme tutmaz. Bu yüzden **satış anında tüketim satırları siparişe yazılır**:

```
order_item_ingredients(order_item_id, ingredient_id, quantity, unit_cost, source)
```

`source`: `recipe` | `modifier_add` | `modifier_replace` | `modifier_scale`

Bunun üç faydası:
- Stok düşümü, maliyet ve denetim aynı kaynaktan beslenir
- Reçete sonradan değişse bile geçmiş bozulmaz
- Çevrimdışı sipariş geç senkron olsa da doğru malzeme düşer

`unit_cost_snapshot` zaten var; bu tablo onun malzeme kırılımı.

### 2. Maliyet yöntemi: hareketli ağırlıklı ortalama

`ingredients.cost` bugün tek sayı — elle girilen son fiyat. Son alış fiyatını
kullanmak marjı zıplatır: 40 TL'ye alınan süt 60 TL olunca dünkü satışların marjı
da değişmiş gibi görünür.

**Hareketli ağırlıklı ortalama (MAP)** kullanılacak:

```
yeni_ortalama = (mevcut_miktar × mevcut_ortalama + alım_miktarı × alım_fiyatı)
                / (mevcut_miktar + alım_miktarı)
```

Alım hareketi geldiğinde güncellenir. `ingredients.cost` alanı "güncel ortalama
maliyet" anlamına gelir; elle de düzeltilebilir.

### 3. Birim: taban birim + alım birimi

- `base_unit`: `g` | `ml` | `adet` — reçete ve stok bu birimde tutulur
- `purchase_unit` + `purchase_factor`: 1 çuval = 25000 g, 1 koli = 12 adet

Reçetede 18 g yazılır, stokta g tutulur, alımda çuval girilir. Çevrim tek yerde,
alım anında. `kg` ile `g` karışıklığı imkânsız hâle gelir.

### 4. Fire katsayısı (yield)

1000 g çekirdekten 1000 g kullanılabilir kahve çıkmaz: öğütme kaybı, purge shot,
demleme firesi var. Reçete satırında `yield_factor` (varsayılan 1.0):

```
gerçek_tüketim = reçete_miktarı / yield_factor
```

0.97 girilirse 18 g'lık doz stoktan 18.56 g düşer. Bu olmadan teorik tüketim
her zaman gerçeğin altında kalır ve sayım farkı hep "kayıp" görünür.

### 5. Modifier'ların reçeteye etkisi — dört kip

Yulaf sütü bugün sadece +15 TL. Gerçekte 300 ml Süt yerine 300 ml Yulaf Sütü
demek: maliyet yanlış, yulaf sütü stoktan hiç düşmüyor.

```
modifier_option_ingredients(option_id, ingredient_id, quantity, mode, target_ingredient_id, multiplier)
```

| Kip | Örnek | Etki |
|---|---|---|
| `add` | Ekstra shot | +18 g çekirdek |
| `remove` | Sütsüz | Süt satırını sil |
| `replace` | Yulaf sütü | Süt satırını sil, aynı miktarda Yulaf Sütü ekle |
| `scale` | Large | Belirtilen satırları çarpanla büyüt |

`scale` bilerek satır bazlı, reçetenin tamamı değil: Large latte'de süt ve bardak
büyür, espresso dozu çoğu kafede aynı kalır. Global çarpan bunu yanlış modeller.

**Çözümleme sırası** (deterministik olmalı, yoksa aynı seçim farklı sonuç verir):
`scale` → `remove` → `replace` → `add`

### 6. Stok düşümü: ne zaman, kaç kez

- **Ne zaman:** sipariş oluşturulduğunda. Tüketim üretim anında olur, ödeme
  anında değil. `pay_at_order`'da ikisi zaten aynı an.
- **İdempotans:** `unique(order_item_id, ingredient_id)`. Sipariş bazlı değil
  kalem bazlı — aynı malzeme hem reçeteden hem modifier'dan gelebilir, kalem
  içinde toplanır.
- **İptal/iade:** ters hareket yazılır, orijinal satır silinmez. Denetim izi kalır.
- **Çevrimdışı tekrar gönderim:** idempotency anahtarı zaten koruyor.

### 7. Negatif stok: engelleme yok

Satış engellenmez, uyarı verilir. Gerekçe: sayım hiçbir zaman gerçeği tam
yansıtmaz; stok kaydı yüzünden kasayı durdurmak kafeyi kilitler. Negatif bakiye
"sayım gerekiyor" sinyalidir, satış bloğu değil.

### 8. Şube kapsamı

- **Stok şube bazlı** — 6 şube, her birinin kendi deposu
- **Reçete işletme bazlı** — latte her şubede aynı
- **Maliyet işletme bazlı** (v1) — şubeler farklı tedarikçi kullanırsa v2'de şube
  bazlı ortalama gerekir. Sınır olarak yazıldı.

### 9. Alım olmadan stok sadece azalır

Stok girişi olmadan sistem tek yönlü çalışır. Gereken:
- `purchase` hareketi (fatura/irsaliye) → miktar artar, ortalama maliyet güncellenir
- Depo→şube transferi (`depot_transfers`, ayrı planda tasarlandı)
- Sayım düzeltmesi (`stock_count`) → fark `variance` olarak kaydedilir

Sayım farkı asıl değerli veri: *"bu ay 4.2 kg fazla kahve gitti"* teorik tüketim
ile gerçek sayımın farkıdır. Zayiat, hatalı porsiyon ve kayıp buradan görünür.

### 10. Hız kısıtı — satışı yavaşlatmayacak

Kasa saniyelik olmak zorunda. Bu yüzden:
- `ingredient_movements` **append-only** — hızlı insert, kilit yok
- `ingredient_stock.quantity` trigger ile güncellenir, satış yolu beklemez
- Ürün birim maliyeti her satışta reçete sorgusuyla hesaplanmaz;
  `products.computed_unit_cost` denormalize edilir, reçete/maliyet değişince
  yeniden hesaplanır
- Tüketim satırları tek `insert ... select` ile yazılır

### 11. Kenar durumlar

| Durum | Davranış |
|---|---|
| Reçetesiz ürün | Düşüm yok, maliyet = `products.cost` |
| Malzeme eşleşmemiş modifier | Düşüm yok, arayüzde "maliyet eksik" rozeti |
| Silinen malzeme, geçmiş hareketi var | Soft delete (`is_active=false`), silme yok |
| İkram / personel içeceği | Tüketim düşer, ciro sıfır — `is_complimentary` |
| Porsiyon 0 veya negatif | Kayıt reddedilir (`check quantity > 0`) |

---

## Fazlar

**Faz 1 — Şema.** `ingredients` taban/alım birimi + `is_active`,
`ingredient_stock`, `ingredient_movements`, `order_item_ingredients`,
`modifier_option_ingredients`, `product_ingredients.yield_factor`,
`products.computed_unit_cost`. Trigger'lar ve RLS.

**Faz 2 — ~~Reçete çözümleyici yaz~~ → main'den kısmi port. TAMAMLANDI.**

CEO review D1 kararı: `main` dalındaki motorlar portlanacak. Port sırasında D1'in
gerekçesi düzeltildi (karar 10):

| Modül | Karar | Neden |
|---|---|---|
| `modifiers/engine.ts` + 312 satır test | **Portlandı** | Üç yüzeyin paylaştığı tek kural kaynağı, veriden gelen adımlar, testli |
| `stock-engine.ts` | **Portlanmadı** | Testi yok (312 satır test yalnızca modifier'ı kapsıyor), main'de hiç çağrılmıyor, demo verisi gömülü (`defaultRecipes`), modifier ve fire desteği yok, `Math.max(0,...)` ile negatif stoğu gizliyor — "negatife izin ver, uyar" kararını bozar |

Stok/reçete tarafı `src/lib/recipes/engine.ts` (16 test, 4 modifier kipi, fire
katsayısı, sabit çözümleme sırası) üzerinden gidiyor.

Sonuç: 2 test dosyası, **54 test geçiyor**.

**Faz 3 — Satışta tüketim yazımı. TASARIM DEĞİŞTİ (2026-08-10).**

İlk tasarım tüketimi `createOrder` içinde, sunucuda çözüyordu. Offline-first
önceliklendirilince bu bozuldu: çevrimdışı sipariş kuyrukta bekler, saatler
sonra senkron olur ve `ORDER_CREATE` o an çalışır — yani **senkron anındaki
reçeteyle** düşüm yapar. Oysa planın en kritik kararı "tüketimi satış anında
dondur" idi. Reçete arada değişirse satılan kahve ile düşen malzeme tutmaz.

Yeni tasarım: tüketim **istemcide, satış anında** çözülür ve komutla birlikte
taşınır. Sunucu onu olduğu gibi yazar, yeniden hesaplamaz.

```
  SATIS ANI (istemci)                    SENKRON ANI (sunucu)
  ───────────────────                    ────────────────────
  onbellekli katalog                     ORDER_CREATE + donmus tuketim
    -> resolveConsumption()      ──────►   -> order_item_ingredients
    -> donmus satirlar komuta ekli        -> ingredient_movements
                                          (yeniden hesap YOK)
```

Kalem kimliği yerine **indeks** taşınır: çevrimdışı satışta `order_items.id`
henüz yoktur, senkronda oluşur.

**Yapıldı (2026-08-10):**
- `src/app/api/ops/catalog-snapshot/route.ts` — menü, reçete, malzeme maliyeti
  ve modifier etkilerinin tek anlık görüntüsü. Tek uç nokta, tek sürüm damgası;
  varlık başına ayrı önbellek tutulsaydı menü yeni / reçete eski kalırdı.
- `src/lib/offline/catalog-store.ts` — IndexedDB deposu. Bayat veri **silinmez**:
  internet yokken bayat menü, menüsüz kasadan iyidir; yaşı gösterilir.
- `src/lib/offline/catalog-consumption.ts` — istemcide dondurma (11 test).
  Sunucu karşılığı `recipes/consumption.ts` ile aynı saf motoru çağırır.

**TAMAMLANDI (2026-08-13):** `createOrder` donmuş tüketimi kabul ediyor
(`writeFrozenConsumption`). Kasa ekranı da katalogdan okuyor: `admin-order-entry.tsx`
varsayılan `/api/orders` yolu artık `loadCatalog` + `freezeCartConsumption` ile
kendi tüketimini dondurup gönderiyor — önceden sadece self-servis kasa
(`self-service-checkout.tsx`'in kendi `onSubmitOrder` sarmalayıcısı) bunu
yapıyordu; masa/kasa siparişlerinde reçete stok düşümü hiç yazılmıyordu.

**Faz 4 — Arayüz. TAMAMLANDI (2026-08-13).** Recipe Studio'da fire (yield_factor)
alanı uçtan uca bağlandı (`products-data.ts` seçimi → `recipeDraftMap` →
`RecipeEditor` → `saveRecipeAction` → `saveProductRecipe`); sayfadaki 5 ayrı
maliyet hesaplama yeri de fireyi hesaba katacak şekilde düzeltildi
(`recipeLineCost` helper). Modifier→malzeme eşlemesi de eklendi: yeni
`modifier_option_ingredients` okuma/yazma yolu (`saveModifierOptionEffects`),
`RecipeEditor` içine gömülü "Ekler / Boy Malzeme Etkisi" bölümü — seçenek
başına add/remove/replace/scale etkisi tanımlanabiliyor, opsiyon başına tek
Kaydet (recete editörüyle aynı tam-değiştirme deseni).

**Faz 5 — Alım ve sayım. TAMAMLANDI (önceki oturumda).** Alım girişi (ortalama
maliyet güncellemesi), sayım ekranı ve fark hareketleri (`stock_count` nedenli
`ingredient_movements`) zaten yazılıyordu.

**Faz 6 — Raporlar. KISMEN TAMAMLANDI (2026-08-13).** `/admin/reports` sayfasına
yeni "Stok" sekmesi eklendi: düşük stok + gün kapsama tablosu
(`getStockRiskOverview`, son 14 günün `sale_consumption` hareketinden günlük
ortalama tüketim), sayım fark geçmişi (`getIngredientVarianceHistory`, mevcut
`stock_count` hareketlerinin salt okunur listesi). Düşük stok alarmı
`ALERT_WEBHOOK_URL` altyapısına bağlandı (D3.4): `/api/alerts/dispatch-stock`
+ `scripts/dispatch-stock-alert.mjs` + `npm run alerts:dispatch-stock`, aynı
cooldown/secret deseni `ops_summary` ile birebir. Ürün bazlı COGS/marj zaten
"Detay" sekmesinde vardı (`getFinancialInsights().topProducts`); **kalan**:
kategori bazlı marj toplulaştırması (`topProducts` şu an sadece ürün adı
taşıyor, kategori kırılımı için `getFinancialInsights` sorgusuna dokunmak
gerekiyor — ayrı, daha riskli bir değişiklik, bilinçli olarak bu tura
alınmadı).

---

## CEO review kararları (2026-08-09)

Tam kayıt: `~/.gstack/projects/Hollypredator-cloud-pos/ceo-plans/2026-08-09-recipe-cost-stock.md`
Mod: SELECTIVE EXPANSION.

### Kapsam kararları

| Karar | Sonuç |
|---|---|
| D1 Temel | main'den seçmeli port (Faz 2 yerine) |
| D3.1 Alım girişi + hareketli ortalama maliyet | **Kapsamda** |
| D3.2 Sayım + teorik-gerçek fark raporu | **Kapsamda** |
| D3.3 "Maliyet eksik" rozeti | **Kapsamda** |
| D3.4 Düşük stok uyarısı + gün kapsama | **Kapsamda** |
| D3.5 Yarı mamul reçete | Ertelendi (TODOS) |
| D3.6 Şube bazında maliyet | Ertelendi (TODOS), şema hazırlık taşıyacak |

### İnceleme bulguları ve kararları

| # | Bulgu | Karar |
|---|---|---|
| 1 | `trg_ingredients_cost_fanout` her alımda tetiklenip transaction şişiriyor | Tetikleyici kaldırılacak, alım sonunda toplu hesap |
| 2 | Tüketim yazımı başarısızsa stok sessizce kayıyor | Satış geçer + `consumption_failed` bayrağı + log |
| 3 | İdempotans `UniqueViolation`'ı kalıcı hata görünüyor | ACK sayılacak, kuyruktan silinecek |
| 4 | `staff write ingredient_movements` okuma yetkisiyle yazma açıyor; kasiyer sahte alım/sayım girebilir | Yetki `reason` alanına göre ayrılacak |
| 5 | Sayım sırasındaki satışlar iki kez sayılıyor | Sayım anı damgalanacak, ara hareketler mahsup edilecek |
| 6 | RLS ve idempotans doğrulanamıyor; migration'lar hiç çalıştırılmadı | Yerel Postgres + 5 kritik entegrasyon testi |
| 7 | Migration tablo geneli yazma yapıyor | Kapanış sonrası çalıştırılacak, parti işleme TODOS'a |
| 8 | "Maliyet eksik" rozetinin yeri belirsizdi | Yalnızca Recipe Studio + rapor üstü, kasada yok |

### Bulunan hazır altyapı

- `ALERT_WEBHOOK_URL` + `scripts/dispatch-ops-alert.mjs` — D3.4 uyarısı bunu kullanacak, yeni kanal kurulmayacak
- `getOrderItemUnitCostSnapshotMap` — toplu yükleme deseni, reçete çözümünde tekrarlanacak (N+1 önlemi)
- `order_items.unit_cost_snapshot` / `line_cost_snapshot` — maliyet anlık kaydı zaten çalışıyor

### Kalan riskler

- Geri döndürülebilirlik 3/5: tüketim geçmişi biriktikçe tek yönlü kapıya dönüşür
- Dış ses (Codex/ikinci model) çalıştırılmadı — Codex kurulu değil
- Reçete zinciri beş halkalı (`product_ingredients` → çözümleyici → `order_item_ingredients` → `ingredient_movements` → `ingredient_stock`); migration başına ASCII diyagram gerekiyor

---

## Mimari yön (2026-08-10)

Dört yeni kısıt geldi. Ölçüm sonuçları ve etkileri:

| Kısıt | Bugünkü durum | Etki |
|---|---|---|
| **Offline-first öncelikli** | Yazma kuyruğu var, **okuma sunucu bileşeninden** | En büyük iş. Faz 3 tasarımını değiştirdi (yukarıda) |
| **İleride VPS + Coolify** | Vercel bağımlılığı: `@vercel/analytics`, `@vercel/speed-insights`, boş `vercel.json`. Edge runtime yok, `output: "standalone"` destekli | **Düşük risk.** İki paketi koşullu yap, standalone build'i doğrula |
| **Masaüstü uygulama, güncellemeler webden** | `src-tauri` bu dalda yok | Offline okuma kurulunca ince kabuk (barındırılan adrese bakan webview) tutarlı hale gelir. Aynı altyapı, ikinci kez kurulmaz |
| **Müşteri bazlı modül: restoran / takeaway** | 13 feature flag var ama restoran/takeaway ayrımı `business_type` — **tek değer** | "Hem restoran hem takeaway" bugün ifade edilemiyor. Modül satılacaksa bu eksen flag'e taşınmalı |

**Sıralama gerekçesi:** offline okuma önce, çünkü Faz 3'ün doğru yeri ona bağlı.
Tersi sırada Faz 3 iki kez yazılırdı.

## Kapsam dışı (şimdilik)

- FIFO/LIFO maliyet — MAP kafe için yeterli, FIFO parti takibi gerektirir
- Son kullanma tarihi / parti (lot) izleme
- Tedarikçi ve sipariş yönetimi
- Şube bazlı farklı maliyet
- Reçete içinde reçete (yarı mamul: ev yapımı şurup) — v2'de `is_sub_recipe`

---

## Implementation Tasks

Bu incelemenin bulgularından türetildi. JSONL:
`~/.gstack/projects/Hollypredator-cloud-pos/tasks-ceo-review-20260809-233800.jsonl`

- [ ] **T9 (P1, human: ~1g / CC: ~20dk)** — port — main'den `modifiers/engine.ts` + 312 satır testi + `stock-engine.ts` portla
  - Surfaced by: Sistem denetimi — 944 satır test edilmiş kod bu dalda yok, paralel uygulama yazıldı
  - Files: `src/lib/modifiers/engine.ts`, `src/lib/stock-engine.ts`, `src/lib/recipes/engine.ts`
  - Verify: `npm test` — portlanan 312 satır test geçmeli
- [ ] **T1 (P1, human: ~1s / CC: ~10dk)** — schema — `trg_ingredients_cost_fanout` kaldır, alım sonunda toplu recompute
  - Surfaced by: Section 1 / bulgu 1B — her alım MAP günceller, fanout transaction şişirir
  - Files: `supabase/migrations/20260809_add_recipe_cost_and_ingredient_stock.sql`
  - Verify: 30 kalemlik irsaliye girişi tek transaction, ölçülen süre < 1s
- [ ] **T2 (P1, human: ~3s / CC: ~20dk)** — orders — tüketim yazımı hatasında satış geçer + `consumption_failed` bayrağı + log
  - Surfaced by: Section 2 / bulgu 2B — sessiz stok kayması
  - Files: `src/lib/data.ts`
  - Verify: tüketim insert'i zorla başarısız et, sipariş kapanmalı ve bayrak set olmalı
- [ ] **T3 (P1, human: ~1s / CC: ~10dk)** — offline — `UniqueViolation` ACK sayılsın, kuyruktan silinsin
  - Surfaced by: Section 2 / bulgu 3A — idempotans koruması hata gibi görünüyor
  - Files: `src/lib/offline-queue.ts`, `src/app/api/ops/command/route.ts`
  - Verify: aynı çevrimdışı siparişi 5 kez replay et, başarısız paneli boş kalmalı
- [ ] **T4 (P1, human: ~2s / CC: ~15dk)** — security — `ingredient_movements` yazma yetkisini `reason`'a göre ayır
  - Surfaced by: Section 3 / bulgu 4A — kasiyer sahte alım ve sayım yazabiliyor
  - Files: `supabase/migrations/20260809_add_recipe_cost_and_ingredient_stock.sql`
  - Verify: kasiyer rolüyle `purchase` insert reddedilmeli, `sale_consumption` geçmeli
- [ ] **T5 (P1, human: ~3s / CC: ~20dk)** — stock — sayım zaman damgası + ara hareket mahsubu
  - Surfaced by: Section 4 / bulgu 5A — sayım sırasındaki satışlar iki kez sayılıyor
  - Files: `src/lib/data.ts`
  - Verify: sayım açıkken satış yap, fark sıfır çıkmalı
- [ ] **T6 (P1, human: ~1g / CC: ~30dk)** — test — yerel Postgres + 5 kritik entegrasyon testi
  - Surfaced by: Section 6 / bulgu 6B — RLS ve idempotans doğrulanamıyor, migration'lar hiç çalıştırılmadı
  - Files: `supabase/migrations/20260809_add_recipe_cost_and_ingredient_stock.sql`
  - Verify: `supabase start` + `npm test`
- [ ] **T10 (P1, human: ~1g / CC: ~25dk)** — stock — alım girişi + `purchase` hareketi + hareketli ortalama maliyet
  - Surfaced by: Karar D3.1 — alım olmadan stok tek yönlü azalır
  - Files: `src/app/admin/stock`
  - Verify: iki farklı fiyattan alım gir, ortalama maliyet ağırlıklı çıkmalı
- [ ] **T11 (P1, human: ~1g / CC: ~25dk)** — report — sayım ekranı + teorik-gerçek fark raporu
  - Surfaced by: Karar D3.2 — altyapının patrona dönük tek çıktısı
  - Files: `src/app/admin/reports`
  - Verify: bilinen tüketim + bilinen sayım, fark elle hesapla ve karşılaştır
- [ ] **T7 (P2, human: ~30dk / CC: ~5dk)** — deploy — migration kapanış sonrası, parti işleme TODOS'a
  - Surfaced by: Section 9 / bulgu 7A — tablo geneli yazma mesai saatinde kilitler
  - Files: migration, `TODOS.md`
  - Verify: TODOS maddesi yazıldı mı
- [ ] **T8 (P2, human: ~2s / CC: ~10dk)** — ui — "maliyet eksik" rozeti Recipe Studio + rapor üstü, kasada yok
  - Surfaced by: Section 11 / bulgu 8A + karar D3.3
  - Files: `src/app/admin/products/page.tsx`
  - Verify: reçetesiz ürün rozetli, kasa ekranı temiz
- [ ] **T12 (P2, human: ~4s / CC: ~20dk)** — ops — düşük stok uyarısı + gün kapsama, mevcut alert dispatch'e bağla
  - Surfaced by: Karar D3.4 + Section 8 — `ALERT_WEBHOOK_URL` altyapısı zaten var
  - Files: `scripts/dispatch-ops-alert.mjs`
  - Verify: `min_quantity` altına düşür, webhook tetiklenmeli
- [ ] **T13 (P2, human: ~1s / CC: ~10dk)** — docs — migration başına ASCII reçete zinciri diyagramı
  - Surfaced by: Section 10 — beş halkalı zincir diyagramsız anlaşılmaz
  - Files: `PLAN-RECETE-MALIYET-STOK.md`, migration
  - Verify: diyagram beş halkayı da gösteriyor mu
- [ ] **T14 (P3, human: ~15dk / CC: ~5dk)** — docs — `TODOS.md` main'den bu dala getirilsin
  - Surfaced by: Sistem denetimi — `TODOS.md` bu dalda yok
  - Files: `TODOS.md`
  - Verify: dosya var ve ertelenen 2 madde (D3.5, D3.6) eklenmiş

_Section 5 (Kod kalitesi) ve Section 7 (Performans) yeni görev üretmedi — tek bulguları T9 ve T1 ile kapanıyor._

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | 6 öneri, 4 kabul, 2 ertelendi; 8 bulgu karara bağlandı |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** CEO CLEARED — kapsam ve strateji kararlaştırıldı. Eng review required (henüz çalışmadı). Dış ses çalışmadı: Codex kurulu değil, Claude alt ajanı oturum kuralı gereği kullanıcı onayı bekliyor.

**UNRESOLVED DECISIONS:**
- Dış ses (bağımsız ikinci model incelemesi) çalıştırılmadı — kullanıcı onayı bekliyor
