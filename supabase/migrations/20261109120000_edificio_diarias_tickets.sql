-- 1.79 · Misiones del día con el armario completo (decisión de Francisco del 3-11-2026): cuando ya tienes toda la ropa
-- que se gana con las misiones del día, las tres de un día dan 5 tickets en su lugar (`DIARIA_TICKETS` en
-- src/features/edificio/dailyMissions.js). Rehace `piso_mision_diaria`; lo demás, igual que en
-- 20261105140000_edificio_misiones_diarias.sql. Devuelve también `tickets` (los ganados con esta llamada, 0 si nada).
-- Necesita la tienda (1.67) y las misiones del día (1.70). Re-ejecutable: solo redefine la función. No borra datos ni
-- cambia políticas. La aplica Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/).
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
  ganados integer := 0;
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
      else
        -- Ya tienes todo el armario: tickets en su lugar (una vez por día, porque las tres solo se completan una vez)
        perform public.piso_inventario_asegurar(me);
        update public.piso_cuentas set tickets = least(100000, tickets + 5) where user_id = me;
        ganados := 5;
      end if;
    end if;
  end if;
  res := public.piso_mi_armario(dia);
  return jsonb_set(jsonb_set(res, '{nueva}', coalesce(to_jsonb(premio), 'null'::jsonb)), '{tickets}', to_jsonb(ganados));
end;
$$;
revoke all on function public.piso_mision_diaria(text, date) from public, anon;
grant execute on function public.piso_mision_diaria(text, date) to authenticated;
