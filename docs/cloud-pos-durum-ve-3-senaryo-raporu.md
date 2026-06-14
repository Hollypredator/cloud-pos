# Cloud POS Durum + 3 Geliştirme Senaryosu Raporu (Süre/Maliyet Dahil)

Rapor tarihi: 22 Mart 2026  
Para modeli: USD + TRY hibrit  
TRY çevirim formülü: `TRY = USD x rapor-gunu-kuru`  
Bu rapordaki TRY örnekleri için referans kur: `1 USD = 38.00 TRY` (örnek hesap; finansal tavsiye değildir)

## 1) Yönetici Özeti

- Mevcut Cloud POS, web tabanlı operasyon ürünü olarak teknik olarak olgun bir seviyede: QR sipariş, mutfak, kasa, masa, kurye, servis talebi, rapor/finans, rol ve tenant izolasyonu, operasyonel izleme ve rollout runbook'ları mevcut.
- Ürün durumu dokümanlara göre: Faz 1-8 engineering tamam, operasyonel pilot onayı akışında.
- Sıfırdan benzer ürün geliştirme için en hızlı ticari yol web-first modeldir (20-28 hafta).
- Desktop + local DB modelinde saha dayanıklılığı artar; ancak sync/conflict ve cihaz operasyonu nedeniyle süre/maliyet artar (28-40 hafta).
- TR Yeni Nesil OKC hedefli market POS modeli en yüksek etkiyi verir ama mevzuat/sertifikasyon ve entegrasyon bağımlılıkları nedeniyle en uzun ve en maliyetli yoldur (36-52 hafta).

## 2) Mevcut Sistem Envanteri (Repo Temelli)

### 2.1 Ürün Modülleri

- Operasyon:
  - Masa yönetimi ve masa durumu (`/tables`)
  - Mutfak kuyruğu (`/kitchen`)
  - Kasa/tahsilat/iade/adisyon (`/cashier`, `/cashier/session`)
  - Teslimat/kurye (`/delivery`)
  - Servis talepleri (`/service-requests`)
  - QR sipariş akışları (`/qr/*`, `/{businessSlug}/qr/*`)
- Yönetim:
  - Ürün, kategori, stok, rol, şube yönetimi (`/admin/*`)
  - Finans/rapor/audit (`/admin/finance`, `/admin/reports`, `/admin/audit`)
  - Studio/backoffice içerik-ayar-medya-blog akışları (`/studio/*`)
- Support:
  - Ticket, incident, tenant, billing ve feature-flag support yüzeyi (`/support/*`)

### 2.2 Teknik Mimari ve Veri Akışı

- Frontend/Backend: Next.js App Router + React + TypeScript.
- Veri katmanı: Supabase (PostgreSQL + auth + RLS tabanlı izolasyon).
- Ana write gateway: `POST /api/ops/command`.
- Sync altyapısı: `lock/push/pull` API + branch lock + event stream + command attempt tabloları.
- Client queue altyapısı:
  - Zustand persisted queue store (`localStorage`)
  - TanStack Query invalidation ve snapshot key'leri
  - Idempotency key ile dedupe/retry/backoff
- Realtime + fallback:
  - Realtime eventleri + POLL fallback ile route refresh zinciri.

### 2.3 Public API Sözleşmeleri (Aktif)

- İşlem ve operasyon:
  - `POST /api/ops/command`
  - `POST /api/orders`
  - `POST /api/table-requests`
- Sync:
  - `POST /api/sync/lock`
  - `POST /api/sync/push`
  - `GET|POST /api/sync/pull`
- Gözlemlenebilirlik:
  - `GET /api/health`
  - `GET /api/metrics/ops`
  - `POST /api/alerts/dispatch`
  - `POST /api/cashier/session/auto-close`

### 2.4 Güvenlik, Dayanıklılık, Operasyonel Hazırlık

- Middleware:
  - Rate limit kuralları (özel endpoint bazlı)
  - Seçurity headers (CSP, HSTS, X-Frame-Options, vb.)
  - Correlation id propagation
  - Legacy mobile redirect (`/m -> /ops`, `/m/* -> /*`)
- Domain dayanıklılığı:
  - Idempotent ödeme/komut akışları
  - Retry/reconciliation kontrolleri
  - Ops command result durumları (`ACK/RETRY/REJECT/CONFLICT`)
- Operasyon runbook ve gate:
  - `ops:smoke`, `perf:sla`, rollout preflight/wave/perf komutları
  - Incident runbook + go-live checklist + phase gate dokümanları

### 2.5 Mevcut Durum Notları

- Desktop runtime tarafı aktif kod tabanında yok; desktop ile ilişkili uygulama kodu kaldırılmış durumda.
- `package-lock` içinde `electron-to-chromium` transitive bağımlılık izi var; runtime capability anlamına gelmez.
- Queue feature flag varsayılanları README/.env örneğine göre kapalı:
  - `NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES=false`
  - `NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER=false`

## 3) Senaryo-1: Sıfırdan Web-First Cloud POS

### 3.1 Faz Planı ve Süre

| Faz | İçerik | Süre |
|---|---|---|
| F1 | Keşif, ürün sınırları, domain model, UX akışları | 3-4 hafta |
| F2 | Sipariş/masa/mutfak/kasa çekirdeği + temel API | 7-9 hafta |
| F3 | Rol/tenant/branch izolasyonu + güvenlik hardening | 3-4 hafta |
| F4 | Finans, rapor, audit, observability, runbook | 4-5 hafta |
| F5 | Staging UAT, pilot, performans iyileştirme | 3-6 hafta |
|  | **Toplam** | **20-28 hafta** |

### 3.2 Ekip ve Maliyet

- Ekip (MVP Çekirdek):
  - 1 Full-stack Engineer
  - 1 Backend Engineer
  - Part-time QA
  - Part-time PM
- Maliyet modeli (CAPEX):
  - Blended team burn: `27k - 39k USD/ay`
  - Tahmini proje süresi: `5 - 7 ay`
  - Hesap: `5x27k` ile `7x39k`
  - Sonuç: **USD 135k - 272k**
  - TRY örnek: **TRY 5.13M - 10.34M**
- OPEX (aylık):
  - **USD 4k - 12k/ay**
  - TRY örnek: **TRY 152k - 456k/ay**

### 3.3 Kritik Riskler ve Geçiş Adımları

- Kritik bloklayıcılar:
  - Erken fazda zayıf tenant izolasyonu
  - Finans tutarlılığında geç fark edilen açıklar
  - Pilotta gerçek operasyon yükünde performans sapması
- Başarı kriterleri:
  - Ops smoke + finance UAT + auth perf gate yeşil
  - Gün sonu mutabakat farkı kabul edilen eşik altında
- Go-live gate:
  - `typecheck/lint/build`, `ops:smoke`, `perf:sla`, staging UAT imzası

## 4) Senaryo-2: Desktop + Local DB (Offline-First)

### 4.1 Faz Planı ve Süre

| Faz | İçerik | Süre |
|---|---|---|
| F1 | Web core + domain parity planı | 4-5 hafta |
| F2 | Desktop shell + local DB model + migration stratejisi | 6-8 hafta |
| F3 | Sync engine (lock, push/pull, conflict policy, retries) | 8-10 hafta |
| F4 | Cihaz lifecycle (update, crash recovery, log collection) | 4-6 hafta |
| F5 | Saha UAT, offline/dayanıklılık testleri, pilot rollout | 6-11 hafta |
|  | **Toplam** | **28-40 hafta** |

### 4.2 Ekip ve Maliyet

- Ekip (MVP Çekirdek + offline/sync ağırlık):
  - 1 Full-stack (desktop/web)
  - 1 Backend/Sync Engineer
  - Part-time QA (offline/regression odaklı)
  - Part-time PM
- Maliyet (CAPEX):
  - Blended burn: `26k - 34k USD/ay`
  - Süre: `7 - 10 ay`
  - Hesap: `7x26k` ile `10x34k`
  - Sonuç: **USD 180k - 340k**
  - TRY örnek: **TRY 6.84M - 12.92M**
- OPEX (aylık):
  - **USD 6k - 18k/ay**
  - TRY örnek: **TRY 228k - 684k/ay**

### 4.3 Kritik Riskler ve Geçiş Adımları

- Kritik bloklayıcılar:
  - Conflict resolution tasarımının geç olgunlaşması
  - Cihazlar arası sürüm uyumsuzluğu
  - Saha update ve rollback operasyonu
- Başarı kriterleri:
  - Offline modda işlem devam + online dönüşte veri tutarlılığı
  - Duplicate/yarım-işlem olmaması
- Go-live gate:
  - Cihaz bazlı soak test, sync tutarlılık testi, rollback tatbikatı

## 5) Senaryo-3: Market Tipi TR Yeni Nesil OKC POS

### 5.1 Faz Planı ve Süre

| Faz | İçerik | Süre |
|---|---|---|
| F1 | Mevzuat analizi, cihaz/protokol seçimi, entegratör planı | 5-7 hafta |
| F2 | Ödeme/fiscal integration gateway + adaptör mimarisi | 8-10 hafta |
| F3 | Satış/iptal/iade/provizyon + mutabakat + hata haritaları | 8-11 hafta |
| F4 | Sertifikasyon/UAT, denetim hazırlığı, dokümantasyon | 7-10 hafta |
| F5 | Saha pilotu (market operasyonu), support ve rollout runbook | 8-14 hafta |
|  | **Toplam** | **36-52 hafta** |

### 5.2 Ekip ve Maliyet

- Ekip (MVP Çekirdek + reg/entegrasyon ağırlık):
  - 1 Full-stack POS/Frontend
  - 1 Backend/Payment Integration
  - Part-time QA (sertifikasyon test odaklı)
  - Part-time PM
  - Dönemsel reg/entegrasyon danışmanlığı (harici)
- Maliyet (CAPEX):
  - Blended burn: `31k - 43k USD/ay`
  - Süre: `9 - 13 ay`
  - Hesap: `9x31k` ile `13x43k`
  - Sonuç: **USD 280k - 560k**
  - TRY örnek: **TRY 10.64M - 21.28M**
- OPEX (aylık):
  - **USD 10k - 30k/ay**
  - TRY örnek: **TRY 380k - 1.14M/ay**

### 5.3 Kritik Riskler ve Geçiş Adımları

- Kritik bloklayıcılar:
  - Sertifikasyon/entegratör bağımlılıkları
  - Cihaz firmware/protokol değişimi
  - Saha kurulumunda donanım ve operasyon koordinasyonu
- Başarı kriterleri:
  - Mali uyum + ödeme tutarlılığı + saha istikrar KPI'ları
- Go-live gate:
  - Sertifikasyon tamamlanması, pilot markette incident hedeflerinin sağlanması

## 6) Tek Bakışta Karşılaştırma

| Kriter | Senaryo-1 Web-first | Senaryo-2 Desktop + Local DB | Senaryo-3 TR Yeni Nesil OKC |
|---|---|---|---|
| Süre | 20-28 hafta | 28-40 hafta | 36-52 hafta |
| CAPEX | USD 135k-272k | USD 180k-340k | USD 280k-560k |
| OPEX/ay | USD 4k-12k | USD 6k-18k | USD 10k-30k |
| Operasyon Riski | Orta | Orta-Yüksek | Yüksek |
| Teknik Karmaşıklık | Orta | Yüksek (sync/offline) | Çok Yüksek (reg+entegrasyon) |
| Ölçeklenebilirlik | Yüksek (web SaaS) | Yüksek ama cihaz-yönetimi ağır | Yüksek ama mevzuat bağımlı |
| Önerilen Kullanım | Hızlı ticari çıkış | Zayıf internet/saha ağır ortamlarda | Zincir market/fiscal zorunlu ortam |

## 7) Duyarlılık Analizi (+/-20%)

### 7.1 CAPEX Duyarlılık (USD)

| Senaryo | Baz Band | -20% / +20% Band |
|---|---|---|
| Web-first | 135k-272k | 108k-326.4k |
| Desktop + Local DB | 180k-340k | 144k-408k |
| TR Yeni Nesil OKC | 280k-560k | 224k-672k |

### 7.2 OPEX Duyarlılık (USD/ay)

| Senaryo | Baz Band | -20% / +20% Band |
|---|---|---|
| Web-first | 4k-12k | 3.2k-14.4k |
| Desktop + Local DB | 6k-18k | 4.8k-21.6k |
| TR Yeni Nesil OKC | 10k-30k | 8k-36k |

## 8) Karar Matrisi (Kısa/Orta/Uzun Vade)

- Kısa vade (0-6 ay) en güvenli yol:
  - **Web-first** ile operasyon KPI ve gelir doğrulaması.
- Orta vade (6-18 ay) genişleme:
  - Saha ihtiyacına göre **desktop/local DB** parçalı devreye alma.
- Uzun vade (12+ ay) kurumsal zincir hedef:
  - **TR Yeni Nesil OKC** entegrasyon programı (sertifikasyon takvimiyle).

## 9) Dahil / Hariç Kapsam

### Dahil

- Teknik envanter, API sözleşmeleri, seçurity/dayanıklılık resmi
- 3 senaryo için süre, ekip, CAPEX/OPEX, risk, go-live gate
- USD+TRY hibrit maliyet modeli ve duyarlılık analizi

### Hariç

- Cihaz marka/model bazlı kesin entegratör teklifleri
- Banka/ödeme kurumu özel ticari komisyon sözleşmeleri
- Donanım satın alma kesin fiyat listesi
- Vergi/harç/sertifikasyon resmi bedellerinin bağlayıcı tahmini

## 10) Kaynaklar (Repo İçinden)

- `README.md`
- `docs/commercial-product-pack.md`
- `docs/productization-8-phases.md`
- `docs/staging-queue-rollout.md`
- `docs/go-live-checklist.md`
- `docs/incident-runbook.md`
- `docs/backup-monitoring.md`
- `src/app/api/*`
- `src/lib/pos/queue/*`
- `middleware.ts`
- `supabase/migrations/20260321_add_ops_sync_locks_and_events.sql`
- `supabase/migrations/20260321_add_ops_aggregate_rpcs_and_indexes.sql`
- `supabase/migrations/20260322_fix_create_or_append_order_enum_casts.sql`
