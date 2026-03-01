create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

create index if not exists idx_app_settings_key on public.app_settings (key);

alter table public.app_settings enable row level security;

drop policy if exists "public read general settings" on public.app_settings;
create policy "public read general settings" on public.app_settings
for select to anon, authenticated
using (key = 'general_settings');

drop policy if exists "admin full app settings" on public.app_settings;
create policy "admin full app settings" on public.app_settings
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
