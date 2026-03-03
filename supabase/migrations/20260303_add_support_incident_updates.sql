create table if not exists public.support_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.support_incidents(id) on delete cascade,
  author_support_user_id uuid references public.support_access_users(id) on delete set null,
  message text not null,
  status text,
  created_at timestamptz not null default now(),
  constraint support_incident_updates_status_check check (status is null or status in ('open', 'monitoring', 'resolved', 'closed'))
);

create index if not exists idx_support_incident_updates_incident_id on public.support_incident_updates (incident_id);
create index if not exists idx_support_incident_updates_created_at on public.support_incident_updates (created_at desc);

alter table public.support_incident_updates enable row level security;

drop policy if exists "deny direct support incident updates reads" on public.support_incident_updates;
create policy "deny direct support incident updates reads" on public.support_incident_updates
for select to authenticated using (false);

drop policy if exists "deny direct support incident updates writes" on public.support_incident_updates;
create policy "deny direct support incident updates writes" on public.support_incident_updates
for all to authenticated using (false) with check (false);
