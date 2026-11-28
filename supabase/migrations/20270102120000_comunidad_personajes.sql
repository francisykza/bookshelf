-- 1.165 (docs/qa/comunidad-visita.md, bloque 3; Francisco, 28-11-2026, «Sí, así»): el avatar de cada lector en la Comunidad es el
-- busto de su personaje. La aplica Francisco en el SQL Editor. Probada con PGlite (comunidad-personajes.rls.test.js). Sin ella,
-- la app enseña los retratos de antes.
--   · `pisos` solo deja ver a los vecinos, así que `comunidad_personajes` da el aspecto del personaje y nada más (ni el piso, ni
--     el compañero, ni la puerta), y solo de quien tiene la comunidad activada y no está bloqueado en ningún sentido.
--   · Solo la llama quien participa en la comunidad (su propio aspecto, siempre). Hasta 60 a la vez.
--   · Quien no tiene piso o personaje no sale: la app le pone el retrato neutro de Libo.
create or replace function public.comunidad_personajes(ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  filas jsonb;
begin
  if me is null or ids is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'personaje', s.personaje)), '[]'::jsonb)
    into filas
    from public.pisos s
    where s.user_id = any (ids[1:60])
      and s.personaje is not null
      and (s.user_id = me or (public.community_member(me) and public.community_member(s.user_id) and not public.is_blocked_pair(s.user_id)));
  return filas;
end;
$$;
revoke all on function public.comunidad_personajes(uuid[]) from public, anon;
grant execute on function public.comunidad_personajes(uuid[]) to authenticated;
