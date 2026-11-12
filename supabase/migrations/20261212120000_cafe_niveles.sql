-- 1.122 (§122) · El café-librería del bajo, bloque 4a: subir de nivel, tickets, hitos, huecos y la carta (decisiones de
-- Francisco del 12-11-2026; plan en docs/qa/cafe-libreria.md §12). Requiere 20261210120000_cafe_local.sql y
-- 20261211120000_cafe_clientes.sql.
-- - Niveles por reputación: 0 / 300 / 1.000 / 2.500 / 5.000. Al subir, los tickets del nivel (10 / 20 / 40 / 60 / 100, el 1 al
--   atender al primer cliente), una vez por nivel y en la misma transacción que el servicio.
-- - Tickets del día: tantos como el nivel (tope 5), una vez al día al atender al primer cliente.
-- - Tres hitos por nivel, a un cuarto, a la mitad y a tres cuartos de la barra: 1.º un mueble nuevo del café a la venta,
--   2.º lo nuevo de la carta (nivel 2 el chocolate, nivel 3 la nata), 3.º 15 granos. Una vez cada uno.
-- - La carta del día la fija el servidor al abrir el día (lo que piden los clientes no cambia a media jornada); los
--   habituales piden siempre «lo de siempre».
-- - Huecos de la balda: 12 / 18 / 30 / 36 / 42.
-- Los tickets son la cuarta excepción a «los tickets solo se ganan leyendo» (aprobada por Francisco el 11-11-2026).
-- Las cifras, las mismas que en src/features/edificio/cafe/cafeNiveles.js (una prueba lo comprueba). Todo por funciones
-- `security definer` y `volatile`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Las cifras ──
create or replace function public.cafe_nivel_desde(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 0 when 2 then 300 when 3 then 1000 when 4 then 2500 when 5 then 5000 end;
$$;
revoke all on function public.cafe_nivel_desde(integer) from public, anon, authenticated;

create or replace function public.cafe_nivel_de(reputacion integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when reputacion >= 5000 then 5 when reputacion >= 2500 then 4 when reputacion >= 1000 then 3 when reputacion >= 300 then 2 else 1 end;
$$;
revoke all on function public.cafe_nivel_de(integer) from public, anon, authenticated;

create or replace function public.cafe_tickets_nivel(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case nivel when 1 then 10 when 2 then 20 when 3 then 40 when 4 then 60 when 5 then 100 else 0 end;
$$;
revoke all on function public.cafe_tickets_nivel(integer) from public, anon, authenticated;

create or replace function public.cafe_tickets_dia(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(5, greatest(1, nivel));
$$;
revoke all on function public.cafe_tickets_dia(integer) from public, anon, authenticated;

create or replace function public.cafe_huecos(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case least(5, greatest(1, nivel)) when 1 then 12 when 2 then 18 when 3 then 30 when 4 then 36 else 42 end;
$$;
revoke all on function public.cafe_huecos(integer) from public, anon, authenticated;

-- Dónde cae un hito: a un cuarto, a la mitad y a tres cuartos de la barra del nivel (la del 5 sigue 5.000 más)
create or replace function public.cafe_hito_umbral(nivel integer, hito integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public.cafe_nivel_desde(nivel)
    + ((case when nivel >= 5 then 5000 else public.cafe_nivel_desde(nivel + 1) - public.cafe_nivel_desde(nivel) end) * hito) / 4;
$$;
revoke all on function public.cafe_hito_umbral(integer, integer) from public, anon, authenticated;

-- Lo abierto en la carta con esta reputación (el chocolate, en el 2.º hito del nivel 2; la nata, en el del nivel 3)
create or replace function public.cafe_carta(reputacion integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    case when reputacion >= public.cafe_hito_umbral(2, 2) then 'chocolate' end,
    case when reputacion >= public.cafe_hito_umbral(3, 2) then 'nata' end], null);
$$;
revoke all on function public.cafe_carta(integer) from public, anon, authenticated;

create or replace function public.cafe_bebidas_carta(carta text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cafe', 'te'] || case when 'chocolate' = any (coalesce(carta, '{}')) then array['chocolate'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_bebidas_carta(text[]) from public, anon, authenticated;

create or replace function public.cafe_toques_carta(carta text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['nada', 'canela', 'miel'] || case when 'nata' = any (coalesce(carta, '{}')) then array['nata'] else '{}'::text[] end;
$$;
revoke all on function public.cafe_toques_carta(text[]) from public, anon, authenticated;

-- La receta de un número con la carta del día: cada parte con su base (sin carta, la cuenta de siempre de cafe_receta)
create or replace function public.cafe_receta_carta(r integer, carta text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  b text[] := public.cafe_bebidas_carta(carta);
  g text[] := array['suave', 'intenso'];
  l text[] := array['sin', 'entera', 'avena'];
  t text[] := public.cafe_toques_carta(carta);
  nb integer := cardinality(b);
begin
  return array[
    b[1 + r % nb],
    g[1 + (r / nb) % 2],
    l[1 + (r / (nb * 2)) % 3],
    t[1 + (r / (nb * 6)) % cardinality(t)]];
end;
$$;
revoke all on function public.cafe_receta_carta(integer, text[]) from public, anon, authenticated;

-- ── Lo nuevo del catálogo del café: los muebles de la subida y los de los hitos ──
alter table public.cafe_catalogo add column if not exists hito smallint not null default 0 check (hito between 0 and 3);
-- La misma lista que CAFE_MUEBLES en src/features/edificio/cafe/cafeCatalogo.js (una prueba lo comprueba)
insert into public.cafe_catalogo (id, w, d, precio, nivel, hito) values
  ('cafe-maceta', 1, 1, 35, 1, 1),
  ('cafe-banco', 2, 1, 70, 2, 0),
  ('cafe-vitrina', 2, 1, 90, 2, 0),
  ('cafe-planta', 1, 1, 45, 2, 0),
  ('cafe-perchero', 1, 1, 40, 2, 1),
  ('cafe-estanteria-alta', 2, 1, 140, 3, 0),
  ('cafe-orejero', 1, 1, 120, 3, 0),
  ('cafe-mesita', 1, 1, 80, 3, 0),
  ('cafe-reloj', 1, 1, 160, 3, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel, hito = excluded.hito;

-- ── Lo cobrado: niveles e hitos, una vez cada uno; la carta y los tickets de cada día ──
create table if not exists public.cafe_niveles_cobrados (
  user_id uuid not null references auth.users (id) on delete cascade,
  nivel   smallint not null check (nivel between 1 and 5),
  tickets smallint not null check (tickets between 0 and 100),
  creado  timestamptz not null default now(),
  primary key (user_id, nivel)
);
alter table public.cafe_niveles_cobrados enable row level security;
revoke all on table public.cafe_niveles_cobrados from anon, authenticated;

create table if not exists public.cafe_hitos (
  user_id uuid not null references auth.users (id) on delete cascade,
  nivel   smallint not null check (nivel between 1 and 5),
  hito    smallint not null check (hito between 1 and 3),
  creado  timestamptz not null default now(),
  primary key (user_id, nivel, hito)
);
alter table public.cafe_hitos enable row level security;
revoke all on table public.cafe_hitos from anon, authenticated;

alter table public.cafe_dias add column if not exists carta text[] not null default '{}';
alter table public.cafe_dias add column if not exists tickets smallint not null default 0 check (tickets between 0 and 5);

-- Lo que pide cada uno: los clientes, con la carta de su día; los habituales, «lo de siempre»
create or replace function public.cafe_pide(uid uuid, dia date, cliente integer)
returns text[]
language sql
volatile
security definer
set search_path = ''
as $$
  select case when cliente > 100 then public.cafe_receta(public.cafe_quien(uid, dia, cliente - 100) * 29 + 7)
              else public.cafe_receta_carta(public.cafe_semilla(uid, dia, 'c' || cliente) / 1000,
                     coalesce((select d.carta from public.cafe_dias d where d.user_id = uid and d.dia = cafe_pide.dia), '{}')) end;
$$;
revoke all on function public.cafe_pide(uuid, date, integer) from public, anon, authenticated;

-- Abre el día: cuántos clientes vienen (según el nivel) y la carta de ese día, la primera vez
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
  insert into public.cafe_dias (user_id, dia, clientes, carta) values (uid, dia, public.cafe_clientes_nivel(l.nivel), public.cafe_carta(l.reputacion))
  on conflict on constraint cafe_dias_pkey do nothing;
end;
$$;
revoke all on function public.cafe_abrir_dia(uuid, date) from public, anon, authenticated;

-- El día, con su carta y los tickets que ya dio
create or replace function public.cafe_dia_json(uid uuid, dia date)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dia', d.dia,
    'carta', to_jsonb(d.carta),
    'tickets', d.tickets,
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object('n', n, 'semilla', public.cafe_semilla(uid, d.dia, 'c' || n), 'servido', s.cliente is not null,
               'encaja', s.encaja, 'estrellas', s.estrellas, 'excentrico', n = d.clientes,
               'quien', case when n = d.clientes then public.cafe_semilla(uid, d.dia, 'c' || n) % 6 end) order by n)
        from generate_series(1, d.clientes) n
        left join public.cafe_servicios s on s.user_id = uid and s.dia = d.dia and s.cliente = n), '[]'::jsonb),
    'habituales', coalesce((
      select jsonb_agg(jsonb_build_object('n', 100 + k, 'quien', public.cafe_quien(uid, d.dia, k), 'semilla', public.cafe_semilla(uid, d.dia, 'h' || k || 'p'),
               'servido', s.cliente is not null, 'encaja', s.encaja, 'estrellas', s.estrellas) order by k)
        from generate_series(1, d.habituales) k
        left join public.cafe_servicios s on s.user_id = uid and s.dia = d.dia and s.cliente = 100 + k), '[]'::jsonb),
    'pizarra', coalesce((
      select jsonb_agg(jsonb_build_object('dia', r.dia, 'quien', r.quien, 'frase', r.frase, 'dorada', r.excentrico) order by r.creado desc)
        from (select * from public.cafe_resenas x where x.user_id = uid order by x.creado desc limit 6) r), '[]'::jsonb))
  from public.cafe_dias d where d.user_id = uid and d.dia = cafe_dia_json.dia;
$$;
revoke all on function public.cafe_dia_json(uuid, date) from public, anon, authenticated;

-- Comprar un mueble del café: además del nivel, el de un hito solo cuando lo has alcanzado
create or replace function public.cafe_comprar(mueble text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  c public.cafe_catalogo;
begin
  select * into l from public.cafe_locales where user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  select * into c from public.cafe_catalogo k where k.id = cafe_comprar.mueble;
  if c.id is null or c.nivel > l.nivel or (c.hito > 0 and l.reputacion < public.cafe_hito_umbral(c.nivel, c.hito)) then
    raise exception 'cafe:mueble' using errcode = 'P0001';
  end if;
  if l.granos < c.precio then
    raise exception 'cafe:granos' using errcode = 'P0001';
  end if;
  if coalesce((select v.copias from public.cafe_inventario v where v.user_id = me and v.mueble = c.id), 0) >= 99 then
    raise exception 'cafe:copias:%', c.id using errcode = 'P0001';
  end if;
  update public.cafe_locales set granos = granos - c.precio, actualizado = now() where user_id = me;
  insert into public.cafe_inventario (user_id, mueble, copias) values (me, c.id, 1)
  on conflict on constraint cafe_inventario_pkey do update set copias = public.cafe_inventario.copias + 1;
  return public.cafe_json(me);
end;
$$;
revoke all on function public.cafe_comprar(text) from public, anon;
grant execute on function public.cafe_comprar(text) to authenticated;

-- Tras sumar reputación: sube de nivel (con sus tickets), apunta los hitos (el 3.º, con sus granos) y, con el primer
-- servicio del día, los tickets del día. Devuelve lo nuevo. Solo la llama cafe_servir, dentro de su transacción.
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
            v_granos := v_granos + 15;
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

-- Servir: como en el bloque 3, con la receta de la carta abierta, y después el progreso (niveles, hitos y tickets)
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
     or not (receta[2] = any (array['suave', 'intenso']))
     or not (receta[3] = any (array['sin', 'entera', 'avena']))
     or not (receta[4] = any (public.cafe_toques_carta(carta))) then
    raise exception 'cafe:receta' using errcode = 'P0001';
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
  estrellas := public.cafe_estrellas(aciertos, lleva);
  premio := public.cafe_premio(case when habitual then 'habitual' when excentrico then 'excentrico' else 'cliente' end, estrellas);
  insert into public.cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion)
  values (me, d.dia, cliente, receta, aciertos, lleva, estrellas, premio[1] + extra, premio[2])
  on conflict on constraint cafe_servicios_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_locales x
     set granos = least(100000, x.granos + premio[1] + extra), reputacion = least(1000000, x.reputacion + premio[2]), actualizado = now()
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
    'dado', jsonb_build_object('granos', premio[1] + extra, 'reputacion', premio[2], 'llevado', lleva, 'extra', extra, 'estrellas', estrellas, 'aciertos', aciertos,
      'pide', to_jsonb(pide), 'frase', frase, 'dorada', dorada),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_servir(date, integer, text[], boolean, text) from public, anon;
grant execute on function public.cafe_servir(date, integer, text[], boolean, text) to authenticated;

-- ── El fondo del local: desde el nivel 2 se recogen las cortinas y la cuadrícula crece 3 filas hacia el fondo ──
-- (las filas -3 a -1; las de antes conservan su número). Lo mismo que `filasDe` en src/features/edificio/cafe/cafeCatalogo.js.
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
  desde integer := case when coalesce(nivel, 1) >= 2 then -3 else 0 end;
  celdas boolean[] := array_fill(false, array[54]);
  uids text[] := '{}';
  i integer;
  j integer;
begin
  if plano is null or jsonb_typeof(plano) <> 'object' or jsonb_typeof(plano -> 'items') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(plano -> 'items') > 24 then
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
    if (e ->> 'x') !~ '^[0-9]$' or (e ->> 'y') !~ '^-?[0-9]$' or (e ->> 'rot') !~ '^[0-3]$' then
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
    if y < desde or x + w > 6 or y + d > 6 then
      return false;
    end if;
    for i in x .. x + w - 1 loop
      for j in y .. y + d - 1 loop
        if celdas[(j + 3) * 6 + i + 1] then
          return false;
        end if;
        celdas[(j + 3) * 6 + i + 1] := true;
      end loop;
    end loop;
    w := null;
    d := null;
  end loop;
  return true;
end;
$$;
revoke all on function public.cafe_plano_valido(jsonb, integer) from public, anon, authenticated;

-- La de un solo argumento (la del bloque 2) sigue valiendo: la del nivel 1
create or replace function public.cafe_plano_valido(plano jsonb)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select public.cafe_plano_valido(plano, 1);
$$;
revoke all on function public.cafe_plano_valido(jsonb) from public, anon, authenticated;

-- Guardar lo decorado: como en el bloque 2, con la cuadrícula del nivel del café
create or replace function public.cafe_guardar(plano jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  falta text;
begin
  select * into l from public.cafe_locales where user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if not public.cafe_plano_valido(plano, l.nivel) then
    raise exception 'cafe:plano' using errcode = 'P0001';
  end if;
  select x.id into falta
    from (select e ->> 'id' as id, count(*)::integer as n from jsonb_array_elements(plano -> 'items') e group by 1) x
    join public.cafe_catalogo c on c.id = x.id
    left join public.cafe_inventario v on v.user_id = me and v.mueble = x.id
   where x.n > coalesce(v.copias, 0)
   limit 1;
  if falta is not null then
    raise exception 'cafe:copias:%', falta using errcode = 'P0001';
  end if;
  perform public.piso_inventario_asegurar(me);
  falta := public.cafe_falta_de_casa(me, plano, (select p.layout from public.pisos p where p.user_id = me));
  if falta is not null then
    raise exception 'cafe:copias:%', falta using errcode = 'P0001';
  end if;
  update public.cafe_locales set plano = jsonb_build_object('v', 1, 'items', cafe_guardar.plano -> 'items'), actualizado = now() where user_id = me;
  return public.cafe_json(me);
end;
$$;
revoke all on function public.cafe_guardar(jsonb) from public, anon;
grant execute on function public.cafe_guardar(jsonb) to authenticated;
