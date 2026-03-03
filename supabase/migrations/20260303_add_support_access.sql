create table if not exists public.support_access_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'support_admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_access_users_role_check check (role in ('support_admin', 'support_agent', 'billing_agent', 'read_only'))
);

drop trigger if exists trg_support_access_users_updated_at on public.support_access_users;
create trigger trg_support_access_users_updated_at before update on public.support_access_users
for each row execute function public.set_updated_at();

create index if not exists idx_support_access_users_email on public.support_access_users (email);

alter table public.support_access_users enable row level security;

drop policy if exists "deny direct support access reads" on public.support_access_users;
create policy "deny direct support access reads" on public.support_access_users
for select to authenticated using (false);

drop policy if exists "deny direct support access writes" on public.support_access_users;
create policy "deny direct support access writes" on public.support_access_users
for all to authenticated using (false) with check (false);
