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
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG=default
ALERT_WEBHOOK_URL=...
ALERT_DISPATCH_SECRET=...
ALERT_DISPATCH_ENDPOINT=...
NEXT_PUBLIC_BUSINESS_NAME=Cloud POS Cafe
NEXT_PUBLIC_BUSINESS_PHONE=+90 555 000 00 00
NEXT_PUBLIC_BUSINESS_ADDRESS=Istanbul
NEXT_PUBLIC_RECEIPT_FOOTER=Afiyet olsun.
NEXT_PUBLIC_RECEIPT_LOGO_URL=...
NEXT_PUBLIC_VAT_RATE=10
```

3. Supabase SQL Editor veya migration ile su dosyalari sirasiyla calistirin:

- `supabase/migrations/20260227_initial_cloud_pos.sql`
- `supabase/migrations/20260227_add_order_items.sql`
- `supabase/migrations/20260227_add_profiles_and_roles.sql`
- `supabase/migrations/20260227_profile_trigger.sql`
- `supabase/migrations/20260227_add_ingredients.sql`
- `supabase/migrations/20260227_add_stock_movements.sql`
- `supabase/migrations/20260227_add_payments_and_sessions.sql`
- `supabase/migrations/20260227_add_audit_logs.sql`
- `supabase/migrations/20260227_add_table_requests.sql`
- `supabase/migrations/20260227_add_alert_dispatches.sql`
- `supabase/migrations/20260227_add_businesses_multi_tenant.sql`
- `supabase/migrations/20260227_add_business_scope_finance.sql`
- `supabase/migrations/20260228_add_sales_leads.sql`
- `supabase/migrations/20260228_add_site_content.sql`
- `supabase/migrations/20260228_add_app_settings.sql`
- `supabase/migrations/20260228_add_media_library.sql`
- `supabase/migrations/20260228_add_blog_posts.sql`
- `supabase/migrations/20260228_add_sales_lead_notes.sql`
- `supabase/migrations/20260228_add_order_channels.sql`
- `supabase/migrations/20260228_add_couriers.sql`
- `supabase/migrations/20260228_add_product_modifiers.sql`
- `supabase/migrations/20260228_add_studio_access.sql`
- `supabase/migrations/20260228_harden_studio_policies.sql`

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
- Studio erisimi env listesinden veya `studio_access_users` tablosundan verilebilir.
- Studio/backoffice tablolarinda dogrudan tenant admin erisimi kapatilmis, islem server-side service role akisi uzerine alinmistir.
- SQL migration dosyasinda RLS starter policy bulunur.
- Siparisler hem `orders.items` (geriye uyum) hem `order_items` (normalize raporlama) yapisina yazilir.
- Landing teklif formu SMTP ayarlari yapildiysa otomatik e-posta bildirimi gonderebilir.
- SEO ayarlari admin panelden guncellenir ve metadata uretilirken kullanilir.
- Leadler icin not gecmisi tutulabilir.

## Fazlar

- Faz 1 (tamamlandi): Temel POS akisi, masa durumu, masa yonetimi (ekle/sil), role/profile schema baslangici.
- Faz 2 (tamamlandi): Supabase Auth login + role-based sayfa/aksiyon yetkisi + rol yonetimi.
- Faz 3 (devam ediyor): Urun-kategori-stok admin CRUD (guncelleme dahil) + urun malzeme yonetimi + stok hareket logu.
- Faz 4 (tamamlandi): Realtime operasyon (panel, mutfak, kasa, masa ekranlarinda canli guncelleme + mutfakta yeni siparis sesi).
- Faz 5 (devam ediyor): Odeme akisi (nakit/kart/karma), indirim-servis ucreti, siparis iptal/iade, kasa acilis-kapanis.

## Not

- Coklu sube senaryosu bu projede bilincli olarak kapsam disi tutuldu.
- QR menu ekraninda `stock_count = 0` urunler otomatik gizlenir.
- Admin urun ekraninda kategori bazli toplu fiyat guncelleme vardir.
- Admin kategori ekraninda kategori sirasini yukari/asagi tasiyabilirsiniz.
- Satis raporu CSV export: `/api/reports/sales.csv?days=7`
- QR servis talebi API: `/api/table-requests`
- QR siparis durum API: `/api/orders/latest?qr=table-1`
- QR siparis gecmis API: `/api/orders/history?qr=table-1`
- Health API: `/api/health`
- Ops metrics API: `/api/metrics/ops`
- Ops alert dispatch API: `/api/alerts/dispatch` (`GET` preview, `POST` webhook send)
- Demo sunum akisi: `DEMO.md`

## Uretim Checklist

- Tum migration dosyalarini sirayla uygulayin.
- Supabase Realtime publication tablolari:
  - `orders`
  - `tables`
  - `payments`
  - `cash_register_sessions`
  - `table_requests`
- `.env.local` degiskenlerini eksiksiz girin.
- Rol atamalarini `/admin/roles` ekranindan tamamlayin.
- Vardiya basinda `/cashier/session` ekranindan kasa acilisi yapin.
- Uptime izleme aracina `/api/health` endpointini baglayin.
- Alert webhook icin:
  - `.env.local`: `ALERT_WEBHOOK_URL`, `ALERT_DISPATCH_SECRET`
  - Cron: `POST /api/alerts/dispatch` + `x-alert-secret` header
  - Cooldown: 10 dakika
  - Lokal manuel tetikleme: `npm run alerts:dispatch`
