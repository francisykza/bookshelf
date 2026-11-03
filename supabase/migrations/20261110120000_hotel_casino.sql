-- 1.80 · El casino del sótano del Gran Hotel (paso C de docs/qa/gran-hotel.md §9.4, decisiones de Francisco del
-- 2-11-2026 y del 3-11-2026): «Las 21 páginas», un veintiuno contra el crupier con cartas-página, tres manos al día.
-- Contra el crupier NO SE APUESTA: cada mano da fichas (más o menos según cómo acabe) y nunca se pierde nada de lo que
-- ya tienes. Las fichas son una moneda aparte (no son tickets ni se compran con dinero), con un tope de 150 a la
-- semana (semanas de lunes a domingo).
--   · La partida la reparte y la puntúa el servidor: el mazo barajado se guarda aquí y la app solo ve tus cartas y la
--     carta vista del crupier hasta que la mano acaba.
--   · La puerta se abre si ese día has leído: como las misiones, eso lo sabe la biblioteca (en la app); el tope semanal
--     es lo que pone el límite aquí.
--   · La mesa para dos (3-11-2026, «Fichas y garbanzos», «Os seguís los dos», «En diferido»): con un amigo (os seguís
--     los dos) se juega contra el mismo crupier y el mismo mazo, cada uno cuando quiere; cuando los dos han jugado, el
--     crupier destapa y pide hasta 17. Esas manos son de las tres del día y dan 2 fichas de compañía más a cada uno
--     (dentro del tope semanal). Entre los dos se puede apostar, aceptándolo los dos: fichas (una mesa al día por pareja,
--     hasta 10) y garbanzos (una moneda imaginaria sin ningún valor: 100 al empezar, +20 cada día que juegas, hasta 50
--     por mano). Gana la apuesta quien acaba más cerca de 21 sin pasarse; si empatan (o se pasan los dos), se devuelve.
--     Lo apostado queda apartado al aceptar la mesa, para que nadie apueste lo que no tiene. Única excepción a «sin
--     apostar» (CLAUDE.md).
--   · La caja (el canje, 3-11-2026; «muy atractiva, con recompensas muy llamativas»): las fichas se cambian por un
--     sobre de «Edición coleccionista» (120: el mismo sorteo, con sus probabilidades y su pity), ropa del personaje
--     (visera 60, raya diplomática 80, chaleco de crupier 100, fedora 140 y el vestido de lentejuelas 200), muebles
--     exclusivos con efectos (rótulo de neón «21» 250, mesa de tapete 300, gramola 400) y el compañero legendario, el
--     conejo de la chistera (1500). Lo de la caja no sale en ningún sobre, no se recicla ni se regala (para que las
--     fichas no se conviertan en tickets) y se tiene una vez. La ropa no entra en el orden de las misiones del día.
-- Necesita las migraciones del edificio, la tienda, la comunidad (seguir), el personaje y las misiones, los místicos y
-- la tanda 3. ADITIVA y re-ejecutable: tablas, columnas y funciones nuevas, cuatro filas del catálogo y redefine
-- piso_al_azar, piso_personaje_valido y pisos_personaje_prendas con lo de la caja. No borra datos ni cambia políticas.
-- La aplica Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/casino.rls.test.js,
-- casino-mesa.rls.test.js y casino-caja.rls.test.js).

-- ── Tablas (solo se usan desde las funciones) ──
create table if not exists public.piso_casino_cuentas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fichas integer not null default 0 check (fichas >= 0),
  garbanzos integer not null default 100 check (garbanzos >= 0),
  -- El último día que se dieron los garbanzos del día
  garbanzos_dia date
);
-- La mesa para dos: quien invita, a quién, lo apostado y el mazo y el crupier que comparten
create table if not exists public.piso_casino_mesas (
  id uuid primary key default gen_random_uuid(),
  dia date not null,
  anfitrion uuid not null references auth.users (id) on delete cascade,
  invitado uuid not null references auth.users (id) on delete cascade,
  estado text not null default 'invitada' check (estado in ('invitada', 'jugando', 'cerrada', 'rechazada')),
  fichas integer not null default 0 check (fichas between 0 and 10),
  garbanzos integer not null default 0 check (garbanzos between 0 and 50),
  mazo smallint[],
  crupier smallint[],
  -- Quién se lleva la apuesta (null: empate o sin apuesta)
  ganador uuid,
  creado timestamptz not null default now(),
  check (anfitrion <> invitado)
);
-- Una mesa al día por pareja (las rechazadas no cuentan)
create unique index if not exists piso_casino_mesas_pareja on public.piso_casino_mesas (dia, least(anfitrion, invitado), greatest(anfitrion, invitado)) where estado <> 'rechazada';
-- Cada mano: `mazo` es lo que queda por repartir (cartas 0–51: palo = c / 13, valor = c % 13, 0 es el as). En la mesa
-- para dos el mazo es el de la mesa, y la mano espera (`esperando`) a que juegue el otro
create table if not exists public.piso_casino_manos (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  mano smallint not null check (mano between 1 and 3),
  mazo smallint[] not null,
  tuyas smallint[] not null,
  crupier smallint[] not null,
  estado text not null default 'jugando' check (estado in ('jugando', 'esperando', 'veintiuna', 'ganada', 'empate', 'perdida')),
  fichas integer not null default 0,
  mesa uuid references public.piso_casino_mesas (id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (user_id, dia, mano)
);
alter table public.piso_casino_cuentas enable row level security;
alter table public.piso_casino_mesas enable row level security;
alter table public.piso_casino_manos enable row level security;
revoke all on public.piso_casino_cuentas from anon, authenticated;
revoke all on public.piso_casino_mesas from anon, authenticated;
revoke all on public.piso_casino_manos from anon, authenticated;

-- Las reglas en cifras (las mismas que CASINO en src/features/edificio/hotel/veintiuna.js; una prueba lo comprueba)
create or replace function public.piso_casino_reglas()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('manos', 3, 'tope', 150, 'veintiuna', 12, 'ganada', 8, 'empate', 4, 'perdida', 2,
    'compania', 2, 'apuestaFichas', 10, 'apuestaGarbanzos', 50, 'garbanzosInicio', 100, 'garbanzosDia', 20);
$$;

-- Lo que vale una mano: el as cuenta 11 o 1, las figuras 10
create or replace function public.piso_casino_valor(cartas smallint[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  total integer := 0;
  ases integer := 0;
  c smallint;
begin
  foreach c in array coalesce(cartas, '{}'::smallint[]) loop
    if c % 13 = 0 then
      ases := ases + 1;
      total := total + 11;
    else
      total := total + least(10, c % 13 + 1);
    end if;
  end loop;
  while total > 21 and ases > 0 loop
    total := total - 10;
    ases := ases - 1;
  end loop;
  return total;
end;
$$;

-- Cómo acaba una mano contra el crupier
create or replace function public.piso_casino_final(tuyas smallint[], crupier smallint[])
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  tu integer := public.piso_casino_valor(tuyas);
  suyo integer := public.piso_casino_valor(crupier);
begin
  if tu > 21 then
    return 'perdida';
  end if;
  if tu = 21 and cardinality(tuyas) = 2 then
    return case when suyo = 21 and cardinality(crupier) = 2 then 'empate' else 'veintiuna' end;
  end if;
  return case when suyo > 21 or tu > suyo then 'ganada' when tu = suyo then 'empate' else 'perdida' end;
end;
$$;

-- Las fichas ganadas en la semana de `dia`
create or replace function public.piso_casino_semana(uid uuid, dia date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(m.fichas), 0)::integer from public.piso_casino_manos m
    where m.user_id = uid and m.dia >= date_trunc('week', dia)::date and m.dia < date_trunc('week', dia)::date + 7;
$$;
revoke all on function public.piso_casino_semana(uuid, date) from public, anon, authenticated;

-- Cierra una mano: su estado y sus fichas (con `extra`, las de compañía; sin pasar del tope de la semana)
create or replace function public.piso_casino_cerrar(uid uuid, d date, n smallint, fin text, extra integer default 0)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reglas jsonb := public.piso_casino_reglas();
  premio integer;
begin
  premio := least((reglas ->> fin)::integer + extra, greatest(0, (reglas ->> 'tope')::integer - public.piso_casino_semana(uid, d)));
  update public.piso_casino_manos set estado = fin, fichas = premio where user_id = uid and dia = d and mano = n;
  update public.piso_casino_cuentas set fichas = fichas + premio where user_id = uid;
end;
$$;
revoke all on function public.piso_casino_cerrar(uuid, date, smallint, text, integer) from public, anon, authenticated;

-- La cuenta del casino de `uid` (se crea al llegar) y, la primera vez que juega cada día, sus garbanzos del día
create or replace function public.piso_casino_llegar(uid uuid, dia date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.piso_casino_cuentas (user_id) values (uid) on conflict do nothing;
  update public.piso_casino_cuentas c
    set garbanzos = least(100000, c.garbanzos + (public.piso_casino_reglas() ->> 'garbanzosDia')::integer), garbanzos_dia = dia
    where c.user_id = uid and c.garbanzos_dia is distinct from dia;
end;
$$;
revoke all on function public.piso_casino_llegar(uuid, date) from public, anon, authenticated;

-- ¿Es `otro` tu amigo? Os seguís los dos, los dos tenéis la comunidad y no hay un bloqueo entre vosotros
create or replace function public.piso_casino_amigo(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select otro is not null and otro <> auth.uid()
    and public.community_member(otro)
    and not public.is_blocked_pair(otro)
    and exists (select 1 from public.follows f where f.follower = auth.uid() and f.followed = otro)
    and exists (select 1 from public.follows f where f.follower = otro and f.followed = auth.uid());
$$;
revoke all on function public.piso_casino_amigo(uuid) from public, anon, authenticated;

-- Resuelve una mesa cuando los dos han jugado: el crupier pide hasta 17, cada mano se cierra contra él (con las fichas
-- de compañía) y la apuesta va a quien acabó más cerca de 21 sin pasarse (empate: se devuelve a cada uno)
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
    perform public.piso_casino_cerrar(h.user_id, h.dia, h.mano, public.piso_casino_final(h.tuyas, m.crupier), extra);
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

-- Las mesas que se quedaron a medias: una invitación sin aceptar de hace más de un día se retira; una mesa empezada,
-- se planta a quien no jugó y se resuelve
create or replace function public.piso_casino_mesas_vencer(uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m_id uuid;
begin
  update public.piso_casino_mesas x set estado = 'rechazada'
    where x.estado = 'invitada' and x.dia < current_date - 1 and uid in (x.anfitrion, x.invitado);
  for m_id in select x.id from public.piso_casino_mesas x where x.estado = 'jugando' and x.dia < current_date - 1 and uid in (x.anfitrion, x.invitado) loop
    update public.piso_casino_manos x set estado = 'esperando' where x.mesa = m_id and x.estado = 'jugando';
    perform public.piso_casino_mesa_resolver(m_id);
  end loop;
end;
$$;
revoke all on function public.piso_casino_mesas_vencer(uuid) from public, anon, authenticated;

-- ── La caja ──

-- Lo de la caja, con su precio en fichas (lo mismo que CAJA en src/features/edificio/hotel/veintiuna.js; una prueba lo
-- comprueba). Las prendas van como «clave:valor» del aspecto; los muebles y el compañero, por su id del catálogo
create or replace function public.piso_casino_caja_precios()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'sobre', jsonb_build_object('tipo', 'sobre', 'precio', 120),
    'complemento:visera', jsonb_build_object('tipo', 'prenda', 'precio', 60),
    'pantalon:9', jsonb_build_object('tipo', 'prenda', 'precio', 80),
    'jersey:15', jsonb_build_object('tipo', 'prenda', 'precio', 100),
    'complemento:fedora', jsonb_build_object('tipo', 'prenda', 'precio', 140),
    'jersey:16', jsonb_build_object('tipo', 'prenda', 'precio', 200),
    'neon-veintiuna', jsonb_build_object('tipo', 'mueble', 'precio', 250),
    'mesa-tapete', jsonb_build_object('tipo', 'mueble', 'precio', 300),
    'gramola', jsonb_build_object('tipo', 'mueble', 'precio', 400),
    'conejo-chistera', jsonb_build_object('tipo', 'companero', 'precio', 1500));
$$;

-- Los muebles y el compañero de la caja: no salen en los sobres
create or replace function public.piso_casino_exclusivos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['neon-veintiuna', 'mesa-tapete', 'gramola', 'conejo-chistera'];
$$;

-- La ropa de la caja (no entra en el orden de las misiones del día)
create or replace function public.piso_casino_ropa()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:visera', 'pantalon:9', 'jersey:15', 'complemento:fedora', 'jersey:16'];
$$;

-- En el catálogo (los mismos que en src/features/edificio/catalog.js): tres premios con efectos (rareza 'especial': no
-- se compran con tickets, no salen en sobres y no se reciclan ni se regalan) y el conejo, legendario que te acompaña
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('neon-veintiuna', 'pared', 2, null, null, 1, 'especial'),
  ('mesa-tapete', 'suelo', 2, 1, 0.95, 1, 'especial'),
  ('gramola', 'suelo', 1, 1, null, 1, 'especial'),
  ('conejo-chistera', 'suelo', 1, 1, null, 1, 'legendario')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- El azar de los sobres (la de la 1.67), sin lo de la caja: el conejo es legendario, pero solo se cambia por fichas
create or replace function public.piso_al_azar(r text, lista jsonb)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.id from public.piso_catalogo k
      where k.rareza = r and k.saga is null and k.id <> all (public.piso_casino_exclusivos()) and (lista is null or lista ? k.id)
      order by random() limit 1),
    (select k.id from public.piso_catalogo k where k.rareza = r and k.saga is null and k.id <> all (public.piso_casino_exclusivos()) order by random() limit 1)
  );
$$;
revoke all on function public.piso_al_azar(text, jsonb) from public, anon, authenticated;

-- El aspecto válido (la de la tanda 3), con la ropa de la caja: el chaleco (15) y el vestido (16), la raya
-- diplomática (9), la visera y la fedora
create or replace function public.piso_personaje_valido(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) = 7
    and (select bool_and(k in ('piel', 'pelo', 'colorPelo', 'jersey', 'pantalon', 'gafas', 'complemento')) from jsonb_object_keys(p) k)
    and jsonb_typeof(p->'piel') = 'number' and (p->>'piel') in ('0', '1', '2', '3', '4')
    and jsonb_typeof(p->'pelo') = 'string' and (p->>'pelo') in ('corto', 'melena', 'mono', 'rizos', 'largo', 'rapado')
    and jsonb_typeof(p->'colorPelo') = 'number' and (p->>'colorPelo') in ('0', '1', '2', '3', '4', '5', '6', '7')
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa', 'visera', 'fedora')
  )
$$;

-- Solo se lleva lo que se tiene (la de las misiones del día), también la ropa de la caja
create or replace function public.pisos_personaje_prendas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  falta text;
begin
  if new.personaje is null then
    return new;
  end if;
  select k into falta from unnest(array[
      'colorPelo:' || (new.personaje->>'colorPelo'),
      'jersey:' || (new.personaje->>'jersey'),
      'pantalon:' || (new.personaje->>'pantalon'),
      'complemento:' || (new.personaje->>'complemento')
    ]) as k
    where (k = any (public.piso_prendas_orden()) or k = any (public.piso_casino_ropa()))
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    if falta = any (public.piso_casino_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por fichas en la caja del casino.' using errcode = 'P0001';
    end if;
    raise exception 'Aún no tienes esa prenda: se gana con las misiones del día.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pisos_personaje_prendas() from public, anon, authenticated;

-- Lo de la caja para `uid`: [{ id, tipo, precio, tienes }] (el sobre nunca se «tiene»)
create or replace function public.piso_casino_caja(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.key,
      'tipo', a.value ->> 'tipo',
      'precio', (a.value ->> 'precio')::integer,
      'tienes', case a.value ->> 'tipo'
        when 'prenda' then exists (select 1 from public.piso_prendas x where x.user_id = uid and x.prenda = a.key)
        when 'sobre' then false
        else exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = a.key and v.copias > 0) end
    ) order by (a.value ->> 'precio')::integer), '[]'::jsonb)
  from jsonb_each(public.piso_casino_caja_precios()) a;
$$;
revoke all on function public.piso_casino_caja(uuid) from public, anon, authenticated;

-- El casino para quien juega: { dia, fichas, garbanzos, semana, tope, manos: [{ mano, mesa, tuyas, crupier, tu, suyo,
-- estado, fichas }], quedan, jugando, mesas: [...], amigos: [{ uid, alias, avatar_id }] }. Mientras se juega, del
-- crupier solo se ve la primera carta; en la mesa para dos, las cartas del otro no se ven hasta que se resuelve
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
    from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino.dia;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'dia', x.dia,
      'anfitrion', x.anfitrion = me,
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
  return jsonb_build_object(
    'dia', dia,
    'fichas', (select c.fichas from public.piso_casino_cuentas c where c.user_id = me),
    'garbanzos', (select c.garbanzos from public.piso_casino_cuentas c where c.user_id = me),
    'semana', public.piso_casino_semana(me, dia),
    'tope', (reglas ->> 'tope')::integer,
    'manos', manos,
    'quedan', greatest(0, (reglas ->> 'manos')::integer - hechas),
    'jugando', exists (select 1 from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino.dia and m.estado = 'jugando' and m.mesa is null),
    'mesas', mesas,
    'amigos', amigos,
    'caja', public.piso_casino_caja(me)
  );
end;
$$;
revoke all on function public.piso_casino(date) from public, anon;
grant execute on function public.piso_casino(date) to authenticated;

-- Repartir la siguiente mano del día contra el crupier, tú solo (hoy, ayer o mañana, por las zonas horarias)
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

-- Jugar la mano abierta, tú solo: 'pedir' (otra carta) o 'plantarse' (el crupier pide hasta 17 y se comparan)
create or replace function public.piso_casino_jugar(dia date, accion text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  m public.piso_casino_manos;
  tu integer;
begin
  if accion not in ('pedir', 'plantarse') then
    raise exception 'Eso no se puede hacer en la mesa.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  select * into m from public.piso_casino_manos x where x.user_id = me and x.dia = piso_casino_jugar.dia and x.estado = 'jugando' and x.mesa is null;
  if m.user_id is null then
    raise exception 'No tienes ninguna mano abierta.' using errcode = 'P0001';
  end if;
  if accion = 'pedir' then
    m.tuyas := m.tuyas || m.mazo[1];
    m.mazo := m.mazo[2:];
    update public.piso_casino_manos x set tuyas = m.tuyas, mazo = m.mazo where x.user_id = me and x.dia = m.dia and x.mano = m.mano;
    tu := public.piso_casino_valor(m.tuyas);
    if tu > 21 then
      perform public.piso_casino_cerrar(me, m.dia, m.mano, 'perdida');
      return public.piso_casino(dia);
    elsif tu < 21 then
      return public.piso_casino(dia);
    end if;
    -- Con 21 justos te plantas solo
  end if;
  while public.piso_casino_valor(m.crupier) < 17 loop
    m.crupier := m.crupier || m.mazo[1];
    m.mazo := m.mazo[2:];
  end loop;
  update public.piso_casino_manos x set crupier = m.crupier, mazo = m.mazo where x.user_id = me and x.dia = m.dia and x.mano = m.mano;
  perform public.piso_casino_cerrar(me, m.dia, m.mano, public.piso_casino_final(m.tuyas, m.crupier));
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_jugar(date, text) from public, anon;
grant execute on function public.piso_casino_jugar(date, text) to authenticated;

-- ── La mesa para dos ──

-- Invitar a un amigo a una mesa (hoy, ayer o mañana), con lo que se apuesta (0 si nada)
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
  if (select count(*) from public.piso_casino_manos m where m.user_id = me and m.dia = piso_casino_invitar.dia) >= (reglas ->> 'manos')::integer then
    raise exception 'Hoy ya has jugado tus tres manos: vuelve mañana.' using errcode = 'P0001';
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

-- Aceptar una mesa: se aparta lo apostado de los dos y se reparte (dos cartas a cada uno y al crupier del mismo mazo)
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

-- No aceptar una mesa (quien invita también la puede retirar mientras nadie la ha aceptado)
create or replace function public.piso_casino_rechazar(mesa uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  m public.piso_casino_mesas;
begin
  select * into m from public.piso_casino_mesas x where x.id = mesa for update;
  if m.id is null or me not in (m.anfitrion, m.invitado) or m.estado <> 'invitada' then
    raise exception 'Esa mesa ya no se puede retirar.' using errcode = 'P0001';
  end if;
  update public.piso_casino_mesas x set estado = 'rechazada' where x.id = m.id;
  return public.piso_casino(m.dia);
end;
$$;
revoke all on function public.piso_casino_rechazar(uuid) from public, anon;
grant execute on function public.piso_casino_rechazar(uuid) to authenticated;

-- Jugar tu mano de la mesa: 'pedir' (otra carta del mazo de la mesa) o 'plantarse'. Al pasarte o llegar a 21 te
-- plantas solo; cuando los dos habéis terminado, el crupier destapa
create or replace function public.piso_casino_mesa_jugar(mesa uuid, accion text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  m public.piso_casino_mesas;
  h public.piso_casino_manos;
begin
  if accion not in ('pedir', 'plantarse') then
    raise exception 'Eso no se puede hacer en la mesa.' using errcode = 'P0001';
  end if;
  select * into m from public.piso_casino_mesas x where x.id = mesa for update;
  select * into h from public.piso_casino_manos x where x.mesa = m.id and x.user_id = me and x.estado = 'jugando';
  if m.id is null or m.estado <> 'jugando' or h.user_id is null then
    raise exception 'No tienes ninguna mano abierta en esa mesa.' using errcode = 'P0001';
  end if;
  if accion = 'pedir' then
    h.tuyas := h.tuyas || m.mazo[1];
    update public.piso_casino_mesas x set mazo = m.mazo[2:] where x.id = m.id;
    update public.piso_casino_manos x set tuyas = h.tuyas, estado = case when public.piso_casino_valor(h.tuyas) >= 21 then 'esperando' else 'jugando' end
      where x.user_id = me and x.dia = h.dia and x.mano = h.mano;
  else
    update public.piso_casino_manos x set estado = 'esperando' where x.user_id = me and x.dia = h.dia and x.mano = h.mano;
  end if;
  perform public.piso_casino_mesa_resolver(m.id);
  return public.piso_casino(m.dia);
end;
$$;
revoke all on function public.piso_casino_mesa_jugar(uuid, text) from public, anon;
grant execute on function public.piso_casino_mesa_jugar(uuid, text) to authenticated;

-- Cambiar fichas en la caja por `articulo` (un id de piso_casino_caja_precios). Devuelve el casino del día y, con el
-- sobre, sus premios ({ ..., premios: [{ mueble, rareza, nuevo }] }). Lo que no es el sobre se tiene una vez
create or replace function public.piso_casino_canjear(dia date, articulo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  def jsonb := public.piso_casino_caja_precios() -> articulo;
  precio integer;
  tipo text;
  coste integer;
  saldo integer;
  sobre jsonb;
begin
  if def is null then
    raise exception 'Eso no está en la caja.' using errcode = 'P0001';
  end if;
  precio := (def ->> 'precio')::integer;
  tipo := def ->> 'tipo';
  insert into public.piso_casino_cuentas (user_id) values (me) on conflict do nothing;
  perform 1 from public.piso_casino_cuentas c where c.user_id = me for update;
  if tipo <> 'sobre' and (select (x ->> 'tienes')::boolean from jsonb_array_elements(public.piso_casino_caja(me)) x where x ->> 'id' = articulo) then
    raise exception 'Eso ya lo tienes.' using errcode = 'P0001';
  end if;
  if (select c.fichas from public.piso_casino_cuentas c where c.user_id = me) < precio then
    raise exception 'Te faltan fichas para eso.' using errcode = 'P0001';
  end if;
  update public.piso_casino_cuentas c set fichas = c.fichas - precio where c.user_id = me;
  if tipo = 'prenda' then
    insert into public.piso_prendas (user_id, prenda) values (me, articulo) on conflict do nothing;
  elsif tipo in ('mueble', 'companero') then
    perform public.piso_sumar(me, articulo, 1);
  else
    -- El sobre: el mismo sorteo que el de la tienda (piso_abrir_sobre, con sus probabilidades y su pity). Se le dan
    -- los tickets que cuesta y se los cobra él, en la misma transacción: los tickets quedan igual
    coste := (public.piso_sobre('coleccion') ->> 'coste1')::integer;
    select c.tickets into saldo from public.piso_cuentas c where c.user_id = me for update;
    if saldo < coste then
      update public.piso_cuentas c set tickets = c.tickets + coste where c.user_id = me;
      sobre := public.piso_abrir_sobre('coleccion', 1);
    else
      sobre := public.piso_abrir_sobre('coleccion', 1);
      update public.piso_cuentas c set tickets = c.tickets + coste where c.user_id = me;
    end if;
    return public.piso_casino(dia) || jsonb_build_object('premios', sobre -> 'premios');
  end if;
  return public.piso_casino(dia);
end;
$$;
revoke all on function public.piso_casino_canjear(date, text) from public, anon;
grant execute on function public.piso_casino_canjear(date, text) to authenticated;
