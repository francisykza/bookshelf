-- 1.141 (§141) · Los cafés de los demás: visitarlos y el ranking (Francisco, 16-11-2026: «poder ver las cafeterias de los
-- demás y poder tener un ranking de las cafeterias que más nivel tienen y más monedas acumulan según el edificio»).
-- Decisiones del mismo día:
-- - Se visitan los cafés de los vecinos del edificio y de quien sigues, como los pisos (`piso_visita`): comunidad activa por
--   las dos partes y sin bloqueo. Solo pasear y mirar, en solo lectura.
-- - El ranking: el de tu edificio y, aparte, el de quien sigues (tú siempre sales). Tres tablas: nivel y reputación, granos
--   ganados en total (desde esta migración, sin restar lo gastado) y la reputación de la semana (desde el lunes, UTC).
-- - Los granos siguen sin pasar de una cuenta a otra: aquí solo se cuentan.
-- Privacidad: de tus leídos en la balda, quien visita solo ve el género y cuántos hay (sin título ni clave); los del catálogo
-- del café, enteros. El escaparate (nivel 5) lo eliges tú para que se vea desde la calle: se ve con sus títulos.
-- Aditiva y re-ejecutable.

-- ── Lo que se cuenta para el ranking ──
alter table public.cafe_locales add column if not exists granos_ganados integer not null default 0 check (granos_ganados between 0 and 2000000000);
alter table public.cafe_locales add column if not exists rep_semana integer not null default 0 check (rep_semana >= 0);
alter table public.cafe_locales add column if not exists semana date;

-- Cada subida de granos o de reputación, la cuente quien la cuente (servir, el taller, el tostadero, los hitos…), se suma aquí;
-- lo que se gasta no se resta. La semana empieza el lunes (UTC): la primera subida de una semana nueva empieza de cero.
create or replace function public.cafe_contar_ganado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lunes date := date_trunc('week', now() at time zone 'utc')::date;
begin
  if new.granos > old.granos then
    new.granos_ganados := least(2000000000, old.granos_ganados + (new.granos - old.granos));
  end if;
  if new.reputacion > old.reputacion then
    new.rep_semana := case when old.semana = lunes then old.rep_semana else 0 end + (new.reputacion - old.reputacion);
    new.semana := lunes;
  end if;
  return new;
end;
$$;
revoke all on function public.cafe_contar_ganado() from public, anon, authenticated;
drop trigger if exists cafe_locales_ganado on public.cafe_locales;
create trigger cafe_locales_ganado
  before update of granos, reputacion on public.cafe_locales
  for each row execute function public.cafe_contar_ganado();

-- ¿Puedo ver el café de `lector`? Como el piso: comunidad activa los dos, sin bloqueo, y vecino del edificio o alguien a quien sigo.
create or replace function public.cafe_puedo_ver(lector uuid, ambito text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and lector is not null and lector <> auth.uid()
     and public.community_member(auth.uid()) and public.community_member(lector) and not public.is_blocked_pair(lector)
     and case
           when ambito = 'edificio' then public.mismo_edificio(lector)
           when ambito = 'seguidos' then exists (select 1 from public.follows f where f.follower = auth.uid() and f.followed = lector)
           else public.mismo_edificio(lector) or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followed = lector)
         end;
$$;
revoke all on function public.cafe_puedo_ver(uuid, text) from public, anon, authenticated;

-- ── El ranking: 'edificio' (tus vecinos) o 'seguidos' (quien sigues); tú siempre sales. Solo cafés inaugurados, hasta 100 ──
create or replace function public.cafe_ranking(ambito text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  lunes date := date_trunc('week', now() at time zone 'utc')::date;
begin
  if me is null then
    raise exception 'cafe:sesion' using errcode = 'P0001';
  end if;
  if ambito is null or ambito not in ('edificio', 'seguidos') then
    raise exception 'cafe:ambito' using errcode = 'P0001';
  end if;
  if not public.community_member(me) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(r.fila order by r.nivel desc, r.reputacion desc, r.user_id)
      from (
        select l.user_id, l.nivel, l.reputacion,
               jsonb_build_object(
                 'user_id', l.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id, 'cafe', l.nombre, 'nivel', l.nivel,
                 'reputacion', l.reputacion, 'ganados', l.granos_ganados,
                 'semana', case when l.semana = lunes then l.rep_semana else 0 end,
                 'yo', l.user_id = me) as fila
          from public.cafe_locales l
          join public.profiles p on p.user_id = l.user_id
         where l.inaugurado is not null
           and (l.user_id = me or public.cafe_puedo_ver(l.user_id, ambito))
         order by l.nivel desc, l.reputacion desc
         limit 100) r), '[]'::jsonb);
end;
$$;
revoke all on function public.cafe_ranking(text) from public, anon;
grant execute on function public.cafe_ranking(text) to authenticated;

-- ── La visita: el café de otro lector, para pasear y mirar (null si no se puede ver o no lo ha inaugurado) ──
create or replace function public.cafe_visita(lector uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  salida jsonb;
begin
  if not public.cafe_puedo_ver(lector) then
    return null;
  end if;
  select jsonb_build_object(
           'user_id', l.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id, 'nombre', l.nombre, 'nivel', l.nivel,
           'reputacion', l.reputacion, 'plano', l.plano,
           'escaparate', case when l.nivel >= 5 then l.escaparate else '[]'::jsonb end,
           'fotos', coalesce((select jsonb_agg(i.nivel order by i.nivel) from public.cafe_influencers i where i.user_id = l.user_id and i.viral), '[]'::jsonb),
           -- Lo de la balda: del catálogo, entero; de sus leídos, solo el género y cuántos (sin título ni clave)
           'libros', coalesce((
             select jsonb_agg(
                      case when b.clave like 'cat:%'
                           then jsonb_build_object('clave', b.clave, 'titulo', b.titulo, 'genero', b.genero, 'balda', b.balda)
                           else jsonb_build_object('genero', b.genero, 'balda', b.balda) end
                      order by b.genero, b.clave)
               from public.cafe_libros b where b.user_id = l.user_id and b.balda > 0), '[]'::jsonb))
    into salida
    from public.cafe_locales l
    join public.profiles p on p.user_id = l.user_id
   where l.user_id = lector and l.inaugurado is not null;
  return salida;
end;
$$;
revoke all on function public.cafe_visita(uuid) from public, anon;
grant execute on function public.cafe_visita(uuid) to authenticated;
