alter table public.tables
  add column if not exists name text;

update public.tables
set name = concat('Masa ', table_number)
where name is null or btrim(name) = '';
