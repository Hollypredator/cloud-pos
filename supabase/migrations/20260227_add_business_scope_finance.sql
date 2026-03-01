-- Tenant scope for finance/session tables

alter table public.payments add column if not exists business_id uuid references public.businesses (id) on delete restrict;
alter table public.cash_register_sessions add column if not exists business_id uuid references public.businesses (id) on delete restrict;

update public.payments p
set business_id = o.business_id
from public.orders o
where p.business_id is null
  and p.order_id = o.id;

update public.cash_register_sessions
set business_id = (select id from public.businesses where slug = 'default' limit 1)
where business_id is null;

alter table public.payments alter column business_id set not null;
alter table public.cash_register_sessions alter column business_id set not null;

create index if not exists idx_payments_business_id on public.payments (business_id);
create index if not exists idx_cash_sessions_business_id on public.cash_register_sessions (business_id);
