create table if not exists public.support_incidents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  title text not null,
  summary text not null,
  severity text not null default 'major',
  status text not null default 'open',
  owner_support_user_id uuid references public.support_access_users(id) on delete set null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_incidents_severity_check check (severity in ('minor', 'major', 'critical')),
  constraint support_incidents_status_check check (status in ('open', 'monitoring', 'resolved', 'closed'))
);

drop trigger if exists trg_support_incidents_updated_at on public.support_incidents;
create trigger trg_support_incidents_updated_at before update on public.support_incidents
for each row execute function public.set_updated_at();

create index if not exists idx_support_incidents_business_id on public.support_incidents (business_id);
create index if not exists idx_support_incidents_status on public.support_incidents (status);

alter table public.support_incidents enable row level security;

drop policy if exists "deny direct support incidents reads" on public.support_incidents;
create policy "deny direct support incidents reads" on public.support_incidents
for select to authenticated using (false);

drop policy if exists "deny direct support incidents writes" on public.support_incidents;
create policy "deny direct support incidents writes" on public.support_incidents
for all to authenticated using (false) with check (false);
