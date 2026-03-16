alter table public.orders
  add column if not exists station_statuses jsonb not null default '{}'::jsonb;

with station_rows as (
  select
    oi.order_id,
    case
      when c.prep_station in ('kitchen', 'bar', 'dessert') then c.prep_station
      else 'kitchen'
    end as station
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  left join public.categories c on c.id = p.category_id
),
aggregated as (
  select
    s.order_id,
    jsonb_object_agg(s.station, 'pending') as station_statuses
  from (
    select distinct order_id, station
    from station_rows
  ) s
  group by s.order_id
)
update public.orders o
set station_statuses = aggregated.station_statuses
from aggregated
where o.id = aggregated.order_id
  and (o.station_statuses is null or o.station_statuses = '{}'::jsonb);

update public.orders
set station_statuses = jsonb_build_object(
  'kitchen',
  case
    when status = 'served' then 'served'
    when status = 'preparing' then 'preparing'
    else 'pending'
  end
)
where (station_statuses is null or station_statuses = '{}'::jsonb)
  and status in ('pending', 'preparing', 'served');

create index if not exists idx_orders_station_statuses_gin
  on public.orders using gin (station_statuses jsonb_path_ops);
