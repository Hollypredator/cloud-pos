alter table public.tables
  add column if not exists position_x numeric,
  add column if not exists position_y numeric;

comment on column public.tables.position_x is 'Floor plan canvas X position, 0-100 percent of container width';
comment on column public.tables.position_y is 'Floor plan canvas Y position, 0-100 percent of container height';
