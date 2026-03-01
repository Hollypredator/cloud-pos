do $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    begin
      alter type public.app_role add value if not exists 'owner';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
