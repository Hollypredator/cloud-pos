create table if not exists public.platform_access_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'observer',
  permissions text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_access_users_role_check check (
    role in (
      'platform_owner',
      'platform_admin',
      'support_manager',
      'support_agent',
      'billing_manager',
      'content_manager',
      'content_editor',
      'observer'
    )
  )
);

drop trigger if exists trg_platform_access_users_updated_at on public.platform_access_users;
create trigger trg_platform_access_users_updated_at before update on public.platform_access_users
for each row execute function public.set_updated_at();

create index if not exists idx_platform_access_users_email on public.platform_access_users (email);
create index if not exists idx_platform_access_users_role on public.platform_access_users (role);

alter table public.platform_access_users enable row level security;

drop policy if exists "deny direct platform access reads" on public.platform_access_users;
create policy "deny direct platform access reads" on public.platform_access_users
for select to authenticated using (false);

drop policy if exists "deny direct platform access writes" on public.platform_access_users;
create policy "deny direct platform access writes" on public.platform_access_users
for all to authenticated using (false) with check (false);

insert into public.platform_access_users (email, full_name, role, permissions, is_active)
values (
  'msamedcbn@gmail.com',
  'Platform Owner',
  'platform_owner',
  '{}'::text[],
  true
)
on conflict (email) do update
set role = 'platform_owner',
    is_active = true;
