alter table public.media_assets
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

create index if not exists idx_media_assets_storage_path on public.media_assets (storage_path);
