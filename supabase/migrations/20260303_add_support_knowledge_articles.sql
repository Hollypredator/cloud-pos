create table if not exists public.support_knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general',
  summary text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_support_knowledge_articles_updated_at on public.support_knowledge_articles;
create trigger trg_support_knowledge_articles_updated_at before update on public.support_knowledge_articles
for each row execute function public.set_updated_at();

alter table public.support_knowledge_articles enable row level security;

drop policy if exists "deny direct support knowledge reads" on public.support_knowledge_articles;
create policy "deny direct support knowledge reads" on public.support_knowledge_articles
for select to authenticated using (false);

drop policy if exists "deny direct support knowledge writes" on public.support_knowledge_articles;
create policy "deny direct support knowledge writes" on public.support_knowledge_articles
for all to authenticated using (false) with check (false);

insert into public.support_knowledge_articles (title, category, summary, body)
values
  ('Onboarding Kontrolu', 'onboarding', 'Go-live oncesi temel kontrol listesi.', 'Urunler, masalar, personel, yazdirma ve ilk siparis akisi kontrol edilir.'),
  ('Paket Degisikligi Politikalari', 'billing', 'Upgrade ve downgrade sureci icin referans notu.', 'Tenant panelinden dogrudan paket degistirilmez. Talep support ve billing onayiyla islenir.'),
  ('Kritik Incident Yonetimi', 'incident', 'Kritik hata durumunda izlenecek yol.', 'Incident acilir, sorumlu atanir, tenant etkisi not edilir ve durum resolved/closed akisiyla kapanir.')
on conflict do nothing;
