-- Phase 3: ingredient management for products
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'adet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_ingredients (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id)
);

drop trigger if exists trg_ingredients_updated_at on public.ingredients;
create trigger trg_ingredients_updated_at before update on public.ingredients
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_ingredients_updated_at on public.product_ingredients;
create trigger trg_product_ingredients_updated_at before update on public.product_ingredients
for each row execute function public.set_updated_at();

create index if not exists idx_product_ingredients_product_id on public.product_ingredients (product_id);
create index if not exists idx_product_ingredients_ingredient_id on public.product_ingredients (ingredient_id);

alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;

drop policy if exists "staff full ingredients" on public.ingredients;
create policy "staff full ingredients" on public.ingredients
for all to authenticated using (true) with check (true);

drop policy if exists "staff full product_ingredients" on public.product_ingredients;
create policy "staff full product_ingredients" on public.product_ingredients
for all to authenticated using (true) with check (true);

