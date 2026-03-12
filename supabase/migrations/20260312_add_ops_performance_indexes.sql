-- Ops and dashboard query performance improvements

create index if not exists idx_orders_branch_channel_fulfillment_created_at
  on public.orders (branch_id, channel, fulfillment_status, created_at desc);

create index if not exists idx_orders_branch_status_created_at
  on public.orders (branch_id, status, created_at desc);

create index if not exists idx_orders_business_branch_created_at
  on public.orders (business_id, branch_id, created_at desc);

create index if not exists idx_table_requests_branch_status_created_at
  on public.table_requests (branch_id, status, created_at desc);

create index if not exists idx_couriers_branch_active_name
  on public.couriers (branch_id, is_active, full_name);

create index if not exists idx_payments_order_created_at
  on public.payments (order_id, created_at desc);
