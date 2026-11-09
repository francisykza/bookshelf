-- BookShelf · Visitar el piso de un lector desde la Comunidad. Aditiva y re-ejecutable: no toca tablas ni políticas.
-- Decisión de Francisco (9-11-2026): además de los vecinos de tu edificio, puedes ver el piso de quien sigues, siempre que
-- ambos tengáis la comunidad activa y no haya bloqueo entre vosotros. Solo lectura: devuelve el dibujo del piso y la identidad
-- pública de su dueño; nunca su biblioteca (los libros siguen llegando por los permisos del rincón y las colecciones).
create or replace function public.piso_visita(lector uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  salida jsonb;
begin
  if me is null or lector is null or lector = me then
    return null;
  end if;
  if not public.community_member(me) or not public.community_member(lector) or public.is_blocked_pair(lector) then
    return null;
  end if;
  if not public.mismo_edificio(lector)
     and not exists (select 1 from public.follows f where f.follower = me and f.followed = lector) then
    return null;
  end if;
  select jsonb_build_object('user_id', s.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id, 'puerta', v.puerta, 'layout', s.layout)
    into salida
    from public.pisos s
    join public.edificio_vecinos v on v.user_id = s.user_id
    join public.profiles p on p.user_id = s.user_id
   where s.user_id = lector;
  return salida;
end;
$$;
revoke all on function public.piso_visita(uuid) from public, anon;
grant execute on function public.piso_visita(uuid) to authenticated;
