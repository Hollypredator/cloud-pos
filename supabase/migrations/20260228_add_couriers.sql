create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_couriers_updated_at on public.couriers;
create trigger trg_couriers_updated_at before update on public.couriers
for each row execute function public.set_updated_at();

alter table public.orders
  add column if not exists courier_id uuid references public.couriers (id) on delete set null;

create index if not exists idx_couriers_business_id on public.couriers (business_id);
create index if not exists idx_couriers_is_active on public.couriers (is_active);
create index if not exists idx_orders_courier_id on public.orders (courier_id);

alter table public.couriers enable row level security;

drop policy if exists "staff full couriers" on public.couriers;
create policy "staff full couriers" on public.couriers
for all to authenticated using (true) with check (true);
