-- 1.86 · Acabados de los muebles (decisión de Francisco del 4-11-2026; CLAUDE.md, «Identidad de los muebles»).
-- Algunas copias salen con un acabado propio. Una copia con acabado es una de las copias de `piso_inventario`: `piso_acabados`
-- dice cuántas de esas copias lo llevan, y el resto son lisas. En un sobre se sortea primero el mueble, como siempre, y después,
-- 1 de cada 20 veces, el acabado: rarezas, pity y probabilidades de cada mueble no cambian. La tienda vende liso. No se reciclan,
-- y al regalarse o cambiarse en la Lonja conservan el acabado. Nada de lo que ya tiene cada uno cambia: todo sigue liso.
-- Nunca en místicos, mascotas, premios ni sagas: los mismos que no entran en la Lonja (`piso_lonja_rareza`).

create table if not exists public.piso_acabados (
  user_id uuid not null references auth.users (id) on delete cascade,
  mueble  text not null references public.piso_catalogo (id),
  acabado text not null check (acabado in ('salitre', 'sol-de-tarde', 'lacado', 'nacar')),
  copias  smallint not null default 0 check (copias between 0 and 99),
  primary key (user_id, mueble, acabado)
);
alter table public.piso_acabados enable row level security;
revoke all on public.piso_acabados from public, anon, authenticated;

alter table public.piso_regalos add column if not exists acabado text;
alter table public.piso_lonja_ofertas add column if not exists da_acabado text check (da_acabado in ('salitre', 'sol-de-tarde', 'lacado', 'nacar'));
-- Una copia con acabado puede pedir más que una lisa: hasta 100 tickets, el tope semanal de cobro
alter table public.piso_lonja_ofertas drop constraint if exists piso_lonja_ofertas_busca_tickets_check;
alter table public.piso_lonja_ofertas add constraint piso_lonja_ofertas_busca_tickets_check check (busca_tickets between 1 and 100);

-- Qué acabado sale, cuando sale: Salitre 45 %, Sol de tarde 30 %, Lacado 20 %, Nácar 5 % (igual en `acabados.js`)
create or replace function public.piso_acabado_tirar()
returns text
language sql
volatile
set search_path = ''
as $$
  select case when t < 0.45 then 'salitre' when t < 0.75 then 'sol-de-tarde' when t < 0.95 then 'lacado' else 'nacar' end
  from (select random() as t) x;
$$;
revoke all on function public.piso_acabado_tirar() from public, anon, authenticated;

create or replace function public.piso_acabado_sumar(uid uuid, cual text, con text, n integer)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.piso_acabados (user_id, mueble, acabado, copias) values (uid, cual, con, greatest(0, least(99, n)))
  on conflict (user_id, mueble, acabado) do update set copias = greatest(0, least(99, public.piso_acabados.copias + n));
$$;
revoke all on function public.piso_acabado_sumar(uuid, text, text, integer) from public, anon, authenticated;

-- Copias sin colocar: las lisas, o las de un acabado
create or replace function public.piso_libres(uid uuid, cual text, con text default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (case when con is null then
            coalesce((select v.copias from public.piso_inventario v where v.user_id = uid and v.mueble = cual), 0)
            - coalesce((select sum(a.copias)::integer from public.piso_acabados a where a.user_id = uid and a.mueble = cual), 0)
          else coalesce((select a.copias from public.piso_acabados a where a.user_id = uid and a.mueble = cual and a.acabado = con), 0) end)
    - (select count(*)::integer
         from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
         where p.user_id = uid and e ->> 'id' = cual and (e ->> 'acabado') is not distinct from con);
$$;
revoke all on function public.piso_libres(uuid, text, text) from public, anon, authenticated;

-- El primer mueble del piso del que no tienes copias suficientes: en total, de cada acabado o lisas
create or replace function public.piso_falta_copia(uid uuid, layout jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with puestos as (
    select e ->> 'id' as id, e ->> 'acabado' as acabado, count(*)::integer as n
    from jsonb_array_elements(case when jsonb_typeof(layout -> 'items') = 'array' then layout -> 'items' else '[]'::jsonb end) e
    group by 1, 2
  )
  select x.id from (
    select p.id
    from (select id, sum(n) as n from puestos group by id) p
    join public.piso_catalogo k on k.id = p.id and k.saga is null
    left join public.piso_inventario v on v.user_id = uid and v.mueble = p.id
    where p.n > coalesce(v.copias, 0)
    union all
    select p.id
    from puestos p
    left join public.piso_acabados a on a.user_id = uid and a.mueble = p.id and a.acabado = p.acabado
    where p.acabado is not null and p.n > coalesce(a.copias, 0)
    union all
    select p.id
    from puestos p
    join public.piso_catalogo k on k.id = p.id and k.saga is null
    left join public.piso_inventario v on v.user_id = uid and v.mueble = p.id
    where p.acabado is null
      and p.n > coalesce(v.copias, 0) - coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0)
  ) x
  order by x.id
  limit 1;
$$;
revoke all on function public.piso_falta_copia(uuid, jsonb) from public, anon, authenticated;

create or replace function public.piso_valido(layout jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  items jsonb;
  it jsonb;
  c record;
  n integer;
  i integer;
  j integer;
  w integer;
  d integer;
  x integer;
  y integer;
  rot integer;
  uids integer[] := '{}';
  capas text[] := '{}';
  paredes text[] := '{}';
  x0 integer[] := '{}';
  y0 integer[] := '{}';
  x1 integer[] := '{}';
  y1 integer[] := '{}';
  sups real[] := '{}';
  apoyado boolean;
begin
  if layout is null or jsonb_typeof(layout) <> 'object' then
    return false;
  end if;
  if exists (select 1 from jsonb_object_keys(layout) k where k not in ('v', 'pared', 'suelo', 'items')) then
    return false;
  end if;
  if not public.piso_entero(layout -> 'v') or (layout ->> 'v')::integer <> 1 then
    return false;
  end if;
  if coalesce(layout ->> 'pared', '') not in ('yeso', 'salvia', 'rosa', 'noche') or coalesce(layout ->> 'suelo', '') not in ('tablas', 'damero', 'barro') then
    return false;
  end if;
  items := layout -> 'items';
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 40 then
    return false;
  end if;
  n := jsonb_array_length(items);
  for i in 0 .. n - 1 loop
    it := items -> i;
    if jsonb_typeof(it) <> 'object' or jsonb_typeof(it -> 'id') is distinct from 'string' then
      return false;
    end if;
    if not public.piso_entero(it -> 'uid') or (it ->> 'uid')::integer < 1 or (it ->> 'uid')::integer = any (uids) then
      return false;
    end if;
    uids := uids || (it ->> 'uid')::integer;
    select * into c from public.piso_catalogo k where k.id = it ->> 'id';
    if not found then
      return false;
    end if;
    if not public.piso_entero(it -> 'tono') or (it ->> 'tono')::integer < 0 or (it ->> 'tono')::integer >= c.tonos then
      return false;
    end if;
    if c.capa = 'pared' then
      if exists (select 1 from jsonb_object_keys(it) k where k not in ('uid', 'id', 'pared', 'a', 'tono', 'acabado')) then
        return false;
      end if;
      if coalesce(it ->> 'pared', '') not in ('fondo', 'izq') or not public.piso_entero(it -> 'a') then
        return false;
      end if;
      x := (it ->> 'a')::integer;
      if x < 0 or x + c.w > 9 then
        return false;
      end if;
      capas := capas || 'pared'::text;
      paredes := paredes || (it ->> 'pared');
      x0 := x0 || x;
      x1 := x1 || (x + c.w);
      y0 := y0 || 0;
      y1 := y1 || 1;
      sups := sups || 0::real;
    else
      if exists (select 1 from jsonb_object_keys(it) k where k not in ('uid', 'id', 'x', 'y', 'rot', 'tono', 'acabado')) then
        return false;
      end if;
      if not (public.piso_entero(it -> 'x') and public.piso_entero(it -> 'y') and public.piso_entero(it -> 'rot')) then
        return false;
      end if;
      rot := (it ->> 'rot')::integer;
      if rot < 0 or rot > 3 then
        return false;
      end if;
      if rot % 2 = 1 then
        w := c.d;
        d := c.w;
      else
        w := c.w;
        d := c.d;
      end if;
      x := (it ->> 'x')::integer;
      y := (it ->> 'y')::integer;
      if x < 0 or y < 0 or x + w > 9 or y + d > 9 then
        return false;
      end if;
      capas := capas || c.capa;
      paredes := paredes || ''::text;
      x0 := x0 || x;
      x1 := x1 || (x + w);
      y0 := y0 || y;
      y1 := y1 || (y + d);
      sups := sups || coalesce(c.sup, 0)::real;
    end if;
  end loop;
  for i in 1 .. n loop
    for j in i + 1 .. n loop
      if capas[i] = capas[j] and paredes[i] = paredes[j] and x0[i] < x1[j] and x0[j] < x1[i] and y0[i] < y1[j] and y0[j] < y1[i] then
        return false;
      end if;
    end loop;
    if capas[i] = 'encima' then
      apoyado := false;
      for j in 1 .. n loop
        if capas[j] = 'suelo' and sups[j] > 0 and x0[i] >= x0[j] and x1[i] <= x1[j] and y0[i] >= y0[j] and y1[i] <= y1[j] then
          apoyado := true;
        end if;
      end loop;
      if not apoyado then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.piso_mi_inventario()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  return (
    select jsonb_build_object(
      'inicio_elegido', c.inicio_elegido,
      'tickets', c.tickets,
      'sin_raro', c.sin_raro,
      'acabados', coalesce((
        select jsonb_object_agg(x.mueble, x.tiene) from (
          select a.mueble, jsonb_object_agg(a.acabado, a.copias) as tiene
            from public.piso_acabados a where a.user_id = me and a.copias > 0 group by a.mueble
        ) x), '{}'::jsonb),
      -- Las misiones ya cobradas de las últimas semanas (para que el ordenador sepa cuáles quedan)
      'reclamadas', coalesce((select jsonb_agg(r.clave order by r.clave) from public.piso_reclamos r where r.user_id = me and r.created_at > now() - interval '21 days'), '[]'::jsonb),
      'copias', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.piso_inventario v where v.user_id = me and v.copias > 0), '{}'::jsonb)
    )
    from public.piso_cuentas c where c.user_id = me
  );
end;
$$;

create or replace function public.piso_abrir_sobre(sobre text, cuantos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  def jsonb := public.piso_sobre(sobre);
  coste integer;
  saldo integer;
  pity integer;
  premios jsonb := '[]'::jsonb;
  mejor_que_comun boolean := false;
  r text;
  tirada double precision;
  mist double precision;
  elegido text;
  tenia integer;
  acabado text;
  i integer;
begin
  if def is null then
    raise exception 'Ese sobre no está a la venta.' using errcode = 'P0001';
  end if;
  coste := case cuantos when 1 then (def ->> 'coste1')::integer when 5 then (def ->> 'coste5')::integer else null end;
  if coste is null then
    raise exception 'Los sobres son de 1 o de 5.' using errcode = 'P0001';
  end if;
  mist := coalesce((def ->> 'mistico')::double precision, 0);
  select c.tickets, c.sin_raro into saldo, pity from public.piso_cuentas c where c.user_id = me for update;
  if saldo < coste then
    raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
  end if;
  for i in 1..cuantos loop
    tirada := random();
    r := case
      when tirada < mist then (case when random() < (def ->> 'legendario')::double precision then 'legendario' else 'mistico' end)
      when tirada < mist + (def ->> 'raro')::double precision then 'raro'
      when tirada < mist + (def ->> 'raro')::double precision + (def ->> 'poco')::double precision then 'poco-comun'
      else 'comun' end;
    -- Pity: el mueble 15 seguido sin nada raro (contado entre todos los sobres) es raro seguro
    if pity >= 14 and r not in ('raro', 'mistico', 'legendario') then
      r := 'raro';
    end if;
    -- En el de 5, el último asegura algo mejor que común si aún no ha salido
    if cuantos = 5 and i = 5 and not mejor_que_comun and r = 'comun' then
      r := 'poco-comun';
    end if;
    if r <> 'comun' then
      mejor_que_comun := true;
    end if;
    pity := case when r in ('raro', 'mistico', 'legendario') then 0 else pity + 1 end;
    elegido := public.piso_al_azar(r, case when r in ('mistico', 'legendario') then null else def -> 'muebles' end);
    select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = elegido), 0) into tenia;
    perform public.piso_sumar(me, elegido, 1);
    acabado := null;
    if public.piso_lonja_rareza(elegido) is not null and random() < 0.05 then
      acabado := public.piso_acabado_tirar();
      perform public.piso_acabado_sumar(me, elegido, acabado, 1);
    end if;
    premios := premios || jsonb_build_object('mueble', elegido, 'rareza', r, 'nuevo', tenia = 0, 'acabado', acabado);
  end loop;
  update public.piso_cuentas set tickets = tickets - coste, sin_raro = pity where user_id = me;
  return jsonb_build_object('premios', premios, 'inventario', public.piso_mi_inventario());
end;
$$;

create or replace function public.piso_reciclar(mueble text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  k public.piso_catalogo;
  vale integer;
begin
  select * into k from public.piso_catalogo c where c.id = mueble;
  if k.id is null or k.saga is not null or k.rareza in ('mistico', 'legendario', 'especial') then
    raise exception 'Eso no se puede reciclar.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  if public.piso_libres(me, mueble) < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de reciclarlo. Las copias con acabado no se reciclan.' using errcode = 'P0001';
  end if;
  vale := case k.rareza when 'comun' then 3 when 'poco-comun' then 8 when 'raro' then 20 else 40 end;
  perform public.piso_sumar(me, mueble, -1);
  update public.piso_cuentas set tickets = least(100000, tickets + vale) where user_id = me;
  return public.piso_mi_inventario();
end;
$$;

drop function if exists public.piso_regalar(uuid, text);
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
revoke all on function public.piso_regalar(uuid, text, text) from public, anon;
grant execute on function public.piso_regalar(uuid, text, text) to authenticated;

create or replace function public.piso_lonja_recientes(uid uuid, cual text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.piso_lonja_ofertas o
    where o.estado = 'hecha' and o.cerrada > now() - interval '3 days'
      and ((o.comprador = uid and o.da = cual and o.da_acabado is null) or (o.user_id = uid and o.pagado = cual));
$$;

create or replace function public.piso_lonja_libres(uid uuid, cual text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.piso_libres(uid, cual) - public.piso_lonja_recientes(uid, cual);
$$;

-- Copias de un acabado que se pueden ofrecer: sin colocar y sin las recién compradas (tres días, como las lisas)
create or replace function public.piso_lonja_libres_acabado(uid uuid, cual text, con text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.piso_libres(uid, cual, con)
    - (select count(*)::integer from public.piso_lonja_ofertas o
         where o.estado = 'hecha' and o.cerrada > now() - interval '3 days' and o.comprador = uid and o.da = cual and o.da_acabado = con);
$$;
revoke all on function public.piso_lonja_libres_acabado(uuid, text, text) from public, anon, authenticated;

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

drop function if exists public.piso_lonja_poner(text, text, integer, text);
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
revoke all on function public.piso_lonja_poner(text, text, integer, text, text) from public, anon;
grant execute on function public.piso_lonja_poner(text, text, integer, text, text) to authenticated;

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
  con text;
begin
  update public.piso_lonja_ofertas o set estado = 'retirada', cerrada = now()
    where o.id = cual and o.user_id = me and o.estado = 'abierta'
    returning o.da, o.da_acabado into devuelto, con;
  if devuelto is not null then
    perform public.piso_sumar(me, devuelto, 1);
    if con is not null then
      perform public.piso_acabado_sumar(me, devuelto, con, 1);
    end if;
  end if;
  return public.piso_lonja();
end;
$$;

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
  if o.da_acabado is not null then
    perform public.piso_acabado_sumar(me, o.da, o.da_acabado, 1);
  end if;
  update public.piso_lonja_ofertas x set estado = 'hecha', comprador = me, pagado = mueble_pagado, neto = neto_venta, cerrada = now() where x.id = o.id;
  return public.piso_lonja();
end;
$$;
