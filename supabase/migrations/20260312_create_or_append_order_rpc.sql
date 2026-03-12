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
as $$
declare
  v_existing_id uuid;
  v_existing_total numeric;
  v_existing_final numeric;
  v_existing_items jsonb;
  v_item jsonb;
  v_modifier jsonb;
begin
  if p_channel = 'dine_in' and p_table_id is not null then
    select o.id, o.total_price, coalesce(o.final_price, o.total_price), coalesce(o.items, '[]'::jsonb)
      into v_existing_id, v_existing_total, v_existing_final, v_existing_items
    from public.orders o
    where o.table_id = p_table_id
      and o.channel = 'dine_in'
      and o.status in ('pending', 'preparing', 'served')
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
      p_channel,
      p_customer_name,
      p_customer_phone,
      p_delivery_address,
      p_delivery_note,
      p_courier_id,
      p_courier_name,
      p_courier_phone,
      p_fulfillment_status,
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
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    ) values (
      order_id,
      nullif(v_item->>'product_id', '')::uuid,
      coalesce(v_item->>'name', ''),
      coalesce((v_item->>'quantity')::numeric, 0),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'line_total')::numeric, 0)
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
        nullif(v_item->>'product_id', '')::uuid,
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

