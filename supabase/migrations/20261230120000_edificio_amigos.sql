-- Libotown · 1.151 (docs/qa/amigos-vecinos.md, bloque 1): el edificio de tus amigos. Encargo de Francisco del 26-11-2026: «Cada
-- edificio debería tener como vecinos únicamente a tus amigos, y que cada grupo de amigos tenga como su propia comunidad de
-- vecinos». Sustituye al reparto al azar de la 1.63 (`asignar_edificio`):
--
-- - Cada cuenta nueva estrena su propio edificio.
-- - Para vivir con amigos, un vecino da una llave (`edificio_dar_llave`: un código de 8 letras, de un solo uso, que caduca a
--   los 7 días; como mucho 3 vivas por persona) y quien la recibe decide mudarse (`edificio_mudarse`). Su piso y sus muebles van
--   con él: los pisos son de cada cuenta, no del edificio.
-- - Irse del edificio (`edificio_irse`) devuelve a uno propio.
-- - Una vez, al aplicarla: en cada edificio, cada grupo de amigos (os seguís los dos) es su propia comunidad. Se queda el grupo
--   más grande (a igualdad, el de quien llegó antes); cada uno de los demás grupos se muda junto a un edificio nuevo, y quien
--   no tiene ningún amigo dentro, a uno propio. Con la misma puerta. No se borra nada.
--
-- Aditiva y se puede volver a ejecutar (el reparto de una vez se apunta en `edificio_reparto_amigos`). Las puertas siguen
-- siendo seis; crecer por plantas es el bloque 2.

-- ── Las llaves ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.edificio_llaves (
  codigo     text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  edificio   uuid not null references public.edificios (id) on delete cascade,
  de         uuid not null references auth.users (id) on delete cascade,
  creada     timestamptz not null default now(),
  caduca     timestamptz not null default now() + interval '7 days',
  usada_por  uuid references auth.users (id) on delete set null,
  usada      timestamptz,
  retirada   boolean not null default false
);
create index if not exists edificio_llaves_de on public.edificio_llaves (de);
alter table public.edificio_llaves enable row level security;
revoke all on public.edificio_llaves from anon, authenticated;

-- Las llaves que aún abren algo
create or replace function public.edificio_llave_viva(l public.edificio_llaves)
returns boolean
language sql
stable
set search_path = ''
as $$
  select l.usada is null and not l.retirada and l.caduca > now();
$$;
revoke all on function public.edificio_llave_viva(public.edificio_llaves) from public, anon, authenticated;

-- ¿Hay un bloqueo entre estas dos cuentas, en cualquier sentido? (sin auth.uid(): lo usan las funciones de abajo)
create or replace function public.edificio_bloqueo_entre(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.blocks x where (x.blocker = a and x.blocked = b) or (x.blocker = b and x.blocked = a));
$$;
revoke all on function public.edificio_bloqueo_entre(uuid, uuid) from public, anon, authenticated;

-- ¿Son amigos? Os seguís los dos, los dos con la comunidad y sin bloqueo (como `piso_casino_amigo`, para dos cuentas cualesquiera)
create or replace function public.edificio_amigos_entre(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and a <> b
    and public.community_member(a) and public.community_member(b)
    and not public.edificio_bloqueo_entre(a, b)
    and exists (select 1 from public.follows f where f.follower = a and f.followed = b)
    and exists (select 1 from public.follows f where f.follower = b and f.followed = a);
$$;
revoke all on function public.edificio_amigos_entre(uuid, uuid) from public, anon, authenticated;

-- Una puerta libre de un edificio, al azar (null si está lleno)
create or replace function public.edificio_puerta_libre(ed uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select p from unnest(array['1A', '1B', '2A', '2B', '3A', '3B']) p
    where p not in (select v.puerta from public.edificio_vecinos v where v.edificio = ed)
    order by random() limit 1;
$$;
revoke all on function public.edificio_puerta_libre(uuid) from public, anon, authenticated;

-- Un edificio que se queda vacío se quita (con sus llaves); los pisos son de cada cuenta y no se tocan
create or replace function public.edificio_si_vacio(ed uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.edificios e where e.id = ed and not exists (select 1 from public.edificio_vecinos v where v.edificio = ed);
$$;
revoke all on function public.edificio_si_vacio(uuid) from public, anon, authenticated;

-- ── Mi puerta: si aún no tengo, mi propio edificio ─────────────────────────────────────────────────────────────────────────
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
  perform pg_advisory_xact_lock(hashtext('edificio_puerto_reparto'));
  select v.edificio, v.puerta into ed, door from public.edificio_vecinos v where v.user_id = me;
  if found then
    return jsonb_build_object('edificio', ed, 'puerta', door);
  end if;
  insert into public.edificios default values returning id into ed;
  door := public.edificio_puerta_libre(ed);
  insert into public.edificio_vecinos (user_id, edificio, puerta) values (me, ed, door);
  return jsonb_build_object('edificio', ed, 'puerta', door);
end;
$$;
revoke all on function public.asignar_edificio() from public, anon;
grant execute on function public.asignar_edificio() to authenticated;

-- ── Dar una llave de mi edificio ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.edificio_dar_llave()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ed uuid;
  alfa constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  cod text;
  l public.edificio_llaves;
begin
  if me is null or not public.community_member(me) then
    raise exception 'Activa la comunidad para dar llaves.' using errcode = 'P0001';
  end if;
  select v.edificio into ed from public.edificio_vecinos v where v.user_id = me;
  if ed is null then
    raise exception 'Aún no tienes piso en el edificio.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.edificio_llaves x where x.de = me and public.edificio_llave_viva(x)) >= 3 then
    raise exception 'Ya tienes tres llaves sin usar: retira una para dar otra.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.edificio_llaves x where x.de = me and x.creada > now() - interval '1 day') >= 10 then
    raise exception 'Has dado muchas llaves hoy. Prueba mañana.' using errcode = 'P0001';
  end if;
  loop
    b := uuid_send(gen_random_uuid());
    cod := '';
    for i in 0..7 loop
      cod := cod || substr(alfa, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.edificio_llaves x where x.codigo = cod);
  end loop;
  insert into public.edificio_llaves (codigo, edificio, de) values (cod, ed, me) returning * into l;
  return jsonb_build_object('codigo', l.codigo, 'caduca', l.caduca);
end;
$$;
revoke all on function public.edificio_dar_llave() from public, anon;
grant execute on function public.edificio_dar_llave() to authenticated;

-- Mis llaves sin usar (para enseñarlas otra vez o retirarlas)
create or replace function public.edificio_mis_llaves()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'caduca', x.caduca) order by x.creada desc), '[]'::jsonb)
    from public.edificio_llaves x
    join public.edificio_vecinos v on v.user_id = x.de and v.edificio = x.edificio
    where x.de = auth.uid() and public.edificio_llave_viva(x);
$$;
revoke all on function public.edificio_mis_llaves() from public, anon;
grant execute on function public.edificio_mis_llaves() to authenticated;

create or replace function public.edificio_retirar_llave(cod text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  update public.edificio_llaves x set retirada = true where x.codigo = upper(cod) and x.de = auth.uid() and x.usada is null
    returning true;
$$;
revoke all on function public.edificio_retirar_llave(text) from public, anon;
grant execute on function public.edificio_retirar_llave(text) to authenticated;

-- Normaliza lo que se escribe: mayúsculas y sin espacios ni guiones (las llaves no usan I, O, 0 ni 1, que se confunden)
create or replace function public.edificio_codigo(cod text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(cod, ''), '[^A-Za-z0-9]', '', 'g'));
$$;
revoke all on function public.edificio_codigo(text) from public, anon, authenticated;

-- ── Mirar una llave antes de usarla: de quién es y cuántos vecinos hay (o por qué ya no sirve) ─────────────────────────────
create or replace function public.edificio_ver_llave(cod text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  l public.edificio_llaves;
  mio uuid;
  n int;
begin
  if me is null then
    return jsonb_build_object('motivo', 'sesion');
  end if;
  select * into l from public.edificio_llaves x where x.codigo = public.edificio_codigo(cod);
  if not found or not public.edificio_llave_viva(l)
     or not exists (select 1 from public.edificio_vecinos v where v.user_id = l.de and v.edificio = l.edificio) then
    return jsonb_build_object('motivo', 'no_sirve');
  end if;
  if public.edificio_bloqueo_entre(me, l.de) then
    return jsonb_build_object('motivo', 'no_sirve');
  end if;
  select v.edificio into mio from public.edificio_vecinos v where v.user_id = me;
  select count(*) into n from public.edificio_vecinos v where v.edificio = l.edificio;
  return jsonb_build_object(
    'motivo', case
      when not public.community_member(me) then 'comunidad'
      when mio = l.edificio then 'ya_vives'
      when l.de = me then 'tuya'
      when n >= 6 then 'lleno'
      else null end,
    'de', (select jsonb_build_object('alias', p.alias, 'avatar_id', p.avatar_id) from public.profiles p where p.user_id = l.de),
    'vecinos', n,
    'caduca', l.caduca
  );
end;
$$;
revoke all on function public.edificio_ver_llave(text) from public, anon;
grant execute on function public.edificio_ver_llave(text) to authenticated;

-- ── Mudarse con una llave ──────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.edificio_mudarse(cod text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  l public.edificio_llaves;
  antes uuid;
  door text;
begin
  if me is null or not public.community_member(me) then
    raise exception 'Activa la comunidad para mudarte.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('edificio_puerto_reparto'));
  select * into l from public.edificio_llaves x where x.codigo = public.edificio_codigo(cod) for update;
  if not found or not public.edificio_llave_viva(l) or l.de = me
     or not exists (select 1 from public.edificio_vecinos v where v.user_id = l.de and v.edificio = l.edificio) then
    raise exception 'Esta llave ya no abre ninguna puerta.' using errcode = 'P0001';
  end if;
  -- Nadie entra en un edificio donde vive alguien con quien hay un bloqueo (en cualquier sentido)
  if exists (select 1 from public.edificio_vecinos v where v.edificio = l.edificio and public.edificio_bloqueo_entre(me, v.user_id)) then
    raise exception 'Esta llave ya no abre ninguna puerta.' using errcode = 'P0001';
  end if;
  select v.edificio into antes from public.edificio_vecinos v where v.user_id = me;
  if antes = l.edificio then
    raise exception 'Ya vives en este edificio.' using errcode = 'P0001';
  end if;
  door := public.edificio_puerta_libre(l.edificio);
  if door is null then
    raise exception 'El edificio está lleno: no queda ninguna puerta libre.' using errcode = 'P0001';
  end if;
  if antes is null then
    insert into public.edificio_vecinos (user_id, edificio, puerta) values (me, l.edificio, door);
  else
    update public.edificio_vecinos set edificio = l.edificio, puerta = door where user_id = me;
    perform public.edificio_si_vacio(antes);
  end if;
  update public.edificio_llaves set usada = now(), usada_por = me where codigo = l.codigo;
  return jsonb_build_object('edificio', l.edificio, 'puerta', door);
end;
$$;
revoke all on function public.edificio_mudarse(text) from public, anon;
grant execute on function public.edificio_mudarse(text) to authenticated;

-- ── Irse del edificio: a uno propio, con la misma puerta ───────────────────────────────────────────────────────────────────
create or replace function public.edificio_irse()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  antes uuid;
  door text;
  ed uuid;
begin
  if me is null then
    raise exception 'Inicia sesión para mudarte.';
  end if;
  perform pg_advisory_xact_lock(hashtext('edificio_puerto_reparto'));
  select v.edificio, v.puerta into antes, door from public.edificio_vecinos v where v.user_id = me;
  if antes is null then
    raise exception 'Aún no tienes piso en el edificio.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.edificio_vecinos v where v.edificio = antes and v.user_id <> me) then
    raise exception 'Ya vives sola o solo en tu edificio.' using errcode = 'P0001';
  end if;
  insert into public.edificios default values returning id into ed;
  update public.edificio_vecinos set edificio = ed where user_id = me;
  -- Las llaves que diste de aquel edificio dejan de abrir
  update public.edificio_llaves set retirada = true where de = me and usada is null;
  return jsonb_build_object('edificio', ed, 'puerta', door);
end;
$$;
revoke all on function public.edificio_irse() from public, anon;
grant execute on function public.edificio_irse() to authenticated;

-- ── El portal: además, si quedan puertas libres ────────────────────────────────────────────────────────────────────────────
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
  n int;
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
      'personaje', s.personaje,
      'companero', s.companero,
      'sello_dado', (select x.sello from public.piso_sellos x where x.de = me and x.para = v.user_id),
      'sello_recibido', (select x.sello from public.piso_sellos x where x.de = v.user_id and x.para = me)
    ) order by v.puerta desc), '[]'::jsonb)
    into rows
    from public.edificio_vecinos v
    left join public.profiles p on p.user_id = v.user_id
    left join public.pisos s on s.user_id = v.user_id
    where v.edificio = ed
      and (v.user_id = me or (coalesce(p.community_enabled, false) and not public.is_blocked_pair(v.user_id)));
  select count(*) into n from public.edificio_vecinos v where v.edificio = ed;
  return jsonb_build_object('edificio', ed, 'puerta', door, 'vecinos', rows, 'plantas', 3, 'libres', greatest(0, 6 - n));
end;
$$;
revoke all on function public.edificio_portal() from public, anon;
grant execute on function public.edificio_portal() to authenticated;

-- ── Una vez: cada grupo de amigos, su propia comunidad ─────────────────────────────────────────────────────────────────────
create table if not exists public.edificio_reparto_amigos (
  hecho timestamptz primary key default now(),
  mudados int not null
);
alter table public.edificio_reparto_amigos enable row level security;
revoke all on public.edificio_reparto_amigos from anon, authenticated;

-- Reparte un edificio en grupos de amigos (componentes por amistad mutua). Devuelve cuántas cuentas se han mudado.
create or replace function public.edificio_repartir_por_amigos(ed uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  grupo int[];
  n int;
  sig int := 0;
  cambio boolean;
  mayor int;
  tam int;
  mejor int := -1;
  g int;
  nuevo uuid;
  mudados int := 0;
begin
  select array_agg(v.user_id order by v.created_at, v.user_id) into ids from public.edificio_vecinos v where v.edificio = ed;
  n := coalesce(array_length(ids, 1), 0);
  if n < 2 then
    return 0;
  end if;
  -- Cada uno empieza en su grupo; se unen los amigos hasta que nada cambia
  grupo := array(select generate_series(1, n));
  loop
    cambio := false;
    for i in 1..n loop
      for j in (i + 1)..n loop
        if grupo[i] <> grupo[j] and public.edificio_amigos_entre(ids[i], ids[j]) then
          mayor := greatest(grupo[i], grupo[j]);
          sig := least(grupo[i], grupo[j]);
          for k in 1..n loop
            if grupo[k] = mayor then
              grupo[k] := sig;
            end if;
          end loop;
          cambio := true;
        end if;
      end loop;
    end loop;
    exit when not cambio;
  end loop;
  -- Se queda el grupo más grande; a igualdad, el de quien llegó antes (el número de grupo más bajo)
  mayor := 0;
  for g in select distinct unnest(grupo) order by 1 loop
    tam := (select count(*) from unnest(grupo) x where x = g);
    if tam > mayor then
      mayor := tam;
      mejor := g;
    end if;
  end loop;
  -- Los demás grupos, cada uno a un edificio nuevo, juntos y con su misma puerta
  for g in select distinct unnest(grupo) order by 1 loop
    continue when g = mejor;
    insert into public.edificios default values returning id into nuevo;
    for k in 1..n loop
      if grupo[k] = g then
        update public.edificio_vecinos set edificio = nuevo where user_id = ids[k];
        mudados := mudados + 1;
      end if;
    end loop;
  end loop;
  return mudados;
end;
$$;
revoke all on function public.edificio_repartir_por_amigos(uuid) from public, anon, authenticated;

do $$
declare
  e record;
  total int := 0;
begin
  if exists (select 1 from public.edificio_reparto_amigos) then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('edificio_puerto_reparto'));
  for e in select id from public.edificios loop
    total := total + public.edificio_repartir_por_amigos(e.id);
  end loop;
  insert into public.edificio_reparto_amigos (mudados) values (total);
end;
$$;
