create table if not exists public.support_audit_logs (
  id uuid primary key default gen_random_uuid(),
  support_user_id uuid references public.support_access_users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_audit_logs_business_id on public.support_audit_logs (business_id);
create index if not exists idx_support_audit_logs_created_at on public.support_audit_logs (created_at desc);
create index if not exists idx_support_audit_logs_entity on public.support_audit_logs (entity_type, entity_id);

alter table public.support_audit_logs enable row level security;

drop policy if exists "deny direct support audit reads" on public.support_audit_logs;
create policy "deny direct support audit reads" on public.support_audit_logs
for select to authenticated using (false);

drop policy if exists "deny direct support audit writes" on public.support_audit_logs;
create policy "deny direct support audit writes" on public.support_audit_logs
for all to authenticated using (false) with check (false);
