# Migration Strategy (Supabase)

Bu projede migration sayısı hızlı buyudugu için, kurulum hizi ve bakım kolayligi adina `baseline + delta` modeline gecildi.

## Mevcut Durum

- Tarih: 2026-03-16
- Klasik migration sayısı: 54 dosya (`supabase/migrations`)
- Baseline dosyasi: `supabase/baseline/20260316_baseline.sql`

## Kurallar

- Mevcut (canli/staging) ortamlarda eski migration dosyalarini silmeyin veya yeniden adlandirmayin.
- Mevcut ortamlarda sadece yeni migration dosyalarini ekleyin ve uygulayın.
- Yeni ortamlar için once baseline, sonra baseline tarihinden sonraki migration dosyaları uygulanir.

## Yeni Ortam Kurulumu

1. `supabase/baseline/20260316_baseline.sql` dosyasini calistirin.
2. `supabase/migrations` altında `20260316` sonrası dosyaları tarih sırasıyla uygulayın.

## Baseline Guncelleme

Yeni bir major release öncesi veya migration sayısı belirgin arttiginda baseline yenileyin.

Komut:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-supabase-baseline.ps1 -OutputPath supabase/baseline/20260316_baseline.sql
```

Opsiyonel:

- `-UpToVersion 20260316` ile belirli tarihe kadar baseline uretebilirsiniz.
- Script, README'deki migration sirasini baz alir; boylece bağımlılık sirasi korunur.

## Neden Bu Model

- Yeni ortamlarda kurulum suresini kisaltir.
- Uzun migration listesi yonetimini basitlestirir.
- Canli ortamlarda migration gecmisini bozmadan ilerlemeyi saglar.
