-- 1.78 · Regalos entre vecinos más escasos (encargo de Francisco del 3-11-2026): uno al día, solo hasta «raro» y solo
-- si tienes más de una copia de ese mueble (y alguna sin colocar). Rehace `piso_regalar`; lo demás, igual que en
-- 20261106120000_edificio_misticos.sql. Ya no se dejan sellos desde la app, pero sus datos no se borran.
create or replace function public.piso_regalar(para uuid, mueble text)
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
  puestos integer;
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
  select count(*) into puestos
    from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
    where p.user_id = me and e ->> 'id' = piso_regalar.mueble;
  if tengo - puestos < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de regalarlo.' using errcode = 'P0001';
  end if;
  perform public.piso_inventario_asegurar(para);
  perform public.piso_sumar(me, mueble, -1);
  perform public.piso_sumar(para, mueble, 1);
  insert into public.piso_regalos (de, para, mueble) values (me, para, mueble);
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_regalar(uuid, text) from public, anon;
grant execute on function public.piso_regalar(uuid, text) to authenticated;
