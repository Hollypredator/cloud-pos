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
