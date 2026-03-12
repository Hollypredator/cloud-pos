alter table public.ingredients
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

update public.ingredients i
set business_id = mapped.business_id
from (
  select pi.ingredient_id, min(p.business_id::text)::uuid as business_id
  from public.product_ingredients pi
  join public.products p on p.id = pi.product_id
  group by pi.ingredient_id
) mapped
where i.id = mapped.ingredient_id
  and i.business_id is null;

alter table public.ingredients
  drop constraint if exists ingredients_name_key;
create unique index if not exists uniq_ingredients_business_name
  on public.ingredients (business_id, lower(name))
  where business_id is not null;

drop policy if exists "staff full order_items" on public.order_items;
create policy "staff read order_items scoped" on public.order_items
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_access_branch(o.branch_id)
  )
);
create policy "management manage order_items scoped" on public.order_items
for all to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_manage_branch(o.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_manage_branch(o.branch_id)
  )
);

drop policy if exists "staff full ingredients" on public.ingredients;
create policy "staff read ingredients scoped" on public.ingredients
for select to authenticated
using (
  (business_id is not null and public.can_access_business(business_id))
  or exists (
    select 1
    from public.product_ingredients pi
    join public.products p on p.id = pi.product_id
    where pi.ingredient_id = ingredients.id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage ingredients scoped" on public.ingredients
for all to authenticated
using (
  public.current_is_management()
  and (
    (business_id is not null and public.can_manage_business(business_id))
    or not exists (select 1 from public.product_ingredients pi where pi.ingredient_id = ingredients.id)
  )
)
with check (
  public.current_is_management()
  and (
    business_id is null
    or public.can_manage_business(business_id)
  )
);

drop policy if exists "staff full product_ingredients" on public.product_ingredients;
create policy "staff read product_ingredients scoped" on public.product_ingredients
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_ingredients scoped" on public.product_ingredients
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_ingredients.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full stock_movements" on public.stock_movements;
create policy "staff read stock_movements scoped" on public.stock_movements
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage stock_movements scoped" on public.stock_movements
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = stock_movements.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full product_modifier_groups" on public.product_modifier_groups;
create policy "staff read product_modifier_groups scoped" on public.product_modifier_groups
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_modifier_groups scoped" on public.product_modifier_groups
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_modifier_groups.product_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full product_modifier_options" on public.product_modifier_options;
create policy "staff read product_modifier_options scoped" on public.product_modifier_options
for select to authenticated
using (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_access_business(p.business_id)
  )
);
create policy "management manage product_modifier_options scoped" on public.product_modifier_options
for all to authenticated
using (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.product_modifier_groups g
    join public.products p on p.id = g.product_id
    where g.id = product_modifier_options.group_id
      and public.can_manage_business(p.business_id)
  )
);

drop policy if exists "staff full order_item_modifiers" on public.order_item_modifiers;
create policy "staff read order_item_modifiers scoped" on public.order_item_modifiers
for select to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_access_branch(o.branch_id)
  )
);
create policy "management manage order_item_modifiers scoped" on public.order_item_modifiers
for all to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_manage_branch(o.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_item_modifiers.order_id
      and public.can_manage_branch(o.branch_id)
  )
);

drop policy if exists "staff full alert_dispatches" on public.alert_dispatches;
create policy "deny direct alert_dispatches access" on public.alert_dispatches
for all to authenticated
using (false)
with check (false);

drop policy if exists "staff full audit_logs" on public.audit_logs;
create policy "management read audit_logs scoped" on public.audit_logs
for select to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1
    from public.staff_branch_access actor_access
    join public.staff_branch_access target_access
      on target_access.profile_id = audit_logs.actor_id
     and target_access.business_id = actor_access.business_id
    where actor_access.profile_id = auth.uid()
      and public.current_is_management()
  )
);
create policy "management insert audit_logs" on public.audit_logs
for insert to authenticated
with check (public.current_is_management());
