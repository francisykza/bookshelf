-- 1.123 (§123) · El café-librería del bajo, bloque 4b: el ala lateral (nivel 4) y la terraza con el escaparate (nivel 5)
-- (cifras aprobadas por Francisco el 12-11-2026, «Sí, esas cifras»; plan en docs/qa/cafe-libreria.md §13). Requiere
-- 20261210120000_cafe_local.sql, 20261211120000_cafe_clientes.sql y 20261212120000_cafe_niveles.sql.
-- - Nivel 4: se abre la pared de la izquierda; la cuadrícula del local gana 3 columnas (−3 a −1) y pasa a 9 × 9.
-- - Nivel 5: la terraza de la acera, tres filas (7 a 9) delante del escaparate, columnas 0 a 5.
-- - Caben 24 cosas hasta el nivel 3 y 32 desde el 4.
-- - Clientes al día en los niveles 4 y 5: tantos como asientos colocados al abrir el día, 6 y 7 como mucho y nunca menos
--   de 5. Lo que se gana al día crece solo con ellos (no hay otro tope de reputación).
-- - Lo nuevo de la carta: la vainilla (2.º hito del nivel 4) y el café con hielo (2.º hito del nivel 5).
-- - Ocho muebles nuevos (el piano y el farol, de los primeros hitos).
-- - El escaparate: hasta tres de tus leídos, desde el nivel 5; se ve desde la calle (`cafe_fachada`).
-- Las cifras, las mismas que en src/features/edificio/cafe/ (cafeCatalogo.js, cafeClientes.js, cafeNiveles.js; las pruebas lo
-- comprueban). Todo por funciones `security definer` y `volatile`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Los muebles nuevos ──
insert into public.cafe_catalogo (id, w, d, precio, nivel, hito) values
  ('cafe-mesa-larga', 2, 1, 150, 4, 0),
  ('cafe-biombo', 2, 1, 180, 4, 0),
  ('cafe-bankers', 1, 1, 120, 4, 0),
  ('cafe-piano', 2, 1, 200, 4, 1),
  ('cafe-mesa-hierro', 1, 1, 150, 5, 0),
  ('cafe-silla-terraza', 1, 1, 150, 5, 0),
  ('cafe-macetero', 2, 1, 180, 5, 0),
  ('cafe-farol', 1, 1, 250, 5, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel, hito = excluded.hito;

-- ── La carta: la vainilla y el café con hielo (siempre al final de su parte, para que las recetas de antes no cambien) ──
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
    case when reputacion >= public.cafe_hito_umbral(5, 2) then 'hielo' end], null);
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
    || case when 'hielo' = any (coalesce(carta, '{}')) then array['frio'] else '{}'::text[] end;
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
    || case when 'vainilla' = any (coalesce(carta, '{}')) then array['vainilla'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_toques_carta(text[]) from public, anon, authenticated;

-- ── Los asientos y los clientes del día ──
-- La misma tabla que ASIENTOS en cafeCatalogo.js
create or replace function public.cafe_asientos(plano jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(case e ->> 'id'
      when 'cafe-silla' then 1 when 'cafe-taburete' then 1 when 'cafe-banco' then 2 when 'cafe-orejero' then 1
      when 'cafe-silla-terraza' then 1 when 'silla' then 1 when 'banco' then 2 when 'sofa' then 2 when 'puf' then 1
      when 'mecedora' then 1 when 'taburete-barra' then 1 when 'sillon-capa' then 1 else 0 end), 0)::integer
  from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e;
$$;
revoke all on function public.cafe_asientos(jsonb) from public, anon, authenticated;

-- Niveles 1 a 3, 3 / 4 / 5; en el 4 y el 5, los asientos, entre 5 y 6 o 7
create or replace function public.cafe_clientes_dia(nivel integer, asientos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel <= 3 then public.cafe_clientes_nivel(nivel)
              else least(case when nivel >= 5 then 7 else 6 end, greatest(5, coalesce(asientos, 0))) end;
$$;
revoke all on function public.cafe_clientes_dia(integer, integer) from public, anon, authenticated;

alter table public.cafe_dias drop constraint if exists cafe_dias_clientes_check;
alter table public.cafe_dias add constraint cafe_dias_clientes_check check (clientes between 0 and 7);
alter table public.cafe_servicios drop constraint if exists cafe_servicios_cliente_check;
alter table public.cafe_servicios add constraint cafe_servicios_cliente_check check (cliente between 1 and 7 or cliente between 101 and 102);

-- Abre el día: cuántos clientes vienen (según el nivel y, desde el 4, los asientos) y la carta de ese día, la primera vez
create or replace function public.cafe_abrir_dia(uid uuid, dia date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  select * into l from public.cafe_locales where user_id = uid;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  insert into public.cafe_dias (user_id, dia, clientes, carta)
  values (uid, dia, public.cafe_clientes_dia(l.nivel, public.cafe_asientos(l.plano)), public.cafe_carta(l.reputacion))
  on conflict on constraint cafe_dias_pkey do nothing;
end;
$$;
revoke all on function public.cafe_abrir_dia(uuid, date) from public, anon, authenticated;

-- ── El plano: el ala lateral y la terraza ──
-- Lo mismo que `casillaValida` en cafeCatalogo.js
create or replace function public.cafe_casilla_valida(x integer, y integer, nivel integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (x >= case when coalesce(nivel, 1) >= 4 then -3 else 0 end and x < 6
          and y >= case when coalesce(nivel, 1) >= 2 then -3 else 0 end and y < 6)
      or (coalesce(nivel, 1) >= 5 and x >= 0 and x < 6 and y >= 7 and y < 10);
$$;
revoke all on function public.cafe_casilla_valida(integer, integer, integer) from public, anon, authenticated;

create or replace function public.cafe_plano_valido(plano jsonb, nivel integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e jsonb;
  w integer;
  d integer;
  x integer;
  y integer;
  r integer;
  -- Columnas −3 a 5 (9) por filas −3 a 9 (13)
  celdas boolean[] := array_fill(false, array[117]);
  uids text[] := '{}';
  i integer;
  j integer;
  tope integer;
begin
  if plano is null or jsonb_typeof(plano) <> 'object' or jsonb_typeof(plano -> 'items') <> 'array' then
    return false;
  end if;
  tope := 24;
  if coalesce(nivel, 1) >= 4 then
    tope := 32;
  end if;
  if jsonb_array_length(plano -> 'items') > tope then
    return false;
  end if;
  for e in select * from jsonb_array_elements(plano -> 'items') loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'uid') <> 'string' or char_length(e ->> 'uid') not between 1 and 40
       or jsonb_typeof(e -> 'id') <> 'string' or jsonb_typeof(e -> 'x') <> 'number' or jsonb_typeof(e -> 'y') <> 'number'
       or jsonb_typeof(e -> 'rot') <> 'number' then
      return false;
    end if;
    if (e ->> 'uid') = any (uids) then
      return false;
    end if;
    uids := uids || (e ->> 'uid');
    if (e ->> 'x') !~ '^-?[0-9]$' or (e ->> 'y') !~ '^-?[0-9]$' or (e ->> 'rot') !~ '^[0-3]$' then
      return false;
    end if;
    select c.w, c.d into w, d from public.cafe_catalogo c where c.id = e ->> 'id';
    if w is null then
      if not public.cafe_de_casa(e ->> 'id') then
        return false;
      end if;
      select k.w, k.d into w, d from public.piso_catalogo k where k.id = e ->> 'id';
    end if;
    x := (e ->> 'x')::integer;
    y := (e ->> 'y')::integer;
    r := (e ->> 'rot')::integer;
    if r % 2 = 1 then
      select d, w into w, d;
    end if;
    for i in x .. x + w - 1 loop
      for j in y .. y + d - 1 loop
        if not public.cafe_casilla_valida(i, j, nivel) then
          return false;
        end if;
        if celdas[(j + 3) * 9 + (i + 3) + 1] then
          return false;
        end if;
        celdas[(j + 3) * 9 + (i + 3) + 1] := true;
      end loop;
    end loop;
    w := null;
    d := null;
  end loop;
  return true;
end;
$$;
revoke all on function public.cafe_plano_valido(jsonb, integer) from public, anon, authenticated;

-- ── El escaparate: hasta tres de tus leídos, desde el nivel 5 ──
alter table public.cafe_locales add column if not exists escaparate jsonb not null default '[]'::jsonb;

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
    'inventario', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.cafe_inventario v where v.user_id = uid and v.copias > 0), '{}'::jsonb))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_json(uuid) from public, anon, authenticated;

-- Poner el escaparate: los títulos los manda la app (los que has leído), comprobados; como mucho tres, sin repetir
create or replace function public.cafe_poner_escaparate(titulos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  v jsonb;
begin
  select * into l from public.cafe_locales where user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if l.nivel < 5 then
    raise exception 'cafe:nivel' using errcode = 'P0001';
  end if;
  if titulos is null or jsonb_typeof(titulos) <> 'array' or jsonb_array_length(titulos) > 3 then
    raise exception 'cafe:titulos' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('clave', t.clave, 'titulo', t.titulo, 'genero', t.genero)), '[]'::jsonb) into v
    from public.cafe_titulos(titulos) t;
  update public.cafe_locales set escaparate = v, actualizado = now() where user_id = me;
  return public.cafe_json(me);
end;
$$;
revoke all on function public.cafe_poner_escaparate(jsonb) from public, anon;
grant execute on function public.cafe_poner_escaparate(jsonb) to authenticated;

-- Lo que se ve de tu café desde la calle: el nombre, el nivel y el escaparate (sin crear el café si aún no existe)
create or replace function public.cafe_fachada()
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object('inaugurado', l.inaugurado is not null, 'nombre', l.nombre, 'nivel', l.nivel,
           'escaparate', case when l.nivel >= 5 then l.escaparate else '[]'::jsonb end)
  from public.cafe_locales l where l.user_id = auth.uid();
$$;
revoke all on function public.cafe_fachada() from public, anon;
grant execute on function public.cafe_fachada() to authenticated;
