# Staging UAT Template

## Scope
- UAT ortam URL: `https://cloud-q9dpillgb-hollypredators-projects.vercel.app`
- Test tarihi: `2026-03-11`
- Tester: `Cloud POS Engineering`

## Kritik Senaryolar
- [x] Login (admin/cashier/kitchen/waiter)
- [x] `/admin/orders` uzerinden siparis acma
- [x] `/kitchen` durum gecisi (`pending -> preparing -> served`)
- [x] `/cashier` tahsilat, iade ve adisyon kapanis
- [x] `/cashier/session` gun basi / gun sonu
- [x] `/admin/tables` masa ekleme/guncelle/silme/tasima
- [x] `/service-requests` talep olusturma ve cozme
- [x] `/api/health` ve `npm run ops:smoke`

## Sonuc
- [x] UAT passed
- [ ] UAT blocked (detaylari issue olarak ac)
