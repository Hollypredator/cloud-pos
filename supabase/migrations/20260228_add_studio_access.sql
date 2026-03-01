create table if not exists public.studio_access_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_studio_access_users_updated_at on public.studio_access_users;
create trigger trg_studio_access_users_updated_at before update on public.studio_access_users
for each row execute function public.set_updated_at();

create index if not exists idx_studio_access_users_email on public.studio_access_users (email);

alter table public.studio_access_users enable row level security;

drop policy if exists "deny direct studio access reads" on public.studio_access_users;
create policy "deny direct studio access reads" on public.studio_access_users
for select to authenticated using (false);

drop policy if exists "deny direct studio access writes" on public.studio_access_users;
create policy "deny direct studio access writes" on public.studio_access_users
for all to authenticated using (false) with check (false);
