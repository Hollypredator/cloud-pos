update public.orders
set check_number = lpad(check_sequence::text, 4, '0')
where check_sequence is not null
  and check_sequence > 0
  and check_number ~ '^[0-9]+$';

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
    new.check_number := lpad(new.check_sequence::text, 4, '0');
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
  new.check_number := lpad(v_next::text, 4, '0');
  return new;
end;
$$;
