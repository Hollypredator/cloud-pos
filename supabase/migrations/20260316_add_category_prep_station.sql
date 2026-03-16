alter table public.categories
  add column if not exists prep_station text;

update public.categories
set prep_station = 'kitchen'
where prep_station is null;

alter table public.categories
  alter column prep_station set default 'kitchen';

alter table public.categories
  alter column prep_station set not null;

alter table public.categories
  drop constraint if exists categories_prep_station_check;

alter table public.categories
  add constraint categories_prep_station_check
  check (prep_station in ('kitchen', 'bar', 'dessert'));

create index if not exists idx_categories_business_prep_station
  on public.categories (business_id, prep_station, sort_order);
