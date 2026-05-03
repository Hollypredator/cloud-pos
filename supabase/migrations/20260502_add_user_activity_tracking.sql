-- Add last_seen_at to profiles and access users
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.platform_access_users add column if not exists last_seen_at timestamptz;
alter table public.studio_access_users add column if not exists last_seen_at timestamptz;

-- Create a function to update last seen
create or replace function public.update_last_seen(user_id uuid, table_name text)
returns void as $$
begin
  if table_name = 'profiles' then
    update public.profiles set last_seen_at = now() where id = user_id;
  elsif table_name = 'platform_access_users' then
    update public.platform_access_users set last_seen_at = now() where id = user_id;
  elsif table_name = 'studio_access_users' then
    update public.studio_access_users set last_seen_at = now() where id = user_id;
  end if;
end;
$$ language plpgsql security definer;
