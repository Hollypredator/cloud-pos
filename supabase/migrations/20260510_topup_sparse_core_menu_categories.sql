-- Top-up core menu categories when they have fewer than 5 visible products.
-- Targets: Tatlilar, Alkoller, Sicak Icecekler, Soguk Icecekler

with normalized_categories as (
  select
    c.id as category_id,
    c.business_id,
    lower(regexp_replace(translate(c.name, 'ÇĞİÖŞÜçğıöşü', 'CGIOSUcgiosu'), '\s+', ' ', 'g')) as normalized_name
  from public.categories c
),
target_categories as (
  select
    nc.category_id,
    nc.business_id,
    case
      when nc.normalized_name in ('alkol', 'alkoller') then 'alkoller'
      when nc.normalized_name = 'tatlilar' then 'tatlilar'
      when nc.normalized_name = 'sicak icecekler' then 'sicak icecekler'
      when nc.normalized_name = 'soguk icecekler' then 'soguk icecekler'
      else null
    end as target_key,
    (
      select count(*)
      from public.products p
      where p.category_id = nc.category_id
        and p.business_id = nc.business_id
        and p.is_available = true
        and p.stock_count > 0
    ) as visible_product_count
  from normalized_categories nc
  where nc.normalized_name in ('tatlilar', 'alkol', 'alkoller', 'sicak icecekler', 'soguk icecekler')
),
seed_products as (
  select 'tatlilar'::text as target_key, 'San Sebastian'::text as name, 210::numeric(12,2) as price, 'Burnt basque cheesecake'::text as description
  union all select 'tatlilar', 'Tiramisu', 205, 'Coffee layered tiramisu'
  union all select 'tatlilar', 'Sufle', 185, 'Warm chocolate souffle'
  union all select 'tatlilar', 'Magnolia', 160, 'Cream and biscuit dessert'
  union all select 'tatlilar', 'Brownie', 145, 'Chocolate brownie'

  union all select 'alkoller', 'Kadeh Sarap', 240, 'Red or white wine by glass'
  union all select 'alkoller', 'Mojito', 295, 'Lime mint rum cocktail'
  union all select 'alkoller', 'Gin Tonic', 285, 'Classic gin and tonic'
  union all select 'alkoller', 'Efes Pilsen', 175, 'Bottle beer'
  union all select 'alkoller', 'Tuborg Gold', 175, 'Bottle beer'

  union all select 'sicak icecekler', 'Cay', 70, 'Freshly brewed black tea'
  union all select 'sicak icecekler', 'Turk Kahvesi', 125, 'Traditional Turkish coffee'
  union all select 'sicak icecekler', 'Americano', 130, 'Espresso and hot water'
  union all select 'sicak icecekler', 'Latte', 150, 'Espresso with steamed milk'
  union all select 'sicak icecekler', 'Cappuccino', 155, 'Espresso with milk foam'

  union all select 'soguk icecekler', 'Iced Americano', 145, 'Espresso over ice'
  union all select 'soguk icecekler', 'Iced Latte', 165, 'Espresso milk and ice'
  union all select 'soguk icecekler', 'Cold Brew', 170, 'Slow brewed cold coffee'
  union all select 'soguk icecekler', 'Limonata', 120, 'House lemonade'
  union all select 'soguk icecekler', 'Maden Suyu', 95, 'Sparkling mineral water'
)
insert into public.products (
  business_id,
  category_id,
  name,
  price,
  stock_count,
  description,
  is_available
)
select
  tc.business_id,
  tc.category_id,
  sp.name,
  sp.price,
  999 as stock_count,
  sp.description,
  true as is_available
from target_categories tc
join seed_products sp on sp.target_key = tc.target_key
where tc.target_key is not null
  and tc.visible_product_count < 5
  and not exists (
    select 1
    from public.products p
    where p.business_id = tc.business_id
      and p.category_id = tc.category_id
      and lower(p.name) = lower(sp.name)
  );
