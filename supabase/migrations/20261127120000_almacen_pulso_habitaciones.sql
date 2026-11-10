-- La visita con un amigo llega a las habitaciones (1.102.1, SPEC §101 y §102; corrección del 10-11-2026).
-- La aplica Francisco en el SQL Editor, después de 20261126120000_almacen_heroes.sql.
--
-- `piso_almacen_pulso` guardaba la x de cada uno como mucho en 18, la pared derecha de la nave. Desde la 1.101 se puede
-- andar por las habitaciones y el probador, al otro lado del paso (x hasta 29,5, `HAB.x1` en `almacenLayout.js`): con el
-- límite de antes, a quien estuviera allí se le veía en la pared. Solo cambia ese límite; lo demás es igual que en
-- 20261124120000_hotel_almacen.sql. No se borra ni se cambia ningún dato.

create or replace function public.piso_almacen_pulso(sala uuid, x real, y real, yaw real, zona text, mira text, mira_n integer, sello jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  s public.piso_almacen_salas;
  limpio jsonb := null;
begin
  select * into s from public.piso_almacen_salas v where v.id = sala;
  if s.id is null or me not in (s.anfitrion, s.invitado) or s.caduca <= now() then
    raise exception 'almacen:sala' using errcode = 'P0001';
  end if;
  if me = s.invitado and s.estado = 'invitada' then
    return jsonb_build_object('estado', 'invitada', 'otros', '[]'::jsonb);
  end if;
  if s.estado = 'cerrada' or not public.piso_casino_amigo(case when me = s.anfitrion then s.invitado else s.anfitrion end) then
    return jsonb_build_object('estado', 'cerrada', 'otros', '[]'::jsonb);
  end if;
  -- Solo lo que se puede enseñar del albarán: cuándo empezó, el modo y las marcas
  if jsonb_typeof(sello) = 'object' and (sello ->> 'modo') in ('rapido', 'sinprisa') and jsonb_typeof(sello -> 'marcas') = 'array'
     and jsonb_typeof(sello -> 'empezado') = 'number' then
    limpio := jsonb_build_object('modo', sello ->> 'modo', 'empezado', (sello ->> 'empezado')::bigint,
      'marcas', (select coalesce(jsonb_agg(case when m in ('true'::jsonb, 'false'::jsonb) then m else 'null'::jsonb end), '[]'::jsonb)
                   from (select m from jsonb_array_elements(sello -> 'marcas') m limit 3) q));
  end if;
  insert into public.piso_almacen_presencia as p (sala, user_id, x, y, yaw, zona, mira, mira_n, sello, visto)
  values (
    s.id, me,
    least(29.5, greatest(0, coalesce(piso_almacen_pulso.x, 15.5))),
    least(26, greatest(0, coalesce(piso_almacen_pulso.y, 23.6))),
    coalesce(piso_almacen_pulso.yaw, 3.5)::numeric % 7,
    case when zona in ('pasillos', 'caja', 'mercadillo') then zona else 'pasillos' end,
    case when exists (select 1 from public.piso_catalogo c where c.id = mira and c.saga is null) and not public.piso_retirado(mira) then mira else null end,
    least(1000000, greatest(0, coalesce(mira_n, 0))),
    limpio,
    now()
  )
  on conflict on constraint piso_almacen_presencia_pkey do update set x = excluded.x, y = excluded.y, yaw = excluded.yaw, zona = excluded.zona, mira = excluded.mira,
    mira_n = excluded.mira_n, sello = excluded.sello, visto = excluded.visto;
  return jsonb_build_object(
    'estado', s.estado,
    'otros', coalesce((
      select jsonb_agg(jsonb_build_object('uid', p.user_id, 'alias', pr.alias, 'avatar_id', pr.avatar_id,
        'personaje', (select ps.personaje from public.pisos ps where ps.user_id = p.user_id),
        'x', p.x, 'y', p.y, 'yaw', p.yaw, 'zona', p.zona, 'mira', p.mira, 'mira_n', p.mira_n, 'sello', p.sello,
        'hace', extract(epoch from now() - p.visto)))
        from public.piso_almacen_presencia p left join public.profiles pr on pr.user_id = p.user_id
       where p.sala = s.id and p.user_id <> me and p.visto > now() - interval '20 seconds'), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.piso_almacen_pulso(uuid, real, real, real, text, text, integer, jsonb) from public, anon;
grant execute on function public.piso_almacen_pulso(uuid, real, real, real, text, text, integer, jsonb) to authenticated;
