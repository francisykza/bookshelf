-- 1.82 · Los garbanzos del casino (Francisco, 4-11-2026: «solo se puede jugar una sola vez con amigos y no hay posibilidad
-- de apostar garbanzos»; «premios por los garbanzos aunque sean más humildes» y «cambiar garbanzos por tickets y viceversa
-- con un limite»):
--   · Mesas de garbanzos: tras la mesa del día (o sin manos), dos amigos pueden seguir jugando apostando solo garbanzos.
--     No gastan las tres manos del día ni dan fichas. Una abierta por pareja y seis al día por persona.
--   · La lata de los garbanzos: tres premios humildes que se cambian por garbanzos (rareza 'especial', como los de la caja).
--   · El cambio: 50 garbanzos por 5 tickets y 5 tickets por 25 garbanzos, hasta 10 tickets a la semana en cada sentido.
--     El ida y vuelta siempre pierde, para que no se pueda dar vueltas. Tercera excepción a «los tickets solo se ganan
--     leyendo», pedida por Francisco. Las fichas siguen sin convertirse en tickets.
-- Necesita 20261110120000_hotel_casino.sql y 20261111120000_hotel_casino_arreglos.sql. ADITIVA y re-ejecutable: una columna,
-- una tabla, tres filas del catálogo, funciones nuevas y redefine cinco. Solo cambia dos cosas ya existentes: el índice de
-- una mesa al día (ahora sin las de garbanzos) y el check del número de mano. No borra datos.
-- La aplica Francisco en el SQL Editor. Probada con PGlite (casino-garbanzos.rls.test.js).

alter table public.piso_casino_mesas add column if not exists solo_garbanzos boolean not null default false;

-- La mesa del día sigue siendo una por pareja; las de garbanzos, una abierta por pareja
drop index if exists public.piso_casino_mesas_pareja;
create unique index if not exists piso_casino_mesas_pareja on public.piso_casino_mesas (dia, least(anfitrion, invitado), greatest(anfitrion, invitado)) where estado <> 'rechazada' and not solo_garbanzos;
create unique index if not exists piso_casino_mesas_garbanzos on public.piso_casino_mesas (least(anfitrion, invitado), greatest(anfitrion, invitado)) where solo_garbanzos and estado in ('invitada', 'jugando');

-- Las manos de las mesas de garbanzos se numeran desde 11: las del día siguen siendo de la 1 a la 3
alter table public.piso_casino_manos drop constraint if exists piso_casino_manos_mano_check;
alter table public.piso_casino_manos add constraint piso_casino_manos_mano_check check (mano between 1 and 3 or mano between 11 and 16);

-- Lo cambiado cada semana (lunes), en tickets y en cada sentido
create table if not exists public.piso_casino_cambios (
  user_id uuid not null references auth.users (id) on delete cascade,
  semana date not null,
  a_tickets integer not null default 0,
  a_garbanzos integer not null default 0,
  primary key (user_id, semana)
);
alter table public.piso_casino_cambios enable row level security;
revoke all on public.piso_casino_cambios from anon, authenticated;

-- Las reglas en cifras (las mismas que CASINO en src/features/edificio/hotel/veintiuna.js; una prueba lo comprueba)
create or replace function public.piso_casino_reglas()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('manos', 3, 'tope', 150, 'veintiuna', 12, 'ganada', 8, 'empate', 4, 'perdida', 2,
    'compania', 2, 'apuestaFichas', 10, 'apuestaGarbanzos', 50, 'garbanzosInicio', 100, 'garbanzosDia', 20,
    'mesasGarbanzos', 6, 'cambioGarbanzos', 50, 'cambioTickets', 5, 'vueltaGarbanzos', 25, 'topeCambio', 10);
$$;

-- Los premios de la lata, con su precio en garbanzos (lo mismo que LATA en veintiuna.js; una prueba lo comprueba)
create or replace function public.piso_casino_lata_precios()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('tarro-garbanzos', 150, 'baraja-naipes', 300, 'taburete-barra', 600);
$$;

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('tarro-garbanzos', 'encima', 1, 1, null, 1, 'especial'),
  ('baraja-naipes', 'encima', 1, 1, null, 1, 'especial'),
  ('taburete-barra', 'suelo', 1, 1, null, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Lo de la lata para `uid`: [{ id, precio, tienes }], de lo más barato a lo más caro
create or replace function public.piso_casino_lata(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.key,
      'precio', a.value::integer,
      'tienes', exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = a.key and v.copias > 0)
    ) order by a.value::integer), '[]'::jsonb)
  from jsonb_each_text(public.piso_casino_lata_precios()) a;
$$;
revoke all on function public.piso_casino_lata(uuid) from public, anon, authenticated;

-- Resuelve una mesa cuando los dos han jugado (la de 20261110120000): las de garbanzos no dan fichas
create or replace function public.piso_casino_mesa_resolver(m_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.piso_casino_mesas;
  h public.piso_casino_manos;
  a integer;
  b integer;
  gana uuid;
  extra integer := (public.piso_casino_reglas() ->> 'compania')::integer;
begin
  select * into m from public.piso_casino_mesas x where x.id = m_id for update;
  if m.estado <> 'jugando' or exists (select 1 from public.piso_casino_manos x where x.mesa = m_id and x.estado = 'jugando') then
    return;
  end if;
  while public.piso_casino_valor(m.crupier) < 17 loop
    m.crupier := m.crupier || m.mazo[1];
    m.mazo := m.mazo[2:];
  end loop;
  for h in select * from public.piso_casino_manos x where x.mesa = m_id loop
    update public.piso_casino_manos x set crupier = m.crupier where x.user_id = h.user_id and x.dia = h.dia and x.mano = h.mano;
    if m.solo_garbanzos then
      update public.piso_casino_manos x set estado = public.piso_casino_final(h.tuyas, m.crupier), fichas = 0 where x.user_id = h.user_id and x.dia = h.dia and x.mano = h.mano;
    else
      perform public.piso_casino_cerrar(h.user_id, h.dia, h.mano, public.piso_casino_final(h.tuyas, m.crupier), extra);
    end if;
  end loop;
  -- La apuesta: un pasado cuenta como -1
  select case when public.piso_casino_valor(x.tuyas) > 21 then -1 else public.piso_casino_valor(x.tuyas) end into a
    from public.piso_casino_manos x where x.mesa = m_id and x.user_id = m.anfitrion;
  select case when public.piso_casino_valor(x.tuyas) > 21 then -1 else public.piso_casino_valor(x.tuyas) end into b
    from public.piso_casino_manos x where x.mesa = m_id and x.user_id = m.invitado;
  gana := case when a > b then m.anfitrion when b > a then m.invitado else null end;
  if gana is null then
    update public.piso_casino_cuentas c set fichas = c.fichas + m.fichas, garbanzos = c.garbanzos + m.garbanzos where c.user_id in (m.anfitrion, m.invitado);
  else
    update public.piso_casino_cuentas c set fichas = c.fichas + 2 * m.fichas, garbanzos = c.garbanzos + 2 * m.garbanzos where c.user_id = gana;
  end if;
  update public.piso_casino_mesas x set estado = 'cerrada', crupier = m.crupier, mazo = m.mazo, ganador = gana where x.id = m_id;
end;
$$;
revoke all on function public.piso_casino_mesa_resolver(uuid) from public, anon, authenticated;

-- El casino para quien juega (la de 20261110120000): `manos` y `quedan` son solo las tres del día; con `solo_garbanzos`
-- en cada mesa, cuántas mesas de garbanzos quedan hoy, la lata, tus tickets y lo cambiado esta semana
create or replace function public.piso_casino(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  reglas jsonb := public.piso_casino_reglas();
  manos jsonb;
  hechas integer;
  mesas jsonb;
  amigos jsonb;
  cambio public.piso_casino_cambios;
begin
  insert into public.piso_casino_cuentas (user_id) values (me) on conflict do nothing;
  perform public.piso_casino_mesas_vencer(me);
  select coalesce(jsonb_agg(jsonb_build_object(
      'mano', m.mano,
      'mesa', m.mesa,
      'tuyas', to_jsonb(m.tuyas),
      'crupier', case when m.estado in ('jugando', 'esperando') then to_jsonb(m.crupier[1:1]) else to_jsonb(m.crupier) end,
      'tu', public.piso_casino_valor(m.tuyas),
      'suyo', case when m.estado in ('jugando', 'esperando') then null else public.piso_casino_valor(m.crupier) end,
      'estado', m.estado,
      'fichas', m.fichas) order by m.mano), '[]'::jsonb), count(*)
    into manos, hechas
    from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino.dia and m.mano <= 3;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'dia', x.dia,
      'anfitrion', x.anfitrion = me,
      'solo_garbanzos', x.solo_garbanzos,
      'amigo', jsonb_build_object('uid', o.uid, 'alias', pr.alias, 'avatar_id', pr.avatar_id),
      'estado', x.estado,
      'fichas', x.fichas,
      'garbanzos', x.garbanzos,
      'crupier', case when x.estado = 'cerrada' then to_jsonb(x.crupier) when x.estado = 'jugando' then to_jsonb(x.crupier[1:1]) else '[]'::jsonb end,
      'suyo', case when x.estado = 'cerrada' then public.piso_casino_valor(x.crupier) else null end,
      'mia', (select jsonb_build_object('mano', h.mano, 'tuyas', to_jsonb(h.tuyas), 'tu', public.piso_casino_valor(h.tuyas), 'estado', h.estado, 'fichas', h.fichas)
              from public.piso_casino_manos h where h.mesa = x.id and h.user_id = me),
      'suya', (select jsonb_build_object('estado', h.estado, 'cartas', cardinality(h.tuyas),
                'tuyas', case when x.estado = 'cerrada' then to_jsonb(h.tuyas) else null end,
                'tu', case when x.estado = 'cerrada' then public.piso_casino_valor(h.tuyas) else null end)
              from public.piso_casino_manos h where h.mesa = x.id and h.user_id = o.uid),
      'apuesta', case when x.estado <> 'cerrada' then null when x.ganador is null then 'empate' when x.ganador = me then 'ganas' else 'pierdes' end
    ) order by x.creado desc), '[]'::jsonb)
    into mesas
    from public.piso_casino_mesas x
    cross join lateral (select case when x.anfitrion = me then x.invitado else x.anfitrion end as uid) o
    left join public.profiles pr on pr.user_id = o.uid
    where me in (x.anfitrion, x.invitado)
      and (x.estado in ('invitada', 'jugando') or x.dia = piso_casino.dia)
      and not public.is_blocked_pair(o.uid);
  select coalesce(jsonb_agg(jsonb_build_object('uid', f.followed, 'alias', pr.alias, 'avatar_id', pr.avatar_id) order by pr.alias), '[]'::jsonb)
    into amigos
    from public.follows f
    join public.profiles pr on pr.user_id = f.followed
    where f.follower = me and public.piso_casino_amigo(f.followed);
  select * into cambio from public.piso_casino_cambios c where c.user_id = me and c.semana = date_trunc('week', piso_casino.dia)::date;
  return jsonb_build_object(
    'dia', dia,
    'fichas', (select c.fichas from public.piso_casino_cuentas c where c.user_id = me),
    'garbanzos', (select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me),
    'tickets', coalesce((select c.tickets from public.piso_cuentas c where c.user_id = me), 0),
    'semana', public.piso_casino_semana(me, dia),
    'tope', (reglas ->> 'tope')::integer,
    'manos', manos,
    'quedan', greatest(0, (reglas ->> 'manos')::integer - hechas),
    'quedanGarbanzos', greatest(0, (reglas ->> 'mesasGarbanzos')::integer
      - (select count(*)::integer from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino.dia and m.mano > 3)
      - (select count(*)::integer from public.piso_casino_mesas x where x.anfitrion = me and x.solo_garbanzos and x.estado = 'invitada')),
    'jugando', exists (select 1 from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino.dia and m.estado = 'jugando' and m.mesa is null),
    'mesas', mesas,
    'amigos', amigos,
    'caja', public.piso_casino_caja(me),
    'lata', public.piso_casino_lata(me),
    'cambio', jsonb_build_object('aTickets', coalesce(cambio.a_tickets, 0), 'aGarbanzos', coalesce(cambio.a_garbanzos, 0))
  );
end;
$$;
revoke all on function public.piso_casino(date) from public, anon;
grant execute on function public.piso_casino(date) to authenticated;

-- Repartir a solas (la de 20261111120000): las manos de las mesas de garbanzos no cuentan
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
  select count(*) into hechas from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_repartir.dia and m.mano <= 3;
  if hechas >= (public.piso_casino_reglas() ->> 'manos')::integer then
    raise exception 'Hoy ya has jugado tus tres manos: vuelve mañana.' using errcode = 'P0001';
  end if;
  select count(*) into guardadas from public.piso_casino_mesas x where x.anfitrion = me and x.dia = piso_casino_repartir.dia and x.estado = 'invitada' and not x.solo_garbanzos;
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

-- Invitar a la mesa del día (la de 20261111120000): las mesas de garbanzos no guardan mano
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
  if (select count(*) from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_invitar.dia and m.mano <= 3)
    + (select count(*) from public.piso_casino_mesas x where x.anfitrion = me and x.dia = piso_casino_invitar.dia and x.estado = 'invitada' and not x.solo_garbanzos) >= (reglas ->> 'manos')::integer then
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

-- Invitar a una mesa de garbanzos: solo se apuestan garbanzos, no gasta manos del día y no da fichas
create or replace function public.piso_casino_invitar_garbanzos(dia date, amigo uuid, garbanzos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  reglas jsonb := public.piso_casino_reglas();
begin
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede jugar.' using errcode = 'P0001';
  end if;
  if not public.piso_casino_amigo(amigo) then
    raise exception 'Solo se juega en pareja con un amigo: alguien a quien sigues y te sigue.' using errcode = 'P0001';
  end if;
  if garbanzos is null or garbanzos < 1 or garbanzos > (reglas ->> 'apuestaGarbanzos')::integer then
    raise exception 'En una mesa de garbanzos se apuesta de 1 a 50.' using errcode = 'P0001';
  end if;
  perform public.piso_casino_llegar(me, dia);
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  if (select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me) < piso_casino_invitar_garbanzos.garbanzos then
    raise exception 'No tienes tanto para apostar.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_invitar_garbanzos.dia and m.mano > 3)
    + (select count(*) from public.piso_casino_mesas x where x.anfitrion = me and x.solo_garbanzos and x.estado = 'invitada') >= (reglas ->> 'mesasGarbanzos')::integer then
    raise exception 'Por hoy ya vale de garbanzos: mañana hay más mesas.' using errcode = 'P0001';
  end if;
  begin
    insert into public.piso_casino_mesas (dia, anfitrion, invitado, garbanzos, solo_garbanzos) values (dia, me, amigo, garbanzos, true);
  exception when unique_violation then
    raise exception 'Ya tenéis una mesa de garbanzos abierta: acabadla antes de empezar otra.' using errcode = 'P0001';
  end;
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_invitar_garbanzos(date, uuid, integer) from public, anon;
grant execute on function public.piso_casino_invitar_garbanzos(date, uuid, integer) to authenticated;

-- Aceptar una mesa (la de 20261111120000). Las de garbanzos cuentan aparte, con sus manos desde la 11
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
  if m.solo_garbanzos then
    select 11 + count(*) into na from public.piso_casino_manos h where h.user_id = m.anfitrion and h.dia = m.dia and h.mano > 3;
    select 11 + count(*) into nb from public.piso_casino_manos h where h.user_id = m.invitado and h.dia = m.dia and h.mano > 3;
    if greatest(na, nb) > 10 + (reglas ->> 'mesasGarbanzos')::integer then
      raise exception 'Alguno de los dos ya ha jugado sus mesas de garbanzos de hoy.' using errcode = 'P0001';
    end if;
  else
    select count(*) + 1 into na from public.piso_casino_manos h where h.user_id = m.anfitrion and h.dia = m.dia and h.mano <= 3;
    select count(*) + 1 into nb from public.piso_casino_manos h where h.user_id = m.invitado and h.dia = m.dia and h.mano <= 3;
    if greatest(na, nb) > (reglas ->> 'manos')::integer then
      raise exception 'Alguno de los dos ya ha jugado sus tres manos de hoy.' using errcode = 'P0001';
    end if;
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

-- Cambiar garbanzos por un premio de la lata: se tiene una vez y va al inventario
create or replace function public.piso_casino_lata_canjear(dia date, articulo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  precio integer := (public.piso_casino_lata_precios() ->> articulo)::integer;
begin
  if precio is null then
    raise exception 'Eso no está en la lata.' using errcode = 'P0001';
  end if;
  insert into public.piso_casino_cuentas (user_id) values (me) on conflict do nothing;
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  if exists (select 1 from public.piso_inventario v where v.user_id = me and v.mueble = articulo and v.copias > 0) then
    raise exception 'Eso ya lo tienes.' using errcode = 'P0001';
  end if;
  if (select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me) < precio then
    raise exception 'Te faltan garbanzos para eso.' using errcode = 'P0001';
  end if;
  update public.piso_casino_cuentas c set garbanzos = c.garbanzos - precio where c.user_id = me;
  perform public.piso_sumar(me, articulo, 1);
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_lata_canjear(date, text) from public, anon;
grant execute on function public.piso_casino_lata_canjear(date, text) to authenticated;

-- El cambio: 'a-tickets' (50 garbanzos por 5 tickets) o 'a-garbanzos' (5 tickets por 25 garbanzos), hasta 10 tickets a
-- la semana en cada sentido. La semana la pone el servidor: el día de la app no cambia el tope
create or replace function public.piso_casino_cambiar(dia date, sentido text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  reglas jsonb := public.piso_casino_reglas();
  lote integer := (reglas ->> 'cambioTickets')::integer;
  tope integer := (reglas ->> 'topeCambio')::integer;
  lunes date := date_trunc('week', current_date)::date;
  hecho public.piso_casino_cambios;
  saldo integer;
begin
  if sentido is null or sentido not in ('a-tickets', 'a-garbanzos') then
    raise exception 'Ese cambio no se hace aquí.' using errcode = 'P0001';
  end if;
  insert into public.piso_casino_cuentas (user_id) values (me) on conflict do nothing;
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  select c.tickets into saldo from public.piso_cuentas c where c.user_id = me for update;
  if saldo is null then
    raise exception 'Entra antes en tu piso del edificio.' using errcode = 'P0001';
  end if;
  insert into public.piso_casino_cambios (user_id, semana) values (me, lunes) on conflict do nothing;
  select * into hecho from public.piso_casino_cambios c where c.user_id = me and c.semana = lunes;
  if sentido = 'a-tickets' then
    if hecho.a_tickets + lote > tope then
      raise exception 'Esta semana ya has cambiado todo lo que se puede.' using errcode = 'P0001';
    end if;
    if (select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me) < (reglas ->> 'cambioGarbanzos')::integer then
      raise exception 'Te faltan garbanzos para eso.' using errcode = 'P0001';
    end if;
    update public.piso_casino_cuentas c set garbanzos = c.garbanzos - (reglas ->> 'cambioGarbanzos')::integer where c.user_id = me;
    update public.piso_cuentas c set tickets = least(100000, c.tickets + lote) where c.user_id = me;
    update public.piso_casino_cambios c set a_tickets = c.a_tickets + lote where c.user_id = me and c.semana = lunes;
  else
    if hecho.a_garbanzos + lote > tope then
      raise exception 'Esta semana ya has cambiado todo lo que se puede.' using errcode = 'P0001';
    end if;
    if saldo < lote then
      raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
    end if;
    update public.piso_cuentas c set tickets = c.tickets - lote where c.user_id = me;
    update public.piso_casino_cuentas c set garbanzos = least(100000, c.garbanzos + (reglas ->> 'vueltaGarbanzos')::integer) where c.user_id = me;
    update public.piso_casino_cambios c set a_garbanzos = c.a_garbanzos + lote where c.user_id = me and c.semana = lunes;
  end if;
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_cambiar(date, text) from public, anon;
grant execute on function public.piso_casino_cambiar(date, text) to authenticated;
