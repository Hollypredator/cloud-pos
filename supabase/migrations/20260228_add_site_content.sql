create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_site_content_updated_at on public.site_content;
create trigger trg_site_content_updated_at before update on public.site_content
for each row execute function public.set_updated_at();

create index if not exists idx_site_content_key on public.site_content (key);

alter table public.site_content enable row level security;

drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content
for select to anon, authenticated using (true);

drop policy if exists "admin full site content" on public.site_content;
create policy "admin full site content" on public.site_content
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
