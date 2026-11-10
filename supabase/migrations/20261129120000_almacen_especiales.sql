-- Los muebles de las habitaciones especiales del Almacén del Puerto (1.106, SPEC §106; decisión de Francisco del 10-11-2026,
-- CLAUDE.md «La Lonja», segunda ampliación). La aplica Francisco en el SQL Editor, después de 20261128120000_almacen_ropa.sql.
--
-- - Los muebles de una habitación especial (hoy solo «Capa y Antifaz», el taller `heroes`) cuestan el doble de su rareza:
--   común 40 y poco común 80, en el almacén y en la tienda del bajo.
-- - Nunca se rebajan: no entran en las ofertas del día ni de la semana, y el descuento del albarán no les toca (se aplica
--   solo al resto del carrito).
-- Sin ella, el cliente enseña el precio doble y el servidor cobra el de siempre: la compra no cuadra («almacen:precio») y no
-- se cobra nada. No se borra ni se cambia ningún dato: solo funciones.

-- ¿Es de una habitación especial? Los mismos que `HABITACIONES_ESPECIALES` en economy.js (una prueba lo comprueba)
create or replace function public.piso_de_habitacion_especial(mueble text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(mueble = any (array(
    select jsonb_array_elements_text(t -> 'muebles')
      from jsonb_array_elements(public.piso_talleres()) t
     where t ->> 'id' in ('heroes')
  )), false);
$$;
revoke all on function public.piso_de_habitacion_especial(text) from public, anon;
grant execute on function public.piso_de_habitacion_especial(text) to authenticated;

-- El precio de siempre de un mueble (sin ofertas ni albarán): el de su rareza, el doble si es de una habitación especial.
-- Nulo si no se vende (sagas, raros, místicos, premios, lo que no existe). Lo retirado se comprueba aparte, como antes.
create or replace function public.piso_precio_mueble(mueble text)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when c.id is null or c.saga is not null then null
    else public.piso_precio(c.rareza) * (case when public.piso_de_habitacion_especial(c.id) then 2 else 1 end)
  end
  from (select 1) uno
  left join public.piso_catalogo c on c.id = mueble;
$$;
revoke all on function public.piso_precio_mueble(text) from public, anon;
grant execute on function public.piso_precio_mueble(text) to authenticated;

-- La tienda del bajo: el mismo precio que el almacén
create or replace function public.piso_comprar(mueble text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  precio integer;
  saldo integer;
begin
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(mueble) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
  precio := public.piso_precio_mueble(mueble);
  if precio is null then
    raise exception 'Eso no se vende en la tienda.' using errcode = 'P0001';
  end if;
  select c.tickets into saldo from public.piso_cuentas c where c.user_id = me for update;
  if saldo < precio then
    raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
  end if;
  update public.piso_cuentas set tickets = tickets - precio where user_id = me;
  perform public.piso_sumar(me, mueble, 1);
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_comprar(text) from public, anon;
grant execute on function public.piso_comprar(text) to authenticated;

-- Las ofertas: igual que antes, pero sin los muebles de las habitaciones especiales
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
       and not public.piso_de_habitacion_especial(c.id)
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

-- La compra del carrito: los especiales, a su precio doble, sin oferta (aunque llegara una) y fuera del albarán
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
  rebajable integer := 0;
  ahorro integer := 0;
  pct integer := 0;
  rebaja integer;
  total integer;
  especial boolean;
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
    base := public.piso_precio_mueble(linea ->> 'id');
    if base is null then
      raise exception 'almacen:no_se_vende' using errcode = 'P0001';
    end if;
    especial := public.piso_de_habitacion_especial(k.id);
    if especial then
      precio := base;
    else
      -- La oferta de hoy (o de la semana), si la tiene: el descuento de cada unidad, redondeado a la baja
      precio := base - floor(base * coalesce((select (o ->> 'pct')::integer from jsonb_array_elements(ofertas) o where o ->> 'id' = k.id limit 1), 0) / 100.0)::integer;
      rebajable := rebajable + precio * n;
    end if;
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
  -- El albarán, solo sobre lo que se puede rebajar
  rebaja := floor(rebajable * pct / 100.0)::integer;
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
