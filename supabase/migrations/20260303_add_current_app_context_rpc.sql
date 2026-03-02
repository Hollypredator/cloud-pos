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
