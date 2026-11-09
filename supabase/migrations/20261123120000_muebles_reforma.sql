-- Reestructuración de muebles (Francisco, 9-11-2026, «que cada mueble se sienta bien»; CLAUDE.md). Fuera las sagas y los
-- muebles hechos de cajas que no están a la altura de los de la casa: se retiran sin borrar nada (quien los tiene los
-- conserva y vuelven cuando se rehagan). Decisión de Francisco: los sobres, «cerrados por reforma» mientras tanto.
--  · piso_retirados(): la misma lista que RETIRADOS en src/features/edificio/retirados.js (una prueba lo comprueba).
--  · piso_abrir_sobre: cerrado (también el sobre de la caja del casino, que lo usa). Para reabrir, volver a crear la
--    función de 20261115120000_edificio_acabados.sql.
--  · piso_comprar, piso_casino_canjear, piso_casino_lata_canjear, piso_regalar y piso_lonja_poner: copia literal de
--    su última versión con una comprobación al empezar: un mueble retirado no se da (no se vería en ningún piso).
-- No se borra ni se cambia ningún dato: inventarios, pisos, puestos y talleres quedan igual.

create or replace function public.piso_retirados()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['alfombra', 'alfombra-rayas', 'alfombra-redonda', 'arco-rosas', 'atril', 'banco', 'baraja-naipes', 'barra-posada', 'barril', 'baul', 'brasero', 'buho-estrellas', 'cactus', 'cama', 'cesto-mantas', 'chimenea', 'comoda', 'cuadro-tormenta', 'dagas-pared', 'esferas', 'espada-pared', 'estufa', 'farol', 'farol-azul', 'farol-bruma', 'gato', 'globo', 'gramola', 'huevo-dragon', 'jarron', 'lampara-gemas', 'lampara-mesa', 'laud', 'libros', 'mascara', 'mecedora', 'mesa-tapete', 'mesilla', 'monedas', 'monstera', 'pecera', 'perchero', 'perrito', 'piano', 'planta-grande', 'planta-pequena', 'puf', 'radio', 'rosa-estrellas', 'rosal', 'silla', 'silla-montar', 'sofa', 'taburete-barra', 'tarro-garbanzos', 'taza', 'telescopio', 'tetera', 'tocadiscos', 'velas', 'ventana-ceniza', 'ventana-estrellas', 'viales'];
$$;

create or replace function public.piso_retirado(mueble text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select mueble = any (public.piso_retirados());
$$;
revoke all on function public.piso_retirados() from public, anon, authenticated;
revoke all on function public.piso_retirado(text) from public, anon, authenticated;

-- Los sobres, cerrados por reforma
create or replace function public.piso_abrir_sobre(sobre text, cuantos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  raise exception 'Los sobres están cerrados por reforma.' using errcode = 'P0001';
end;
$$;

create or replace function public.piso_comprar(mueble text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  k public.piso_catalogo;
  precio integer;
  saldo integer;
begin
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(mueble) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
  select * into k from public.piso_catalogo c where c.id = mueble;
  precio := case when k.id is null or k.saga is not null then null else public.piso_precio(k.rareza) end;
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
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(articulo) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
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
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(articulo) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
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

create or replace function public.piso_regalar(para uuid, mueble text, acabado text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  k public.piso_catalogo;
  tengo integer;
begin
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(mueble) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
  if not public.piso_vecino_visible(para) then
    raise exception 'Solo se puede regalar a un vecino de tu edificio.' using errcode = 'P0001';
  end if;
  select * into k from public.piso_catalogo c where c.id = mueble;
  if k.id is null or k.saga is not null or k.rareza not in ('comun', 'poco-comun', 'raro') then
    raise exception 'Ese mueble no se puede regalar: solo hasta «raro».' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  if exists (select 1 from public.piso_regalos r where r.de = me and r.creado > now() - interval '1 day') then
    raise exception 'Ya has hecho tu regalo de hoy; mañana, otro.' using errcode = 'P0001';
  end if;
  select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = piso_regalar.mueble), 0) into tengo;
  if tengo < 2 then
    raise exception 'Solo se regala un mueble del que tengas más de uno.' using errcode = 'P0001';
  end if;
  if public.piso_libres(me, mueble, acabado) < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de regalarlo.' using errcode = 'P0001';
  end if;
  perform public.piso_inventario_asegurar(para);
  perform public.piso_sumar(me, mueble, -1);
  perform public.piso_sumar(para, mueble, 1);
  if acabado is not null then
    perform public.piso_acabado_sumar(me, mueble, acabado, -1);
    perform public.piso_acabado_sumar(para, mueble, acabado, 1);
  end if;
  insert into public.piso_regalos (de, para, mueble, acabado) values (me, para, mueble, acabado);
  return public.piso_mi_inventario();
end;
$$;

create or replace function public.piso_lonja_poner(doy text, pido text default null, precio integer default null, clase text default null, acabado text default null)
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
  -- Reestructuración de muebles: lo retirado no se compra, no se cambia ni se regala hasta que se rehaga
  if public.piso_retirado(doy) then
    raise exception 'Ese mueble está en reforma.' using errcode = 'P0001';
  end if;
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
    maximo := case when acabado is not null then (case suya when 'comun' then 40 when 'poco-comun' then 70 else 100 end)
      else (case suya when 'comun' then 20 when 'poco-comun' then 40 else 60 end) end;
    if precio not between minimo and maximo then
      raise exception 'Ese mueble se cambia por entre % y % tickets.', minimo, maximo using errcode = 'P0001';
    end if;
    if public.piso_lonja_cobrado(me) >= 100 then
      raise exception 'Esta semana ya has cobrado el tope: de momento, ofrécelo por otro mueble.' using errcode = 'P0001';
    end if;
  end if;
  if (case when acabado is null then public.piso_lonja_libres(me, doy) else public.piso_lonja_libres_acabado(me, doy, acabado) end) < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de ofrecerlo.' using errcode = 'P0001';
  end if;
  perform public.piso_sumar(me, doy, -1);
  if acabado is not null then
    perform public.piso_acabado_sumar(me, doy, acabado, -1);
  end if;
  insert into public.piso_lonja_ofertas (user_id, da, da_acabado, busca_mueble, busca_tickets, busca_rareza) values (me, doy, acabado, pido, precio, clase);
  return public.piso_lonja();
end;
$$;
