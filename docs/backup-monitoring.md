# Backup & Monitoring Baseline

## Backup
- PostgreSQL icin gunluk otomatik yedek aktif olmali.
- RPO hedefi: <= 24 saat.
- RTO hedefi: <= 2 saat.
- Her ay en az 1 restore testi yap.

## Monitoring
- Uptime monitor:
  - endpoint: `/api/health`
  - interval: 1 dakika
  - timeout: 10 sn
- Alert dispatch cron:
  - endpoint: `POST /api/alerts/dispatch`
  - header: `x-alert-secret: $ALERT_DISPATCH_SECRET`
  - interval: 5 dakika
- Lokal smoke:
  - `npm run ops:smoke`

## Incident Escalation
- `sev-1`: aninda telefon/war-room
- `sev-2`: 15 dakika icinde owner bilgilendirme
- `sev-3`: mesai icinde backlog

