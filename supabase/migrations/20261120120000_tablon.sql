-- BookShelf · Tablón libre (paquete Tablón v2). Aditiva y re-ejecutable: no toca pisos guardados, inventarios, precios ni sobres.
--  · «tablon» entra en el catálogo como especial: no se vende, no sale en sobres y siempre hay una copia para colocarla.
--  · Composiciones privadas por defecto; lo público es una copia aparte, limpia y confirmada (sin referencias privadas).
--  · Post-its: uno al día por remitente y destinatario (UTC), atómico e idempotente. Llegan a Recibidas, nunca al lienzo.
--  · El libro de visitas antiguo pasa a archivo privado del anfitrión: no se borra nada.
-- Todo el acceso va por funciones: las tablas no se pueden leer ni escribir directamente.

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values ('tablon', 'pared', 2, null, null, 1, 'especial')
  on conflict (id) do nothing;

create or replace function public.piso_falta_copia(uid uuid, layout jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with puestos as (
    select e ->> 'id' as id, e ->> 'acabado' as acabado, count(*)::integer as n
    from jsonb_array_elements(case when jsonb_typeof(layout -> 'items') = 'array' then layout -> 'items' else '[]'::jsonb end) e
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

create table if not exists public.tablon_tableros (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  accepts_guest_notes boolean not null default false,
  active_composition_id uuid,
  public_composition_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.tablon_composiciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  revision integer not null default 0,
  bounds jsonb not null default '{"x":0,"y":0,"w":1600,"h":1000}'::jsonb check (jsonb_typeof(bounds) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tablon_composiciones_owner on public.tablon_composiciones (owner_id, created_at);

create table if not exists public.tablon_recibidas (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) <= 200),
  style text not null default 'crema' check (style in ('crema', 'salvia', 'azul', 'melocoton')),
  spoiler boolean not null default false,
  author_allows_public boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  withdrawn_at timestamptz,
  aviso_retirada boolean not null default false,
  check (recipient_id <> sender_id)
);
create index if not exists tablon_recibidas_destino on public.tablon_recibidas (recipient_id, created_at desc);
create index if not exists tablon_recibidas_remitente on public.tablon_recibidas (sender_id, created_at desc);

create table if not exists public.tablon_items (
  id uuid not null,
  composition_id uuid not null references public.tablon_composiciones (id) on delete cascade,
  kind text not null check (kind in ('note', 'book', 'quote', 'received')),
  body text not null default '',
  caption text check (caption is null or char_length(caption) <= 160),
  cover text check (cover is null or (char_length(cover) <= 600 and cover ~ '^https://')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 120),
  x double precision not null check (x between -50000 and 50000),
  y double precision not null check (y between -50000 and 50000),
  width double precision not null check (width between 80 and 900),
  height double precision not null check (height between 60 and 900),
  rotation double precision not null default 0 check (rotation between -180 and 180),
  z integer not null default 0 check (z between -100000 and 100000),
  paper text not null default 'crema' check (paper in ('crema', 'salvia', 'azul', 'melocoton')),
  pin text not null default 'laton' check (pin in ('laton', 'plata', 'terracota')),
  sticker text check (sticker is null or sticker in ('estrella', 'hoja', 'libro')),
  spoiler boolean not null default false,
  received_note_id uuid references public.tablon_recibidas (id) on delete set null,
  primary key (composition_id, id),
  check (char_length(body) <= case when kind in ('note', 'received') then 200 else 1200 end),
  check (kind <> 'note' or char_length(btrim(body)) > 0)
);

create table if not exists public.tablon_hilos (
  id uuid not null,
  composition_id uuid not null,
  source_item_id uuid not null,
  target_item_id uuid not null,
  source_anchor text not null default 'pin' check (source_anchor in ('pin', 'top', 'right', 'bottom', 'left')),
  target_anchor text not null default 'pin' check (target_anchor in ('pin', 'top', 'right', 'bottom', 'left')),
  color text not null default 'terracota' check (color in ('terracota', 'laton', 'salvia', 'azul')),
  label text check (label is null or char_length(label) <= 40),
  primary key (composition_id, id),
  check (source_item_id <> target_item_id),
  foreign key (composition_id, source_item_id) references public.tablon_items (composition_id, id) on delete cascade,
  foreign key (composition_id, target_item_id) references public.tablon_items (composition_id, id) on delete cascade
);

create table if not exists public.tablon_publico (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  composition_id uuid not null references public.tablon_composiciones (id) on delete cascade,
  title text not null,
  bounds jsonb not null,
  items jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  revision integer not null default 1,
  published_at timestamptz not null default now()
);

create table if not exists public.tablon_cuota (
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  day_utc date not null,
  idempotency_key uuid not null,
  result_id uuid,
  primary key (sender_id, recipient_id, day_utc),
  unique (sender_id, idempotency_key)
);

alter table public.tablon_tableros enable row level security;
alter table public.tablon_composiciones enable row level security;
alter table public.tablon_recibidas enable row level security;
alter table public.tablon_items enable row level security;
alter table public.tablon_hilos enable row level security;
alter table public.tablon_publico enable row level security;
alter table public.tablon_cuota enable row level security;
revoke all on public.tablon_tableros, public.tablon_composiciones, public.tablon_recibidas, public.tablon_items, public.tablon_hilos, public.tablon_publico, public.tablon_cuota from public, anon, authenticated;

-- Quién puede visitar: las mismas reglas que el piso
create or replace function public.tablon_puede_ver(lector uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and lector is not null and lector <> auth.uid()
    and public.community_member(auth.uid()) and public.community_member(lector)
    and not public.is_blocked_pair(lector)
    and (public.mismo_edificio(lector) or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followed = lector));
$$;
revoke all on function public.tablon_puede_ver(uuid) from public, anon, authenticated;

create or replace function public.tablon_asegurar(me uuid)
returns public.tablon_tableros
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.tablon_tableros;
  nueva uuid;
begin
  insert into public.tablon_tableros (owner_id) values (me) on conflict (owner_id) do nothing;
  select * into t from public.tablon_tableros b where b.owner_id = me for update;
  if t.active_composition_id is null then
    select c.id into nueva from public.tablon_composiciones c where c.owner_id = me order by c.created_at limit 1;
    if nueva is null then
      insert into public.tablon_composiciones (owner_id, title) values (me, 'Composición 1') returning id into nueva;
    end if;
    update public.tablon_tableros b set active_composition_id = nueva where b.owner_id = me returning * into t;
  end if;
  return t;
end;
$$;
revoke all on function public.tablon_asegurar(uuid) from public, anon, authenticated;

create or replace function public.tablon_items_json(comp uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'kind', i.kind, 'body', i.body, 'caption', i.caption, 'cover', i.cover, 'source_ref', i.source_ref,
    'x', i.x, 'y', i.y, 'width', i.width, 'height', i.height, 'rotation', i.rotation, 'z', i.z,
    'paper', i.paper, 'pin', i.pin, 'sticker', i.sticker, 'spoiler', i.spoiler, 'received_note_id', i.received_note_id,
    'retirada', n.withdrawn_at is not null, 'firma', case when i.kind = 'received' then coalesce(p.alias, 'Un lector') end
  ) order by i.z), '[]'::jsonb)
  from public.tablon_items i
  left join public.tablon_recibidas n on n.id = i.received_note_id
  left join public.profiles p on p.user_id = n.sender_id
  where i.composition_id = comp;
$$;
revoke all on function public.tablon_items_json(uuid) from public, anon, authenticated;

create or replace function public.tablon_cargar(comp uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.tablon_tableros;
  c public.tablon_composiciones;
begin
  if me is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  t := public.tablon_asegurar(me);
  select * into c from public.tablon_composiciones x where x.owner_id = me and x.id = coalesce(comp, t.active_composition_id);
  if c.id is null then
    select * into c from public.tablon_composiciones x where x.owner_id = me and x.id = t.active_composition_id;
  end if;
  return jsonb_build_object(
    'tablero', jsonb_build_object('acepta', t.accepts_guest_notes, 'activa', t.active_composition_id, 'publica', t.public_composition_id),
    'composiciones', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'visibility', x.visibility, 'revision', x.revision, 'updated_at', x.updated_at) order by x.created_at), '[]'::jsonb) from public.tablon_composiciones x where x.owner_id = me),
    'actual', jsonb_build_object('id', c.id, 'title', c.title, 'visibility', c.visibility, 'revision', c.revision, 'bounds', c.bounds,
      'items', public.tablon_items_json(c.id),
      'edges', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'source_item_id', h.source_item_id, 'target_item_id', h.target_item_id, 'source_anchor', h.source_anchor, 'target_anchor', h.target_anchor, 'color', h.color, 'label', h.label)), '[]'::jsonb) from public.tablon_hilos h where h.composition_id = c.id)),
    'recibidas', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sender_id', r.sender_id, 'alias', coalesce(p.alias, 'Un lector'), 'body', r.body, 'style', r.style, 'spoiler', r.spoiler, 'author_allows_public', r.author_allows_public, 'created_at', r.created_at, 'read_at', r.read_at, 'withdrawn_at', r.withdrawn_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.tablon_recibidas x where x.recipient_id = me and x.archived_at is null order by x.created_at desc limit 100) r
      left join public.profiles p on p.user_id = r.sender_id),
    'sin_leer', (select count(*) from public.tablon_recibidas x where x.recipient_id = me and x.read_at is null and x.archived_at is null and x.withdrawn_at is null),
    'avisos', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'alias', coalesce(p.alias, 'Un lector'), 'retirada', x.withdrawn_at is not null)), '[]'::jsonb)
      from public.tablon_recibidas x left join public.profiles p on p.user_id = x.sender_id where x.recipient_id = me and x.aviso_retirada)
  );
end;
$$;
revoke all on function public.tablon_cargar(uuid) from public, anon;
grant execute on function public.tablon_cargar(uuid) to authenticated;

-- Guardar una composición entera. Una revisión distinta nunca se sobrescribe: se devuelve el conflicto y el borrador sigue en el cliente.
create or replace function public.tablon_guardar(comp uuid, base integer, titulo text, nuevos jsonb, hilos jsonb, limites jsonb default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.tablon_composiciones;
  malas integer;
begin
  select * into c from public.tablon_composiciones x where x.id = comp and x.owner_id = me for update;
  if c.id is null then
    raise exception 'Esa composición no es tuya.' using errcode = '42501';
  end if;
  if c.revision <> base then
    return jsonb_build_object('conflicto', true, 'revision', c.revision);
  end if;
  if jsonb_typeof(nuevos) <> 'array' or jsonb_typeof(hilos) <> 'array' or jsonb_array_length(nuevos) > 600 or jsonb_array_length(hilos) > 1000 then
    raise exception 'Demasiados elementos.' using errcode = 'P0001';
  end if;
  select count(*) into malas from jsonb_to_recordset(nuevos) as x(kind text, received_note_id uuid)
    where (x.kind = 'received') <> (x.received_note_id is not null)
       or (x.kind = 'received' and not exists (select 1 from public.tablon_recibidas n where n.id = x.received_note_id and n.recipient_id = me));
  if malas > 0 then
    raise exception 'Hay una nota recibida que no es tuya.' using errcode = 'P0001';
  end if;
  delete from public.tablon_items i where i.composition_id = comp;
  insert into public.tablon_items (id, composition_id, kind, body, caption, cover, source_ref, x, y, width, height, rotation, z, paper, pin, sticker, spoiler, received_note_id)
    select x.id, comp, x.kind, case when x.kind = 'received' then n.body else coalesce(x.body, '') end, x.caption, x.cover, x.source_ref, x.x, x.y, x.width, x.height, x.rotation, x.z,
           coalesce(x.paper, 'crema'), coalesce(x.pin, 'laton'), x.sticker, coalesce(x.spoiler, false) or coalesce(n.spoiler, false), x.received_note_id
    from jsonb_to_recordset(nuevos) as x(id uuid, kind text, body text, caption text, cover text, source_ref text, x double precision, y double precision, width double precision, height double precision, rotation double precision, z integer, paper text, pin text, sticker text, spoiler boolean, received_note_id uuid)
    left join public.tablon_recibidas n on n.id = x.received_note_id and n.recipient_id = me;
  insert into public.tablon_hilos (id, composition_id, source_item_id, target_item_id, source_anchor, target_anchor, color, label)
    select h.id, comp, h.source_item_id, h.target_item_id, coalesce(h.source_anchor, 'pin'), coalesce(h.target_anchor, 'pin'), coalesce(h.color, 'terracota'), nullif(btrim(h.label), '')
    from jsonb_to_recordset(hilos) as h(id uuid, source_item_id uuid, target_item_id uuid, source_anchor text, target_anchor text, color text, label text);
  update public.tablon_composiciones x set title = btrim(titulo), bounds = coalesce(limites, x.bounds), revision = x.revision + 1, updated_at = now() where x.id = comp returning * into c;
  return jsonb_build_object('revision', c.revision, 'updated_at', c.updated_at);
end;
$$;
revoke all on function public.tablon_guardar(uuid, integer, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.tablon_guardar(uuid, integer, text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.tablon_crear(clave uuid, titulo text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  perform public.tablon_asegurar(me);
  if exists (select 1 from public.tablon_composiciones c where c.id = clave and c.owner_id <> me) then
    raise exception 'No se ha podido crear.' using errcode = 'P0001';
  end if;
  insert into public.tablon_composiciones (id, owner_id, title) values (clave, me, btrim(titulo)) on conflict (id) do nothing;
  return clave;
end;
$$;
revoke all on function public.tablon_crear(uuid, text) from public, anon;
grant execute on function public.tablon_crear(uuid, text) to authenticated;

create or replace function public.tablon_ajustes(acepta boolean default null, activa uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  perform public.tablon_asegurar(me);
  if activa is not null and not exists (select 1 from public.tablon_composiciones c where c.id = activa and c.owner_id = me) then
    raise exception 'Esa composición no es tuya.' using errcode = '42501';
  end if;
  update public.tablon_tableros t
     set accepts_guest_notes = coalesce(acepta, t.accepts_guest_notes), active_composition_id = coalesce(activa, t.active_composition_id), updated_at = now()
   where t.owner_id = me;
end;
$$;
revoke all on function public.tablon_ajustes(boolean, uuid) from public, anon;
grant execute on function public.tablon_ajustes(boolean, uuid) to authenticated;

create or replace function public.tablon_despublicar()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  delete from public.tablon_publico p where p.owner_id = me;
  update public.tablon_composiciones c set visibility = 'private' where c.owner_id = me and c.visibility = 'public';
  update public.tablon_tableros t set public_composition_id = null where t.owner_id = me;
end;
$$;
revoke all on function public.tablon_despublicar() from public, anon;
grant execute on function public.tablon_despublicar() to authenticated;

create or replace function public.tablon_borrar(comp uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.tablon_tableros;
begin
  t := public.tablon_asegurar(me);
  if not exists (select 1 from public.tablon_composiciones c where c.id = comp and c.owner_id = me) then
    raise exception 'Esa composición no es tuya.' using errcode = '42501';
  end if;
  if (select count(*) from public.tablon_composiciones c where c.owner_id = me) < 2 then
    raise exception 'Tiene que quedar al menos una composición.' using errcode = 'P0001';
  end if;
  if t.public_composition_id = comp then
    perform public.tablon_despublicar();
  end if;
  delete from public.tablon_composiciones c where c.id = comp and c.owner_id = me;
  if t.active_composition_id = comp then
    update public.tablon_tableros b set active_composition_id = (select c.id from public.tablon_composiciones c where c.owner_id = me order by c.created_at limit 1) where b.owner_id = me;
  end if;
end;
$$;
revoke all on function public.tablon_borrar(uuid) from public, anon;
grant execute on function public.tablon_borrar(uuid) to authenticated;

-- Publicar: la revisión que se ha previsualizado, entera o nada. Las referencias privadas no pasan a la copia pública
create or replace function public.tablon_publicar(comp uuid, base integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.tablon_composiciones;
  faltan jsonb;
begin
  select * into c from public.tablon_composiciones x where x.id = comp and x.owner_id = me for update;
  if c.id is null then
    raise exception 'Esa composición no es tuya.' using errcode = '42501';
  end if;
  if c.revision <> base then
    return jsonb_build_object('conflicto', true, 'revision', c.revision);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'alias', coalesce(p.alias, 'Un lector'), 'retirada', n.withdrawn_at is not null)), '[]'::jsonb) into faltan
    from public.tablon_items i
    join public.tablon_recibidas n on n.id = i.received_note_id
    left join public.profiles p on p.user_id = n.sender_id
    where i.composition_id = comp and (not n.author_allows_public or n.withdrawn_at is not null);
  if jsonb_array_length(faltan) > 0 then
    return jsonb_build_object('faltan', faltan);
  end if;
  perform public.tablon_asegurar(me);
  update public.tablon_composiciones x set visibility = case when x.id = comp then 'public' else 'private' end where x.owner_id = me and (x.id = comp or x.visibility = 'public');
  update public.tablon_tableros t set public_composition_id = comp where t.owner_id = me;
  insert into public.tablon_publico (owner_id, composition_id, title, bounds, items, edges, revision, published_at)
  values (me, comp, c.title, c.bounds,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'body', i.body, 'caption', i.caption, 'cover', i.cover,
      'x', i.x, 'y', i.y, 'width', i.width, 'height', i.height, 'rotation', i.rotation, 'z', i.z,
      'paper', i.paper, 'pin', i.pin, 'sticker', i.sticker, 'spoiler', i.spoiler, 'received_note_id', i.received_note_id,
      'firma', case when i.kind = 'received' then coalesce(p.alias, 'Un lector') end
    ) order by i.z), '[]'::jsonb)
    from public.tablon_items i
    left join public.tablon_recibidas n on n.id = i.received_note_id
    left join public.profiles p on p.user_id = n.sender_id
    where i.composition_id = comp),
    (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'source_item_id', h.source_item_id, 'target_item_id', h.target_item_id, 'source_anchor', h.source_anchor, 'target_anchor', h.target_anchor, 'color', h.color, 'label', h.label)), '[]'::jsonb)
     from public.tablon_hilos h where h.composition_id = comp),
    c.revision, now())
  on conflict (owner_id) do update set composition_id = excluded.composition_id, title = excluded.title, bounds = excluded.bounds, items = excluded.items, edges = excluded.edges, revision = excluded.revision, published_at = excluded.published_at;
  return jsonb_build_object('publicada', true, 'revision', c.revision);
end;
$$;
revoke all on function public.tablon_publicar(uuid, integer) from public, anon;
grant execute on function public.tablon_publicar(uuid, integer) to authenticated;

-- Lo que ve quien visita: solo la copia pública y sin el enlace interno a la nota
create or replace function public.tablon_visita(lector uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  pub public.tablon_publico;
  acepta boolean;
  hoy date := (now() at time zone 'utc')::date;
begin
  if not public.tablon_puede_ver(lector) then
    return null;
  end if;
  select * into pub from public.tablon_publico p where p.owner_id = lector;
  select coalesce((select t.accepts_guest_notes from public.tablon_tableros t where t.owner_id = lector), false) into acepta;
  return jsonb_build_object(
    'publico', case when pub.owner_id is null then null else jsonb_build_object('title', pub.title, 'bounds', pub.bounds, 'revision', pub.revision, 'edges', pub.edges,
      'items', (select coalesce(jsonb_agg(e - 'received_note_id'), '[]'::jsonb) from jsonb_array_elements(pub.items) e)) end,
    'acepta', acepta,
    'enviada_hoy', exists (select 1 from public.tablon_cuota q where q.sender_id = me and q.recipient_id = lector and q.day_utc = hoy),
    'proximo', ((hoy + 1)::timestamp at time zone 'utc')
  );
end;
$$;
revoke all on function public.tablon_visita(uuid) from public, anon;
grant execute on function public.tablon_visita(uuid) to authenticated;

-- Dejar un post-it. La cuota es independiente de la nota: borrarla o archivarla no la repone; un reintento con la misma clave devuelve el original
create or replace function public.tablon_enviar_nota(destino uuid, texto text, estilo text, es_spoiler boolean, permite_publico boolean, clave uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hoy date := (now() at time zone 'utc')::date;
  limpio text := btrim(regexp_replace(coalesce(texto, ''), '[[:cntrl:]]+', ' ', 'g'));
  previa uuid;
  nueva uuid;
  entro integer;
begin
  if clave is null then
    raise exception 'Falta la clave de envío.' using errcode = 'P0001';
  end if;
  select q.result_id into previa from public.tablon_cuota q where q.sender_id = me and q.idempotency_key = clave;
  if previa is not null then
    return jsonb_build_object('id', previa, 'repetida', true);
  end if;
  if not public.tablon_puede_ver(destino) then
    raise exception 'No puedes dejarle una nota a esta persona.' using errcode = '42501';
  end if;
  if not coalesce((select t.accepts_guest_notes from public.tablon_tableros t where t.owner_id = destino), false) then
    raise exception 'Este tablón no recibe post-its ahora mismo.' using errcode = 'P0001';
  end if;
  if char_length(limpio) not between 1 and 200 then
    raise exception 'El post-it debe tener entre 1 y 200 caracteres.' using errcode = 'P0001';
  end if;
  insert into public.tablon_cuota (sender_id, recipient_id, day_utc, idempotency_key)
    values (me, destino, hoy, clave) on conflict do nothing;
  get diagnostics entro = row_count;
  if entro = 0 then
    select q.result_id into previa from public.tablon_cuota q where q.sender_id = me and q.idempotency_key = clave;
    if previa is not null then
      return jsonb_build_object('id', previa, 'repetida', true);
    end if;
    raise exception 'Ya le has dejado un post-it hoy.' using errcode = 'P0001';
  end if;
  insert into public.tablon_recibidas (recipient_id, sender_id, body, style, spoiler, author_allows_public)
    values (destino, me, limpio, coalesce(estilo, 'crema'), coalesce(es_spoiler, false), coalesce(permite_publico, false))
    returning id into nueva;
  update public.tablon_cuota q set result_id = nueva where q.sender_id = me and q.recipient_id = destino and q.day_utc = hoy;
  return jsonb_build_object('id', nueva, 'repetida', false);
end;
$$;
revoke all on function public.tablon_enviar_nota(uuid, text, text, boolean, boolean, uuid) from public, anon;
grant execute on function public.tablon_enviar_nota(uuid, text, text, boolean, boolean, uuid) to authenticated;

create or replace function public.tablon_leer_nota(nota uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.tablon_recibidas r set read_at = coalesce(r.read_at, now()) where r.id = nota and r.recipient_id = auth.uid();
$$;
revoke all on function public.tablon_leer_nota(uuid) from public, anon;
grant execute on function public.tablon_leer_nota(uuid) to authenticated;

create or replace function public.tablon_archivar_nota(nota uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.tablon_recibidas r set archived_at = coalesce(r.archived_at, now()) where r.id = nota and r.recipient_id = auth.uid();
$$;
revoke all on function public.tablon_archivar_nota(uuid) from public, anon;
grant execute on function public.tablon_archivar_nota(uuid) to authenticated;

create or replace function public.tablon_avisos_vistos()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.tablon_recibidas r set aviso_retirada = false where r.recipient_id = auth.uid() and r.aviso_retirada;
$$;
revoke all on function public.tablon_avisos_vistos() from public, anon;
grant execute on function public.tablon_avisos_vistos() to authenticated;

create or replace function public.tablon_quitar_de_publico(nota uuid, duenio uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  estaba boolean;
begin
  select exists (select 1 from public.tablon_publico p, jsonb_array_elements(p.items) e where p.owner_id = duenio and e ->> 'received_note_id' = nota::text) into estaba;
  if not estaba then
    return false;
  end if;
  update public.tablon_publico p set
    edges = coalesce((select jsonb_agg(h) from jsonb_array_elements(p.edges) h
      where not exists (select 1 from jsonb_array_elements(p.items) e where e ->> 'received_note_id' = nota::text and (e ->> 'id' = h ->> 'source_item_id' or e ->> 'id' = h ->> 'target_item_id'))), '[]'::jsonb),
    items = coalesce((select jsonb_agg(e) from jsonb_array_elements(p.items) e where e ->> 'received_note_id' is distinct from nota::text), '[]'::jsonb),
    revision = p.revision + 1
  where p.owner_id = duenio;
  return true;
end;
$$;
revoke all on function public.tablon_quitar_de_publico(uuid, uuid) from public, anon, authenticated;

-- Quien la escribió decide: permitir que se exponga (o dejar de permitirlo) y retirarla del todo
create or replace function public.tablon_permiso_nota(nota uuid, permitir boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n public.tablon_recibidas;
begin
  select * into n from public.tablon_recibidas r where r.id = nota and r.sender_id = me for update;
  if n.id is null then
    raise exception 'Esa nota no es tuya.' using errcode = '42501';
  end if;
  update public.tablon_recibidas r set author_allows_public = permitir where r.id = nota;
  if not permitir and public.tablon_quitar_de_publico(nota, n.recipient_id) then
    update public.tablon_recibidas r set aviso_retirada = true where r.id = nota;
  end if;
end;
$$;
revoke all on function public.tablon_permiso_nota(uuid, boolean) from public, anon;
grant execute on function public.tablon_permiso_nota(uuid, boolean) to authenticated;

create or replace function public.tablon_retirar_nota(nota uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n public.tablon_recibidas;
begin
  select * into n from public.tablon_recibidas r where r.id = nota and r.sender_id = me for update;
  if n.id is null then
    raise exception 'Esa nota no es tuya.' using errcode = '42501';
  end if;
  perform public.tablon_quitar_de_publico(nota, n.recipient_id);
  update public.tablon_items i set body = '' where i.received_note_id = nota;
  update public.tablon_recibidas r set body = '', author_allows_public = false, withdrawn_at = coalesce(r.withdrawn_at, now()), aviso_retirada = true where r.id = nota;
end;
$$;
revoke all on function public.tablon_retirar_nota(uuid) from public, anon;
grant execute on function public.tablon_retirar_nota(uuid) to authenticated;

create or replace function public.tablon_mis_enviadas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'alias', coalesce(p.alias, 'Un lector'), 'body', r.body, 'created_at', r.created_at, 'author_allows_public', r.author_allows_public, 'withdrawn_at', r.withdrawn_at) order by r.created_at desc), '[]'::jsonb)
  from (select * from public.tablon_recibidas x where x.sender_id = auth.uid() order by x.created_at desc limit 100) r
  left join public.profiles p on p.user_id = r.recipient_id;
$$;
revoke all on function public.tablon_mis_enviadas() from public, anon;
grant execute on function public.tablon_mis_enviadas() to authenticated;

-- Denunciar un post-it con el mecanismo de siempre
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in ('review', 'club_message', 'tablon_nota'));

-- El libro de visitas antiguo: solo lo ve su anfitrión (y cada cual su firma). No se borra nada
create or replace function public.piso_social(piso uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  items jsonb;
begin
  if me is null or (piso <> me and not public.piso_vecino_visible(piso)) then
    raise exception 'Ese piso no está en tu edificio.' using errcode = 'P0001';
  end if;
  select case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end into items
    from public.pisos p where p.user_id = piso_social.piso;
  return jsonb_build_object(
    'visitas', coalesce((
      select jsonb_agg(jsonb_build_object('de', v.de, 'alias', pr.alias, 'avatar_id', pr.avatar_id, 'frase', v.frase, 'dia', v.dia) order by v.creado desc)
      from (
        select * from public.piso_visitas x
        where x.piso = piso_social.piso and (x.de = me or (me = piso_social.piso and public.piso_vecino_visible(x.de)))
        order by x.creado desc limit 20
      ) v left join public.profiles pr on pr.user_id = v.de), '[]'::jsonb),
    'megusta', coalesce((
      select jsonb_object_agg(c.uid::text, c.n) from (
        select m.uid, count(*) as n from public.piso_megusta m
        where m.piso = piso_social.piso
          and exists (select 1 from jsonb_array_elements(coalesce(items, '[]'::jsonb)) e where (e ->> 'uid') = m.uid::text and e ->> 'id' = m.mueble)
        group by m.uid
      ) c), '{}'::jsonb),
    'mios', coalesce((select jsonb_agg(m.uid order by m.uid) from public.piso_megusta m where m.piso = piso_social.piso and m.de = me), '[]'::jsonb),
    'regalos', case when piso = me then coalesce((
      select jsonb_agg(jsonb_build_object('de', r.de, 'alias', pr.alias, 'mueble', r.mueble, 'creado', r.creado) order by r.creado desc)
      from (select * from public.piso_regalos x where x.para = me order by x.creado desc limit 20) r
      left join public.profiles pr on pr.user_id = r.de), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.piso_social(uuid) from public, anon;
grant execute on function public.piso_social(uuid) to authenticated;
