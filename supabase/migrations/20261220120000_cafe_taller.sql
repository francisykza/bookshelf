-- 1.133 (§133) · El café-librería del bajo: el taller de la trastienda, primera tanda (encargo de Francisco del 14-11-2026;
-- plan en docs/qa/cafe-libreria.md §16.3, cifras aprobadas el mismo día, «Sí, esas cifras del taller»; bloque 2 de §16.6).
-- Requiere las migraciones del café hasta 20261219120000_cafe_influencer.sql (todas ya aplicadas). Esta no redefine ninguna
-- función de antes: añade una tabla y funciones nuevas.
-- - Desde el nivel 3, el taller: como mucho un encargo de un cliente al día. No caduca: el que llega espera en el banco hasta
--   que se termina, y el siguiente llega otro día (nunca el mismo día en que llegó o se terminó otro).
-- - Cada encargo, un libro de la lista cerrada (`LIBROS_TALLER` de cafeTaller.js: 16 clásicos de dominio público), quién lo
--   trae (`CLIENTES_TALLER`: 12) y sus daños, en el orden en que se trabajan: de 2 a 5 según el nivel. El primero de cada
--   cuenta es siempre el mismo (el que enseña don Celestino): el Quijote con polvo, un pliegue y el título borrado.
-- - Al terminar, la app dice cómo quedó cada daño (`mimo`: 2, bien; 1, se podía mejorar) y el servidor pone las estrellas
--   (3 con todos bien, 2 con al menos la mitad, 1 si no; nunca cero) y paga 6 / 9 / 12 granos y 15 / 22 / 30 de reputación,
--   aparte del tope diario y sin tickets. La reputación pasa por `cafe_progreso` (el nivel, los hitos y la espera del
--   influencer, como al servir).
-- Las cifras, las mismas que en src/features/edificio/cafe/cafeTaller.js (las pruebas lo comprueban). Todo por funciones
-- `security definer`; la tabla, con RLS y sin permisos directos. Re-ejecutable.

-- ── Los encargos del taller ──
create table if not exists public.cafe_encargos (
  user_id    uuid not null references auth.users (id) on delete cascade,
  n          integer not null check (n between 1 and 1000000),
  llega      date not null,
  libro      smallint not null check (libro between 0 and 15),
  quien      smallint not null check (quien between 0 and 11),
  danos      text[] not null check (cardinality(danos) between 1 and 5 and danos <@ array['polvo', 'manchas', 'arrugas', 'lomo', 'dorado']),
  hecho      timestamptz,
  dia_hecho  date,
  estrellas  smallint check (estrellas is null or estrellas between 1 and 3),
  mimo       smallint[],
  granos     integer check (granos is null or granos between 0 and 100),
  reputacion integer check (reputacion is null or reputacion between 0 and 100),
  creado     timestamptz not null default now(),
  primary key (user_id, n)
);
alter table public.cafe_encargos enable row level security;
revoke all on table public.cafe_encargos from anon, authenticated;

-- ── Las cifras ──
-- El nivel desde el que se abre el taller (la Librería)
create or replace function public.cafe_taller_nivel()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3;
$$;
revoke all on function public.cafe_taller_nivel() from public, anon, authenticated;

-- Los daños de esta tanda, en el orden en que se trabajan
create or replace function public.cafe_danos_taller()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['polvo', 'manchas', 'arrugas', 'lomo', 'dorado'];
$$;
revoke all on function public.cafe_danos_taller() from public, anon, authenticated;

-- Cuántos libros y cuántos clientes tienen las listas cerradas de la app
create or replace function public.cafe_libros_taller()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 16;
$$;
revoke all on function public.cafe_libros_taller() from public, anon, authenticated;

create or replace function public.cafe_clientes_taller()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 12;
$$;
revoke all on function public.cafe_clientes_taller() from public, anon, authenticated;

-- Cuántos daños trae un libro: 2 o 3 en los niveles 3 y 4, 3 o 4 en el 5 y el 6, y 4 o 5 desde el 7
create or replace function public.cafe_taller_cuantos(nivel integer, semilla integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(5, 2 + (greatest(3, nivel) - 3) / 2 + semilla % 2);
$$;
revoke all on function public.cafe_taller_cuantos(integer, integer) from public, anon, authenticated;

-- Lo que paga un encargo según sus estrellas: [granos, reputación]
create or replace function public.cafe_premio_taller(estrellas integer)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case estrellas when 3 then array[12, 30] when 2 then array[9, 22] else array[6, 15] end;
$$;
revoke all on function public.cafe_premio_taller(integer) from public, anon, authenticated;

-- Las estrellas según cómo quedó cada daño (2, bien; 1, se podía mejorar)
create or replace function public.cafe_estrellas_taller(mimo smallint[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when t.n = 0 then 1 when t.bien = t.n then 3 when t.bien * 2 >= t.n then 2 else 1 end
    from (select count(*) filter (where m = 2) as bien, count(*) as n from unnest(coalesce(mimo, '{}'::smallint[])) m) t;
$$;
revoke all on function public.cafe_estrellas_taller(smallint[]) from public, anon, authenticated;

-- ── El taller de una cuenta en un día ──
-- El encargo pendiente (si no hay y hoy no ha llegado ni se ha terminado ninguno, llega uno nuevo), cuántos van hechos y el
-- terminado ese día. Null sin el café abierto o por debajo del nivel del taller.
create or replace function public.cafe_taller_de(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  e public.cafe_encargos;
  h public.cafe_encargos;
  v_n integer;
  v_k integer;
  v_libro integer;
  v_antes integer;
  v_danos text[];
begin
  select * into l from public.cafe_locales x where x.user_id = uid;
  if l.user_id is null or l.inaugurado is null or l.nivel < public.cafe_taller_nivel() then
    return null;
  end if;
  select * into e from public.cafe_encargos x where x.user_id = uid and x.hecho is null order by x.n limit 1;
  if e.user_id is null
     and not exists (select 1 from public.cafe_encargos x where x.user_id = uid and (x.llega = cafe_taller_de.dia or x.dia_hecho = cafe_taller_de.dia)) then
    select coalesce(max(x.n), 0) + 1 into v_n from public.cafe_encargos x where x.user_id = uid;
    if v_n = 1 then
      insert into public.cafe_encargos (user_id, n, llega, libro, quien, danos)
      values (uid, 1, cafe_taller_de.dia, 0, 0, array['polvo', 'arrugas', 'dorado'])
      on conflict on constraint cafe_encargos_pkey do nothing;
    else
      v_k := public.cafe_taller_cuantos(l.nivel, public.cafe_semilla(uid, cafe_taller_de.dia, 'tk'));
      select array_agg(t.d order by array_position(public.cafe_danos_taller(), t.d)) into v_danos
        from (select d from unnest(public.cafe_danos_taller()) d order by public.cafe_semilla(uid, cafe_taller_de.dia, 'td' || d), d limit v_k) t;
      -- Un libro distinto del anterior
      select x.libro into v_antes from public.cafe_encargos x where x.user_id = uid order by x.n desc limit 1;
      v_libro := public.cafe_semilla(uid, cafe_taller_de.dia, 'tl') % public.cafe_libros_taller();
      if v_libro = v_antes then
        v_libro := (v_libro + 1) % public.cafe_libros_taller();
      end if;
      insert into public.cafe_encargos (user_id, n, llega, libro, quien, danos)
      values (uid, v_n, cafe_taller_de.dia, v_libro, public.cafe_semilla(uid, cafe_taller_de.dia, 'tq') % public.cafe_clientes_taller(), v_danos)
      on conflict on constraint cafe_encargos_pkey do nothing;
    end if;
    select * into e from public.cafe_encargos x where x.user_id = uid and x.hecho is null order by x.n limit 1;
  end if;
  select * into h from public.cafe_encargos x where x.user_id = uid and x.dia_hecho = cafe_taller_de.dia order by x.n desc limit 1;
  return jsonb_build_object(
    'encargo', case when e.user_id is null then null
                    else jsonb_build_object('n', e.n, 'libro', e.libro, 'quien', e.quien, 'danos', to_jsonb(e.danos), 'llega', e.llega) end,
    'hechos', (select count(*) from public.cafe_encargos x where x.user_id = uid and x.hecho is not null),
    'hoy', case when h.user_id is null then null
                else jsonb_build_object('n', h.n, 'libro', h.libro, 'quien', h.quien, 'estrellas', h.estrellas, 'granos', h.granos, 'reputacion', h.reputacion) end);
end;
$$;
revoke all on function public.cafe_taller_de(uuid, date) from public, anon, authenticated;

-- Entrar en el taller (o mirar si hay encargo desde el café): el del día, si toca
create or replace function public.cafe_taller(dia date)
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
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.nivel < public.cafe_taller_nivel() then
    raise exception 'cafe:taller' using errcode = 'P0001';
  end if;
  return public.cafe_taller_de(me, dia);
end;
$$;
revoke all on function public.cafe_taller(date) from public, anon;
grant execute on function public.cafe_taller(date) to authenticated;

-- Terminar un encargo: cómo quedó cada daño, en el orden del encargo. Pone las estrellas, paga y mira si el café sube
create or replace function public.cafe_restaurar(dia date, n integer, mimo smallint[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  e public.cafe_encargos;
  v_estrellas integer;
  premio integer[];
  progreso jsonb;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.nivel < public.cafe_taller_nivel() then
    raise exception 'cafe:taller' using errcode = 'P0001';
  end if;
  select * into e from public.cafe_encargos x where x.user_id = me and x.n = cafe_restaurar.n for update;
  if e.user_id is null or e.hecho is not null then
    raise exception 'cafe:encargo' using errcode = 'P0001';
  end if;
  if mimo is null or cardinality(mimo) <> cardinality(e.danos) or exists (select 1 from unnest(mimo) m where m is null or m not between 1 and 2) then
    raise exception 'cafe:mimo' using errcode = 'P0001';
  end if;
  v_estrellas := public.cafe_estrellas_taller(mimo);
  premio := public.cafe_premio_taller(v_estrellas);
  update public.cafe_locales x
     set granos = least(100000, x.granos + premio[1]), reputacion = least(1000000, x.reputacion + premio[2]), actualizado = now()
   where x.user_id = me;
  update public.cafe_encargos x
     set hecho = now(), dia_hecho = cafe_restaurar.dia, estrellas = v_estrellas, mimo = cafe_restaurar.mimo, granos = premio[1], reputacion = premio[2]
   where x.user_id = me and x.n = cafe_restaurar.n;
  progreso := public.cafe_progreso(me, cafe_restaurar.dia);
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, cafe_restaurar.dia), 'libros', public.cafe_libros_json(me),
    'taller', public.cafe_taller_de(me, cafe_restaurar.dia),
    'dado', jsonb_build_object('granos', premio[1], 'reputacion', premio[2], 'estrellas', v_estrellas, 'mimo', to_jsonb(cafe_restaurar.mimo)),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_restaurar(date, integer, smallint[]) from public, anon;
grant execute on function public.cafe_restaurar(date, integer, smallint[]) to authenticated;
