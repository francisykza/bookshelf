-- 1.118 (§118) · La placa del sofá y los gestos de la sala de lectura (bloque c de docs/qa/sala-lectura-3d.md).
--   · Gestos cerrados (Francisco: «una selección de gestos para poder comunicarte con la otra persona»): ¡Hola!, alzar la
--     taza, «¿qué tal va?» (enseñar el libro), «¡qué bueno!», «un capítulo más», «momento intenso» y «buenas noches».
--     Sin texto libre. Entre quienes leen a la vez en la sala (uno cada media hora por pareja, como el saludo de siempre)
--     o entre los dos de una cita en el sofá (uno por minuto). `sala_saludar` y `sala_saludos_nuevos` siguen igual.
--   · La placa del sofá por pareja de amigos, sin rachas: los minutos que habéis leído juntos (los de las citas, contados
--     con los latidos) y los libros que habéis terminado en una cita, si quien lo terminó decide apuntarlo. Hitos de 1, 5,
--     10, 25, 50 y 100 horas, que solo cambian la placa (latón, plata, oro). La ven los dos y nadie más.
-- Sin tickets ni recompensas. Ninguna función es `stable` y ninguna llama a piso_yo().

alter table public.sala_saludos add column if not exists gesto text not null default 'hola'
  check (gesto in ('hola', 'taza', 'libro', 'bueno', 'capitulo', 'intenso', 'noches'));

-- ¿Tienes ahora una cita con `otro`? Aceptada y sin acabar (esperando a que empiece o leyendo)
create or replace function public.sala_en_cita(otro uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sala_citas c
     where c.estado = 'aceptada' and now() < c.empieza + make_interval(mins => c.minutos)
       and ((c.anfitrion = auth.uid() and c.invitado = otro) or (c.invitado = auth.uid() and c.anfitrion = otro)));
$$;
revoke all on function public.sala_en_cita(uuid) from public, anon, authenticated;

-- Un gesto a quien lee contigo. Devuelve si ha salido (la segunda vez dentro del cupo no hace nada)
create or replace function public.sala_gesto(quien uuid, gesto text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cita boolean;
  cupo interval;
begin
  if me is null or quien is null or me = quien or gesto is null
     or gesto not in ('hola', 'taza', 'libro', 'bueno', 'capitulo', 'intenso', 'noches') then
    return false;
  end if;
  cita := public.sala_en_cita(quien) and public.piso_casino_amigo(quien);
  if not cita and not (public.sala_sentado(me) and public.sala_sentado(quien) and public.community_member(quien) and not public.is_blocked_pair(quien)) then
    return false;
  end if;
  cupo := case when cita then interval '1 minute' else interval '30 minutes' end;
  insert into public.sala_saludos as g (de, para, gesto) values (me, quien, sala_gesto.gesto)
    on conflict (de, para) do update set created_at = now(), visto = false, gesto = excluded.gesto
    where g.created_at < now() - cupo;
  return found;
end;
$$;
revoke all on function public.sala_gesto(uuid, text) from public, anon;
grant execute on function public.sala_gesto(uuid, text) to authenticated;

-- Los gestos que te acaban de llegar: [{ de, gesto }]. Cada uno se entrega una vez
create or replace function public.sala_gestos_nuevos()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  filas jsonb;
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  with vistos as (
    update public.sala_saludos g set visto = true
      where g.para = me and not g.visto and g.created_at > now() - interval '5 minutes' and not public.is_blocked_pair(g.de)
      returning g.de, g.gesto
  )
  select coalesce(jsonb_agg(jsonb_build_object('de', v.de, 'gesto', v.gesto)), '[]'::jsonb) into filas from vistos v;
  return filas;
end;
$$;
revoke all on function public.sala_gestos_nuevos() from public, anon;
grant execute on function public.sala_gestos_nuevos() to authenticated;

-- Los libros de la placa: terminados en una cita y apuntados por quien los terminó. La pareja va ordenada (a < b)
create table if not exists public.sala_pareja_libros (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  created_at timestamptz not null default now(),
  check (a < b),
  check (user_id in (a, b))
);
create unique index if not exists sala_pareja_libros_titulo on public.sala_pareja_libros (a, b, user_id, lower(titulo));
alter table public.sala_pareja_libros enable row level security;
revoke all on table public.sala_pareja_libros from anon, authenticated;

-- Los minutos que una pareja ha leído junta: en todas sus citas, los minutos en que latieron los dos
create or replace function public.sala_pareja_minutos(x uuid, y uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.sala_citas c
    join public.sala_latidos p on p.cita = c.id and p.user_id = c.anfitrion
    join public.sala_latidos q on q.cita = c.id and q.user_id = c.invitado and q.minuto = p.minuto
   where (c.anfitrion = x and c.invitado = y) or (c.anfitrion = y and c.invitado = x);
$$;
revoke all on function public.sala_pareja_minutos(uuid, uuid) from public, anon, authenticated;

-- Tus placas: una por amigo con el que has leído juntos o apuntado un libro. El hito es el último alcanzado (horas) y el
-- metal sale de él: latón hasta 10 h, plata desde 10 h y oro desde 50 h. Sin rachas ni cuentas atrás.
create or replace function public.sala_placas()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.community_member(me) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'uid', t.uid, 'alias', t.alias, 'avatar_id', t.avatar_id, 'minutos', t.minutos,
             'hito', case when t.minutos >= 6000 then 100 when t.minutos >= 3000 then 50 when t.minutos >= 1500 then 25
                          when t.minutos >= 600 then 10 when t.minutos >= 300 then 5 when t.minutos >= 60 then 1 else 0 end,
             'metal', case when t.minutos >= 3000 then 'oro' when t.minutos >= 600 then 'plata' else 'laton' end,
             'libros', t.libros)
           order by t.minutos desc, t.alias)
      from (
        select f.followed as uid, pr.alias, pr.avatar_id,
               public.sala_pareja_minutos(me, f.followed) as minutos,
               coalesce((select jsonb_agg(jsonb_build_object('titulo', l.titulo, 'mio', l.user_id = me) order by l.created_at)
                           from public.sala_pareja_libros l
                          where l.a = least(me, f.followed) and l.b = greatest(me, f.followed)), '[]'::jsonb) as libros
          from public.follows f join public.profiles pr on pr.user_id = f.followed
         where f.follower = me and public.piso_casino_amigo(f.followed)
      ) t
     where t.minutos > 0 or jsonb_array_length(t.libros) > 0), '[]'::jsonb);
end;
$$;
revoke all on function public.sala_placas() from public, anon;
grant execute on function public.sala_placas() to authenticated;

-- Apuntar en la placa un libro que has terminado en una cita en la que habéis leído juntos (hasta 3 horas después de
-- acabar). Hasta tres libros al día, y cada título una vez por persona y pareja. Devuelve tus placas.
create or replace function public.sala_placa_libro(cita uuid, titulo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.sala_citas;
  otro uuid;
  limpio text := btrim(coalesce(titulo, ''));
begin
  select * into c from public.sala_citas x where x.id = cita;
  -- (una cita cerrada al empezar otra también vale: lo que cuenta es haber leído juntos en ella)
  if c.id is null or me is null or me not in (c.anfitrion, c.invitado) or c.estado not in ('aceptada', 'acabada', 'cerrada')
     or now() < c.empieza or now() > c.empieza + make_interval(mins => c.minutos) + interval '3 hours' then
    raise exception 'sala:placa' using errcode = 'P0001';
  end if;
  otro := case when c.anfitrion = me then c.invitado else c.anfitrion end;
  if not public.piso_casino_amigo(otro) or not exists (
       select 1 from public.sala_latidos p join public.sala_latidos q on q.cita = p.cita and q.minuto = p.minuto
        where p.cita = c.id and p.user_id = c.anfitrion and q.user_id = c.invitado) then
    raise exception 'sala:placa' using errcode = 'P0001';
  end if;
  if char_length(limpio) not between 1 and 120 then
    raise exception 'sala:titulo' using errcode = 'P0001';
  end if;
  if (select count(*) from public.sala_pareja_libros l where l.user_id = me and l.created_at > now() - interval '1 day') >= 3 then
    raise exception 'sala:hoy' using errcode = 'P0001';
  end if;
  insert into public.sala_pareja_libros (a, b, user_id, titulo) values (least(me, otro), greatest(me, otro), me, limpio)
    on conflict do nothing;
  return public.sala_placas();
end;
$$;
revoke all on function public.sala_placa_libro(uuid, text) from public, anon;
grant execute on function public.sala_placa_libro(uuid, text) to authenticated;
