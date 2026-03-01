do $$
begin
  if not exists (select 1 from pg_type where typname = 'studio_role') then
    create type public.studio_role as enum ('owner', 'editor');
  end if;
end $$;

alter table public.studio_access_users
add column if not exists role public.studio_role not null default 'owner';
