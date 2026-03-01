do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_plan') then
    create type public.business_plan as enum ('starter', 'growth', 'custom');
  end if;
end $$;

alter table public.businesses
  add column if not exists plan public.business_plan not null default 'growth';

update public.businesses
set plan = 'growth'
where plan is null;

create index if not exists idx_businesses_plan on public.businesses (plan);
