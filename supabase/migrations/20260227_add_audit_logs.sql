-- Phase 6 (without multi-branch): audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

drop policy if exists "staff full audit_logs" on public.audit_logs;
create policy "staff full audit_logs" on public.audit_logs
for all to authenticated using (true) with check (true);

