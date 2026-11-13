-- 1.127 (§127) · El café-librería del bajo, bloque 6b: nivel 7 «El tostadero» (cifras aprobadas por Francisco el 13-11-2026,
-- «Sí, esas cifras»; plan en docs/qa/cafe-libreria.md §14). Requiere las migraciones del café hasta
-- 20261215120000_cafe_probador.sql (todas ya aplicadas: esta no edita ninguna, solo redefine funciones y añade columnas).
-- - Nivel 7 desde 15.000 de reputación. Su barra llega hasta los 21.000 aprobados del nivel 8 (6.000), así sus hitos (16.500,
--   18.000 y 19.500) no se moverán cuando se abra la sala de catas. Los niveles 1 a 6 y sus hitos no cambian.
-- - 90 tickets al subir; los del día siguen con su tope de 5. 54 huecos en la balda. El 3.er hito da 20 granos.
-- - El sótano crece: su cuadrícula pasa a 7 × 5 (columnas −2 a 4, filas 20 a 24). Siguen cabiendo 40 cosas.
-- - Hasta 9 clientes al día, tantos como asientos colocados (los del sótano cuentan), nunca menos de 5.
-- - Dos muebles nuevos: el saco de arpillera (un asiento) y la estantería de latas (del 1.er hito).
-- - El tostadero: con el tueste de la casa en la carta (2.º hito del nivel 7), un saco al día que se recoge cuando quieras
--   (`cafe_recoger_saco`; sin plazo, y si no lo recoges no se junta más de uno). Cada saco, 5 tazas de «tueste de la casa»; las
--   que te quedan no caducan (como mucho 99: si no caben, el saco espera). El tueste es un grano más del café (y del café con
--   hielo) y algunos clientes lo piden; servírselo gasta una taza y paga +3 granos y +4 de reputación además de lo de siempre.
--   Sin tazas no se puede elegir; servir otro grano solo pierde ese punto, como cualquier fallo.
-- Las cifras, las mismas que en src/features/edificio/cafe/ (cafeCatalogo.js, cafeClientes.js, cafeNiveles.js; las pruebas lo
-- comprueban). Todo por funciones `security definer`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Los muebles del tostadero ──
insert into public.cafe_catalogo (id, w, d, precio, nivel, hito) values
  ('cafe-saco', 1, 1, 250, 7, 0),
  ('cafe-latas', 2, 1, 350, 7, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel, hito = excluded.hito;

-- ── Las tazas de tueste que te quedan y el día del último saco recogido ──
alter table public.cafe_locales add column if not exists tazas smallint not null default 0;
alter table public.cafe_locales drop constraint if exists cafe_locales_tazas_check;
alter table public.cafe_locales add constraint cafe_locales_tazas_check check (tazas between 0 and 99);
alter table public.cafe_locales add column if not exists saco_dia date;

-- ── Las cifras ──
create or replace function public.cafe_nivel_desde(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 0 when 2 then 300 when 3 then 1000 when 4 then 2500 when 5 then 5000 when 6 then 10000 when 7 then 15000 end;
$$;
revoke all on function public.cafe_nivel_desde(integer) from public, anon, authenticated;

create or replace function public.cafe_nivel_de(reputacion integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when reputacion >= 15000 then 7 when reputacion >= 10000 then 6 when reputacion >= 5000 then 5 when reputacion >= 2500 then 4
              when reputacion >= 1000 then 3 when reputacion >= 300 then 2 else 1 end;
$$;
revoke all on function public.cafe_nivel_de(integer) from public, anon, authenticated;

create or replace function public.cafe_tickets_nivel(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 10 when 2 then 20 when 3 then 40 when 4 then 60 when 5 then 100 when 6 then 80 when 7 then 90 else 0 end;
$$;
revoke all on function public.cafe_tickets_nivel(integer) from public, anon, authenticated;

create or replace function public.cafe_huecos(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case least(7, greatest(1, nivel)) when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 36 when 5 then 42 when 6 then 48 else 54 end;
$$;
revoke all on function public.cafe_huecos(integer) from public, anon, authenticated;

-- Dónde cae un hito: a un cuarto, a la mitad y a tres cuartos de la barra del nivel. La del 7, hasta los 21.000 del 8 (6.000)
create or replace function public.cafe_hito_umbral(nivel integer, hito integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public.cafe_nivel_desde(nivel)
    + ((case when nivel >= 8 then 5000 when nivel = 7 then 6000 else public.cafe_nivel_desde(nivel + 1) - public.cafe_nivel_desde(nivel) end) * hito) / 4;
$$;
revoke all on function public.cafe_hito_umbral(integer, integer) from public, anon, authenticated;

-- ── La carta: el tueste de la casa (2.º hito del nivel 7), al final, para que las recetas de antes no cambien ──
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
    case when reputacion >= public.cafe_hito_umbral(7, 2) then 'casa' end], null);
$$;
revoke all on function public.cafe_carta(integer) from public, anon, authenticated;

-- Los granos de la carta: con el tueste, tres; sin él, la cuenta de siempre
create or replace function public.cafe_granos_carta(carta text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['suave', 'intenso'] || case when 'casa' = any (coalesce(carta, '{}')) then array['casa'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_granos_carta(text[]) from public, anon, authenticated;

-- La receta de un número con la carta del día: cada parte con su base. Lo mismo que `recetaDe` en cafeClientes.js: el tueste
-- de la casa solo se pide con café (o café con hielo); con té o chocolate, sale intenso
create or replace function public.cafe_receta_carta(r integer, carta text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  b text[] := public.cafe_bebidas_carta(carta);
  g text[] := public.cafe_granos_carta(carta);
  l text[] := array['sin', 'entera', 'avena'];
  t text[] := public.cafe_toques_carta(carta);
  nb integer := cardinality(b);
  ng integer := cardinality(g);
  out text[];
begin
  out := array[
    b[1 + r % nb],
    g[1 + (r / nb) % ng],
    l[1 + (r / (nb * ng)) % 3],
    t[1 + (r / (nb * ng * 3)) % cardinality(t)]];
  if out[2] = 'casa' and not (out[1] = any (array['cafe', 'frio'])) then
    out[2] := 'intenso';
  end if;
  return out;
end;
$$;
revoke all on function public.cafe_receta_carta(integer, text[]) from public, anon, authenticated;

-- ── Los asientos y los clientes del día ──
-- La misma tabla que ASIENTOS en cafeCatalogo.js (con el saco de arpillera, uno)
create or replace function public.cafe_asientos(plano jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(case e ->> 'id'
      when 'cafe-silla' then 1 when 'cafe-taburete' then 1 when 'cafe-banco' then 2 when 'cafe-orejero' then 1
      when 'cafe-silla-terraza' then 1 when 'cafe-banco-bodega' then 2 when 'cafe-saco' then 1 when 'silla' then 1 when 'banco' then 2
      when 'sofa' then 2 when 'puf' then 1 when 'mecedora' then 1 when 'taburete-barra' then 1 when 'sillon-capa' then 1
      else 0 end), 0)::integer
  from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e;
$$;
revoke all on function public.cafe_asientos(jsonb) from public, anon, authenticated;

-- Niveles 1 a 3, 3 / 4 / 5; del 4 en adelante, los asientos, entre 5 y 6, 7, 8 o 9
create or replace function public.cafe_clientes_dia(nivel integer, asientos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel <= 3 then public.cafe_clientes_nivel(nivel)
              else least(case when nivel >= 7 then 9 when nivel = 6 then 8 when nivel = 5 then 7 else 6 end, greatest(5, coalesce(asientos, 0))) end;
$$;
revoke all on function public.cafe_clientes_dia(integer, integer) from public, anon, authenticated;

-- ── El plano: el sótano crece por la izquierda en el nivel 7 ──
-- Lo mismo que `casillaValida` en cafeCatalogo.js (cafe_plano_valido ya cuenta columnas desde la −3)
create or replace function public.cafe_casilla_valida(x integer, y integer, nivel integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (x >= case when coalesce(nivel, 1) >= 4 then -3 else 0 end and x < 6
          and y >= case when coalesce(nivel, 1) >= 2 then -3 else 0 end and y < 6)
      or (coalesce(nivel, 1) >= 5 and x >= 0 and x < 6 and y >= 7 and y < 10)
      or (coalesce(nivel, 1) >= 6 and x >= case when coalesce(nivel, 1) >= 7 then -2 else 0 end and x < 5 and y >= 20 and y < 25);
$$;
revoke all on function public.cafe_casilla_valida(integer, integer, integer) from public, anon, authenticated;

-- ── Tu café, con lo del tostadero ──
create or replace function public.cafe_json(uid uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nombre', l.nombre, 'nivel', l.nivel, 'reputacion', l.reputacion, 'granos', l.granos, 'plano', l.plano,
    'inaugurado', l.inaugurado is not null, 'escaparate', l.escaparate,
    'tostadero', jsonb_build_object('tazas', l.tazas, 'saco_dia', l.saco_dia),
    'inventario', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.cafe_inventario v where v.user_id = uid and v.copias > 0), '{}'::jsonb))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_json(uuid) from public, anon, authenticated;

-- ── Recoger el saco del día: tirar de la trampilla del tambor ──
-- `dia`, el de la app (hoy o ayer; o la jornada de quien prueba). Uno por día: no se recoge otro para ese día ni para uno
-- anterior al del último saco. Los sacos de las jornadas de prueba (desde el año 3000) no tapan los días de verdad.
create or replace function public.cafe_recoger_saco(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if not ('casa' = any (public.cafe_carta(l.reputacion))) then
    raise exception 'cafe:tueste' using errcode = 'P0001';
  end if;
  if l.saco_dia is not null and l.saco_dia >= dia and not (l.saco_dia >= date '3000-01-01' and dia < date '3000-01-01') then
    raise exception 'cafe:saco' using errcode = 'P0001';
  end if;
  if l.tazas + 5 > 99 then
    raise exception 'cafe:tazas' using errcode = 'P0001';
  end if;
  update public.cafe_locales x set tazas = x.tazas + 5, saco_dia = cafe_recoger_saco.dia, actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'tazas', 5);
end;
$$;
revoke all on function public.cafe_recoger_saco(date) from public, anon;
grant execute on function public.cafe_recoger_saco(date) to authenticated;

-- ── Servir: como en el bloque 4a, con el tueste de la casa (gasta una taza; si lo pidió, +3 granos y +4 de reputación) ──
create or replace function public.cafe_servir(dia date, cliente integer, receta text[], encaja boolean, libro text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  d public.cafe_dias;
  pide text[];
  carta text[];
  habitual boolean := cliente between 101 and 102;
  excentrico boolean;
  aciertos integer := 0;
  estrellas integer;
  premio integer[];
  frase integer := null;
  quien integer := null;
  dorada boolean := false;
  lleva boolean := false;
  extra integer := 0;
  tueste boolean := false;
  bono_g integer := 0;
  bono_r integer := 0;
  progreso jsonb;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_servir.dia for update;
  if cliente is null or not ((cliente between 1 and d.clientes) or (cliente between 101 and 100 + d.habituales)) then
    raise exception 'cafe:cliente' using errcode = 'P0001';
  end if;
  carta := public.cafe_carta(l.reputacion);
  if receta is null or cardinality(receta) <> 4
     or not (receta[1] = any (public.cafe_bebidas_carta(carta)))
     or not (receta[2] = any (public.cafe_granos_carta(carta)))
     or (receta[2] = 'casa' and not (receta[1] = any (array['cafe', 'frio'])))
     or not (receta[3] = any (array['sin', 'entera', 'avena']))
     or not (receta[4] = any (public.cafe_toques_carta(carta))) then
    raise exception 'cafe:receta' using errcode = 'P0001';
  end if;
  -- El tueste de la casa sale del saco: sin tazas, no hay
  if receta[2] = 'casa' and l.tazas < 1 then
    raise exception 'cafe:tueste' using errcode = 'P0001';
  end if;
  excentrico := not habitual and cliente = d.clientes;
  pide := public.cafe_pide(me, d.dia, cliente);
  for k in 1..4 loop
    if receta[k] = pide[k] then
      aciertos := aciertos + 1;
    end if;
  end loop;
  -- El libro solo cuenta si es uno de tu balda
  lleva := coalesce(encaja, false) and libro is not null
    and exists (select 1 from public.cafe_libros b where b.user_id = me and b.clave = libro and b.balda > 0);
  if lleva then
    extra := 2;
  end if;
  tueste := receta[2] = 'casa' and pide[2] = 'casa';
  if tueste then
    bono_g := 3;
    bono_r := 4;
  end if;
  estrellas := public.cafe_estrellas(aciertos, lleva);
  premio := public.cafe_premio(case when habitual then 'habitual' when excentrico then 'excentrico' else 'cliente' end, estrellas);
  insert into public.cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion)
  values (me, d.dia, cliente, receta, aciertos, lleva, estrellas, premio[1] + extra + bono_g, premio[2] + bono_r)
  on conflict on constraint cafe_servicios_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_locales x
     set granos = least(100000, x.granos + premio[1] + extra + bono_g), reputacion = least(1000000, x.reputacion + premio[2] + bono_r),
         tazas = x.tazas - case when receta[2] = 'casa' then 1 else 0 end, actualizado = now()
   where x.user_id = me;
  if lleva then
    update public.cafe_libros b set balda = b.balda - 1 where b.user_id = me and b.clave = libro and b.balda > 0;
  end if;
  if habitual then
    quien := public.cafe_quien(me, d.dia, cliente - 100);
    frase := public.cafe_semilla(me, d.dia, 'r' || (cliente - 100)) % 12;
    insert into public.cafe_resenas (user_id, dia, excentrico, quien, frase)
    values (me, d.dia, false, quien, frase)
    on conflict on constraint cafe_resenas_pkey do nothing;
  elsif excentrico and estrellas = 3 then
    quien := public.cafe_semilla(me, d.dia, 'c' || cliente) % 6;
    frase := quien;
    dorada := true;
    insert into public.cafe_resenas (user_id, dia, excentrico, quien, frase)
    values (me, d.dia, true, quien, frase)
    on conflict on constraint cafe_resenas_pkey do nothing;
  end if;
  progreso := public.cafe_progreso(me, d.dia);
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, d.dia), 'libros', public.cafe_libros_json(me),
    'dado', jsonb_build_object('granos', premio[1] + extra + bono_g, 'reputacion', premio[2] + bono_r, 'llevado', lleva, 'extra', extra, 'estrellas', estrellas,
      'aciertos', aciertos, 'pide', to_jsonb(pide), 'frase', frase, 'dorada', dorada, 'tueste', tueste, 'bono_granos', bono_g, 'bono_reputacion', bono_r),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_servir(date, integer, text[], boolean, text) from public, anon;
grant execute on function public.cafe_servir(date, integer, text[], boolean, text) to authenticated;
