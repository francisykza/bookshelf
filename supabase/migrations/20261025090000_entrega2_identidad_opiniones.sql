-- BookShelf · Entrega 2 (SPEC §25.2–25.6): perfiles con alias y avatar, identidad mínima de obra, opiniones
-- públicas explícitas, estadísticas en el servidor, bloqueos, denuncias y moderación.
-- Aditiva: no toca `libraries` ni ningún dato existente. Se puede volver a ejecutar.
-- «Público» = visible para otros miembros AUTENTICADOS con la comunidad activada; `anon` no recibe nada.

-- ── Límite de escritura en el servidor ─────────────────────────────────────────────────────────────────────
create table if not exists public.rate_events (
  user_id uuid not null,
  action  text not null,
  at      timestamptz not null default now()
);
create index if not exists rate_events_user_action_at on public.rate_events (user_id, action, at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

-- Cuenta las escrituras de cada persona por acción y rechaza las que superan `max_per_minute` en 60 s.
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  max_per_minute integer := coalesce(nullif(tg_argv[0], '')::integer, 20);
  recent integer;
begin
  if me is null then
    return new;
  end if;
  delete from public.rate_events where at < now() - interval '1 hour';
  select count(*) into recent from public.rate_events
    where user_id = me and action = tg_table_name and at > now() - interval '60 seconds';
  if recent >= max_per_minute then
    raise exception 'Demasiadas escrituras seguidas; espera un momento.' using errcode = 'P0001';
  end if;
  insert into public.rate_events (user_id, action) values (me, tg_table_name);
  return new;
end;
$$;
revoke all on function public.enforce_rate_limit() from public, anon, authenticated;

-- Hora del servidor en cada cambio
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Perfiles ───────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  alias             text not null check (char_length(alias) between 2 and 40 and alias = btrim(alias)),
  avatar_id         text check (avatar_id in ('lectora-cafe', 'lector-chaleco', 'viajera-pelirroja', 'lector-farol', 'gato-lector', 'vidente-estrellas')),
  community_enabled boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists profiles_alias_unique on public.profiles (lower(alias));

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists profiles_rate on public.profiles;
create trigger profiles_rate before insert or update on public.profiles for each row execute function public.enforce_rate_limit('20');

-- ── Bloqueos (antes que las políticas que los consultan) ──────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked on public.blocks (blocked);

-- ¿Hay un bloqueo en cualquier dirección entre quien consulta y `other`? (definer: lee ambos sentidos sin
-- exponer la tabla de bloqueos ajena)
create or replace function public.is_blocked_pair(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker = auth.uid() and b.blocked = other) or (b.blocker = other and b.blocked = auth.uid())
  );
$$;
revoke all on function public.is_blocked_pair(uuid) from public, anon;
grant execute on function public.is_blocked_pair(uuid) to authenticated;

-- ¿Tiene `who` la comunidad activada? (definer: la consultan las políticas de otras tablas)
create or replace function public.community_member(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = who and p.community_enabled);
$$;
revoke all on function public.community_member(uuid) from public, anon;
grant execute on function public.community_member(uuid) to authenticated;

alter table public.blocks enable row level security;
revoke all on public.blocks from anon;
grant select, insert, delete on public.blocks to authenticated;
drop policy if exists "ver mis bloqueos" on public.blocks;
create policy "ver mis bloqueos" on public.blocks for select to authenticated using (blocker = (select auth.uid()));
drop policy if exists "bloquear" on public.blocks;
create policy "bloquear" on public.blocks for insert to authenticated with check (blocker = (select auth.uid()));
drop policy if exists "desbloquear" on public.blocks;
create policy "desbloquear" on public.blocks for delete to authenticated using (blocker = (select auth.uid()));

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
drop policy if exists "ver perfiles" on public.profiles;
create policy "ver perfiles" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (community_enabled and not public.is_blocked_pair(user_id)));
drop policy if exists "crear mi perfil" on public.profiles;
create policy "crear mi perfil" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Identidad mínima de obra ──────────────────────────────────────────────────────────────────────────────
-- Externa solo con una referencia verificada (obra de Open Library); si no, local con identificador propio.
-- Nunca se fusiona por título.
create table if not exists public.works (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('external', 'local')),
  source      text,
  external_id text,
  title       text not null check (char_length(title) between 1 and 300),
  author      text not null default '' check (char_length(author) <= 300),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (
    (kind = 'external' and source = 'openlibrary' and external_id ~ '^/works/OL[0-9]+W$')
    or (kind = 'local' and source is null and external_id is null)
  ),
  unique (source, external_id)
);
alter table public.works enable row level security;
revoke all on public.works from anon;
grant select, insert on public.works to authenticated;
drop policy if exists "ver obras" on public.works;
create policy "ver obras" on public.works for select to authenticated using (true);
drop policy if exists "crear obras" on public.works;
create policy "crear obras" on public.works for insert to authenticated with check (created_by = (select auth.uid()));

-- ── Opiniones públicas (copia explícita; el diario y las reseñas privadas siguen en la biblioteca) ───────────
create table if not exists public.public_reviews (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references public.works (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating_quarters smallint check (rating_quarters between 1 and 20),
  body            text not null default '' check (char_length(body) <= 5000),
  has_spoilers    boolean not null default false,
  pace            smallint check (pace between 1 and 5),
  emotion         smallint check (emotion between 1 and 5),
  surprise        smallint check (surprise between 1 and 5),
  romance         smallint check (romance between 1 and 5),
  status          text not null default 'published' check (status in ('published', 'withdrawn', 'moderated')),
  published_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (work_id, user_id)
);
create index if not exists public_reviews_page on public.public_reviews (work_id, status, published_at desc, id desc);
create index if not exists public_reviews_author on public.public_reviews (user_id, published_at desc);

-- Una opinión no cambia de autor ni de obra; la fecha de publicación la pone el servidor al (re)publicar
create or replace function public.public_reviews_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.work_id <> old.work_id then
      raise exception 'No se puede cambiar el autor ni la obra de una opinión.';
    end if;
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
    else
      new.published_at := old.published_at;
    end if;
  else
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists public_reviews_guard on public.public_reviews;
create trigger public_reviews_guard before insert or update on public.public_reviews for each row execute function public.public_reviews_guard();
drop trigger if exists public_reviews_rate on public.public_reviews;
create trigger public_reviews_rate before insert or update on public.public_reviews for each row execute function public.enforce_rate_limit('20');

alter table public.public_reviews enable row level security;
revoke all on public.public_reviews from anon;
grant select, insert, update on public.public_reviews to authenticated;
drop policy if exists "ver opiniones" on public.public_reviews;
create policy "ver opiniones" on public.public_reviews for select to authenticated using (
  user_id = (select auth.uid())
  or (status = 'published' and public.community_member(user_id) and not public.is_blocked_pair(user_id))
);
drop policy if exists "publicar mi opinión" on public.public_reviews;
create policy "publicar mi opinión" on public.public_reviews for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'published' and public.community_member((select auth.uid()))
);
-- El autor publica, actualiza y retira; no puede tocar una opinión retirada por moderación ni marcarla así
drop policy if exists "editar mi opinión" on public.public_reviews;
create policy "editar mi opinión" on public.public_reviews for update to authenticated
  using (user_id = (select auth.uid()) and status <> 'moderated')
  with check (user_id = (select auth.uid()) and status in ('published', 'withdrawn'));

-- ── Estadísticas en el servidor (sin descargar reseñas); respetan las políticas de quien consulta ─────────
-- Intervalos de las cinco barras sobre cuartos: (0,1] = 1–4, (1,2] = 5–8, (2,3] = 9–12, (3,4] = 13–16, (4,5] = 17–20
create or replace view public.work_review_stats with (security_invoker = true) as
select
  r.work_id,
  count(*)                                                    as reviews,
  count(r.rating_quarters)                                    as ratings,
  avg(r.rating_quarters)::numeric / 4                         as average,
  count(*) filter (where r.rating_quarters between 1 and 4)   as band_1,
  count(*) filter (where r.rating_quarters between 5 and 8)   as band_2,
  count(*) filter (where r.rating_quarters between 9 and 12)  as band_3,
  count(*) filter (where r.rating_quarters between 13 and 16) as band_4,
  count(*) filter (where r.rating_quarters between 17 and 20) as band_5,
  count(r.pace) as pace_n,         avg(r.pace)::numeric     as pace_avg,
  count(r.emotion) as emotion_n,   avg(r.emotion)::numeric  as emotion_avg,
  count(r.surprise) as surprise_n, avg(r.surprise)::numeric as surprise_avg,
  count(r.romance) as romance_n,   avg(r.romance)::numeric  as romance_avg
from public.public_reviews r
where r.status = 'published' and public.community_member(r.user_id)
group by r.work_id;
revoke all on public.work_review_stats from anon;
grant select on public.work_review_stats to authenticated;

-- ── Denuncias y moderación ────────────────────────────────────────────────────────────────────────────────
-- Moderadores: solo se asignan desde el SQL Editor (sin políticas de escritura: nadie se los concede a sí mismo)
create table if not exists public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.moderators enable row level security;
revoke all on public.moderators from anon, authenticated;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.moderators m where m.user_id = auth.uid());
$$;
revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('review', 'club_message')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now(),
  unique (reporter, target_type, target_id)
);
drop trigger if exists reports_rate on public.reports;
create trigger reports_rate before insert on public.reports for each row execute function public.enforce_rate_limit('10');
alter table public.reports enable row level security;
revoke all on public.reports from anon;
grant select, insert on public.reports to authenticated;
drop policy if exists "ver mis denuncias" on public.reports;
create policy "ver mis denuncias" on public.reports for select to authenticated
  using (reporter = (select auth.uid()) or public.is_moderator());
drop policy if exists "denunciar" on public.reports;
create policy "denunciar" on public.reports for insert to authenticated with check (reporter = (select auth.uid()));

-- Retirar una opinión por moderación (deja de verse y de contar). Solo moderadores.
create or replace function public.moderate_review(review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Solo moderación autorizada.' using errcode = '42501';
  end if;
  update public.public_reviews set status = 'moderated' where id = review_id;
end;
$$;
revoke all on function public.moderate_review(uuid) from public, anon;
grant execute on function public.moderate_review(uuid) to authenticated;
