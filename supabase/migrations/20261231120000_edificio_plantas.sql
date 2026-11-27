-- Libotown · 1.152 (docs/qa/amigos-vecinos.md, bloque 2): el edificio crece por plantas. Decisión de Francisco del 26-11-2026
-- («Crece con plantas»): al llenarse, el edificio gana una planta (2 puertas más), hasta 5 plantas (10 vecinos), y la fachada
-- se dibuja más alta.
--
-- - Las puertas van del 1.º A al 5.º B.
-- - Un edificio tiene 3 plantas, o las que hagan falta para su vecino más alto (`edificio_plantas`): no se guarda en ninguna
--   tabla, sale de quién vive dónde. Si se va quien vivía arriba del todo, el edificio vuelve a su altura.
-- - Una puerta libre (`edificio_puerta_libre`) se busca primero en las plantas que ya hay; si están llenas, en la siguiente,
--   y así el edificio crece. Con 5 plantas llenas (10 vecinos), está lleno.
-- - `edificio_ver_llave` dice «lleno» con 10 vecinos (antes, 6) y `edificio_portal` da las plantas de verdad y las puertas que
--   quedan hasta las 10.
--
-- Va después de `20261230120000_edificio_amigos.sql` (el bloque 1) y se puede volver a ejecutar. No mueve a nadie ni borra nada.

-- ── Las puertas, hasta el 5.º B ────────────────────────────────────────────────────────────────────────────────────────────
alter table public.edificio_vecinos drop constraint if exists edificio_vecinos_puerta_check;
alter table public.edificio_vecinos add constraint edificio_vecinos_puerta_check check (puerta ~ '^[1-5][AB]$');

-- ── Cuántas plantas tiene un edificio: 3, o hasta su vecino más alto ───────────────────────────────────────────────────────
create or replace function public.edificio_plantas(ed uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(3, coalesce(max(substr(v.puerta, 1, 1)::int), 0)) from public.edificio_vecinos v where v.edificio = ed;
$$;
revoke all on function public.edificio_plantas(uuid) from public, anon, authenticated;

-- ── Una puerta libre, al azar: primero en las plantas que hay y, si están llenas, en una planta nueva (null si está lleno) ──
create or replace function public.edificio_puerta_libre(ed uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  with alto as (select public.edificio_plantas(ed) as n)
  select f::text || l
    from generate_series(1, 5) f
    cross join (values ('A'), ('B')) x(l)
    cross join alto
    where f <= alto.n + 1
      and f::text || l not in (select v.puerta from public.edificio_vecinos v where v.edificio = ed)
    order by f > alto.n, random()
    limit 1;
$$;
revoke all on function public.edificio_puerta_libre(uuid) from public, anon, authenticated;

-- ── Mirar una llave: lleno con 10 vecinos ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.edificio_ver_llave(cod text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  l public.edificio_llaves;
  mio uuid;
  n int;
begin
  if me is null then
    return jsonb_build_object('motivo', 'sesion');
  end if;
  select * into l from public.edificio_llaves x where x.codigo = public.edificio_codigo(cod);
  if not found or not public.edificio_llave_viva(l)
     or not exists (select 1 from public.edificio_vecinos v where v.user_id = l.de and v.edificio = l.edificio) then
    return jsonb_build_object('motivo', 'no_sirve');
  end if;
  if public.edificio_bloqueo_entre(me, l.de) then
    return jsonb_build_object('motivo', 'no_sirve');
  end if;
  select v.edificio into mio from public.edificio_vecinos v where v.user_id = me;
  select count(*) into n from public.edificio_vecinos v where v.edificio = l.edificio;
  return jsonb_build_object(
    'motivo', case
      when not public.community_member(me) then 'comunidad'
      when mio = l.edificio then 'ya_vives'
      when l.de = me then 'tuya'
      when n >= 10 then 'lleno'
      else null end,
    'de', (select jsonb_build_object('alias', p.alias, 'avatar_id', p.avatar_id) from public.profiles p where p.user_id = l.de),
    'vecinos', n,
    'plantas', public.edificio_plantas(l.edificio),
    'caduca', l.caduca
  );
end;
$$;
revoke all on function public.edificio_ver_llave(text) from public, anon;
grant execute on function public.edificio_ver_llave(text) to authenticated;

-- ── El portal: las plantas de verdad y las puertas que quedan hasta las 10 ─────────────────────────────────────────────────
create or replace function public.edificio_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ed uuid;
  door text;
  rows jsonb;
  n int;
begin
  if me is null then
    return null;
  end if;
  select v.edificio, v.puerta into ed, door from public.edificio_vecinos v where v.user_id = me;
  if ed is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', v.user_id,
      'puerta', v.puerta,
      'alias', p.alias,
      'avatar_id', p.avatar_id,
      'yo', v.user_id = me,
      'layout', s.layout,
      'personaje', s.personaje,
      'companero', s.companero,
      'sello_dado', (select x.sello from public.piso_sellos x where x.de = me and x.para = v.user_id),
      'sello_recibido', (select x.sello from public.piso_sellos x where x.de = v.user_id and x.para = me)
    ) order by v.puerta desc), '[]'::jsonb)
    into rows
    from public.edificio_vecinos v
    left join public.profiles p on p.user_id = v.user_id
    left join public.pisos s on s.user_id = v.user_id
    where v.edificio = ed
      and (v.user_id = me or (coalesce(p.community_enabled, false) and not public.is_blocked_pair(v.user_id)));
  select count(*) into n from public.edificio_vecinos v where v.edificio = ed;
  return jsonb_build_object('edificio', ed, 'puerta', door, 'vecinos', rows, 'plantas', public.edificio_plantas(ed), 'libres', greatest(0, 10 - n));
end;
$$;
revoke all on function public.edificio_portal() from public, anon;
grant execute on function public.edificio_portal() to authenticated;
