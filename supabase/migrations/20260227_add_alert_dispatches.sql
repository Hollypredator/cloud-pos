-- Production ops alert dispatch history
create table if not exists public.alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null unique,
  last_sent_at timestamptz not null default now(),
  last_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_alert_dispatches_updated_at on public.alert_dispatches;
create trigger trg_alert_dispatches_updated_at before update on public.alert_dispatches
for each row execute function public.set_updated_at();

create index if not exists idx_alert_dispatches_last_sent_at on public.alert_dispatches (last_sent_at desc);

alter table public.alert_dispatches enable row level security;

drop policy if exists "staff full alert_dispatches" on public.alert_dispatches;
create policy "staff full alert_dispatches" on public.alert_dispatches
for all to authenticated using (true) with check (true);

