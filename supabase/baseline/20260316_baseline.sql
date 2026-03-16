-- AUTO-GENERATED BASELINE
-- Generated at: 2026-03-16 17:01:31 +03:00
-- Source folder: supabase/migrations
-- Included migrations: 54
-- NOTE: This file is for fresh environments.
-- Existing environments should continue with normal delta migrations.

-- ===================================================================
-- BEGIN: 20260227_add_alert_dispatches.sql
-- ===================================================================

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


-- END: 20260227_add_alert_dispatches.sql

-- ===================================================================
-- BEGIN: 20260227_add_audit_logs.sql
-- ===================================================================

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


-- END: 20260227_add_audit_logs.sql

-- ===================================================================
-- BEGIN: 20260227_add_business_scope_finance.sql
-- ===================================================================

-- Tenant scope for finance/session tables

alter table public.payments add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.cash_register_sessions add column if not exists business_id uuid references public.businesses (id) on delete restrict;

update public.payments p
set business_id = o.business_id
from public.orders o
where p.business_id is null
  and p.order_id = o.id;

update public.cash_register_sessions
set business_id = (select id from public.businesses where slug = 'default' limit 1)
where business_id is null;

alter table public.payments alter column business_id set not null;
alter table public.cash_register_sessions alter column business_id set not null;

create index if not exists idx_payments_business_id on public.payments (business_id);
create index if not exists idx_cash_sessions_business_id on public.cash_register_sessions (business_id);

-- END: 20260227_add_business_scope_finance.sql

-- ===================================================================
-- BEGIN: 20260227_add_businesses_multi_tenant.sql
-- ===================================================================

-- Multi-tenant baseline (single domain + business slug)
-- AmaÃ§: AynÄ± uygulamada birden fazla iÅŸletmeyi ayÄ±rmak iÃ§in tenant katmanÄ± eklemek.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

-- VarsayÄ±lan tenant (mevcut veriyi geriye dÃ¶nÃ¼k bozmaz)
insert into public.businesses (name, slug)
values ('Default Business', 'default')
on conflict (slug) do nothing;

-- Core tablolara business_id
alter table public.categories add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.products add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.tables add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.orders add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.table_requests add column if not exists business_id uuid references public.businesses (id) on delete restrict;

-- Backfill
update public.categories
set business_id = (select id from public.businesses where slug = 'default' limit 1)
where business_id is null;

update public.products p
set business_id = c.business_id
from public.categories c
where p.business_id is null
  and p.category_id = c.id;

update public.tables
set business_id = (select id from public.businesses where slug = 'default' limit 1)
where business_id is null;

update public.orders o
set business_id = t.business_id
from public.tables t
where o.business_id is null
  and o.table_id = t.id;

update public.table_requests tr
set business_id = t.business_id
from public.tables t
where tr.business_id is null
  and tr.table_id = t.id;

alter table public.categories alter column business_id set not null;
alter table public.products alter column business_id set not null;
alter table public.tables alter column business_id set not null;
alter table public.orders alter column business_id set not null;
alter table public.table_requests alter column business_id set not null;

-- Tenant bazlÄ± unique kurallarÄ±
alter table public.categories drop constraint if exists categories_name_unique;
alter table public.categories add constraint categories_business_name_unique unique (business_id, name);

alter table public.tables drop constraint if exists tables_table_number_key;
alter table public.tables drop constraint if exists tables_qr_code_identifier_key;
alter table public.tables add constraint tables_business_table_number_unique unique (business_id, table_number);
alter table public.tables add constraint tables_business_qr_unique unique (business_id, qr_code_identifier);

-- Index
create index if not exists idx_categories_business_id on public.categories (business_id);
create index if not exists idx_products_business_id on public.products (business_id);
create index if not exists idx_tables_business_id on public.tables (business_id);
create index if not exists idx_orders_business_id on public.orders (business_id);
create index if not exists idx_table_requests_business_id on public.table_requests (business_id);
create index if not exists idx_businesses_slug on public.businesses (slug);

-- RLS starter
alter table public.businesses enable row level security;
drop policy if exists "public read businesses" on public.businesses;
create policy "public read businesses" on public.businesses
for select to anon, authenticated using (is_active = true);

drop policy if exists "staff full businesses" on public.businesses;
create policy "staff full businesses" on public.businesses
for all to authenticated using (true) with check (true);

-- END: 20260227_add_businesses_multi_tenant.sql

-- ===================================================================
-- BEGIN: 20260227_add_ingredients.sql
-- ===================================================================

-- Phase 3: ingredient management for products
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'adet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_ingredients (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id)
);

drop trigger if exists trg_ingredients_updated_at on public.ingredients;
create trigger trg_ingredients_updated_at before update on public.ingredients
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_ingredients_updated_at on public.product_ingredients;
create trigger trg_product_ingredients_updated_at before update on public.product_ingredients
for each row execute function public.set_updated_at();

create index if not exists idx_product_ingredients_product_id on public.product_ingredients (product_id);
create index if not exists idx_product_ingredients_ingredient_id on public.product_ingredients (ingredient_id);

alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;

drop policy if exists "staff full ingredients" on public.ingredients;
create policy "staff full ingredients" on public.ingredients
for all to authenticated using (true) with check (true);

drop policy if exists "staff full product_ingredients" on public.product_ingredients;
create policy "staff full product_ingredients" on public.product_ingredients
for all to authenticated using (true) with check (true);


-- END: 20260227_add_ingredients.sql

-- ===================================================================
-- BEGIN: 20260227_add_order_items.sql
-- ===================================================================

-- Normalize order line items for analytics/reporting
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_order_items_updated_at on public.order_items;
create trigger trg_order_items_updated_at before update on public.order_items
for each row execute function public.set_updated_at();

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);

alter table public.order_items enable row level security;

drop policy if exists "staff full order_items" on public.order_items;
create policy "staff full order_items" on public.order_items
for all to authenticated using (true) with check (true);


-- END: 20260227_add_order_items.sql

-- ===================================================================
-- BEGIN: 20260227_add_payments_and_sessions.sql
-- ===================================================================

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


-- END: 20260227_add_payments_and_sessions.sql

-- ===================================================================
-- BEGIN: 20260227_add_profiles_and_roles.sql
-- ===================================================================

-- Phase 1: staff roles and profile layer
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'waiter', 'kitchen', 'cashier');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'waiter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create index if not exists idx_profiles_role on public.profiles (role);

alter table public.profiles enable row level security;

drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admin full profiles" on public.profiles;
create policy "admin full profiles" on public.profiles
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);


-- END: 20260227_add_profiles_and_roles.sql

-- ===================================================================
-- BEGIN: 20260227_add_stock_movements.sql
-- ===================================================================

-- Phase 3: stock movement history
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  change_amount integer not null,
  previous_stock integer not null,
  new_stock integer not null,
  reason text not null default 'manual_update',
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product_id on public.stock_movements (product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements (created_at desc);

create or replace function public.log_stock_change()
returns trigger
language plpgsql
as $$
begin
  if new.stock_count is distinct from old.stock_count then
    insert into public.stock_movements (
      product_id,
      change_amount,
      previous_stock,
      new_stock,
      reason
    )
    values (
      new.id,
      new.stock_count - old.stock_count,
      old.stock_count,
      new.stock_count,
      'manual_update'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_log_stock_change on public.products;
create trigger trg_products_log_stock_change
after update on public.products
for each row execute function public.log_stock_change();

alter table public.stock_movements enable row level security;

drop policy if exists "staff full stock_movements" on public.stock_movements;
create policy "staff full stock_movements" on public.stock_movements
for all to authenticated using (true) with check (true);


-- END: 20260227_add_stock_movements.sql

-- ===================================================================
-- BEGIN: 20260227_add_table_requests.sql
-- ===================================================================

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


-- END: 20260227_add_table_requests.sql

-- ===================================================================
-- BEGIN: 20260227_initial_cloud_pos.sql
-- ===================================================================

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


-- END: 20260227_initial_cloud_pos.sql

-- ===================================================================
-- BEGIN: 20260227_profile_trigger.sql
-- ===================================================================

-- Create a profile row for each new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'waiter')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- END: 20260227_profile_trigger.sql

-- ===================================================================
-- BEGIN: 20260228_add_app_settings.sql
-- ===================================================================

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

create index if not exists idx_app_settings_key on public.app_settings (key);

alter table public.app_settings enable row level security;

drop policy if exists "public read general settings" on public.app_settings;
create policy "public read general settings" on public.app_settings
for select to anon, authenticated
using (key = 'general_settings');

drop policy if exists "admin full app settings" on public.app_settings;
create policy "admin full app settings" on public.app_settings
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_app_settings.sql

-- ===================================================================
-- BEGIN: 20260228_add_blog_posts.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'blog_post_status') then
    create type public.blog_post_status as enum ('draft', 'published');
  end if;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null default '',
  cover_image_url text,
  status public.blog_post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at before update on public.blog_posts
for each row execute function public.set_updated_at();

create index if not exists idx_blog_posts_status on public.blog_posts (status);
create index if not exists idx_blog_posts_published_at on public.blog_posts (published_at desc);

alter table public.blog_posts enable row level security;

drop policy if exists "public read published blog posts" on public.blog_posts;
create policy "public read published blog posts" on public.blog_posts
for select to anon, authenticated using (status = 'published');

drop policy if exists "admin full blog posts" on public.blog_posts;
create policy "admin full blog posts" on public.blog_posts
for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_blog_posts.sql

-- ===================================================================
-- BEGIN: 20260228_add_couriers.sql
-- ===================================================================

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_couriers_updated_at on public.couriers;
create trigger trg_couriers_updated_at before update on public.couriers
for each row execute function public.set_updated_at();

alter table public.orders
  add column if not exists courier_id uuid references public.couriers (id) on delete set null;

create index if not exists idx_couriers_business_id on public.couriers (business_id);
create index if not exists idx_couriers_is_active on public.couriers (is_active);
create index if not exists idx_orders_courier_id on public.orders (courier_id);

alter table public.couriers enable row level security;

drop policy if exists "staff full couriers" on public.couriers;
create policy "staff full couriers" on public.couriers
for all to authenticated using (true) with check (true);

-- END: 20260228_add_couriers.sql

-- ===================================================================
-- BEGIN: 20260228_add_media_library.sql
-- ===================================================================

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  alt_text text,
  kind text not null default 'image',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_kind_check check (kind in ('image', 'document', 'video', 'other'))
);

drop trigger if exists trg_media_assets_updated_at on public.media_assets;
create trigger trg_media_assets_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();

create index if not exists idx_media_assets_kind on public.media_assets (kind);
create index if not exists idx_media_assets_created_at on public.media_assets (created_at desc);

alter table public.media_assets enable row level security;

drop policy if exists "public read media assets" on public.media_assets;
create policy "public read media assets" on public.media_assets
for select to anon, authenticated using (true);

drop policy if exists "admin full media assets" on public.media_assets;
create policy "admin full media assets" on public.media_assets
for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_media_library.sql

-- ===================================================================
-- BEGIN: 20260228_add_media_storage_fields.sql
-- ===================================================================

alter table public.media_assets
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

create index if not exists idx_media_assets_storage_path on public.media_assets (storage_path);

-- END: 20260228_add_media_storage_fields.sql

-- ===================================================================
-- BEGIN: 20260228_add_order_channels.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_channel') then
    create type public.order_channel as enum ('dine_in', 'pickup', 'delivery');
  end if;

  if not exists (select 1 from pg_type where typname = 'fulfillment_status') then
    create type public.fulfillment_status as enum (
      'not_applicable',
      'awaiting_dispatch',
      'out_for_delivery',
      'completed'
    );
  end if;
end $$;

alter table public.orders
  alter column table_id drop not null;

alter table public.orders
  add column if not exists channel public.order_channel not null default 'dine_in',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists delivery_note text,
  add column if not exists courier_name text,
  add column if not exists courier_phone text,
  add column if not exists fulfillment_status public.fulfillment_status not null default 'not_applicable';

update public.orders
set channel = 'dine_in'
where channel is null;

update public.orders
set fulfillment_status = 'not_applicable'
where fulfillment_status is null;

create index if not exists idx_orders_channel on public.orders (channel);
create index if not exists idx_orders_fulfillment_status on public.orders (fulfillment_status);

-- END: 20260228_add_order_channels.sql

-- ===================================================================
-- BEGIN: 20260228_add_product_modifiers.sql
-- ===================================================================

create table if not exists public.product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_modifier_groups_updated_at on public.product_modifier_groups;
create trigger trg_product_modifier_groups_updated_at before update on public.product_modifier_groups
for each row execute function public.set_updated_at();

create table if not exists public.product_modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_modifier_groups (id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_modifier_options_updated_at on public.product_modifier_options;
create trigger trg_product_modifier_options_updated_at before update on public.product_modifier_options
for each row execute function public.set_updated_at();

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  modifier_group_name text not null,
  modifier_option_name text not null,
  price_delta numeric(12,2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_modifier_groups_product_id on public.product_modifier_groups (product_id);
create index if not exists idx_modifier_options_group_id on public.product_modifier_options (group_id);
create index if not exists idx_order_item_modifiers_order_id on public.order_item_modifiers (order_id);

alter table public.product_modifier_groups enable row level security;
alter table public.product_modifier_options enable row level security;
alter table public.order_item_modifiers enable row level security;

drop policy if exists "staff full product_modifier_groups" on public.product_modifier_groups;
create policy "staff full product_modifier_groups" on public.product_modifier_groups
for all to authenticated using (true) with check (true);

drop policy if exists "staff full product_modifier_options" on public.product_modifier_options;
create policy "staff full product_modifier_options" on public.product_modifier_options
for all to authenticated using (true) with check (true);

drop policy if exists "staff full order_item_modifiers" on public.order_item_modifiers;
create policy "staff full order_item_modifiers" on public.order_item_modifiers
for all to authenticated using (true) with check (true);

-- END: 20260228_add_product_modifiers.sql

-- ===================================================================
-- BEGIN: 20260228_add_sales_lead_notes.sql
-- ===================================================================

create table if not exists public.sales_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_lead_notes_lead_id on public.sales_lead_notes (lead_id);
create index if not exists idx_sales_lead_notes_created_at on public.sales_lead_notes (created_at desc);

alter table public.sales_lead_notes enable row level security;

drop policy if exists "admin full sales lead notes" on public.sales_lead_notes;
create policy "admin full sales lead notes" on public.sales_lead_notes
for all to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_sales_lead_notes.sql

-- ===================================================================
-- BEGIN: 20260228_add_sales_leads.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_lead_status') then
    create type public.sales_lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');
  end if;
end $$;

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  phone text,
  email text,
  branch_count integer not null default 1,
  note text,
  status public.sales_lead_status not null default 'new',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_leads_updated_at on public.sales_leads;
create trigger trg_sales_leads_updated_at before update on public.sales_leads
for each row execute function public.set_updated_at();

create index if not exists idx_sales_leads_status on public.sales_leads (status);
create index if not exists idx_sales_leads_created_at on public.sales_leads (created_at desc);

alter table public.sales_leads enable row level security;

drop policy if exists "admin full sales leads" on public.sales_leads;
create policy "admin full sales leads" on public.sales_leads
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_sales_leads.sql

-- ===================================================================
-- BEGIN: 20260228_add_site_content.sql
-- ===================================================================

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_site_content_updated_at on public.site_content;
create trigger trg_site_content_updated_at before update on public.site_content
for each row execute function public.set_updated_at();

create index if not exists idx_site_content_key on public.site_content (key);

alter table public.site_content enable row level security;

drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content
for select to anon, authenticated using (true);

drop policy if exists "admin full site content" on public.site_content;
create policy "admin full site content" on public.site_content
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- END: 20260228_add_site_content.sql

-- ===================================================================
-- BEGIN: 20260228_add_studio_access.sql
-- ===================================================================

create table if not exists public.studio_access_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_studio_access_users_updated_at on public.studio_access_users;
create trigger trg_studio_access_users_updated_at before update on public.studio_access_users
for each row execute function public.set_updated_at();

create index if not exists idx_studio_access_users_email on public.studio_access_users (email);

alter table public.studio_access_users enable row level security;

drop policy if exists "deny direct studio access reads" on public.studio_access_users;
create policy "deny direct studio access reads" on public.studio_access_users
for select to authenticated using (false);

drop policy if exists "deny direct studio access writes" on public.studio_access_users;
create policy "deny direct studio access writes" on public.studio_access_users
for all to authenticated using (false) with check (false);

-- END: 20260228_add_studio_access.sql

-- ===================================================================
-- BEGIN: 20260228_add_studio_roles.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'studio_role') then
    create type public.studio_role as enum ('owner', 'editor');
  end if;
end $$;

alter table public.studio_access_users
add column if not exists role public.studio_role not null default 'owner';

-- END: 20260228_add_studio_roles.sql

-- ===================================================================
-- BEGIN: 20260228_harden_studio_policies.sql
-- ===================================================================

drop policy if exists "admin full site content" on public.site_content;
drop policy if exists "direct write site content denied" on public.site_content;
create policy "direct write site content denied" on public.site_content
for all to authenticated using (false) with check (false);

drop policy if exists "admin full app settings" on public.app_settings;
drop policy if exists "direct write app settings denied" on public.app_settings;
create policy "direct write app settings denied" on public.app_settings
for all to authenticated using (false) with check (false);

drop policy if exists "admin full blog posts" on public.blog_posts;
drop policy if exists "direct write blog posts denied" on public.blog_posts;
create policy "direct write blog posts denied" on public.blog_posts
for all to authenticated using (false) with check (false);

drop policy if exists "admin full media assets" on public.media_assets;
drop policy if exists "direct write media assets denied" on public.media_assets;
create policy "direct write media assets denied" on public.media_assets
for all to authenticated using (false) with check (false);

drop policy if exists "admin full sales leads" on public.sales_leads;
drop policy if exists "direct access sales leads denied" on public.sales_leads;
create policy "direct access sales leads denied" on public.sales_leads
for all to authenticated using (false) with check (false);

drop policy if exists "admin full sales lead notes" on public.sales_lead_notes;
drop policy if exists "direct access sales lead notes denied" on public.sales_lead_notes;
create policy "direct access sales lead notes denied" on public.sales_lead_notes
for all to authenticated using (false) with check (false);

-- END: 20260228_harden_studio_policies.sql

-- ===================================================================
-- BEGIN: 20260301_add_branches.sql
-- ===================================================================

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_business_slug_unique unique (business_id, slug)
);

drop trigger if exists trg_branches_updated_at on public.branches;
create trigger trg_branches_updated_at before update on public.branches
for each row execute function public.set_updated_at();

insert into public.branches (business_id, name, slug)
select id, 'Merkez Sube', 'merkez'
from public.businesses
where not exists (
  select 1 from public.branches b where b.business_id = public.businesses.id
);

alter table public.tables add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.orders add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.table_requests add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.payments add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.cash_register_sessions add column if not exists branch_id uuid references public.branches (id) on delete restrict;
alter table public.couriers add column if not exists branch_id uuid references public.branches (id) on delete restrict;

update public.tables t
set branch_id = b.id
from public.branches b
where t.branch_id is null
  and b.business_id = t.business_id;

update public.orders o
set branch_id = t.branch_id
from public.tables t
where o.branch_id is null
  and o.table_id = t.id;

update public.orders o
set branch_id = b.id
from public.branches b
where o.branch_id is null
  and b.business_id = o.business_id;

update public.table_requests tr
set branch_id = t.branch_id
from public.tables t
where tr.branch_id is null
  and tr.table_id = t.id;

update public.payments p
set branch_id = o.branch_id
from public.orders o
where p.branch_id is null
  and p.order_id = o.id;

update public.cash_register_sessions c
set branch_id = b.id
from public.branches b
where c.branch_id is null
  and b.business_id = c.business_id;

update public.couriers c
set branch_id = b.id
from public.branches b
where c.branch_id is null
  and b.business_id = c.business_id;

alter table public.tables alter column branch_id set not null;
alter table public.orders alter column branch_id set not null;
alter table public.table_requests alter column branch_id set not null;
alter table public.payments alter column branch_id set not null;
alter table public.cash_register_sessions alter column branch_id set not null;
alter table public.couriers alter column branch_id set not null;

create index if not exists idx_branches_business_id on public.branches (business_id);
create index if not exists idx_tables_branch_id on public.tables (branch_id);
create index if not exists idx_orders_branch_id on public.orders (branch_id);
create index if not exists idx_table_requests_branch_id on public.table_requests (branch_id);
create index if not exists idx_payments_branch_id on public.payments (branch_id);
create index if not exists idx_cash_register_sessions_branch_id on public.cash_register_sessions (branch_id);
create index if not exists idx_couriers_branch_id on public.couriers (branch_id);

alter table public.branches enable row level security;

drop policy if exists "public read branches" on public.branches;
create policy "public read branches" on public.branches
for select to anon, authenticated using (is_active = true);

drop policy if exists "staff full branches" on public.branches;
create policy "staff full branches" on public.branches
for all to authenticated using (true) with check (true);

-- END: 20260301_add_branches.sql

-- ===================================================================
-- BEGIN: 20260301_add_business_plans.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_plan') then
    create type public.business_plan as enum ('starter', 'growth', 'custom');
  end if;
end $$;

alter table public.businesses
  add column if not exists plan public.business_plan not null default 'growth';

update public.businesses
set plan = 'growth'
where plan is null;

create index if not exists idx_businesses_plan on public.businesses (plan);

-- END: 20260301_add_business_plans.sql

-- ===================================================================
-- BEGIN: 20260301_add_owner_role.sql
-- ===================================================================

do $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    begin
      alter type public.app_role add value if not exists 'owner';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- END: 20260301_add_owner_role.sql

-- ===================================================================
-- BEGIN: 20260301_add_staff_branch_access.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_access_scope') then
    create type public.staff_access_scope as enum ('business', 'branch');
  end if;
end $$;

create table if not exists public.staff_branch_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  access_scope public.staff_access_scope not null default 'branch',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_staff_branch_access_updated_at on public.staff_branch_access;
create trigger trg_staff_branch_access_updated_at before update on public.staff_branch_access
for each row execute function public.set_updated_at();

create unique index if not exists idx_staff_branch_access_business_scope
on public.staff_branch_access (profile_id, business_id)
where access_scope = 'business';

create unique index if not exists idx_staff_branch_access_branch_scope
on public.staff_branch_access (profile_id, business_id, branch_id)
where branch_id is not null;

create unique index if not exists idx_staff_branch_access_primary_per_business
on public.staff_branch_access (profile_id, business_id)
where is_primary = true;

insert into public.staff_branch_access (profile_id, business_id, branch_id, access_scope, is_primary)
select
  p.id,
  b.id,
  case when p.role = 'admin' then null else fb.id end,
  case when p.role = 'admin' then 'business'::public.staff_access_scope else 'branch'::public.staff_access_scope end,
  true
from public.profiles p
cross join public.businesses b
left join lateral (
  select br.id
  from public.branches br
  where br.business_id = b.id
  order by br.created_at asc
  limit 1
) fb on true
where not exists (
  select 1
  from public.staff_branch_access sba
  where sba.profile_id = p.id
    and sba.business_id = b.id
);

alter table public.staff_branch_access enable row level security;

drop policy if exists "staff full staff_branch_access" on public.staff_branch_access;
create policy "staff full staff_branch_access" on public.staff_branch_access
for all to authenticated using (true) with check (true);

-- END: 20260301_add_staff_branch_access.sql

-- ===================================================================
-- BEGIN: 20260301_add_table_names.sql
-- ===================================================================

alter table public.tables
  add column if not exists name text;

update public.tables
set name = concat('Masa ', table_number)
where name is null or btrim(name) = '';

-- END: 20260301_add_table_names.sql

-- ===================================================================
-- BEGIN: 20260301_harden_core_rls.sql
-- ===================================================================

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create or replace function public.current_is_management()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('owner', 'admin'), false)
$$;

create or replace function public.can_access_business(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_branch_access sba
    where sba.profile_id = auth.uid()
      and sba.business_id = target_business
  )
$$;

create or replace function public.can_owner_business(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_owner()
    and exists (
      select 1
      from public.staff_branch_access sba
      where sba.profile_id = auth.uid()
        and sba.business_id = target_business
        and sba.access_scope = 'business'
    )
$$;

create or replace function public.can_manage_business(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_management()
    and exists (
      select 1
      from public.staff_branch_access sba
      where sba.profile_id = auth.uid()
        and sba.business_id = target_business
    )
$$;

create or replace function public.can_access_branch(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branches br
    join public.staff_branch_access sba
      on sba.business_id = br.business_id
     and sba.profile_id = auth.uid()
    where br.id = target_branch
      and (sba.access_scope = 'business' or sba.branch_id = target_branch)
  )
$$;

create or replace function public.can_manage_branch(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_management() and public.can_access_branch(target_branch)
$$;

update public.staff_branch_access sba
set access_scope = 'branch',
    branch_id = coalesce(
      sba.branch_id,
      (
        select br.id
        from public.branches br
        where br.business_id = sba.business_id
        order by br.created_at asc
        limit 1
      )
    )
from public.profiles p
where p.id = sba.profile_id
  and p.role = 'admin'
  and sba.access_scope = 'business';

update public.staff_branch_access sba
set access_scope = 'business',
    branch_id = null
from public.profiles p
where p.id = sba.profile_id
  and p.role = 'owner';

drop policy if exists "public read businesses" on public.businesses;
drop policy if exists "staff full businesses" on public.businesses;
create policy "staff read businesses scoped" on public.businesses
for select to authenticated using (public.can_access_business(id));
create policy "owner manage businesses scoped" on public.businesses
for all to authenticated
using (public.can_owner_business(id))
with check (public.can_owner_business(id));

drop policy if exists "public read branches" on public.branches;
drop policy if exists "staff full branches" on public.branches;
create policy "staff read branches scoped" on public.branches
for select to authenticated using (public.can_access_branch(id));
create policy "owner manage branches scoped" on public.branches
for all to authenticated
using (public.can_owner_business(business_id))
with check (public.can_owner_business(business_id));

drop policy if exists "public read categories" on public.categories;
drop policy if exists "staff full categories" on public.categories;
create policy "staff read categories scoped" on public.categories
for select to authenticated using (public.can_access_business(business_id));
create policy "management manage categories scoped" on public.categories
for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "public read products" on public.products;
drop policy if exists "staff full products" on public.products;
create policy "staff read products scoped" on public.products
for select to authenticated using (public.can_access_business(business_id));
create policy "management manage products scoped" on public.products
for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "staff full tables" on public.tables;
create policy "staff read tables scoped" on public.tables
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage tables scoped" on public.tables
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full orders" on public.orders;
create policy "staff read orders scoped" on public.orders
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage orders scoped" on public.orders
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full table_requests" on public.table_requests;
create policy "staff read table_requests scoped" on public.table_requests
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage table_requests scoped" on public.table_requests
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full payments" on public.payments;
create policy "staff read payments scoped" on public.payments
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage payments scoped" on public.payments
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full cash_register_sessions" on public.cash_register_sessions;
create policy "staff read cash_register_sessions scoped" on public.cash_register_sessions
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage cash_register_sessions scoped" on public.cash_register_sessions
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full couriers" on public.couriers;
create policy "staff read couriers scoped" on public.couriers
for select to authenticated using (public.can_access_branch(branch_id));
create policy "management manage couriers scoped" on public.couriers
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

drop policy if exists "staff full staff_branch_access" on public.staff_branch_access;
create policy "staff read own staff_branch_access" on public.staff_branch_access
for select to authenticated
using (profile_id = auth.uid() or public.can_owner_business(business_id));
create policy "owner manage staff_branch_access" on public.staff_branch_access
for all to authenticated
using (public.can_owner_business(business_id))
with check (public.can_owner_business(business_id));

-- END: 20260301_harden_core_rls.sql

-- ===================================================================
-- BEGIN: 20260302_allow_table_delete_with_order_history.sql
-- ===================================================================

alter table public.orders
  alter column table_id drop not null;

alter table public.orders
  drop constraint if exists orders_table_id_fkey;

alter table public.orders
  add constraint orders_table_id_fkey
  foreign key (table_id)
  references public.tables (id)
  on update cascade
  on delete set null;

-- END: 20260302_allow_table_delete_with_order_history.sql

-- ===================================================================
-- BEGIN: 20260302_fix_profiles_rls_recursion.sql
-- ===================================================================

create or replace function public.can_read_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_management()
    and exists (
      select 1
      from public.staff_branch_access actor_access
      join public.staff_branch_access target_access
        on target_access.profile_id = target_profile
       and target_access.business_id = actor_access.business_id
      where actor_access.profile_id = auth.uid()
    )
$$;

create or replace function public.can_owner_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_owner()
    and exists (
      select 1
      from public.staff_branch_access actor_access
      join public.staff_branch_access target_access
        on target_access.profile_id = target_profile
       and target_access.business_id = actor_access.business_id
      where actor_access.profile_id = auth.uid()
    )
$$;

drop policy if exists "management read profiles scoped" on public.profiles;
drop policy if exists "owner update profiles scoped" on public.profiles;
drop policy if exists "owner delete profiles scoped" on public.profiles;

create policy "management read profiles scoped" on public.profiles
for select to authenticated
using (
  auth.uid() = id
  or public.can_read_profile(id)
);

create policy "owner update profiles scoped" on public.profiles
for update to authenticated
using (
  auth.uid() = id
  or public.can_owner_profile(id)
)
with check (
  auth.uid() = id
  or public.can_owner_profile(id)
);

create policy "owner delete profiles scoped" on public.profiles
for delete to authenticated
using (public.can_owner_profile(id));

-- END: 20260302_fix_profiles_rls_recursion.sql

-- ===================================================================
-- BEGIN: 20260302_scope_profiles_rls.sql
-- ===================================================================

drop policy if exists "admin full profiles" on public.profiles;
drop policy if exists "management read profiles scoped" on public.profiles;
drop policy if exists "owner update profiles scoped" on public.profiles;
drop policy if exists "owner delete profiles scoped" on public.profiles;

create policy "management read profiles scoped" on public.profiles
for select to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles actor
    join public.staff_branch_access actor_access
      on actor_access.profile_id = actor.id
    join public.staff_branch_access target_access
      on target_access.profile_id = public.profiles.id
     and target_access.business_id = actor_access.business_id
    where actor.id = auth.uid()
      and actor.role in ('owner', 'admin')
  )
);

create policy "owner update profiles scoped" on public.profiles
for update to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles actor
    join public.staff_branch_access actor_access
      on actor_access.profile_id = actor.id
    join public.staff_branch_access target_access
      on target_access.profile_id = public.profiles.id
     and target_access.business_id = actor_access.business_id
    where actor.id = auth.uid()
      and actor.role = 'owner'
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles actor
    join public.staff_branch_access actor_access
      on actor_access.profile_id = actor.id
    join public.staff_branch_access target_access
      on target_access.profile_id = public.profiles.id
     and target_access.business_id = actor_access.business_id
    where actor.id = auth.uid()
      and actor.role = 'owner'
  )
);

create policy "owner delete profiles scoped" on public.profiles
for delete to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    join public.staff_branch_access actor_access
      on actor_access.profile_id = actor.id
    join public.staff_branch_access target_access
      on target_access.profile_id = public.profiles.id
     and target_access.business_id = actor_access.business_id
    where actor.id = auth.uid()
      and actor.role = 'owner'
  )
);

-- END: 20260302_scope_profiles_rls.sql

-- ===================================================================
-- BEGIN: 20260303_add_current_app_context_rpc.sql
-- ===================================================================

create or replace function public.get_current_app_context(target_business uuid)
returns table (
  role public.app_role,
  access_scope text,
  primary_branch_id uuid,
  branch_access_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  with current_profile as (
    select p.role
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ),
  access_rows as (
    select
      sba.branch_id,
      sba.access_scope,
      sba.is_primary
    from public.staff_branch_access sba
    where sba.profile_id = auth.uid()
      and sba.business_id = target_business
  )
  select
    cp.role,
    coalesce(
      case
        when exists(select 1 from access_rows ar where ar.access_scope = 'business') then 'business'
        when exists(select 1 from access_rows) then 'branch'
        when cp.role = 'owner' then 'business'
        else 'branch'
      end,
      'business'
    ) as access_scope,
    coalesce(
      (
        select ar.branch_id
        from access_rows ar
        where ar.is_primary is true
          and ar.branch_id is not null
        limit 1
      ),
      (
        select ar.branch_id
        from access_rows ar
        where ar.branch_id is not null
        limit 1
      )
    ) as primary_branch_id,
    coalesce(
      (
        select array_agg(ar.branch_id)
        from access_rows ar
        where ar.branch_id is not null
      ),
      '{}'::uuid[]
    ) as branch_access_ids
  from current_profile cp
$$;

-- END: 20260303_add_current_app_context_rpc.sql

-- ===================================================================
-- BEGIN: 20260303_add_platform_access.sql
-- ===================================================================

create table if not exists public.platform_access_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'observer',
  permissions text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_access_users_role_check check (
    role in (
      'platform_owner',
      'platform_admin',
      'support_manager',
      'support_agent',
      'billing_manager',
      'content_manager',
      'content_editor',
      'observer'
    )
  )
);

drop trigger if exists trg_platform_access_users_updated_at on public.platform_access_users;
create trigger trg_platform_access_users_updated_at before update on public.platform_access_users
for each row execute function public.set_updated_at();

create index if not exists idx_platform_access_users_email on public.platform_access_users (email);
create index if not exists idx_platform_access_users_role on public.platform_access_users (role);

alter table public.platform_access_users enable row level security;

drop policy if exists "deny direct platform access reads" on public.platform_access_users;
create policy "deny direct platform access reads" on public.platform_access_users
for select to authenticated using (false);

drop policy if exists "deny direct platform access writes" on public.platform_access_users;
create policy "deny direct platform access writes" on public.platform_access_users
for all to authenticated using (false) with check (false);

insert into public.platform_access_users (email, full_name, role, permissions, is_active)
values (
  'msamedcbn@gmail.com',
  'Platform Owner',
  'platform_owner',
  '{}'::text[],
  true
)
on conflict (email) do update
set role = 'platform_owner',
    is_active = true;

-- END: 20260303_add_platform_access.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_access.sql
-- ===================================================================

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

-- END: 20260303_add_support_access.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_audit_logs.sql
-- ===================================================================

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

-- END: 20260303_add_support_audit_logs.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_feature_flags.sql
-- ===================================================================

create table if not exists public.support_feature_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, feature_key)
);

drop trigger if exists trg_support_feature_flag_overrides_updated_at on public.support_feature_flag_overrides;
create trigger trg_support_feature_flag_overrides_updated_at before update on public.support_feature_flag_overrides
for each row execute function public.set_updated_at();

create index if not exists idx_support_feature_flag_overrides_business_id on public.support_feature_flag_overrides (business_id);

alter table public.support_feature_flag_overrides enable row level security;

drop policy if exists "deny direct support feature flag reads" on public.support_feature_flag_overrides;
create policy "deny direct support feature flag reads" on public.support_feature_flag_overrides
for select to authenticated using (false);

drop policy if exists "deny direct support feature flag writes" on public.support_feature_flag_overrides;
create policy "deny direct support feature flag writes" on public.support_feature_flag_overrides
for all to authenticated using (false) with check (false);

-- END: 20260303_add_support_feature_flags.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_incident_updates.sql
-- ===================================================================

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

-- END: 20260303_add_support_incident_updates.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_incidents.sql
-- ===================================================================

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

-- END: 20260303_add_support_incidents.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_knowledge_articles.sql
-- ===================================================================

create table if not exists public.support_knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general',
  summary text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_support_knowledge_articles_updated_at on public.support_knowledge_articles;
create trigger trg_support_knowledge_articles_updated_at before update on public.support_knowledge_articles
for each row execute function public.set_updated_at();

alter table public.support_knowledge_articles enable row level security;

drop policy if exists "deny direct support knowledge reads" on public.support_knowledge_articles;
create policy "deny direct support knowledge reads" on public.support_knowledge_articles
for select to authenticated using (false);

drop policy if exists "deny direct support knowledge writes" on public.support_knowledge_articles;
create policy "deny direct support knowledge writes" on public.support_knowledge_articles
for all to authenticated using (false) with check (false);

insert into public.support_knowledge_articles (title, category, summary, body)
values
  ('Onboarding Kontrolu', 'onboarding', 'Go-live oncesi temel kontrol listesi.', 'Urunler, masalar, personel, yazdirma ve ilk siparis akisi kontrol edilir.'),
  ('Paket Degisikligi Politikalari', 'billing', 'Upgrade ve downgrade sureci icin referans notu.', 'Tenant panelinden dogrudan paket degistirilmez. Talep support ve billing onayiyla islenir.'),
  ('Kritik Incident Yonetimi', 'incident', 'Kritik hata durumunda izlenecek yol.', 'Incident acilir, sorumlu atanir, tenant etkisi not edilir ve durum resolved/closed akisiyla kapanir.')
on conflict do nothing;

-- END: 20260303_add_support_knowledge_articles.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_plan_requests.sql
-- ===================================================================

create table if not exists public.support_plan_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  current_plan text not null,
  requested_plan text not null,
  reason text,
  status text not null default 'open',
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_by_support_user_id uuid references public.support_access_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_plan_requests_current_plan_check check (current_plan in ('starter', 'growth', 'custom')),
  constraint support_plan_requests_requested_plan_check check (requested_plan in ('starter', 'growth', 'custom')),
  constraint support_plan_requests_status_check check (status in ('open', 'approved', 'rejected', 'cancelled'))
);

drop trigger if exists trg_support_plan_requests_updated_at on public.support_plan_requests;
create trigger trg_support_plan_requests_updated_at before update on public.support_plan_requests
for each row execute function public.set_updated_at();

create index if not exists idx_support_plan_requests_business_id on public.support_plan_requests (business_id);
create index if not exists idx_support_plan_requests_status on public.support_plan_requests (status);

alter table public.support_plan_requests enable row level security;

drop policy if exists "deny direct support plan requests reads" on public.support_plan_requests;
create policy "deny direct support plan requests reads" on public.support_plan_requests
for select to authenticated using (false);

drop policy if exists "deny direct support plan requests writes" on public.support_plan_requests;
create policy "deny direct support plan requests writes" on public.support_plan_requests
for all to authenticated using (false) with check (false);

-- END: 20260303_add_support_plan_requests.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_tenant_profiles.sql
-- ===================================================================

create table if not exists public.support_tenant_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  lifecycle_stage text not null default 'active',
  owner_name text,
  owner_email text,
  account_manager_name text,
  renewal_date date,
  billing_status text not null default 'healthy',
  risk_level text not null default 'low',
  account_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tenant_profiles_lifecycle_check check (lifecycle_stage in ('lead', 'demo', 'onboarding', 'active', 'at_risk', 'churned', 'archived')),
  constraint support_tenant_profiles_billing_check check (billing_status in ('healthy', 'attention', 'overdue')),
  constraint support_tenant_profiles_risk_check check (risk_level in ('low', 'medium', 'high'))
);

drop trigger if exists trg_support_tenant_profiles_updated_at on public.support_tenant_profiles;
create trigger trg_support_tenant_profiles_updated_at before update on public.support_tenant_profiles
for each row execute function public.set_updated_at();

alter table public.support_tenant_profiles enable row level security;

drop policy if exists "deny direct support tenant profile reads" on public.support_tenant_profiles;
create policy "deny direct support tenant profile reads" on public.support_tenant_profiles
for select to authenticated using (false);

drop policy if exists "deny direct support tenant profile writes" on public.support_tenant_profiles;
create policy "deny direct support tenant profile writes" on public.support_tenant_profiles
for all to authenticated using (false) with check (false);

-- END: 20260303_add_support_tenant_profiles.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_ticket_messages.sql
-- ===================================================================

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null default 'support',
  author_support_user_id uuid references public.support_access_users(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  message text not null,
  is_internal_note boolean not null default true,
  created_at timestamptz not null default now(),
  constraint support_ticket_messages_author_type_check check (author_type in ('tenant', 'support', 'system'))
);

create index if not exists idx_support_ticket_messages_ticket_id on public.support_ticket_messages (ticket_id);
create index if not exists idx_support_ticket_messages_created_at on public.support_ticket_messages (created_at desc);

alter table public.support_ticket_messages enable row level security;

drop policy if exists "deny direct support ticket messages reads" on public.support_ticket_messages;
create policy "deny direct support ticket messages reads" on public.support_ticket_messages
for select to authenticated using (false);

drop policy if exists "deny direct support ticket messages writes" on public.support_ticket_messages;
create policy "deny direct support ticket messages writes" on public.support_ticket_messages
for all to authenticated using (false) with check (false);

-- END: 20260303_add_support_ticket_messages.sql

-- ===================================================================
-- BEGIN: 20260303_add_support_tickets.sql
-- ===================================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null default 'support',
  priority text not null default 'normal',
  status text not null default 'open',
  subject text not null,
  description text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  assigned_to_support_user_id uuid references public.support_access_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint support_tickets_type_check check (type in ('support', 'plan_change', 'billing', 'onboarding', 'incident')),
  constraint support_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'resolved', 'closed'))
);

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

create index if not exists idx_support_tickets_business_id on public.support_tickets (business_id);
create index if not exists idx_support_tickets_status on public.support_tickets (status);
create index if not exists idx_support_tickets_assigned_user on public.support_tickets (assigned_to_support_user_id);

alter table public.support_tickets enable row level security;

drop policy if exists "deny direct support tickets reads" on public.support_tickets;
create policy "deny direct support tickets reads" on public.support_tickets
for select to authenticated using (false);

drop policy if exists "deny direct support tickets writes" on public.support_tickets;
create policy "deny direct support tickets writes" on public.support_tickets
for all to authenticated using (false) with check (false);

-- END: 20260303_add_support_tickets.sql

-- ===================================================================
-- BEGIN: 20260311_add_payment_idempotency.sql
-- ===================================================================

alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists uniq_payments_order_type_idempotency
  on public.payments (order_id, payment_type, idempotency_key)
  where idempotency_key is not null;

-- END: 20260311_add_payment_idempotency.sql

-- ===================================================================
-- BEGIN: 20260312_add_ops_performance_indexes.sql
-- ===================================================================

-- Ops and dashboard query performance improvements

create index if not exists idx_orders_branch_channel_fulfillment_created_at
  on public.orders (branch_id, channel, fulfillment_status, created_at desc);

create index if not exists idx_orders_branch_status_created_at
  on public.orders (branch_id, status, created_at desc);

create index if not exists idx_orders_business_branch_created_at
  on public.orders (business_id, branch_id, created_at desc);

create index if not exists idx_table_requests_branch_status_created_at
  on public.table_requests (branch_id, status, created_at desc);

create index if not exists idx_couriers_branch_active_name
  on public.couriers (branch_id, is_active, full_name);

create index if not exists idx_payments_order_created_at
  on public.payments (order_id, created_at desc);

-- END: 20260312_add_ops_performance_indexes.sql

-- ===================================================================
-- BEGIN: 20260312_convert_access_roles_to_enum.sql
-- ===================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_role') then
    create type public.platform_role as enum (
      'platform_owner',
      'platform_admin',
      'support_manager',
      'support_agent',
      'billing_manager',
      'content_manager',
      'content_editor',
      'observer'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_role') then
    create type public.support_role as enum (
      'support_admin',
      'support_agent',
      'billing_agent',
      'read_only'
    );
  end if;
end $$;

alter table public.platform_access_users
  drop constraint if exists platform_access_users_role_check;

alter table public.platform_access_users
  alter column role type public.platform_role
  using role::public.platform_role;

alter table public.platform_access_users
  alter column role set default 'observer'::public.platform_role;

alter table public.support_access_users
  drop constraint if exists support_access_users_role_check;

alter table public.support_access_users
  alter column role type public.support_role
  using role::public.support_role;

alter table public.support_access_users
  alter column role set default 'support_admin'::public.support_role;


-- END: 20260312_convert_access_roles_to_enum.sql

-- ===================================================================
-- BEGIN: 20260312_create_or_append_order_rpc.sql
-- ===================================================================

create or replace function public.create_or_append_order(
  p_business_id uuid,
  p_branch_id uuid,
  p_table_id uuid,
  p_channel text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_note text,
  p_courier_id uuid,
  p_courier_name text,
  p_courier_phone text,
  p_fulfillment_status text,
  p_total_price numeric,
  p_items jsonb
)
returns table(order_id uuid, created_new boolean)
language plpgsql
as $$
declare
  v_existing_id uuid;
  v_existing_total numeric;
  v_existing_final numeric;
  v_existing_items jsonb;
  v_item jsonb;
  v_modifier jsonb;
begin
  if p_channel = 'dine_in' and p_table_id is not null then
    select o.id, o.total_price, coalesce(o.final_price, o.total_price), coalesce(o.items, '[]'::jsonb)
      into v_existing_id, v_existing_total, v_existing_final, v_existing_items
    from public.orders o
    where o.table_id = p_table_id
      and o.channel = 'dine_in'
      and o.status in ('pending', 'preparing', 'served')
      and (p_business_id is null or o.business_id = p_business_id)
      and (p_branch_id is null or o.branch_id = p_branch_id)
    order by o.created_at desc
    limit 1
    for update;
  end if;

  if v_existing_id is null then
    insert into public.orders (
      business_id,
      branch_id,
      table_id,
      items,
      total_price,
      final_price,
      discount_amount,
      service_fee,
      channel,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_note,
      courier_id,
      courier_name,
      courier_phone,
      fulfillment_status,
      status
    ) values (
      p_business_id,
      p_branch_id,
      p_table_id,
      coalesce(p_items, '[]'::jsonb),
      p_total_price,
      p_total_price,
      0,
      0,
      p_channel,
      p_customer_name,
      p_customer_phone,
      p_delivery_address,
      p_delivery_note,
      p_courier_id,
      p_courier_name,
      p_courier_phone,
      p_fulfillment_status,
      'pending'
    )
    returning id into order_id;
    created_new := true;
  else
    order_id := v_existing_id;
    created_new := false;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    ) values (
      order_id,
      nullif(v_item->>'product_id', '')::uuid,
      coalesce(v_item->>'name', ''),
      coalesce((v_item->>'quantity')::numeric, 0),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'line_total')::numeric, 0)
    );

    for v_modifier in
      select * from jsonb_array_elements(coalesce(v_item->'modifiers', '[]'::jsonb))
    loop
      insert into public.order_item_modifiers (
        order_id,
        product_id,
        product_name,
        modifier_group_name,
        modifier_option_name,
        price_delta,
        quantity
      ) values (
        order_id,
        nullif(v_item->>'product_id', '')::uuid,
        coalesce(v_item->>'name', ''),
        coalesce(v_modifier->>'group_name', ''),
        coalesce(v_modifier->>'option_name', ''),
        coalesce((v_modifier->>'price_delta')::numeric, 0),
        coalesce((v_modifier->>'quantity')::numeric, coalesce((v_item->>'quantity')::numeric, 1))
      );
    end loop;
  end loop;

  if created_new = false then
    update public.orders
    set items = coalesce(v_existing_items, '[]'::jsonb) || coalesce(p_items, '[]'::jsonb),
        total_price = coalesce(v_existing_total, 0) + coalesce(p_total_price, 0),
        final_price = coalesce(v_existing_final, coalesce(v_existing_total, 0)) + coalesce(p_total_price, 0),
        status = 'pending'
    where id = order_id;
  end if;

  return next;
end;
$$;


-- END: 20260312_create_or_append_order_rpc.sql

-- ===================================================================
-- BEGIN: 20260312_harden_remaining_rls.sql
-- ===================================================================

alter table public.ingredients
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

update public.ingredients i
set business_id = mapped.business_id
from (
  select pi.ingredient_id, min(p.business_id::text)::uuid as business_id
  from public.product_ingredients pi
  join public.products p on p.id = pi.product_id
  group by pi.ingredient_id
) mapped
where i.id = mapped.ingredient_id
  and i.business_id is null;

alter table public.ingredients
  drop constraint if exists ingredients_name_key;
create unique index if not exists uniq_ingredients_business_name
  on public.ingredients (business_id, lower(name))
  where business_id is not null;

drop policy if exists "staff full order_items" on public.order_items;
create policy "staff read order_items scoped" on public.order_items
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_access_branch(o.branch_id)
  )
);
create policy "management manage order_items scoped" on public.order_items
for all to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_manage_branch(o.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_manage_branch(o.branch_id)
  )
);

drop policy if exists "staff full ingredients" on public.ingredients;
create policy "staff read ingredients scoped" on public.ingredients
for select to authenticated
using (
  (business_id is not null and public.can_access_business(business_id))
  or exists (
    select 1
    from public.product_ingredients pi
    join public.products p on p.id = pi.product_id
    where pi.ingredient_id = ingredients.id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage ingredients scoped" on public.ingredients
for all to authenticated
using (
  public.current_is_management()
  and (
    (business_id is not null and public.can_manage_business(business_id))
    or not exists (select 1 from public.product_ingredients pi where pi.ingredient_id = ingredients.id)
  )
)
with check (
  public.current_is_management()
  and (
    business_id is null
    or public.can_manage_business(business_id)
  )
);

drop policy if exists "staff full product_ingredients" on public.product_ingredients;
create policy "staff read product_ingredients scoped" on public.product_ingredients
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_ingredients scoped" on public.product_ingredients
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full stock_movements" on public.stock_movements;
create policy "staff read stock_movements scoped" on public.stock_movements
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage stock_movements scoped" on public.stock_movements
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full product_modifier_groups" on public.product_modifier_groups;
create policy "staff read product_modifier_groups scoped" on public.product_modifier_groups
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_modifier_groups scoped" on public.product_modifier_groups
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full product_modifier_options" on public.product_modifier_options;
create policy "staff read product_modifier_options scoped" on public.product_modifier_options
for select to authenticated
using (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_modifier_options scoped" on public.product_modifier_options
for all to authenticated
using (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full order_item_modifiers" on public.order_item_modifiers;
create policy "staff read order_item_modifiers scoped" on public.order_item_modifiers
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_access_branch(o.branch_id)
  )
);
create policy "management manage order_item_modifiers scoped" on public.order_item_modifiers
for all to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_manage_branch(o.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_manage_branch(o.branch_id)
  )
);

drop policy if exists "staff full alert_dispatches" on public.alert_dispatches;
create policy "deny direct alert_dispatches access" on public.alert_dispatches
for all to authenticated
using (false)
with check (false);

drop policy if exists "staff full audit_logs" on public.audit_logs;
create policy "management read audit_logs scoped" on public.audit_logs
for select to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1
    from public.staff_branch_access actor_access
    join public.staff_branch_access target_access
      on target_access.profile_id = audit_logs.actor_id
     and target_access.business_id = actor_access.business_id
    where actor_access.profile_id = auth.uid()
      and public.current_is_management()
  )
);
create policy "management insert audit_logs" on public.audit_logs
for insert to authenticated
with check (public.current_is_management());

-- END: 20260312_harden_remaining_rls.sql

-- ===================================================================
-- BEGIN: 20260316_add_category_prep_station.sql
-- ===================================================================

alter table public.categories
  add column if not exists prep_station text;

update public.categories
set prep_station = 'kitchen'
where prep_station is null;

alter table public.categories
  alter column prep_station set default 'kitchen';

alter table public.categories
  alter column prep_station set not null;

alter table public.categories
  drop constraint if exists categories_prep_station_check;

alter table public.categories
  add constraint categories_prep_station_check
  check (prep_station in ('kitchen', 'bar', 'dessert'));

create index if not exists idx_categories_business_prep_station
  on public.categories (business_id, prep_station, sort_order);

-- END: 20260316_add_category_prep_station.sql

-- ===================================================================
-- BEGIN: 20260316_add_table_zones.sql
-- ===================================================================

create table if not exists public.table_zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_zones_business_branch_name_unique unique (business_id, branch_id, name)
);

drop trigger if exists trg_table_zones_updated_at on public.table_zones;
create trigger trg_table_zones_updated_at before update on public.table_zones
for each row execute function public.set_updated_at();

alter table public.tables
  add column if not exists zone_id uuid references public.table_zones (id) on delete set null;

insert into public.table_zones (business_id, branch_id, name, sort_order)
select distinct t.business_id, t.branch_id, 'Ana Salon', 0
from public.tables t
where t.business_id is not null
  and t.branch_id is not null
on conflict (business_id, branch_id, name) do nothing;

update public.tables t
set zone_id = z.id
from public.table_zones z
where t.zone_id is null
  and z.business_id = t.business_id
  and z.branch_id = t.branch_id
  and z.name = 'Ana Salon';

create index if not exists idx_table_zones_branch_sort on public.table_zones (branch_id, sort_order, name);
create index if not exists idx_tables_zone_id on public.tables (zone_id);

alter table public.table_zones enable row level security;

drop policy if exists "staff full table_zones" on public.table_zones;
create policy "staff read table_zones scoped" on public.table_zones
for select to authenticated
using (public.can_access_branch(branch_id));

create policy "management manage table_zones scoped" on public.table_zones
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

-- END: 20260316_add_table_zones.sql

-- ===================================================================
-- BEGIN: 20260316_scope_table_number_by_zone.sql
-- ===================================================================

alter table public.tables
  drop constraint if exists tables_business_table_number_unique;

alter table public.tables
  drop constraint if exists tables_table_number_key;

drop index if exists public.uniq_tables_business_branch_zone_table_number;
drop index if exists public.uniq_tables_business_branch_nozone_table_number;

create unique index if not exists uniq_tables_business_branch_zone_table_number
  on public.tables (
    business_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    table_number
  );

-- END: 20260316_scope_table_number_by_zone.sql

