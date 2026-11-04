-- 1.84 (docs/qa/gran-hotel.md §9.2): la Lonja del entresuelo del Gran Hotel. Cada persona tiene un puesto con hasta 3 ofertas
-- del tipo «Doy un mueble · Busco otro mueble», «· Busco cualquier mueble de tal rareza» o «· Busco N tickets», con frases
-- cerradas y sin texto libre. Lo ofrecido sale de tu inventario hasta que alguien lo acepta, lo retiras o caduca (7 días), y
-- el cambio lo hace el servidor de una vez: o se cambian las dos cosas, o ninguna.
-- Qué se puede cambiar: copias libres de muebles comunes, poco comunes y raros. Fuera místicos, sagas, premios y mascotas.
-- Contra el abuso de la economía, sin quitar libertad de precio ni de trato:
--   · Aquí no se crea ningún ticket y una comisión del 10 % se queda en la Lonja: mover tickets entre dos cuentas cuesta.
--   · Horquilla por rareza: el mínimo nunca baja de lo que da reciclar y el máximo de lo común nunca pasa de la tienda.
--   · Lo que te llega por la Lonja no se puede volver a ofrecer ni usar para pagar en 3 días: nada de revender al momento.
--   · Las mismas dos personas solo hacen un cambio por semana, en cualquier sentido: una cuenta no alimenta a otra.
--   · Un mueble solo se cambia por otro de su rareza o de la de al lado: un raro no se regala por un común.
--   · Cobrar: hasta 100 tickets por semana. Comprar: hasta 3 cambios al día. Las cuentas de menos de 3 días solo miran.
-- La pesada de Remedios: tres encargos al día, cada uno más difícil. De unas cajas, una pesa distinto y hay que encontrarla con
-- la balanza: 6 cajas, 9 cajas y 8 en las que no se sabe si pesa de más o de menos. La caja la guarda el servidor. Da sellos, que
-- nunca son tickets ni muebles: solo toldos, una venta sin comisión y un hueco más en el puesto. Fallar acaba el día y no quita nada.
-- Tablas sin acceso directo: todo pasa por funciones. La aplica Francisco en el SQL Editor. Probada con PGlite (lonja.rls.test.js).
create table if not exists public.piso_lonja_ofertas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  da            text not null references public.piso_catalogo (id),
  busca_mueble  text references public.piso_catalogo (id),
  busca_tickets smallint check (busca_tickets between 1 and 60),
  busca_rareza  text check (busca_rareza in ('comun', 'poco-comun', 'raro')),
  estado        text not null default 'abierta' check (estado in ('abierta', 'hecha', 'retirada')),
  comprador     uuid references auth.users (id) on delete set null,
  pagado        text references public.piso_catalogo (id),
  neto          smallint,
  creada        timestamptz not null default now(),
  cerrada       timestamptz,
  check (num_nonnulls(busca_mueble, busca_tickets, busca_rareza) = 1)
);
create index if not exists piso_lonja_abiertas on public.piso_lonja_ofertas (creada desc) where estado = 'abierta';
create index if not exists piso_lonja_mias on public.piso_lonja_ofertas (user_id, estado);
create index if not exists piso_lonja_compras on public.piso_lonja_ofertas (comprador, cerrada) where estado = 'hecha';
alter table public.piso_lonja_ofertas enable row level security;
revoke all on public.piso_lonja_ofertas from public, anon, authenticated;

create table if not exists public.piso_lonja_cuenta (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  sellos       integer not null default 0 check (sellos >= 0),
  toldo        text,
  toldos       text[] not null default '{}',
  sin_comision smallint not null default 0 check (sin_comision between 0 and 2),
  hueco_hasta  timestamptz
);
alter table public.piso_lonja_cuenta enable row level security;
revoke all on public.piso_lonja_cuenta from public, anon, authenticated;

create table if not exists public.piso_lonja_juego (
  user_id  uuid not null references auth.users (id) on delete cascade,
  dia      date not null,
  ronda    smallint not null default 1 check (ronda between 1 and 3),
  caja     smallint not null check (caja between 1 and 9),
  pesa_mas boolean not null,
  pesadas  jsonb not null default '[]'::jsonb,
  encargos jsonb not null default '[]'::jsonb,
  sellos   smallint not null default 0,
  acabada  boolean not null default false,
  primary key (user_id, dia)
);
alter table public.piso_lonja_juego enable row level security;
revoke all on public.piso_lonja_juego from public, anon, authenticated;

-- Las mascotas son muebles raros, pero no entran en el mercado (la prueba comprueba que están todas las del catálogo)
create or replace function public.piso_lonja_mascotas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['perrito'];
$$;
revoke all on function public.piso_lonja_mascotas() from public, anon, authenticated;

-- Los tres encargos de la pesada: cuántas cajas lleva cada uno y en cuántas pesadas se puede resolver siempre
create or replace function public.piso_lonja_cajas(ronda integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (array[6, 9, 8])[ronda];
$$;
revoke all on function public.piso_lonja_cajas(integer) from public, anon, authenticated;

create or replace function public.piso_lonja_par(ronda integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (array[2, 2, 3])[ronda];
$$;
revoke all on function public.piso_lonja_par(integer) from public, anon, authenticated;

-- La rareza del mueble si se puede cambiar en la Lonja; si no, nada
create or replace function public.piso_lonja_rareza(cual text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select k.rareza from public.piso_catalogo k
    where k.id = cual and k.saga is null and k.rareza in ('comun', 'poco-comun', 'raro') and k.id <> all (public.piso_lonja_mascotas());
$$;
revoke all on function public.piso_lonja_rareza(text) from public, anon, authenticated;

-- 1, 2 o 3: un mueble solo se cambia por otro de su nivel o del de al lado
create or replace function public.piso_lonja_nivel(rareza text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case rareza when 'comun' then 1 when 'poco-comun' then 2 when 'raro' then 3 end;
$$;
revoke all on function public.piso_lonja_nivel(text) from public, anon, authenticated;

-- Copias de un mueble que han llegado por la Lonja hace menos de 3 días
create or replace function public.piso_lonja_recientes(uid uuid, cual text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.piso_lonja_ofertas o
    where o.estado = 'hecha' and o.cerrada > now() - interval '3 days'
      and ((o.comprador = uid and o.da = cual) or (o.user_id = uid and o.pagado = cual));
$$;
revoke all on function public.piso_lonja_recientes(uuid, text) from public, anon, authenticated;

-- Copias que se pueden usar en la Lonja: sin colocar y sin estar recién llegadas
create or replace function public.piso_lonja_libres(uid uuid, cual text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select v.copias from public.piso_inventario v where v.user_id = uid and v.mueble = cual), 0)
    - (select count(*)::integer
         from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
         where p.user_id = uid and e ->> 'id' = cual)
    - public.piso_lonja_recientes(uid, cual);
$$;
revoke all on function public.piso_lonja_libres(uuid, text) from public, anon, authenticated;

create or replace function public.piso_lonja_novata(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.created_at > now() - interval '3 days' from public.profiles p where p.user_id = uid), true);
$$;
revoke all on function public.piso_lonja_novata(uuid) from public, anon, authenticated;

-- Lo cobrado en los últimos 7 días, ya sin la comisión
create or replace function public.piso_lonja_cobrado(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(o.neto), 0)::integer from public.piso_lonja_ofertas o
    where o.user_id = uid and o.estado = 'hecha' and o.cerrada > now() - interval '7 days';
$$;
revoke all on function public.piso_lonja_cobrado(uuid) from public, anon, authenticated;

-- ¿Estas dos personas han hecho ya un cambio esta semana, en cualquier sentido?
create or replace function public.piso_lonja_pareja(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.piso_lonja_ofertas o
    where o.estado = 'hecha' and o.cerrada > now() - interval '7 days'
      and ((o.user_id = a and o.comprador = b) or (o.user_id = b and o.comprador = a)));
$$;
revoke all on function public.piso_lonja_pareja(uuid, uuid) from public, anon, authenticated;

create or replace function public.piso_lonja()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hechos integer;
  c public.piso_lonja_cuenta;
  j public.piso_lonja_juego;
  vencida record;
begin
  -- Lo tuyo que ha caducado vuelve a tu inventario
  for vencida in
    update public.piso_lonja_ofertas o set estado = 'retirada', cerrada = now()
      where o.user_id = me and o.estado = 'abierta' and o.creada <= now() - interval '7 days'
      returning o.da
  loop
    perform public.piso_sumar(me, vencida.da, 1);
  end loop;
  insert into public.piso_lonja_cuenta (user_id) values (me) on conflict (user_id) do nothing;
  select * into c from public.piso_lonja_cuenta x where x.user_id = me;
  insert into public.piso_lonja_juego (user_id, dia, caja, pesa_mas)
    values (me, current_date, (1 + floor(random() * public.piso_lonja_cajas(1)))::smallint, random() < 0.5)
    on conflict (user_id, dia) do nothing;
  select * into j from public.piso_lonja_juego x where x.user_id = me and x.dia = current_date;
  select count(*)::integer into hechos from public.piso_lonja_ofertas o
    where o.comprador = me and o.estado = 'hecha' and o.cerrada > now() - interval '1 day';
  return jsonb_build_object(
    'personaje', (select s.personaje from public.pisos s where s.user_id = me),
    'tickets', coalesce((select a.tickets from public.piso_cuentas a where a.user_id = me), 0),
    'cambios', jsonb_build_object('hechos', hechos, 'tope', 3),
    'topeOfertas', case when c.hueco_hasta > now() then 4 else 3 end,
    'horquilla', jsonb_build_object('comun', jsonb_build_array(5, 20), 'poco-comun', jsonb_build_array(10, 40), 'raro', jsonb_build_array(20, 60)),
    'cobro', jsonb_build_object('hecho', public.piso_lonja_cobrado(me), 'tope', 100),
    'nueva', public.piso_lonja_novata(me),
    'sellos', c.sellos,
    'toldo', c.toldo,
    'toldos', to_jsonb(c.toldos),
    'sinComision', c.sin_comision,
    'huecoHasta', c.hueco_hasta,
    -- La caja nunca sale de aquí hasta resolver el encargo; en el tercero, tampoco si pesa de más o de menos
    'juego', jsonb_build_object('ronda', j.ronda, 'cajas', public.piso_lonja_cajas(j.ronda), 'par', public.piso_lonja_par(j.ronda), 'tope', public.piso_lonja_par(j.ronda) + 1,
                                'pesaMas', case when j.ronda < 3 then j.pesa_mas end, 'pesadas', j.pesadas, 'encargos', j.encargos, 'sellos', j.sellos, 'acabada', j.acabada),
    'libres', coalesce((
      select jsonb_object_agg(x.mueble, x.libres) from (
        select v.mueble, public.piso_lonja_libres(me, v.mueble) as libres
          from public.piso_inventario v
          where v.user_id = me and v.copias > 0 and public.piso_lonja_rareza(v.mueble) is not null
      ) x where x.libres > 0), '{}'::jsonb),
    'retenidas', coalesce((
      select sum(public.piso_lonja_recientes(me, v.mueble))::integer from public.piso_inventario v where v.user_id = me), 0),
    'mias', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'da', o.da, 'busca_mueble', o.busca_mueble, 'busca_tickets', o.busca_tickets, 'busca_rareza', o.busca_rareza, 'creada', o.creada) order by o.creada)
        from public.piso_lonja_ofertas o where o.user_id = me and o.estado = 'abierta'), '[]'::jsonb),
    'cerradas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'da', x.da, 'pagado', x.pagado, 'busca_tickets', x.busca_tickets, 'neto', x.neto) order by x.cerrada desc) from (
        select o.id, o.da, o.pagado, o.busca_tickets, o.neto, o.cerrada from public.piso_lonja_ofertas o
          where o.user_id = me and o.estado = 'hecha' and o.cerrada > now() - interval '3 days'
          order by o.cerrada desc limit 5
      ) x), '[]'::jsonb),
    'puestos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'dueno', x.dueno, 'alias', x.alias, 'personaje', x.personaje, 'toldo', x.toldo, 'da', x.da, 'busca_mueble', x.busca_mueble,
                                          'busca_tickets', x.busca_tickets, 'busca_rareza', x.busca_rareza, 'pareja', public.piso_lonja_pareja(me, x.dueno)) order by x.creada desc) from (
        select o.id, o.user_id as dueno, p.alias, s.personaje, k.toldo, o.da, o.busca_mueble, o.busca_tickets, o.busca_rareza, o.creada
          from public.piso_lonja_ofertas o
          left join public.profiles p on p.user_id = o.user_id
          left join public.pisos s on s.user_id = o.user_id
          left join public.piso_lonja_cuenta k on k.user_id = o.user_id
          where o.estado = 'abierta' and o.creada > now() - interval '7 days' and o.user_id <> me
            and public.community_member(o.user_id) and not public.is_blocked_pair(o.user_id)
          order by o.creada desc limit 30
      ) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.piso_lonja() from public, anon;
grant execute on function public.piso_lonja() to authenticated;

create or replace function public.piso_lonja_poner(doy text, pido text default null, precio integer default null, clase text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  suya text := public.piso_lonja_rareza(doy);
  minimo integer;
  maximo integer;
  hueco timestamptz;
begin
  if public.piso_lonja_novata(me) then
    raise exception 'Las cuentas recién llegadas solo miran: podrás poner puesto a los tres días.' using errcode = 'P0001';
  end if;
  if suya is null then
    raise exception 'Ese mueble no se puede cambiar: solo hasta «raro», sin sagas ni mascotas.' using errcode = 'P0001';
  end if;
  if num_nonnulls(pido, precio, clase) <> 1 then
    raise exception 'Di qué buscas: otro mueble, una rareza o unos tickets.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  select k.hueco_hasta into hueco from public.piso_lonja_cuenta k where k.user_id = me;
  if (select count(*) from public.piso_lonja_ofertas o where o.user_id = me and o.estado = 'abierta') >= (case when hueco > now() then 4 else 3 end) then
    raise exception 'Tu puesto está lleno: retira una oferta antes.' using errcode = 'P0001';
  end if;
  if pido is not null then
    if public.piso_lonja_rareza(pido) is null or pido = doy then
      raise exception 'Ese mueble no se puede pedir en la Lonja.' using errcode = 'P0001';
    end if;
    if abs(public.piso_lonja_nivel(suya) - public.piso_lonja_nivel(public.piso_lonja_rareza(pido))) > 1 then
      raise exception 'Un mueble solo se cambia por otro de su rareza o de la de al lado.' using errcode = 'P0001';
    end if;
  end if;
  if clase is not null then
    if public.piso_lonja_nivel(clase) is null or abs(public.piso_lonja_nivel(suya) - public.piso_lonja_nivel(clase)) > 1 then
      raise exception 'Un mueble solo se cambia por otro de su rareza o de la de al lado.' using errcode = 'P0001';
    end if;
  end if;
  if precio is not null then
    minimo := case suya when 'comun' then 5 when 'poco-comun' then 10 else 20 end;
    maximo := case suya when 'comun' then 20 when 'poco-comun' then 40 else 60 end;
    if precio not between minimo and maximo then
      raise exception 'Ese mueble se cambia por entre % y % tickets.', minimo, maximo using errcode = 'P0001';
    end if;
    if public.piso_lonja_cobrado(me) >= 100 then
      raise exception 'Esta semana ya has cobrado el tope: de momento, ofrécelo por otro mueble.' using errcode = 'P0001';
    end if;
  end if;
  if public.piso_lonja_libres(me, doy) < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de ofrecerlo.' using errcode = 'P0001';
  end if;
  perform public.piso_sumar(me, doy, -1);
  insert into public.piso_lonja_ofertas (user_id, da, busca_mueble, busca_tickets, busca_rareza) values (me, doy, pido, precio, clase);
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_poner(text, text, integer, text) from public, anon;
grant execute on function public.piso_lonja_poner(text, text, integer, text) to authenticated;

create or replace function public.piso_lonja_retirar(cual uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  devuelto text;
begin
  update public.piso_lonja_ofertas o set estado = 'retirada', cerrada = now()
    where o.id = cual and o.user_id = me and o.estado = 'abierta'
    returning o.da into devuelto;
  if devuelto is not null then
    perform public.piso_sumar(me, devuelto, 1);
  end if;
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_retirar(uuid) from public, anon;
grant execute on function public.piso_lonja_retirar(uuid) to authenticated;

create or replace function public.piso_lonja_aceptar(cual uuid, pago text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  o public.piso_lonja_ofertas;
  mueble_pagado text;
  neto_venta integer;
begin
  if public.piso_lonja_novata(me) then
    raise exception 'Las cuentas recién llegadas solo miran: podrás cambiar a los tres días.' using errcode = 'P0001';
  end if;
  select * into o from public.piso_lonja_ofertas x where x.id = cual for update;
  if o.id is null or o.estado <> 'abierta' or o.creada <= now() - interval '7 days' or o.user_id = me
     or not public.community_member(o.user_id) or public.is_blocked_pair(o.user_id) then
    raise exception 'Esa oferta ya no está.' using errcode = 'P0001';
  end if;
  -- Siempre en el mismo orden: dos cambios cruzados no se esperan el uno al otro
  perform public.piso_inventario_asegurar(o.user_id);
  perform 1 from public.piso_cuentas c where c.user_id in (me, o.user_id) order by c.user_id for update;
  if (select count(*) from public.piso_lonja_ofertas x where x.comprador = me and x.estado = 'hecha' and x.cerrada > now() - interval '1 day') >= 3 then
    raise exception 'Por hoy ya has hecho tres cambios: vuelve mañana.' using errcode = 'P0001';
  end if;
  if public.piso_lonja_pareja(me, o.user_id) then
    raise exception 'Ya os habéis cambiado algo esta semana: entre las mismas dos personas, un cambio por semana.' using errcode = 'P0001';
  end if;
  if o.busca_tickets is not null then
    if (select c.tickets from public.piso_cuentas c where c.user_id = me) < o.busca_tickets then
      raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
    end if;
    insert into public.piso_lonja_cuenta (user_id) values (o.user_id) on conflict (user_id) do nothing;
    neto_venta := o.busca_tickets - ceil(o.busca_tickets * 0.1)::integer;
    if (select k.sin_comision from public.piso_lonja_cuenta k where k.user_id = o.user_id for update) > 0 then
      neto_venta := o.busca_tickets;
    end if;
    if public.piso_lonja_cobrado(o.user_id) + neto_venta > 100 then
      raise exception 'Ese puesto ya ha cobrado su tope de esta semana.' using errcode = 'P0001';
    end if;
    if neto_venta = o.busca_tickets then
      update public.piso_lonja_cuenta k set sin_comision = k.sin_comision - 1 where k.user_id = o.user_id;
    end if;
    update public.piso_cuentas c set tickets = c.tickets - o.busca_tickets where c.user_id = me;
    update public.piso_cuentas c set tickets = c.tickets + neto_venta where c.user_id = o.user_id;
  else
    mueble_pagado := coalesce(o.busca_mueble, pago);
    if o.busca_rareza is not null and public.piso_lonja_rareza(pago) is distinct from o.busca_rareza then
      raise exception 'Elige con qué mueble pagas: tiene que ser de esa rareza.' using errcode = 'P0001';
    end if;
    if public.piso_lonja_libres(me, mueble_pagado) < 1 then
      raise exception 'No tienes una copia libre de ese mueble.' using errcode = 'P0001';
    end if;
    perform public.piso_sumar(me, mueble_pagado, -1);
    perform public.piso_sumar(o.user_id, mueble_pagado, 1);
  end if;
  perform public.piso_sumar(me, o.da, 1);
  update public.piso_lonja_ofertas x set estado = 'hecha', comprador = me, pagado = mueble_pagado, neto = neto_venta, cerrada = now() where x.id = o.id;
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_aceptar(uuid, text) from public, anon;
grant execute on function public.piso_lonja_aceptar(uuid, text) to authenticated;

-- La pesada: el resultado dice qué platillo baja, y la caja no sale del servidor hasta que señalas
create or replace function public.piso_lonja_pesar(izq integer[], der integer[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  j public.piso_lonja_juego;
  total integer;
  en_izq boolean;
  en_der boolean;
  baja text;
begin
  perform public.piso_lonja();
  select * into j from public.piso_lonja_juego x where x.user_id = me and x.dia = current_date for update;
  total := public.piso_lonja_cajas(j.ronda);
  if j.acabada then
    raise exception 'Por hoy ya has hecho tus encargos: mañana, otros.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(j.pesadas) > public.piso_lonja_par(j.ronda) then
    raise exception 'Ya no quedan pesadas: señala una caja.' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(izq), 0) < 1 or cardinality(izq) <> coalesce(cardinality(der), 0)
     or (select count(distinct v) from unnest(izq || der) v where v between 1 and total) <> cardinality(izq) * 2 then
    raise exception 'Pon el mismo número de cajas en cada platillo.' using errcode = 'P0001';
  end if;
  en_izq := j.caja = any (izq);
  en_der := j.caja = any (der);
  baja := case when not en_izq and not en_der then 'igual'
               when en_izq = j.pesa_mas then 'izq'
               else 'der' end;
  update public.piso_lonja_juego x
    set pesadas = x.pesadas || jsonb_build_array(jsonb_build_object('izq', to_jsonb(izq), 'der', to_jsonb(der), 'baja', baja))
    where x.user_id = me and x.dia = current_date;
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_pesar(integer[], integer[]) from public, anon;
grant execute on function public.piso_lonja_pesar(integer[], integer[]) to authenticated;

create or replace function public.piso_lonja_senalar(cual integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  j public.piso_lonja_juego;
  n integer;
  ganados integer;
  fin boolean;
begin
  perform public.piso_lonja();
  select * into j from public.piso_lonja_juego x where x.user_id = me and x.dia = current_date for update;
  n := jsonb_array_length(j.pesadas);
  if j.acabada then
    raise exception 'Por hoy ya has hecho tus encargos: mañana, otros.' using errcode = 'P0001';
  end if;
  if n < 1 then
    raise exception 'Pesa al menos una vez antes de señalar.' using errcode = 'P0001';
  end if;
  if cual not between 1 and public.piso_lonja_cajas(j.ronda) then
    raise exception 'Esa caja no está en la mesa.' using errcode = 'P0001';
  end if;
  -- Cada encargo vale su número si lo resuelves en las pesadas justas; con una de más, uno menos (al menos uno)
  ganados := case when cual <> j.caja then 0 when n <= public.piso_lonja_par(j.ronda) then j.ronda else greatest(j.ronda - 1, 1) end;
  fin := cual <> j.caja or j.ronda = 3;
  -- Fallar acaba el día y no quita nada: lo ya sellado se queda, y quien no había ganado nada se lleva uno por jugar
  if fin and j.sellos + ganados = 0 then
    ganados := 1;
  end if;
  update public.piso_lonja_juego x
    set encargos = x.encargos || jsonb_build_array(jsonb_build_object('ronda', j.ronda, 'cajas', public.piso_lonja_cajas(j.ronda), 'caja', j.caja, 'pesaMas', j.pesa_mas,
                                                                      'senalada', cual, 'sellos', ganados, 'pesadas', j.pesadas)),
        sellos = x.sellos + ganados,
        acabada = fin,
        ronda = case when fin then x.ronda else x.ronda + 1 end,
        caja = case when fin then x.caja else (1 + floor(random() * public.piso_lonja_cajas(j.ronda + 1)))::smallint end,
        pesa_mas = case when fin then x.pesa_mas else random() < 0.5 end,
        pesadas = case when fin then x.pesadas else '[]'::jsonb end
    where x.user_id = me and x.dia = current_date;
  update public.piso_lonja_cuenta k set sellos = k.sellos + ganados where k.user_id = me;
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_senalar(integer) from public, anon;
grant execute on function public.piso_lonja_senalar(integer) to authenticated;

-- El canje de sellos: nada que valga tickets. `que`: 'toldo:<id>', 'sin-comision' o 'hueco'
create or replace function public.piso_lonja_canjear(que text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  c public.piso_lonja_cuenta;
  precio integer;
  nuevo text;
begin
  perform public.piso_lonja();
  select * into c from public.piso_lonja_cuenta k where k.user_id = me for update;
  if que like 'toldo:%' then
    nuevo := substr(que, 7);
    if nuevo <> all (array['noche', 'menta', 'coral', 'ciruela']) then
      raise exception 'Ese toldo no existe.' using errcode = 'P0001';
    end if;
    if nuevo = any (c.toldos) then
      raise exception 'Ese toldo ya es tuyo.' using errcode = 'P0001';
    end if;
    precio := 18;
  elsif que = 'sin-comision' then
    if c.sin_comision >= 2 then
      raise exception 'Ya tienes dos ventas sin comisión guardadas.' using errcode = 'P0001';
    end if;
    precio := 10;
  elsif que = 'hueco' then
    precio := 14;
  else
    raise exception 'Eso no se canjea aquí.' using errcode = 'P0001';
  end if;
  if c.sellos < precio then
    raise exception 'Te faltan sellos.' using errcode = 'P0001';
  end if;
  update public.piso_lonja_cuenta k
    set sellos = k.sellos - precio,
        toldos = case when nuevo is null then k.toldos else k.toldos || nuevo end,
        toldo = coalesce(nuevo, k.toldo),
        sin_comision = k.sin_comision + case when que = 'sin-comision' then 1 else 0 end,
        hueco_hasta = case when que = 'hueco' then greatest(coalesce(k.hueco_hasta, now()), now()) + interval '7 days' else k.hueco_hasta end
    where k.user_id = me;
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_canjear(text) from public, anon;
grant execute on function public.piso_lonja_canjear(text) to authenticated;

create or replace function public.piso_lonja_toldo(cual text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  perform public.piso_lonja();
  update public.piso_lonja_cuenta k set toldo = cual where k.user_id = me and (cual is null or cual = any (k.toldos));
  return public.piso_lonja();
end;
$$;
revoke all on function public.piso_lonja_toldo(text) from public, anon;
grant execute on function public.piso_lonja_toldo(text) to authenticated;
