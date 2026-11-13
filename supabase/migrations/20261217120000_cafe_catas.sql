-- 1.129 (§129) · El café-librería del bajo, bloque 6c: nivel 8 «La sala de catas» (cifras aprobadas por Francisco el
-- 13-11-2026; plan en docs/qa/cafe-libreria.md §14). Requiere las migraciones del café hasta 20261216120000_cafe_tostadero.sql
-- (todas ya aplicadas: esta no edita ninguna, solo redefine funciones y añade muebles al catálogo).
-- - Nivel 8 desde 21.000 de reputación. Su barra mide 8.000: sus hitos caen en 23.000, 25.000 y 27.000 («hitos hasta 27.000»).
--   Los niveles 1 a 7 y sus hitos no cambian.
-- - 100 tickets al subir; los del día siguen con su tope de 5. 60 huecos en la balda. El 3.er hito da 25 granos.
-- - El sótano crece: su cuadrícula pasa a 9 × 6 (columnas −2 a 6, filas 20 a 25). Siguen cabiendo 40 cosas.
-- - Hasta 10 clientes al día, tantos como asientos colocados (los del sótano cuentan), nunca menos de 5.
-- - Tres muebles nuevos: la butaca de cuero (un asiento), la mesa de catas y el mapa de cafés (del 1.er hito).
-- - En el 2.º hito, dos de la carta a la vez: el chai con especias (una bebida; sus granos, suave o intenso, nunca el tueste
--   de la casa) y el café brûlée (un toque). Van al final de cada lista, para que las recetas de antes no cambien.
-- Las cifras, las mismas que en src/features/edificio/cafe/ (cafeCatalogo.js, cafeClientes.js, cafeNiveles.js; las pruebas lo
-- comprueban). Todo por funciones `security definer`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Los muebles de la sala de catas ──
insert into public.cafe_catalogo (id, w, d, precio, nivel, hito) values
  ('cafe-butaca', 1, 1, 300, 8, 0),
  ('cafe-mesa-catas', 2, 1, 360, 8, 0),
  ('cafe-mapa', 1, 1, 400, 8, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel, hito = excluded.hito;

-- ── Las cifras ──
create or replace function public.cafe_nivel_desde(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 0 when 2 then 300 when 3 then 1000 when 4 then 2500 when 5 then 5000 when 6 then 10000 when 7 then 15000
                    when 8 then 21000 end;
$$;
revoke all on function public.cafe_nivel_desde(integer) from public, anon, authenticated;

create or replace function public.cafe_nivel_de(reputacion integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when reputacion >= 21000 then 8 when reputacion >= 15000 then 7 when reputacion >= 10000 then 6 when reputacion >= 5000 then 5
              when reputacion >= 2500 then 4 when reputacion >= 1000 then 3 when reputacion >= 300 then 2 else 1 end;
$$;
revoke all on function public.cafe_nivel_de(integer) from public, anon, authenticated;

create or replace function public.cafe_tickets_nivel(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 10 when 2 then 20 when 3 then 40 when 4 then 60 when 5 then 100 when 6 then 80 when 7 then 90
                    when 8 then 100 else 0 end;
$$;
revoke all on function public.cafe_tickets_nivel(integer) from public, anon, authenticated;

create or replace function public.cafe_huecos(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case least(8, greatest(1, nivel)) when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 36 when 5 then 42 when 6 then 48
                                           when 7 then 54 else 60 end;
$$;
revoke all on function public.cafe_huecos(integer) from public, anon, authenticated;

-- Dónde cae un hito: a un cuarto, a la mitad y a tres cuartos de la barra del nivel. La del 7, 6.000; la del 8, 8.000
create or replace function public.cafe_hito_umbral(nivel integer, hito integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public.cafe_nivel_desde(nivel)
    + ((case when nivel >= 9 then 5000 when nivel = 8 then 8000 when nivel = 7 then 6000
             else public.cafe_nivel_desde(nivel + 1) - public.cafe_nivel_desde(nivel) end) * hito) / 4;
$$;
revoke all on function public.cafe_hito_umbral(integer, integer) from public, anon, authenticated;

-- Los granos del 3.er hito: 15 hasta el nivel 5; 20 en el 6 y el 7; 25 en el 8
create or replace function public.cafe_granos_hito(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel >= 8 then 25 when nivel >= 6 then 20 else 15 end;
$$;
revoke all on function public.cafe_granos_hito(integer) from public, anon, authenticated;

-- ── La carta: el chai y el brûlée (2.º hito del nivel 8), al final ──
create or replace function public.cafe_carta(reputacion integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    case when reputacion >= public.cafe_hito_umbral(2, 2) then 'chocolate' end,
    case when reputacion >= public.cafe_hito_umbral(3, 2) then 'nata' end,
    case when reputacion >= public.cafe_hito_umbral(4, 2) then 'vainilla' end,
    case when reputacion >= public.cafe_hito_umbral(5, 2) then 'hielo' end,
    case when reputacion >= public.cafe_hito_umbral(7, 2) then 'casa' end,
    case when reputacion >= public.cafe_hito_umbral(8, 2) then 'chai' end,
    case when reputacion >= public.cafe_hito_umbral(8, 2) then 'brulee' end], null);
$$;
revoke all on function public.cafe_carta(integer) from public, anon, authenticated;

create or replace function public.cafe_bebidas_carta(carta text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cafe', 'te']
    || case when 'chocolate' = any (coalesce(carta, '{}')) then array['chocolate'] else '{}'::text[] end
    || case when 'hielo' = any (coalesce(carta, '{}')) then array['frio'] else '{}'::text[] end
    || case when 'chai' = any (coalesce(carta, '{}')) then array['chai'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_bebidas_carta(text[]) from public, anon, authenticated;

create or replace function public.cafe_toques_carta(carta text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['nada', 'canela', 'miel']
    || case when 'nata' = any (coalesce(carta, '{}')) then array['nata'] else '{}'::text[] end
    || case when 'vainilla' = any (coalesce(carta, '{}')) then array['vainilla'] else '{}'::text[] end
    || case when 'brulee' = any (coalesce(carta, '{}')) then array['brulee'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_toques_carta(text[]) from public, anon, authenticated;

-- ── Los asientos y los clientes del día ──
-- La misma tabla que ASIENTOS en cafeCatalogo.js (con la butaca de cuero, uno)
create or replace function public.cafe_asientos(plano jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(case e ->> 'id'
      when 'cafe-silla' then 1 when 'cafe-taburete' then 1 when 'cafe-banco' then 2 when 'cafe-orejero' then 1
      when 'cafe-silla-terraza' then 1 when 'cafe-banco-bodega' then 2 when 'cafe-saco' then 1 when 'cafe-butaca' then 1
      when 'silla' then 1 when 'banco' then 2
      when 'sofa' then 2 when 'puf' then 1 when 'mecedora' then 1 when 'taburete-barra' then 1 when 'sillon-capa' then 1
      else 0 end), 0)::integer
  from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e;
$$;
revoke all on function public.cafe_asientos(jsonb) from public, anon, authenticated;

-- Niveles 1 a 3, 3 / 4 / 5; del 4 en adelante, los asientos, entre 5 y 6, 7, 8, 9 o 10
create or replace function public.cafe_clientes_dia(nivel integer, asientos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel <= 3 then public.cafe_clientes_nivel(nivel)
              else least(case when nivel >= 8 then 10 when nivel = 7 then 9 when nivel = 6 then 8 when nivel = 5 then 7 else 6 end,
                         greatest(5, coalesce(asientos, 0))) end;
$$;
revoke all on function public.cafe_clientes_dia(integer, integer) from public, anon, authenticated;

-- ── El plano: el sótano crece hacia la derecha (columnas 5 y 6) y hacia delante (fila 25) en el nivel 8 ──
-- Lo mismo que `casillaValida` en cafeCatalogo.js (cafe_plano_valido cuenta columnas de la −3 a la 9 y filas hasta la 29)
create or replace function public.cafe_casilla_valida(x integer, y integer, nivel integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (x >= case when coalesce(nivel, 1) >= 4 then -3 else 0 end and x < 6
          and y >= case when coalesce(nivel, 1) >= 2 then -3 else 0 end and y < 6)
      or (coalesce(nivel, 1) >= 5 and x >= 0 and x < 6 and y >= 7 and y < 10)
      or (coalesce(nivel, 1) >= 6 and x >= case when coalesce(nivel, 1) >= 7 then -2 else 0 end
          and x < case when coalesce(nivel, 1) >= 8 then 7 else 5 end
          and y >= 20 and y < case when coalesce(nivel, 1) >= 8 then 26 else 25 end);
$$;
revoke all on function public.cafe_casilla_valida(integer, integer, integer) from public, anon, authenticated;
