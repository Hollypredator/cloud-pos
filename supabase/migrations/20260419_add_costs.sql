-- Migration: Add cost columns to ingredients and products
-- Created at: 2026-04-19

-- Add cost to ingredients (per unit)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'ingredients' and column_name = 'cost') then
    alter table public.ingredients add column cost numeric(12,2) not null default 0;
  end if;
end $$;

-- Add cost to products (direct cost or overhead)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'cost') then
    alter table public.products add column cost numeric(12,2) not null default 0;
  end if;
end $$;
