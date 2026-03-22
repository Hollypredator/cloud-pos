-- Branch lock and sync event infrastructure for local-first sync

create extension if not exists pgcrypto;

create table if not exists public.device_branch_locks (
  branch_id text primary key,
  business_id text,
  device_id text not null,
  lock_token text not null,
  status text not null default 'active' check (status in ('active', 'released', 'expired')),
  acquired_at timestamptz not null default now(),
  renewed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  actor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_branch_locks_status_expires
  on public.device_branch_locks (status, expires_at);

create table if not exists public.ops_sync_events (
  sequence bigint generated always as identity primary key,
  business_id text,
  branch_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_sync_events_branch_sequence
  on public.ops_sync_events (branch_id, sequence);

create index if not exists idx_ops_sync_events_business_sequence
  on public.ops_sync_events (business_id, sequence);

create index if not exists idx_ops_sync_events_created_desc
  on public.ops_sync_events (created_at desc);

create table if not exists public.ops_command_attempts (
  id uuid primary key default gen_random_uuid(),
  command_id text not null,
  idempotency_key text not null,
  device_id text not null,
  business_id text,
  branch_id text,
  result_status text not null,
  message text,
  result_payload jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_ops_command_attempts_command_attempted
  on public.ops_command_attempts (command_id, attempted_at desc);

create unique index if not exists idx_device_branch_locks_lock_token
  on public.device_branch_locks (lock_token);

create or replace function public.set_device_branch_locks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_device_branch_locks_updated_at on public.device_branch_locks;
create trigger trg_device_branch_locks_updated_at
before update on public.device_branch_locks
for each row
execute procedure public.set_device_branch_locks_updated_at();

create or replace function public.enqueue_ops_sync_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row jsonb;
  previous_row jsonb;
  source_branch_id text;
  source_business_id text;
  source_entity_id text;
begin
  if tg_op = 'DELETE' then
    source_row := to_jsonb(old);
    previous_row := to_jsonb(old);
  else
    source_row := to_jsonb(new);
    previous_row := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  end if;

  source_branch_id := nullif(source_row ->> 'branch_id', '');
  source_business_id := nullif(source_row ->> 'business_id', '');
  source_entity_id := coalesce(
    nullif(source_row ->> 'id', ''),
    nullif(source_row ->> 'order_id', ''),
    nullif(source_row ->> 'table_id', ''),
    'unknown'
  );

  insert into public.ops_sync_events (
    business_id,
    branch_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    created_at
  ) values (
    source_business_id,
    source_branch_id,
    lower(tg_op),
    tg_argv[0],
    source_entity_id,
    jsonb_build_object(
      'op', tg_op,
      'new', case when tg_op = 'DELETE' then null else source_row end,
      'old', case when tg_op = 'INSERT' then null else previous_row end,
      'at', now()
    ),
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_enqueue_ops_sync_event on public.orders;
create trigger trg_orders_enqueue_ops_sync_event
after insert or update or delete on public.orders
for each row
execute procedure public.enqueue_ops_sync_event('order');

drop trigger if exists trg_order_items_enqueue_ops_sync_event on public.order_items;
create trigger trg_order_items_enqueue_ops_sync_event
after insert or update or delete on public.order_items
for each row
execute procedure public.enqueue_ops_sync_event('order_item');

drop trigger if exists trg_tables_enqueue_ops_sync_event on public.tables;
create trigger trg_tables_enqueue_ops_sync_event
after insert or update or delete on public.tables
for each row
execute procedure public.enqueue_ops_sync_event('table');

drop trigger if exists trg_table_requests_enqueue_ops_sync_event on public.table_requests;
create trigger trg_table_requests_enqueue_ops_sync_event
after insert or update or delete on public.table_requests
for each row
execute procedure public.enqueue_ops_sync_event('table_request');

drop trigger if exists trg_payments_enqueue_ops_sync_event on public.payments;
create trigger trg_payments_enqueue_ops_sync_event
after insert or update or delete on public.payments
for each row
execute procedure public.enqueue_ops_sync_event('payment');

drop trigger if exists trg_couriers_enqueue_ops_sync_event on public.couriers;
create trigger trg_couriers_enqueue_ops_sync_event
after insert or update or delete on public.couriers
for each row
execute procedure public.enqueue_ops_sync_event('courier');

drop trigger if exists trg_cash_sessions_enqueue_ops_sync_event on public.cash_register_sessions;
create trigger trg_cash_sessions_enqueue_ops_sync_event
after insert or update or delete on public.cash_register_sessions
for each row
execute procedure public.enqueue_ops_sync_event('cash_session');
