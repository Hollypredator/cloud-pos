# Staging UAT Template

## Scope
- UAT ortam URL:
- Test tarihi:
- Tester:

## Kritik Senaryolar
- [ ] Login (admin/cashier/kitchen/waiter)
- [ ] `/admin/orders` uzerinden siparis acma
- [ ] `/kitchen` durum gecisi (`pending -> preparing -> served`)
- [ ] `/cashier` tahsilat, iade ve adisyon kapanis
- [ ] `/cashier/session` gun basi / gun sonu
- [ ] `/admin/tables` masa ekleme/guncelle/silme/tasima
- [ ] `/service-requests` talep olusturma ve cozme
- [ ] `/api/health` ve `npm run ops:smoke`

## Sonuc
- [ ] UAT passed
- [ ] UAT blocked (detaylari issue olarak ac)

