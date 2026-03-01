-- Multi-tenant baseline (single domain + business slug)
-- Amaç: Aynı uygulamada birden fazla işletmeyi ayırmak için tenant katmanı eklemek.

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

-- Varsayılan tenant (mevcut veriyi geriye dönük bozmaz)
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

-- Tenant bazlı unique kuralları
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
