alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists uniq_payments_order_type_idempotency
  on public.payments (order_id, payment_type, idempotency_key)
  where idempotency_key is not null;
