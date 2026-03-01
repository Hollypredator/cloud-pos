-- Phase 5: payments, refunds, discounts, and cash session closing
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('cash', 'card', 'mixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_type') then
    create type public.payment_type as enum ('sale', 'refund');
  end if;
  if not exists (select 1 from pg_type where typname = 'cash_session_status') then
    create type public.cash_session_status as enum ('open', 'closed');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'cancelled'
  ) then
    alter type public.order_status add value 'cancelled';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'refunded'
  ) then
    alter type public.order_status add value 'refunded';
  end if;
end $$;

alter table public.orders
  add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  add column if not exists service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  add column if not exists final_price numeric(12,2) not null default 0 check (final_price >= 0);

update public.orders
set final_price = total_price
where final_price = 0;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_type public.payment_type not null default 'sale',
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount >= 0),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_order_id on public.payments (order_id);
create index if not exists idx_payments_created_at on public.payments (created_at desc);
create index if not exists idx_payments_method on public.payments (method);

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references public.profiles (id) on delete set null,
  closed_by uuid references public.profiles (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  status public.cash_session_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cash_register_sessions_updated_at on public.cash_register_sessions;
create trigger trg_cash_register_sessions_updated_at before update on public.cash_register_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_cash_register_sessions_status on public.cash_register_sessions (status);
create index if not exists idx_cash_register_sessions_opened_at on public.cash_register_sessions (opened_at desc);

alter table public.payments enable row level security;
alter table public.cash_register_sessions enable row level security;

drop policy if exists "staff full payments" on public.payments;
create policy "staff full payments" on public.payments
for all to authenticated using (true) with check (true);

drop policy if exists "staff full cash sessions" on public.cash_register_sessions;
create policy "staff full cash sessions" on public.cash_register_sessions
for all to authenticated using (true) with check (true);

