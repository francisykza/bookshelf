-- El Almacén del Puerto (1.99, SPEC §99; encargo de Francisco del 9-11-2026): la Lonja pasa a ser un almacén de muebles en 3D
-- que se recorre, con carrito, caja y un descuento diario opcional («Sella el albarán»), y que se puede visitar con un amigo.
-- La aplica Francisco en el SQL Editor. Sin ella, el almacén se ve pero la caja dice que aún no está abierta.
--
-- Reglas:
-- - Se compra con los tickets de siempre y el catálogo de siempre (`piso_catalogo`, `piso_precio`, sin sagas ni retirados):
--   no cambia ningún precio ni ninguna recompensa. El cliente manda qué y cuántos; el importe y el descuento los pone el servidor.
-- - Una compra es una sola operación: comprueba artículos y precios, saldo y descuento, cobra, entrega los muebles al inventario
--   y gasta el descuento, todo o nada. La clave de compra la pone el cliente: repetirla (doble toque, reintento tras un fallo de
--   red) devuelve el mismo resultado sin cobrar dos veces. La cuenta se bloquea (`for update`) mientras tanto.
-- - «Sella el albarán»: un intento al día por cuenta (día de Madrid, lo decide el servidor). El intento se gasta al empezar;
--   cada plano se sella dentro de su tiempo (contado por el servidor) y el resultado (0, 3, 6 o 10 %) queda guardado hasta que
--   acabe el día. El descuento vale para una sola compra. Aviso: si un plano se acierta lo dice el cliente; el servidor solo
--   comprueba que se selle a su tiempo y una vez, y pone el porcentaje.
-- - La visita con un amigo: solo con seguimiento mutuo y sin bloqueo (`piso_casino_amigo`). Cada uno manda dónde está cada
--   segundo o así; lo que ve el otro es su posición, lo que señala y cómo va su albarán. Nunca sus tickets ni su carrito.

-- ── El día del almacén: el de Madrid, y cuándo vuelve el intento ──
create or replace function public.piso_almacen_hoy()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;
revoke all on function public.piso_almacen_hoy() from public, anon, authenticated;

-- ── El albarán del día de cada cuenta ──
create table if not exists public.piso_almacen_dia (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  modo text not null check (modo in ('rapido', 'sinprisa')),
  empezado_en timestamptz not null default now(),
  -- Un valor por plano: true (sellado en la marca), false (fallado) o null (aún sin sellar)
  marcas jsonb not null default '[null, null, null]'::jsonb,
  usado_en timestamptz,
  primary key (user_id, dia)
);
alter table public.piso_almacen_dia enable row level security;
revoke all on table public.piso_almacen_dia from anon, authenticated;

-- ── Las compras (la clave la pone el cliente: así un reintento no cobra dos veces) ──
create table if not exists public.piso_almacen_compras (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  articulos jsonb not null,
  subtotal integer not null,
  pct integer not null,
  descuento integer not null,
  total integer not null,
  creada timestamptz not null default now()
);
create index if not exists piso_almacen_compras_user on public.piso_almacen_compras (user_id, creada desc);
alter table public.piso_almacen_compras enable row level security;
revoke all on table public.piso_almacen_compras from anon, authenticated;

-- Los tiempos del albarán (en milisegundos), iguales que en el cliente (`hotel/albaran.js`)
create or replace function public.piso_almacen_tiempos(modo text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('previo', 1500, 'plano', case when modo = 'sinprisa' then 9000 else 3800 end, 'margen', 2500);
$$;
revoke all on function public.piso_almacen_tiempos(text) from public, anon, authenticated;

-- El estado del albarán de una fila: 'jugando' mientras queden planos con tiempo; luego 'hecho' (con su porcentaje) o 'usado'
create or replace function public.piso_almacen_descuento(d public.piso_almacen_dia)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  t jsonb := public.piso_almacen_tiempos(d.modo);
  fin timestamptz := d.empezado_en + (((t ->> 'previo')::integer + 3 * (t ->> 'plano')::integer + (t ->> 'margen')::integer) || ' milliseconds')::interval;
  aciertos integer := (select count(*) from jsonb_array_elements(d.marcas) m where m = 'true'::jsonb);
  pendientes integer := (select count(*) from jsonb_array_elements(d.marcas) m where m = 'null'::jsonb);
  estado text;
begin
  estado := case when d.usado_en is not null then 'usado' when pendientes > 0 and now() < fin then 'jugando' else 'hecho' end;
  return jsonb_build_object(
    'estado', estado,
    'modo', d.modo,
    'empezado', (extract(epoch from d.empezado_en) * 1000)::bigint,
    'marcas', d.marcas,
    'aciertos', aciertos,
    'pct', case when estado = 'jugando' then null else (array[0, 3, 6, 10])[aciertos + 1] end
  );
end;
$$;
revoke all on function public.piso_almacen_descuento(public.piso_almacen_dia) from public, anon, authenticated;

-- ── Lo que necesita la caja: el día, la hora del servidor, cuándo vuelve el intento, tus tickets y tu albarán ──
create or replace function public.piso_almacen_estado()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hoy date := public.piso_almacen_hoy();
  d public.piso_almacen_dia;
begin
  select * into d from public.piso_almacen_dia x where x.user_id = me and x.dia = hoy;
  return jsonb_build_object(
    'dia', hoy,
    'ahora', (extract(epoch from now()) * 1000)::bigint,
    'vuelve', (extract(epoch from ((hoy + 1)::timestamp at time zone 'Europe/Madrid')) * 1000)::bigint,
    'tickets', (select c.tickets from public.piso_cuentas c where c.user_id = me),
    'descuento', case when d.user_id is null then jsonb_build_object('estado', 'libre') else public.piso_almacen_descuento(d) end
  );
end;
$$;
revoke all on function public.piso_almacen_estado() from public, anon;
grant execute on function public.piso_almacen_estado() to authenticated;

-- Empezar el albarán de hoy: gasta el intento al momento (cancelar o recargar no lo devuelve). Si ya se empezó, no hace nada.
create or replace function public.piso_almacen_empezar(modo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if modo is null or modo not in ('rapido', 'sinprisa') then
    raise exception 'almacen:modo' using errcode = 'P0001';
  end if;
  insert into public.piso_almacen_dia (user_id, dia, modo) values (me, public.piso_almacen_hoy(), modo)
    on conflict (user_id, dia) do nothing;
  return public.piso_almacen_estado();
end;
$$;
revoke all on function public.piso_almacen_empezar(text) from public, anon;
grant execute on function public.piso_almacen_empezar(text) to authenticated;

-- Sellar un plano (0, 1 o 2): una vez y dentro de su tiempo, contado desde que empezó el albarán
create or replace function public.piso_almacen_sellar(plano integer, acierto boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  d public.piso_almacen_dia;
  t jsonb;
  desde timestamptz;
  hasta timestamptz;
begin
  select * into d from public.piso_almacen_dia x where x.user_id = me and x.dia = public.piso_almacen_hoy() for update;
  if d.user_id is null or d.usado_en is not null then
    raise exception 'almacen:sin_albaran' using errcode = 'P0001';
  end if;
  if plano is null or plano < 0 or plano > 2 or acierto is null then
    raise exception 'almacen:plano' using errcode = 'P0001';
  end if;
  if d.marcas -> plano <> 'null'::jsonb then
    return public.piso_almacen_estado();
  end if;
  t := public.piso_almacen_tiempos(d.modo);
  desde := d.empezado_en + (((t ->> 'previo')::integer + plano * (t ->> 'plano')::integer - 600) || ' milliseconds')::interval;
  hasta := d.empezado_en + (((t ->> 'previo')::integer + (plano + 1) * (t ->> 'plano')::integer + (t ->> 'margen')::integer) || ' milliseconds')::interval;
  -- Fuera de su tiempo cuenta como fallado (nunca como acierto)
  update public.piso_almacen_dia x
     set marcas = jsonb_set(x.marcas, array[plano::text], to_jsonb(acierto and now() between desde and hasta))
   where x.user_id = me and x.dia = d.dia;
  return public.piso_almacen_estado();
end;
$$;
revoke all on function public.piso_almacen_sellar(integer, boolean) from public, anon;
grant execute on function public.piso_almacen_sellar(integer, boolean) to authenticated;

-- ── Comprar el carrito ──
-- `compra`: la clave de esta compra (la misma en cada reintento). `articulos`: [{ id, n }] (n de 1 a 10, hasta 12 líneas).
-- `esperado`: el total que se le enseñó a quien compra; si no cuadra (un precio cambió), no se cobra y se avisa.
-- `usar_descuento`: gastar en esta compra el descuento de hoy (solo si está ganado y sin usar).
create or replace function public.piso_almacen_comprar(compra uuid, articulos jsonb, esperado integer, usar_descuento boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hecha public.piso_almacen_compras;
  saldo integer;
  linea jsonb;
  k public.piso_catalogo;
  precio integer;
  n integer;
  subtotal integer := 0;
  pct integer := 0;
  rebaja integer;
  total integer;
  d public.piso_almacen_dia;
  ids text[] := '{}';
begin
  if compra is null then
    raise exception 'almacen:clave' using errcode = 'P0001';
  end if;
  -- La cuenta, bloqueada hasta el final: dos compras a la vez de la misma persona van una detrás de otra
  select c.tickets into saldo from public.piso_cuentas c where c.user_id = me for update;
  if saldo is null then
    raise exception 'almacen:sin_cuenta' using errcode = 'P0001';
  end if;
  -- Ya hecha con esta clave (doble toque, reintento): el mismo resultado, sin cobrar otra vez
  select * into hecha from public.piso_almacen_compras x where x.id = compra;
  if hecha.id is not null then
    if hecha.user_id <> me then
      raise exception 'almacen:clave' using errcode = 'P0001';
    end if;
    return jsonb_build_object('compra', hecha.id, 'repetida', true, 'subtotal', hecha.subtotal, 'pct', hecha.pct, 'descuento', hecha.descuento,
      'total', hecha.total, 'articulos', hecha.articulos, 'inventario', public.piso_mi_inventario());
  end if;
  if articulos is null or jsonb_typeof(articulos) <> 'array' or jsonb_array_length(articulos) = 0 or jsonb_array_length(articulos) > 12 then
    raise exception 'almacen:vacio' using errcode = 'P0001';
  end if;
  for linea in select * from jsonb_array_elements(articulos) loop
    if jsonb_typeof(linea -> 'id') <> 'string' or jsonb_typeof(linea -> 'n') <> 'number' then
      raise exception 'almacen:linea' using errcode = 'P0001';
    end if;
    n := (linea ->> 'n')::numeric;
    if n is null or n < 1 or n > 10 or (linea ->> 'n')::numeric <> n or (linea ->> 'id') = any (ids) then
      raise exception 'almacen:linea' using errcode = 'P0001';
    end if;
    ids := ids || (linea ->> 'id');
    if public.piso_retirado(linea ->> 'id') then
      raise exception 'almacen:retirado' using errcode = 'P0001';
    end if;
    select * into k from public.piso_catalogo c where c.id = linea ->> 'id';
    precio := case when k.id is null or k.saga is not null then null else public.piso_precio(k.rareza) end;
    if precio is null then
      raise exception 'almacen:no_se_vende' using errcode = 'P0001';
    end if;
    subtotal := subtotal + precio * n;
  end loop;
  if coalesce(usar_descuento, false) then
    select * into d from public.piso_almacen_dia x where x.user_id = me and x.dia = public.piso_almacen_hoy() for update;
    if d.user_id is null or (public.piso_almacen_descuento(d) ->> 'estado') <> 'hecho' then
      raise exception 'almacen:descuento' using errcode = 'P0001';
    end if;
    pct := (public.piso_almacen_descuento(d) ->> 'pct')::integer;
  end if;
  rebaja := floor(subtotal * pct / 100.0)::integer;
  total := subtotal - rebaja;
  if esperado is distinct from total then
    raise exception 'almacen:precio' using errcode = 'P0001';
  end if;
  if saldo < total then
    raise exception 'almacen:saldo' using errcode = 'P0001';
  end if;
  update public.piso_cuentas set tickets = tickets - total where user_id = me;
  for linea in select * from jsonb_array_elements(articulos) loop
    perform public.piso_sumar(me, linea ->> 'id', (linea ->> 'n')::integer);
  end loop;
  if d.user_id is not null then
    update public.piso_almacen_dia x set usado_en = now() where x.user_id = me and x.dia = d.dia;
  end if;
  insert into public.piso_almacen_compras (id, user_id, articulos, subtotal, pct, descuento, total)
    values (compra, me, articulos, subtotal, pct, rebaja, total);
  return jsonb_build_object('compra', compra, 'repetida', false, 'subtotal', subtotal, 'pct', pct, 'descuento', rebaja, 'total', total,
    'articulos', articulos, 'inventario', public.piso_mi_inventario());
end;
$$;
revoke all on function public.piso_almacen_comprar(uuid, jsonb, integer, boolean) from public, anon;
grant execute on function public.piso_almacen_comprar(uuid, jsonb, integer, boolean) to authenticated;

-- ── Visitar el almacén con un amigo ──
create table if not exists public.piso_almacen_salas (
  id uuid primary key default gen_random_uuid(),
  anfitrion uuid not null references auth.users (id) on delete cascade,
  invitado uuid not null references auth.users (id) on delete cascade,
  estado text not null default 'invitada' check (estado in ('invitada', 'abierta', 'cerrada')),
  creada timestamptz not null default now(),
  caduca timestamptz not null default now() + interval '3 hours'
);
create index if not exists piso_almacen_salas_invitado on public.piso_almacen_salas (invitado, estado);
create index if not exists piso_almacen_salas_anfitrion on public.piso_almacen_salas (anfitrion, estado);
alter table public.piso_almacen_salas enable row level security;
revoke all on table public.piso_almacen_salas from anon, authenticated;

create table if not exists public.piso_almacen_presencia (
  sala uuid not null references public.piso_almacen_salas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  x real not null default 15.5,
  y real not null default 23.6,
  yaw real not null default 3.5,
  zona text,
  mira text,
  mira_n integer not null default 0,
  sello jsonb,
  visto timestamptz not null default now(),
  primary key (sala, user_id)
);
alter table public.piso_almacen_presencia enable row level security;
revoke all on table public.piso_almacen_presencia from anon, authenticated;

-- Invitar a un amigo (seguimiento mutuo, sin bloqueo). Una sala abierta por anfitrión: invitar de nuevo cierra la anterior.
create or replace function public.piso_almacen_invitar(amigo uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s public.piso_almacen_salas;
begin
  if not public.piso_casino_amigo(amigo) then
    raise exception 'almacen:no_amigo' using errcode = 'P0001';
  end if;
  select * into s from public.piso_almacen_salas x
   where x.anfitrion = me and x.invitado = amigo and x.estado <> 'cerrada' and x.caduca > now()
   order by x.creada desc limit 1;
  if s.id is null then
    update public.piso_almacen_salas set estado = 'cerrada' where anfitrion = me and estado <> 'cerrada';
    insert into public.piso_almacen_salas (anfitrion, invitado) values (me, amigo) returning * into s;
  end if;
  return jsonb_build_object('sala', s.id, 'estado', s.estado);
end;
$$;
revoke all on function public.piso_almacen_invitar(uuid) from public, anon;
grant execute on function public.piso_almacen_invitar(uuid) to authenticated;

-- Tus amigos (a quién invitar), las invitaciones que te esperan y tu sala de anfitrión
create or replace function public.piso_almacen_amigos()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  return jsonb_build_object(
    'amigos', coalesce((
      select jsonb_agg(jsonb_build_object('uid', f.followed, 'alias', pr.alias, 'avatar_id', pr.avatar_id) order by pr.alias)
        from public.follows f join public.profiles pr on pr.user_id = f.followed
       where f.follower = me and public.piso_casino_amigo(f.followed)), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(jsonb_build_object('sala', x.id, 'uid', x.anfitrion, 'alias', pr.alias, 'avatar_id', pr.avatar_id, 'estado', x.estado) order by x.creada desc)
        from public.piso_almacen_salas x left join public.profiles pr on pr.user_id = x.anfitrion
       where x.invitado = me and x.estado <> 'cerrada' and x.caduca > now() and public.piso_casino_amigo(x.anfitrion)), '[]'::jsonb),
    'mia', (
      select jsonb_build_object('sala', x.id, 'uid', x.invitado, 'alias', pr.alias, 'avatar_id', pr.avatar_id, 'estado', x.estado)
        from public.piso_almacen_salas x left join public.profiles pr on pr.user_id = x.invitado
       where x.anfitrion = me and x.estado <> 'cerrada' and x.caduca > now()
       order by x.creada desc limit 1)
  );
end;
$$;
revoke all on function public.piso_almacen_amigos() from public, anon;
grant execute on function public.piso_almacen_amigos() to authenticated;

-- Entrar en la sala a la que te invitaron
create or replace function public.piso_almacen_unirse(sala uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s public.piso_almacen_salas;
begin
  select * into s from public.piso_almacen_salas x where x.id = sala for update;
  if s.id is null or s.invitado <> me or s.estado = 'cerrada' or s.caduca <= now() or not public.piso_casino_amigo(s.anfitrion) then
    raise exception 'almacen:sala' using errcode = 'P0001';
  end if;
  update public.piso_almacen_salas set estado = 'abierta', caduca = greatest(caduca, now() + interval '2 hours') where id = s.id;
  return jsonb_build_object('sala', s.id, 'estado', 'abierta');
end;
$$;
revoke all on function public.piso_almacen_unirse(uuid) from public, anon;
grant execute on function public.piso_almacen_unirse(uuid) to authenticated;

-- Salir: quien invitó cierra la sala; quien fue invitado solo se va (puede volver mientras siga abierta)
create or replace function public.piso_almacen_salir(sala uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  delete from public.piso_almacen_presencia p where p.sala = piso_almacen_salir.sala and p.user_id = me;
  update public.piso_almacen_salas x set estado = 'cerrada' where x.id = piso_almacen_salir.sala and x.anfitrion = me;
end;
$$;
revoke all on function public.piso_almacen_salir(uuid) from public, anon;
grant execute on function public.piso_almacen_salir(uuid) to authenticated;

-- El pulso (cada segundo o así): dónde estás, qué señalas y cómo va tu albarán; devuelve lo mismo de los demás de la sala
-- (vistos en los últimos 20 s), con su alias y su personaje. Nunca tickets, carrito ni compras.
create or replace function public.piso_almacen_pulso(sala uuid, x real, y real, yaw real, zona text, mira text, mira_n integer, sello jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s public.piso_almacen_salas;
  limpio jsonb := null;
begin
  select * into s from public.piso_almacen_salas v where v.id = sala;
  if s.id is null or me not in (s.anfitrion, s.invitado) or s.caduca <= now() then
    raise exception 'almacen:sala' using errcode = 'P0001';
  end if;
  if me = s.invitado and s.estado = 'invitada' then
    return jsonb_build_object('estado', 'invitada', 'otros', '[]'::jsonb);
  end if;
  if s.estado = 'cerrada' or not public.piso_casino_amigo(case when me = s.anfitrion then s.invitado else s.anfitrion end) then
    return jsonb_build_object('estado', 'cerrada', 'otros', '[]'::jsonb);
  end if;
  -- Solo lo que se puede enseñar del albarán: cuándo empezó, el modo y las marcas
  if jsonb_typeof(sello) = 'object' and (sello ->> 'modo') in ('rapido', 'sinprisa') and jsonb_typeof(sello -> 'marcas') = 'array'
     and jsonb_typeof(sello -> 'empezado') = 'number' then
    limpio := jsonb_build_object('modo', sello ->> 'modo', 'empezado', (sello ->> 'empezado')::bigint,
      'marcas', (select coalesce(jsonb_agg(case when m in ('true'::jsonb, 'false'::jsonb) then m else 'null'::jsonb end), '[]'::jsonb)
                   from (select m from jsonb_array_elements(sello -> 'marcas') m limit 3) q));
  end if;
  insert into public.piso_almacen_presencia as p (sala, user_id, x, y, yaw, zona, mira, mira_n, sello, visto)
  values (
    s.id, me,
    least(18, greatest(0, coalesce(piso_almacen_pulso.x, 15.5))),
    least(26, greatest(0, coalesce(piso_almacen_pulso.y, 23.6))),
    coalesce(piso_almacen_pulso.yaw, 3.5)::numeric % 7,
    case when zona in ('pasillos', 'caja', 'mercadillo') then zona else 'pasillos' end,
    case when exists (select 1 from public.piso_catalogo c where c.id = mira and c.saga is null) and not public.piso_retirado(mira) then mira else null end,
    least(1000000, greatest(0, coalesce(mira_n, 0))),
    limpio,
    now()
  )
  on conflict on constraint piso_almacen_presencia_pkey do update set x = excluded.x, y = excluded.y, yaw = excluded.yaw, zona = excluded.zona, mira = excluded.mira,
    mira_n = excluded.mira_n, sello = excluded.sello, visto = excluded.visto;
  return jsonb_build_object(
    'estado', s.estado,
    'otros', coalesce((
      select jsonb_agg(jsonb_build_object('uid', p.user_id, 'alias', pr.alias, 'avatar_id', pr.avatar_id,
        'personaje', (select ps.personaje from public.pisos ps where ps.user_id = p.user_id),
        'x', p.x, 'y', p.y, 'yaw', p.yaw, 'zona', p.zona, 'mira', p.mira, 'mira_n', p.mira_n, 'sello', p.sello,
        'hace', extract(epoch from now() - p.visto)))
        from public.piso_almacen_presencia p left join public.profiles pr on pr.user_id = p.user_id
       where p.sala = s.id and p.user_id <> me and p.visto > now() - interval '20 seconds'), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.piso_almacen_pulso(uuid, real, real, real, text, text, integer, jsonb) from public, anon;
grant execute on function public.piso_almacen_pulso(uuid, real, real, real, text, text, integer, jsonb) to authenticated;
