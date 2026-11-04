-- 1.86 · La estiba (aprobada por Francisco el 4-11-2026): sustituye a la pesada de Remedios. Cada día hay una bodega, la misma
-- para todo el mundo, partida en bultos de modo que siempre hay una carga perfecta. Se colocan en la pantalla y, al zarpar, el
-- servidor comprueba la carga y da los sellos de su nivel, una vez al día. Los sellos no caducan y nunca son tickets.
-- La pared de premios añade a lo que ya se canjeaba ropa de estibador, la gaviota (legendario que te acompaña, no sale en sobres)
-- y un acabado a elección, sobre una copia lisa tuya: sin azar y caro.
-- La pesada se cierra sin borrar nada: sus datos y los sellos ganados se quedan. 'juego' sigue saliendo en piso_lonja() para que
-- la versión anterior de la app no falle mientras se actualiza.

create table if not exists public.piso_lonja_estiba (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia     date not null,
  carga   jsonb not null,
  celdas  smallint not null,
  total   smallint not null,
  sellos  smallint not null,
  zarpo   timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.piso_lonja_estiba enable row level security;
revoke all on public.piso_lonja_estiba from public, anon, authenticated;

revoke all on function public.piso_lonja_pesar(integer[], integer[]) from public, anon, authenticated;
revoke all on function public.piso_lonja_senalar(integer) from public, anon, authenticated;

-- La gaviota, en el catálogo; como el conejo, no sale en sobres
insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('gaviota-puerto', 'suelo', 1, 1, null, 1, 'legendario')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

create or replace function public.piso_casino_exclusivos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['neon-veintiuna', 'mesa-tapete', 'gramola', 'conejo-chistera', 'gaviota-puerto'];
$$;

-- La ropa de estibador: se cambia por sellos y no entra en el orden de las misiones
create or replace function public.piso_estiba_ropa()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:gorro-estibador', 'pantalon:10', 'jersey:17'];
$$;

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
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa', 'visera', 'fedora', 'gorro-estibador')
  )
$$;

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
    where (k = any (public.piso_prendas_orden()) or k = any (public.piso_casino_ropa()) or k = any (public.piso_estiba_ropa()))
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    if falta = any (public.piso_casino_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por fichas en la caja del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_estiba_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por sellos en la pared de la Lonja.' using errcode = 'P0001';
    end if;
    raise exception 'Aún no tienes esa prenda: se gana con las misiones del día.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Los premios de la pared que se tienen una vez (los mismos que PARED en hotel/estiba.js; una prueba lo comprueba)
create or replace function public.piso_estiba_premios()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'complemento:gorro-estibador', jsonb_build_object('tipo', 'prenda', 'precio', 24),
    'pantalon:10', jsonb_build_object('tipo', 'prenda', 'precio', 28),
    'jersey:17', jsonb_build_object('tipo', 'prenda', 'precio', 36),
    'gaviota-puerto', jsonb_build_object('tipo', 'companero', 'precio', 120)
  );
$$;

-- Lo que cuesta poner cada acabado en una copia lisa: cuanto más raro en los sobres, más caro
create or replace function public.piso_estiba_acabados()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('salitre', 40, 'sol-de-tarde', 50, 'lacado', 70, 'nacar', 100);
$$;

create or replace function public.piso_estiba_sellos(celdas integer, total integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when celdas >= total then 7 when celdas * 100 >= total * 80 then 4 when celdas * 100 >= total * 50 then 2 else 1 end;
$$;

-- Un número del 0 al 9999 que solo depende del día y de n: la bodega es la misma para todo el mundo
create or replace function public.piso_estiba_azar(d date, n integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (('x' || substr(md5(d::text || ':' || n::text), 1, 6))::bit(24)::integer) % 10000;
$$;

-- Gira una pieza un cuarto de vuelta rot veces y la deja pegada a la esquina (igual que girar() en hotel/estiba.js)
create or replace function public.piso_estiba_girar(celdas jsonb, rot integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with c as (
    select (e ->> 0)::integer as x, (e ->> 1)::integer as y from jsonb_array_elements(celdas) e
  ), r as (
    select case rot when 0 then x when 1 then -y when 2 then -x else y end as a,
           case rot when 0 then y when 1 then x when 2 then -y else -x end as b
      from c
  )
  select jsonb_agg(jsonb_build_array(a - (select min(a) from r), b - (select min(b) from r)) order by b, a) from r;
$$;

-- La bodega del día: 8 × 5, sin las esquinas del casco ni el pie del palo, y lo demás partido en bultos de dos a cinco huecos
-- (alguno de seis si sobraba uno suelto). Salen barajados y girados, sin pistas de dónde iban.
create or replace function public.piso_estiba_bodega(d date)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  w constant integer := 8;
  h constant integer := 5;
  g integer[] := array_fill(0, array[40]);
  tamanos constant integer[] := array[2, 3, 3, 4, 4, 4, 5];
  palo integer := 2 + public.piso_estiba_azar(d, 0) % 4;
  n integer := 1;
  k integer := 0;
  i integer;
  c integer;
  x integer;
  tam integer;
  junta integer;
  pieza integer[];
  cand integer[];
begin
  foreach c in array array[25, 32, 33, 34, 39, 40] loop
    g[c] := -1;
  end loop;
  g[palo + 1] := -1;
  g[w + palo + 1] := -1;
  for i in 1 .. w * h loop
    continue when g[i] <> 0;
    k := k + 1;
    g[i] := k;
    pieza := array[i];
    n := n + 1;
    tam := tamanos[1 + public.piso_estiba_azar(d, n) % 7];
    while cardinality(pieza) < tam loop
      cand := '{}';
      foreach c in array pieza loop
        x := (c - 1) % w;
        if x > 0 and g[c - 1] = 0 then cand := cand || (c - 1); end if;
        if x < w - 1 and g[c + 1] = 0 then cand := cand || (c + 1); end if;
        if c > w and g[c - w] = 0 then cand := cand || (c - w); end if;
        if c + w <= w * h and g[c + w] = 0 then cand := cand || (c + w); end if;
      end loop;
      exit when cardinality(cand) = 0;
      n := n + 1;
      c := cand[1 + public.piso_estiba_azar(d, n) % cardinality(cand)];
      g[c] := k;
      pieza := pieza || c;
    end loop;
    if cardinality(pieza) = 1 then
      x := (i - 1) % w;
      junta := case
        when x > 0 and g[i - 1] > 0 then g[i - 1]
        when i > w and g[i - w] > 0 then g[i - w]
        when x < w - 1 and g[i + 1] > 0 then g[i + 1]
        when i + w <= w * h and g[i + w] > 0 then g[i + w]
      end;
      if junta is not null then
        g[i] := junta;
        k := k - 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object(
    'w', w,
    'h', h,
    'total', (select count(*)::integer from unnest(g) v where v > 0),
    'bloqueadas', (
      select jsonb_agg(jsonb_build_array((t.o - 1)::integer % w, (t.o - 1)::integer / w) order by t.o)
        from unnest(g) with ordinality t(v, o) where t.v < 0),
    'piezas', (
      select jsonb_agg(jsonb_build_object('id', p.v, 'celdas', public.piso_estiba_girar(p.celdas, public.piso_estiba_azar(d, 1000 + p.v) % 4))
                       order by md5(d::text || '/' || p.v::text))
        from (
          select t.v, jsonb_agg(jsonb_build_array((t.o - 1)::integer % w, (t.o - 1)::integer / w)) as celdas
            from unnest(g) with ordinality t(v, o) where t.v > 0 group by t.v
        ) p)
  );
end;
$$;

create or replace function public.piso_estiba_pared(uid uuid)
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
        else exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = a.key and v.copias > 0) end
    ) order by (a.value ->> 'precio')::integer), '[]'::jsonb)
  from jsonb_each(public.piso_estiba_premios()) a;
$$;

-- Lo que ve quien juega hoy
create or replace function public.piso_estiba(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.piso_estiba_bodega(current_date) || jsonb_build_object(
    'dia', current_date,
    'niveles', jsonb_build_array(
      jsonb_build_object('id', 'media', 'nombre', 'Media bodega', 'desde', 50, 'sellos', 2),
      jsonb_build_object('id', 'llena', 'nombre', 'Bodega llena', 'desde', 80, 'sellos', 4),
      jsonb_build_object('id', 'perfecta', 'nombre', 'Carga perfecta', 'desde', 100, 'sellos', 7)),
    'hecha', (
      select jsonb_build_object('carga', e.carga, 'celdas', e.celdas, 'total', e.total, 'sellos', e.sellos)
        from public.piso_lonja_estiba e where e.user_id = uid and e.dia = current_date),
    'pared', public.piso_estiba_pared(uid),
    'acabados', public.piso_estiba_acabados()
  );
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

-- Zarpar: comprueba la carga bulto a bulto y da los sellos, una vez al día. Lo que no cabe no se arregla: se rechaza
create or replace function public.piso_estiba_zarpar(carga jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hoy date := current_date;
  b jsonb := public.piso_estiba_bodega(current_date);
  w integer := (b ->> 'w')::integer;
  h integer := (b ->> 'h')::integer;
  total integer := (b ->> 'total')::integer;
  bulto jsonb;
  celda jsonb;
  forma jsonb;
  usadas integer[] := '{}';
  ocupadas text[] := '{}';
  id integer;
  bx integer;
  by_ integer;
  rot integer;
  cx integer;
  cy integer;
  puestas integer := 0;
  gana integer;
begin
  perform public.piso_lonja();
  if exists (select 1 from public.piso_lonja_estiba e where e.user_id = me and e.dia = hoy) then
    raise exception 'Tu barco ya ha zarpado hoy. Mañana hay otra bodega.' using errcode = 'P0001';
  end if;
  if carga is null or jsonb_typeof(carga) <> 'array' or jsonb_array_length(carga) = 0 or jsonb_array_length(carga) > jsonb_array_length(b -> 'piezas') then
    raise exception 'Esa carga no vale.' using errcode = 'P0001';
  end if;
  for bulto in select * from jsonb_array_elements(carga) loop
    if jsonb_typeof(bulto) <> 'object'
      or coalesce(bulto ->> 'pieza', '') !~ '^[0-9]{1,3}$' or coalesce(bulto ->> 'x', '') !~ '^-?[0-9]{1,2}$'
      or coalesce(bulto ->> 'y', '') !~ '^-?[0-9]{1,2}$' or coalesce(bulto ->> 'rot', '') !~ '^[0-3]$' then
      raise exception 'Esa carga no vale.' using errcode = 'P0001';
    end if;
    id := (bulto ->> 'pieza')::integer;
    bx := (bulto ->> 'x')::integer;
    by_ := (bulto ->> 'y')::integer;
    rot := (bulto ->> 'rot')::integer;
    select p -> 'celdas' into forma from jsonb_array_elements(b -> 'piezas') p where (p ->> 'id')::integer = id;
    if forma is null or id = any (usadas) then
      raise exception 'Ese bulto no es de esta bodega.' using errcode = 'P0001';
    end if;
    usadas := usadas || id;
    for celda in select * from jsonb_array_elements(public.piso_estiba_girar(forma, rot)) loop
      cx := bx + (celda ->> 0)::integer;
      cy := by_ + (celda ->> 1)::integer;
      if cx < 0 or cy < 0 or cx >= w or cy >= h or exists (select 1 from jsonb_array_elements(b -> 'bloqueadas') e where (e ->> 0)::integer = cx and (e ->> 1)::integer = cy) then
        raise exception 'Hay un bulto fuera de la bodega.' using errcode = 'P0001';
      end if;
      if (cx || ':' || cy) = any (ocupadas) then
        raise exception 'Hay dos bultos en el mismo sitio.' using errcode = 'P0001';
      end if;
      ocupadas := ocupadas || (cx || ':' || cy);
      puestas := puestas + 1;
    end loop;
  end loop;
  gana := public.piso_estiba_sellos(puestas, total);
  insert into public.piso_lonja_estiba (user_id, dia, carga, celdas, total, sellos)
    values (me, hoy, carga, puestas, total, gana)
    on conflict (user_id, dia) do nothing;
  if not found then
    raise exception 'Tu barco ya ha zarpado hoy. Mañana hay otra bodega.' using errcode = 'P0001';
  end if;
  update public.piso_lonja_cuenta k set sellos = k.sellos + gana where k.user_id = me;
  return public.piso_lonja();
end;
$$;

-- El canje, con la pared entera. 'acabado:<acabado>:<mueble>' pone el acabado en una copia lisa que puedas vender: la que acaba
-- de llegar no vale, igual que en los puestos, para que no sirva de atajo
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
  premio jsonb := public.piso_estiba_premios() -> que;
  precio integer;
  nuevo text;
  acabado text;
  mueble text;
begin
  perform public.piso_lonja();
  select * into c from public.piso_lonja_cuenta k where k.user_id = me for update;
  if premio is not null then
    if (select (x ->> 'tienes')::boolean from jsonb_array_elements(public.piso_estiba_pared(me)) x where x ->> 'id' = que) then
      raise exception 'Eso ya lo tienes.' using errcode = 'P0001';
    end if;
    precio := (premio ->> 'precio')::integer;
  elsif que like 'acabado:%' then
    acabado := split_part(que, ':', 2);
    mueble := split_part(que, ':', 3);
    precio := (public.piso_estiba_acabados() ->> acabado)::integer;
    if precio is null then
      raise exception 'Ese acabado no existe.' using errcode = 'P0001';
    end if;
    if public.piso_lonja_rareza(mueble) is null then
      raise exception 'Ese mueble no admite acabado.' using errcode = 'P0001';
    end if;
    if public.piso_lonja_libres(me, mueble) < 1 then
      raise exception 'Necesitas una copia lisa guardada de ese mueble, sin colocar ni recién llegada.' using errcode = 'P0001';
    end if;
  elsif que like 'toldo:%' then
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
  if premio ->> 'tipo' = 'prenda' then
    insert into public.piso_prendas (user_id, prenda) values (me, que) on conflict do nothing;
  elsif premio ->> 'tipo' = 'companero' then
    perform public.piso_sumar(me, que, 1);
  elsif acabado is not null then
    perform public.piso_acabado_sumar(me, mueble, acabado, 1);
  end if;
  return public.piso_lonja();
end;
$$;

revoke all on function public.piso_estiba_ropa() from public, anon, authenticated;
revoke all on function public.piso_estiba_premios() from public, anon, authenticated;
revoke all on function public.piso_estiba_acabados() from public, anon, authenticated;
revoke all on function public.piso_estiba_sellos(integer, integer) from public, anon, authenticated;
revoke all on function public.piso_estiba_azar(date, integer) from public, anon, authenticated;
revoke all on function public.piso_estiba_girar(jsonb, integer) from public, anon, authenticated;
revoke all on function public.piso_estiba_bodega(date) from public, anon, authenticated;
revoke all on function public.piso_estiba_pared(uuid) from public, anon, authenticated;
revoke all on function public.piso_estiba(uuid) from public, anon, authenticated;
revoke all on function public.piso_estiba_zarpar(jsonb) from public, anon;
grant execute on function public.piso_estiba_zarpar(jsonb) to authenticated;
