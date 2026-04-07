-- Hybrid tenant v1: branch profile + profile-scoped catalog + market import + decimal quantities

do $$
begin
  if not exists (select 1 from pg_type where typname = 'branch_profile') then
    create type public.branch_profile as enum ('restaurant', 'enterprise_market');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_profile_scope') then
    create type public.product_profile_scope as enum ('restaurant', 'enterprise_market');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_kind') then
    create type public.product_kind as enum ('standard', 'weighted', 'service');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_unit') then
    create type public.product_unit as enum ('adet', 'kg', 'gram', 'litre', 'ml', 'paket');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_department') then
    create type public.product_department as enum (
      'general',
      'butcher',
      'delicatessen',
      'bakery',
      'produce',
      'beverage',
      'frozen',
      'non_food'
    );
  end if;
end
$$;

alter table public.branches
  add column if not exists branch_profile public.branch_profile;

update public.branches
set branch_profile = 'restaurant'::public.branch_profile
where branch_profile is null;

alter table public.branches
  alter column branch_profile set default 'restaurant'::public.branch_profile;

alter table public.branches
  alter column branch_profile set not null;

create index if not exists idx_branches_business_profile
  on public.branches (business_id, branch_profile, name);

alter table public.categories
  add column if not exists profile_scope public.product_profile_scope;

update public.categories
set profile_scope = 'restaurant'::public.product_profile_scope
where profile_scope is null;

alter table public.categories
  alter column profile_scope set default 'restaurant'::public.product_profile_scope;

alter table public.categories
  alter column profile_scope set not null;

alter table public.categories
  drop constraint if exists categories_business_name_unique;

alter table public.categories
  add constraint categories_business_profile_name_unique
  unique (business_id, profile_scope, name);

create index if not exists idx_categories_business_scope_sort
  on public.categories (business_id, profile_scope, sort_order);

alter table public.products
  add column if not exists profile_scope public.product_profile_scope;

update public.products
set profile_scope = 'restaurant'::public.product_profile_scope
where profile_scope is null;

alter table public.products
  alter column profile_scope set default 'restaurant'::public.product_profile_scope;

alter table public.products
  alter column profile_scope set not null;

alter table public.products
  add column if not exists barcode text;

alter table public.products
  add column if not exists plu_code text;

alter table public.products
  add column if not exists product_kind public.product_kind;

update public.products
set product_kind = 'standard'::public.product_kind
where product_kind is null;

alter table public.products
  alter column product_kind set default 'standard'::public.product_kind;

alter table public.products
  alter column product_kind set not null;

alter table public.products
  add column if not exists unit public.product_unit;

update public.products
set unit = 'adet'::public.product_unit
where unit is null;

alter table public.products
  alter column unit set default 'adet'::public.product_unit;

alter table public.products
  alter column unit set not null;

alter table public.products
  add column if not exists department public.product_department;

update public.products
set department = 'general'::public.product_department
where department is null;

alter table public.products
  alter column department set default 'general'::public.product_department;

alter table public.products
  alter column department set not null;

create unique index if not exists uq_products_business_scope_category_name
  on public.products (business_id, profile_scope, category_id, name);

create unique index if not exists uq_products_business_scope_barcode
  on public.products (business_id, profile_scope, barcode)
  where barcode is not null;

create unique index if not exists uq_products_business_scope_plu_code
  on public.products (business_id, profile_scope, plu_code)
  where plu_code is not null;

create index if not exists idx_products_business_scope_category
  on public.products (business_id, profile_scope, category_id, is_available);

create index if not exists idx_products_business_scope_department
  on public.products (business_id, profile_scope, department);

alter table public.order_items
  alter column quantity type numeric(12,3)
  using quantity::numeric;

alter table public.order_items
  drop constraint if exists order_items_quantity_check;

alter table public.order_items
  add constraint order_items_quantity_check
  check (quantity > 0);

alter table public.order_item_modifiers
  alter column quantity type numeric(12,3)
  using quantity::numeric;

alter table public.order_item_modifiers
  drop constraint if exists order_item_modifiers_quantity_check;

alter table public.order_item_modifiers
  add constraint order_item_modifiers_quantity_check
  check (quantity > 0);

create or replace function public.import_enterprise_market_catalog(
  p_business_id uuid,
  p_rows jsonb,
  p_replace_scope boolean default false,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_category_name text;
  v_product_name text;
  v_description text;
  v_price numeric(12,2);
  v_stock_count integer;
  v_barcode text;
  v_plu_code text;
  v_product_kind public.product_kind;
  v_unit public.product_unit;
  v_department public.product_department;
  v_image_url text;
  v_is_available boolean;
  v_category_id uuid;
  v_existing_product_id uuid;
  v_inserted_count integer := 0;
  v_updated_count integer := 0;
  v_category_inserted_count integer := 0;
  v_row_count integer := 0;
  v_category_insert_result integer;
begin
  if p_business_id is null then
    raise exception 'business_id zorunludur';
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'rows bir JSON array olmalidir';
  end if;

  if p_replace_scope then
    delete from public.products
    where business_id = p_business_id
      and profile_scope = 'enterprise_market'::public.product_profile_scope;

    delete from public.categories
    where business_id = p_business_id
      and profile_scope = 'enterprise_market'::public.product_profile_scope;
  end if;

  for v_row in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_row_count := v_row_count + 1;

    v_category_name := nullif(trim(coalesce(v_row->>'category_name', v_row->>'category', '')), '');
    v_product_name := nullif(trim(coalesce(v_row->>'name', v_row->>'product_name', '')), '');
    v_description := nullif(trim(coalesce(v_row->>'description', '')), '');
    v_price := coalesce(nullif(v_row->>'price', '')::numeric, 0);
    v_stock_count := greatest(0, coalesce(nullif(v_row->>'stock_count', '')::numeric, 0)::integer);
    v_barcode := nullif(trim(coalesce(v_row->>'barcode', '')), '');
    v_plu_code := nullif(trim(coalesce(v_row->>'plu_code', '')), '');
    v_product_kind := coalesce(nullif(v_row->>'product_kind', '')::public.product_kind, 'standard'::public.product_kind);
    v_unit := coalesce(nullif(v_row->>'unit', '')::public.product_unit, 'adet'::public.product_unit);
    v_department := coalesce(nullif(v_row->>'department', '')::public.product_department, 'general'::public.product_department);
    v_image_url := nullif(trim(coalesce(v_row->>'image_url', '')), '');
    v_is_available := coalesce(nullif(v_row->>'is_available', '')::boolean, true);

    if v_category_name is null then
      raise exception 'Satir %: category_name/category zorunlu', v_row_count;
    end if;

    if v_product_name is null then
      raise exception 'Satir %: name/product_name zorunlu', v_row_count;
    end if;

    insert into public.categories (
      business_id,
      name,
      sort_order,
      prep_station,
      profile_scope
    ) values (
      p_business_id,
      v_category_name,
      0,
      'kitchen',
      'enterprise_market'::public.product_profile_scope
    )
    on conflict (business_id, profile_scope, name)
    do nothing;

    get diagnostics v_category_insert_result = row_count;
    if v_category_insert_result > 0 then
      v_category_inserted_count := v_category_inserted_count + 1;
    end if;

    select c.id
      into v_category_id
    from public.categories c
    where c.business_id = p_business_id
      and c.profile_scope = 'enterprise_market'::public.product_profile_scope
      and c.name = v_category_name
    limit 1;

    if v_category_id is null then
      raise exception 'Satir %: kategori olusturulamadi (%).', v_row_count, v_category_name;
    end if;

    select p.id
      into v_existing_product_id
    from public.products p
    where p.business_id = p_business_id
      and p.profile_scope = 'enterprise_market'::public.product_profile_scope
      and p.category_id = v_category_id
      and p.name = v_product_name
    limit 1;

    insert into public.products (
      business_id,
      category_id,
      profile_scope,
      name,
      price,
      stock_count,
      image_url,
      description,
      is_available,
      barcode,
      plu_code,
      product_kind,
      unit,
      department
    ) values (
      p_business_id,
      v_category_id,
      'enterprise_market'::public.product_profile_scope,
      v_product_name,
      v_price,
      v_stock_count,
      v_image_url,
      v_description,
      v_is_available,
      v_barcode,
      v_plu_code,
      v_product_kind,
      v_unit,
      v_department
    )
    on conflict (business_id, profile_scope, category_id, name)
    do update set
      price = excluded.price,
      stock_count = excluded.stock_count,
      image_url = excluded.image_url,
      description = excluded.description,
      is_available = excluded.is_available,
      barcode = excluded.barcode,
      plu_code = excluded.plu_code,
      product_kind = excluded.product_kind,
      unit = excluded.unit,
      department = excluded.department,
      updated_at = now();

    if v_existing_product_id is null then
      v_inserted_count := v_inserted_count + 1;
    else
      v_updated_count := v_updated_count + 1;
    end if;
  end loop;

  if p_actor_id is not null then
    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      details
    ) values (
      p_actor_id,
      'market_import',
      p_business_id::text,
      'import_enterprise_market_catalog',
      jsonb_build_object(
        'replace_scope', p_replace_scope,
        'row_count', v_row_count,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'category_inserted_count', v_category_inserted_count
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'row_count', v_row_count,
    'inserted_count', v_inserted_count,
    'updated_count', v_updated_count,
    'category_inserted_count', v_category_inserted_count,
    'replace_scope', p_replace_scope
  );
end;
$$;
