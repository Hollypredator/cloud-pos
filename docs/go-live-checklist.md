# Go-Live Checklist

## Security
- [x] `POST /api/orders` endpointinde rol bazlı zorunlu yetki kontrolü aktif.
- [x] QR public API (`/api/orders/latest`, `/api/orders/history`, `/api/table-requests`) için imzalı erişim tokeni aktif.
- [x] API rate limit middleware aktif.
- [x] Güvenlik header'lari sertlestirildi (`CSP`, `HSTS`, `Permissions-Policy`, `X-Frame-Options` vb.).

## Release Gate
- [x] CI quality gate eklendi (`typecheck`, `lint`, `build`).
- [x] Lokal `typecheck` komutu eklendi.
- [x] Perf SLA gate aktif (`npm run perf:sla`, API `<200ms`, operasyon `<500ms`).

## Ops Readiness
- [x] Incident runbook dokümanı eklendi.
- [x] Staging UAT template dokümanı eklendi.
- [x] Backup/monitoring baseline dokümanı eklendi.
- [x] Operasyon smoke-check scripti eklendi (`npm run ops:smoke`).
- [x] Staging UAT tamamlandı ve imzalı onay alındı.
- [x] Veritabani yedekleme politikasi production ortaminda aktif.
- [x] Uptime monitoru `/api/health` endpointine baglandi.
- [x] Alert dispatch cron gorevi production'da aktif edildi (`POST /api/alerts/dispatch` + `x-alert-secret`).
- [ ] Otomatik gun sonu cron gorevi production'da aktif (`POST /api/cashier/session/auto-close` + `x-auto-close-secret`).

## Notes
- Ops otomasyonu GitHub Actions schedule ile yönetilir: `.github/workflows/ops-monitoring.yml`
