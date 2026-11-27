-- Libotown · 1.153 (docs/qa/amigos-vecinos.md, bloque 3): la app «Amigos» del ordenador del piso. Encargo de Francisco del
-- 26-11-2026: «que en el ordenador haya una sección social muy atractiva que deje buscar a amigos y tener funciones
-- relacionadas con la lectura». Y su decisión: «lo que ven tus amigos de tu lectura, lo eliges tú» (por defecto, qué lees ahora y
-- los libros que terminas; nunca notas, reseñas privadas ni páginas por día; solo amigos).
--
-- Amigos son, como en el casino, la sala y el edificio, dos cuentas que se siguen las dos, con la comunidad y sin bloqueo
-- (`edificio_amigos_entre`, de la migración del bloque 1).
--
-- - **Tu código de amigo** (`amigos_codigos`): 8 caracteres sin letras que se confundan, para que te encuentren sin buscar tu
--   alias. `amigos_buscar_codigo` dice de quién es (solo con la comunidad y sin bloqueo).
-- - **Lo que compartes** (`amigos_lectura`): qué lees ahora (hasta 3 títulos) y lo último que has terminado (hasta 5, con el día),
--   y si tus amigos ven tu avance en «Leemos el mismo». Lo manda la app de cada cual (`amigos_publicar`); lo que tienes apagado
--   no se guarda (se borra al apagarlo).
-- - **Recomendar un libro** (`amigos_recomendaciones`): a un amigo, con una frase cerrada (sin texto libre). Como mucho 5 al día
--   y una vez por libro y amigo. Le llega al buzón del portal y a su app Amigos.
-- - **Leemos el mismo** (`amigos_juntos`): propones un libro a un amigo; si acepta, cada uno ve el avance del otro en porcentaje
--   (si el otro lo comparte). Como mucho 3 abiertos por persona.
-- - **Darle la llave del edificio a un amigo** (`amigos_dar_llave`): la misma llave del bloque 1 (un uso, 7 días), pero le llega a
--   su app Amigos y no hace falta copiar nada.
-- - `amigos_panel()` lo junta todo: tus amigos (y lo que comparte cada uno), quién te sigue y tú aún no (solicitudes), a quién
--   sigues y aún no te sigue, tus recomendaciones, tus lecturas juntos y las llaves que te han dado.
--
-- Va después de `20261231120000_edificio_plantas.sql` y se puede volver a ejecutar. No mueve a nadie ni borra nada de nadie.
-- La aplica Francisco en el SQL Editor.

-- ── Tu código de amigo ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.amigos_codigos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  codigo  text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  creado  timestamptz not null default now()
);
alter table public.amigos_codigos enable row level security;
revoke all on public.amigos_codigos from anon, authenticated;

-- ── Lo que compartes con tus amigos ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.amigos_lectura (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  ver_leyendo    boolean not null default true,
  ver_terminados boolean not null default true,
  ver_juntos     boolean not null default true,
  leyendo        jsonb,
  terminados     jsonb,
  actualizado    timestamptz not null default now()
);
alter table public.amigos_lectura enable row level security;
revoke all on public.amigos_lectura from anon, authenticated;

-- ── Recomendaciones ────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.amigos_recomendaciones (
  id     uuid primary key default gen_random_uuid(),
  de     uuid not null references auth.users (id) on delete cascade,
  para   uuid not null references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 300),
  autor  text not null default '' check (char_length(autor) <= 300),
  frase  text not null check (frase in ('te_gustara', 'me_acorde', 'no_pude_soltarlo', 'para_leer_juntos')),
  creada timestamptz not null default now(),
  vista  timestamptz,
  check (de <> para)
);
create unique index if not exists amigos_recomendaciones_una on public.amigos_recomendaciones (de, para, lower(titulo));
create index if not exists amigos_recomendaciones_para on public.amigos_recomendaciones (para, creada desc);
alter table public.amigos_recomendaciones enable row level security;
revoke all on public.amigos_recomendaciones from anon, authenticated;

-- ── Leemos el mismo ────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.amigos_juntos (
  id          uuid primary key default gen_random_uuid(),
  de          uuid not null references auth.users (id) on delete cascade,
  para        uuid not null references auth.users (id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 300),
  autor       text not null default '' check (char_length(autor) <= 300),
  estado      text not null default 'invitada' check (estado in ('invitada', 'activa', 'retirada')),
  avance_de   integer check (avance_de between 0 and 100),
  avance_para integer check (avance_para between 0 and 100),
  creada      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  check (de <> para)
);
create index if not exists amigos_juntos_de on public.amigos_juntos (de, estado);
create index if not exists amigos_juntos_para on public.amigos_juntos (para, estado);
alter table public.amigos_juntos enable row level security;
revoke all on public.amigos_juntos from anon, authenticated;

-- ── La llave, para un amigo ────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.edificio_llaves add column if not exists para uuid references auth.users (id) on delete set null;
create index if not exists edificio_llaves_para on public.edificio_llaves (para);

-- ── Ayudas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Un código nuevo de 8 caracteres sin I, O, 0 ni 1 (como las llaves)
create or replace function public.amigos_codigo_nuevo()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfa constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  cod text := '';
begin
  for i in 0..7 loop
    cod := cod || substr(alfa, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return cod;
end;
$$;
revoke all on function public.amigos_codigo_nuevo() from public, anon, authenticated;

-- Un título o un autor limpio: sin espacios de más y cortado a 300
create or replace function public.amigos_texto(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), 300);
$$;
revoke all on function public.amigos_texto(text) from public, anon, authenticated;

-- Comprueba que quien llama puede usar los amigos (con sesión y la comunidad activada)
create or replace function public.amigos_yo()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Inicia sesión para ver a tus amigos.' using errcode = 'P0001';
  end if;
  if not public.community_member(me) then
    raise exception 'Activa la comunidad para ver a tus amigos.' using errcode = 'P0001';
  end if;
  return me;
end;
$$;
revoke all on function public.amigos_yo() from public, anon, authenticated;

-- ── Tu código ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.amigos_mi_codigo()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  cod text;
begin
  select c.codigo into cod from public.amigos_codigos c where c.user_id = me;
  if cod is not null then
    return cod;
  end if;
  loop
    cod := public.amigos_codigo_nuevo();
    exit when not exists (select 1 from public.amigos_codigos c where c.codigo = cod);
  end loop;
  insert into public.amigos_codigos (user_id, codigo) values (me, cod) on conflict (user_id) do nothing;
  select c.codigo into cod from public.amigos_codigos c where c.user_id = me;
  return cod;
end;
$$;
revoke all on function public.amigos_mi_codigo() from public, anon;
grant execute on function public.amigos_mi_codigo() to authenticated;

-- De quién es un código de amigo (null si no es de nadie que puedas ver). El código se escribe como se quiera.
create or replace function public.amigos_buscar_codigo(cod text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  otro uuid;
  p public.profiles;
begin
  select c.user_id into otro from public.amigos_codigos c where c.codigo = public.edificio_codigo(cod);
  if otro is null or otro = me or not public.community_member(otro) or public.edificio_bloqueo_entre(me, otro) then
    return null;
  end if;
  select * into p from public.profiles x where x.user_id = otro;
  return jsonb_build_object('user_id', p.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id);
end;
$$;
revoke all on function public.amigos_buscar_codigo(text) from public, anon;
grant execute on function public.amigos_buscar_codigo(text) to authenticated;

-- ── Lo que compartes ───────────────────────────────────────────────────────────────────────────────────────────────────────
-- Qué pueden ver tus amigos. Lo que apagas se borra en ese momento (también tu avance en «Leemos el mismo»).
create or replace function public.amigos_ajustes(leyendo boolean, terminados boolean, juntos boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  l public.amigos_lectura;
begin
  insert into public.amigos_lectura (user_id, ver_leyendo, ver_terminados, ver_juntos)
  values (me, coalesce(leyendo, true), coalesce(terminados, true), coalesce(juntos, true))
  on conflict (user_id) do update set
    ver_leyendo = excluded.ver_leyendo,
    ver_terminados = excluded.ver_terminados,
    ver_juntos = excluded.ver_juntos,
    leyendo = case when excluded.ver_leyendo then public.amigos_lectura.leyendo end,
    terminados = case when excluded.ver_terminados then public.amigos_lectura.terminados end,
    actualizado = now()
  returning * into l;
  if not l.ver_juntos then
    update public.amigos_juntos j set avance_de = null where j.de = me;
    update public.amigos_juntos j set avance_para = null where j.para = me;
  end if;
  return jsonb_build_object('leyendo', l.ver_leyendo, 'terminados', l.ver_terminados, 'juntos', l.ver_juntos);
end;
$$;
revoke all on function public.amigos_ajustes(boolean, boolean, boolean) from public, anon;
grant execute on function public.amigos_ajustes(boolean, boolean, boolean) to authenticated;

-- La app manda lo que lees y lo que has terminado (solo títulos, autores y el día) y su avance en cada «Leemos el mismo»
-- (`avances`: [{ id, pct }]). Lo apagado no se guarda.
create or replace function public.amigos_publicar(leyendo jsonb, terminados jsonb, avances jsonb default '[]'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  l public.amigos_lectura;
  ley jsonb;
  ter jsonb;
  a jsonb;
  pct integer;
begin
  insert into public.amigos_lectura (user_id) values (me) on conflict (user_id) do nothing;
  select * into l from public.amigos_lectura x where x.user_id = me;
  select coalesce(jsonb_agg(jsonb_build_object('titulo', t.titulo, 'autor', t.autor) order by t.n), '[]'::jsonb) into ley
  from (
    select public.amigos_texto(e->>'titulo') titulo, public.amigos_texto(e->>'autor') autor, n
    from jsonb_array_elements(case when jsonb_typeof(leyendo) = 'array' then leyendo else '[]'::jsonb end) with ordinality as x(e, n)
    where n <= 3
  ) t
  where t.titulo <> '';
  select coalesce(jsonb_agg(jsonb_build_object('titulo', t.titulo, 'autor', t.autor, 'fecha', t.fecha) order by t.n), '[]'::jsonb) into ter
  from (
    select public.amigos_texto(e->>'titulo') titulo, public.amigos_texto(e->>'autor') autor,
      case when (e->>'fecha') ~ '^\d{4}-\d{2}-\d{2}' then left(e->>'fecha', 10) end fecha, n
    from jsonb_array_elements(case when jsonb_typeof(terminados) = 'array' then terminados else '[]'::jsonb end) with ordinality as x(e, n)
    where n <= 5
  ) t
  where t.titulo <> '';
  update public.amigos_lectura x set
    leyendo = case when x.ver_leyendo then ley end,
    terminados = case when x.ver_terminados then ter end,
    actualizado = now()
  where x.user_id = me;
  if l.ver_juntos and jsonb_typeof(avances) = 'array' then
    for a in select * from jsonb_array_elements(avances) limit 10 loop
      pct := case when (a->>'pct') ~ '^\d{1,3}(\.\d+)?$' then least(100, greatest(0, round((a->>'pct')::numeric)))::integer end;
      continue when pct is null or (a->>'id') !~ '^[0-9a-f-]{36}$';
      update public.amigos_juntos j set avance_de = pct, actualizado = now()
        where j.id = (a->>'id')::uuid and j.de = me and j.estado = 'activa';
      update public.amigos_juntos j set avance_para = pct, actualizado = now()
        where j.id = (a->>'id')::uuid and j.para = me and j.estado = 'activa';
    end loop;
  end if;
end;
$$;
revoke all on function public.amigos_publicar(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.amigos_publicar(jsonb, jsonb, jsonb) to authenticated;

-- ── Recomendar un libro ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.amigos_recomendar(para uuid, titulo text, autor text, frase text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  t text := public.amigos_texto(titulo);
  r public.amigos_recomendaciones;
begin
  if not public.edificio_amigos_entre(me, para) then
    raise exception 'Solo se recomienda a amigos: os tenéis que seguir los dos.' using errcode = 'P0001';
  end if;
  if t = '' then
    raise exception 'Elige un libro.' using errcode = 'P0001';
  end if;
  if frase not in ('te_gustara', 'me_acorde', 'no_pude_soltarlo', 'para_leer_juntos') then
    raise exception 'Elige una de las frases.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.amigos_recomendaciones x where x.de = me and x.para = amigos_recomendar.para and lower(x.titulo) = lower(t)) then
    raise exception 'Ya le recomendaste este libro.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.amigos_recomendaciones x where x.de = me and x.creada > now() - interval '1 day') >= 5 then
    raise exception 'Hoy ya has recomendado cinco libros. Mañana, más.' using errcode = 'P0001';
  end if;
  insert into public.amigos_recomendaciones (de, para, titulo, autor, frase)
  values (me, amigos_recomendar.para, t, public.amigos_texto(autor), frase)
  returning * into r;
  return jsonb_build_object('id', r.id, 'creada', r.creada);
end;
$$;
revoke all on function public.amigos_recomendar(uuid, text, text, text) from public, anon;
grant execute on function public.amigos_recomendar(uuid, text, text, text) to authenticated;

-- Dar por vistas las recomendaciones que te han llegado
create or replace function public.amigos_recomendaciones_vistas()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.amigos_recomendaciones x set vista = now() where x.para = auth.uid() and x.vista is null;
$$;
revoke all on function public.amigos_recomendaciones_vistas() from public, anon;
grant execute on function public.amigos_recomendaciones_vistas() to authenticated;

-- ── Leemos el mismo ────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.amigos_juntos_proponer(para uuid, titulo text, autor text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  t text := public.amigos_texto(titulo);
  j public.amigos_juntos;
begin
  if not public.edificio_amigos_entre(me, para) then
    raise exception 'Solo se lee a la vez con amigos: os tenéis que seguir los dos.' using errcode = 'P0001';
  end if;
  if t = '' then
    raise exception 'Elige un libro.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.amigos_juntos x
    where x.estado <> 'retirada' and lower(x.titulo) = lower(t)
      and ((x.de = me and x.para = amigos_juntos_proponer.para) or (x.de = amigos_juntos_proponer.para and x.para = me))
  ) then
    raise exception 'Ya estáis con este libro.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.amigos_juntos x where x.estado <> 'retirada' and me in (x.de, x.para)) >= 3 then
    raise exception 'Ya tienes tres lecturas a la vez: deja una para empezar otra.' using errcode = 'P0001';
  end if;
  insert into public.amigos_juntos (de, para, titulo, autor) values (me, amigos_juntos_proponer.para, t, public.amigos_texto(autor))
  returning * into j;
  return jsonb_build_object('id', j.id);
end;
$$;
revoke all on function public.amigos_juntos_proponer(uuid, text, text) from public, anon;
grant execute on function public.amigos_juntos_proponer(uuid, text, text) to authenticated;

-- Quien recibe la propuesta la acepta (empieza) o no (se retira; quien la hizo lo ve igual que si la dejaran)
create or replace function public.amigos_juntos_responder(juntos uuid, acepta boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  j public.amigos_juntos;
begin
  select * into j from public.amigos_juntos x where x.id = juntos and x.para = me and x.estado = 'invitada' for update;
  if not found then
    raise exception 'Esta propuesta ya no está.' using errcode = 'P0001';
  end if;
  if acepta and (select count(*) from public.amigos_juntos x where x.estado = 'activa' and me in (x.de, x.para)) >= 3 then
    raise exception 'Ya tienes tres lecturas a la vez: deja una para empezar otra.' using errcode = 'P0001';
  end if;
  update public.amigos_juntos x set estado = case when acepta and public.edificio_amigos_entre(j.de, me) then 'activa' else 'retirada' end,
    actualizado = now()
  where x.id = j.id;
end;
$$;
revoke all on function public.amigos_juntos_responder(uuid, boolean) from public, anon;
grant execute on function public.amigos_juntos_responder(uuid, boolean) to authenticated;

-- Cualquiera de los dos la deja (o quien la propuso la retira antes de que la acepten)
create or replace function public.amigos_juntos_dejar(juntos uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.amigos_juntos x set estado = 'retirada', actualizado = now()
  where x.id = juntos and auth.uid() in (x.de, x.para) and x.estado <> 'retirada';
$$;
revoke all on function public.amigos_juntos_dejar(uuid) from public, anon;
grant execute on function public.amigos_juntos_dejar(uuid) to authenticated;

-- ── La llave del edificio, para un amigo ───────────────────────────────────────────────────────────────────────────────────
-- Una llave del bloque 1 (las mismas reglas: un uso, 7 días, 3 sin usar) que le llega a su app Amigos
create or replace function public.amigos_dar_llave(para uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  ed uuid;
  llave jsonb;
begin
  if not public.edificio_amigos_entre(me, para) then
    raise exception 'La llave, solo a amigos: os tenéis que seguir los dos.' using errcode = 'P0001';
  end if;
  select v.edificio into ed from public.edificio_vecinos v where v.user_id = me;
  if ed is not null and exists (select 1 from public.edificio_vecinos v where v.user_id = amigos_dar_llave.para and v.edificio = ed) then
    raise exception 'Ya vivís en el mismo edificio.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.edificio_llaves x
    where x.de = me and x.para = amigos_dar_llave.para and public.edificio_llave_viva(x)
  ) then
    raise exception 'Ya le diste una llave: aún no la ha usado.' using errcode = 'P0001';
  end if;
  llave := public.edificio_dar_llave();
  update public.edificio_llaves x set para = amigos_dar_llave.para where x.codigo = llave->>'codigo';
  return llave;
end;
$$;
revoke all on function public.amigos_dar_llave(uuid) from public, anon;
grant execute on function public.amigos_dar_llave(uuid) to authenticated;

-- ── Todo junto, para la app ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.amigos_panel()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.amigos_yo();
  mi_ed uuid;
  mios public.amigos_lectura;
begin
  perform public.amigos_mi_codigo();
  select v.edificio into mi_ed from public.edificio_vecinos v where v.user_id = me;
  select * into mios from public.amigos_lectura x where x.user_id = me;
  return jsonb_build_object(
    'codigo', (select c.codigo from public.amigos_codigos c where c.user_id = me),
    'ajustes', jsonb_build_object(
      'leyendo', coalesce(mios.ver_leyendo, true),
      'terminados', coalesce(mios.ver_terminados, true),
      'juntos', coalesce(mios.ver_juntos, true)
    ),
    'amigos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id,
        'vecino', mi_ed is not null and exists (select 1 from public.edificio_vecinos v where v.user_id = p.user_id and v.edificio = mi_ed),
        'leyendo', case when coalesce(l.ver_leyendo, true) then coalesce(l.leyendo, '[]'::jsonb) end,
        'terminados', case when coalesce(l.ver_terminados, true) then coalesce(l.terminados, '[]'::jsonb) end
      ) order by lower(p.alias))
      from public.follows f
      join public.profiles p on p.user_id = f.followed
      left join public.amigos_lectura l on l.user_id = p.user_id
      where f.follower = me and public.edificio_amigos_entre(me, f.followed)
    ), '[]'::jsonb),
    'solicitudes', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id, 'desde', f.created_at) order by f.created_at desc)
      from public.follows f
      join public.profiles p on p.user_id = f.follower
      where f.followed = me and public.community_member(f.follower) and not public.edificio_bloqueo_entre(me, f.follower)
        and not exists (select 1 from public.follows g where g.follower = me and g.followed = f.follower)
    ), '[]'::jsonb),
    'esperando', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id) order by f.created_at desc)
      from public.follows f
      join public.profiles p on p.user_id = f.followed
      where f.follower = me and public.community_member(f.followed) and not public.edificio_bloqueo_entre(me, f.followed)
        and not exists (select 1 from public.follows g where g.follower = f.followed and g.followed = me)
    ), '[]'::jsonb),
    'recomendaciones', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'de', r.de, 'alias', p.alias, 'avatar_id', p.avatar_id, 'titulo', r.titulo, 'autor', r.autor,
        'frase', r.frase, 'creada', r.creada, 'vista', r.vista is not null) order by r.creada desc)
      from (
        select * from public.amigos_recomendaciones x
        where x.para = me and not public.edificio_bloqueo_entre(me, x.de)
        order by x.creada desc limit 20
      ) r
      left join public.profiles p on p.user_id = r.de
    ), '[]'::jsonb),
    'juntos', coalesce((
      select jsonb_agg(jsonb_build_object('id', j.id, 'con', otro, 'alias', p.alias, 'avatar_id', p.avatar_id, 'titulo', j.titulo, 'autor', j.autor,
        'estado', j.estado, 'propuse', j.de = me,
        'avance_mio', case when j.de = me then j.avance_de else j.avance_para end,
        'avance_suyo', case when coalesce(l.ver_juntos, true) then (case when j.de = me then j.avance_para else j.avance_de end) end
      ) order by j.creada desc)
      from public.amigos_juntos j
      cross join lateral (select case when j.de = me then j.para else j.de end otro) o
      left join public.profiles p on p.user_id = o.otro
      left join public.amigos_lectura l on l.user_id = o.otro
      where me in (j.de, j.para) and j.estado <> 'retirada' and not public.edificio_bloqueo_entre(me, o.otro)
    ), '[]'::jsonb),
    'llaves', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', k.codigo, 'de', k.de, 'alias', p.alias, 'avatar_id', p.avatar_id, 'caduca', k.caduca) order by k.creada desc)
      from public.edificio_llaves k
      left join public.profiles p on p.user_id = k.de
      where k.para = me and public.edificio_llave_viva(k) and not public.edificio_bloqueo_entre(me, k.de)
        and (mi_ed is null or k.edificio <> mi_ed)
    ), '[]'::jsonb),
    'llaves_dadas', coalesce((
      select jsonb_agg(k.para)
      from public.edificio_llaves k
      where k.de = me and k.para is not null and public.edificio_llave_viva(k)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.amigos_panel() from public, anon;
grant execute on function public.amigos_panel() to authenticated;
