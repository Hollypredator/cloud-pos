create table if not exists public.table_supervisors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid null references public.businesses(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'table_supervisors_table_id_unique'
  ) then
    alter table public.table_supervisors
      add constraint table_supervisors_table_id_unique unique (table_id);
  end if;
end $$;

create index if not exists idx_table_supervisors_business_branch
  on public.table_supervisors (business_id, branch_id);

create index if not exists idx_table_supervisors_profile
  on public.table_supervisors (profile_id);

update public.table_supervisors ts
set
  business_id = coalesce(ts.business_id, t.business_id),
  branch_id = coalesce(ts.branch_id, t.branch_id),
  updated_at = timezone('utc', now())
from public.tables t
where t.id = ts.table_id
  and (
    ts.business_id is null
    or (ts.branch_id is null and t.branch_id is not null)
  );