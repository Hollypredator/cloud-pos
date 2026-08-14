-- Malzeme alim girisi: hareketli agirlikli ortalama maliyet (MAP).
--
-- Plan: PLAN-RECETE-MALIYET-STOK.md, Faz 5.
--
-- Faz 1'de stok DUSUM tarafi kuruldu (satis, sayim). Alim yoktu — stok tek
-- yonlu azaliyordu, iki hafta icinde tum bakiyeler negatife duserdi (CEO
-- review D3.1). Bu migration alim tarafini ekler.
--
-- Neden Postgres fonksiyonu, istemciden okuma-hesapla-yazma degil: iki
-- e s zamanli alim ayni malzemeye girerse, istemci tarafinda "mevcut
-- ortalamayi oku, yeni ortalamayi hesapla, yaz" sirasi yarisa girer — biri
-- digerinin hesabini gormeden yazar, maliyet yanlis cikar. `for update` satir
-- kilidi bunu onler.

create or replace function public.record_ingredient_purchase(
  p_branch_id uuid,
  p_ingredient_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_note text default null
)
returns table(new_quantity numeric, new_avg_cost numeric)
language plpgsql
as $$
declare
  v_current_qty numeric;
  v_current_cost numeric;
  v_new_avg numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Alım miktarı sıfırdan büyük olmalı.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Birim maliyet negatif olamaz.';
  end if;

  -- Satir kilidi: ayni malzemeye es zamanli ikinci alim bu satirin
  -- serbest kalmasini bekler, eski ortalamayi gormez.
  select coalesce(quantity, 0) into v_current_qty
  from public.ingredient_stock
  where ingredient_id = p_ingredient_id and branch_id = p_branch_id
  for update;

  if not found then
    v_current_qty := 0;
  end if;

  select coalesce(cost, 0) into v_current_cost
  from public.ingredients
  where id = p_ingredient_id
  for update;

  if not found then
    raise exception 'Malzeme bulunamadı: %', p_ingredient_id;
  end if;

  -- MAP: yeni_ortalama = (mevcut_miktar × mevcut_ortalama + alim_miktari × alim_fiyati)
  --                       / (mevcut_miktar + alim_miktari)
  v_new_avg := case
    when (v_current_qty + p_quantity) > 0
      then round(((v_current_qty * v_current_cost) + (p_quantity * p_unit_cost)) / (v_current_qty + p_quantity), 4)
    else p_unit_cost
  end;

  -- Hareket kaydi `purchase`. change_quantity pozitif — trigger
  -- (apply_ingredient_movement) ingredient_stock.quantity'yi otomatik artirir.
  -- unit_cost burada TARIHI alim fiyatidir (guncel ortalama degil); denetimde
  -- "bu parti ne kadara alindi" sorusuna cevap verir.
  insert into public.ingredient_movements (ingredient_id, branch_id, change_quantity, unit_cost, reason, note)
  values (p_ingredient_id, p_branch_id, p_quantity, p_unit_cost, 'purchase', p_note);

  update public.ingredients set cost = v_new_avg where id = p_ingredient_id;

  return query select (v_current_qty + p_quantity), v_new_avg;
end;
$$;

comment on function public.record_ingredient_purchase is
  'Alim girisi: stogu artirir (trigger uzerinden), hareketli agirlikli ortalama maliyeti gunceller. Satir kilidiyle es zamanli alim yarisina karsi korumali.';

-- Yetki: alim yonetim isi, kasiyer degil. Ayni ilke ingredient_movements
-- RLS'inde de var (CEO review 4A) — fonksiyon SECURITY INVOKER kalir,
-- cagiran RLS'e tabidir; ekstra kontrol gerekmez, "management write stock
-- movements" policy'si zaten insert'i can_manage_branch'e baglar.
grant execute on function public.record_ingredient_purchase(uuid, uuid, numeric, numeric, text) to authenticated;
