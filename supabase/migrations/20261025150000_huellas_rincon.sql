-- 1.35.0 · Las historias dejan huella (SPEC §28.10). Migración ADITIVA y re-ejecutable: no borra columnas, filas
-- ni políticas existentes. Rincón ilustrado (recuerdos, última/próxima lectura, libros que te representan),
-- adorno estético del avatar, colecciones individuales y distinciones asignadas por administración.
-- Aplicar en el SQL Editor de Supabase (desarrollo primero). Probada con PGlite (src/features/social/__tests__).

-- ── Rincón: recuerdos, última y próxima lectura, libros que te representan, escena ─────────────────────────
alter table public.corners add column if not exists memories jsonb not null default '[]'::jsonb;
alter table public.corners add column if not exists last_book jsonb;
alter table public.corners add column if not exists next_book jsonb;
alter table public.corners add column if not exists signature_books jsonb not null default '[]'::jsonb;
alter table public.corners add column if not exists scene text not null default 'dia';

alter table public.corners drop constraint if exists corners_memories_check;
alter table public.corners add constraint corners_memories_check check (jsonb_typeof(memories) = 'array' and jsonb_array_length(memories) <= 3);
alter table public.corners drop constraint if exists corners_signature_books_check;
alter table public.corners add constraint corners_signature_books_check check (jsonb_typeof(signature_books) = 'array' and jsonb_array_length(signature_books) <= 5);
alter table public.corners drop constraint if exists corners_scene_check;
alter table public.corners add constraint corners_scene_check check (scene in ('dia', 'lluvia', 'noche'));
alter table public.corners drop constraint if exists corners_book_objects_check;
alter table public.corners add constraint corners_book_objects_check check (
  (last_book is null or jsonb_typeof(last_book) = 'object') and (next_book is null or jsonb_typeof(next_book) = 'object')
);

-- ¿Es `item` una referencia pública válida a un libro de `lib`? Solo id, título, autor, portada y una frase
-- opcional de ≤ 160 caracteres; nunca notas, citas, reseña ni progreso.
create or replace function public.corner_book_ok(lib jsonb, item jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(item) = 'object'
    and not (item ?| array['notes', 'quotes', 'review', 'currentPage', 'currentPercent', 'readingLog'])
    and coalesce((select bool_and(k in ('id', 'title', 'author', 'cover', 'phrase')) from jsonb_object_keys(item) k), false)
    and char_length(coalesce(item ->> 'phrase', '')) <= 160
    and lib is not null
    and exists (select 1 from jsonb_array_elements(lib -> 'books') b where b ->> 'id' = item ->> 'id');
$$;
revoke all on function public.corner_book_ok(jsonb, jsonb) from public, anon, authenticated;

-- Se amplía la validación de la entrega 3 (mismo nombre: el disparador existente la usa).
create or replace function public.corners_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lib jsonb;
  item jsonb;
  fig text;
begin
  select l.data into lib from public.libraries l where l.user_id = new.user_id;
  for item in select * from jsonb_array_elements(new.featured_books) loop
    if jsonb_typeof(item) <> 'object' or (item ?| array['notes', 'quotes', 'review', 'currentPage']) then
      raise exception 'Un libro destacado solo puede llevar id, título, autor y portada.';
    end if;
    if lib is null or not exists (select 1 from jsonb_array_elements(lib -> 'books') b where b ->> 'id' = item ->> 'id') then
      raise exception 'Ese libro no está en tu biblioteca.';
    end if;
  end loop;
  foreach fig in array new.figure_ids loop
    if lib is null or not coalesce((lib -> 'progress' -> 'figures' -> 'owned') ? fig, false) then
      raise exception 'Solo puedes exponer figuras desbloqueadas.';
    end if;
  end loop;
  if new.guardian_id is not null and (lib is null or not coalesce((lib -> 'progress' -> 'figures' -> 'owned') ? new.guardian_id, false)) then
    raise exception 'Solo puedes exponer figuras desbloqueadas.';
  end if;
  -- 1.35.0: libros que te representan, última y próxima lectura
  for item in select * from jsonb_array_elements(new.signature_books) loop
    if not public.corner_book_ok(lib, item) then
      raise exception 'Un libro del rincón solo puede llevar id, título, autor, portada y una frase breve, y debe estar en tu biblioteca.';
    end if;
  end loop;
  if new.last_book is not null and not public.corner_book_ok(lib, new.last_book) then
    raise exception 'Tu última lectura debe estar en tu biblioteca.';
  end if;
  if new.next_book is not null and not public.corner_book_ok(lib, new.next_book) then
    raise exception 'Tu próxima lectura debe estar en tu biblioteca.';
  end if;
  -- Recuerdos expuestos: objeto del catálogo, libro de tu biblioteca y dedicatoria opcional (sin IA ni emociones)
  for item in select * from jsonb_array_elements(new.memories) loop
    if jsonb_typeof(item) <> 'object'
      or not coalesce(item ->> 'object' in ('farol', 'barquito', 'planta', 'tintero', 'mapa'), false)
      or coalesce((select bool_or(k not in ('id', 'object', 'book', 'dedication')) from jsonb_object_keys(item) k), false)
      or char_length(coalesce(item ->> 'dedication', '')) > 200
      or not public.corner_book_ok(lib, item -> 'book') then
      raise exception 'Un recuerdo lleva un objeto del catálogo, un libro de tu biblioteca y una dedicatoria breve.';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.corners_validate() from public, anon, authenticated;

-- ── Adorno estético del avatar: preferencia visual, NUNCA un permiso ─────────────────────────────────────
alter table public.profiles add column if not exists adornment_id text;
alter table public.profiles drop constraint if exists profiles_adornment_check;
alter table public.profiles add constraint profiles_adornment_check check (
  adornment_id is null or adornment_id in ('cerezo', 'dark-academia', 'constelaciones', 'jardin-cartas', 'bosque-tinta')
);

-- ── Colecciones individuales (sin edición colaborativa) ──────────────────────────────────────────────────
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  dedication text check (char_length(dedication) <= 300),
  books      jsonb not null default '[]'::jsonb check (jsonb_typeof(books) = 'array' and jsonb_array_length(books) between 1 and 12),
  visible    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collections_owner on public.collections (owner);

create or replace function public.collections_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lib jsonb;
  item jsonb;
begin
  if tg_op = 'UPDATE' and new.owner <> old.owner then
    raise exception 'Una colección no cambia de dueño.';
  end if;
  select l.data into lib from public.libraries l where l.user_id = new.owner;
  for item in select * from jsonb_array_elements(new.books) loop
    if not public.corner_book_ok(lib, item) then
      raise exception 'Los libros de una colección deben estar en tu biblioteca y solo llevan id, título, autor, portada y una frase breve.';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.collections_validate() from public, anon, authenticated;
drop trigger if exists collections_validate on public.collections;
create trigger collections_validate before insert or update on public.collections for each row execute function public.collections_validate();
drop trigger if exists collections_rate on public.collections;
create trigger collections_rate before insert or update on public.collections for each row execute function public.enforce_rate_limit('20');

alter table public.collections enable row level security;
revoke all on public.collections from anon;
grant select, insert, update, delete on public.collections to authenticated;
drop policy if exists "ver colecciones" on public.collections;
create policy "ver colecciones" on public.collections for select to authenticated using (
  owner = (select auth.uid()) or (visible and public.community_member(owner) and not public.is_blocked_pair(owner))
);
drop policy if exists "crear mi colección" on public.collections;
create policy "crear mi colección" on public.collections for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists "editar mi colección" on public.collections;
create policy "editar mi colección" on public.collections for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists "borrar mi colección" on public.collections;
create policy "borrar mi colección" on public.collections for delete to authenticated using (owner = (select auth.uid()));

-- ── Distinciones: premios y roles visibles, asignados SOLO por administración ─────────────────────────────
-- Sin políticas ni permisos de escritura para `anon` ni `authenticated`: nadie se concede una distinción desde
-- la app. Se asignan desde el SQL Editor, p. ej.:
--   insert into public.distinctions (user_id, kind, note, awarded_on) values ('<uuid>', 'fundadora', 'Comunidad fundadora', current_date);
-- No hay umbrales automáticos, ganadores ni desafíos: si nadie asigna nada, no se muestra nada.
create table if not exists public.distinctions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('semanal', 'mensual', 'moderacion', 'creadora', 'equipo', 'fundadora')),
  note       text check (char_length(note) <= 200),
  awarded_on date,
  created_at timestamptz not null default now(),
  unique (user_id, kind, awarded_on)
);
create index if not exists distinctions_user on public.distinctions (user_id);
alter table public.distinctions enable row level security;
revoke all on public.distinctions from anon, authenticated;
grant select on public.distinctions to authenticated;
drop policy if exists "ver distinciones" on public.distinctions;
create policy "ver distinciones" on public.distinctions for select to authenticated using (
  user_id = (select auth.uid()) or (public.community_member(user_id) and not public.is_blocked_pair(user_id))
);

-- Rol de moderación visible junto al nombre: solo dice SI alguien de la lista modera (no expone la tabla).
create or replace function public.moderators_among(ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id from public.moderators m
  where m.user_id = any (ids) and (m.user_id = auth.uid() or (public.community_member(m.user_id) and not public.is_blocked_pair(m.user_id)));
$$;
revoke all on function public.moderators_among(uuid[]) from public, anon;
grant execute on function public.moderators_among(uuid[]) to authenticated;
