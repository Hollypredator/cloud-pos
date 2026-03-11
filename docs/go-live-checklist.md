# Go-Live Checklist

## Security
- [x] `POST /api/orders` endpointinde rol bazli zorunlu yetki kontrolu aktif.
- [x] QR public API (`/api/orders/latest`, `/api/orders/history`, `/api/table-requests`) icin imzali erisim tokeni aktif.
- [x] API rate limit middleware aktif.
- [x] Guvenlik header'lari sertlestirildi (`CSP`, `HSTS`, `Permissions-Policy`, `X-Frame-Options` vb.).

## Release Gate
- [x] CI quality gate eklendi (`typecheck`, `lint`, `build`).
- [x] Lokal `typecheck` komutu eklendi.

## Ops Readiness
- [x] Incident runbook dokumani eklendi.
- [x] Staging UAT template dokumani eklendi.
- [x] Backup/monitoring baseline dokumani eklendi.
- [x] Operasyon smoke-check scripti eklendi (`npm run ops:smoke`).
- [x] Staging UAT tamamlandi ve imzali onay alindi.
- [x] Veritabani yedekleme politikasi production ortaminda aktif.
- [x] Uptime monitoru `/api/health` endpointine baglandi.
- [x] Alert dispatch cron gorevi production'da aktif edildi (`POST /api/alerts/dispatch` + `x-alert-secret`).

## Notes
- Ops otomasyonu GitHub Actions schedule ile yönetilir: `.github/workflows/ops-monitoring.yml`
