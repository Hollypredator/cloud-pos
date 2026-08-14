-- Recete, maliyet ve malzeme stogu.
--
-- Plan: PLAN-RECETE-MALIYET-STOK.md
--
-- Mevcut model korunuyor, uzerine kuruluyor:
--   public.ingredients          -> hammadde (business_id, name, unit, cost)
--   public.product_ingredients  -> recete (product, ingredient, quantity)
--   order_items.unit_cost_snapshot -> satis anindaki birim maliyet
--
-- Eksik olanlar: malzemenin NEREDE ve NE KADAR oldugu, modifier'larin receteye
-- etkisi, satista ne tuketildigi ve stogun nasil azaldigi.

-- 1) Malzeme: taban birim, alim birimi, aktiflik -----------------------------

alter table public.ingredients
  add column if not exists base_unit text not null default 'adet',
  add column if not exists purchase_unit text,
  add column if not exists purchase_factor numeric(14,4) not null default 1,
  add column if not exists is_active boolean not null default true;

comment on column public.ingredients.base_unit is 'Recete ve stok birimi: g, ml veya adet. Cevrim yok, karisiklik olmaz.';
comment on column public.ingredients.purchase_unit is 'Alim birimi (cuval, koli, kg). Yalnizca alim ekraninda kullanilir.';
comment on column public.ingredients.purchase_factor is '1 alim birimi kac taban birim eder. 1 cuval = 25000 g.';
comment on column public.ingredients.cost is 'Guncel hareketli agirlikli ortalama maliyet (taban birim basina).';
comment on column public.ingredients.is_active is 'Gecmis hareketi olan malzeme silinmez, pasife alinir.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ingredients_base_unit_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_base_unit_check check (base_unit in ('g', 'ml', 'adet'));
  end if;
end $$;

-- Eski serbest metin birimlerini taban birime tasir ve kg/lt maliyetlerini
-- taban birime cevirir (1 kg = 1000 g).
--
-- TEK deyim, ve `unit` de normalize ediliyor. Sebebi idempotans: ayri iki
-- UPDATE olsaydi maliyet donusumunun yuklemi `unit`'e bakar ama `unit`'i
-- degistirmezdi; migration ikinci kez calistiginda maliyetler bir kez daha
-- 1000'e bolunurdu. Uzak veritabaninda migration gecmisi tutulmadigi icin
-- bu teorik bir risk degil.
--
-- Bu haliyle ikinci calistirma zararsiz: kg -> g donusumunden sonra `unit`
-- artik 'g' oldugu icin maliyet dalina hic girilmez.
--
-- Taninmayan birimler ('shot', 'porsiyon' gibi) yuklemle eslesmez; taban
-- birimleri kolon varsayilani olan 'adet' kalir.
update public.ingredients
set
  base_unit = case
    when lower(coalesce(unit, '')) in ('g', 'gr', 'gram', 'kg', 'kilogram') then 'g'
    else 'ml'
  end,
  cost = case
    when lower(coalesce(unit, '')) in ('kg', 'kilogram', 'l', 'lt', 'litre') and cost > 0
      then round(cost / 1000.0, 4)
    else cost
  end,
  unit = case
    when lower(coalesce(unit, '')) in ('g', 'gr', 'gram', 'kg', 'kilogram') then 'g'
    else 'ml'
  end
where lower(coalesce(unit, '')) in
  ('g', 'gr', 'gram', 'kg', 'kilogram', 'ml', 'mililitre', 'l', 'lt', 'litre');

-- 2) Recete satirinda fire katsayisi ------------------------------------------

alter table public.product_ingredients
  add column if not exists yield_factor numeric(6,4) not null default 1;

comment on column public.product_ingredients.yield_factor is
  'Fire katsayisi. Gercek tuketim = quantity / yield_factor. 0.97 -> 18 g doz 18.56 g duser.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_ingredients_yield_check'
  ) then
    alter table public.product_ingredients
      add constraint product_ingredients_yield_check check (yield_factor > 0 and yield_factor <= 1);
  end if;
end $$;

-- 3) Urunun denormalize birim maliyeti ----------------------------------------
-- Her satista recete sorgusu calistirmamak icin. Kasa saniyelik olmak zorunda.

alter table public.products
  add column if not exists computed_unit_cost numeric(12,4) not null default 0;

comment on column public.products.computed_unit_cost is
  'products.cost + toplam(recete miktari / fire × malzeme maliyeti). Recete veya maliyet degisince yeniden hesaplanir.';

-- 4) Modifier'larin receteye etkisi -------------------------------------------

create table if not exists public.modifier_option_ingredients (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_modifier_options (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  target_ingredient_id uuid references public.ingredients (id) on delete restrict,
  quantity numeric(14,3),
  multiplier numeric(6,3),
  mode text not null default 'add',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_option_ingredients_mode_check check (mode in ('add', 'remove', 'replace', 'scale')),
  -- add:     ingredient_id + quantity
  -- remove:  target_ingredient_id
  -- replace: target_ingredient_id + ingredient_id (miktar bos ise hedefin miktari korunur)
  -- scale:   target_ingredient_id + multiplier
  constraint modifier_option_ingredients_shape_check check (
    (mode = 'add' and ingredient_id is not null and quantity is not null and quantity > 0)
    or (mode = 'remove' and target_ingredient_id is not null)
    or (mode = 'replace' and target_ingredient_id is not null and ingredient_id is not null)
    or (mode = 'scale' and target_ingredient_id is not null and multiplier is not null and multiplier > 0)
  )
);

comment on table public.modifier_option_ingredients is
  'Modifier secenegin receteye etkisi. Yulaf sutu = Sut satirini replace eder; Large = sut satirini scale eder.';

drop trigger if exists trg_modifier_option_ingredients_updated_at on public.modifier_option_ingredients;
create trigger trg_modifier_option_ingredients_updated_at before update on public.modifier_option_ingredients
for each row execute function public.set_updated_at();

create index if not exists idx_modifier_option_ingredients_option on public.modifier_option_ingredients (option_id);

-- 5) Sube bazli malzeme stogu -------------------------------------------------

create table if not exists public.ingredient_stock (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  quantity numeric(16,3) not null default 0,
  min_quantity numeric(16,3) not null default 0,
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredient_stock_unique unique (ingredient_id, branch_id)
);

comment on table public.ingredient_stock is 'Malzemenin sube bazinda guncel miktari (taban birimde).';
comment on column public.ingredient_stock.min_quantity is 'Kritik seviye. Altina dusunce uyari uretilir.';

drop trigger if exists trg_ingredient_stock_updated_at on public.ingredient_stock;
create trigger trg_ingredient_stock_updated_at before update on public.ingredient_stock
for each row execute function public.set_updated_at();

create index if not exists idx_ingredient_stock_branch on public.ingredient_stock (branch_id);

-- 6) Hareketler: append-only --------------------------------------------------
-- Satis yolu bakiye guncellemesini beklemez; bakiyeyi trigger tasir.

create table if not exists public.ingredient_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  change_quantity numeric(16,3) not null,
  unit_cost numeric(12,4) not null default 0,
  reason text not null default 'manual_update',
  order_id uuid references public.orders (id) on delete set null,
  -- Siparis kalemi silinirse hareket kalir (denetim izi), baglanti kopar.
  order_item_id uuid references public.order_items (id) on delete set null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ingredient_movements_reason_check check (
    reason in ('sale_consumption', 'sale_reversal', 'purchase', 'waste', 'stock_count', 'transfer_in', 'transfer_out', 'manual_update')
  ),
  constraint ingredient_movements_change_check check (change_quantity <> 0)
);

comment on table public.ingredient_movements is 'Malzeme hareketleri. Append-only: duzeltme silme degil ters kayit ile yapilir.';

create index if not exists idx_ingredient_movements_ingredient on public.ingredient_movements (ingredient_id);
create index if not exists idx_ingredient_movements_branch_date on public.ingredient_movements (branch_id, created_at desc);
create index if not exists idx_ingredient_movements_order on public.ingredient_movements (order_id);

-- Ayni siparis kalemi ayni malzemeyi iki kez dusuremez. Cevrimdisi kuyruk
-- tekrar gonderim yapabilir; idempotans burada garanti altina alinir.
create unique index if not exists uniq_ingredient_movement_sale_line
  on public.ingredient_movements (order_item_id, ingredient_id)
  where order_item_id is not null and reason = 'sale_consumption';

-- Bakiyeyi hareketten tasi.
create or replace function public.apply_ingredient_movement()
returns trigger
language plpgsql
as $$
begin
  insert into public.ingredient_stock (ingredient_id, branch_id, quantity)
  values (new.ingredient_id, new.branch_id, new.change_quantity)
  on conflict (ingredient_id, branch_id)
  do update set quantity = public.ingredient_stock.quantity + excluded.quantity;

  return new;
end;
$$;

drop trigger if exists trg_ingredient_movements_apply on public.ingredient_movements;
create trigger trg_ingredient_movements_apply
after insert on public.ingredient_movements
for each row execute function public.apply_ingredient_movement();

-- 7) Satista donan tuketim ----------------------------------------------------
-- En kritik tablo. Recete sonradan degisse veya cevrimdisi siparis saatler sonra
-- senkron olsa bile, ne tuketildigi satis anindaki haliyle sabit kalir.

create table if not exists public.order_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric(16,3) not null,
  unit_cost numeric(12,4) not null default 0,
  source text not null default 'recipe',
  created_at timestamptz not null default now(),
  constraint order_item_ingredients_source_check check (
    source in ('recipe', 'modifier_add', 'modifier_replace', 'modifier_scale')
  )
);

comment on table public.order_item_ingredients is
  'Satis anindaki tuketim kirilimi. Stok dusumu, maliyet ve denetim ayni kaynaktan beslenir.';

create index if not exists idx_order_item_ingredients_order on public.order_item_ingredients (order_id);
create index if not exists idx_order_item_ingredients_ingredient on public.order_item_ingredients (ingredient_id);

-- 7b) Tuketim yazilamayan siparisler ------------------------------------------
--
-- CEO review bulgu 2B: tüketim insert'i basarisiz olursa satis yine gecer
-- (kasayi stok kaydi yuzunden durdurmak kafeyi kilitler), ama sessizce gecmez.
-- Bu bayrak olmadan stok ay boyunca kayar ve fark raporu sacmalar.

alter table public.orders
  add column if not exists consumption_failed boolean not null default false,
  add column if not exists consumption_error text;

comment on column public.orders.consumption_failed is
  'Satis gecti ama recete tuketimi yazilamadi. Fark raporu bu siparisleri dislar; telafi gerekir.';

create index if not exists idx_orders_consumption_failed
  on public.orders (branch_id, created_at desc)
  where consumption_failed;

-- 8) Birim maliyet yeniden hesabi ---------------------------------------------

create or replace function public.recompute_product_unit_cost(target_product uuid)
returns void
language plpgsql
as $$
begin
  update public.products p
  set computed_unit_cost = greatest(0, coalesce(p.cost, 0)) + coalesce((
    select sum(
      (greatest(0, coalesce(pi.quantity, 0)) / nullif(pi.yield_factor, 0))
      * greatest(0, coalesce(i.cost, 0))
    )
    from public.product_ingredients pi
    join public.ingredients i on i.id = pi.ingredient_id
    where pi.product_id = p.id
  ), 0)
  where p.id = target_product;
end;
$$;

comment on function public.recompute_product_unit_cost is
  'Urunun denormalize birim maliyetini yeniden hesaplar. Recete veya malzeme maliyeti degisince cagrilir.';

create or replace function public.touch_product_unit_cost()
returns trigger
language plpgsql
as $$
declare
  affected uuid;
begin
  affected := coalesce(new.product_id, old.product_id);
  if affected is not null then
    perform public.recompute_product_unit_cost(affected);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_product_ingredients_cost on public.product_ingredients;
create trigger trg_product_ingredients_cost
after insert or update or delete on public.product_ingredients
for each row execute function public.touch_product_unit_cost();

-- Malzeme maliyeti degisince o malzemeyi kullanan urunler tazelenir.
--
-- Tetikleyici DEGIL, acikca cagrilan fonksiyon (CEO review bulgu 1B):
-- her alim hareketi hareketli ortalama maliyeti gunceller. Satir bazli
-- tetikleyici olsaydi 30 kalemlik bir irsaliye tek transaction icinde
-- yuzlerce yeniden hesap tetikler, kilit suresi ongorulemez olur ve
-- kasa yolu beklerdi. Alim islemi bitince bu fonksiyon bir kez cagrilir.
create or replace function public.recompute_products_for_ingredients(ingredient_ids uuid[])
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  with touched as (
    update public.products p
    set computed_unit_cost = greatest(0, coalesce(p.cost, 0)) + coalesce((
      select sum(
        (greatest(0, coalesce(pi2.quantity, 0)) / nullif(pi2.yield_factor, 0))
        * greatest(0, coalesce(i2.cost, 0))
      )
      from public.product_ingredients pi2
      join public.ingredients i2 on i2.id = pi2.ingredient_id
      where pi2.product_id = p.id
    ), 0)
    where p.id in (
      select distinct pi.product_id
      from public.product_ingredients pi
      where pi.ingredient_id = any(ingredient_ids)
    )
    returning 1
  )
  select count(*) into affected from touched;

  return affected;
end;
$$;

comment on function public.recompute_products_for_ingredients is
  'Verilen malzemeleri kullanan urunlerin birim maliyetini tek toplu UPDATE ile tazeler. Alim/maliyet guncellemesi bitince cagrilir.';

-- Mevcut urunler icin ilk hesap.
do $$
declare
  row_product record;
begin
  for row_product in select id from public.products loop
    perform public.recompute_product_unit_cost(row_product.id);
  end loop;
end $$;

-- 9) RLS ----------------------------------------------------------------------

alter table public.modifier_option_ingredients enable row level security;
drop policy if exists "staff read modifier_option_ingredients" on public.modifier_option_ingredients;
create policy "staff read modifier_option_ingredients" on public.modifier_option_ingredients
for select to authenticated
using (
  exists (
    select 1
    from public.product_modifier_options o
    join public.product_modifier_groups g on g.id = o.group_id
    join public.products p on p.id = g.product_id
    where o.id = modifier_option_ingredients.option_id
      and public.can_access_business(p.business_id)
  )
);
drop policy if exists "management manage modifier_option_ingredients" on public.modifier_option_ingredients;
create policy "management manage modifier_option_ingredients" on public.modifier_option_ingredients
for all to authenticated
using (
  exists (
    select 1
    from public.product_modifier_options o
    join public.product_modifier_groups g on g.id = o.group_id
    join public.products p on p.id = g.product_id
    where o.id = modifier_option_ingredients.option_id
      and public.can_manage_business(p.business_id)
  )
)
with check (
  exists (
    select 1
    from public.product_modifier_options o
    join public.product_modifier_groups g on g.id = o.group_id
    join public.products p on p.id = g.product_id
    where o.id = modifier_option_ingredients.option_id
      and public.can_manage_business(p.business_id)
  )
);

alter table public.ingredient_stock enable row level security;
drop policy if exists "staff read ingredient_stock" on public.ingredient_stock;
create policy "staff read ingredient_stock" on public.ingredient_stock
for select to authenticated
using (public.can_access_branch(branch_id));
drop policy if exists "management manage ingredient_stock" on public.ingredient_stock;
create policy "management manage ingredient_stock" on public.ingredient_stock
for all to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

alter table public.ingredient_movements enable row level security;
drop policy if exists "staff read ingredient_movements" on public.ingredient_movements;
create policy "staff read ingredient_movements" on public.ingredient_movements
for select to authenticated
using (public.can_access_branch(branch_id));

-- Yazma yetkisi hareket turune gore ayrilir (CEO review bulgu 4A).
--
-- Eskiden tek politika `can_access_branch` ile yaziyordu; yani subeyi gorebilen
-- herkes -- kasiyer dahil -- `purchase` ile stok sisirebilir ya da `stock_count`
-- ile fark raporunu sifirlayabilirdi. Fark raporu zimmeti yakalamak icin var;
-- onu yazabilen kisi zimmeti gizleyebilir.
--
-- Satis tuketimi kasiyerin yazmasi GEREKEN tek tur. Digerleri yonetim isi.
drop policy if exists "staff write ingredient_movements" on public.ingredient_movements;
drop policy if exists "staff write sale consumption" on public.ingredient_movements;
create policy "staff write sale consumption" on public.ingredient_movements
for insert to authenticated
with check (
  reason in ('sale_consumption', 'sale_reversal')
  and public.can_access_branch(branch_id)
);

drop policy if exists "management write stock movements" on public.ingredient_movements;
create policy "management write stock movements" on public.ingredient_movements
for insert to authenticated
with check (
  reason in ('purchase', 'waste', 'stock_count', 'transfer_in', 'transfer_out', 'manual_update')
  and public.can_manage_branch(branch_id)
);

alter table public.order_item_ingredients enable row level security;
drop policy if exists "staff read order_item_ingredients" on public.order_item_ingredients;
create policy "staff read order_item_ingredients" on public.order_item_ingredients
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_item_ingredients.order_id
      and public.can_access_branch(o.branch_id)
  )
);
drop policy if exists "staff write order_item_ingredients" on public.order_item_ingredients;
create policy "staff write order_item_ingredients" on public.order_item_ingredients
for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_item_ingredients.order_id
      and public.can_access_branch(o.branch_id)
  )
);
