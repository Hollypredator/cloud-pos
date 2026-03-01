-- Cloud POS & QR Ordering schema for Supabase Postgres
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'table_status') then
    create type public.table_status as enum ('empty', 'occupied', 'reserved');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('pending', 'preparing', 'served', 'paid');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_unique unique (name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on update cascade on delete restrict,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  image_url text,
  description text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null unique,
  status public.table_status not null default 'empty',
  qr_code_identifier text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on update cascade on delete restrict,
  items jsonb not null default '[]'::jsonb,
  total_price numeric(12,2) not null check (total_price >= 0),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_tables_updated_at on public.tables;
create trigger trg_tables_updated_at before update on public.tables
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create index if not exists idx_categories_sort_order on public.categories (sort_order);
create index if not exists idx_products_category_id on public.products (category_id);
create index if not exists idx_products_is_available on public.products (is_available);
create index if not exists idx_tables_status on public.tables (status);
create index if not exists idx_orders_table_id on public.orders (table_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_items_gin on public.orders using gin (items);

-- RLS starter
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;

-- Public menu can read categories/products
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
for select to anon, authenticated using (true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
for select to anon, authenticated using (is_available = true);

-- Authenticated staff full access (starter policy)
drop policy if exists "staff full categories" on public.categories;
create policy "staff full categories" on public.categories
for all to authenticated using (true) with check (true);

drop policy if exists "staff full products" on public.products;
create policy "staff full products" on public.products
for all to authenticated using (true) with check (true);

drop policy if exists "staff full tables" on public.tables;
create policy "staff full tables" on public.tables
for all to authenticated using (true) with check (true);

drop policy if exists "staff full orders" on public.orders;
create policy "staff full orders" on public.orders
for all to authenticated using (true) with check (true);

-- Optional seed
insert into public.categories(name, sort_order)
values ('Kahveler', 1), ('Yiyecekler', 2)
on conflict (name) do nothing;

insert into public.tables(table_number, qr_code_identifier, status)
values (1, 'table-1', 'empty'), (2, 'table-2', 'empty')
on conflict (table_number) do nothing;

