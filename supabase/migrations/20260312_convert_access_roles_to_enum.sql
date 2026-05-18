do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_role') then
    create type public.platform_role as enum (
      'platform_owner',
      'platform_admin',
      'support_manager',
      'support_agent',
      'billing_manager',
      'content_manager',
      'content_editor',
      'observer'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_role') then
    create type public.support_role as enum (
      'support_admin',
      'support_agent',
      'billing_agent',
      'read_only'
    );
  end if;
end $$;

alter table public.platform_access_users
  drop constraint if exists platform_access_users_role_check;

alter table public.platform_access_users
  alter column role drop default;

alter table public.platform_access_users
  alter column role type public.platform_role
  using role::public.platform_role;

alter table public.platform_access_users
  alter column role set default 'observer'::public.platform_role;

alter table public.support_access_users
  drop constraint if exists support_access_users_role_check;

alter table public.support_access_users
  alter column role drop default;

alter table public.support_access_users
  alter column role type public.support_role
  using role::public.support_role;

alter table public.support_access_users
  alter column role set default 'support_admin'::public.support_role;
