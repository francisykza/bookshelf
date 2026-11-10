-- 2.ª ampliación del Almacén del Puerto, bloque 3 (1.105.0, SPEC §105; decisión de Francisco del 10-11-2026): la ropa propia
-- de la planta de ropa, a la venta con tickets. La aplica Francisco en el SQL Editor, después de
-- 20261127120000_almacen_pulso_habitaciones.sql.
--
-- - Diez prendas nuevas (cuatro jerséis, tres pantalones y tres complementos), con su precio fijo en tickets
--   (`piso_almacen_ropa`, el mismo que `ROPA_TIENDA` en `src/features/edificio/actor.js`; una prueba lo comprueba).
-- - Se compran desde la cesta, todo o nada (`piso_almacen_ropa_comprar`): cada prenda una vez, solo si no la tienes, con la
--   clave de compra del cliente (un reintento no cobra dos veces; misma tabla que las compras de muebles) y el total que se
--   enseñó. Sin ofertas ni albarán: la ropa no se rebaja. Lo comprado va a `piso_prendas`, como lo ganado.
-- - El aspecto admite las prendas nuevas (`piso_personaje_valido`) y solo se lleva lo que se tiene (`pisos_personaje_prendas`).
-- - La ropa de misiones, casino y estiba sigue sin venderse.
-- - La visita con un amigo sabe en qué planta está cada uno: `piso_almacen_pulso` admite la zona 'ropa' (la planta de abajo).
-- No se borra ni se cambia ningún dato.

create or replace function public.piso_almacen_ropa()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'jersey:18', 30, 'jersey:19', 30, 'jersey:20', 26, 'jersey:21', 30,
    'pantalon:11', 22, 'pantalon:12', 20, 'pantalon:13', 20,
    'complemento:panuelo', 14, 'complemento:pompon', 16, 'complemento:bandolera', 18
  );
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
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa', 'visera', 'fedora', 'gorro-estibador', 'panuelo', 'pompon', 'bandolera')
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
    where (k = any (public.piso_prendas_orden()) or k = any (public.piso_casino_ropa()) or k = any (public.piso_estiba_ropa())
           or public.piso_almacen_ropa() ? k)
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    if falta = any (public.piso_casino_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por fichas en la caja del casino.' using errcode = 'P0001';
    end if;
    if falta = any (public.piso_estiba_ropa()) then
      raise exception 'Aún no tienes esa prenda: se cambia por sellos en la pared de la Lonja.' using errcode = 'P0001';
    end if;
    if public.piso_almacen_ropa() ? falta then
      raise exception 'Aún no tienes esa prenda: se compra con tickets en la planta de ropa del almacén.' using errcode = 'P0001';
    end if;
    raise exception 'Aún no tienes esa prenda: se gana con las misiones del día.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- `compra`: la clave de esta compra (la misma en cada reintento). `prendas`: ["jersey:18", …] (de 1 a 8, sin repetir).
-- `esperado`: el total que se le enseñó; si no cuadra, no se cobra y se avisa.
create or replace function public.piso_almacen_ropa_comprar(compra uuid, prendas jsonb, esperado integer)
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
  p jsonb;
  vistas text[] := '{}';
  total integer := 0;
  tabla jsonb := public.piso_almacen_ropa();
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
    if hecha.user_id <> me or not (hecha.articulos ? 'ropa') then
      raise exception 'almacen:clave' using errcode = 'P0001';
    end if;
    return jsonb_build_object('compra', hecha.id, 'repetida', true, 'total', hecha.total, 'ropa', hecha.articulos -> 'ropa',
      'prendas', coalesce((select jsonb_agg(x.prenda order by x.ganada, x.prenda) from public.piso_prendas x where x.user_id = me), '[]'::jsonb));
  end if;
  if prendas is null or jsonb_typeof(prendas) <> 'array' or jsonb_array_length(prendas) = 0 or jsonb_array_length(prendas) > 8 then
    raise exception 'almacen:vacio' using errcode = 'P0001';
  end if;
  for p in select * from jsonb_array_elements(prendas) loop
    if jsonb_typeof(p) <> 'string' or (p #>> '{}') = any (vistas) then
      raise exception 'almacen:linea' using errcode = 'P0001';
    end if;
    vistas := vistas || (p #>> '{}');
    if not (tabla ? (p #>> '{}')) then
      raise exception 'almacen:no_se_vende' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.piso_prendas x where x.user_id = me and x.prenda = (p #>> '{}')) then
      raise exception 'almacen:ya_tuya' using errcode = 'P0001';
    end if;
    total := total + (tabla ->> (p #>> '{}'))::integer;
  end loop;
  if esperado is distinct from total then
    raise exception 'almacen:precio' using errcode = 'P0001';
  end if;
  if saldo < total then
    raise exception 'almacen:saldo' using errcode = 'P0001';
  end if;
  update public.piso_cuentas set tickets = tickets - total where user_id = me;
  insert into public.piso_prendas (user_id, prenda) select me, x from unnest(vistas) x;
  insert into public.piso_almacen_compras (id, user_id, articulos, subtotal, pct, descuento, total)
    values (compra, me, jsonb_build_object('ropa', to_jsonb(vistas)), total, 0, 0, total);
  return jsonb_build_object('compra', compra, 'repetida', false, 'total', total, 'ropa', to_jsonb(vistas),
    'prendas', coalesce((select jsonb_agg(x.prenda order by x.ganada, x.prenda) from public.piso_prendas x where x.user_id = me), '[]'::jsonb));
end;
$$;
revoke all on function public.piso_almacen_ropa_comprar(uuid, jsonb, integer) from public, anon;
grant execute on function public.piso_almacen_ropa_comprar(uuid, jsonb, integer) to authenticated;

-- La visita con un amigo: lo mismo que en 20261127120000_almacen_pulso_habitaciones.sql, y la zona 'ropa' (la planta de abajo)
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
    least(29.5, greatest(0, coalesce(piso_almacen_pulso.x, 15.5))),
    least(26, greatest(0, coalesce(piso_almacen_pulso.y, 23.6))),
    coalesce(piso_almacen_pulso.yaw, 3.5)::numeric % 7,
    case when zona in ('pasillos', 'caja', 'mercadillo', 'ropa') then zona else 'pasillos' end,
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
