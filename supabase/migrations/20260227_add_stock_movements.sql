-- Phase 3: stock movement history
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  change_amount integer not null,
  previous_stock integer not null,
  new_stock integer not null,
  reason text not null default 'manual_update',
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product_id on public.stock_movements (product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements (created_at desc);

create or replace function public.log_stock_change()
returns trigger
language plpgsql
as $$
begin
  if new.stock_count is distinct from old.stock_count then
    insert into public.stock_movements (
      product_id,
      change_amount,
      previous_stock,
      new_stock,
      reason
    )
    values (
      new.id,
      new.stock_count - old.stock_count,
      old.stock_count,
      new.stock_count,
      'manual_update'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_log_stock_change on public.products;
create trigger trg_products_log_stock_change
after update on public.products
for each row execute function public.log_stock_change();

alter table public.stock_movements enable row level security;

drop policy if exists "staff full stock_movements" on public.stock_movements;
create policy "staff full stock_movements" on public.stock_movements
for all to authenticated using (true) with check (true);

