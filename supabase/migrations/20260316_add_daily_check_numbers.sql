alter table public.orders
  add column if not exists check_date date,
  add column if not exists check_sequence integer,
  add column if not exists check_number text;

with ranked as (
  select
    o.id,
    coalesce(o.check_date, (timezone('Europe/Istanbul', o.created_at))::date) as resolved_check_date,
    row_number() over (
      partition by
        coalesce(o.business_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(o.branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(o.check_date, (timezone('Europe/Istanbul', o.created_at))::date)
      order by o.created_at asc, o.id asc
    ) as seq
  from public.orders o
)
update public.orders o
set
  check_date = ranked.resolved_check_date,
  check_sequence = ranked.seq,
  check_number = lpad(ranked.seq::text, 3, '0')
from ranked
where o.id = ranked.id;

alter table public.orders
  alter column check_date set default (timezone('Europe/Istanbul', now()))::date;

create or replace function public.assign_order_check_number()
returns trigger
language plpgsql
as $$
declare
  v_check_date date;
  v_next integer;
  v_lock_key text;
begin
  if new.created_at is null then
    new.created_at = now();
  end if;

  v_check_date := coalesce(new.check_date, (timezone('Europe/Istanbul', new.created_at))::date);
  new.check_date := v_check_date;

  if new.check_sequence is null and new.check_number ~ '^[0-9]+$' then
    new.check_sequence := greatest(1, new.check_number::integer);
  end if;

  if new.check_sequence is not null and new.check_sequence > 0 then
    new.check_number := lpad(new.check_sequence::text, 3, '0');
    return new;
  end if;

  v_lock_key := concat_ws(
    ':',
    coalesce(new.business_id::text, '00000000-0000-0000-0000-000000000000'),
    coalesce(new.branch_id::text, '00000000-0000-0000-0000-000000000000'),
    v_check_date::text
  );
  perform pg_advisory_xact_lock(hashtext(v_lock_key));

  select coalesce(max(o.check_sequence), 0) + 1
    into v_next
  from public.orders o
  where o.check_date = v_check_date
    and o.business_id is not distinct from new.business_id
    and o.branch_id is not distinct from new.branch_id;

  new.check_sequence := v_next;
  new.check_number := lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_orders_assign_check_number on public.orders;
create trigger trg_orders_assign_check_number
before insert on public.orders
for each row execute function public.assign_order_check_number();

create unique index if not exists uniq_orders_business_branch_check_day_sequence
  on public.orders (
    coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    check_date,
    check_sequence
  );

create index if not exists idx_orders_business_branch_check_day
  on public.orders (business_id, branch_id, check_date desc, check_sequence desc);

alter table public.orders
  alter column check_date set not null,
  alter column check_sequence set not null,
  alter column check_number set not null;
