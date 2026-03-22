-- Ops core aggregate RPCs and indexes for dashboard/cashier hot paths

create or replace function public.get_ops_snapshot_agg(
  p_business_id uuid default null,
  p_branch_id uuid default null
)
returns table(
  pending_orders bigint,
  preparing_orders bigint,
  served_orders bigint,
  delayed_kitchen_orders bigint,
  critical_kitchen_orders bigint,
  occupied_tables bigint,
  empty_tables bigint,
  open_service_requests bigint,
  today_revenue numeric(12,2)
)
language sql
stable
set search_path = public
as $$
  with scoped_orders as (
    select o.status, o.created_at
    from public.orders o
    where (p_business_id is null or o.business_id = p_business_id)
      and (p_branch_id is null or o.branch_id = p_branch_id)
  ),
  scoped_tables as (
    select t.status
    from public.tables t
    where (p_business_id is null or t.business_id = p_business_id)
      and (p_branch_id is null or t.branch_id = p_branch_id)
  ),
  scoped_requests as (
    select tr.status
    from public.table_requests tr
    where (p_business_id is null or tr.business_id = p_business_id)
      and (p_branch_id is null or tr.branch_id = p_branch_id)
  ),
  scoped_payments as (
    select p.payment_type, p.amount
    from public.payments p
    where (p_business_id is null or p.business_id = p_business_id)
      and (p_branch_id is null or p.branch_id = p_branch_id)
      and p.created_at >= date_trunc('day', now())
  )
  select
    (select count(*) from scoped_orders where status = 'pending')::bigint as pending_orders,
    (select count(*) from scoped_orders where status = 'preparing')::bigint as preparing_orders,
    (select count(*) from scoped_orders where status in ('ready', 'served', 'partially_paid'))::bigint as served_orders,
    (
      select count(*)
      from scoped_orders
      where (status = 'pending' and created_at <= now() - interval '15 minutes')
         or (status = 'preparing' and created_at <= now() - interval '20 minutes')
    )::bigint as delayed_kitchen_orders,
    (
      select count(*)
      from scoped_orders
      where (status = 'pending' and created_at <= now() - interval '25 minutes')
         or (status = 'preparing' and created_at <= now() - interval '35 minutes')
    )::bigint as critical_kitchen_orders,
    (select count(*) from scoped_tables where status = 'occupied')::bigint as occupied_tables,
    (select count(*) from scoped_tables where status = 'empty')::bigint as empty_tables,
    (select count(*) from scoped_requests where status = 'open')::bigint as open_service_requests,
    (
      select coalesce(
        sum(
          case
            when payment_type = 'sale' then amount
            when payment_type = 'refund' then -amount
            else 0
          end
        ),
        0
      )::numeric(12,2)
      from scoped_payments
    ) as today_revenue;
$$;

create or replace function public.get_order_payment_summary(
  p_order_ids uuid[]
)
returns table(
  order_id uuid,
  paid numeric(12,2),
  refunds numeric(12,2),
  net numeric(12,2),
  payment_count bigint
)
language sql
stable
set search_path = public
as $$
  with target_orders as (
    select distinct unnest(coalesce(p_order_ids, '{}'::uuid[])) as order_id
  )
  select
    t.order_id,
    coalesce(sum(case when p.payment_type = 'sale' then p.amount else 0 end), 0)::numeric(12,2) as paid,
    coalesce(sum(case when p.payment_type = 'refund' then p.amount else 0 end), 0)::numeric(12,2) as refunds,
    coalesce(
      sum(
        case
          when p.payment_type = 'sale' then p.amount
          when p.payment_type = 'refund' then -p.amount
          else 0
        end
      ),
      0
    )::numeric(12,2) as net,
    coalesce(count(*) filter (where p.payment_type = 'sale'), 0)::bigint as payment_count
  from target_orders t
  left join public.payments p on p.order_id = t.order_id
  group by t.order_id;
$$;

create index if not exists idx_orders_business_branch_status_created_desc
  on public.orders (business_id, branch_id, status, created_at desc);

create index if not exists idx_payments_business_branch_created_payment_type
  on public.payments (business_id, branch_id, created_at desc, payment_type);

create index if not exists idx_table_requests_business_branch_status
  on public.table_requests (business_id, branch_id, status);

create index if not exists idx_tables_business_branch_status
  on public.tables (business_id, branch_id, status);
