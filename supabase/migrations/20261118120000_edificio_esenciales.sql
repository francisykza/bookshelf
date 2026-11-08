-- 1.89 (SPEC §89): los esenciales básicos sin compra y lo retirado aparcado.
-- Aditiva: solo amplía lo que se acepta. No toca precios, sobres, inventario ni pisos guardados.
--  · piso_falta_copia: sillón, estantería y escritorio lisos se pueden colocar siempre al menos una vez.
--  · piso_valido: admite la clave opcional `ocultos`, lista de objetos retirados que han perdido su sitio.

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
    where p.n > case when p.id in ('sillon', 'estanteria', 'escritorio') then greatest(coalesce(v.copias, 0), coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0) + 1) else coalesce(v.copias, 0) end
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
      and p.n > case when p.id in ('sillon', 'estanteria', 'escritorio') then greatest(coalesce(v.copias, 0) - coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0), 1) else coalesce(v.copias, 0) - coalesce((select sum(a.copias) from public.piso_acabados a where a.user_id = uid and a.mueble = p.id), 0) end
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
  if exists (select 1 from jsonb_object_keys(layout) k where k not in ('v', 'pared', 'suelo', 'items', 'ocultos')) then
    return false;
  end if;
  -- 1.89: lo retirado que ya no cabe en su sitio se aparca aquí, sin dibujarse ni ocupar sitio; volverá a pasar por todas las
  -- comprobaciones (también la de copias) cuando regrese a items
  if layout ? 'ocultos' then
    if jsonb_typeof(layout -> 'ocultos') <> 'array' or jsonb_array_length(layout -> 'ocultos') > 40 then
      return false;
    end if;
    for it in select e from jsonb_array_elements(layout -> 'ocultos') e loop
      if jsonb_typeof(it) <> 'object' or jsonb_typeof(it -> 'id') is distinct from 'string' or not public.piso_entero(it -> 'uid') or (it ->> 'uid')::integer < 1 then
        return false;
      end if;
      if exists (select 1 from jsonb_object_keys(it) k where k not in ('uid', 'id', 'x', 'y', 'rot', 'pared', 'a', 'tono', 'acabado')) then
        return false;
      end if;
      if not exists (select 1 from public.piso_catalogo k where k.id = it ->> 'id') then
        return false;
      end if;
    end loop;
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
