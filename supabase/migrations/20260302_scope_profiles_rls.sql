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
