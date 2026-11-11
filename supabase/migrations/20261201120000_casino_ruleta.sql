-- El casino en 3D, bloque c (1.109.0, SPEC §109; encargo de Francisco del 10-11-2026, plan en docs/qa/casino-3d.md):
-- la ruleta de premios, un giro a la semana. La aplica Francisco en el SQL Editor, después de
-- 20261130120000_almacen_ropa_permisos.sql. Sin ella, la ruleta de la sala se ve pero no se gira.
--
-- - Un giro por cuenta y semana (de lunes a domingo, la misma semana que las fichas y las ofertas del almacén). Solo a
--   solas: la mesa para dos no gira la ruleta.
-- - **Decide el servidor**, antes de que la rueda se mueva: sortea una de las ocho casillas con las probabilidades de
--   `piso_casino_ruleta_casillas` (las mismas que RULETA en src/features/edificio/hotel/ruleta.js; una prueba lo
--   comprueba) y la rueda de la app solo enseña lo decidido. Las probabilidades están siempre a la vista en la sala.
-- - Premios (nueve casillas): 20, 40 u 80 fichas (fuera del tope de 150 a la semana: no son manos), 100 garbanzos, el
--   esmoquin de terciopelo (jersey 22), tres muebles exclusivos (la lámpara de flecos, la ruleta de sobremesa y el reloj de
--   pie art déco) y, la casilla más rara (decisión de Francisco del 10-11-2026: «una mascota que pueda ir contigo, como las
--   de antes, pero de casino»), el mapache crupier, un compañero legendario que te acompaña como el conejo y la gaviota.
--   Lo que ya tienes y vuelve a salir se cambia por 40 fichas (el giro no se pierde).
-- - Lo ganado va a tu inventario o a tu armario, como lo de la caja: los muebles, rareza 'especial', y el mapache,
--   legendario de los que no salen en sobres (no se compra, no se recicla ni se regala ni va a la Lonja).
-- - Sin tickets ni sobres (siguen cerrados por la reforma).
-- ADITIVA y re-ejecutable: una tabla, cinco funciones nuevas, cuatro filas del catálogo, y redefine piso_personaje_valido
-- y pisos_personaje_prendas (las de 20261128120000_almacen_ropa.sql) con el esmoquin, y piso_casino_exclusivos (la de
-- 20261116120000_hotel_estiba.sql) con el mapache. No borra ni cambia ningún dato.
-- Probada con PGlite (src/features/edificio/__tests__/casino-ruleta.rls.test.js).

-- ── El giro de cada semana (solo se usa desde las funciones) ──
create table if not exists public.piso_casino_ruleta (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- El lunes de la semana del giro
  semana date not null,
  casilla smallint not null check (casilla between 0 and 8),
  premio text not null,
  -- Ya lo tenías: se cambió por fichas
  repetido boolean not null default false,
  fichas integer not null default 0 check (fichas >= 0),
  garbanzos integer not null default 0 check (garbanzos >= 0),
  creado timestamptz not null default now(),
  primary key (user_id, semana)
);
alter table public.piso_casino_ruleta enable row level security;
revoke all on public.piso_casino_ruleta from anon, authenticated;

-- Las nueve casillas, en el orden de la rueda (la 0 es la que queda arriba con la rueda quieta, y siguen en el sentido del
-- reloj). `peso`: la probabilidad en tanto por ciento (suman 100)
create or replace function public.piso_casino_ruleta_casillas()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'fichas:20', 'tipo', 'fichas', 'cantidad', 20, 'peso', 28),
    jsonb_build_object('id', 'jersey:22', 'tipo', 'prenda', 'cantidad', 1, 'peso', 7),
    jsonb_build_object('id', 'fichas:40', 'tipo', 'fichas', 'cantidad', 40, 'peso', 20),
    jsonb_build_object('id', 'lampara-flecos', 'tipo', 'mueble', 'cantidad', 1, 'peso', 6),
    jsonb_build_object('id', 'garbanzos:100', 'tipo', 'garbanzos', 'cantidad', 100, 'peso', 20),
    jsonb_build_object('id', 'ruleta-sobremesa', 'tipo', 'mueble', 'cantidad', 1, 'peso', 5),
    jsonb_build_object('id', 'fichas:80', 'tipo', 'fichas', 'cantidad', 80, 'peso', 9),
    jsonb_build_object('id', 'reloj-deco', 'tipo', 'mueble', 'cantidad', 1, 'peso', 3),
    jsonb_build_object('id', 'mapache-crupier', 'tipo', 'companero', 'cantidad', 1, 'peso', 2)
  );
$$;

-- Lo que se da en fichas si el premio ya lo tenías
create or replace function public.piso_casino_ruleta_repetido()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 40;
$$;

-- La ropa de la ruleta (no entra en el orden de las misiones del día ni se vende)
create or replace function public.piso_casino_ruleta_ropa()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['jersey:22'];
$$;

-- Los muebles de la ruleta, en el catálogo (los mismos que en src/features/edificio/catalog.js): premios; y el mapache,
-- legendario que te acompaña
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('lampara-flecos', 'suelo', 1, 1, null, 1, 'especial'),
  ('ruleta-sobremesa', 'suelo', 1, 1, null, 1, 'especial'),
  ('reloj-deco', 'suelo', 1, 1, null, 1, 'especial'),
  ('mapache-crupier', 'suelo', 1, 1, null, 1, 'legendario')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- El mapache, como el conejo y la gaviota, no sale en los sobres (la de 20261116120000_hotel_estiba.sql, con él)
create or replace function public.piso_casino_exclusivos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['neon-veintiuna', 'mesa-tapete', 'gramola', 'conejo-chistera', 'gaviota-puerto', 'mapache-crupier'];
$$;

-- El aspecto válido (el de 20261128120000_almacen_ropa.sql), con el esmoquin (22)
create or replace function public.piso_personaje_valido(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) = 7
    and (select bool_and(k in ('piel', 'pelo', 'colorPelo', 'jersey', 'pantalon', 'gafas', 'complemento')) from jsonb_object_keys(p) k)
    and jsonb_typeof(p->'piel') = 'number' and (p->>'piel') in ('0', '1', '2', '3', '4')
    and jsonb_typeof(p->'pelo') = 'string' and (p->>'pelo') in ('corto', 'melena', 'mono', 'rizos', 'largo', 'rapado')
    and jsonb_typeof(p->'colorPelo') = 'number' and (p->>'colorPelo') in ('0', '1', '2', '3', '4', '5', '6', '7')
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa', 'visera', 'fedora', 'gorro-estibador', 'panuelo', 'pompon', 'bandolera')
  )
$$;

-- Solo se lleva lo que se tiene (la de 20261128120000_almacen_ropa.sql), también el esmoquin de la ruleta
create or replace function public.pisos_personaje_prendas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  falta text;
begin
  if new.personaje is null then
    return new;
  end if;
  select k into falta from unnest(array[
      'colorPelo:' || (new.personaje->>'colorPelo'),
      'jersey:' || (new.personaje->>'jersey'),
      'pantalon:' || (new.personaje->>'pantalon'),
      'complemento:' || (new.personaje->>'complemento')
    ]) as k
    where (k = any (public.piso_prendas_orden()) or k = any (public.piso_casino_ropa()) or k = any (public.piso_estiba_ropa())
           or public.piso_almacen_ropa() ? k or k = any (public.piso_casino_ruleta_ropa()))
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    if falta = any (public.piso_casino_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por fichas en la caja del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_casino_ruleta_ropa()) then
      raise exception 'Aún no tienes esa prenda: puede tocar en la ruleta del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_estiba_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por sellos en la pared de la Lonja.' using errcode = 'P0001';
    end if;
    if public.piso_almacen_ropa() ? falta then
      raise exception 'Aún no tienes esa prenda: se compra con tickets en la planta de ropa del almacén.' using errcode = 'P0001';
    end if;
    raise exception 'Aún no tienes esa prenda: se gana con las misiones del día.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pisos_personaje_prendas() from public, anon, authenticated;

-- ¿Tiene ya `uid` el premio de una casilla? (las fichas y los garbanzos nunca se «tienen»)
create or replace function public.piso_casino_ruleta_tiene(uid uuid, c jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case c ->> 'tipo'
    when 'prenda' then exists (select 1 from public.piso_prendas x where x.user_id = uid and x.prenda = c ->> 'id')
    when 'mueble' then exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = c ->> 'id' and v.copias > 0)
    when 'companero' then exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = c ->> 'id' and v.copias > 0)
    else false end;
$$;
revoke all on function public.piso_casino_ruleta_tiene(uuid, jsonb) from public, anon, authenticated;

-- La ruleta para quien juega, en la semana de `dia`: { semana, casillas: [{ id, tipo, cantidad, peso, tienes }],
-- repetido, giro: { casilla, premio, repetido, fichas, garbanzos } | null, fichas, garbanzos }
create or replace function public.piso_casino_ruleta(dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  lunes date := date_trunc('week', dia)::date;
  g public.piso_casino_ruleta;
begin
  select * into g from public.piso_casino_ruleta r where r.user_id = me and r.semana = lunes;
  return jsonb_build_object(
    'semana', lunes,
    'casillas', (select jsonb_agg(c || jsonb_build_object('tienes', public.piso_casino_ruleta_tiene(me, c)) order by n)
                   from jsonb_array_elements(public.piso_casino_ruleta_casillas()) with ordinality as t (c, n)),
    'repetido', public.piso_casino_ruleta_repetido(),
    'giro', case when g.user_id is null then null else jsonb_build_object(
      'casilla', g.casilla, 'premio', g.premio, 'repetido', g.repetido, 'fichas', g.fichas, 'garbanzos', g.garbanzos) end,
    'fichas', coalesce((select c.fichas from public.piso_casino_cuentas c where c.user_id = me), 0),
    'garbanzos', coalesce((select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me), 0)
  );
end;
$$;
revoke all on function public.piso_casino_ruleta(date) from public, anon;
grant execute on function public.piso_casino_ruleta(date) to authenticated;

-- Girar la ruleta de la semana de `dia` (hoy, ayer o mañana, por las zonas horarias). Una vez por semana: el premio se
-- sortea aquí y se da en la misma transacción; devuelve la ruleta con el giro hecho
create or replace function public.piso_casino_ruleta_girar(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  lunes date := date_trunc('week', dia)::date;
  tirada numeric := random() * 100;
  acum integer := 0;
  n integer := -1;
  c jsonb;
  k integer;
  rep boolean := false;
  dar_fichas integer := 0;
  dar_garbanzos integer := 0;
begin
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede jugar.' using errcode = 'P0001';
  end if;
  perform public.piso_casino_llegar(me, dia);
  -- La cuenta, bloqueada: dos giros a la vez de la misma persona van uno detrás de otro
  perform 1 from public.piso_casino_cuentas x where x.user_id = me for update;
  if exists (select 1 from public.piso_casino_ruleta r where r.user_id = me and r.semana = lunes) then
    raise exception 'Esta semana ya has girado la ruleta.' using errcode = 'P0001';
  end if;
  -- El sorteo, con los pesos de las casillas
  for k in 0 .. jsonb_array_length(public.piso_casino_ruleta_casillas()) - 1 loop
    c := public.piso_casino_ruleta_casillas() -> k;
    acum := acum + (c ->> 'peso')::integer;
    if tirada < acum then
      n := k;
      exit;
    end if;
  end loop;
  if n < 0 then
    n := jsonb_array_length(public.piso_casino_ruleta_casillas()) - 1;
    c := public.piso_casino_ruleta_casillas() -> n;
  end if;
  if c ->> 'tipo' = 'fichas' then
    dar_fichas := (c ->> 'cantidad')::integer;
  elsif c ->> 'tipo' = 'garbanzos' then
    dar_garbanzos := (c ->> 'cantidad')::integer;
  elsif public.piso_casino_ruleta_tiene(me, c) then
    rep := true;
    dar_fichas := public.piso_casino_ruleta_repetido();
  elsif c ->> 'tipo' = 'prenda' then
    insert into public.piso_prendas (user_id, prenda) values (me, c ->> 'id') on conflict do nothing;
  else
    perform public.piso_sumar(me, c ->> 'id', 1);
  end if;
  update public.piso_casino_cuentas x set fichas = x.fichas + dar_fichas, garbanzos = least(100000, x.garbanzos + dar_garbanzos) where x.user_id = me;
  insert into public.piso_casino_ruleta (user_id, semana, casilla, premio, repetido, fichas, garbanzos)
    values (me, lunes, n, c ->> 'id', rep, dar_fichas, dar_garbanzos);
  return public.piso_casino_ruleta(dia);
end;
$$;
revoke all on function public.piso_casino_ruleta_girar(date) from public, anon;
grant execute on function public.piso_casino_ruleta_girar(date) to authenticated;
