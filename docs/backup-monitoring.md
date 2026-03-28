# Backup & Monitoring Baseline

## Backup
- PostgreSQL için gunluk otomatik yedek aktif olmalı.
- RPO hedefi: <= 24 saat.
- RTO hedefi: <= 2 saat.
- Her ay en az 1 restore testi yap.
- Aktivasyon kaydı:
  - Ortam: `production`
  - Durum: `active`
  - Son dogrulama: `2026-03-11`
  - Sorumlu: `Cloud POS Engineering`

## Monitoring
- Uptime monitor:
  - endpoint: `/api/health`
  - interval: 1 dakika
  - timeout: 10 sn
- Alert dispatch cron:
  - endpoint: `POST /api/alerts/dispatch`
  - header: `x-alert-secret: $ALERT_DISPATCH_SECRET`
  - interval: 5 dakika
- Auto session close cron:
  - endpoint: `POST /api/cashier/session/auto-close`
  - header: `x-auto-close-secret: $AUTO_SESSION_CLOSE_SECRET`
  - interval: 5 dakika
- Perf SLA gate:
  - komut: `npm run perf:sla`
  - API hedefi: `avg <= 200ms`, `p95 <= 300ms`
  - Operasyon hedefi: `avg <= 500ms`, `p95 <= 700ms`
- Lokal smoke:
  - `npm run ops:smoke`
- Otomasyon:
  - GitHub Actions workflow: `.github/workflows/ops-monitoring.yml`
  - Health check: `*/5 * * * *`
  - Perf SLA gate: `*/5 * * * *`
  - Alert dispatch trigger: `*/5 * * * *`
  - Auto session close trigger: `*/5 * * * *`

## Incident Escalation
- `sev-1`: aninda telefon/war-room
- `sev-2`: 15 dakika içinde owner bilgilendirme
- `sev-3`: mesai içinde backlog
