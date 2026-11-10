-- Ofertas del Almacén del Puerto (1.100, SPEC §100; decisión de Francisco del 9-11-2026, CLAUDE.md «La Lonja»).
-- La aplica Francisco en el SQL Editor, después de 20261124120000_hotel_almacen.sql. Sin ella, el almacén vende sin ofertas.
--
-- Reglas:
-- - Cada día (de Madrid), 4 muebles al azar con −20 %; cada semana (de lunes a domingo), 1 mueble con −50 %. El mueble de
--   la semana no sale además como oferta del día. Las elige el servidor, igual para todos, entre lo que el almacén vende
--   (`piso_catalogo` sin sagas, con precio y no retirado): el orden lo da un hash del día o de la semana, sin tablas ni tareas.
-- - Solo en el almacén: la tienda y el resto de precios y recompensas no cambian.
-- - El precio de oferta de una unidad es el de siempre menos el porcentaje, redondeando el descuento a la baja. El descuento
--   del albarán se aplica después al total, como antes: como mucho −50 % y luego −10 %, un 55 % (por debajo del 60 % acordado).
-- - Cambiar de día (o de semana) entre ver el precio y pagar hace que el total no cuadre: no se cobra y se avisa (como hasta ahora).
-- No se borra ni se cambia ningún dato.

-- Las ofertas de un día: [{ id, pct, tipo: 'semana' | 'dia' }], la de la semana primero
create or replace function public.piso_almacen_ofertas_de(dia date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  return (
  with venta as (
    select c.id from public.piso_catalogo c
     where c.saga is null and public.piso_precio(c.rareza) is not null and not public.piso_retirado(c.id)
  ),
  de_la_semana as (
    select v.id from venta v
     order by md5('almacen:semana:' || (date_trunc('week', dia::timestamp))::date::text || ':' || v.id), v.id
     limit 1
  ),
  del_dia as (
    select v.id from venta v
     where v.id not in (select s.id from de_la_semana s)
     order by md5('almacen:dia:' || dia::text || ':' || v.id), v.id
     limit 4
  )
  select coalesce(jsonb_agg(o.x order by o.orden, o.x ->> 'id'), '[]'::jsonb)
    from (
      select 0 as orden, jsonb_build_object('id', s.id, 'pct', 50, 'tipo', 'semana') as x from de_la_semana s
      union all
      select 1, jsonb_build_object('id', d.id, 'pct', 20, 'tipo', 'dia') from del_dia d
    ) o
  );
end;
$$;
revoke all on function public.piso_almacen_ofertas_de(date) from public, anon, authenticated;

-- Las de hoy
create or replace function public.piso_almacen_ofertas()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  return public.piso_almacen_ofertas_de(public.piso_almacen_hoy());
end;
$$;
revoke all on function public.piso_almacen_ofertas() from public, anon, authenticated;

-- Lo que se ahorró con las ofertas en cada compra (para el recibo y para repetir una compra igual)
alter table public.piso_almacen_compras add column if not exists ahorro integer not null default 0;

-- ── El estado de la caja, ahora con las ofertas y cuándo cambian ──
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
    'semana_hasta', (extract(epoch from (((date_trunc('week', hoy::timestamp))::date + 7)::timestamp at time zone 'Europe/Madrid')) * 1000)::bigint,
    'ofertas', public.piso_almacen_ofertas(),
    'tickets', (select c.tickets from public.piso_cuentas c where c.user_id = me),
    'descuento', case when d.user_id is null then jsonb_build_object('estado', 'libre') else public.piso_almacen_descuento(d) end
  );
end;
$$;
revoke all on function public.piso_almacen_estado() from public, anon;
grant execute on function public.piso_almacen_estado() to authenticated;

-- ── Comprar el carrito: igual que en 20261124120000_hotel_almacen.sql, con el precio de oferta en cada línea ──
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
  base integer;
  precio integer;
  n integer;
  subtotal integer := 0;
  ahorro integer := 0;
  pct integer := 0;
  rebaja integer;
  total integer;
  d public.piso_almacen_dia;
  ids text[] := '{}';
  ofertas jsonb := public.piso_almacen_ofertas();
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
    return jsonb_build_object('compra', hecha.id, 'repetida', true, 'subtotal', hecha.subtotal, 'ahorro', hecha.ahorro, 'pct', hecha.pct,
      'descuento', hecha.descuento, 'total', hecha.total, 'articulos', hecha.articulos, 'inventario', public.piso_mi_inventario());
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
    base := case when k.id is null or k.saga is not null then null else public.piso_precio(k.rareza) end;
    if base is null then
      raise exception 'almacen:no_se_vende' using errcode = 'P0001';
    end if;
    -- La oferta de hoy (o de la semana), si la tiene: el descuento de cada unidad, redondeado a la baja
    precio := base - floor(base * coalesce((select (o ->> 'pct')::integer from jsonb_array_elements(ofertas) o where o ->> 'id' = k.id limit 1), 0) / 100.0)::integer;
    subtotal := subtotal + precio * n;
    ahorro := ahorro + (base - precio) * n;
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
  insert into public.piso_almacen_compras (id, user_id, articulos, subtotal, ahorro, pct, descuento, total)
    values (compra, me, articulos, subtotal, ahorro, pct, rebaja, total);
  return jsonb_build_object('compra', compra, 'repetida', false, 'subtotal', subtotal, 'ahorro', ahorro, 'pct', pct, 'descuento', rebaja,
    'total', total, 'articulos', articulos, 'inventario', public.piso_mi_inventario());
end;
$$;
revoke all on function public.piso_almacen_comprar(uuid, jsonb, integer, boolean) from public, anon;
grant execute on function public.piso_almacen_comprar(uuid, jsonb, integer, boolean) to authenticated;
