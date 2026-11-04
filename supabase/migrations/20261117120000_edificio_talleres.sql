-- 1.86 · Colecciones de taller y tablón «Se busca» (aprobados por Francisco el 4-11-2026). Cada mueble de la tienda es de un taller
-- con nombre: tener una copia de todo lo de un taller da su placa para la pared y 30 sellos, una sola vez, aunque luego se venda
-- algo. Los sellos nunca son tickets. En el tablón cada cual marca hasta tres muebles que busca, sin texto libre: los vecinos ven
-- qué se busca y quién, y si lo tienen pueden ofrecerlo en su puesto. Una marca caduca a los 30 días.

create table if not exists public.piso_taller_placas (
  user_id uuid not null references auth.users (id) on delete cascade,
  taller  text not null,
  creada  timestamptz not null default now(),
  primary key (user_id, taller)
);
alter table public.piso_taller_placas enable row level security;
revoke all on public.piso_taller_placas from public, anon, authenticated;

create table if not exists public.piso_lonja_buscados (
  user_id uuid not null references auth.users (id) on delete cascade,
  mueble  text not null references public.piso_catalogo (id) on delete cascade,
  creado  timestamptz not null default now(),
  primary key (user_id, mueble)
);
create index if not exists piso_lonja_buscados_mueble on public.piso_lonja_buscados (mueble);
alter table public.piso_lonja_buscados enable row level security;
revoke all on public.piso_lonja_buscados from public, anon, authenticated;

-- Las placas, en el catálogo: premios, como la de la suite (no se venden, no salen en sobres, no se regalan ni se reciclan)
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('placa-ebanisteria', 'pared', 1, null, null, 1, 'especial'),
  ('placa-tapiceria', 'pared', 1, null, null, 1, 'especial'),
  ('placa-faro', 'pared', 1, null, null, 1, 'especial'),
  ('placa-vivero', 'pared', 1, null, null, 1, 'especial'),
  ('placa-almoneda', 'pared', 1, null, null, 1, 'especial'),
  ('placa-menaje', 'pared', 1, null, null, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Los talleres (los mismos que TALLERES en talleres.js; una prueba lo comprueba)
create or replace function public.piso_talleres()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'ebanisteria', 'muebles', jsonb_build_array('silla', 'mesa', 'mesa-baja', 'mesilla', 'comoda', 'baul', 'escritorio', 'estanteria', 'piano')),
    jsonb_build_object('id', 'tapiceria', 'muebles', jsonb_build_array('sillon', 'banco', 'puf', 'sofa', 'mecedora', 'cama', 'alfombra', 'alfombra-redonda', 'alfombra-rayas', 'cesto-mantas')),
    jsonb_build_object('id', 'faro', 'muebles', jsonb_build_array('lampara-pie', 'lampara-mesa', 'velas', 'estufa', 'farol', 'chimenea', 'guirnalda')),
    jsonb_build_object('id', 'vivero', 'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'cactus', 'monstera', 'jarron', 'pecera', 'gato')),
    jsonb_build_object('id', 'almoneda', 'muebles', jsonb_build_array('globo', 'telescopio', 'mapa', 'reloj', 'radio', 'tocadiscos', 'tapiz')),
    jsonb_build_object('id', 'menaje', 'muebles', jsonb_build_array('libros', 'tetera', 'taza', 'perchero', 'ventana', 'cuadro', 'estante-pared', 'espejo'))
  );
$$;

-- Lo que le falta a cada cual de cada taller, y si ya recogió la placa
create or replace function public.piso_talleres_de(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object(
      'id', t ->> 'id',
      'recogido', exists (select 1 from public.piso_taller_placas p where p.user_id = uid and p.taller = t ->> 'id'),
      'faltan', coalesce((
        select jsonb_agg(m.mueble) from jsonb_array_elements_text(t -> 'muebles') m(mueble)
          where not exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = m.mueble and v.copias > 0)), '[]'::jsonb)
    ))
  from jsonb_array_elements(public.piso_talleres()) t;
$$;

-- Lo que buscan los demás: hasta doce muebles, primero los más buscados, con hasta tres nombres cada uno y si tienes copia que ofrecer
create or replace function public.piso_lonja_tablon(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('mueble', x.mueble, 'cuantos', x.cuantos, 'quienes', x.quienes, 'tienes', public.piso_lonja_libres(uid, x.mueble) > 0)
                            order by x.cuantos desc, x.mueble), '[]'::jsonb)
  from (
    select b.mueble, count(*)::integer as cuantos, (array_agg(p.alias order by b.creado desc))[1:3] as quienes
      from public.piso_lonja_buscados b
      join public.profiles p on p.user_id = b.user_id
      where b.user_id <> uid and b.creado > now() - interval '30 days'
        and public.community_member(b.user_id) and not public.is_blocked_pair(b.user_id)
      group by b.mueble
      order by count(*) desc, b.mueble
      limit 12
  ) x;
$$;

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
      returning o.da, o.da_acabado
  loop
    perform public.piso_sumar(me, vencida.da, 1);
    if vencida.da_acabado is not null then
      perform public.piso_acabado_sumar(me, vencida.da, vencida.da_acabado, 1);
    end if;
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
    'horquillaAcabado', jsonb_build_object('comun', jsonb_build_array(5, 40), 'poco-comun', jsonb_build_array(10, 70), 'raro', jsonb_build_array(20, 100)),
    'cobro', jsonb_build_object('hecho', public.piso_lonja_cobrado(me), 'tope', 100),
    'nueva', public.piso_lonja_novata(me),
    'sellos', c.sellos,
    'toldo', c.toldo,
    'toldos', to_jsonb(c.toldos),
    'sinComision', c.sin_comision,
    'huecoHasta', c.hueco_hasta,
    'estiba', public.piso_estiba(me),
    'talleres', public.piso_talleres_de(me),
    'buscas', coalesce((
      select jsonb_agg(b.mueble order by b.creado) from public.piso_lonja_buscados b
        where b.user_id = me and b.creado > now() - interval '30 days'), '[]'::jsonb),
    'tablon', public.piso_lonja_tablon(me),
    -- La caja nunca sale de aquí hasta resolver el encargo; en el tercero, tampoco si pesa de más o de menos
    'juego', jsonb_build_object('ronda', j.ronda, 'cajas', public.piso_lonja_cajas(j.ronda), 'par', public.piso_lonja_par(j.ronda), 'tope', public.piso_lonja_par(j.ronda) + 1,
                                'pesaMas', case when j.ronda < 3 then j.pesa_mas end, 'pesadas', j.pesadas, 'encargos', j.encargos, 'sellos', j.sellos, 'acabada', j.acabada),
    'libres', coalesce((
      select jsonb_object_agg(x.mueble, x.libres) from (
        select v.mueble, public.piso_lonja_libres(me, v.mueble) as libres
          from public.piso_inventario v
          where v.user_id = me and v.copias > 0 and public.piso_lonja_rareza(v.mueble) is not null
      ) x where x.libres > 0), '{}'::jsonb),
    'libresAcabado', coalesce((
      select jsonb_agg(jsonb_build_object('mueble', x.mueble, 'acabado', x.acabado, 'libres', x.libres) order by x.mueble, x.acabado) from (
        select a.mueble, a.acabado, public.piso_lonja_libres_acabado(me, a.mueble, a.acabado) as libres
          from public.piso_acabados a
          where a.user_id = me and a.copias > 0 and public.piso_lonja_rareza(a.mueble) is not null
      ) x where x.libres > 0), '[]'::jsonb),
    'retenidas', coalesce((
      select sum(public.piso_lonja_recientes(me, v.mueble))::integer from public.piso_inventario v where v.user_id = me), 0),
    'mias', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'da', o.da, 'acabado', o.da_acabado, 'busca_mueble', o.busca_mueble, 'busca_tickets', o.busca_tickets, 'busca_rareza', o.busca_rareza, 'creada', o.creada) order by o.creada)
        from public.piso_lonja_ofertas o where o.user_id = me and o.estado = 'abierta'), '[]'::jsonb),
    'cerradas', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'da', x.da, 'acabado', x.da_acabado, 'pagado', x.pagado, 'busca_tickets', x.busca_tickets, 'neto', x.neto) order by x.cerrada desc) from (
        select o.id, o.da, o.da_acabado, o.pagado, o.busca_tickets, o.neto, o.cerrada from public.piso_lonja_ofertas o
          where o.user_id = me and o.estado = 'hecha' and o.cerrada > now() - interval '3 days'
          order by o.cerrada desc limit 5
      ) x), '[]'::jsonb),
    'puestos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'dueno', x.dueno, 'alias', x.alias, 'personaje', x.personaje, 'toldo', x.toldo, 'da', x.da, 'acabado', x.da_acabado, 'busca_mueble', x.busca_mueble,
                                          'busca_tickets', x.busca_tickets, 'busca_rareza', x.busca_rareza, 'pareja', public.piso_lonja_pareja(me, x.dueno)) order by x.creada desc) from (
        select o.id, o.user_id as dueno, p.alias, s.personaje, k.toldo, o.da, o.da_acabado, o.busca_mueble, o.busca_tickets, o.busca_rareza, o.creada
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

create or replace function public.piso_lonja_buscar(cual text, quiere boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if public.piso_lonja_rareza(cual) is null then
    raise exception 'Ese mueble no se busca aquí.' using errcode = 'P0001';
  end if;
  delete from public.piso_lonja_buscados b where b.user_id = me and b.creado <= now() - interval '30 days';
  if quiere then
    if (select count(*) from public.piso_lonja_buscados b where b.user_id = me and b.mueble <> cual) >= 3 then
      raise exception 'Puedes buscar hasta tres muebles a la vez.' using errcode = 'P0001';
    end if;
    insert into public.piso_lonja_buscados (user_id, mueble) values (me, cual)
      on conflict (user_id, mueble) do update set creado = now();
  else
    delete from public.piso_lonja_buscados b where b.user_id = me and b.mueble = cual;
  end if;
  return public.piso_lonja();
end;
$$;

create or replace function public.piso_taller_recoger(cual text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  t jsonb;
begin
  perform public.piso_lonja();
  select x into t from jsonb_array_elements(public.piso_talleres_de(me)) x where x ->> 'id' = cual;
  if t is null then
    raise exception 'Ese taller no existe.' using errcode = 'P0001';
  end if;
  if (t ->> 'recogido')::boolean then
    raise exception 'Esa placa ya es tuya.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(t -> 'faltan') > 0 then
    raise exception 'Aún te faltan muebles de ese taller.' using errcode = 'P0001';
  end if;
  insert into public.piso_taller_placas (user_id, taller) values (me, cual) on conflict (user_id, taller) do nothing;
  if not found then
    raise exception 'Esa placa ya es tuya.' using errcode = 'P0001';
  end if;
  perform public.piso_sumar(me, 'placa-' || cual, 1);
  update public.piso_lonja_cuenta k set sellos = k.sellos + 30 where k.user_id = me;
  return public.piso_lonja();
end;
$$;

revoke all on function public.piso_talleres() from public, anon, authenticated;
revoke all on function public.piso_talleres_de(uuid) from public, anon, authenticated;
revoke all on function public.piso_lonja_tablon(uuid) from public, anon, authenticated;
revoke all on function public.piso_lonja_buscar(text, boolean) from public, anon;
revoke all on function public.piso_taller_recoger(text) from public, anon;
grant execute on function public.piso_lonja_buscar(text, boolean) to authenticated;
grant execute on function public.piso_taller_recoger(text) to authenticated;
