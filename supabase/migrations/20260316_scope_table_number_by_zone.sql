alter table public.tables
  drop constraint if exists tables_business_table_number_unique;

alter table public.tables
  drop constraint if exists tables_table_number_key;

drop index if exists public.uniq_tables_business_branch_zone_table_number;
drop index if exists public.uniq_tables_business_branch_nozone_table_number;

create unique index if not exists uniq_tables_business_branch_zone_table_number
  on public.tables (
    business_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    table_number
  );
