-- 1.81 · Arreglos del casino del sótano (Francisco, 4-11-2026: «la opción de invitar a un amigo no termina de funcionar»):
--   · La semana del tope: dentro de piso_casino_semana, «dia» era la columna de la mano y no el parámetro, así que
--     sumaba todas las fichas ganadas desde siempre y el tope de 150 no se reiniciaba el lunes.
--   · Quien invita guarda una mano para esa mesa: antes podía jugar sus tres a solas y su amigo, al aceptar, solo veía
--     «Alguno de los dos ya ha jugado sus tres manos de hoy». Retirar la invitación devuelve la mano.
--   · Una invitación de ayer aceptada hoy se juega hoy: cuenta entre las manos de hoy, no entre las de ayer.
-- ADITIVA y re-ejecutable: solo redefine cuatro funciones de 20261110120000_hotel_casino.sql. No toca datos ni políticas.
-- La aplica Francisco en el SQL Editor. Probada con PGlite (casino.rls.test.js y casino-mesa.rls.test.js).

create or replace function public.piso_casino_semana(uid uuid, dia date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(m.fichas), 0)::integer from public.piso_casino_manos m
    where m.user_id = uid and m.dia >= date_trunc('week', piso_casino_semana.dia)::date and m.dia < date_trunc('week', piso_casino_semana.dia)::date + 7;
$$;
revoke all on function public.piso_casino_semana(uuid, date) from public, anon, authenticated;

create or replace function public.piso_casino_repartir(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hechas integer;
  guardadas integer;
  mazo smallint[];
  n smallint;
begin
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede jugar.' using errcode = 'P0001';
  end if;
  perform public.piso_casino_llegar(me, dia);
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  if exists (select 1 from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_repartir.dia and m.estado = 'jugando' and m.mesa is null) then
    raise exception 'Termina antes la mano que tienes.' using errcode = 'P0001';
  end if;
  select count(*) into hechas from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_repartir.dia;
  if hechas >= (public.piso_casino_reglas() ->> 'manos')::integer then
    raise exception 'Hoy ya has jugado tus tres manos: vuelve mañana.' using errcode = 'P0001';
  end if;
  select count(*) into guardadas from public.piso_casino_mesas x where x.anfitrion = me and x.dia = piso_casino_repartir.dia and x.estado = 'invitada';
  if hechas + guardadas >= (public.piso_casino_reglas() ->> 'manos')::integer then
    raise exception 'Esa mano la tienes guardada para la mesa a la que has invitado: retira la invitación si prefieres jugarla a solas.' using errcode = 'P0001';
  end if;
  select array_agg(c::smallint order by random()) into mazo from generate_series(0, 51) c;
  n := hechas + 1;
  insert into public.piso_casino_manos (user_id, dia, mano, mazo, tuyas, crupier)
    values (me, dia, n, mazo[5:], array[mazo[1], mazo[3]], array[mazo[2], mazo[4]]);
  -- Veintiuna servida: se cierra al momento (empate si el crupier también la tiene)
  if public.piso_casino_valor(array[mazo[1], mazo[3]]) = 21 then
    perform public.piso_casino_cerrar(me, dia, n, public.piso_casino_final(array[mazo[1], mazo[3]], array[mazo[2], mazo[4]]));
  end if;
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_repartir(date) from public, anon;
grant execute on function public.piso_casino_repartir(date) to authenticated;

create or replace function public.piso_casino_invitar(dia date, amigo uuid, fichas integer, garbanzos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  reglas jsonb := public.piso_casino_reglas();
  c public.piso_casino_cuentas;
begin
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede jugar.' using errcode = 'P0001';
  end if;
  if not public.piso_casino_amigo(amigo) then
    raise exception 'Solo se juega en pareja con un amigo: alguien a quien sigues y te sigue.' using errcode = 'P0001';
  end if;
  if fichas is null or garbanzos is null or fichas < 0 or garbanzos < 0 or fichas > (reglas ->> 'apuestaFichas')::integer or garbanzos > (reglas ->> 'apuestaGarbanzos')::integer then
    raise exception 'Se apuestan como mucho 10 fichas y 50 garbanzos.' using errcode = 'P0001';
  end if;
  perform public.piso_casino_llegar(me, dia);
  select * into c from public.piso_casino_cuentas x where x.user_id = me;
  if c.fichas < fichas or c.garbanzos < garbanzos then
    raise exception 'No tienes tanto para apostar.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_invitar.dia)
    + (select count(*) from public.piso_casino_mesas x where x.anfitrion = me and x.dia = piso_casino_invitar.dia and x.estado = 'invitada') >= (reglas ->> 'manos')::integer then
    raise exception 'Hoy ya has jugado tus tres manos, o las que quedan están guardadas para otras mesas: vuelve mañana.' using errcode = 'P0001';
  end if;
  begin
    insert into public.piso_casino_mesas (dia, anfitrion, invitado, fichas, garbanzos) values (dia, me, amigo, fichas, garbanzos);
  exception when unique_violation then
    raise exception 'Hoy ya tenéis una mesa los dos: una al día por pareja.' using errcode = 'P0001';
  end;
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_invitar(date, uuid, integer, integer) from public, anon;
grant execute on function public.piso_casino_invitar(date, uuid, integer, integer) to authenticated;

create or replace function public.piso_casino_aceptar(mesa uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  reglas jsonb := public.piso_casino_reglas();
  m public.piso_casino_mesas;
  baraja smallint[];
  na smallint;
  nb smallint;
begin
  select * into m from public.piso_casino_mesas x where x.id = mesa for update;
  if m.id is null or m.invitado <> me or m.estado <> 'invitada' then
    raise exception 'Esa mesa ya no te espera.' using errcode = 'P0001';
  end if;
  if m.dia > current_date + 1 or m.dia < current_date - 1 then
    raise exception 'Esa mesa ya no se puede jugar.' using errcode = 'P0001';
  end if;
  if not public.piso_casino_amigo(m.anfitrion) then
    raise exception 'Solo se juega en pareja con un amigo: alguien a quien sigues y te sigue.' using errcode = 'P0001';
  end if;
  -- Una invitación de ayer se juega hoy: cuenta entre las manos de hoy
  if m.dia < current_date then
    begin
      update public.piso_casino_mesas x set dia = current_date where x.id = m.id;
    exception when unique_violation then
      raise exception 'Hoy ya tenéis una mesa los dos: una al día por pareja.' using errcode = 'P0001';
    end;
    m.dia := current_date;
  end if;
  perform public.piso_casino_llegar(me, m.dia);
  perform public.piso_casino_llegar(m.anfitrion, m.dia);
  perform 1 from public.piso_casino_cuentas c where c.user_id in (m.anfitrion, m.invitado) order by c.user_id for update;
  if exists (select 1 from public.piso_casino_cuentas c where c.user_id in (m.anfitrion, m.invitado) and (c.fichas < m.fichas or c.garbanzos < m.garbanzos)) then
    raise exception 'Alguno de los dos ya no tiene lo que se apostaba.' using errcode = 'P0001';
  end if;
  select count(*) + 1 into na from public.piso_casino_manos h where h.user_id = m.anfitrion and h.dia = m.dia;
  select count(*) + 1 into nb from public.piso_casino_manos h where h.user_id = m.invitado and h.dia = m.dia;
  if greatest(na, nb) > (reglas ->> 'manos')::integer then
    raise exception 'Alguno de los dos ya ha jugado sus tres manos de hoy.' using errcode = 'P0001';
  end if;
  update public.piso_casino_cuentas c set fichas = c.fichas - m.fichas, garbanzos = c.garbanzos - m.garbanzos where c.user_id in (m.anfitrion, m.invitado);
  select array_agg(c::smallint order by random()) into baraja from generate_series(0, 51) c;
  insert into public.piso_casino_manos (user_id, dia, mano, mazo, tuyas, crupier, mesa) values
    (m.anfitrion, m.dia, na, '{}', array[baraja[1], baraja[3]], array[baraja[5], baraja[6]], m.id),
    (m.invitado, m.dia, nb, '{}', array[baraja[2], baraja[4]], array[baraja[5], baraja[6]], m.id);
  -- Con veintiuna servida no hay nada que jugar: esa mano ya espera
  update public.piso_casino_manos h set estado = 'esperando' where h.mesa = m.id and public.piso_casino_valor(h.tuyas) = 21;
  update public.piso_casino_mesas x set estado = 'jugando', mazo = baraja[7:], crupier = array[baraja[5], baraja[6]] where x.id = m.id;
  perform public.piso_casino_mesa_resolver(m.id);
  return public.piso_casino(m.dia);
end;
$$;
revoke all on function public.piso_casino_aceptar(uuid) from public, anon;
grant execute on function public.piso_casino_aceptar(uuid) to authenticated;
