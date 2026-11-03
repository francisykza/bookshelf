-- 1.79 · La suite de la semana, decorada entre todos (paso B de docs/qa/gran-hotel.md §9.3, rehecho con Francisco el
-- 3-11-2026: el hotel es lo social, lejos del edificio, que es lo personal; ningún piso se enseña fuera de su edificio
-- y no se vota). El ático del Gran Hotel es una habitación común que empieza vacía cada lunes (semanas de lunes a
-- domingo, date_trunc('week', …)):
--   · cada persona de la comunidad lleva un mueble suyo a la semana (no lo pierde: es una copia de exposición) y lo
--     puede cambiar de sitio, cambiar por otro o retirarlo;
--   · vale lo corriente que tengas (común, poco común o raro, de suelo, alfombra o pared; ni sagas, ni místicos, ni
--     cosas de «encima», que dependerían del mueble de otro);
--   · todo tiene que caber como en un piso (piso_valido: 9 × 9, sin solapes, como mucho 40 cosas);
--   · con cuatro semanas distintas aportando, una «Placa de la suite» (rareza 'especial': no se compra, no sale en
--     sobres y no se regala ni se recicla), una sola vez. Ni tickets ni fichas.
-- Se ve el alias de quien trajo cada cosa (sin el piso de nadie). Lo de quien te bloquea o bloqueas no se te enseña.
-- Necesita las migraciones del edificio, el inventario, la tienda, los místicos y los vecinos. ADITIVA y
-- re-ejecutable: tablas y funciones nuevas, una fila del catálogo y piso_reciclar sin lo especial. No borra datos. La
-- aplica Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/suite.rls.test.js).

-- ── La placa, en el catálogo (la misma que en src/features/edificio/catalog.js) ──
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('placa-suite', 'pared', 1, null, null, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- ── Reciclar (la de los místicos, 1.73): lo especial tampoco se recicla, para que el premio no sea moneda ──
create or replace function public.piso_reciclar(mueble text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  k public.piso_catalogo;
  tengo integer;
  puestos integer;
  vale integer;
begin
  select * into k from public.piso_catalogo c where c.id = mueble;
  if k.id is null or k.saga is not null or k.rareza in ('mistico', 'legendario', 'especial') then
    raise exception 'Eso no se puede reciclar.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = piso_reciclar.mueble), 0) into tengo;
  select count(*) into puestos
    from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
    where p.user_id = me and e ->> 'id' = piso_reciclar.mueble;
  if tengo - puestos < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de reciclarlo.' using errcode = 'P0001';
  end if;
  vale := case k.rareza when 'comun' then 3 when 'poco-comun' then 8 when 'raro' then 20 else 40 end;
  perform public.piso_sumar(me, mueble, -1);
  update public.piso_cuentas set tickets = least(100000, tickets + vale) where user_id = me;
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_reciclar(text) from public, anon;
grant execute on function public.piso_reciclar(text) to authenticated;

-- ── Tablas (solo se usan desde las funciones) ──
-- Cada semana de la suite, con su pared y su suelo (cambian cada semana); su fila hace de cerrojo al llevar algo
create table if not exists public.piso_suite_semanas (
  semana date primary key,
  pared text not null,
  suelo text not null
);
-- Lo que ha traído cada persona esta semana (uno por persona y semana). `item`: el mueble sin uid, como en un piso
create table if not exists public.piso_suite_aportes (
  semana date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  item jsonb not null,
  creado timestamptz not null default now(),
  primary key (semana, user_id)
);
-- Quien ya tiene su placa (se da una vez)
create table if not exists public.piso_suite_placas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado timestamptz not null default now()
);
alter table public.piso_suite_semanas enable row level security;
alter table public.piso_suite_aportes enable row level security;
alter table public.piso_suite_placas enable row level security;
revoke all on public.piso_suite_semanas from anon, authenticated;
revoke all on public.piso_suite_aportes from anon, authenticated;
revoke all on public.piso_suite_placas from anon, authenticated;

-- Las semanas que hacen falta para la placa (SUITE_PLACA_SEMANAS en src/features/edificio/hotel/suite.js)
create or replace function public.piso_suite_placa_semanas()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 4;
$$;

-- El lunes de esta semana, con su fila creada (pared y suelo, uno distinto cada semana)
create or replace function public.piso_suite_semana()
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s date := date_trunc('week', current_date)::date;
  k integer := ((s - date '2026-01-05') / 7);
begin
  insert into public.piso_suite_semanas (semana, pared, suelo)
    values (s, (array['noche', 'salvia', 'rosa', 'yeso'])[1 + ((k % 4) + 4) % 4], (array['damero', 'tablas', 'barro'])[1 + ((k % 3) + 3) % 3])
    on conflict do nothing;
  return s;
end;
$$;
revoke all on function public.piso_suite_semana() from public, anon, authenticated;

-- La suite de una semana como un piso (uids por orden de llegada), sin lo de `fuera` (quien lleva otra cosa)
create or replace function public.piso_suite_layout(s date, fuera uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('v', 1, 'pared', w.pared, 'suelo', w.suelo, 'items', coalesce((
    select jsonb_agg(a.item || jsonb_build_object('uid', a.n) order by a.n)
    from (select x.item, row_number() over (order by x.creado, x.user_id) as n from public.piso_suite_aportes x
          where x.semana = s and x.user_id is distinct from fuera) a), '[]'::jsonb))
  from public.piso_suite_semanas w where w.semana = s;
$$;
revoke all on function public.piso_suite_layout(date, uuid) from public, anon, authenticated;

-- La suite para quien la mira: { semana, layout, aportes: [{ uid, alias, avatar_id, mueble, yo }], mio, semanas,
-- placa, meta }. Lo de quien no está en la comunidad o tiene un bloqueo contigo no se enseña
create or replace function public.piso_suite()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s date := public.piso_suite_semana();
  w public.piso_suite_semanas;
  vistos jsonb;
begin
  select * into w from public.piso_suite_semanas x where x.semana = s;
  select coalesce(jsonb_agg(v order by (v ->> 'n')::integer), '[]'::jsonb) into vistos from (
    select jsonb_build_object('n', a.n, 'item', a.item, 'user_id', a.user_id, 'alias', pr.alias, 'avatar_id', pr.avatar_id) as v
    from (select x.*, row_number() over (order by x.creado, x.user_id) as n from public.piso_suite_aportes x where x.semana = s) a
    left join public.profiles pr on pr.user_id = a.user_id
    where a.user_id = me or (public.community_member(a.user_id) and not public.is_blocked_pair(a.user_id))
  ) t;
  return jsonb_build_object(
    'semana', s,
    'layout', jsonb_build_object('v', 1, 'pared', w.pared, 'suelo', w.suelo,
      'items', (select coalesce(jsonb_agg((e -> 'item') || jsonb_build_object('uid', (e ->> 'n')::integer)), '[]'::jsonb) from jsonb_array_elements(vistos) e)),
    'aportes', (select coalesce(jsonb_agg(jsonb_build_object('uid', (e ->> 'n')::integer, 'alias', e ->> 'alias', 'avatar_id', e ->> 'avatar_id',
      'mueble', e -> 'item' ->> 'id', 'yo', (e ->> 'user_id')::uuid = me)), '[]'::jsonb) from jsonb_array_elements(vistos) e),
    'mio', (select x.item from public.piso_suite_aportes x where x.semana = s and x.user_id = me),
    'semanas', (select count(distinct x.semana)::integer from public.piso_suite_aportes x where x.user_id = me),
    'placa', exists (select 1 from public.piso_suite_placas p where p.user_id = me),
    'meta', public.piso_suite_placa_semanas()
  );
end;
$$;
revoke all on function public.piso_suite() from public, anon;
grant execute on function public.piso_suite() to authenticated;

-- Llevar un mueble tuyo a la suite (o cambiar el que llevaste de sitio o por otro). `item`: como en un piso, sin uid
-- ({ id, tono, x, y, rot } en el suelo o { id, tono, pared, a } en la pared)
create or replace function public.piso_suite_llevar(item jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s date := public.piso_suite_semana();
  k public.piso_catalogo;
  layout jsonb;
begin
  if item is null or jsonb_typeof(item) <> 'object' or item ? 'uid' then
    raise exception 'Ese mueble no se puede llevar.' using errcode = 'P0001';
  end if;
  select * into k from public.piso_catalogo c where c.id = item ->> 'id';
  if k.id is null or k.saga is not null or k.rareza not in ('comun', 'poco-comun', 'raro') or k.capa not in ('suelo', 'alfombra', 'pared') then
    raise exception 'A la suite se lleva un mueble corriente de suelo, alfombra o pared.' using errcode = 'P0001';
  end if;
  if coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = k.id), 0) < 1 then
    raise exception 'Solo se lleva un mueble que tengas.' using errcode = 'P0001';
  end if;
  -- Uno a la vez: así dos personas no ponen algo en el mismo sitio
  perform 1 from public.piso_suite_semanas w where w.semana = s for update;
  layout := public.piso_suite_layout(s, me);
  layout := jsonb_set(layout, '{items}', (layout -> 'items') || (item || jsonb_build_object('uid', jsonb_array_length(layout -> 'items') + 1)));
  if not public.piso_valido(layout) then
    raise exception 'Ahí no cabe: elige otro sitio.' using errcode = 'P0001';
  end if;
  insert into public.piso_suite_aportes (semana, user_id, item) values (s, me, item)
    on conflict on constraint piso_suite_aportes_pkey do update set item = excluded.item;
  -- La placa, una vez, al llegar a las semanas que hacen falta
  if (select count(distinct x.semana) from public.piso_suite_aportes x where x.user_id = me) >= public.piso_suite_placa_semanas() then
    insert into public.piso_suite_placas (user_id) values (me) on conflict do nothing;
    if found then
      perform public.piso_sumar(me, 'placa-suite', 1);
    end if;
  end if;
  return public.piso_suite();
end;
$$;
revoke all on function public.piso_suite_llevar(jsonb) from public, anon;
grant execute on function public.piso_suite_llevar(jsonb) to authenticated;

-- Retirar lo que llevaste esta semana
create or replace function public.piso_suite_retirar()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s date := public.piso_suite_semana();
begin
  delete from public.piso_suite_aportes x where x.semana = s and x.user_id = me;
  return public.piso_suite();
end;
$$;
revoke all on function public.piso_suite_retirar() from public, anon;
grant execute on function public.piso_suite_retirar() to authenticated;
