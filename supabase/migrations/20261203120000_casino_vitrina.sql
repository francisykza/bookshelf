-- El casino en 3D, bloque e (1.111.0, SPEC §111; encargo de Francisco del 10-11-2026, plan en docs/qa/casino-3d.md §4):
-- la vitrina de premios. La aplica Francisco en el SQL Editor, después de 20261202120000_casino_chisteras.sql. Sin ella, la
-- vitrina se ve con todo tapado y dice que aún no está lista.
--
-- - Lo que tiene cada cuenta de los premios del casino (la caja, la lata y la ruleta), sus fichas y garbanzos, y qué hitos
--   ha logrado: doce copas, cuatro por juego, **solo decorativas** (no dan nada). Se calcula con lo que ya guarda el servidor
--   (manos, giros, partidas, inventario y armario): no hay tabla nueva.
-- - Los amigos (os seguís los dos, con la comunidad y sin bloqueo: piso_casino_amigo) pueden ver tu vitrina, solo mirar.
-- ADITIVA y re-ejecutable: cuatro funciones nuevas. No crea tablas ni cambia ningún dato.
-- Probada con PGlite (src/features/edificio/__tests__/casino-vitrina.rls.test.js).

-- Los hitos, en el orden de la app (HITOS en src/features/edificio/hotel/vitrina.js; una prueba lo comprueba)
create or replace function public.piso_casino_vitrina_hitos()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['21-primera', '21-veintiuna', '21-diez', '21-cincuenta',
               'ruleta-primera', 'ruleta-cuatro', 'ruleta-premio', 'ruleta-dorada',
               'chisteras-primera', 'chisteras-perfecta', 'chisteras-cinco', 'chisteras-diez'];
$$;

-- Los premios que se tienen o no: lo de la caja (sin el sobre), la lata y la ruleta (sin fichas ni garbanzos)
create or replace function public.piso_casino_vitrina_premios()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select a.key from jsonb_each(public.piso_casino_caja_precios()) a where a.value ->> 'tipo' <> 'sobre'
    union all
    select a.key from jsonb_each(public.piso_casino_lata_precios()) a
    union all
    select c ->> 'id' from jsonb_array_elements(public.piso_casino_ruleta_casillas()) c where c ->> 'tipo' not in ('fichas', 'garbanzos')
  );
$$;
revoke all on function public.piso_casino_vitrina_premios() from public, anon, authenticated;

-- La vitrina de `uid`: { tienes: [ids], fichas, garbanzos, hitos: [ids logrados] }
create or replace function public.piso_casino_vitrina_de_cuenta(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with manos as (
    select
      count(*) filter (where m.estado in ('ganada', 'veintiuna')) as ganadas,
      count(*) filter (where m.estado = 'veintiuna') as veintiunas,
      count(*) filter (where m.estado in ('veintiuna', 'ganada', 'empate', 'perdida')) as jugadas
    from public.piso_casino_manos m where m.user_id = uid
  ), giros as (
    select
      count(*) as giros,
      count(*) filter (where r.premio not like 'fichas:%' and r.premio not like 'garbanzos:%' and not r.repetido) as premios,
      count(*) filter (where r.casilla = 8) as doradas
    from public.piso_casino_ruleta r where r.user_id = uid
  ), chis as (
    select
      count(*) filter (where c.estado = 'hecha') as partidas,
      count(*) filter (where c.estado = 'hecha' and c.aciertos = 3) as perfectas
    from public.piso_casino_chisteras c where c.user_id = uid
  )
  select jsonb_build_object(
    'tienes', to_jsonb(array(
      select p from unnest(public.piso_casino_vitrina_premios()) p
      where (p like '%:%' and exists (select 1 from public.piso_prendas x where x.user_id = uid and x.prenda = p))
         or (p not like '%:%' and exists (select 1 from public.piso_inventario v where v.user_id = uid and v.mueble = p and v.copias > 0))
    )),
    'fichas', coalesce((select c.fichas from public.piso_casino_cuentas c where c.user_id = uid), 0),
    'garbanzos', coalesce((select c.garbanzos from public.piso_casino_cuentas c where c.user_id = uid), 0),
    'hitos', to_jsonb(array(
      select h from unnest(array[
        case when manos.ganadas >= 1 then '21-primera' end,
        case when manos.veintiunas >= 1 then '21-veintiuna' end,
        case when manos.ganadas >= 10 then '21-diez' end,
        case when manos.jugadas >= 50 then '21-cincuenta' end,
        case when giros.giros >= 1 then 'ruleta-primera' end,
        case when giros.giros >= 4 then 'ruleta-cuatro' end,
        case when giros.premios >= 1 then 'ruleta-premio' end,
        case when giros.doradas >= 1 then 'ruleta-dorada' end,
        case when chis.partidas >= 1 then 'chisteras-primera' end,
        case when chis.perfectas >= 1 then 'chisteras-perfecta' end,
        case when chis.perfectas >= 5 then 'chisteras-cinco' end,
        case when chis.partidas >= 10 then 'chisteras-diez' end
      ]) h where h is not null
    ))
  )
  from manos, giros, chis;
$$;
revoke all on function public.piso_casino_vitrina_de_cuenta(uuid) from public, anon, authenticated;

-- La vitrina: la tuya (sin `otro`) o la de un amigo (solo mirar; si no os seguís los dos, no)
create or replace function public.piso_casino_vitrina(otro uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if otro is null or otro = me then
    return public.piso_casino_vitrina_de_cuenta(me) || jsonb_build_object('uid', me);
  end if;
  if not public.piso_casino_amigo(otro) then
    raise exception 'Solo se ve la vitrina de un amigo: os tenéis que seguir los dos.' using errcode = 'P0001';
  end if;
  return public.piso_casino_vitrina_de_cuenta(otro) || jsonb_build_object('uid', otro,
    'alias', (select p.alias from public.profiles p where p.user_id = otro));
end;
$$;
revoke all on function public.piso_casino_vitrina(uuid) from public, anon;
grant execute on function public.piso_casino_vitrina(uuid) to authenticated;
