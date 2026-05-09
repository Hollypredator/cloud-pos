create table if not exists public.order_confirmation_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  table_id uuid references public.tables (id) on delete set null,
  qr_code_identifier text not null,
  confirmed_at timestamptz not null,
  cancel_until timestamptz not null,
  snapshot_json jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  ui_version text not null default 'qr-confirmation-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_order_confirmation_snapshots_order_id
  on public.order_confirmation_snapshots (order_id, created_at desc);

create index if not exists idx_order_confirmation_snapshots_qr_created_at
  on public.order_confirmation_snapshots (qr_code_identifier, created_at desc);

create index if not exists idx_order_confirmation_snapshots_created_at
  on public.order_confirmation_snapshots (created_at desc);

alter table public.order_confirmation_snapshots enable row level security;

drop policy if exists "direct access order confirmation snapshots denied" on public.order_confirmation_snapshots;
create policy "direct access order confirmation snapshots denied" on public.order_confirmation_snapshots
for all
to anon, authenticated
using (false)
with check (false);
