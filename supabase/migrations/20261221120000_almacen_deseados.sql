-- Los muebles que sigues en el Almacén del Puerto (1.135, SPEC §135; encargo de Francisco del 15-11-2026, plan en
-- docs/qa/almacen-ordenador.md, «Sí, las recomendadas»). La aplica Francisco en el SQL Editor, después de
-- 20261129120000_almacen_especiales.sql. Sin ella, el ordenador del piso enseña las ofertas y lo nuevo, pero no deja seguir.
--
-- Reglas:
-- - Una lista propia y privada de cada cuenta, aparte de «Se busca» (que es pública): nadie más la ve ni la toca. Sin
--   permisos directos sobre la tabla: solo las dos funciones de abajo.
-- - Solo se sigue lo que el almacén vende con ofertas: del catálogo, sin saga, con precio, no retirado y no de una habitación
--   especial (esos nunca se rebajan). Dejar de seguir se puede siempre, aunque el mueble ya no se venda.
-- - Como mucho 40 a la vez (cabe todo el almacén; el tope es solo para que no se abuse).
-- - No cambia precios, ofertas, tickets ni compras. No se borra ni se cambia ningún dato.

create table if not exists public.piso_almacen_deseados (
  user_id uuid not null references auth.users (id) on delete cascade,
  mueble text not null,
  creado timestamptz not null default now(),
  primary key (user_id, mueble)
);
alter table public.piso_almacen_deseados enable row level security;
revoke all on table public.piso_almacen_deseados from anon, authenticated;

-- Lo que sigue una cuenta, del más antiguo al más reciente
create or replace function public.piso_almacen_deseados_de(me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.mueble order by x.creado, x.mueble), '[]'::jsonb)
    from public.piso_almacen_deseados x
   where x.user_id = me;
$$;
revoke all on function public.piso_almacen_deseados_de(uuid) from public, anon, authenticated;

-- Seguir (quiere = true) o dejar de seguir (false) un mueble. Devuelve la lista entera.
-- Errores: 'almacen:deseo' (no se puede seguir) y 'almacen:deseos' (ya sigues 40).
create or replace function public.piso_almacen_desear(mueble text, quiere boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if mueble is null or quiere is null then
    raise exception 'almacen:deseo' using errcode = 'P0001';
  end if;
  if not quiere then
    delete from public.piso_almacen_deseados x where x.user_id = me and x.mueble = piso_almacen_desear.mueble;
    return public.piso_almacen_deseados_de(me);
  end if;
  if exists (select 1 from public.piso_almacen_deseados x where x.user_id = me and x.mueble = piso_almacen_desear.mueble) then
    return public.piso_almacen_deseados_de(me);
  end if;
  if not exists (
    select 1 from public.piso_catalogo c
     where c.id = piso_almacen_desear.mueble and c.saga is null and public.piso_precio(c.rareza) is not null
       and not public.piso_retirado(c.id) and not public.piso_de_habitacion_especial(c.id)
  ) then
    raise exception 'almacen:deseo' using errcode = 'P0001';
  end if;
  -- El tope, contado con la fila de la cuenta bloqueada: dos toques a la vez no pasan de 40
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  if (select count(*) from public.piso_almacen_deseados x where x.user_id = me) >= 40 then
    raise exception 'almacen:deseos' using errcode = 'P0001';
  end if;
  insert into public.piso_almacen_deseados (user_id, mueble) values (me, piso_almacen_desear.mueble)
    on conflict on constraint piso_almacen_deseados_pkey do nothing;
  return public.piso_almacen_deseados_de(me);
end;
$$;
revoke all on function public.piso_almacen_desear(text, boolean) from public, anon;
grant execute on function public.piso_almacen_desear(text, boolean) to authenticated;

-- ── El estado de la caja (20261125120000_almacen_ofertas.sql), ahora también con lo que sigues ──
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
    'descuento', case when d.user_id is null then jsonb_build_object('estado', 'libre') else public.piso_almacen_descuento(d) end,
    'deseados', public.piso_almacen_deseados_de(me)
  );
end;
$$;
revoke all on function public.piso_almacen_estado() from public, anon;
grant execute on function public.piso_almacen_estado() to authenticated;
