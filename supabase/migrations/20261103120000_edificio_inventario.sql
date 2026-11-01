-- 1.66 (SPEC §66): inventario de muebles de «El edificio del puerto», fase 1 de la economía de muebles
-- (docs/qa/economia-muebles.md, aprobada por Francisco el 1-11-2026). Cada persona tiene copias de cada mueble y su piso
-- no puede tener colocadas más de las que tiene. Migración ADITIVA y re-ejecutable: añade dos columnas al catálogo, dos
-- tablas y cuatro funciones, y amplía la validación del guardado de pisos; no borra ni cambia datos. La aplica Francisco
-- en el SQL Editor (desarrollo primero). Probada con PGlite (src/features/edificio/__tests__/inventario.rls.test.js).
--
-- Decisiones de Francisco: lo que cada uno tiene colocado hoy pasa a ser suyo (una copia por mueble colocado); de
-- inicio, los diez muebles del piso inicial más seis comunes a elegir (una sola vez); los muebles de sagas siguen libres
-- hasta que se desbloqueen leyendo (fase 5). Nada de esto toca figuras, Cajas Sorpresa ni pity. Inventario y elección,
-- solo en el servidor: la app no puede escribir estas tablas.

-- ── Catálogo: rareza (todo común por ahora; las rarezas llegan en la fase 3) y set de saga ────────────────────────
alter table public.piso_catalogo add column if not exists rareza text not null default 'comun';
alter table public.piso_catalogo drop constraint if exists piso_catalogo_rareza_check;
alter table public.piso_catalogo add constraint piso_catalogo_rareza_check check (rareza in ('comun', 'poco-comun', 'raro', 'especial'));
alter table public.piso_catalogo add column if not exists saga text;
update public.piso_catalogo k set saga = v.saga
  from (values ('brasero', 'jinetes'), ('silla-montar', 'jinetes'), ('huevo-dragon', 'jinetes'), ('dagas-pared', 'jinetes'),
    ('farol-bruma', 'bruma'), ('viales', 'bruma'), ('monedas', 'bruma'), ('ventana-ceniza', 'bruma'),
    ('barra-posada', 'posada'), ('barril', 'posada'), ('laud', 'posada'), ('espada-pared', 'posada'),
    ('rosal', 'rosas'), ('arco-rosas', 'rosas'), ('mascara', 'rosas'), ('ventana-estrellas', 'rosas'),
    ('esferas', 'tormenta'), ('lampara-gemas', 'tormenta'), ('atril', 'tormenta'), ('cuadro-tormenta', 'tormenta')) v (id, saga)
  where k.id = v.id;

-- ── Inventario y cuenta (solo se tocan a través de las funciones de abajo) ───────────────────────────────────
create table if not exists public.piso_cuentas (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  inicio_elegido boolean not null default false,
  created_at     timestamptz not null default now()
);
create table if not exists public.piso_inventario (
  user_id uuid not null references auth.users (id) on delete cascade,
  mueble  text not null references public.piso_catalogo (id) on delete cascade,
  copias  smallint not null check (copias between 0 and 99),
  primary key (user_id, mueble)
);
alter table public.piso_cuentas enable row level security;
alter table public.piso_inventario enable row level security;
revoke all on public.piso_cuentas from anon, authenticated;
revoke all on public.piso_inventario from anon, authenticated;

-- La primera vez que hace falta, el inventario de una persona: una copia por cada mueble que tenga colocado en su piso
-- (o las que tenga, si hay varios iguales) y, como mínimo, los diez del piso inicial (src/features/edificio/demo.js,
-- `starterRoom`; una prueba comprueba que coinciden). Los de sagas no cuentan: siguen libres. Solo una vez por persona.
create or replace function public.piso_inventario_asegurar(uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  lay jsonb;
  nuevas integer;
begin
  insert into public.piso_cuentas (user_id) values (uid) on conflict (user_id) do nothing;
  get diagnostics nuevas = row_count;
  if nuevas = 0 then
    return;
  end if;
  select p.layout into lay from public.pisos p where p.user_id = uid;
  insert into public.piso_inventario (user_id, mueble, copias)
  select uid, k.id, least(99, greatest(coalesce(puestos.n, 0), coalesce(inicio.n, 0)))::smallint
  from public.piso_catalogo k
  left join (
    select e ->> 'id' as id, count(*) as n
    from jsonb_array_elements(case when jsonb_typeof(lay -> 'items') = 'array' then lay -> 'items' else '[]'::jsonb end) e
    group by 1
  ) puestos on puestos.id = k.id
  left join (
    select s as id, count(*) as n
    from unnest(array['alfombra', 'sillon', 'lampara-pie', 'estanteria', 'planta-grande', 'mesa-baja', 'libros', 'tetera', 'ventana', 'cuadro']) s
    group by 1
  ) inicio on inicio.id = k.id
  where k.saga is null and (puestos.n is not null or inicio.n is not null)
  on conflict (user_id, mueble) do nothing;
end;
$$;
revoke all on function public.piso_inventario_asegurar(uuid) from public, anon, authenticated;

-- El primer mueble de un piso del que no hay copias suficientes (null si todo cabe). Los de sagas no cuentan.
create or replace function public.piso_falta_copia(uid uuid, layout jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select puestos.id
  from (
    select e ->> 'id' as id, count(*) as n
    from jsonb_array_elements(case when jsonb_typeof(layout -> 'items') = 'array' then layout -> 'items' else '[]'::jsonb end) e
    group by 1
  ) puestos
  join public.piso_catalogo k on k.id = puestos.id and k.saga is null
  left join public.piso_inventario v on v.user_id = uid and v.mueble = puestos.id
  where puestos.n > coalesce(v.copias, 0)
  order by puestos.id
  limit 1;
$$;
revoke all on function public.piso_falta_copia(uuid, jsonb) from public, anon, authenticated;

-- El guardado del piso (1.63) más el inventario: antes de comprobar las copias, se asegura el inventario con el piso
-- que había guardado (así nadie pierde lo que ya tenía colocado).
create or replace function public.pisos_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  falta text;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Un piso no cambia de dueño.';
  end if;
  if not public.piso_valido(new.layout) then
    raise exception 'Ese piso no es válido: solo muebles del catálogo, dentro del piso y sin solaparse.';
  end if;
  perform public.piso_inventario_asegurar(new.user_id);
  falta := public.piso_falta_copia(new.user_id, new.layout);
  if falta is not null then
    raise exception 'No tienes copias suficientes de «%» para ese piso.', falta using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.pisos_validate() from public, anon, authenticated;

-- Mi inventario: { inicio_elegido, copias: { mueble: n } }. La primera vez lo crea.
create or replace function public.piso_mi_inventario()
returns jsonb
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
  return jsonb_build_object(
    'inicio_elegido', (select c.inicio_elegido from public.piso_cuentas c where c.user_id = me),
    'copias', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.piso_inventario v where v.user_id = me and v.copias > 0), '{}'::jsonb)
  );
end;
$$;
revoke all on function public.piso_mi_inventario() from public, anon;
grant execute on function public.piso_mi_inventario() to authenticated;

-- Los seis muebles comunes de inicio, una sola vez (se pueden repetir: dos sillas cuentan como dos). Devuelve el
-- inventario nuevo.
create or replace function public.piso_elegir_inicio(muebles text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hecho boolean;
begin
  if me is null then
    raise exception 'Inicia sesión para tener muebles.';
  end if;
  if not public.community_member(me) then
    raise exception 'Activa la comunidad para tener piso en el edificio.' using errcode = 'P0001';
  end if;
  perform public.piso_inventario_asegurar(me);
  select c.inicio_elegido into hecho from public.piso_cuentas c where c.user_id = me for update;
  if hecho then
    raise exception 'Ya elegiste tus muebles de inicio.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(muebles, 1), 0) <> 6 then
    raise exception 'Elige seis muebles.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(muebles) m left join public.piso_catalogo k on k.id = m
    where k.id is null or k.saga is not null or k.rareza <> 'comun'
  ) then
    raise exception 'Solo se eligen muebles comunes del catálogo.' using errcode = 'P0001';
  end if;
  insert into public.piso_inventario (user_id, mueble, copias)
  select me, m, count(*)::smallint from unnest(muebles) m group by m
  on conflict (user_id, mueble) do update set copias = least(99, public.piso_inventario.copias + excluded.copias);
  update public.piso_cuentas set inicio_elegido = true where user_id = me;
  return public.piso_mi_inventario();
end;
$$;
revoke all on function public.piso_elegir_inicio(text[]) from public, anon;
grant execute on function public.piso_elegir_inicio(text[]) to authenticated;
