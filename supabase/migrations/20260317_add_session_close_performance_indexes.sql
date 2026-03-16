-- Session close and open-check performance improvements

create index if not exists idx_cash_register_sessions_open_scope
  on public.cash_register_sessions (business_id, branch_id, opened_at)
  where status = 'open';

create index if not exists idx_orders_open_check_scope
  on public.orders (business_id, branch_id, status)
  where status in ('pending', 'preparing', 'served');

create index if not exists idx_payments_cash_scope_created_at
  on public.payments (business_id, branch_id, created_at desc)
  where method = 'cash';
