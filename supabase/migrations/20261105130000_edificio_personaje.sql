-- 1.69 (SPEC §69): tu personaje en «El edificio del puerto» (encargo de Francisco del 1-11-2026: un personaje propio
-- y personalizable que anda por tu piso, y que los vecinos ven al visitarlo). Su aspecto se guarda junto al piso, en
-- una columna nueva de `pisos`, y el portal lo devuelve con cada vecino. Solo se guarda un aspecto válido (lo mismo
-- que validateAvatar en src/features/edificio/actor.js): piel, peinado, color del pelo, jersey, pantalón, gafas y
-- complemento, de las listas cerradas del cliente. Sin texto libre. Las prendas que se ganan con las misiones del día
-- (1.70) también están en las listas; que solo las lleve quien las tiene lo comprueba la migración siguiente.
-- Migración ADITIVA y re-ejecutable: añade una columna que puede ser nula y redefine edificio_portal con un campo
-- más. No borra datos ni cambia las políticas (cada uno solo edita su piso; se ven los del edificio). La aplica
-- Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/personaje.rls.test.js). Sin ella,
-- el personaje se recuerda solo en el dispositivo y los vecinos no lo ven.

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
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor')
  )
$$;

alter table public.pisos add column if not exists personaje jsonb;
alter table public.pisos drop constraint if exists pisos_personaje_valido;
alter table public.pisos add constraint pisos_personaje_valido check (public.piso_personaje_valido(personaje));

-- El portal de la 1.63, con el personaje de cada vecino
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
