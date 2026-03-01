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
