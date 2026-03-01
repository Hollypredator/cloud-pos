do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_channel') then
    create type public.order_channel as enum ('dine_in', 'pickup', 'delivery');
  end if;

  if not exists (select 1 from pg_type where typname = 'fulfillment_status') then
    create type public.fulfillment_status as enum (
      'not_applicable',
      'awaiting_dispatch',
      'out_for_delivery',
      'completed'
    );
  end if;
end $$;

alter table public.orders
  alter column table_id drop not null;

alter table public.orders
  add column if not exists channel public.order_channel not null default 'dine_in',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists delivery_note text,
  add column if not exists courier_name text,
  add column if not exists courier_phone text,
  add column if not exists fulfillment_status public.fulfillment_status not null default 'not_applicable';

update public.orders
set channel = 'dine_in'
where channel is null;

update public.orders
set fulfillment_status = 'not_applicable'
where fulfillment_status is null;

create index if not exists idx_orders_channel on public.orders (channel);
create index if not exists idx_orders_fulfillment_status on public.orders (fulfillment_status);
