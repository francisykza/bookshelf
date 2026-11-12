-- 1.121 (§121) · El café-librería del bajo, bloque 3: clientes, lectura y granos (plan en docs/qa/cafe-libreria.md §3, §5 y
-- §6, aprobado por Francisco el 11-11-2026; revisado el 12-11-2026: el café pesa más que el libro, estrellas y excéntrico).
-- Cada día (de Madrid) llegan los clientes que da tu nivel (3 en el Rincón) y esperan todo el día; el último es el excéntrico
-- del día; tus sesiones de lectura traen hasta 2 habituales. Cada cliente pide una bebida (cuatro elecciones: bebida, grano u
-- hoja, leche y toque), que sale de su semilla y la comprueba el servidor, y un libro como extra. Las estrellas (1 a 3) salen
-- de lo acertado y fijan los granos y la reputación: fallar paga menos, nunca cero ni quita nada. El excéntrico con 3
-- estrellas paga el triple y deja una reseña dorada; el habitual deja siempre su reseña cerrada en la pizarra.
-- Si el libro encaja lo dice la app, porque la biblioteca no está en el servidor: vale una sola estrella de las cinco partes,
-- así que mentir da como mucho lo mismo que una buena biblioteca, y todo tiene techo diario.
-- Sin subidas de nivel ni tickets (bloque 4). Requiere 20261210120000_cafe_local.sql. Tablas con RLS y sin permisos
-- directos; todo por funciones `security definer` y `volatile`. Re-ejecutable.

-- El día del café, en Madrid (como el almacén)
create or replace function public.cafe_hoy()
returns date
language sql
volatile
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;
revoke all on function public.cafe_hoy() from public, anon, authenticated;

-- Las cifras fijas (las mismas que en src/features/edificio/cafe/cafeClientes.js; una prueba lo comprueba)
create or replace function public.cafe_clientes_nivel(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel <= 1 then 3 when nivel = 2 then 4 else 5 end;
$$;
revoke all on function public.cafe_clientes_nivel(integer) from public, anon, authenticated;

create or replace function public.cafe_bebidas(nivel integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['cafe', 'te'];
$$;
revoke all on function public.cafe_bebidas(integer) from public, anon, authenticated;

-- La receta que pide un cliente: sale de su semilla (los habituales, de quién son: siempre «lo de siempre»)
-- [bebida, grano u hoja, leche, toque]
create or replace function public.cafe_receta(r integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    (array['cafe', 'te'])[1 + r % 2],
    (array['suave', 'intenso'])[1 + (r / 2) % 2],
    (array['sin', 'entera', 'avena'])[1 + (r / 4) % 3],
    (array['nada', 'canela', 'miel'])[1 + (r / 12) % 3]];
$$;
revoke all on function public.cafe_receta(integer) from public, anon, authenticated;

-- Estrellas: cada parte de la bebida acertada vale un punto y el libro que encaja, otro (cinco en total)
create or replace function public.cafe_estrellas(aciertos integer, encaja boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when aciertos + (case when encaja then 1 else 0 end) >= 5 then 3
              when aciertos + (case when encaja then 1 else 0 end) >= 3 then 2 else 1 end;
$$;
revoke all on function public.cafe_estrellas(integer, boolean) from public, anon, authenticated;

-- Lo que deja un servicio: granos y reputación, según quién es y las estrellas
create or replace function public.cafe_premio(tipo text, estrellas integer)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case tipo
    when 'excentrico' then case estrellas when 3 then array[15, 40] when 2 then array[10, 26] else array[5, 14] end
    when 'habitual' then case estrellas when 3 then array[6, 15] when 2 then array[5, 12] else array[3, 8] end
    else case estrellas when 3 then array[5, 14] when 2 then array[4, 10] else array[2, 6] end end;
$$;
revoke all on function public.cafe_premio(text, integer) from public, anon, authenticated;

-- Un número fijo por cuenta, día y hueco: de él salen el aspecto, el pedido y la receta de cada cliente, qué habitual viene
-- y su reseña
create or replace function public.cafe_semilla(uid uuid, dia date, hueco text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (abs(hashtext(uid::text || ':' || dia::text || ':' || hueco)) % 1000000)::integer;
$$;
revoke all on function public.cafe_semilla(uuid, date, text) from public, anon, authenticated;

-- Qué habitual (de los 12) ocupa el hueco 1 o 2 del día: dos distintos
create or replace function public.cafe_quien(uid uuid, dia date, k integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when k = 1 then public.cafe_semilla(uid, dia, 'h1') % 12
              else (public.cafe_semilla(uid, dia, 'h1') % 12 + 1 + public.cafe_semilla(uid, dia, 'h2') % 11) % 12 end;
$$;
revoke all on function public.cafe_quien(uuid, date, integer) from public, anon, authenticated;

-- Lo que pide cada uno: los clientes, por su semilla (la receta, de sus cifras de los miles); los habituales, por quién son
create or replace function public.cafe_pide(uid uuid, dia date, cliente integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when cliente > 100 then public.cafe_receta(public.cafe_quien(uid, dia, cliente - 100) * 29 + 7)
              else public.cafe_receta(public.cafe_semilla(uid, dia, 'c' || cliente) / 1000) end;
$$;
revoke all on function public.cafe_pide(uuid, date, integer) from public, anon, authenticated;

create table if not exists public.cafe_dias (
  user_id    uuid not null references auth.users (id) on delete cascade,
  dia        date not null,
  clientes   smallint not null check (clientes between 0 and 5),
  habituales smallint not null default 0 check (habituales between 0 and 2),
  creado     timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.cafe_dias enable row level security;
revoke all on table public.cafe_dias from anon, authenticated;

create table if not exists public.cafe_servicios (
  user_id    uuid not null,
  dia        date not null,
  cliente    smallint not null check (cliente between 1 and 5 or cliente between 101 and 102),
  receta     text[] not null check (cardinality(receta) = 4),
  aciertos   smallint not null check (aciertos between 0 and 4),
  encaja     boolean not null,
  estrellas  smallint not null check (estrellas between 1 and 3),
  granos     smallint not null check (granos between 0 and 50),
  reputacion smallint not null check (reputacion between 0 and 50),
  creado     timestamptz not null default now(),
  primary key (user_id, dia, cliente),
  foreign key (user_id, dia) references public.cafe_dias (user_id, dia) on delete cascade
);
alter table public.cafe_servicios enable row level security;
revoke all on table public.cafe_servicios from anon, authenticated;

-- La pizarra: la reseña de cada habitual (quien, de 0 a 11) y la dorada de cada excéntrico bordado (quien, de 0 a 5)
create table if not exists public.cafe_resenas (
  user_id    uuid not null,
  dia        date not null,
  excentrico boolean not null default false,
  quien      smallint not null check (quien between 0 and 11),
  frase      smallint not null check (frase between 0 and 11),
  creado     timestamptz not null default now(),
  primary key (user_id, dia, excentrico, quien),
  foreign key (user_id, dia) references public.cafe_dias (user_id, dia) on delete cascade
);
alter table public.cafe_resenas enable row level security;
revoke all on table public.cafe_resenas from anon, authenticated;

-- Solo hoy o ayer (Madrid): la app manda su día y se acepta si es uno de los dos
create or replace function public.cafe_dia_valido(dia date)
returns boolean
language sql
volatile
set search_path = ''
as $$
  select dia is not null and dia between public.cafe_hoy() - 1 and public.cafe_hoy();
$$;
revoke all on function public.cafe_dia_valido(date) from public, anon, authenticated;

-- El día tal como lo ve la app: los clientes (con su semilla, si es el excéntrico y quién, y cómo se les atendió), los
-- habituales y la pizarra
create or replace function public.cafe_dia_json(uid uuid, dia date)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dia', d.dia,
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

-- Abre el día (la primera vez fija cuántos clientes vienen, según tu nivel)
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
  insert into public.cafe_dias (user_id, dia, clientes) values (uid, dia, public.cafe_clientes_nivel(l.nivel))
  on conflict on constraint cafe_dias_pkey do nothing;
end;
$$;
revoke all on function public.cafe_abrir_dia(uuid, date) from public, anon, authenticated;

create or replace function public.cafe_dia(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  perform public.cafe_abrir_dia(me, dia);
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, dia));
end;
$$;
revoke all on function public.cafe_dia(date) from public, anon;
grant execute on function public.cafe_dia(date) to authenticated;

-- Has leído hoy: llega un habitual más (como mucho 2 al día; la app dice que hubo sesión y el servidor pone el tope)
create or replace function public.cafe_habitual(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  perform public.cafe_abrir_dia(me, dia);
  update public.cafe_dias d set habituales = least(2, d.habituales + 1) where d.user_id = me and d.dia = cafe_habitual.dia;
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, dia));
end;
$$;
revoke all on function public.cafe_habitual(date) from public, anon;
grant execute on function public.cafe_habitual(date) to authenticated;

-- Por si quedó la versión anterior (sin aplicar en producción): fuera la firma vieja
drop function if exists public.cafe_servir(date, integer, boolean, text);

-- Llevarle a un cliente del día lo que has preparado (y, si quieres, un libro): una vez por cliente. El servidor compara la
-- receta con la que pidió y pone estrellas, granos y reputación. El habitual deja su reseña; el excéntrico con 3 estrellas,
-- la dorada.
create or replace function public.cafe_servir(dia date, cliente integer, receta text[], encaja boolean)
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
  habitual boolean := cliente between 101 and 102;
  excentrico boolean;
  aciertos integer := 0;
  estrellas integer;
  premio integer[];
  frase integer := null;
  quien integer := null;
  dorada boolean := false;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_servir.dia for update;
  if cliente is null or not ((cliente between 1 and d.clientes) or (cliente between 101 and 100 + d.habituales)) then
    raise exception 'cafe:cliente' using errcode = 'P0001';
  end if;
  if receta is null or cardinality(receta) <> 4
     or not (receta[1] = any (public.cafe_bebidas(l.nivel)))
     or not (receta[2] = any (array['suave', 'intenso']))
     or not (receta[3] = any (array['sin', 'entera', 'avena']))
     or not (receta[4] = any (array['nada', 'canela', 'miel'])) then
    raise exception 'cafe:receta' using errcode = 'P0001';
  end if;
  excentrico := not habitual and cliente = d.clientes;
  pide := public.cafe_pide(me, d.dia, cliente);
  for k in 1..4 loop
    if receta[k] = pide[k] then
      aciertos := aciertos + 1;
    end if;
  end loop;
  estrellas := public.cafe_estrellas(aciertos, coalesce(encaja, false));
  premio := public.cafe_premio(case when habitual then 'habitual' when excentrico then 'excentrico' else 'cliente' end, estrellas);
  insert into public.cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion)
  values (me, d.dia, cliente, receta, aciertos, coalesce(encaja, false), estrellas, premio[1], premio[2])
  on conflict on constraint cafe_servicios_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_locales x
     set granos = least(100000, x.granos + premio[1]), reputacion = least(1000000, x.reputacion + premio[2]), actualizado = now()
   where x.user_id = me;
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
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, d.dia),
    'dado', jsonb_build_object('granos', premio[1], 'reputacion', premio[2], 'estrellas', estrellas, 'aciertos', aciertos,
      'pide', to_jsonb(pide), 'frase', frase, 'dorada', dorada));
end;
$$;
revoke all on function public.cafe_servir(date, integer, text[], boolean) from public, anon;
grant execute on function public.cafe_servir(date, integer, text[], boolean) to authenticated;
