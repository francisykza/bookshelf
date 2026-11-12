-- 1.121 (§121) · El café-librería del bajo, bloque 3: clientes, lectura y granos (plan en docs/qa/cafe-libreria.md §3, §5 y
-- §6, aprobado por Francisco el 11-11-2026; revisado el 12-11-2026: el café pesa más que el libro, estrellas y excéntrico).
-- Cada día (de Madrid) llegan los clientes que da tu nivel (3 en el Rincón) y esperan todo el día; el último es el excéntrico
-- del día; tus sesiones de lectura traen hasta 2 habituales. Cada cliente pide una bebida (cuatro elecciones: bebida, grano u
-- hoja, leche y toque), que sale de su semilla y la comprueba el servidor, y un libro como extra. Las estrellas (1 a 3) salen
-- de lo acertado y fijan los granos y la reputación: fallar paga menos, nunca cero ni quita nada. El excéntrico con 3
-- estrellas paga el triple y deja una reseña dorada; el habitual deja siempre su reseña cerrada en la pizarra.
-- Si el libro encaja lo dice la app, porque la biblioteca no está en el servidor: vale una sola estrella de las cinco partes,
-- así que mentir da como mucho lo mismo que una buena biblioteca, y todo tiene techo diario.
-- Libros en cajas (§121.3, cifras aprobadas por Francisco el 12-11-2026, «Sí, esas cifras»): los libros que recomiendas se
-- compran con granos en cajas (de un género, 5 ejemplares por 10; de un título, 3 por 9), se colocan en las baldas (12 huecos
-- en el nivel 1) y solo se recomienda lo que está en la balda; si el libro encaja, el cliente se lleva el ejemplar y paga 2
-- granos más. Una caja de bienvenida de 8, gratis y una vez. Los títulos los manda la app (el servidor no tiene la
-- biblioteca): solo cuenta lo que cobra y lo que hay en cada caja y balda.
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

-- ── Libros en cajas (§121.3) ──
-- Las cifras (las mismas que en src/features/edificio/cafe/cafeClientes.js; una prueba lo comprueba)
create or replace function public.cafe_huecos(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select 12;
$$;
revoke all on function public.cafe_huecos(integer) from public, anon, authenticated;

create or replace function public.cafe_generos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['novela', 'fantasia', 'misterio', 'amor', 'clasico', 'ciencia-ficcion', 'poesia', 'historia', 'biografia', 'juvenil'];
$$;
revoke all on function public.cafe_generos() from public, anon, authenticated;

-- Tus libros del café: cada título (clave, la de tu biblioteca), con los ejemplares que esperan en la caja y los de la balda
create table if not exists public.cafe_libros (
  user_id uuid not null references auth.users (id) on delete cascade,
  clave   text not null check (char_length(clave) between 1 and 80),
  titulo  text not null check (char_length(titulo) between 1 and 200),
  genero  text not null,
  caja    smallint not null default 0 check (caja between 0 and 999),
  balda   smallint not null default 0 check (balda between 0 and 99),
  primary key (user_id, clave)
);
alter table public.cafe_libros enable row level security;
revoke all on table public.cafe_libros from anon, authenticated;
-- La caja de bienvenida, una vez por café
alter table public.cafe_locales add column if not exists libros_bienvenida boolean not null default false;

create or replace function public.cafe_libros_json(uid uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'huecos', public.cafe_huecos(l.nivel),
    'bienvenida', l.libros_bienvenida,
    'libros', coalesce((
      select jsonb_agg(jsonb_build_object('clave', b.clave, 'titulo', b.titulo, 'genero', b.genero, 'caja', b.caja, 'balda', b.balda) order by b.titulo, b.clave)
        from public.cafe_libros b where b.user_id = uid and (b.caja > 0 or b.balda > 0)), '[]'::jsonb))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_libros_json(uuid) from public, anon, authenticated;

-- Los títulos que manda la app (los desbloqueados por leer), comprobados: como mucho 200, sin repetir, con su género
create or replace function public.cafe_titulos(titulos jsonb)
returns table (clave text, titulo text, genero text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  e jsonb;
  vistos text[] := array[]::text[];
begin
  if titulos is null or jsonb_typeof(titulos) <> 'array' or jsonb_array_length(titulos) > 200 then
    raise exception 'cafe:titulos' using errcode = 'P0001';
  end if;
  for e in select x from jsonb_array_elements(titulos) x loop
    clave := e ->> 'clave';
    titulo := left(btrim(coalesce(e ->> 'titulo', '')), 200);
    genero := e ->> 'genero';
    if clave is null or char_length(clave) not between 1 and 80 or titulo = '' or genero is null or not (genero = any (public.cafe_generos())) then
      raise exception 'cafe:titulos' using errcode = 'P0001';
    end if;
    if not (clave = any (vistos)) then
      vistos := vistos || clave;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.cafe_titulos(jsonb) from public, anon, authenticated;

-- Meter ejemplares en la caja (de un título; si ya estaba, suma)
create or replace function public.cafe_a_la_caja(uid uuid, c text, t text, g text, n integer)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.cafe_libros (user_id, clave, titulo, genero, caja) values (uid, c, t, g, n)
  on conflict on constraint cafe_libros_pkey do update set titulo = excluded.titulo, genero = excluded.genero, caja = least(999, public.cafe_libros.caja + excluded.caja);
$$;
revoke all on function public.cafe_a_la_caja(uuid, text, text, text, integer) from public, anon, authenticated;

-- Comprar una caja en la distribuidora: de un género (5 ejemplares al azar entre tus títulos de ese género, 10 granos) o de
-- un título (3 ejemplares, 9 granos). La app manda tus títulos; el azar lo pone el servidor. Nunca por debajo de 0 granos.
create or replace function public.cafe_comprar_caja(genero text, clave text, titulos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  precio integer;
  recibidos text[] := array[]::text[];
  r record;
  k integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if cafe_comprar_caja.clave is not null then
    precio := 9;
    select t.* into r from public.cafe_titulos(titulos) t where t.clave = cafe_comprar_caja.clave;
    if r.clave is null then
      raise exception 'cafe:titulo' using errcode = 'P0001';
    end if;
    if l.granos < precio then
      raise exception 'cafe:granos' using errcode = 'P0001';
    end if;
    perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 3);
    recibidos := array[r.clave, r.clave, r.clave];
  else
    precio := 10;
    if cafe_comprar_caja.genero is null or not (cafe_comprar_caja.genero = any (public.cafe_generos()))
       or not exists (select 1 from public.cafe_titulos(titulos) t where t.genero = cafe_comprar_caja.genero) then
      raise exception 'cafe:genero' using errcode = 'P0001';
    end if;
    if l.granos < precio then
      raise exception 'cafe:granos' using errcode = 'P0001';
    end if;
    -- Cinco ejemplares: los títulos de ese género en un orden al azar, dando la vuelta si hay menos de cinco
    while k < 5 loop
      for r in select t.* from public.cafe_titulos(titulos) t where t.genero = cafe_comprar_caja.genero order by random() loop
        exit when k >= 5;
        perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 1);
        recibidos := recibidos || r.clave;
        k := k + 1;
      end loop;
    end loop;
  end if;
  update public.cafe_locales x set granos = x.granos - precio, actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me), 'caja', to_jsonb(recibidos));
end;
$$;
revoke all on function public.cafe_comprar_caja(text, text, jsonb) from public, anon;
grant execute on function public.cafe_comprar_caja(text, text, jsonb) to authenticated;

-- La caja de bienvenida: 8 ejemplares gratis, una sola vez, repartidos entre géneros para que haya variedad
create or replace function public.cafe_bienvenida(titulos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  recibidos text[] := array[]::text[];
  r record;
  k integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if l.libros_bienvenida then
    raise exception 'cafe:bienvenida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cafe_titulos(titulos)) then
    while k < 8 loop
      for r in select t.*, row_number() over (partition by t.genero order by random()) as fila from public.cafe_titulos(titulos) t order by fila, random() loop
        exit when k >= 8;
        perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 1);
        recibidos := recibidos || r.clave;
        k := k + 1;
      end loop;
    end loop;
  end if;
  update public.cafe_locales x set libros_bienvenida = true, actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me), 'caja', to_jsonb(recibidos));
end;
$$;
revoke all on function public.cafe_bienvenida(jsonb) from public, anon;
grant execute on function public.cafe_bienvenida(jsonb) to authenticated;

-- Colocar en las baldas: cada clave de `poner` sube un ejemplar de la caja a la balda (si queda hueco) y cada una de
-- `quitar` lo devuelve a la caja. Nada se pierde.
create or replace function public.cafe_colocar(poner text[], quitar text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  c text;
  libres integer;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(poner), 0) > 50 or coalesce(cardinality(quitar), 0) > 50 then
    raise exception 'cafe:colocar' using errcode = 'P0001';
  end if;
  foreach c in array coalesce(quitar, array[]::text[]) loop
    update public.cafe_libros b set balda = b.balda - 1, caja = least(999, b.caja + 1) where b.user_id = me and b.clave = c and b.balda > 0;
  end loop;
  foreach c in array coalesce(poner, array[]::text[]) loop
    select public.cafe_huecos(l.nivel) - coalesce(sum(b.balda), 0) into libres from public.cafe_libros b where b.user_id = me;
    exit when libres <= 0;
    update public.cafe_libros b set balda = b.balda + 1, caja = b.caja - 1 where b.user_id = me and b.clave = c and b.caja > 0;
  end loop;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me));
end;
$$;
revoke all on function public.cafe_colocar(text[], text[]) from public, anon;
grant execute on function public.cafe_colocar(text[], text[]) to authenticated;

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
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, dia), 'libros', public.cafe_libros_json(me));
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
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, dia), 'libros', public.cafe_libros_json(me));
end;
$$;
revoke all on function public.cafe_habitual(date) from public, anon;
grant execute on function public.cafe_habitual(date) to authenticated;

-- Por si quedó la versión anterior (sin aplicar en producción): fuera la firma vieja
drop function if exists public.cafe_servir(date, integer, boolean, text);
drop function if exists public.cafe_servir(date, integer, text[], boolean);

-- Llevarle a un cliente del día lo que has preparado (y, si quieres, un libro): una vez por cliente. El servidor compara la
-- receta con la que pidió y pone estrellas, granos y reputación. El habitual deja su reseña; el excéntrico con 3 estrellas,
-- la dorada. `libro`: la clave del libro que le das (§121.3): solo vale si está en tu balda; si encaja, se lo lleva (sale de la
-- balda) y paga 2 granos más; si no encaja, vuelve a la balda.
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
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, d.dia), 'libros', public.cafe_libros_json(me),
    'dado', jsonb_build_object('granos', premio[1] + extra, 'reputacion', premio[2], 'llevado', lleva, 'extra', extra, 'estrellas', estrellas, 'aciertos', aciertos,
      'pide', to_jsonb(pide), 'frase', frase, 'dorada', dorada));
end;
$$;
revoke all on function public.cafe_servir(date, integer, text[], boolean, text) from public, anon;
grant execute on function public.cafe_servir(date, integer, text[], boolean, text) to authenticated;
