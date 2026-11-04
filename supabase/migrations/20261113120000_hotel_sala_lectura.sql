-- 1.83 (docs/qa/gran-hotel.md §9.5): la sala de lectura del Gran Hotel. La aplica Francisco en el SQL Editor. Probada con
-- PGlite (sala-lectura.rls.test.js). Sin ella, la sala funciona: dibuja a los vecinos y a ti, a los demás con el personaje
-- de base, y no enseña la librería ni el saludo.
--   · Quien lee se ve con su personaje y su compañero. Puede ser de otro edificio y `pisos` solo deja ver a los vecinos,
--     así que `sala_lectura_personajes` da ese aspecto y nada más, y solo de quien se ve ya en `reading_presence`.
--   · La librería común (Francisco, 4-11-2026, «Librería y compañía»): quien termina un libro leyendo en la sala puede
--     dejar su lomo, con su nombre, a la vista de todos. Lo decide cada vez y puede retirarlo. Hasta 3 al día, y cada
--     título una vez por persona.
--   · El saludo: un gesto cerrado, sin texto, entre dos personas sentadas a la vez. Uno cada media hora por pareja.
-- No toca tickets ni recompensas. Las tablas nuevas no se leen ni se escriben directamente: todo pasa por funciones.
create or replace function public.sala_lectura_personajes(ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  filas jsonb;
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', r.user_id, 'personaje', s.personaje, 'companero', s.companero)), '[]'::jsonb)
    into filas
    from public.reading_presence r
    join public.pisos s on s.user_id = r.user_id
    where r.user_id = any (ids[1:12])
      and (r.user_id = me or (r.last_seen > now() - interval '3 minutes' and public.community_member(r.user_id) and not public.is_blocked_pair(r.user_id)));
  return filas;
end;
$$;
revoke all on function public.sala_lectura_personajes(uuid[]) from public, anon;
grant execute on function public.sala_lectura_personajes(uuid[]) to authenticated;

create table if not exists public.sala_lomos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 120),
  created_at timestamptz not null default now()
);
create unique index if not exists sala_lomos_titulo on public.sala_lomos (user_id, lower(titulo));
create index if not exists sala_lomos_recientes on public.sala_lomos (created_at desc);
alter table public.sala_lomos enable row level security;
revoke all on public.sala_lomos from public, anon, authenticated;

create table if not exists public.sala_saludos (
  de         uuid not null references auth.users (id) on delete cascade,
  para       uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  visto      boolean not null default false,
  primary key (de, para),
  check (de <> para)
);
create index if not exists sala_saludos_para on public.sala_saludos (para) where not visto;
alter table public.sala_saludos enable row level security;
revoke all on public.sala_saludos from public, anon, authenticated;

create or replace function public.sala_sentado(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reading_presence r where r.user_id = uid and r.last_seen > now() - interval '3 minutes');
$$;
revoke all on function public.sala_sentado(uuid) from public, anon, authenticated;

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
    where l.user_id = me or (public.community_member(l.user_id) and not public.is_blocked_pair(l.user_id));
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'alias', x.alias, 'mio', x.user_id = me) order by x.created_at desc), '[]'::jsonb)
    into filas
    from (
      select l.id, l.titulo, l.user_id, l.created_at, p.alias
        from public.sala_lomos l
        left join public.profiles p on p.user_id = l.user_id
        where l.user_id = me or (public.community_member(l.user_id) and not public.is_blocked_pair(l.user_id))
        order by l.created_at desc
        limit 40
    ) x;
  return jsonb_build_object('total', total, 'lomos', filas);
end;
$$;
revoke all on function public.sala_libreria() from public, anon;
grant execute on function public.sala_libreria() to authenticated;

create or replace function public.sala_lomo_dejar(nuevo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  limpio text := btrim(coalesce(nuevo, ''));
begin
  if me is null or not public.community_member(me) then
    raise exception 'Para dejar un lomo hay que tener activada la comunidad.' using errcode = 'P0001';
  end if;
  if not public.sala_sentado(me) then
    raise exception 'El lomo se deja sentado en la sala.' using errcode = 'P0001';
  end if;
  if char_length(limpio) not between 1 and 120 then
    raise exception 'Ese título no cabe en el lomo.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.sala_lomos l where l.user_id = me and l.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Por hoy ya has dejado tres lomos: vuelve mañana.' using errcode = 'P0001';
  end if;
  insert into public.sala_lomos (user_id, titulo) values (me, limpio) on conflict do nothing;
  return public.sala_libreria();
end;
$$;
revoke all on function public.sala_lomo_dejar(text) from public, anon;
grant execute on function public.sala_lomo_dejar(text) to authenticated;

create or replace function public.sala_lomo_retirar(lomo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.sala_lomos l where l.id = lomo and l.user_id = (select auth.uid());
  return public.sala_libreria();
end;
$$;
revoke all on function public.sala_lomo_retirar(uuid) from public, anon;
grant execute on function public.sala_lomo_retirar(uuid) to authenticated;

-- Devuelve si el saludo ha salido: la segunda vez en media hora no hace nada
create or replace function public.sala_saludar(quien uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or quien is null or me = quien or not public.sala_sentado(me) or not public.sala_sentado(quien)
     or not public.community_member(quien) or public.is_blocked_pair(quien) then
    return false;
  end if;
  insert into public.sala_saludos as g (de, para) values (me, quien)
    on conflict (de, para) do update set created_at = now(), visto = false
    where g.created_at < now() - interval '30 minutes';
  return found;
end;
$$;
revoke all on function public.sala_saludar(uuid) from public, anon;
grant execute on function public.sala_saludar(uuid) to authenticated;

-- Quién te acaba de saludar. Cada saludo se entrega una vez
create or replace function public.sala_saludos_nuevos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  filas jsonb;
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  with vistos as (
    update public.sala_saludos g set visto = true
      where g.para = me and not g.visto and g.created_at > now() - interval '5 minutes' and not public.is_blocked_pair(g.de)
      returning g.de
  )
  select coalesce(jsonb_agg(v.de), '[]'::jsonb) into filas from vistos v;
  return filas;
end;
$$;
revoke all on function public.sala_saludos_nuevos() from public, anon;
grant execute on function public.sala_saludos_nuevos() to authenticated;
