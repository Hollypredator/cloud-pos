-- Salon krokisi: masalarin gercek yerlesim konumu ve kapasitesi.
--
-- Konum yuzde olarak saklanir (0-100), piksel degil: kroki tuvali ekran
-- genisligine gore esner. Piksel saklasaydik tablette duzgun duran yerlesim
-- masaustunde dagilirdi.
--
-- Not: dosya tarihi 20260811 — orijinal calismada 20260717/20260718 idi.
-- Uzak migration gecmisinde 20260809/20260810 zaten kayitli oldugu icin
-- geriye tarihli dosya eklemek sirayi bozardi; icerik aynidir.

alter table public.tables
  add column if not exists position_x numeric,
  add column if not exists position_y numeric,
  add column if not exists seat_count integer not null default 4;

comment on column public.tables.position_x is 'Kroki tuvalinde X konumu, kapsayici genisliginin yuzdesi (0-100)';
comment on column public.tables.position_y is 'Kroki tuvalinde Y konumu, kapsayici yuksekliginin yuzdesi (0-100)';
comment on column public.tables.seat_count is 'Masa kapasitesi; kroki dugumunun boyutunu/seklini belirler (2/4/6/8+)';
