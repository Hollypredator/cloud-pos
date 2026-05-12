create or replace function public.create_or_append_order(
  p_business_id uuid,
  p_branch_id uuid,
  p_table_id uuid,
  p_channel text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_note text,
  p_courier_id uuid,
  p_courier_name text,
  p_courier_phone text,
  p_fulfillment_status text,
  p_total_price numeric,
  p_items jsonb
)
returns table(order_id uuid, created_new boolean)
language plpgsql
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_existing_total numeric;
  v_existing_final numeric;
  v_existing_items jsonb;
  v_item jsonb;
  v_modifier jsonb;
  v_channel public.order_channel;
  v_fulfillment_status public.fulfillment_status;
  v_product_id uuid;
  v_item_quantity numeric;
  v_unit_cost_snapshot numeric;
begin
  v_channel :=
    case
      when p_channel in ('dine_in', 'pickup', 'delivery') then p_channel::public.order_channel
      else 'dine_in'::public.order_channel
    end;

  v_fulfillment_status :=
    case
      when p_fulfillment_status in ('not_applicable', 'awaiting_dispatch', 'out_for_delivery', 'completed')
        then p_fulfillment_status::public.fulfillment_status
      when v_channel = 'delivery'::public.order_channel
        then 'awaiting_dispatch'::public.fulfillment_status
      else 'not_applicable'::public.fulfillment_status
    end;

  if v_channel = 'dine_in'::public.order_channel and p_table_id is not null then
    -- Serialize create/append attempts per table to prevent split checks under race.
    perform pg_advisory_xact_lock(hashtext('create_or_append_order'), hashtext(p_table_id::text));

    select o.id, o.total_price, coalesce(o.final_price, o.total_price), coalesce(o.items, '[]'::jsonb)
      into v_existing_id, v_existing_total, v_existing_final, v_existing_items
    from public.orders o
    where o.table_id = p_table_id
      and o.channel = 'dine_in'::public.order_channel
      and o.status in ('pending', 'preparing', 'ready', 'served', 'partially_paid')
      and (p_business_id is null or o.business_id = p_business_id)
      and (p_branch_id is null or o.branch_id = p_branch_id)
    order by o.created_at desc
    limit 1
    for update;
  end if;

  if v_existing_id is null then
    insert into public.orders (
      business_id,
      branch_id,
      table_id,
      items,
      total_price,
      final_price,
      discount_amount,
      service_fee,
      channel,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_note,
      courier_id,
      courier_name,
      courier_phone,
      fulfillment_status,
      status
    ) values (
      p_business_id,
      p_branch_id,
      p_table_id,
      coalesce(p_items, '[]'::jsonb),
      p_total_price,
      p_total_price,
      0,
      0,
      v_channel,
      p_customer_name,
      p_customer_phone,
      p_delivery_address,
      p_delivery_note,
      p_courier_id,
      p_courier_name,
      p_courier_phone,
      v_fulfillment_status,
      'pending'
    )
    returning id into order_id;
    created_new := true;
  else
    order_id := v_existing_id;
    created_new := false;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_item_quantity := greatest(0, coalesce((v_item->>'quantity')::numeric, 0));

    if v_product_id is null then
      v_unit_cost_snapshot := 0;
    else
      select
        greatest(0, coalesce(p.cost, 0))
        + coalesce(sum(greatest(0, coalesce(pi.quantity, 0)) * greatest(0, coalesce(i.cost, 0))), 0)
        into v_unit_cost_snapshot
      from public.products p
      left join public.product_ingredients pi on pi.product_id = p.id
      left join public.ingredients i on i.id = pi.ingredient_id
      where p.id = v_product_id
      group by p.cost;
      v_unit_cost_snapshot := greatest(0, coalesce(v_unit_cost_snapshot, 0));
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total,
      unit_cost_snapshot,
      line_cost_snapshot
    ) values (
      order_id,
      v_product_id,
      coalesce(v_item->>'name', ''),
      v_item_quantity,
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'line_total')::numeric, 0),
      round(greatest(0, v_unit_cost_snapshot)::numeric, 4),
      round((greatest(0, coalesce(v_item_quantity, 0)) * greatest(0, v_unit_cost_snapshot))::numeric, 4)
    );

    for v_modifier in
      select * from jsonb_array_elements(coalesce(v_item->'modifiers', '[]'::jsonb))
    loop
      insert into public.order_item_modifiers (
        order_id,
        product_id,
        product_name,
        modifier_group_name,
        modifier_option_name,
        price_delta,
        quantity
      ) values (
        order_id,
        v_product_id,
        coalesce(v_item->>'name', ''),
        coalesce(v_modifier->>'group_name', ''),
        coalesce(v_modifier->>'option_name', ''),
        coalesce((v_modifier->>'price_delta')::numeric, 0),
        coalesce((v_modifier->>'quantity')::numeric, coalesce((v_item->>'quantity')::numeric, 1))
      );
    end loop;
  end loop;

  if created_new = false then
    update public.orders
    set items = coalesce(v_existing_items, '[]'::jsonb) || coalesce(p_items, '[]'::jsonb),
        total_price = coalesce(v_existing_total, 0) + coalesce(p_total_price, 0),
        final_price = coalesce(v_existing_final, coalesce(v_existing_total, 0)) + coalesce(p_total_price, 0),
        status = 'pending'
    where id = order_id;
  end if;

  return next;
end;
$$;
