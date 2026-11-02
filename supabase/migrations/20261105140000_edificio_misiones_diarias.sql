-- 1.70 (SPEC §70): misiones del día en tu piso de «El edificio del puerto» (encargo de Francisco del 1-11-2026).
-- Cada día hay tres misiones pequeñas en la habitación (las mismas para todos; salen de la fecha, igual que
-- missionsOf en src/features/edificio/dailyMissions.js). Al hacer las tres de un día llega una prenda nueva para tu
-- personaje, en un orden fijo (PRENDAS en actor.js). Nunca dan tickets: los tickets se ganan solo leyendo.
-- Como las misiones semanales de la 1.67, la app dice qué se ha hecho y el servidor lo cuenta una vez por misión y
-- día; el premio es solo de aspecto. Y solo puede llevar una prenda ganada quien la tiene (lo comprueba un trigger al
-- guardar el personaje).
-- Necesita las migraciones de la tienda (piso_yo) y del personaje (20261105130000). ADITIVA y re-ejecutable: dos
-- tablas nuevas, funciones nuevas y un trigger más en pisos. No borra datos. La aplica Francisco en el SQL Editor.
-- Probada con PGlite (src/features/edificio/__tests__/diarias.rls.test.js).

-- Las prendas que se ganan, en orden (la misma lista que PRENDAS en actor.js)
create or replace function public.piso_prendas_orden()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:bufanda', 'jersey:8', 'complemento:gorro', 'pantalon:5', 'colorPelo:6', 'jersey:9', 'complemento:boina', 'jersey:10', 'pantalon:6', 'complemento:auriculares', 'colorPelo:7', 'jersey:11', 'complemento:flor'];
$$;

-- Las tres misiones de un día (las mismas que missionsOf en dailyMissions.js)
create or replace function public.piso_diarias_del_dia(dia date)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with pool as (select array['sentarse', 'mover', 'color', 'tarde', 'pasear', 'nuevo', 'armario'] as p),
       n as (select (dia - date '2026-01-01') as n)
  select array[
    p[(((n + 0) % 7 + 7) % 7) + 1],
    p[(((n + 2) % 7 + 7) % 7) + 1],
    p[(((n + 4) % 7 + 7) % 7) + 1]
  ] from pool, n;
$$;

create table if not exists public.piso_prendas (
  user_id uuid not null references auth.users (id) on delete cascade,
  prenda text not null,
  ganada timestamptz not null default now(),
  primary key (user_id, prenda)
);
create table if not exists public.piso_diarias (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  mision text not null,
  hecha timestamptz not null default now(),
  primary key (user_id, dia, mision)
);
alter table public.piso_prendas enable row level security;
alter table public.piso_diarias enable row level security;
revoke all on public.piso_prendas from anon, authenticated;
revoke all on public.piso_diarias from anon, authenticated;
grant select on public.piso_prendas to authenticated;
grant select on public.piso_diarias to authenticated;
drop policy if exists "ver mis prendas" on public.piso_prendas;
create policy "ver mis prendas" on public.piso_prendas for select to authenticated using (user_id = auth.uid());
drop policy if exists "ver mis diarias" on public.piso_diarias;
create policy "ver mis diarias" on public.piso_diarias for select to authenticated using (user_id = auth.uid());

-- Mi armario: las prendas ganadas y las misiones hechas de un día
create or replace function public.piso_mi_armario(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  return jsonb_build_object(
    'prendas', coalesce((select jsonb_agg(x.prenda order by x.ganada, x.prenda) from public.piso_prendas x where x.user_id = me), '[]'::jsonb),
    'hechas', coalesce((select jsonb_agg(d.mision order by d.hecha) from public.piso_diarias d where d.user_id = me and d.dia = piso_mi_armario.dia), '[]'::jsonb),
    'nueva', null
  );
end;
$$;
revoke all on function public.piso_mi_armario(date) from public, anon;
grant execute on function public.piso_mi_armario(date) to authenticated;

-- Contar una misión del día. Al completar las tres, la siguiente prenda que no tengas (en `nueva`)
create or replace function public.piso_mision_diaria(mision text, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hoy text[] := public.piso_diarias_del_dia(dia);
  hechas integer;
  premio text;
  res jsonb;
begin
  -- Hoy, ayer o mañana (por las zonas horarias)
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede contar.' using errcode = 'P0001';
  end if;
  if not (mision = any (hoy)) then
    raise exception 'Esa no es una misión de ese día.' using errcode = 'P0001';
  end if;
  insert into public.piso_diarias (user_id, dia, mision) values (me, dia, mision) on conflict do nothing;
  if found then
    select count(*) into hechas from public.piso_diarias d where d.user_id = me and d.dia = piso_mision_diaria.dia and d.mision = any (hoy);
    if hechas = 3 then
      select p into premio from unnest(public.piso_prendas_orden()) with ordinality as o(p, k)
        where not exists (select 1 from public.piso_prendas x where x.user_id = me and x.prenda = o.p)
        order by k limit 1;
      if premio is not null then
        insert into public.piso_prendas (user_id, prenda) values (me, premio) on conflict do nothing;
      end if;
    end if;
  end if;
  res := public.piso_mi_armario(dia);
  return jsonb_set(res, '{nueva}', coalesce(to_jsonb(premio), 'null'::jsonb));
end;
$$;
revoke all on function public.piso_mision_diaria(text, date) from public, anon;
grant execute on function public.piso_mision_diaria(text, date) to authenticated;

-- Solo se lleva lo que se tiene: al guardar el personaje, cada prenda que se gana tiene que estar en tu armario
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
    where k = any (public.piso_prendas_orden())
      and not exists (select 1 from public.piso_prendas x where x.user_id = new.user_id and x.prenda = k)
    limit 1;
  if falta is not null then
    raise exception 'Aún no tienes esa prenda: se gana con las misiones del día.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pisos_personaje_prendas() from public, anon, authenticated;
drop trigger if exists pisos_personaje_prendas on public.pisos;
create trigger pisos_personaje_prendas before insert or update of personaje on public.pisos for each row execute function public.pisos_personaje_prendas();
