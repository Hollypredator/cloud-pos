# Cloud POS & QR Ordering

Web tabanli, Supabase destekli POS baslangic projesi.

## Teknoloji

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Supabase (PostgreSQL + RLS)

## Kurulum

1. Bagimliliklari yukleyin:

```bash
npm install
```

2. `.env.example` dosyasini `.env.local` olarak kopyalayin ve doldurun:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
PLATFORM_OWNER_EMAILS=owner@example.com
STUDIO_ADMIN_EMAILS=admin@example.com
APP_HOST=
STUDIO_HOST=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG=default
ALERT_WEBHOOK_URL=...
ALERT_DISPATCH_SECRET=...
ALERT_DISPATCH_ENDPOINT=...
AUTO_SESSION_CLOSE_SECRET=...
AUTO_SESSION_CLOSE_ENDPOINT=...
AUTO_SESSION_CLOSE_TZ=Europe/Istanbul
QR_ACCESS_SECRET=...
NEXT_PUBLIC_BUSINESS_NAME=Cloud POS Cafe
NEXT_PUBLIC_BUSINESS_PHONE=+90 555 000 00 00
NEXT_PUBLIC_BUSINESS_ADDRESS=Istanbul
NEXT_PUBLIC_RECEIPT_FOOTER=Afiyet olsun.
NEXT_PUBLIC_RECEIPT_LOGO_URL=...
NEXT_PUBLIC_VAT_RATE=10
NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES=false
NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER=false
PERF_REQUIRE_AUTH_BASELINE=false
PERF_ALLOW_LOCAL_AUTH_BASELINE=false
PERF_AUTH_COOKIE=
VERCEL_PROTECTION_BYPASS=
```

3. Supabase schema kurulumunda iki yol var:

- Yeni bir ortam aciyorsaniz: once `supabase/baseline/20260316_baseline.sql`, sonra sadece bu tarihten yeni migration'lari calistirin.
- Mevcut (canli/staging) ortamlarda: `supabase/migrations` altina eklenen yeni dosyalari sirayla calistirmaya devam edin.
- Baseline dosyasini guncellemek icin:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-supabase-baseline.ps1 -OutputPath supabase/baseline/20260316_baseline.sql`
- Detayli strateji: `docs/migration-strategy.md`

4. Gelistirme sunucusunu baslatin:

```bash
npm run dev
```

## Rotalar

- `/` -> Tanitim / landing sayfasi
- `/demo` -> Herkese acik demo operasyon onizlemesi
- `/blog` -> Public blog ve duyuru sayfasi
- `/ops` -> Giris gerektiren operasyon paneli
- `/qr/table-1` -> Musteri QR siparis ekrani
- `/{businessSlug}/qr/table-1` -> Tenant bazli QR siparis (onerilen)
- `/kitchen` -> Mutfak kuyrugu (pending/preparing)
- `/cashier` -> Kasa (served -> paid)
- `/cashier/session` -> Kasa acilis/kapanis
- `/delivery` -> Delivery dispatch ve kurye yonetimi
- `/service-requests` -> QR'dan gelen garson/hesap talepleri
- `/receipt/[orderId]` -> Paylasilabilir adisyon sayfasi
- `/tables` -> Masa durumlari
- `/login` -> Personel giris
- `/unauthorized` -> Yetki hatasi
- `/admin/tables` -> Masa ekle/sil + QR onizleme
- `/admin/businesses` -> Isletme yonetimi (tenant)
- `/admin/orders` -> Masa / gel-al / paket servis siparis girisi
- `/admin/products` -> Urun kartlari + urun/malzeme yonetimi
- `/admin/categories` -> Kategori yonetimi
- `/admin/roles` -> Kullanici rol yonetimi
- `/admin/stock` -> Stok hareket loglari
- `/admin/audit` -> Islem audit kayitlari
- `/admin/reports` -> Satis raporlari + CSV export
- `/admin/finance` -> Detayli finans paneli (kirilim, saatlik, top urunler, islemler)
- `/admin/leads` -> Legacy redirect, backoffice icin `/studio/leads` kullanin
- `/admin/content` -> Legacy redirect, backoffice icin `/studio/content` kullanin
- `/admin/settings` -> Legacy redirect, backoffice icin `/studio/settings` kullanin
- `/admin/seo` -> Legacy redirect, backoffice icin `/studio/seo` kullanin
- `/admin/media` -> Legacy redirect, backoffice icin `/studio/media` kullanin
- `/admin/blog` -> Legacy redirect, backoffice icin `/studio/blog` kullanin
- `/admin/onboarding` -> Legacy redirect, backoffice icin `/studio/onboarding` kullanin
- `/studio/content` -> Ic backoffice landing icerik yonetimi
- `/studio/settings` -> Ic backoffice genel ve SMTP ayarlari
- `/studio/seo` -> Ic backoffice SEO ayarlari
- `/studio/media` -> Ic backoffice medya kutuphanesi
- `/studio/blog` -> Ic backoffice blog/duyuru yonetimi
- `/studio/leads` -> Ic backoffice CRM ve lead notlari
- `/studio/access` -> Ic backoffice kullanici erisimi yonetimi
- `/studio/onboarding` -> Ic backoffice kurulum wizard'i
- `/studio/login` -> Ic backoffice icin ayri giris ekrani

## Notlar

- Supabase env degerleri yoksa uygulama demo veri ile calisir.
- `STUDIO_ADMIN_EMAILS` icine backoffice kullanacak dahili e-postalari virgulle ayirarak girin.
- `APP_HOST` ve `STUDIO_HOST` ile ileride `app.domain.com` / `studio.domain.com` ayrimini aktif edebilirsiniz.
- Mail gonderiminde oncelik `RESEND_API_KEY` + `RESEND_FROM_EMAIL`; tanimli degilse paneldeki SMTP ayarlari kullanilir.
- Studio erisimi env listesinden veya `studio_access_users` tablosundan verilebilir.
- Studio/backoffice tablolarinda dogrudan tenant admin erisimi kapatilmis, islem server-side service role akisi uzerine alinmistir.
- Musteri operasyon yuzeyi ile studio/backoffice bilincli olarak ayridir:
  - public/studio: web
  - musteri operasyonu: web tabanli uygulama, ileride hybrid mobile shell icin uygun
- Coklu sube senaryosu desteklenir. Branch secimi cookie + `staff_branch_access` + RLS ile scope edilir.
- `owner` ve `admin` ayni yetki seviyesi degildir; owner isletme ve personel yapisini yonetir, admin operasyonel yonetim alanlarina erisir.
- SQL migration dosyasinda RLS starter policy bulunur.
- Siparisler hem `orders.items` (geriye uyum) hem `order_items` (normalize raporlama) yapisina yazilir.
- Landing teklif formu SMTP ayarlari yapildiysa otomatik e-posta bildirimi gonderebilir.
- SEO ayarlari admin panelden guncellenir ve metadata uretilirken kullanilir.
- Leadler icin not gecmisi tutulabilir.

## Fazlar

- Faz 1 (tamamlandi): Stabilization ve kapsam dondurma.
- Faz 2 (tamamlandi): Yetki ve veri guvenligi sertlestirme.
- Faz 3 (tamamlandi): POS'suz odeme akisi saglamlastirma.
- Faz 4 (tamamlandi): Finans dogrulugu ve mutabakat.
- Faz 5 (tamamlandi): Dayaniklilik ve hata yonetimi.
- Faz 6 (tamamlandi): Operasyonel gozlemlenebilirlik ve support.
- Faz 7 (tamamlandi): Staging UAT ve pilot hazirlik.
- Faz 8 (tamamlandi - engineering): POS'suz pilot canliya gecis release gate.

## Operasyon Notlari

- Coklu sube yapisinda masa, siparis, kurye, odeme ve personel erisimi branch scope ile sinirlanir.
- QR menu ekraninda `stock_count = 0` urunler otomatik gizlenir.
- Admin urun ekraninda kategori bazli toplu fiyat guncelleme vardir.
- Admin kategori ekraninda kategori sirasini yukari/asagi tasiyabilirsiniz.
- Satis raporu CSV export: `/api/reports/sales.csv?days=7`
- QR servis talebi API: `/api/table-requests`
- QR siparis durum API: `/api/orders/latest?qr=table-1&b=default&t=<qr-access-token>`
- QR siparis gecmis API: `/api/orders/history?qr=table-1&b=default&t=<qr-access-token>`
- Ops command API: `/api/ops/command`
- Sync lock API: `/api/sync/lock`
- Sync push API: `/api/sync/push`
- Sync pull API: `/api/sync/pull`
- Health API: `/api/health`
- Ops metrics API: `/api/metrics/ops`
- Ops alert dispatch API: `/api/alerts/dispatch` (`GET` preview, `POST` webhook send)
- Otomatik gun sonu cron API: `/api/cashier/session/auto-close` (`GET` dry-run, `POST` execute)
- Demo sunum akisi: `DEMO.md`

## Uretim Checklist

Detayli checklist ve incident proseduru:
- `docs/go-live-checklist.md`
- `docs/incident-runbook.md`
- `docs/productization-8-phases.md`
- `docs/phases/phase-1-stabilization.md`
- `docs/phases/phase-2-security-hardening.md`
- `docs/phases/phase-3-payment-hardening.md`
- `docs/phases/phase-4-financial-reconciliation.md`
- `docs/phases/phase-5-resilience-and-error-management.md`
- `docs/phases/phase-6-observability-and-support.md`
- `docs/phases/phase-7-staging-uat-and-pilot-prep.md`
- `docs/phases/phase-8-posless-pilot-go-live.md`
- `docs/finance-uat-checklist.md`
- `docs/commercial-product-pack.md`
- `docs/presentation-cloud-pos.md`

- Yeni kurulumlarda `supabase/baseline/20260316_baseline.sql` + sonraki delta migration modelini kullanin.
- Mevcut ortamlarda eski migration dosyalarini silmeyin/yeniden adlandirmayin; sadece yeni migration ekleyin.
- `branches`, `staff_branch_access`, `owner` role ve core RLS migrationlarini atlamayin.
- Supabase Realtime publication tablolari:
  - `orders`
  - `tables`
  - `payments`
  - `cash_register_sessions`
  - `table_requests`
- `.env.local` degiskenlerini eksiksiz girin.
- Vercel kullaniyorsan ayni env degerlerini Project Settings > Environment Variables altina da girin.
- Rol atamalarini `/admin/roles` ekranindan tamamlayin.
- Studio erisimi icin:
  - `STUDIO_ADMIN_EMAILS`
  - veya `studio_access_users`
  ayarlarindan en az birini tanimlayin.
- Vardiya basinda `/cashier/session` ekranindan kasa acilisi yapin.
- Uptime izleme aracina `/api/health` endpointini baglayin.
- Alert webhook icin:
  - `.env.local`: `ALERT_WEBHOOK_URL`, `ALERT_DISPATCH_SECRET`
  - Cron: `POST /api/alerts/dispatch` + `x-alert-secret` header
  - Cooldown: 10 dakika
  - Lokal manuel tetikleme: `npm run alerts:dispatch`
- Otomatik gun sonu cron icin:
  - `.env.local`: `AUTO_SESSION_CLOSE_SECRET` (opsiyonel: `AUTO_SESSION_CLOSE_ENDPOINT`, `AUTO_SESSION_CLOSE_TZ`)
  - Cron: `POST /api/cashier/session/auto-close` + `x-auto-close-secret` header
  - Lokal manuel tetikleme: `npm run sessions:auto-close`
- Operasyon smoke-check: `npm run ops:smoke`
- Perf SLA check: `npm run perf:sla` (API avg<=200ms, operation avg<=500ms hedefleri)
- Queue staging rollout runbook: `docs/staging-queue-rollout.md`
- Rollout preflight: `npm run rollout:preflight`
- Wave-1 (Tables) smoke gate: `npm run rollout:wave:tables`
- Wave-2 (Cashier) smoke gate: `npm run rollout:wave:cashier`
- Auth perf baseline gate: `npm run rollout:perf:auth`
- Tenant runtime isolation check: `npm run phase2:runtime` (uygulama ayakta olmali)
- Faz 3 finans runtime kontrolu: `npm run phase3:runtime` (Supabase env gerekli)
- Faz 4 mutabakat kontrolu: `npm run phase4:reconciliation` (Supabase env gerekli)
- Faz 5 durum tutarlilik kontrolu: `npm run phase5:consistency` (Supabase env gerekli)
- Faz 6 observability kontrolu: `npm run phase6:observability`
- Faz 7 UAT gate kontrolu: `npm run phase7:uat`
- Faz 8 pilot readiness kontrolu: `npm run phase8:pilot`
- QR public API korumasi icin `.env.local` icinde `QR_ACCESS_SECRET` tanimli olmali.
