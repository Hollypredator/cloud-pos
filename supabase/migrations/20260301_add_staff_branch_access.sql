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
