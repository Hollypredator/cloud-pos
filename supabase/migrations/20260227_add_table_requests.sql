-- Phase: customer service requests from QR (call waiter / request bill)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'table_request_type') then
    create type public.table_request_type as enum ('call_waiter', 'request_bill');
  end if;
  if not exists (select 1 from pg_type where typname = 'table_request_status') then
    create type public.table_request_status as enum ('open', 'resolved');
  end if;
end $$;

create table if not exists public.table_requests (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  request_type public.table_request_type not null,
  status public.table_request_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_table_requests_status on public.table_requests (status);
create index if not exists idx_table_requests_created_at on public.table_requests (created_at desc);
create index if not exists idx_table_requests_table_id on public.table_requests (table_id);

alter table public.table_requests enable row level security;

drop policy if exists "public create table requests" on public.table_requests;
create policy "public create table requests" on public.table_requests
for insert to anon, authenticated
with check (true);

drop policy if exists "staff full table requests" on public.table_requests;
create policy "staff full table requests" on public.table_requests
for all to authenticated using (true) with check (true);

