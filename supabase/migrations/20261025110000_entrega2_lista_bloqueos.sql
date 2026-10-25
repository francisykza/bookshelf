-- BookShelf · Entrega 2 (SPEC §25.5): lista de las personas que YO he bloqueado, con su alias y avatar, para poder
-- desbloquearlas. Las políticas de `profiles` ocultan a quien está bloqueado (en ambos sentidos), así que esta
-- función devuelve solo las filas propias de `blocks` con lo mínimo para reconocer a cada persona.
-- Aditiva: no cambia tablas ni datos. Se puede volver a ejecutar.
create or replace function public.my_blocked_profiles()
returns table (user_id uuid, alias text, avatar_id text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked, p.alias, p.avatar_id, b.created_at
  from public.blocks b
  left join public.profiles p on p.user_id = b.blocked
  where b.blocker = auth.uid()
  order by b.created_at desc;
$$;
revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;
