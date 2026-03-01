create table if not exists public.product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_modifier_groups_updated_at on public.product_modifier_groups;
create trigger trg_product_modifier_groups_updated_at before update on public.product_modifier_groups
for each row execute function public.set_updated_at();

create table if not exists public.product_modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_modifier_groups (id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_modifier_options_updated_at on public.product_modifier_options;
create trigger trg_product_modifier_options_updated_at before update on public.product_modifier_options
for each row execute function public.set_updated_at();

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  modifier_group_name text not null,
  modifier_option_name text not null,
  price_delta numeric(12,2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_modifier_groups_product_id on public.product_modifier_groups (product_id);
create index if not exists idx_modifier_options_group_id on public.product_modifier_options (group_id);
create index if not exists idx_order_item_modifiers_order_id on public.order_item_modifiers (order_id);

alter table public.product_modifier_groups enable row level security;
alter table public.product_modifier_options enable row level security;
alter table public.order_item_modifiers enable row level security;

drop policy if exists "staff full product_modifier_groups" on public.product_modifier_groups;
create policy "staff full product_modifier_groups" on public.product_modifier_groups
for all to authenticated using (true) with check (true);

drop policy if exists "staff full product_modifier_options" on public.product_modifier_options;
create policy "staff full product_modifier_options" on public.product_modifier_options
for all to authenticated using (true) with check (true);

drop policy if exists "staff full order_item_modifiers" on public.order_item_modifiers;
create policy "staff full order_item_modifiers" on public.order_item_modifiers
for all to authenticated using (true) with check (true);
