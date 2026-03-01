# Demo Playbook

## Hedef

Bu dokuman, Cloud POS'u musteriye kisa ve temiz bir akisla gostermek icin hazirlandi.

## Acilacak Rotalar

- `/` -> Tanitim ve landing sayfasi
- `/demo` -> Herkese acik demo operasyon onizlemesi
- `/login` -> Personel giris ekrani
- `/ops` -> Gercek operasyon paneli
- `/admin/roles` -> Demo ekip hesaplarini tek tikla kurulum

## Hazir Demo Hesaplari

Bu hesaplari `/admin/roles` ekranindaki `Demo Ekip Kur` butonuyla olusturabilirsin.

| Rol | E-posta | Sifre | Kullanim |
|---|---|---|---|
| admin | `demo-admin@cloudpos.local` | `Demo123!` | Tum yonetim ve kurulum akisi |
| cashier | `demo-kasa@cloudpos.local` | `Demo123!` | Odeme ve vardiya akisi |
| kitchen | `demo-mutfak@cloudpos.local` | `Demo123!` | Mutfak kuyrugu ve hazirlama |
| waiter | `demo-servis@cloudpos.local` | `Demo123!` | Masa talepleri ve servis operasyonu |

## Onerilen Sunum Akisi

1. Landing sayfasindan urunun neyi cozdgunu anlat.
2. `/demo` sayfasinda ornek KPI ve operasyon ekranini goster.
3. `demo-admin@cloudpos.local` ile giris yapip `/ops` paneline gec.
4. `admin` hesapla isletme, urun, masa ve personel yonetimini goster.
5. `demo-mutfak@cloudpos.local` ile mutfak ekranini ac.
6. `demo-kasa@cloudpos.local` ile odeme ve kasa akisini goster.
7. `demo-servis@cloudpos.local` ile masa ve servis taleplerini goster.
8. Kapanista raporlar, finans ve kritik stok alanlarini ozetle.

## Hemen Once Kontrol Listesi

- `.env.local` dogru ve Supabase baglantisi aktif
- Migration dosyalari uygulanmis
- `Demo Ekip Kur` bir kez calistirilmis
- Landing, `/demo`, `/login` ve `/ops` rotalari kontrol edilmis
- Tarayicida aktif oturumlar test edilmis
