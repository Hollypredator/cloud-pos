alter table public.orders
  add column if not exists lock_version bigint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'ready'
  ) then
    alter type public.order_status add value 'ready';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'partially_paid'
  ) then
    alter type public.order_status add value 'partially_paid';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'partially_refunded'
  ) then
    alter type public.order_status add value 'partially_refunded';
  end if;
end $$;

create or replace function public.apply_order_payment_mutation(
  p_order_id uuid,
  p_payment_type public.payment_type,
  p_method public.payment_method,
  p_amount numeric,
  p_note text,
  p_created_by uuid,
  p_idempotency_key text,
  p_business_id uuid default null,
  p_branch_id uuid default null
)
returns table(
  applied boolean,
  idempotent boolean,
  payment_id uuid,
  next_status public.order_status,
  amount_paid numeric,
  remaining_balance numeric,
  conflict_reason text
)
language plpgsql
as $$
declare
  v_order record;
  v_existing_payment_id uuid;
  v_target_amount numeric(12,2);
  v_total_sales numeric(12,2);
  v_total_refunds numeric(12,2);
  v_net_amount numeric(12,2);
  v_remaining numeric(12,2);
  v_refundable numeric(12,2);
  v_effective_amount numeric(12,2);
  v_normalized_idempotency text;
begin
  applied := false;
  idempotent := false;
  payment_id := null;
  next_status := null;
  amount_paid := 0;
  remaining_balance := 0;
  conflict_reason := null;

  if p_payment_type not in ('sale', 'refund') then
    conflict_reason := 'INVALID_PAYMENT_TYPE';
    return next;
    return;
  end if;

  v_normalized_idempotency := nullif(trim(coalesce(p_idempotency_key, '')), '');

  select
    o.id,
    o.status,
    o.table_id,
    coalesce(o.final_price, o.total_price)::numeric(12,2) as target_amount
  into v_order
  from public.orders o
  where o.id = p_order_id
    and (p_business_id is null or o.business_id = p_business_id)
    and (p_branch_id is null or o.branch_id = p_branch_id)
  for update;

  if v_order.id is null then
    conflict_reason := 'ORDER_NOT_FOUND';
    return next;
    return;
  end if;

  if p_payment_type = 'sale' and v_order.status = 'cancelled' then
    conflict_reason := 'ORDER_CANCELLED';
    return next;
    return;
  end if;
  if p_payment_type = 'sale' and v_order.status = 'refunded' then
    conflict_reason := 'ORDER_REFUNDED';
    return next;
    return;
  end if;
  if p_payment_type = 'refund' and v_order.status = 'cancelled' then
    conflict_reason := 'ORDER_CANCELLED';
    return next;
    return;
  end if;

  if v_normalized_idempotency is not null then
    select p.id
      into v_existing_payment_id
    from public.payments p
    where p.order_id = p_order_id
      and p.payment_type = p_payment_type
      and p.idempotency_key = v_normalized_idempotency
      and (p_business_id is null or p.business_id = p_business_id)
      and (p_branch_id is null or p.branch_id = p_branch_id)
    limit 1;
  end if;

  select
    coalesce(sum(case when p.payment_type = 'sale' then p.amount else 0 end), 0)::numeric(12,2),
    coalesce(sum(case when p.payment_type = 'refund' then p.amount else 0 end), 0)::numeric(12,2)
  into v_total_sales, v_total_refunds
  from public.payments p
  where p.order_id = p_order_id
    and (p_business_id is null or p.business_id = p_business_id)
    and (p_branch_id is null or p.branch_id = p_branch_id);

  v_target_amount := coalesce(v_order.target_amount, 0);
  v_net_amount := coalesce(v_total_sales, 0) - coalesce(v_total_refunds, 0);

  if v_existing_payment_id is null then
    if p_payment_type = 'sale' then
      v_remaining := greatest(v_target_amount - v_net_amount, 0)::numeric(12,2);
      v_effective_amount := coalesce(p_amount, v_remaining)::numeric(12,2);
      if coalesce(v_effective_amount, 0) <= 0 then
        conflict_reason := 'INVALID_AMOUNT';
        return next;
        return;
      end if;
      if v_effective_amount - v_remaining > 0.009 then
        conflict_reason := 'OVERPAYMENT';
        return next;
        return;
      end if;
    else
      v_refundable := greatest(v_total_sales - v_total_refunds, 0)::numeric(12,2);
      if v_refundable <= 0 then
        conflict_reason := 'NO_REFUNDABLE_BALANCE';
        return next;
        return;
      end if;
      v_effective_amount := coalesce(p_amount, v_refundable)::numeric(12,2);
      if coalesce(v_effective_amount, 0) <= 0 then
        conflict_reason := 'INVALID_AMOUNT';
        return next;
        return;
      end if;
      if v_effective_amount - v_refundable > 0.009 then
        conflict_reason := 'OVER_REFUND';
        return next;
        return;
      end if;
    end if;

    begin
      insert into public.payments (
        business_id,
        branch_id,
        order_id,
        payment_type,
        method,
        amount,
        note,
        created_by,
        idempotency_key
      )
      values (
        p_business_id,
        p_branch_id,
        p_order_id,
        p_payment_type,
        p_method,
        v_effective_amount,
        p_note,
        p_created_by,
        v_normalized_idempotency
      )
      returning id into payment_id;
      applied := true;
    exception
      when unique_violation then
        if v_normalized_idempotency is null then
          raise;
        end if;
        select p.id
          into v_existing_payment_id
        from public.payments p
        where p.order_id = p_order_id
          and p.payment_type = p_payment_type
          and p.idempotency_key = v_normalized_idempotency
          and (p_business_id is null or p.business_id = p_business_id)
          and (p_branch_id is null or p.branch_id = p_branch_id)
        limit 1;
        if v_existing_payment_id is null then
          raise;
        end if;
        payment_id := v_existing_payment_id;
        idempotent := true;
      end;
  else
    idempotent := true;
    payment_id := v_existing_payment_id;
  end if;

  select
    coalesce(sum(case when p.payment_type = 'sale' then p.amount else 0 end), 0)::numeric(12,2),
    coalesce(sum(case when p.payment_type = 'refund' then p.amount else 0 end), 0)::numeric(12,2)
  into v_total_sales, v_total_refunds
  from public.payments p
  where p.order_id = p_order_id
    and (p_business_id is null or p.business_id = p_business_id)
    and (p_branch_id is null or p.branch_id = p_branch_id);

  v_net_amount := coalesce(v_total_sales, 0) - coalesce(v_total_refunds, 0);
  remaining_balance := greatest(v_target_amount - v_net_amount, 0)::numeric(12,2);
  amount_paid := v_net_amount;

  if v_net_amount >= v_target_amount - 0.009 then
    next_status := 'paid';
  elsif v_total_refunds > 0 and v_net_amount <= 0.009 then
    next_status := 'refunded';
  elsif v_total_refunds > 0 and v_net_amount > 0.009 then
    next_status := 'partially_refunded';
  elsif v_net_amount > 0.009 then
    next_status := 'partially_paid';
  elsif v_order.status = 'pending' or v_order.status = 'preparing' then
    next_status := 'ready';
  elsif v_order.status = 'cancelled' then
    next_status := 'cancelled';
  else
    next_status := 'served';
  end if;

  if v_order.status = 'cancelled' and next_status <> 'cancelled' then
    conflict_reason := 'STATUS_TRANSITION_BLOCKED';
    return next;
    return;
  end if;

  update public.orders o
  set
    status = next_status,
    lock_version = coalesce(o.lock_version, 0) + 1
  where o.id = p_order_id
    and (p_business_id is null or o.business_id = p_business_id)
    and (p_branch_id is null or o.branch_id = p_branch_id);

  if next_status = 'paid' and v_order.table_id is not null then
    update public.tables
    set status = 'empty'
    where id = v_order.table_id;
  end if;

  return next;
end;
$$;
