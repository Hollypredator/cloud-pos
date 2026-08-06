alter table public.tables
  add column if not exists seat_count integer not null default 4;

comment on column public.tables.seat_count is 'Table capacity used to size/shape the floor plan node (2/4/6/8+ seats)';
