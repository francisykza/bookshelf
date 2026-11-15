-- Sube al nivel 3 (la Librería, la del taller) el café de las cuentas de prueba: las de `cafe_probadores`, que son la de
-- Francisco y la de su pareja. Francisco, 15-11-2026: «Podemos para probar los cambios rapido poner a mi cuenta y la de mi
-- pareja subirlas a nivel 3?». NO es una migración: se ejecuta a mano, una vez, en el SQL Editor. No lleva correos.
-- - Solo toca los cafés abiertos por debajo del nivel 3. Los demás se quedan como están, así que se puede volver a ejecutar.
-- - Pone la reputación al principio del nivel 3 (1.000; si ya tenía más, la deja) y sube el nivel sin esperar a los
--   influencers de los niveles 2 y 3. Vendrán después, uno al día y sin frenar nada, como los de un nivel que ya tienes.
-- - Lo demás lo hace el juego, como al subir jugando (`cafe_progreso`):
--   - los tickets de los niveles que no había cobrado (20 del 2 y 40 del 3);
--   - los hitos que alcanza esa reputación (los tres del nivel 2: un mueble a la venta, el chocolate en la carta y 15 granos);
--   - la reputación que esperaba a un influencer, que vuelve.
--   Se llama con un día sin jornada (1-1-1900) para no tocar los tickets del día.
-- - Los clientes y la carta de un día ya abierto no cambian: lo nuevo llega con la jornada siguiente («Otra jornada»).
-- Al final, cada cuenta de prueba antes y después, sin correos: las ocho primeras letras de su id.

drop table if exists antes_nivel3;
create temp table antes_nivel3 as
select p.user_id, l.nivel, l.reputacion, l.granos, c.tickets
from public.cafe_probadores p
left join public.cafe_locales l on l.user_id = p.user_id
left join public.piso_cuentas c on c.user_id = p.user_id;

do $$
declare
  p record;
  l public.cafe_locales;
begin
  for p in select x.user_id from public.cafe_probadores x loop
    select * into l from public.cafe_locales x where x.user_id = p.user_id for update;
    if l.user_id is null or l.inaugurado is null or l.nivel >= 3 then
      continue;
    end if;
    update public.cafe_locales x
       set nivel = 3, reputacion = greatest(x.reputacion, public.cafe_nivel_desde(3)), actualizado = now()
     where x.user_id = p.user_id;
    perform public.cafe_progreso(p.user_id, date '1900-01-01');
  end loop;
end;
$$;

select left(a.user_id::text, 8) as cuenta,
       a.nivel as nivel_antes, l.nivel as nivel_ahora,
       a.reputacion as reputacion_antes, l.reputacion as reputacion_ahora,
       a.granos as granos_antes, l.granos as granos_ahora,
       a.tickets as tickets_antes, c.tickets as tickets_ahora,
       (select string_agg(h.nivel || '.' || h.hito, ' ' order by h.nivel, h.hito) from public.cafe_hitos h where h.user_id = a.user_id) as hitos
from antes_nivel3 a
left join public.cafe_locales l on l.user_id = a.user_id
left join public.piso_cuentas c on c.user_id = a.user_id
order by 1;
