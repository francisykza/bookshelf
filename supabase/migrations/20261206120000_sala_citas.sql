-- 1.117 (§117) · La cita de lectura en la sala del hotel: invitas a un amigo (seguimiento mutuo, sin bloqueo) a leer
-- contigo «ahora», «en 15» o «en 30 min», 15, 25 o 45 minutos. Si acepta, os sentáis en el sofá para dos y el reloj lo
-- pone el servidor: empieza y acaba a la vez para los dos. Mientras estás sentado con la app a la vista llega un latido
-- por minuto; «habéis leído juntos» son los minutos en que latisteis los dos. Sin tickets, sin texto libre, sin rachas.
-- La invitación caduca a los 10 min sin respuesta, y rechazar se ve igual que no contestar («No ha podido venir»).
-- Ninguna función es `stable` (PostgREST las ejecutaría en solo lectura) y ninguna llama a piso_yo().

create table if not exists public.sala_citas (
  id uuid primary key default gen_random_uuid(),
  anfitrion uuid not null references auth.users (id) on delete cascade,
  invitado uuid not null references auth.users (id) on delete cascade,
  minutos integer not null check (minutos in (15, 25, 45)),
  empieza timestamptz not null,
  estado text not null default 'invitada' check (estado in ('invitada', 'aceptada', 'acabada', 'rechazada', 'cerrada')),
  creada timestamptz not null default now(),
  caduca timestamptz not null default now() + interval '10 minutes',
  check (anfitrion <> invitado)
);
create index if not exists sala_citas_invitado on public.sala_citas (invitado, estado);
create index if not exists sala_citas_anfitrion on public.sala_citas (anfitrion, estado);
alter table public.sala_citas enable row level security;
revoke all on table public.sala_citas from anon, authenticated;

create table if not exists public.sala_latidos (
  cita uuid not null references public.sala_citas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  minuto integer not null check (minuto >= 0 and minuto < 45),
  primary key (cita, user_id, minuto)
);
alter table public.sala_latidos enable row level security;
revoke all on table public.sala_latidos from anon, authenticated;

-- Cómo ve una cita quien está en ella: con quién, si la invitó o la recibió, el estado que cuenta (una invitación sin
-- respuesta que pasó sus 10 min, o rechazada, es «no_vino»; una aceptada que acabó es «terminada»), las horas en
-- milisegundos, los minutos juntos y si el otro está ahora en el sofá. Solo para las funciones de abajo.
create or replace function public.sala_cita_json(c public.sala_citas, me uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cita', c.id,
    'soy', case when c.anfitrion = me then 'anfitrion' else 'invitado' end,
    'uid', o.uid, 'alias', pr.alias, 'avatar_id', pr.avatar_id,
    'minutos', c.minutos,
    'empieza', floor(extract(epoch from c.empieza) * 1000)::bigint,
    'fin', floor(extract(epoch from c.empieza + make_interval(mins => c.minutos)) * 1000)::bigint,
    'estado', case
      when c.estado = 'rechazada' or (c.estado = 'invitada' and c.caduca <= now()) then 'no_vino'
      when c.estado = 'acabada' or c.estado = 'aceptada' and c.empieza + make_interval(mins => c.minutos) <= now() then 'terminada'
      else c.estado end,
    'juntos', (select count(*) from public.sala_latidos a join public.sala_latidos b
                 on b.cita = a.cita and b.minuto = a.minuto and b.user_id <> a.user_id
                where a.cita = c.id and a.user_id = c.anfitrion and b.user_id = c.invitado)::integer,
    'mios', (select count(*) from public.sala_latidos l where l.cita = c.id and l.user_id = me)::integer,
    -- El otro está ahora en el sofá: ha latido este minuto o el anterior
    'otro_aqui', exists (select 1 from public.sala_latidos l where l.cita = c.id and l.user_id = o.uid
                          and l.minuto >= floor(extract(epoch from now() - c.empieza) / 60) - 1))
  from (select case when c.anfitrion = me then c.invitado else c.anfitrion end as uid) o
  left join public.profiles pr on pr.user_id = o.uid;
$$;
revoke all on function public.sala_cita_json(public.sala_citas, uuid) from public, anon, authenticated;

-- Invitar a un amigo. Una cita abierta por persona: invitar de nuevo cierra la que tuvieras (y su resumen).
create or replace function public.sala_cita_invitar(amigo uuid, en_min integer, minutos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.sala_citas;
begin
  if me is null or not public.community_member(me) or not public.piso_casino_amigo(amigo) then
    raise exception 'sala:no_amigo' using errcode = 'P0001';
  end if;
  if en_min is null or en_min not in (0, 15, 30) or minutos is null or minutos not in (15, 25, 45) then
    raise exception 'sala:cita' using errcode = 'P0001';
  end if;
  update public.sala_citas set estado = 'cerrada'
   where estado <> 'cerrada' and (anfitrion = me or (invitado = me and anfitrion = amigo));
  insert into public.sala_citas (anfitrion, invitado, minutos, empieza)
  values (me, amigo, sala_cita_invitar.minutos, now() + make_interval(mins => en_min))
  returning * into c;
  return public.sala_cita_json(c, me);
end;
$$;
revoke all on function public.sala_cita_invitar(uuid, integer, integer) from public, anon;
grant execute on function public.sala_cita_invitar(uuid, integer, integer) to authenticated;

-- Tus amigos (a quién invitar), las invitaciones que te esperan, tu cita (la que tienes en marcha o la última de la
-- última media hora, para poder decir cómo fue) y la hora del servidor
create or replace function public.sala_citas()
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
    return jsonb_build_object('amigos', '[]'::jsonb, 'invitaciones', '[]'::jsonb, 'mia', null,
      'ahora', floor(extract(epoch from now()) * 1000)::bigint);
  end if;
  return jsonb_build_object(
    'amigos', coalesce((
      select jsonb_agg(jsonb_build_object('uid', f.followed, 'alias', pr.alias, 'avatar_id', pr.avatar_id) order by pr.alias)
        from public.follows f join public.profiles pr on pr.user_id = f.followed
       where f.follower = me and public.piso_casino_amigo(f.followed)), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(public.sala_cita_json(x, me) order by x.creada desc)
        from public.sala_citas x
       where x.invitado = me and x.estado = 'invitada' and x.caduca > now() and public.piso_casino_amigo(x.anfitrion)), '[]'::jsonb),
    'mia', (
      select public.sala_cita_json(x, me)
        from public.sala_citas x
       where (x.anfitrion = me or (x.invitado = me and x.estado <> 'invitada'))
         and x.estado <> 'cerrada'
         and greatest(x.caduca, x.empieza + make_interval(mins => x.minutos)) > now() - interval '30 minutes'
         and public.piso_casino_amigo(case when x.anfitrion = me then x.invitado else x.anfitrion end)
       order by x.creada desc limit 1),
    'ahora', floor(extract(epoch from now()) * 1000)::bigint
  );
end;
$$;
revoke all on function public.sala_citas() from public, anon;
grant execute on function public.sala_citas() to authenticated;

-- Aceptar o no una invitación. Si era «ahora» y aceptas tarde, el reloj empieza al aceptar: igual para los dos.
create or replace function public.sala_cita_responder(cita uuid, acepta boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.sala_citas;
begin
  select * into c from public.sala_citas x where x.id = cita for update;
  if c.id is null or c.invitado <> me or c.estado <> 'invitada' or c.caduca <= now() or not public.piso_casino_amigo(c.anfitrion) then
    raise exception 'sala:cita' using errcode = 'P0001';
  end if;
  if coalesce(acepta, false) then
    -- Aceptar una cita cierra las demás que tuvieras abiertas (una cita a la vez)
    update public.sala_citas set estado = 'cerrada'
     where id <> c.id and estado <> 'cerrada' and (anfitrion = me or (invitado = me and estado <> 'invitada'));
    update public.sala_citas set estado = 'aceptada', empieza = greatest(empieza, now()) where id = c.id returning * into c;
  else
    update public.sala_citas set estado = 'rechazada' where id = c.id returning * into c;
  end if;
  return public.sala_cita_json(c, me);
end;
$$;
revoke all on function public.sala_cita_responder(uuid, boolean) from public, anon;
grant execute on function public.sala_cita_responder(uuid, boolean) to authenticated;

-- El latido: una vez por minuto mientras estás sentado en el sofá con la app a la vista. Solo cuenta dentro del reloj
-- de la cita y una vez por minuto (repetirlo no suma). Devuelve la cita como la ves.
create or replace function public.sala_cita_latido(cita uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.sala_citas;
  m integer;
begin
  select * into c from public.sala_citas x where x.id = cita;
  if c.id is null or me not in (c.anfitrion, c.invitado) then
    raise exception 'sala:cita' using errcode = 'P0001';
  end if;
  if c.estado = 'aceptada' and now() >= c.empieza and now() < c.empieza + make_interval(mins => c.minutos)
     and public.piso_casino_amigo(case when c.anfitrion = me then c.invitado else c.anfitrion end) then
    m := floor(extract(epoch from now() - c.empieza) / 60)::integer;
    insert into public.sala_latidos (cita, user_id, minuto) values (c.id, me, m) on conflict do nothing;
  end if;
  return public.sala_cita_json(c, me);
end;
$$;
revoke all on function public.sala_cita_latido(uuid) from public, anon;
grant execute on function public.sala_cita_latido(uuid) to authenticated;

-- Dejarla: antes de empezar, la anula (quien invita o quien aceptó); ya empezada, la da por acabada antes de tiempo
-- para los dos y lo leído juntos queda
create or replace function public.sala_cita_dejar(cita uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  update public.sala_citas x set estado = case when x.estado = 'aceptada' and now() >= x.empieza then 'acabada' else 'cerrada' end
   where x.id = sala_cita_dejar.cita and me in (x.anfitrion, x.invitado) and x.estado in ('invitada', 'aceptada');
end;
$$;
revoke all on function public.sala_cita_dejar(uuid) from public, anon;
grant execute on function public.sala_cita_dejar(uuid) to authenticated;
