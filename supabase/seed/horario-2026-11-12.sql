-- Horario confirmado por el cliente (2026-11-12): todos los días 10:00–15:00 y 16:30–23:00.
begin;
delete from public.business_hours;
insert into public.business_hours (weekday, opens_at, closes_at)
select d, t.o, t.c from generate_series(0, 6) d,
  (values ('10:00'::time, '15:00'::time), ('16:30'::time, '23:00'::time)) t(o, c);
commit;
select weekday, opens_at, closes_at from public.business_hours order by weekday, opens_at;
