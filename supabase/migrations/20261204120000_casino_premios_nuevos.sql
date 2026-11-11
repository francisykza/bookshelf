-- El casino en 3D, bloque e (segunda parte, 1.112.0, SPEC §112; plan en docs/qa/casino-3d.md §4, aprobado por Francisco el
-- 10-11-2026): los seis premios nuevos de la vitrina. La aplica Francisco en el SQL Editor, después de
-- 20261203120000_casino_vitrina.sql. Sin ella, los premios nuevos se ven tapados en la vitrina y no se pueden conseguir.
--
-- - **De la caja, con fichas** (como el resto de la caja): el reloj de bolsillo dorado (complemento, 180 fichas) y la
--   alfombra de rombos dorados (mueble de suelo, 350 fichas).
-- - **De las chisteras, con sellos de partidas perfectas**: cada partida perfecta de «Las tres chisteras» (tres de tres) es un
--   sello. Se cambian por la chistera de mago (2 sellos), la varita de mago (4), el baúl de mago (6) y el acabado «Polvo de
--   estrellas» (10), que se pone en una copia lisa tuya, como los acabados de la pared de la Lonja. Cada premio, una vez.
--   **Nunca con dinero ni tickets**: los sellos solo salen de jugar.
-- - El acabado «Polvo de estrellas» no sale en los sobres (piso_acabado_tirar no cambia) ni se canjea en la Lonja: solo de las
--   chisteras. La copia lo conserva al venderla o regalarla, como los demás acabados.
-- - Los muebles nuevos, rareza 'especial': no se compran en la tienda, no salen en sobres y no se regalan ni se reciclan.
-- ADITIVA y re-ejecutable: una tabla (los canjes de sellos), dos filas del catálogo, amplía dos comprobaciones de acabado y
-- redefine piso_casino_caja_precios, piso_casino_ropa, piso_casino_exclusivos, piso_personaje_valido,
-- pisos_personaje_prendas, piso_casino_chisteras_vista, piso_casino_vitrina_premios y piso_casino_vitrina_de_cuenta (cada
-- una, su última versión con lo nuevo). No borra ni cambia ningún dato.
-- Probada con PGlite (src/features/edificio/__tests__/casino-premios.rls.test.js).

-- ── Los muebles nuevos, en el catálogo (los mismos que en src/features/edificio/catalog.js) ──
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('alfombra-rombos', 'alfombra', 3, 2, null, 1, 'especial'),
  ('baul-mago', 'suelo', 2, 1, 0.88, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- ── El acabado «Polvo de estrellas»: se admite en las copias y en los puestos de la Lonja (no se sortea) ──
alter table public.piso_acabados drop constraint if exists piso_acabados_acabado_check;
alter table public.piso_acabados add constraint piso_acabados_acabado_check
  check (acabado in ('salitre', 'sol-de-tarde', 'lacado', 'nacar', 'polvo-estrellas'));
alter table public.piso_lonja_ofertas drop constraint if exists piso_lonja_ofertas_da_acabado_check;
alter table public.piso_lonja_ofertas add constraint piso_lonja_ofertas_da_acabado_check
  check (da_acabado in ('salitre', 'sol-de-tarde', 'lacado', 'nacar', 'polvo-estrellas'));

-- ── La caja (la de 20261110120000_hotel_casino.sql), con el reloj de bolsillo y la alfombra ──
create or replace function public.piso_casino_caja_precios()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'sobre', jsonb_build_object('tipo', 'sobre', 'precio', 120),
    'complemento:visera', jsonb_build_object('tipo', 'prenda', 'precio', 60),
    'pantalon:9', jsonb_build_object('tipo', 'prenda', 'precio', 80),
    'jersey:15', jsonb_build_object('tipo', 'prenda', 'precio', 100),
    'complemento:fedora', jsonb_build_object('tipo', 'prenda', 'precio', 140),
    'complemento:reloj-bolsillo', jsonb_build_object('tipo', 'prenda', 'precio', 180),
    'jersey:16', jsonb_build_object('tipo', 'prenda', 'precio', 200),
    'neon-veintiuna', jsonb_build_object('tipo', 'mueble', 'precio', 250),
    'mesa-tapete', jsonb_build_object('tipo', 'mueble', 'precio', 300),
    'alfombra-rombos', jsonb_build_object('tipo', 'mueble', 'precio', 350),
    'gramola', jsonb_build_object('tipo', 'mueble', 'precio', 400),
    'conejo-chistera', jsonb_build_object('tipo', 'companero', 'precio', 1500));
$$;

create or replace function public.piso_casino_ropa()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:visera', 'pantalon:9', 'jersey:15', 'complemento:fedora', 'complemento:reloj-bolsillo', 'jersey:16'];
$$;

-- No salen en los sobres (la de 20261201120000_casino_ruleta.sql, con la alfombra y el baúl)
create or replace function public.piso_casino_exclusivos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['neon-veintiuna', 'mesa-tapete', 'gramola', 'conejo-chistera', 'gaviota-puerto', 'mapache-crupier', 'alfombra-rombos', 'baul-mago'];
$$;

-- ── Los premios de las chisteras: { id: { tipo, sellos } } (los mismos que PREMIOS_CHISTERAS en hotel/chisteras.js) ──
create or replace function public.piso_casino_chisteras_premios()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'complemento:chistera-mago', jsonb_build_object('tipo', 'prenda', 'sellos', 2),
    'complemento:varita', jsonb_build_object('tipo', 'prenda', 'sellos', 4),
    'baul-mago', jsonb_build_object('tipo', 'mueble', 'sellos', 6),
    'acabado:polvo-estrellas', jsonb_build_object('tipo', 'acabado', 'sellos', 10));
$$;

-- La ropa de las chisteras (no entra en las misiones ni se vende)
create or replace function public.piso_casino_chisteras_ropa()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:chistera-mago', 'complemento:varita'];
$$;

-- Lo canjeado con sellos (solo se usa desde las funciones)
create table if not exists public.piso_casino_chisteras_canjes (
  user_id uuid not null references auth.users (id) on delete cascade,
  premio text not null,
  sellos integer not null check (sellos > 0),
  -- El acabado: en qué mueble se puso
  mueble text,
  creado timestamptz not null default now(),
  primary key (user_id, premio)
);
alter table public.piso_casino_chisteras_canjes enable row level security;
revoke all on public.piso_casino_chisteras_canjes from anon, authenticated;

-- Los sellos que le quedan a `uid`: sus partidas perfectas menos lo ya cambiado
create or replace function public.piso_casino_chisteras_sellos(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer from public.piso_casino_chisteras c where c.user_id = uid and c.estado = 'hecha' and c.aciertos = 3)
       - coalesce((select sum(k.sellos)::integer from public.piso_casino_chisteras_canjes k where k.user_id = uid), 0);
$$;
revoke all on function public.piso_casino_chisteras_sellos(uuid) from public, anon, authenticated;

-- Los premios de las chisteras para `uid`: [{ id, tipo, sellos, tienes }] y los muebles en los que se puede poner el acabado
-- (plpgsql: así se crea aunque falte piso_retirado, como en las pruebas de las reglas de antes de la reforma)
create or replace function public.piso_casino_chisteras_tienda(uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'sellos', public.piso_casino_chisteras_sellos(uid),
    'premios', (select jsonb_agg(jsonb_build_object(
        'id', a.key,
        'tipo', a.value ->> 'tipo',
        'sellos', (a.value ->> 'sellos')::integer,
        'tienes', exists (select 1 from public.piso_casino_chisteras_canjes k where k.user_id = uid and k.premio = a.key)
      ) order by (a.value ->> 'sellos')::integer)
      from jsonb_each(public.piso_casino_chisteras_premios()) a),
    'acabables', to_jsonb(array(
      select v.mueble from public.piso_inventario v
      where v.user_id = uid and v.copias > 0 and public.piso_lonja_rareza(v.mueble) is not null and not public.piso_retirado(v.mueble)
        and public.piso_lonja_libres(uid, v.mueble) > 0
      order by v.mueble)));
end;
$$;
revoke all on function public.piso_casino_chisteras_tienda(uuid) from public, anon, authenticated;

-- La partida (la de 20261202120000_casino_chisteras.sql), con los sellos y sus premios
create or replace function public.piso_casino_chisteras_vista(uid uuid, dia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dia', piso_casino_chisteras_vista.dia,
    'estado', p.estado,
    'ronda', coalesce(p.ronda, 1),
    'rondas', coalesce(p.rondas, '[]'::jsonb),
    'aciertos', coalesce(p.aciertos, 0),
    'fichas', coalesce(p.fichas, 0),
    'perfectas', (select count(*) from public.piso_casino_chisteras x where x.user_id = uid and x.estado = 'hecha' and x.aciertos = 3),
    'reglas', public.piso_casino_chisteras_reglas(),
    'semana', public.piso_casino_semana(uid, piso_casino_chisteras_vista.dia),
    'tope', (public.piso_casino_reglas() ->> 'tope')::integer,
    'fichasCuenta', coalesce((select c.fichas from public.piso_casino_cuentas c where c.user_id = uid), 0),
    'tienda', public.piso_casino_chisteras_tienda(uid)
  )
  from (select 1) uno
  left join public.piso_casino_chisteras p on p.user_id = uid and p.dia = piso_casino_chisteras_vista.dia;
$$;
revoke all on function public.piso_casino_chisteras_vista(uuid, date) from public, anon, authenticated;

-- Cambiar sellos por `premio` (un id de piso_casino_chisteras_premios). El acabado necesita `mueble`: una copia lisa tuya,
-- guardada y que no sea recién llegada (como en la pared de la Lonja). Devuelve la partida de `dia` con su tienda
create or replace function public.piso_casino_chisteras_canjear(dia date, premio text, mueble text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  def jsonb := public.piso_casino_chisteras_premios() -> premio;
  precio integer;
begin
  if def is null then
    raise exception 'Eso no se cambia por sellos.' using errcode = 'P0001';
  end if;
  precio := (def ->> 'sellos')::integer;
  -- Uno a la vez por cuenta, para que dos canjes no gasten los mismos sellos
  insert into public.piso_casino_cuentas (user_id) values (me) on conflict do nothing;
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  if exists (select 1 from public.piso_casino_chisteras_canjes k where k.user_id = me and k.premio = piso_casino_chisteras_canjear.premio) then
    raise exception 'Eso ya lo tienes.' using errcode = 'P0001';
  end if;
  if public.piso_casino_chisteras_sellos(me) < precio then
    raise exception 'Te faltan sellos: se gana uno con cada partida perfecta.' using errcode = 'P0001';
  end if;
  if def ->> 'tipo' = 'acabado' then
    if mueble is null or public.piso_lonja_rareza(mueble) is null or public.piso_retirado(mueble) then
      raise exception 'Ese mueble no admite acabado.' using errcode = 'P0001';
    end if;
    if public.piso_lonja_libres(me, mueble) < 1 then
      raise exception 'Necesitas una copia lisa guardada de ese mueble, sin colocar ni recién llegada.' using errcode = 'P0001';
    end if;
    perform public.piso_acabado_sumar(me, mueble, 'polvo-estrellas', 1);
  elsif def ->> 'tipo' = 'prenda' then
    insert into public.piso_prendas (user_id, prenda) values (me, premio) on conflict do nothing;
  else
    perform public.piso_sumar(me, premio, 1);
  end if;
  insert into public.piso_casino_chisteras_canjes (user_id, premio, sellos, mueble)
    values (me, premio, precio, case when def ->> 'tipo' = 'acabado' then mueble end);
  return public.piso_casino_chisteras_vista(me, dia);
end;
$$;
revoke all on function public.piso_casino_chisteras_premios() from public, anon, authenticated;
revoke all on function public.piso_casino_chisteras_ropa() from public, anon, authenticated;
revoke all on function public.piso_casino_chisteras_canjear(date, text, text) from public, anon;
grant execute on function public.piso_casino_chisteras_canjear(date, text, text) to authenticated;

-- ── El aspecto válido (el de 20261201120000_casino_ruleta.sql), con el reloj, la chistera de mago y la varita ──
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
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa', 'visera', 'fedora', 'gorro-estibador', 'panuelo', 'pompon', 'bandolera', 'reloj-bolsillo', 'chistera-mago', 'varita')
  )
$$;

-- Solo se lleva lo que se tiene (la de 20261201120000_casino_ruleta.sql), también lo de las chisteras
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
           or public.piso_almacen_ropa() ? k or k = any (public.piso_casino_ruleta_ropa()) or k = any (public.piso_casino_chisteras_ropa()))
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    if falta = any (public.piso_casino_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por fichas en la caja del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_casino_ruleta_ropa()) then
      raise exception 'Aún no tienes esa prenda: puede tocar en la ruleta del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_casino_chisteras_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por sellos de las chisteras del casino.' using errcode = 'P0001';
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

-- ── La vitrina (la de 20261203120000_casino_vitrina.sql), con los premios de las chisteras ──
create or replace function public.piso_casino_vitrina_premios()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select a.key from jsonb_each(public.piso_casino_caja_precios()) a where a.value ->> 'tipo' <> 'sobre'
    union all
    select a.key from jsonb_each(public.piso_casino_lata_precios()) a
    union all
    select c ->> 'id' from jsonb_array_elements(public.piso_casino_ruleta_casillas()) c where c ->> 'tipo' not in ('fichas', 'garbanzos')
    union all
    select a.key from jsonb_each(public.piso_casino_chisteras_premios()) a
  );
$$;
revoke all on function public.piso_casino_vitrina_premios() from public, anon, authenticated;

create or replace function public.piso_casino_vitrina_de_cuenta(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with manos as (
    select
      count(*) filter (where m.estado in ('ganada', 'veintiuna')) as ganadas,
      count(*) filter (where m.estado = 'veintiuna') as veintiunas,
      count(*) filter (where m.estado in ('veintiuna', 'ganada', 'empate', 'perdida')) as jugadas
    from public.piso_casino_manos m where m.user_id = uid
  ), giros as (
    select
      count(*) as giros,
      count(*) filter (where r.premio not like 'fichas:%' and r.premio not like 'garbanzos:%' and not r.repetido) as premios,
      count(*) filter (where r.casilla = 8) as doradas
    from public.piso_casino_ruleta r where r.user_id = uid
  ), chis as (
    select
      count(*) filter (where c.estado = 'hecha') as partidas,
      count(*) filter (where c.estado = 'hecha' and c.aciertos = 3) as perfectas
    from public.piso_casino_chisteras c where c.user_id = uid
  )
  select jsonb_build_object(
    'tienes', to_jsonb(array(
      select p from unnest(public.piso_casino_vitrina_premios()) p
      -- El acabado, si se cambió por sellos; la ropa, en el armario; lo demás, en el inventario
      where (p like 'acabado:%' and exists (select 1 from public.piso_casino_chisteras_canjes k where k.user_id = uid and k.premio = p))
         or (p like '%:%' and p not like 'acabado:%' and exists (select 1 from public.piso_prendas x where x.user_id = uid and x.prenda = p))
         or (p not like '%:%' and exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = p and v.copias > 0))
    )),
    'fichas', coalesce((select c.fichas from public.piso_casino_cuentas c where c.user_id = uid), 0),
    'garbanzos', coalesce((select c.garbanzos from public.piso_casino_cuentas c where c.user_id = uid), 0),
    'hitos', to_jsonb(array(
      select h from unnest(array[
        case when manos.ganadas >= 1 then '21-primera' end,
        case when manos.veintiunas >= 1 then '21-veintiuna' end,
        case when manos.ganadas >= 10 then '21-diez' end,
        case when manos.jugadas >= 50 then '21-cincuenta' end,
        case when giros.giros >= 1 then 'ruleta-primera' end,
        case when giros.giros >= 4 then 'ruleta-cuatro' end,
        case when giros.premios >= 1 then 'ruleta-premio' end,
        case when giros.doradas >= 1 then 'ruleta-dorada' end,
        case when chis.partidas >= 1 then 'chisteras-primera' end,
        case when chis.perfectas >= 1 then 'chisteras-perfecta' end,
        case when chis.perfectas >= 5 then 'chisteras-cinco' end,
        case when chis.partidas >= 10 then 'chisteras-diez' end
      ]) h where h is not null
    ))
  )
  from manos, giros, chis;
$$;
revoke all on function public.piso_casino_vitrina_de_cuenta(uuid) from public, anon, authenticated;
