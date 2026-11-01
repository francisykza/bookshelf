-- 1.63 (SPEC §63), aplicada en producción el 1-11-2026: «El edificio del puerto». Cada persona con la comunidad activada tiene un
-- piso (una habitación que decora con muebles de un catálogo) en un edificio de seis pisos; puede visitar los pisos de
-- sus vecinos y dejarles un sello de frase cerrada. Migración ADITIVA y re-ejecutable: no toca tablas ni datos
-- existentes. La aplica Francisco en el SQL Editor (desarrollo primero). Probada con PGlite
-- (src/features/edificio/__tests__/edificio.rls.test.js).
--
-- Decisiones de Francisco: reparto en edificios al azar (solo perfiles con la comunidad activada, se llenan primero los
-- edificios con hueco, puerta al azar, lo decide el servidor); catálogo gratis (no toca recompensas, cajas ni pity);
-- sin texto libre (solo sellos de una lista cerrada); visitas en diferido.

-- ── Catálogo de muebles: la copia del servidor de src/features/edificio/catalog.js (una prueba comprueba que coinciden) ──
create table if not exists public.piso_catalogo (
  id    text primary key check (id ~ '^[a-z-]{2,40}$'),
  capa  text not null check (capa in ('alfombra', 'suelo', 'encima', 'pared')),
  w     smallint not null check (w between 1 and 9),
  d     smallint check (d between 1 and 9),
  sup   real check (sup > 0),
  tonos smallint not null check (tonos between 1 and 8),
  check ((capa = 'pared') = (d is null))
);
insert into public.piso_catalogo (id, capa, w, d, sup, tonos) values
  ('sillon', 'suelo', 2, 2, null, 5),
  ('sofa', 'suelo', 3, 2, null, 4),
  ('silla', 'suelo', 1, 1, null, 3),
  ('banco', 'suelo', 2, 1, 0.7, 3),
  ('mesa-baja', 'suelo', 2, 1, 0.7, 3),
  ('mesa', 'suelo', 2, 2, 1.25, 3),
  ('mesilla', 'suelo', 1, 1, 0.9, 3),
  ('estanteria', 'suelo', 2, 1, 3.4, 3),
  ('cama', 'suelo', 3, 4, null, 4),
  ('lampara-pie', 'suelo', 1, 1, null, 3),
  ('estufa', 'suelo', 1, 1, null, 3),
  ('lampara-mesa', 'encima', 1, 1, null, 3),
  ('planta-grande', 'suelo', 1, 1, null, 3),
  ('planta-pequena', 'encima', 1, 1, null, 3),
  ('libros', 'encima', 1, 1, null, 3),
  ('radio', 'encima', 1, 1, null, 3),
  ('tetera', 'encima', 1, 1, null, 3),
  ('gato', 'suelo', 1, 1, null, 3),
  ('ventana', 'pared', 2, null, null, 3),
  ('cuadro', 'pared', 2, null, null, 3),
  ('reloj', 'pared', 1, null, null, 3),
  ('guirnalda', 'pared', 3, null, null, 3),
  ('alfombra', 'alfombra', 3, 2, null, 3),
  ('alfombra-redonda', 'alfombra', 3, 3, null, 3)
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos;
alter table public.piso_catalogo enable row level security;
revoke all on public.piso_catalogo from anon, authenticated;

-- ¿Es `v` un entero JSON pequeño (sin decimales)?
create or replace function public.piso_entero(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v is not null and jsonb_typeof(v) = 'number' and (v #>> '{}') ~ '^-?[0-9]{1,4}$';
$$;
revoke all on function public.piso_entero(jsonb) from public, anon, authenticated;

-- ¿Es válido un piso? Las mismas reglas que `validateRoom` en el cliente (src/features/edificio/room.js): versión 1,
-- pared y suelo de la lista, como mucho 40 cosas, solo campos conocidos, uids únicos, muebles del catálogo con un tono
-- que existe, todo dentro de la cuadrícula de 9 × 9, sin solapes dentro de cada capa (la pared, por pared), y lo de
-- la capa «encima» sobre un mueble con superficie. Una prueba compara las dos validaciones con pisos al azar.
create or replace function public.piso_valido(layout jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  items jsonb;
  it jsonb;
  c record;
  n integer;
  i integer;
  j integer;
  w integer;
  d integer;
  x integer;
  y integer;
  rot integer;
  uids integer[] := '{}';
  capas text[] := '{}';
  paredes text[] := '{}';
  x0 integer[] := '{}';
  y0 integer[] := '{}';
  x1 integer[] := '{}';
  y1 integer[] := '{}';
  sups real[] := '{}';
  apoyado boolean;
begin
  if layout is null or jsonb_typeof(layout) <> 'object' then
    return false;
  end if;
  if exists (select 1 from jsonb_object_keys(layout) k where k not in ('v', 'pared', 'suelo', 'items')) then
    return false;
  end if;
  if not public.piso_entero(layout -> 'v') or (layout ->> 'v')::integer <> 1 then
    return false;
  end if;
  if coalesce(layout ->> 'pared', '') not in ('yeso', 'salvia', 'rosa', 'noche') or coalesce(layout ->> 'suelo', '') not in ('tablas', 'damero', 'barro') then
    return false;
  end if;
  items := layout -> 'items';
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 40 then
    return false;
  end if;
  n := jsonb_array_length(items);
  for i in 0 .. n - 1 loop
    it := items -> i;
    if jsonb_typeof(it) <> 'object' or jsonb_typeof(it -> 'id') is distinct from 'string' then
      return false;
    end if;
    if not public.piso_entero(it -> 'uid') or (it ->> 'uid')::integer < 1 or (it ->> 'uid')::integer = any (uids) then
      return false;
    end if;
    uids := uids || (it ->> 'uid')::integer;
    select * into c from public.piso_catalogo k where k.id = it ->> 'id';
    if not found then
      return false;
    end if;
    if not public.piso_entero(it -> 'tono') or (it ->> 'tono')::integer < 0 or (it ->> 'tono')::integer >= c.tonos then
      return false;
    end if;
    if c.capa = 'pared' then
      if exists (select 1 from jsonb_object_keys(it) k where k not in ('uid', 'id', 'pared', 'a', 'tono')) then
        return false;
      end if;
      if coalesce(it ->> 'pared', '') not in ('fondo', 'izq') or not public.piso_entero(it -> 'a') then
        return false;
      end if;
      x := (it ->> 'a')::integer;
      if x < 0 or x + c.w > 9 then
        return false;
      end if;
      capas := capas || 'pared'::text;
      paredes := paredes || (it ->> 'pared');
      x0 := x0 || x;
      x1 := x1 || (x + c.w);
      y0 := y0 || 0;
      y1 := y1 || 1;
      sups := sups || 0::real;
    else
      if exists (select 1 from jsonb_object_keys(it) k where k not in ('uid', 'id', 'x', 'y', 'rot', 'tono')) then
        return false;
      end if;
      if not (public.piso_entero(it -> 'x') and public.piso_entero(it -> 'y') and public.piso_entero(it -> 'rot')) then
        return false;
      end if;
      rot := (it ->> 'rot')::integer;
      if rot < 0 or rot > 3 then
        return false;
      end if;
      if rot % 2 = 1 then
        w := c.d;
        d := c.w;
      else
        w := c.w;
        d := c.d;
      end if;
      x := (it ->> 'x')::integer;
      y := (it ->> 'y')::integer;
      if x < 0 or y < 0 or x + w > 9 or y + d > 9 then
        return false;
      end if;
      capas := capas || c.capa;
      paredes := paredes || ''::text;
      x0 := x0 || x;
      x1 := x1 || (x + w);
      y0 := y0 || y;
      y1 := y1 || (y + d);
      sups := sups || coalesce(c.sup, 0)::real;
    end if;
  end loop;
  for i in 1 .. n loop
    for j in i + 1 .. n loop
      if capas[i] = capas[j] and paredes[i] = paredes[j] and x0[i] < x1[j] and x0[j] < x1[i] and y0[i] < y1[j] and y0[j] < y1[i] then
        return false;
      end if;
    end loop;
    if capas[i] = 'encima' then
      apoyado := false;
      for j in 1 .. n loop
        if capas[j] = 'suelo' and sups[j] > 0 and x0[i] >= x0[j] and x1[i] <= x1[j] and y0[i] >= y0[j] and y1[i] <= y1[j] then
          apoyado := true;
        end if;
      end loop;
      if not apoyado then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.piso_valido(jsonb) from public, anon, authenticated;

-- ── Edificios y quién vive en cada puerta (solo se tocan a través de las funciones de abajo) ─────────────────
create table if not exists public.edificios (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.edificio_vecinos (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  edificio   uuid not null references public.edificios (id) on delete cascade,
  puerta     text not null check (puerta in ('1A', '1B', '2A', '2B', '3A', '3B')),
  created_at timestamptz not null default now(),
  unique (edificio, puerta)
);
create index if not exists edificio_vecinos_edificio on public.edificio_vecinos (edificio);
alter table public.edificios enable row level security;
alter table public.edificio_vecinos enable row level security;
revoke all on public.edificios from anon, authenticated;
revoke all on public.edificio_vecinos from anon, authenticated;

-- ¿Vive `other` en mi edificio? (definer: lo consultan las políticas sin exponer la tabla de vecinos)
create or replace function public.mismo_edificio(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.edificio_vecinos a join public.edificio_vecinos b on a.edificio = b.edificio
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
revoke all on function public.mismo_edificio(uuid) from public, anon;
grant execute on function public.mismo_edificio(uuid) to authenticated;

-- Mi puerta en el edificio. Si aún no tengo, el servidor me reparte al azar: un edificio con hueco (o uno nuevo si
-- todos están llenos) y una puerta libre. Devuelve { edificio, puerta }.
create or replace function public.asignar_edificio()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ed uuid;
  door text;
begin
  if me is null then
    raise exception 'Inicia sesión para tener piso en el edificio.';
  end if;
  if not public.community_member(me) then
    raise exception 'Activa la comunidad para tener piso en el edificio.' using errcode = 'P0001';
  end if;
  -- Un reparto cada vez (dos altas a la vez no se quedan con la misma puerta)
  perform pg_advisory_xact_lock(hashtext('edificio_puerto_reparto'));
  select v.edificio, v.puerta into ed, door from public.edificio_vecinos v where v.user_id = me;
  if found then
    return jsonb_build_object('edificio', ed, 'puerta', door);
  end if;
  select e.id into ed from public.edificios e
    where (select count(*) from public.edificio_vecinos v where v.edificio = e.id) < 6
    order by random() limit 1;
  if ed is null then
    insert into public.edificios default values returning id into ed;
  end if;
  select p into door from unnest(array['1A', '1B', '2A', '2B', '3A', '3B']) p
    where p not in (select v.puerta from public.edificio_vecinos v where v.edificio = ed)
    order by random() limit 1;
  insert into public.edificio_vecinos (user_id, edificio, puerta) values (me, ed, door);
  return jsonb_build_object('edificio', ed, 'puerta', door);
end;
$$;
revoke all on function public.asignar_edificio() from public, anon;
grant execute on function public.asignar_edificio() to authenticated;

-- ── Pisos ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pisos (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  layout     jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.pisos_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Un piso no cambia de dueño.';
  end if;
  if not public.piso_valido(new.layout) then
    raise exception 'Ese piso no es válido: solo muebles del catálogo, dentro del piso y sin solaparse.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.pisos_validate() from public, anon, authenticated;
drop trigger if exists pisos_validate on public.pisos;
create trigger pisos_validate before insert or update on public.pisos for each row execute function public.pisos_validate();
drop trigger if exists pisos_rate on public.pisos;
create trigger pisos_rate before insert or update on public.pisos for each row execute function public.enforce_rate_limit('30');

alter table public.pisos enable row level security;
revoke all on public.pisos from anon;
grant select, insert, update on public.pisos to authenticated;
drop policy if exists "ver pisos del edificio" on public.pisos;
create policy "ver pisos del edificio" on public.pisos for select to authenticated
  using (user_id = (select auth.uid()) or (public.mismo_edificio(user_id) and public.community_member(user_id) and not public.is_blocked_pair(user_id)));
drop policy if exists "crear mi piso" on public.pisos;
create policy "crear mi piso" on public.pisos for insert to authenticated
  with check (user_id = (select auth.uid()) and public.community_member((select auth.uid())));
drop policy if exists "editar mi piso" on public.pisos;
create policy "editar mi piso" on public.pisos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Sellos en el buzón: una frase cerrada por pareja (se puede cambiar o quitar), solo entre vecinos ──────────
create table if not exists public.piso_sellos (
  de         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  para       uuid not null references auth.users (id) on delete cascade,
  sello      text not null check (sello in ('acogedor', 'estanteria', 'plantas', 'luz')),
  updated_at timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);
create index if not exists piso_sellos_para on public.piso_sellos (para);
drop trigger if exists piso_sellos_touch on public.piso_sellos;
create trigger piso_sellos_touch before update on public.piso_sellos for each row execute function public.touch_updated_at();
drop trigger if exists piso_sellos_rate on public.piso_sellos;
create trigger piso_sellos_rate before insert or update on public.piso_sellos for each row execute function public.enforce_rate_limit('20');

alter table public.piso_sellos enable row level security;
revoke all on public.piso_sellos from anon;
grant select, insert, update, delete on public.piso_sellos to authenticated;
drop policy if exists "ver mis sellos" on public.piso_sellos;
create policy "ver mis sellos" on public.piso_sellos for select to authenticated
  using (de = (select auth.uid()) or para = (select auth.uid()));
drop policy if exists "dejar un sello" on public.piso_sellos;
create policy "dejar un sello" on public.piso_sellos for insert to authenticated
  with check (de = (select auth.uid()) and public.mismo_edificio(para) and public.community_member(para) and public.community_member((select auth.uid())) and not public.is_blocked_pair(para));
drop policy if exists "cambiar mi sello" on public.piso_sellos;
create policy "cambiar mi sello" on public.piso_sellos for update to authenticated
  using (de = (select auth.uid()))
  with check (de = (select auth.uid()) and public.mismo_edificio(para) and public.community_member(para) and not public.is_blocked_pair(para));
drop policy if exists "quitar mi sello" on public.piso_sellos;
create policy "quitar mi sello" on public.piso_sellos for delete to authenticated using (de = (select auth.uid()));

-- ── El portal: mis vecinos (alias, avatar, puerta, su piso y los sellos entre nosotros) en una sola consulta ──
-- Quien desactiva la comunidad o está bloqueado (en cualquier sentido) no aparece; yo siempre aparezco.
create or replace function public.edificio_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ed uuid;
  door text;
  rows jsonb;
begin
  if me is null then
    return null;
  end if;
  select v.edificio, v.puerta into ed, door from public.edificio_vecinos v where v.user_id = me;
  if ed is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', v.user_id,
      'puerta', v.puerta,
      'alias', p.alias,
      'avatar_id', p.avatar_id,
      'yo', v.user_id = me,
      'layout', s.layout,
      'sello_dado', (select x.sello from public.piso_sellos x where x.de = me and x.para = v.user_id),
      'sello_recibido', (select x.sello from public.piso_sellos x where x.de = v.user_id and x.para = me)
    ) order by v.puerta desc), '[]'::jsonb)
    into rows
    from public.edificio_vecinos v
    left join public.profiles p on p.user_id = v.user_id
    left join public.pisos s on s.user_id = v.user_id
    where v.edificio = ed
      and (v.user_id = me or (coalesce(p.community_enabled, false) and not public.is_blocked_pair(v.user_id)));
  return jsonb_build_object('edificio', ed, 'puerta', door, 'vecinos', rows);
end;
$$;
revoke all on function public.edificio_portal() from public, anon;
grant execute on function public.edificio_portal() to authenticated;
