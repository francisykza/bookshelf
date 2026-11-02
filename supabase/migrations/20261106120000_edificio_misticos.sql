-- Místicos, bloque 2 (docs/qa/misticos.md; decisiones de Francisco del 2-11-2026): una rareza nueva por encima de
-- «raro». Los místicos («mistico») se colocan en el piso sobre su peana y se mueven solos; los místicos legendarios
-- («legendario») no se colocan: te acompañan detrás de tu personaje, en tu piso y cuando te visitan.
--   · cinco filas nuevas en piso_catalogo (las mismas que en src/features/edificio/catalog.js; una prueba lo comprueba);
--   · pisos.companero: el legendario que te acompaña (o null). Solo uno, y solo si lo tienes;
--   · los legendarios no pueden estar en el piso, y los místicos no se reciclan ni se regalan (para que no sean moneda);
--   · el portal enseña el compañero de cada vecino.
-- Aún no salen en ningún sobre: eso es el bloque 3 (1 % en «Edición coleccionista», 1 de cada 4 legendario), con su
-- propia migración. No se venden (piso_precio no tiene precio para ellas).
-- Necesita las migraciones del edificio, el inventario, la tienda, el personaje y los vecinos. ADITIVA y
-- re-ejecutable: amplía una restricción, añade filas y una columna que puede ser nula, un trigger nuevo y redefine
-- piso_reciclar, piso_regalar y edificio_portal con una comprobación o un campo más. No borra datos ni cambia las
-- políticas. La aplica Francisco en el SQL Editor. Probada con PGlite
-- (src/features/edificio/__tests__/misticos.rls.test.js).

-- ── Catálogo: la rareza nueva y los cinco primeros ──────────────────────────────────────────────────────────────────
alter table public.piso_catalogo drop constraint if exists piso_catalogo_rareza_check;
alter table public.piso_catalogo add constraint piso_catalogo_rareza_check check (rareza in ('comun', 'poco-comun', 'raro', 'especial', 'mistico', 'legendario'));

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('farol-azul', 'suelo', 1, 1, null, 1, 'mistico'),
  ('rosa-estrellas', 'suelo', 1, 1, null, 1, 'mistico'),
  ('dragoncillo', 'suelo', 1, 1, null, 1, 'legendario'),
  ('zorro-bruma', 'suelo', 1, 1, null, 1, 'legendario'),
  ('cinta-tormenta', 'suelo', 1, 1, null, 1, 'legendario')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- ── El compañero ────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.pisos add column if not exists companero text references public.piso_catalogo (id) on delete set null;

-- Al guardar el piso: ningún legendario colocado, y el compañero tiene que ser un legendario que tienes
create or replace function public.pisos_misticos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(new.layout -> 'items') = 'array' then new.layout -> 'items' else '[]'::jsonb end) e
    join public.piso_catalogo k on k.id = e ->> 'id'
    where k.rareza = 'legendario'
  ) then
    raise exception 'Los místicos legendarios no se colocan: te acompañan.' using errcode = 'P0001';
  end if;
  if new.companero is not null and (
    not exists (select 1 from public.piso_catalogo k where k.id = new.companero and k.rareza = 'legendario')
    or coalesce((select v.copias from public.piso_inventario v where v.user_id = new.user_id and v.mueble = new.companero), 0) < 1
  ) then
    raise exception 'Aún no tienes ese místico.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pisos_misticos() from public, anon, authenticated;
drop trigger if exists pisos_misticos on public.pisos;
create trigger pisos_misticos before insert or update of layout, companero on public.pisos for each row execute function public.pisos_misticos();

-- ── Reciclar (la de la 1.67): los místicos no se reciclan ───────────────────────────────────────────────────────────
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
  tengo integer;
  puestos integer;
  vale integer;
begin
  select * into k from public.piso_catalogo c where c.id = mueble;
  if k.id is null or k.saga is not null or k.rareza in ('mistico', 'legendario') then
    raise exception 'Eso no se puede reciclar.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = piso_reciclar.mueble), 0) into tengo;
  select count(*) into puestos
    from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
    where p.user_id = me and e ->> 'id' = piso_reciclar.mueble;
  if tengo - puestos < 1 then
    raise exception 'No tienes copias libres de ese mueble: guárdalo antes de reciclarlo.' using errcode = 'P0001';
  end if;
  vale := case k.rareza when 'comun' then 3 when 'poco-comun' then 8 when 'raro' then 20 else 40 end;
  perform public.piso_sumar(me, mueble, -1);
  update public.piso_cuentas set tickets = least(100000, tickets + vale) where user_id = me;
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_reciclar(text) from public, anon;
grant execute on function public.piso_reciclar(text) to authenticated;

-- ── Regalar (la de la 1.71): los místicos no se regalan ─────────────────────────────────────────────────────────────
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
  if k.id is null or k.saga is not null or k.rareza in ('mistico', 'legendario') then
    raise exception 'Ese mueble no se puede regalar.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.piso_regalos r where r.de = me and r.creado > now() - interval '1 day') >= 5 then
    raise exception 'Ya has hecho cinco regalos hoy; mañana, más.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_cuentas c where c.user_id = me for update;
  select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = piso_regalar.mueble), 0) into tengo;
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

-- ── El portal (el de la 1.69), con el compañero de cada vecino ─────────────────────────────────────────────────────
create or replace function public.edificio_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ed uuid;
  door text;
  rows jsonb;
begin
  if me is null then
    return null;
  end if;
  select v.edificio, v.puerta into ed, door from public.edificio_vecinos v where v.user_id = me;
  if ed is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', v.user_id,
      'puerta', v.puerta,
      'alias', p.alias,
      'avatar_id', p.avatar_id,
      'yo', v.user_id = me,
      'layout', s.layout,
      'personaje', s.personaje,
      'companero', s.companero,
      'sello_dado', (select x.sello from public.piso_sellos x where x.de = me and x.para = v.user_id),
      'sello_recibido', (select x.sello from public.piso_sellos x where x.de = v.user_id and x.para = me)
    ) order by v.puerta desc), '[]'::jsonb)
    into rows
    from public.edificio_vecinos v
    left join public.profiles p on p.user_id = v.user_id
    left join public.pisos s on s.user_id = v.user_id
    where v.edificio = ed
      and (v.user_id = me or (coalesce(p.community_enabled, false) and not public.is_blocked_pair(v.user_id)));
  return jsonb_build_object('edificio', ed, 'puerta', door, 'vecinos', rows);
end;
$$;
revoke all on function public.edificio_portal() from public, anon;
grant execute on function public.edificio_portal() to authenticated;
