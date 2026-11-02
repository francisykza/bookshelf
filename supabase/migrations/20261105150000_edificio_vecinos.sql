-- 1.71 (SPEC §71): más cosas que hacer con los vecinos de «El edificio del puerto» (encargo de Francisco del
-- 1-11-2026, «un rework a las interacciones con tus vecinos»; eligió regalar muebles, libro de visitas y «me gusta» por
-- mueble). Sin texto libre en ningún caso:
--   · regalar una copia libre de un mueble a un vecino (sale de tu inventario y entra en el suyo; nunca de sagas);
--   · firmar el libro de visitas de un piso con una frase cerrada (una vez al día por piso);
--   · «me gusta» a un mueble concreto de un piso ajeno.
-- Solo entre vecinos visibles (mismo edificio, comunidad activada y sin bloqueos). Todo pasa por funciones; las tablas
-- no se leen ni se escriben directamente.
-- Necesita las migraciones del edificio, el inventario y la tienda. ADITIVA y re-ejecutable: tres tablas y funciones
-- nuevas. No borra datos. La aplica Francisco en el SQL Editor. Probada con PGlite
-- (src/features/edificio/__tests__/vecinos.rls.test.js).

-- Las frases del libro de visitas (las mismas que FIRMAS en src/features/edificio/catalog.js)
create or replace function public.piso_firmas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['saludo', 'leer', 'luz', 'cafe', 'pronto', 'gracias'];
$$;

create table if not exists public.piso_regalos (
  id bigint generated always as identity primary key,
  de uuid not null references auth.users (id) on delete cascade,
  para uuid not null references auth.users (id) on delete cascade,
  mueble text not null references public.piso_catalogo (id) on delete cascade,
  creado timestamptz not null default now(),
  check (de <> para)
);
create index if not exists piso_regalos_para on public.piso_regalos (para, creado desc);
create index if not exists piso_regalos_de on public.piso_regalos (de, creado desc);

create table if not exists public.piso_visitas (
  piso uuid not null references auth.users (id) on delete cascade,
  de uuid not null references auth.users (id) on delete cascade,
  dia date not null default current_date,
  frase text not null,
  creado timestamptz not null default now(),
  primary key (piso, de, dia),
  check (piso <> de)
);

create table if not exists public.piso_megusta (
  piso uuid not null references auth.users (id) on delete cascade,
  de uuid not null references auth.users (id) on delete cascade,
  uid integer not null,
  mueble text not null,
  creado timestamptz not null default now(),
  primary key (piso, de, uid),
  check (piso <> de)
);

alter table public.piso_regalos enable row level security;
alter table public.piso_visitas enable row level security;
alter table public.piso_megusta enable row level security;
revoke all on public.piso_regalos from anon, authenticated;
revoke all on public.piso_visitas from anon, authenticated;
revoke all on public.piso_megusta from anon, authenticated;

-- ¿Es `otro` un vecino que puedo ver (mismo edificio, comunidad activada, sin bloqueos)?
create or replace function public.piso_vecino_visible(otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select otro is not null and otro <> auth.uid()
    and public.community_member(otro)
    and not public.is_blocked_pair(otro)
    and exists (
      select 1 from public.edificio_vecinos a join public.edificio_vecinos b on a.edificio = b.edificio
      where a.user_id = auth.uid() and b.user_id = otro
    );
$$;
revoke all on function public.piso_vecino_visible(uuid) from public, anon, authenticated;

-- Regalar una copia libre de un mueble (no de sagas) a un vecino. Como mucho cinco regalos al día
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
  if k.id is null or k.saga is not null then
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

-- Firmar el libro de visitas de un piso (una frase cerrada; una vez al día por piso, se puede cambiar ese día)
create or replace function public.piso_firmar(piso uuid, frase text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if not public.piso_vecino_visible(piso) then
    raise exception 'Solo se firma en el libro de un vecino de tu edificio.' using errcode = 'P0001';
  end if;
  if not (frase = any (public.piso_firmas())) then
    raise exception 'Esa frase no está en el libro de visitas.' using errcode = 'P0001';
  end if;
  insert into public.piso_visitas (piso, de, frase) values (piso, me, frase)
    on conflict on constraint piso_visitas_pkey do update set frase = excluded.frase, creado = now();
  return public.piso_social(piso);
end;
$$;
revoke all on function public.piso_firmar(uuid, text) from public, anon;
grant execute on function public.piso_firmar(uuid, text) to authenticated;

-- «Me gusta» (o quitarlo) a un mueble que está ahora en el piso de un vecino
create or replace function public.piso_megusta(piso uuid, uid integer, si boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  cual text;
begin
  if not public.piso_vecino_visible(piso) then
    raise exception 'Solo se puede en el piso de un vecino de tu edificio.' using errcode = 'P0001';
  end if;
  select e ->> 'id' into cual
    from public.pisos p, jsonb_array_elements(case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end) e
    where p.user_id = piso_megusta.piso and (e ->> 'uid') = uid::text
    limit 1;
  if cual is null then
    raise exception 'Ese mueble ya no está en su piso.' using errcode = 'P0001';
  end if;
  if si then
    insert into public.piso_megusta (piso, de, uid, mueble) values (piso, me, uid, cual)
      on conflict on constraint piso_megusta_pkey do update set mueble = excluded.mueble, creado = now();
  else
    delete from public.piso_megusta m where m.piso = piso_megusta.piso and m.de = me and m.uid = piso_megusta.uid;
  end if;
  return public.piso_social(piso);
end;
$$;
revoke all on function public.piso_megusta(uuid, integer, boolean) from public, anon;
grant execute on function public.piso_megusta(uuid, integer, boolean) to authenticated;

-- Lo social de un piso (el mío o el de un vecino visible): el libro de visitas (las 20 últimas firmas de vecinos que
-- veo), los «me gusta» de cada mueble que sigue en el piso y cuáles son míos, y, en el mío, los regalos recibidos
create or replace function public.piso_social(piso uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  items jsonb;
begin
  if me is null or (piso <> me and not public.piso_vecino_visible(piso)) then
    raise exception 'Ese piso no está en tu edificio.' using errcode = 'P0001';
  end if;
  select case when jsonb_typeof(p.layout -> 'items') = 'array' then p.layout -> 'items' else '[]'::jsonb end into items
    from public.pisos p where p.user_id = piso_social.piso;
  return jsonb_build_object(
    'visitas', coalesce((
      select jsonb_agg(jsonb_build_object('de', v.de, 'alias', pr.alias, 'avatar_id', pr.avatar_id, 'frase', v.frase, 'dia', v.dia) order by v.creado desc)
      from (
        select * from public.piso_visitas x
        where x.piso = piso_social.piso and (x.de = me or public.piso_vecino_visible(x.de))
        order by x.creado desc limit 20
      ) v left join public.profiles pr on pr.user_id = v.de), '[]'::jsonb),
    'megusta', coalesce((
      select jsonb_object_agg(c.uid::text, c.n) from (
        select m.uid, count(*) as n from public.piso_megusta m
        where m.piso = piso_social.piso
          and exists (select 1 from jsonb_array_elements(coalesce(items, '[]'::jsonb)) e where (e ->> 'uid') = m.uid::text and e ->> 'id' = m.mueble)
        group by m.uid
      ) c), '{}'::jsonb),
    'mios', coalesce((select jsonb_agg(m.uid order by m.uid) from public.piso_megusta m where m.piso = piso_social.piso and m.de = me), '[]'::jsonb),
    'regalos', case when piso = me then coalesce((
      select jsonb_agg(jsonb_build_object('de', r.de, 'alias', pr.alias, 'mueble', r.mueble, 'creado', r.creado) order by r.creado desc)
      from (select * from public.piso_regalos x where x.para = me order by x.creado desc limit 20) r
      left join public.profiles pr on pr.user_id = r.de), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.piso_social(uuid) from public, anon;
grant execute on function public.piso_social(uuid) to authenticated;
