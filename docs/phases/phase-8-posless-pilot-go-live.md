# Faz 8 - POS'suz Pilot Canliya Gecis

Durum: `completed (engineering)`  
Baslangic tarihi: `2026-03-11`  
Hedef bitis: `1 hafta`

## Hedef
- Cihaz entegrasyonu olmadan pilot acilis icin teknik release gate'i kapatmak.
- Canliya gecis oncesi kontrol listesi sapmalarini erken yakalamak.

## P0 Gorevleri
1. Pilot checklist drift kontrolu
2. Faz 7 ciktilarinin Faz 8 giris kriterine baglanmasi
3. CI ile pilot readiness kontrolu

## Bu Fazda Yapilanlar
- [x] Faz 8 readiness scripti eklendi: `npm run phase8:pilot`.
- [x] `docs/go-live-checklist.md` icinde sadece operasyonel olarak manuel kapanacak maddeler whitelist'e baglandi.
- [x] CI quality gate'e Faz 8 readiness kontrolu eklendi.
- [x] Productization ana durum dokumani Faz 8 engineering tamamlandi seklinde guncellendi.

## Acik Kalanlar
- [ ] Pilot subede kritik incident olmadan 7-14 gun operasyonel izleme (canli operasyon adimi)
- [ ] KPI/ciro/mutabakat hedeflerinin saha onayi (isletme adimi)
