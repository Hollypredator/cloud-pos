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
