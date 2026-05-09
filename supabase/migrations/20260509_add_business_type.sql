alter table public.businesses
  add column if not exists business_type text;

update public.businesses
set business_type = 'restaurant_cafe'
where business_type is null;

alter table public.businesses
  alter column business_type set default 'restaurant_cafe';

alter table public.businesses
  alter column business_type set not null;

alter table public.businesses
  drop constraint if exists businesses_business_type_check;

alter table public.businesses
  add constraint businesses_business_type_check
  check (business_type in ('restaurant_cafe', 'self_service_coffee'));

create index if not exists idx_businesses_business_type
  on public.businesses (business_type);
