-- BookShelf · Dibujos en el tablón: se guardan como trazos validados, nunca como imágenes. Aditiva y re-ejecutable.
--  · Un post-it o un dibujo al día por remitente y destinatario: comparten cupo.
--  · Solo lo ve quien lo recibe hasta que lo clava; exponerlo exige el permiso de quien lo dibujó, y puede retirarlo.

alter table public.tablon_recibidas add column if not exists dibujo jsonb;
alter table public.tablon_recibidas add column if not exists recortado boolean not null default false;
alter table public.tablon_items add column if not exists dibujo jsonb;
alter table public.tablon_items add column if not exists recortado boolean not null default false;
alter table public.tablon_items drop constraint if exists tablon_items_kind_check;
alter table public.tablon_items add constraint tablon_items_kind_check check (kind in ('note', 'book', 'quote', 'received', 'drawing'));

-- Devuelve el dibujo solo con lo permitido, o lo rechaza: paleta cerrada, coordenadas enteras de 0 a 120 y tamaño acotado
create or replace function public.tablon_dibujo_limpio(d jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  t jsonb;
  limpios jsonb := '[]'::jsonb;
  total integer := 0;
  n integer;
begin
  if d is null or jsonb_typeof(d) <> 'object' or jsonb_typeof(d -> 's') is distinct from 'array'
     or jsonb_array_length(d -> 's') not between 1 and 150 then
    raise exception 'Dibujo no válido.' using errcode = 'P0001';
  end if;
  for t in select e from jsonb_array_elements(d -> 's') e loop
    if jsonb_typeof(t) <> 'object' or jsonb_typeof(t -> 'c') is distinct from 'number'
       or (t ->> 'c') not in ('0', '1', '2', '3', '4') or jsonb_typeof(t -> 'p') is distinct from 'array' then
      raise exception 'Dibujo no válido.' using errcode = 'P0001';
    end if;
    n := jsonb_array_length(t -> 'p');
    total := total + n;
    if n < 2 or n % 2 <> 0 or total > 8000 or exists (
      select 1 from jsonb_array_elements(t -> 'p') v
      where jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[0-9]+$' or (v #>> '{}')::numeric > 120
    ) then
      raise exception 'Dibujo no válido.' using errcode = 'P0001';
    end if;
    limpios := limpios || jsonb_build_array(jsonb_build_object('c', (t ->> 'c')::integer, 'p', t -> 'p'));
  end loop;
  return jsonb_build_object('v', 1, 's', limpios);
end;
$$;
revoke all on function public.tablon_dibujo_limpio(jsonb) from public, anon, authenticated;

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
    'paper', i.paper, 'pin', i.pin, 'sticker', i.sticker, 'spoiler', i.spoiler, 'received_note_id', i.received_note_id, 'dibujo', i.dibujo, 'recortado', i.recortado,
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
    'recibidas', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'sender_id', r.sender_id, 'alias', coalesce(p.alias, 'Un lector'), 'body', r.body, 'dibujo', r.dibujo, 'recortado', r.recortado, 'style', r.style, 'spoiler', r.spoiler, 'author_allows_public', r.author_allows_public, 'created_at', r.created_at, 'read_at', r.read_at, 'withdrawn_at', r.withdrawn_at) order by r.created_at desc), '[]'::jsonb)
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
  insert into public.tablon_items (id, composition_id, kind, body, caption, cover, source_ref, x, y, width, height, rotation, z, paper, pin, sticker, spoiler, received_note_id, dibujo, recortado)
    select x.id, comp, x.kind, case when x.kind = 'received' then n.body else coalesce(x.body, '') end, x.caption, x.cover, x.source_ref, x.x, x.y, x.width, x.height, x.rotation, x.z,
           coalesce(x.paper, 'crema'), coalesce(x.pin, 'laton'), x.sticker, coalesce(x.spoiler, false) or coalesce(n.spoiler, false), x.received_note_id,
           case when x.kind = 'received' then n.dibujo when x.kind = 'drawing' then public.tablon_dibujo_limpio(x.dibujo) end, coalesce(x.recortado, false)
    from jsonb_to_recordset(nuevos) as x(id uuid, kind text, body text, caption text, cover text, source_ref text, x double precision, y double precision, width double precision, height double precision, rotation double precision, z integer, paper text, pin text, sticker text, spoiler boolean, received_note_id uuid, dibujo jsonb, recortado boolean)
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
      'paper', i.paper, 'pin', i.pin, 'sticker', i.sticker, 'spoiler', i.spoiler, 'received_note_id', i.received_note_id, 'dibujo', i.dibujo, 'recortado', i.recortado,
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
  update public.tablon_items i set body = '', dibujo = null where i.received_note_id = nota;
  update public.tablon_recibidas r set body = '', dibujo = null, author_allows_public = false, withdrawn_at = coalesce(r.withdrawn_at, now()), aviso_retirada = true where r.id = nota;
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
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'alias', coalesce(p.alias, 'Un lector'), 'body', r.body, 'dibujo', r.dibujo, 'recortado', r.recortado, 'created_at', r.created_at, 'author_allows_public', r.author_allows_public, 'withdrawn_at', r.withdrawn_at) order by r.created_at desc), '[]'::jsonb)
  from (select * from public.tablon_recibidas x where x.sender_id = auth.uid() order by x.created_at desc limit 100) r
  left join public.profiles p on p.user_id = r.recipient_id;
$$;
revoke all on function public.tablon_mis_enviadas() from public, anon;
grant execute on function public.tablon_mis_enviadas() to authenticated;

-- Dejar un dibujo: el mismo camino y la misma cuota que un post-it
create or replace function public.tablon_enviar_dibujo(destino uuid, trazos jsonb, forma boolean, permite_publico boolean, clave uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hoy date := (now() at time zone 'utc')::date;
  limpio jsonb;
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
    raise exception 'No puedes dejarle un dibujo a esta persona.' using errcode = '42501';
  end if;
  if not coalesce((select t.accepts_guest_notes from public.tablon_tableros t where t.owner_id = destino), false) then
    raise exception 'Este tablón no recibe nada ahora mismo.' using errcode = 'P0001';
  end if;
  limpio := public.tablon_dibujo_limpio(trazos);
  insert into public.tablon_cuota (sender_id, recipient_id, day_utc, idempotency_key)
    values (me, destino, hoy, clave) on conflict do nothing;
  get diagnostics entro = row_count;
  if entro = 0 then
    select q.result_id into previa from public.tablon_cuota q where q.sender_id = me and q.idempotency_key = clave;
    if previa is not null then
      return jsonb_build_object('id', previa, 'repetida', true);
    end if;
    raise exception 'Ya le has dejado un post-it o un dibujo hoy.' using errcode = 'P0001';
  end if;
  insert into public.tablon_recibidas (recipient_id, sender_id, body, dibujo, recortado, author_allows_public)
    values (destino, me, '', limpio, coalesce(forma, false), coalesce(permite_publico, false))
    returning id into nueva;
  update public.tablon_cuota q set result_id = nueva where q.sender_id = me and q.recipient_id = destino and q.day_utc = hoy;
  return jsonb_build_object('id', nueva, 'repetida', false);
end;
$$;
revoke all on function public.tablon_enviar_dibujo(uuid, jsonb, boolean, boolean, uuid) from public, anon;
grant execute on function public.tablon_enviar_dibujo(uuid, jsonb, boolean, boolean, uuid) to authenticated;
