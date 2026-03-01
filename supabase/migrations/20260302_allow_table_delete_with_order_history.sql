alter table public.orders
  alter column table_id drop not null;

alter table public.orders
  drop constraint if exists orders_table_id_fkey;

alter table public.orders
  add constraint orders_table_id_fkey
  foreign key (table_id)
  references public.tables (id)
  on update cascade
  on delete set null;
