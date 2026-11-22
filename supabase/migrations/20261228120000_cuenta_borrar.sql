-- Borrar la cuenta (Play Store, docs/qa/play-store.md §2.1). Google exige poder borrar la cuenta desde la app y desde la web.
-- Decisión de Francisco (20-11-2026): lo que la cuenta dejó a otros queda como «Lector anónimo», no se borra.
--
-- - Casi todo cuelga de `auth.users` con `on delete cascade`: al borrar el usuario se va su biblioteca, su perfil, su piso, su
--   café, sus partidas y lo que solo era suyo.
-- - Quedan, sin dueño (`user_id` / `sender_id` a null): sus reseñas públicas, sus mensajes en clubes, los post-its y dibujos que
--   envió (siguen en el tablón de quien los recibió) y los lomos que dejó en la librería común de la sala de lectura. Se
--   muestran como «Lector anónimo» y ya no se puede saber de quién eran.
-- - Sus clubes pasan al miembro más antiguo; si no queda nadie, el club se borra.
-- - `cuenta_borrar('BORRAR')` borra la cuenta de quien llama, y solo esa.
--
-- La aplica Francisco en el SQL Editor. Requiere todas las migraciones anteriores.

-- ── 1. Lo que se deja a otros: sin dueño en vez de borrarse ──
do $$
declare
  r record;
  c text;
begin
  for r in select * from (values ('public_reviews', 'user_id'), ('club_messages', 'user_id'), ('tablon_recibidas', 'sender_id'), ('sala_lomos', 'user_id')) v(t, col) loop
    for c in
      select con.conname
        from pg_constraint con
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
       where con.conrelid = ('public.' || r.t)::regclass and con.contype = 'f' and a.attname = r.col
         and con.confrelid = 'auth.users'::regclass
    loop
      execute format('alter table public.%I drop constraint %I', r.t, c);
    end loop;
    execute format('alter table public.%I alter column %I drop not null', r.t, r.col);
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      r.t, r.t || '_' || r.col || '_fkey', r.col);
  end loop;
end;
$$;

-- ── 2. Las reseñas anónimas se siguen viendo y contando ──
drop policy if exists "ver opiniones" on public.public_reviews;
create policy "ver opiniones" on public.public_reviews for select to authenticated using (
  user_id = (select auth.uid())
  or (status = 'published' and (user_id is null or (public.community_member(user_id) and not public.is_blocked_pair(user_id))))
);

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
where r.status = 'published' and (r.user_id is null or public.community_member(r.user_id))
group by r.work_id;
revoke all on public.work_review_stats from anon;
grant select on public.work_review_stats to authenticated;

create or replace view public.work_trope_stats with (security_invoker = true) as
with answered as (
  select r.work_id, r.tropes
  from public.public_reviews r
  where r.status = 'published' and r.tropes is not null and (r.user_id is null or public.community_member(r.user_id))
)
select a.work_id, t.trope, count(*) filter (where t.trope is not null) as votes, max(n.respondents) as respondents
from answered a
join (select work_id, count(*) as respondents from answered group by work_id) n on n.work_id = a.work_id
left join lateral unnest(a.tropes) as t(trope) on true
group by a.work_id, t.trope;
revoke all on public.work_trope_stats from anon;
grant select on public.work_trope_stats to authenticated;

-- ── 3. Los lomos anónimos siguen en la librería común ──
create or replace function public.sala_libreria()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  total integer;
  filas jsonb;
begin
  if me is null then
    return null;
  end if;
  select count(*)::integer into total from public.sala_lomos l
    where l.user_id = me or l.user_id is null or (public.community_member(l.user_id) and not public.is_blocked_pair(l.user_id));
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'alias', x.alias, 'mio', coalesce(x.user_id = me, false)) order by x.created_at desc), '[]'::jsonb)
    into filas
    from (
      select l.id, l.titulo, l.user_id, l.created_at, p.alias
        from public.sala_lomos l
        left join public.profiles p on p.user_id = l.user_id
        where l.user_id = me or l.user_id is null or (public.community_member(l.user_id) and not public.is_blocked_pair(l.user_id))
        order by l.created_at desc
        limit 40
    ) x;
  return jsonb_build_object('total', total, 'lomos', filas);
end;
$$;
revoke all on function public.sala_libreria() from public, anon;
grant execute on function public.sala_libreria() to authenticated;

-- ── 4. El propietario de un club sigue sin poder cambiarse, salvo al borrar su cuenta (solo desde `cuenta_borrar`) ──
create or replace function public.clubs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.owner := auth.uid();
  elsif new.owner <> old.owner and coalesce(current_setting('libotown.cuenta_borrar', true), '') <> 'borrando' then
    raise exception 'El propietario de un club no cambia.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.clubs_guard() from public, anon, authenticated;

-- Mientras se borra una cuenta, las cascadas que dejan sus reseñas y mensajes sin dueño no cuentan como escrituras suyas (con
-- muchas, el límite impediría borrar la cuenta). Por lo demás, igual que en 20261025090000_entrega2_identidad_opiniones.sql.
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
  if me is null or coalesce(current_setting('libotown.cuenta_borrar', true), '') = 'borrando' then
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

-- ── 5. Borrar la cuenta propia ──
create or replace function public.cuenta_borrar(confirmacion text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c record;
  nuevo uuid;
begin
  if me is null then
    raise exception 'cuenta:sesion' using errcode = 'P0001';
  end if;
  if confirmacion is distinct from 'BORRAR' then
    raise exception 'cuenta:confirmacion' using errcode = 'P0001';
  end if;
  -- Mientras dura el borrado (solo en esta transacción): se puede cambiar el propietario de sus clubes y las cascadas no
  -- cuentan para el límite de frecuencia
  perform set_config('libotown.cuenta_borrar', 'borrando', true);
  -- Sus clubes: al miembro más antiguo que quede; sin nadie más, el club se va
  for c in select k.id from public.clubs k where k.owner = me for update loop
    nuevo := null;
    select m.user_id into nuevo
      from public.club_members m
     where m.club_id = c.id and m.user_id <> me
     order by m.joined_at, m.user_id
     limit 1;
    if nuevo is null then
      delete from public.clubs k where k.id = c.id;
    else
      update public.clubs k set owner = nuevo where k.id = c.id;
      update public.club_members m set role = 'owner' where m.club_id = c.id and m.user_id = nuevo;
    end if;
  end loop;
  -- Lo demás lo hacen las cascadas (y los `set null` de arriba)
  delete from auth.users u where u.id = me;
  -- Lo único sin clave ajena a `auth.users`: las marcas de los límites de frecuencia
  delete from public.rate_events r where r.user_id = me;
  perform set_config('libotown.cuenta_borrar', '', true);
end;
$$;
revoke all on function public.cuenta_borrar(text) from public, anon;
grant execute on function public.cuenta_borrar(text) to authenticated;
