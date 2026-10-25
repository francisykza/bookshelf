-- BookShelf · Entrega 3 (SPEC §25.8–25.12): seguir lectores, rincón compartido, leer en compañía, club de lectura y
-- tropos. Aditiva: no borra ni reescribe datos; añade columnas opcionales a `public_reviews`. Se puede volver a
-- ejecutar. Requiere la migración de la entrega 2.

-- ── Seguir ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followed   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followed),
  check (follower <> followed)
);
create index if not exists follows_followed on public.follows (followed);
drop trigger if exists follows_rate on public.follows;
create trigger follows_rate before insert on public.follows for each row execute function public.enforce_rate_limit('30');

alter table public.follows enable row level security;
revoke all on public.follows from anon;
grant select, insert, delete on public.follows to authenticated;
drop policy if exists "ver mis seguimientos" on public.follows;
create policy "ver mis seguimientos" on public.follows for select to authenticated
  using (follower = (select auth.uid()) or followed = (select auth.uid()));
drop policy if exists "seguir" on public.follows;
create policy "seguir" on public.follows for insert to authenticated with check (
  follower = (select auth.uid())
  and public.community_member((select auth.uid()))
  and public.community_member(followed)
  and not public.is_blocked_pair(followed)
);
drop policy if exists "dejar de seguir" on public.follows;
create policy "dejar de seguir" on public.follows for delete to authenticated using (follower = (select auth.uid()));

-- Bloquear deshace los seguimientos en ambos sentidos
create or replace function public.blocks_cut_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower = new.blocker and followed = new.blocked) or (follower = new.blocked and followed = new.blocker);
  return new;
end;
$$;
revoke all on function public.blocks_cut_follows() from public, anon, authenticated;
drop trigger if exists blocks_cut_follows on public.blocks;
create trigger blocks_cut_follows after insert on public.blocks for each row execute function public.blocks_cut_follows();

-- ── Rincón compartido (selección voluntaria) ──────────────────────────────────────────────────────────────
create table if not exists public.corners (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  visible        boolean not null default false,
  featured_books jsonb not null default '[]'::jsonb check (jsonb_typeof(featured_books) = 'array' and jsonb_array_length(featured_books) <= 3),
  figure_ids     text[] not null default '{}' check (cardinality(figure_ids) <= 3),
  guardian_id    text,
  show_current   boolean not null default false,
  current_title  text check (char_length(current_title) <= 300),
  updated_at     timestamptz not null default now(),
  check (show_current or current_title is null)
);

-- Solo se expone lo que de verdad está en la biblioteca de su dueño: libros suyos (id, título, autor y portada)
-- y figuras desbloqueadas (`progress.figures.owned`); el Guardián, también desbloqueado.
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
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.corners_validate() from public, anon, authenticated;
drop trigger if exists corners_validate on public.corners;
create trigger corners_validate before insert or update on public.corners for each row execute function public.corners_validate();
drop trigger if exists corners_rate on public.corners;
create trigger corners_rate before insert or update on public.corners for each row execute function public.enforce_rate_limit('20');

alter table public.corners enable row level security;
revoke all on public.corners from anon;
grant select, insert, update, delete on public.corners to authenticated;
drop policy if exists "ver rincones" on public.corners;
create policy "ver rincones" on public.corners for select to authenticated using (
  user_id = (select auth.uid()) or (visible and public.community_member(user_id) and not public.is_blocked_pair(user_id))
);
drop policy if exists "crear mi rincón" on public.corners;
create policy "crear mi rincón" on public.corners for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "editar mi rincón" on public.corners;
create policy "editar mi rincón" on public.corners for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "borrar mi rincón" on public.corners;
create policy "borrar mi rincón" on public.corners for delete to authenticated using (user_id = (select auth.uid()));

-- ── Leer en compañía (presencia voluntaria con caducidad) ─────────────────────────────────────────────────
-- Una sesión por persona; `last_seen` se renueva cada minuto mientras la app está a la vista. Pasados 3 minutos
-- sin renovar, la persona deja de aparecer (suspensión del móvil, desconexión). No registra páginas ni premios.
create table if not exists public.reading_presence (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  share_book boolean not null default false,
  book_title text check (char_length(book_title) <= 300),
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  check (share_book or book_title is null)
);
create index if not exists reading_presence_seen on public.reading_presence (last_seen desc);

-- La hora la pone el servidor: el cliente no puede fingir una sesión más larga ni «estar» indefinidamente
create or replace function public.reading_presence_clock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
  elsif old.last_seen < now() - interval '3 minutes' then
    new.started_at := now();
  else
    new.started_at := old.started_at;
  end if;
  new.last_seen := now();
  return new;
end;
$$;
drop trigger if exists reading_presence_clock on public.reading_presence;
create trigger reading_presence_clock before insert or update on public.reading_presence for each row execute function public.reading_presence_clock();
drop trigger if exists reading_presence_rate on public.reading_presence;
create trigger reading_presence_rate before insert or update on public.reading_presence for each row execute function public.enforce_rate_limit('10');

alter table public.reading_presence enable row level security;
revoke all on public.reading_presence from anon;
grant select, insert, update, delete on public.reading_presence to authenticated;
drop policy if exists "ver quién lee" on public.reading_presence;
create policy "ver quién lee" on public.reading_presence for select to authenticated using (
  user_id = (select auth.uid())
  or (last_seen > now() - interval '3 minutes' and public.community_member(user_id) and not public.is_blocked_pair(user_id))
);
drop policy if exists "sentarme" on public.reading_presence;
create policy "sentarme" on public.reading_presence for insert to authenticated
  with check (user_id = (select auth.uid()) and public.community_member((select auth.uid())));
drop policy if exists "seguir sentado" on public.reading_presence;
create policy "seguir sentado" on public.reading_presence for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "levantarme" on public.reading_presence;
create policy "levantarme" on public.reading_presence for delete to authenticated using (user_id = (select auth.uid()));

-- ── Club de lectura ───────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.clubs (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 80),
  description      text not null default '' check (char_length(description) <= 280),
  work_id          uuid references public.works (id) on delete set null,
  work_title       text check (char_length(work_title) <= 300),
  discussion_point text not null default '' check (char_length(discussion_point) <= 120),
  status           text not null default 'active' check (status in ('active', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_members_user on public.club_members (user_id);

create or replace function public.is_club_member(club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.club_members m where m.club_id = club and m.user_id = auth.uid());
$$;
revoke all on function public.is_club_member(uuid) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;

create or replace function public.is_club_owner(club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clubs c where c.id = club and c.owner = auth.uid());
$$;
revoke all on function public.is_club_owner(uuid) from public, anon;
grant execute on function public.is_club_owner(uuid) to authenticated;

-- Quien crea el club es su propietario y su primer miembro; el propietario no cambia
create or replace function public.clubs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner := auth.uid();
  elsif new.owner <> old.owner then
    raise exception 'El propietario de un club no cambia.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.clubs_guard() from public, anon, authenticated;
drop trigger if exists clubs_guard on public.clubs;
create trigger clubs_guard before insert or update on public.clubs for each row execute function public.clubs_guard();
drop trigger if exists clubs_rate on public.clubs;
create trigger clubs_rate before insert on public.clubs for each row execute function public.enforce_rate_limit('5');

create or replace function public.clubs_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_members (club_id, user_id, role) values (new.id, new.owner, 'owner') on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.clubs_add_owner() from public, anon, authenticated;
drop trigger if exists clubs_add_owner on public.clubs;
create trigger clubs_add_owner after insert on public.clubs for each row execute function public.clubs_add_owner();

alter table public.clubs enable row level security;
revoke all on public.clubs from anon;
grant select, insert, update on public.clubs to authenticated;
drop policy if exists "ver mis clubes" on public.clubs;
create policy "ver mis clubes" on public.clubs for select to authenticated using (public.is_club_member(id) or owner = (select auth.uid()));
drop policy if exists "crear club" on public.clubs;
create policy "crear club" on public.clubs for insert to authenticated with check (public.community_member((select auth.uid())));
drop policy if exists "editar mi club" on public.clubs;
create policy "editar mi club" on public.clubs for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

alter table public.club_members enable row level security;
revoke all on public.club_members from anon;
grant select, delete on public.club_members to authenticated;
drop policy if exists "ver miembros" on public.club_members;
create policy "ver miembros" on public.club_members for select to authenticated using (public.is_club_member(club_id));
-- Salir (cualquier miembro salvo el propietario) o retirar a alguien (el propietario)
drop policy if exists "salir o retirar" on public.club_members;
create policy "salir o retirar" on public.club_members for delete to authenticated using (
  (user_id = (select auth.uid()) and role <> 'owner') or (public.is_club_owner(club_id) and role <> 'owner')
);

-- Invitaciones: un token aleatorio largo (no predecible), revocable y con caducidad; solo el propietario las ve
create table if not exists public.club_invites (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  revoked    boolean not null default false,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
drop trigger if exists club_invites_rate on public.club_invites;
create trigger club_invites_rate before insert on public.club_invites for each row execute function public.enforce_rate_limit('10');
alter table public.club_invites enable row level security;
revoke all on public.club_invites from anon;
grant select, insert, update on public.club_invites to authenticated;
drop policy if exists "ver invitaciones de mi club" on public.club_invites;
create policy "ver invitaciones de mi club" on public.club_invites for select to authenticated using (public.is_club_owner(club_id));
drop policy if exists "invitar" on public.club_invites;
create policy "invitar" on public.club_invites for insert to authenticated
  with check (public.is_club_owner(club_id) and created_by = (select auth.uid()));
drop policy if exists "revocar" on public.club_invites;
create policy "revocar" on public.club_invites for update to authenticated
  using (public.is_club_owner(club_id)) with check (public.is_club_owner(club_id));

-- Aceptar una invitación (validada en el servidor). Antes de aceptar no se ve nada del club.
create or replace function public.accept_club_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.club_invites%rowtype;
  club public.clubs%rowtype;
begin
  if auth.uid() is null or not public.community_member(auth.uid()) then
    raise exception 'Activa la comunidad en tu perfil para unirte a un club.' using errcode = '42501';
  end if;
  select * into inv from public.club_invites where token = invite_token;
  if not found or inv.revoked or inv.expires_at < now() then
    raise exception 'Esta invitación no es válida o ha caducado.' using errcode = 'P0001';
  end if;
  select * into club from public.clubs where id = inv.club_id;
  if club.status <> 'active' then
    raise exception 'Este club está cerrado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.blocks b where (b.blocker = auth.uid() and b.blocked = club.owner) or (b.blocker = club.owner and b.blocked = auth.uid())) then
    raise exception 'Esta invitación no es válida o ha caducado.' using errcode = 'P0001';
  end if;
  insert into public.club_members (club_id, user_id, role) values (club.id, auth.uid(), 'member') on conflict do nothing;
  return club.id;
end;
$$;
revoke all on function public.accept_club_invite(text) from public, anon;
grant execute on function public.accept_club_invite(text) to authenticated;

-- Mensajes de debate
create table if not exists public.club_messages (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  has_spoilers boolean not null default false,
  status       text not null default 'visible' check (status in ('visible', 'deleted', 'removed')),
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);
create index if not exists club_messages_page on public.club_messages (club_id, created_at desc, id desc);

-- El autor edita o borra su mensaje; el propietario solo puede retirarlo (no reescribirlo)
create or replace function public.club_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.club_id <> old.club_id or new.created_at <> old.created_at then
    raise exception 'No se puede cambiar el autor, el club ni la fecha de un mensaje.';
  end if;
  if auth.uid() = old.user_id then
    if new.status = 'removed' then
      raise exception 'Solo el propietario del club retira mensajes.';
    end if;
    if new.body <> old.body or new.has_spoilers <> old.has_spoilers then
      new.edited_at := now();
    end if;
  elsif public.is_club_owner(old.club_id) then
    if new.body <> old.body or new.has_spoilers <> old.has_spoilers or new.status <> 'removed' then
      raise exception 'El propietario solo puede retirar mensajes.';
    end if;
  else
    raise exception 'No puedes cambiar este mensaje.';
  end if;
  return new;
end;
$$;
revoke all on function public.club_messages_guard() from public, anon, authenticated;
drop trigger if exists club_messages_guard on public.club_messages;
create trigger club_messages_guard before update on public.club_messages for each row execute function public.club_messages_guard();
drop trigger if exists club_messages_rate on public.club_messages;
create trigger club_messages_rate before insert or update on public.club_messages for each row execute function public.enforce_rate_limit('20');

alter table public.club_messages enable row level security;
revoke all on public.club_messages from anon;
grant select, insert, update on public.club_messages to authenticated;
drop policy if exists "leer mensajes del club" on public.club_messages;
-- Los miembros leen los mensajes visibles; el autor ve los suyos y el propietario también los retirados (moderación)
create policy "leer mensajes del club" on public.club_messages for select to authenticated using (
  public.is_club_member(club_id)
  and (status = 'visible' or user_id = (select auth.uid()) or public.is_club_owner(club_id))
  and not public.is_blocked_pair(user_id)
);
drop policy if exists "escribir en el club" on public.club_messages;
create policy "escribir en el club" on public.club_messages for insert to authenticated with check (
  user_id = (select auth.uid())
  and status = 'visible'
  and public.is_club_member(club_id)
  and exists (select 1 from public.clubs c where c.id = club_id and c.status = 'active')
);
drop policy if exists "editar o retirar mensajes" on public.club_messages;
create policy "editar o retirar mensajes" on public.club_messages for update to authenticated
  using (user_id = (select auth.uid()) or public.is_club_owner(club_id))
  with check (user_id = (select auth.uid()) or public.is_club_owner(club_id));

-- ── Tropos (catálogo curado) en la opinión pública ────────────────────────────────────────────────────────
-- `tropes` null = no respondió; '{}' con `tropes_none` = confirmó que ninguna encaja; con elementos = selección.
alter table public.public_reviews add column if not exists tropes text[];
alter table public.public_reviews add column if not exists tropes_none boolean not null default false;
alter table public.public_reviews drop constraint if exists public_reviews_tropes_check;
alter table public.public_reviews add constraint public_reviews_tropes_check check (
  (tropes is null and not tropes_none)
  or (tropes_none and tropes = '{}')
  or (not tropes_none and cardinality(tropes) between 1 and 6
      and tropes <@ array['familia-encontrada', 'enemigos-a-amantes', 'fuego-lento', 'academia', 'viaje-iniciatico', 'intriga-politica']::text[])
);

create or replace view public.work_trope_stats with (security_invoker = true) as
with answered as (
  select r.work_id, r.tropes
  from public.public_reviews r
  where r.status = 'published' and r.tropes is not null and public.community_member(r.user_id)
)
select a.work_id, t.trope, count(*) filter (where t.trope is not null) as votes, max(n.respondents) as respondents
from answered a
join (select work_id, count(*) as respondents from answered group by work_id) n on n.work_id = a.work_id
left join lateral unnest(a.tropes) as t(trope) on true
group by a.work_id, t.trope;
revoke all on public.work_trope_stats from anon;
grant select on public.work_trope_stats to authenticated;
