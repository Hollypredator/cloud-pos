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
