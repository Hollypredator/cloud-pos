# Staging UAT Template

## Scope
- UAT ortam URL: `https://cloud-q9dpillgb-hollypredators-projects.vercel.app`
- Test tarihi: `2026-03-11`
- Tester: `Cloud POS Engineering`

## Kritik Senaryolar
- [x] Login (admin/cashier/kitchen/waiter)
- [x] `/admin/orders` uzerinden sipariş acma
- [x] `/kitchen` durum gecisi (`pending -> preparing -> served`)
- [x] `/cashier` tahsilat, iade ve adisyon kapanış
- [x] `/cashier/session` gun basi / gün sonu
- [x] `/admin/tables` masa ekleme/güncelle/silme/taşıma
- [x] `/service-requests` talep oluşturma ve cozme
- [x] `/api/health` ve `npm run ops:smoke`

## Sonuç
- [x] UAT passed
- [ ] UAT blocked (detaylari issue olarak ac)
