-- Seed operational/demo access mappings for known staff accounts.
-- Note: Supabase Auth passwords are not managed in SQL migrations.
-- This migration links roles/scopes for users that already exist in auth.users.

do $$
declare
  v_business_id uuid;
  v_branch_id uuid;
  v_profiles_has_business_id boolean;
begin
  select id
  into v_business_id
  from public.businesses
  order by created_at asc
  limit 1;

  if v_business_id is null then
    raise notice 'No business found. Skipping demo/owner access seed.';
    return;
  end if;

  select id
  into v_branch_id
  from public.branches
  where business_id = v_business_id
  order by created_at asc
  limit 1;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'business_id'
  ) into v_profiles_has_business_id;

  -- Ensure profile role + business mapping
  if v_profiles_has_business_id then
    insert into public.profiles (id, role, business_id)
    select
      u.id,
      case lower(u.email)
        when 'msamedcbn@gmail.com' then 'owner'::public.app_role
        when 'demo-admin@cloudpos.local' then 'admin'::public.app_role
        when 'demo-kasa@cloudpos.local' then 'cashier'::public.app_role
        when 'demo-mutfak@cloudpos.local' then 'kitchen'::public.app_role
        when 'demo-servis@cloudpos.local' then 'waiter'::public.app_role
      end,
      v_business_id
    from auth.users u
    where lower(u.email) in (
      'msamedcbn@gmail.com',
      'demo-admin@cloudpos.local',
      'demo-kasa@cloudpos.local',
      'demo-mutfak@cloudpos.local',
      'demo-servis@cloudpos.local'
    )
    on conflict (id) do update
    set role = excluded.role,
        business_id = excluded.business_id;
  else
    insert into public.profiles (id, role)
    select
      u.id,
      case lower(u.email)
        when 'msamedcbn@gmail.com' then 'owner'::public.app_role
        when 'demo-admin@cloudpos.local' then 'admin'::public.app_role
        when 'demo-kasa@cloudpos.local' then 'cashier'::public.app_role
        when 'demo-mutfak@cloudpos.local' then 'kitchen'::public.app_role
        when 'demo-servis@cloudpos.local' then 'waiter'::public.app_role
      end
    from auth.users u
    where lower(u.email) in (
      'msamedcbn@gmail.com',
      'demo-admin@cloudpos.local',
      'demo-kasa@cloudpos.local',
      'demo-mutfak@cloudpos.local',
      'demo-servis@cloudpos.local'
    )
    on conflict (id) do update
    set role = excluded.role;
  end if;

  -- Reset existing scope rows for targeted users, then insert deterministic scope.
  delete from public.staff_branch_access sba
  using auth.users u
  where sba.profile_id = u.id
    and lower(u.email) in (
      'msamedcbn@gmail.com',
      'demo-admin@cloudpos.local',
      'demo-kasa@cloudpos.local',
      'demo-mutfak@cloudpos.local',
      'demo-servis@cloudpos.local'
    )
    and sba.business_id = v_business_id;

  insert into public.staff_branch_access (profile_id, business_id, branch_id, access_scope, is_primary)
  select
    u.id,
    v_business_id,
    case
      when lower(u.email) in ('msamedcbn@gmail.com', 'demo-admin@cloudpos.local') then null
      else v_branch_id
    end,
    case
      when lower(u.email) in ('msamedcbn@gmail.com', 'demo-admin@cloudpos.local') then 'business'::public.staff_access_scope
      else 'branch'::public.staff_access_scope
    end,
    true
  from auth.users u
  where lower(u.email) in (
    'msamedcbn@gmail.com',
    'demo-admin@cloudpos.local',
    'demo-kasa@cloudpos.local',
    'demo-mutfak@cloudpos.local',
    'demo-servis@cloudpos.local'
  );

  -- Platform/studio/support side full access for owner email.
  insert into public.platform_access_users (email, full_name, role, permissions, is_active)
  values ('msamedcbn@gmail.com', 'Platform Owner', 'platform_owner', '{}'::text[], true)
  on conflict (email) do update
  set role = 'platform_owner',
      is_active = true;

  insert into public.support_access_users (email, full_name, role, is_active)
  values ('msamedcbn@gmail.com', 'Support Owner', 'support_admin', true)
  on conflict (email) do update
  set role = 'support_admin',
      is_active = true;

  insert into public.studio_access_users (email, full_name, is_active)
  values ('msamedcbn@gmail.com', 'Studio Owner', true)
  on conflict (email) do update
  set is_active = true;
end $$;
