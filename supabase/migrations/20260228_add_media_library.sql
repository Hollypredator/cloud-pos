create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  alt_text text,
  kind text not null default 'image',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_kind_check check (kind in ('image', 'document', 'video', 'other'))
);

drop trigger if exists trg_media_assets_updated_at on public.media_assets;
create trigger trg_media_assets_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();

create index if not exists idx_media_assets_kind on public.media_assets (kind);
create index if not exists idx_media_assets_created_at on public.media_assets (created_at desc);

alter table public.media_assets enable row level security;

drop policy if exists "public read media assets" on public.media_assets;
create policy "public read media assets" on public.media_assets
for select to anon, authenticated using (true);

drop policy if exists "admin full media assets" on public.media_assets;
create policy "admin full media assets" on public.media_assets
for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
