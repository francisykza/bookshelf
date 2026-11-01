-- 1.67 (SPEC §67): tickets, la tienda del bajo y sus sobres (fases 2 y 4 de docs/qa/economia-muebles.md; decisión de
-- Francisco del 1-11-2026: sobres por tipos y temporadas, de 1 y de 5, y las figuras se ocultan en la app). Migración ADITIVA y re-ejecutable:
-- añade columnas a piso_cuentas, una tabla de reclamos y varias funciones, y reparte rarezas en el catálogo. No borra
-- datos. La aplica Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/tienda.rls.test.js).
--
-- Reglas (las mismas que src/features/edificio/economy.js; una prueba comprueba que coinciden):
-- - Los tickets solo se ganan leyendo (misiones semanales) y nunca se compran con dinero. 30 de bienvenida.
-- - Misión cumplida: 12 tickets, una vez por misión y semana. La app calcula si está cumplida (como siempre); el
--   servidor solo acepta misiones conocidas, de esta semana o la anterior, y una vez: como mucho 60 tickets a la semana.
-- - Tienda: comunes a 20, poco comunes a 40. Lo raro solo sale en sobres. Los de sagas no se venden (fase 5).
-- - Sobres de la temporada 1 (piso_sobre): «Sala de estar», «Luces del puerto» y «Balcón y detalles» a 10 (de 1) y 45
--   (de 5), con raro 6 % y poco común 24 % por mueble; «Edición coleccionista» a 25 y 110, con raro 15 % y poco común
--   35 %, y de todo el catálogo. En el de 5, al menos un poco común. Pity: el mueble 15 seguido sin nada raro es raro.
--   Sorteo en el servidor, nunca en la app.
-- - Reciclar una copia que no está colocada: común 3, poco común 8, raro 20.

-- ── Rarezas del catálogo (lo especial, con animación, llega en la fase 3) ──────────────────────────────────────
update public.piso_catalogo set rareza = 'poco-comun' where id in ('sofa', 'cama', 'estufa', 'radio', 'reloj', 'guirnalda');
update public.piso_catalogo set rareza = 'raro' where id in ('gato');

-- ── Saldo y pity ──────────────────────────────────────────────────────────────────────────────────────────────
alter table public.piso_cuentas add column if not exists tickets integer not null default 30;
alter table public.piso_cuentas drop constraint if exists piso_cuentas_tickets_check;
alter table public.piso_cuentas add constraint piso_cuentas_tickets_check check (tickets between 0 and 100000);
alter table public.piso_cuentas add column if not exists sin_raro smallint not null default 0;

-- Reclamos de tickets: una fila por misión y semana (la clave impide cobrar dos veces)
create table if not exists public.piso_reclamos (
  user_id    uuid not null references auth.users (id) on delete cascade,
  clave      text not null check (clave ~ '^mision:[a-z]{2,20}:[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  tickets    smallint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, clave)
);
alter table public.piso_reclamos enable row level security;
revoke all on public.piso_reclamos from anon, authenticated;

-- Quién soy y que tenga la comunidad activada (como el resto del edificio); asegura el inventario
create or replace function public.piso_yo()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Inicia sesión para tener muebles.';
  end if;
  if not public.community_member(me) then
    raise exception 'Activa la comunidad para tener piso en el edificio.' using errcode = 'P0001';
  end if;
  perform public.piso_inventario_asegurar(me);
  return me;
end;
$$;
revoke all on function public.piso_yo() from public, anon, authenticated;

-- Mi inventario (1.66) con el saldo y el pity
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
      -- Las misiones ya cobradas de las últimas semanas (para que el ordenador sepa cuáles quedan)
      'reclamadas', coalesce((select jsonb_agg(r.clave order by r.clave) from public.piso_reclamos r where r.user_id = me and r.created_at > now() - interval '21 days'), '[]'::jsonb),
      'copias', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.piso_inventario v where v.user_id = me and v.copias > 0), '{}'::jsonb)
    )
    from public.piso_cuentas c where c.user_id = me
  );
end;
$$;
revoke all on function public.piso_mi_inventario() from public, anon;
grant execute on function public.piso_mi_inventario() to authenticated;

-- Una copia más (o menos) de un mueble
create or replace function public.piso_sumar(uid uuid, mueble text, n integer)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.piso_inventario (user_id, mueble, copias) values (uid, mueble, greatest(0, least(99, n)))
  on conflict (user_id, mueble) do update set copias = greatest(0, least(99, public.piso_inventario.copias + n));
$$;
revoke all on function public.piso_sumar(uuid, text, integer) from public, anon, authenticated;

-- Misión cumplida: 12 tickets, una vez por misión y semana (`semana`: el lunes, AAAA-MM-DD, de esta o la anterior)
create or replace function public.piso_reclamar_mision(mision text, semana date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  clave text;
begin
  if mision not in ('pages', 'quotes', 'pomodoro', 'finish', 'review') then
    raise exception 'Esa misión no existe.' using errcode = 'P0001';
  end if;
  -- Un lunes de esta semana o de la anterior (con un día de margen por las zonas horarias)
  if extract(isodow from semana) <> 1 or semana > current_date + 1 or semana < current_date - 14 then
    raise exception 'Esa semana ya no se puede reclamar.' using errcode = 'P0001';
  end if;
  clave := 'mision:' || mision || ':' || to_char(semana, 'YYYY-MM-DD');
  insert into public.piso_reclamos (user_id, clave, tickets) values (me, clave, 12) on conflict do nothing;
  if found then
    update public.piso_cuentas set tickets = least(100000, tickets + 12) where user_id = me;
  end if;
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_reclamar_mision(text, date) from public, anon;
grant execute on function public.piso_reclamar_mision(text, date) to authenticated;

-- Precio en la tienda (null: no se vende)
create or replace function public.piso_precio(rareza text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case rareza when 'comun' then 20 when 'poco-comun' then 40 else null end;
$$;

-- Comprar un mueble de la tienda
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
revoke all on function public.piso_comprar(text) from public, anon;
grant execute on function public.piso_comprar(text) to authenticated;

-- Los sobres de la temporada (los mismos que SOBRES en economy.js; una prueba lo comprueba): precio de 1 y de 5,
-- probabilidad de raro y de poco común por mueble, y la lista de muebles que trae (null: todo el catálogo)
create or replace function public.piso_sobre(sobre text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case sobre
    when 'salon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('sillon', 'sofa', 'silla', 'banco', 'mesa-baja', 'mesa', 'mesilla', 'estanteria', 'cama'))
    when 'luces' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('lampara-pie', 'estufa', 'lampara-mesa', 'ventana', 'cuadro', 'reloj', 'guirnalda'))
    when 'balcon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'libros', 'radio', 'tetera', 'gato', 'alfombra', 'alfombra-redonda'))
    when 'coleccion' then jsonb_build_object('coste1', 25, 'coste5', 110, 'raro', 0.15, 'poco', 0.35, 'muebles', null)
    else null
  end;
$$;

-- Un mueble al azar de una rareza, de la lista del sobre; si el sobre no tiene nada de esa rareza, de todo el catálogo
-- (los de sagas no salen nunca)
create or replace function public.piso_al_azar(r text, lista jsonb)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.id from public.piso_catalogo k
      where k.rareza = r and k.saga is null and (lista is null or lista ? k.id)
      order by random() limit 1),
    (select k.id from public.piso_catalogo k where k.rareza = r and k.saga is null order by random() limit 1)
  );
$$;
revoke all on function public.piso_al_azar(text, jsonb) from public, anon, authenticated;

-- Abrir un sobre de la pared, de 1 o de 5 muebles. Devuelve { premios: [{ mueble, rareza, nuevo }], inventario }.
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
  elegido text;
  tenia integer;
  i integer;
begin
  if def is null then
    raise exception 'Ese sobre no está a la venta.' using errcode = 'P0001';
  end if;
  coste := case cuantos when 1 then (def ->> 'coste1')::integer when 5 then (def ->> 'coste5')::integer else null end;
  if coste is null then
    raise exception 'Los sobres son de 1 o de 5.' using errcode = 'P0001';
  end if;
  select c.tickets, c.sin_raro into saldo, pity from public.piso_cuentas c where c.user_id = me for update;
  if saldo < coste then
    raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
  end if;
  for i in 1..cuantos loop
    tirada := random();
    r := case
      when tirada < (def ->> 'raro')::double precision then 'raro'
      when tirada < (def ->> 'raro')::double precision + (def ->> 'poco')::double precision then 'poco-comun'
      else 'comun' end;
    -- Pity: el mueble 15 seguido sin nada raro (contado entre todos los sobres)
    if pity >= 14 then
      r := 'raro';
    end if;
    -- En el de 5, el último asegura algo mejor que común si aún no ha salido
    if cuantos = 5 and i = 5 and not mejor_que_comun and r = 'comun' then
      r := 'poco-comun';
    end if;
    if r <> 'comun' then
      mejor_que_comun := true;
    end if;
    pity := case when r = 'raro' then 0 else pity + 1 end;
    elegido := public.piso_al_azar(r, def -> 'muebles');
    select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = elegido), 0) into tenia;
    perform public.piso_sumar(me, elegido, 1);
    premios := premios || jsonb_build_object('mueble', elegido, 'rareza', r, 'nuevo', tenia = 0);
  end loop;
  update public.piso_cuentas set tickets = tickets - coste, sin_raro = pity where user_id = me;
  return jsonb_build_object('premios', premios, 'inventario', public.piso_mi_inventario());
end;
$$;
revoke all on function public.piso_abrir_sobre(text, integer) from public, anon;
grant execute on function public.piso_abrir_sobre(text, integer) to authenticated;

-- Reciclar una copia que no está colocada en tu piso
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
  if k.id is null or k.saga is not null then
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
