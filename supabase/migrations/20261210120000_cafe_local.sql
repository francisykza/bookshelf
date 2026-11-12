-- 1.120 (§120) · El café-librería del bajo, bloque 2: el local y Decorar (plan en docs/qa/cafe-libreria.md, aprobado por
-- Francisco el 11-11-2026). Pilar te deja las llaves: eliges el nombre del café de una lista cerrada (sin texto libre) y
-- recibes, gratis, los muebles del rincón (nivel 1). El local se decora en una cuadrícula de 6 × 6 casillas delante de la
-- cortina, con muebles del café (se compran con granos, la moneda propia del café, que llega en el bloque 3) y con
-- muebles de tu casa: una copia no está en dos sitios, así que lo que pones en el café cuenta como usado también para el
-- piso (por eso se redefine piso_falta_copia). Nada de esto toca tickets, sobres, pity ni el inventario existente.
-- Todo el acceso, por funciones `security definer` y `volatile` (nunca `stable`: PostgREST las ejecutaría en solo
-- lectura); las tablas, con RLS y sin permisos directos. Re-ejecutable.

create table if not exists public.cafe_catalogo (
  id     text primary key check (id ~ '^cafe-[a-z-]{2,30}$'),
  w      smallint not null check (w between 1 and 3),
  d      smallint not null check (d between 1 and 3),
  precio integer not null check (precio between 1 and 1000),
  nivel  smallint not null check (nivel between 1 and 5)
);
alter table public.cafe_catalogo enable row level security;
revoke all on table public.cafe_catalogo from anon, authenticated;
-- La misma lista que CAFE_MUEBLES en src/features/edificio/cafe/cafeCatalogo.js (una prueba lo comprueba)
insert into public.cafe_catalogo (id, w, d, precio, nivel) values
  ('cafe-mesa', 1, 1, 40, 1),
  ('cafe-silla', 1, 1, 30, 1),
  ('cafe-taburete', 1, 1, 25, 1),
  ('cafe-estanteria', 2, 1, 80, 1),
  ('cafe-lampara', 1, 1, 60, 1)
on conflict (id) do update set w = excluded.w, d = excluded.d, precio = excluded.precio, nivel = excluded.nivel;

-- Los nombres que se pueden poner al café (los ven tus amigos): la misma lista que CAFE_NOMBRES en cafeCatalogo.js
create or replace function public.cafe_nombres()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['La Última Página', 'El Marcapáginas', 'Café del Muelle', 'Taza y Lomo', 'El Rincón del Faro', 'Tinta y Canela',
               'La Biblioteca de Pilar', 'Capítulo Uno', 'El Farolillo', 'Las Tres Tazas', 'Hojas de Té', 'La Buena Pluma'];
$$;
revoke all on function public.cafe_nombres() from public, anon, authenticated;

-- Los muebles del rincón que se reciben al inaugurar y dónde van (el mismo plano que PLANO_INICIAL en cafeCatalogo.js)
create or replace function public.cafe_plano_inicial()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"v":1,"items":[
    {"uid":"i1","id":"cafe-estanteria","x":1,"y":0,"rot":0},
    {"uid":"i2","id":"cafe-mesa","x":1,"y":2,"rot":0},
    {"uid":"i3","id":"cafe-silla","x":0,"y":2,"rot":3},
    {"uid":"i4","id":"cafe-silla","x":2,"y":2,"rot":1},
    {"uid":"i5","id":"cafe-mesa","x":3,"y":4,"rot":0},
    {"uid":"i6","id":"cafe-silla","x":3,"y":3,"rot":0},
    {"uid":"i7","id":"cafe-silla","x":3,"y":5,"rot":2},
    {"uid":"i8","id":"cafe-taburete","x":5,"y":0,"rot":1},
    {"uid":"i9","id":"cafe-taburete","x":5,"y":2,"rot":1},
    {"uid":"i10","id":"cafe-lampara","x":0,"y":4,"rot":0}]}'::jsonb;
$$;
revoke all on function public.cafe_plano_inicial() from public, anon, authenticated;

create table if not exists public.cafe_locales (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  nombre      text,
  nivel       smallint not null default 1 check (nivel between 1 and 5),
  reputacion  integer not null default 0 check (reputacion between 0 and 1000000),
  granos      integer not null default 0 check (granos between 0 and 100000),
  plano       jsonb not null default '{"v":1,"items":[]}'::jsonb check (jsonb_typeof(plano) = 'object'),
  inaugurado  timestamptz,
  actualizado timestamptz not null default now()
);
alter table public.cafe_locales enable row level security;
revoke all on table public.cafe_locales from anon, authenticated;

create table if not exists public.cafe_inventario (
  user_id uuid not null references auth.users (id) on delete cascade,
  mueble  text not null references public.cafe_catalogo (id),
  copias  integer not null default 0 check (copias between 0 and 99),
  primary key (user_id, mueble)
);
alter table public.cafe_inventario enable row level security;
revoke all on table public.cafe_inventario from anon, authenticated;

-- Los muebles de casa que pueden ir al café: del catálogo del piso, de suelo, sin saga, sin místicos ni retirados, y no
-- los esenciales del piso (sillón, estantería, escritorio y tablón tienen su copia gratis y se quedan en casa). En plpgsql
-- para que piso_retirado se busque al llamarla (las pruebas sin la reforma la definen después).
create or replace function public.cafe_de_casa(mueble text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.piso_catalogo k
     where k.id = mueble and k.capa = 'suelo' and k.saga is null
       and k.rareza in ('comun', 'poco-comun', 'raro', 'especial')
       and k.id not in ('sillon', 'estanteria', 'escritorio', 'tablon', 'ventana', 'ordenador', 'puerta-piso')
       and not public.piso_retirado(k.id));
end;
$$;
revoke all on function public.cafe_de_casa(text) from public, anon, authenticated;

-- Un plano bien hecho: hasta 24 cosas con uid propio, cada una del catálogo del café o de casa, entera dentro de la
-- cuadrícula de 6 × 6, girada a cuartos de vuelta y sin solaparse con otra.
create or replace function public.cafe_plano_valido(plano jsonb)
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
  celdas boolean[] := array_fill(false, array[36]);
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
    if (e ->> 'x') !~ '^[0-9]$' or (e ->> 'y') !~ '^[0-9]$' or (e ->> 'rot') !~ '^[0-3]$' then
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
    if x + w > 6 or y + d > 6 then
      return false;
    end if;
    for i in x .. x + w - 1 loop
      for j in y .. y + d - 1 loop
        if celdas[j * 6 + i + 1] then
          return false;
        end if;
        celdas[j * 6 + i + 1] := true;
      end loop;
    end loop;
    w := null;
    d := null;
  end loop;
  return true;
end;
$$;
revoke all on function public.cafe_plano_valido(jsonb) from public, anon, authenticated;

-- Cómo ve su café quien lo tiene. Solo para las funciones de abajo.
create or replace function public.cafe_json(uid uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nombre', l.nombre, 'nivel', l.nivel, 'reputacion', l.reputacion, 'granos', l.granos, 'plano', l.plano,
    'inaugurado', l.inaugurado is not null,
    'inventario', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.cafe_inventario v where v.user_id = uid and v.copias > 0), '{}'::jsonb))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_json(uuid) from public, anon, authenticated;

-- Mi café (la primera vez lo crea, aún en traspaso)
create or replace function public.cafe_mio()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  insert into public.cafe_locales (user_id) values (me) on conflict (user_id) do nothing;
  return public.cafe_json(me);
end;
$$;
revoke all on function public.cafe_mio() from public, anon;
grant execute on function public.cafe_mio() to authenticated;

-- Pilar te da las llaves: el nombre, de la lista cerrada, y los muebles del rincón gratis, ya colocados. Una sola vez.
create or replace function public.cafe_inaugurar(nombre text)
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
  if nombre is null or not (nombre = any (public.cafe_nombres())) then
    raise exception 'cafe:nombre' using errcode = 'P0001';
  end if;
  insert into public.cafe_locales (user_id) values (me) on conflict (user_id) do nothing;
  select * into l from public.cafe_locales where user_id = me for update;
  if l.inaugurado is not null then
    raise exception 'cafe:ya' using errcode = 'P0001';
  end if;
  insert into public.cafe_inventario (user_id, mueble, copias)
  select me, x.id, count(*)::integer from jsonb_array_elements(public.cafe_plano_inicial() -> 'items') e, lateral (select e ->> 'id' as id) x group by x.id
  on conflict (user_id, mueble) do update set copias = greatest(public.cafe_inventario.copias, excluded.copias);
  update public.cafe_locales
     set nombre = cafe_inaugurar.nombre, inaugurado = now(), plano = public.cafe_plano_inicial(), actualizado = now()
   where user_id = me;
  return public.cafe_json(me);
end;
$$;
revoke all on function public.cafe_inaugurar(text) from public, anon;
grant execute on function public.cafe_inaugurar(text) to authenticated;

-- El primer mueble de casa que falta para un plano del café junto con el piso (`layout`): cada copia, en un solo sitio.
create or replace function public.cafe_falta_de_casa(uid uuid, plano jsonb, layout jsonb)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  with cafe as (
    select e ->> 'id' as id, count(*)::integer as n
      from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e
     where not exists (select 1 from public.cafe_catalogo c where c.id = e ->> 'id')
     group by 1
  ), piso as (
    select e ->> 'id' as id, count(*)::integer as n
      from jsonb_array_elements(case when jsonb_typeof(layout -> 'items') = 'array' then layout -> 'items' else '[]'::jsonb end) e
     group by 1
  )
  select c.id from cafe c
    left join piso p on p.id = c.id
    left join public.piso_inventario v on v.user_id = uid and v.mueble = c.id
   where c.n + coalesce(p.n, 0) > coalesce(v.copias, 0)
   order by c.id
   limit 1;
$$;
revoke all on function public.cafe_falta_de_casa(uuid, jsonb, jsonb) from public, anon, authenticated;

-- Guardar lo decorado: un plano válido, solo con muebles del café que tienes y con copias libres de casa.
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
  if not public.cafe_plano_valido(plano) then
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

-- Comprar un mueble del café con granos: precio y nivel del servidor, nunca por debajo de cero.
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
  if c.id is null or c.nivel > l.nivel then
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

-- El piso también cuenta lo que está en el café: la misma función de la 1.95 (tablón), con los muebles de casa del café
-- sumados como copias lisas. Así no se puede tener la misma copia en el piso y en el café.
create or replace function public.piso_falta_copia(uid uuid, layout jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with todos as (
    select e from jsonb_array_elements(case when jsonb_typeof(layout -> 'items') = 'array' then layout -> 'items' else '[]'::jsonb end) e
    union all
    select jsonb_build_object('id', e ->> 'id')
      from public.cafe_locales l, jsonb_array_elements(case when jsonb_typeof(l.plano -> 'items') = 'array' then l.plano -> 'items' else '[]'::jsonb end) e
     where l.user_id = uid and not exists (select 1 from public.cafe_catalogo c where c.id = e ->> 'id')
  ), puestos as (
    select e ->> 'id' as id, e ->> 'acabado' as acabado, count(*)::integer as n
    from todos
    group by 1, 2
  )
  select x.id from (
    select p.id
    from (select id, sum(n) as n from puestos group by id) p
    join public.piso_catalogo k on k.id = p.id and k.saga is null
    left join public.piso_inventario v on v.user_id = uid and v.mueble = p.id
    where p.n > case when p.id in ('sillon', 'estanteria', 'escritorio', 'tablon') then greatest(coalesce(v.copias, 0), coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0) + 1) else coalesce(v.copias, 0) end
    union all
    select p.id
    from puestos p
    left join public.piso_acabados a on a.user_id = uid and a.mueble = p.id and a.acabado = p.acabado
    where p.acabado is not null and p.n > coalesce(a.copias, 0)
    union all
    select p.id
    from puestos p
    join public.piso_catalogo k on k.id = p.id and k.saga is null
    left join public.piso_inventario v on v.user_id = uid and v.mueble = p.id
    where p.acabado is null
      and p.n > case when p.id in ('sillon', 'estanteria', 'escritorio', 'tablon') then greatest(coalesce(v.copias, 0) - coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0), 1) else coalesce(v.copias, 0) - coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0) end
  ) x
  order by x.id
  limit 1;
$$;
revoke all on function public.piso_falta_copia(uuid, jsonb) from public, anon, authenticated;
