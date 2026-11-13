-- 1.125 (§125) · El café-librería del bajo, bloque 6a: el sótano, nivel 6 «La bodega» (cifras aprobadas por Francisco el
-- 13-11-2026, «Sí, esas cifras»; plan en docs/qa/cafe-libreria.md §14). Requiere 20261210120000_cafe_local.sql,
-- 20261211120000_cafe_clientes.sql, 20261212120000_cafe_niveles.sql y 20261213120000_cafe_ampliacion.sql.
-- - Nivel 6 desde 10.000 de reputación; de momento es el último (el 7 y el 8 llegan en los bloques 6b y 6c). Su barra, como
--   la del 5, sigue 5.000 más para sus hitos (11.250, 12.500 y 13.750). Los niveles 1 a 5 y sus hitos no cambian.
-- - 80 tickets al subir; los del día siguen con su tope de 5. 48 huecos en la balda. El 3.er hito da 20 granos (15 hasta el 5).
-- - La bodega: una cuadrícula de 5 × 5 en el mismo plano, columnas 0 a 4 y filas 20 a 24. Caben 40 cosas desde el nivel 6.
-- - Hasta 8 clientes al día, tantos como asientos colocados (los de la bodega cuentan), nunca menos de 5.
-- - Tres muebles nuevos (el candil, del primer hito); el banco de bodega cuenta dos asientos.
-- Las cifras, las mismas que en src/features/edificio/cafe/ (cafeCatalogo.js, cafeClientes.js, cafeNiveles.js; las pruebas lo
-- comprueban). Todo por funciones `security definer` y `volatile`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Los límites de las tablas: niveles hasta el 8 y hasta 10 clientes al día (lo que se abrirá en los bloques 6b y 6c) ──
alter table public.cafe_catalogo drop constraint if exists cafe_catalogo_nivel_check;
alter table public.cafe_catalogo add constraint cafe_catalogo_nivel_check check (nivel between 1 and 8);
alter table public.cafe_locales drop constraint if exists cafe_locales_nivel_check;
alter table public.cafe_locales add constraint cafe_locales_nivel_check check (nivel between 1 and 8);
alter table public.cafe_niveles_cobrados drop constraint if exists cafe_niveles_cobrados_nivel_check;
alter table public.cafe_niveles_cobrados add constraint cafe_niveles_cobrados_nivel_check check (nivel between 1 and 8);
alter table public.cafe_hitos drop constraint if exists cafe_hitos_nivel_check;
alter table public.cafe_hitos add constraint cafe_hitos_nivel_check check (nivel between 1 and 8);
alter table public.cafe_dias drop constraint if exists cafe_dias_clientes_check;
alter table public.cafe_dias add constraint cafe_dias_clientes_check check (clientes between 0 and 10);
alter table public.cafe_servicios drop constraint if exists cafe_servicios_cliente_check;
alter table public.cafe_servicios add constraint cafe_servicios_cliente_check check (cliente between 1 and 10 or cliente between 101 and 102);

-- ── Los muebles de la bodega ──
insert into public.cafe_catalogo (id, w, d, precio, nivel, hito) values
  ('cafe-barrica', 1, 1, 220, 6, 0),
  ('cafe-banco-bodega', 2, 1, 260, 6, 0),
  ('cafe-candil', 1, 1, 300, 6, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel, hito = excluded.hito;

-- ── Las cifras ──
create or replace function public.cafe_nivel_desde(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 0 when 2 then 300 when 3 then 1000 when 4 then 2500 when 5 then 5000 when 6 then 10000 end;
$$;
revoke all on function public.cafe_nivel_desde(integer) from public, anon, authenticated;

create or replace function public.cafe_nivel_de(reputacion integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when reputacion >= 10000 then 6 when reputacion >= 5000 then 5 when reputacion >= 2500 then 4
              when reputacion >= 1000 then 3 when reputacion >= 300 then 2 else 1 end;
$$;
revoke all on function public.cafe_nivel_de(integer) from public, anon, authenticated;

create or replace function public.cafe_tickets_nivel(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 10 when 2 then 20 when 3 then 40 when 4 then 60 when 5 then 100 when 6 then 80 else 0 end;
$$;
revoke all on function public.cafe_tickets_nivel(integer) from public, anon, authenticated;

create or replace function public.cafe_huecos(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case least(6, greatest(1, nivel)) when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 36 when 5 then 42 else 48 end;
$$;
revoke all on function public.cafe_huecos(integer) from public, anon, authenticated;

-- Dónde cae un hito: a un cuarto, a la mitad y a tres cuartos de la barra del nivel (la del último, 5.000 más)
create or replace function public.cafe_hito_umbral(nivel integer, hito integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public.cafe_nivel_desde(nivel)
    + ((case when nivel >= 6 then 5000 else public.cafe_nivel_desde(nivel + 1) - public.cafe_nivel_desde(nivel) end) * hito) / 4;
$$;
revoke all on function public.cafe_hito_umbral(integer, integer) from public, anon, authenticated;

-- Los granos del 3.er hito: 15 hasta el nivel 5; 20 en el 6
create or replace function public.cafe_granos_hito(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel >= 6 then 20 else 15 end;
$$;
revoke all on function public.cafe_granos_hito(integer) from public, anon, authenticated;

-- ── Los asientos y los clientes del día ──
-- La misma tabla que ASIENTOS en cafeCatalogo.js (con el banco de bodega, dos)
create or replace function public.cafe_asientos(plano jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(case e ->> 'id'
      when 'cafe-silla' then 1 when 'cafe-taburete' then 1 when 'cafe-banco' then 2 when 'cafe-orejero' then 1
      when 'cafe-silla-terraza' then 1 when 'cafe-banco-bodega' then 2 when 'silla' then 1 when 'banco' then 2
      when 'sofa' then 2 when 'puf' then 1 when 'mecedora' then 1 when 'taburete-barra' then 1 when 'sillon-capa' then 1
      else 0 end), 0)::integer
  from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e;
$$;
revoke all on function public.cafe_asientos(jsonb) from public, anon, authenticated;

-- Niveles 1 a 3, 3 / 4 / 5; del 4 en adelante, los asientos, entre 5 y 6, 7 u 8
create or replace function public.cafe_clientes_dia(nivel integer, asientos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel <= 3 then public.cafe_clientes_nivel(nivel)
              else least(case when nivel >= 6 then 8 when nivel = 5 then 7 else 6 end, greatest(5, coalesce(asientos, 0))) end;
$$;
revoke all on function public.cafe_clientes_dia(integer, integer) from public, anon, authenticated;

-- ── El plano: la bodega ──
-- Lo mismo que `casillaValida` en cafeCatalogo.js
create or replace function public.cafe_casilla_valida(x integer, y integer, nivel integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (x >= case when coalesce(nivel, 1) >= 4 then -3 else 0 end and x < 6
          and y >= case when coalesce(nivel, 1) >= 2 then -3 else 0 end and y < 6)
      or (coalesce(nivel, 1) >= 5 and x >= 0 and x < 6 and y >= 7 and y < 10)
      or (coalesce(nivel, 1) >= 6 and x >= 0 and x < 5 and y >= 20 and y < 25);
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
  -- Columnas −3 a 9 (13) por filas −3 a 29 (33): la calle, la terraza y la bodega (con sitio para que crezca)
  celdas boolean[] := array_fill(false, array[429]);
  uids text[] := '{}';
  i integer;
  j integer;
  tope integer;
begin
  if plano is null or jsonb_typeof(plano) <> 'object' or jsonb_typeof(plano -> 'items') <> 'array' then
    return false;
  end if;
  tope := 24;
  if coalesce(nivel, 1) >= 6 then
    tope := 40;
  elsif coalesce(nivel, 1) >= 4 then
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
    if (e ->> 'x') !~ '^-?[0-9]{1,2}$' or (e ->> 'y') !~ '^-?[0-9]{1,2}$' or (e ->> 'rot') !~ '^[0-3]$' then
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
        -- Antes que nada, que sea una casilla del café (así el índice nunca se sale)
        if not public.cafe_casilla_valida(i, j, nivel) then
          return false;
        end if;
        if celdas[(j + 3) * 13 + (i + 3) + 1] then
          return false;
        end if;
        celdas[(j + 3) * 13 + (i + 3) + 1] := true;
      end loop;
    end loop;
    w := null;
    d := null;
  end loop;
  return true;
end;
$$;
revoke all on function public.cafe_plano_valido(jsonb, integer) from public, anon, authenticated;

-- ── El progreso: como en el bloque 4a, con los granos del 3.er hito según el nivel ──
create or replace function public.cafe_progreso(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  d public.cafe_dias;
  v_nuevo integer;
  v_niveles jsonb := '[]'::jsonb;
  v_hitos jsonb := '[]'::jsonb;
  v_tickets integer := 0;
  v_granos integer := 0;
  v_dia_tk integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = uid for update;
  v_nuevo := public.cafe_nivel_de(l.reputacion);
  for n in 1 .. v_nuevo loop
    insert into public.cafe_niveles_cobrados (user_id, nivel, tickets) values (uid, n, public.cafe_tickets_nivel(n))
    on conflict on constraint cafe_niveles_cobrados_pkey do nothing;
    if found then
      v_tickets := v_tickets + public.cafe_tickets_nivel(n);
      v_niveles := v_niveles || jsonb_build_object('nivel', n, 'tickets', public.cafe_tickets_nivel(n));
    end if;
    for k in 1 .. 3 loop
      if l.reputacion >= public.cafe_hito_umbral(n, k) then
        insert into public.cafe_hitos (user_id, nivel, hito) values (uid, n, k)
        on conflict on constraint cafe_hitos_pkey do nothing;
        if found then
          v_hitos := v_hitos || jsonb_build_object('nivel', n, 'hito', k);
          if k = 3 then
            v_granos := v_granos + public.cafe_granos_hito(n);
          end if;
        end if;
      end if;
    end loop;
  end loop;
  -- Los tickets del día, con el primer servicio (con el nivel de después de subir)
  select * into d from public.cafe_dias x where x.user_id = uid and x.dia = cafe_progreso.dia for update;
  if d.tickets = 0 then
    v_dia_tk := public.cafe_tickets_dia(v_nuevo);
    update public.cafe_dias x set tickets = v_dia_tk where x.user_id = uid and x.dia = cafe_progreso.dia;
  end if;
  update public.cafe_locales x set nivel = greatest(x.nivel, v_nuevo), granos = least(100000, x.granos + v_granos), actualizado = now() where x.user_id = uid;
  if v_tickets + v_dia_tk > 0 then
    update public.piso_cuentas c set tickets = least(100000, c.tickets + v_tickets + v_dia_tk) where c.user_id = uid;
  end if;
  return jsonb_build_object('de', l.nivel, 'a', greatest(l.nivel, v_nuevo), 'niveles', v_niveles, 'hitos', v_hitos, 'granos', v_granos, 'tickets_dia', v_dia_tk,
    'tickets', v_tickets + v_dia_tk);
end;
$$;
revoke all on function public.cafe_progreso(uuid, date) from public, anon, authenticated;
