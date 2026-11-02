-- La cuenta del fundador (Francisco, 2-11-2026: «haz que mi cuenta por ser la de fundador tenga muchos más créditos y
-- los dragones para probar»). NO es una migración: no cambia el esquema ni a nadie más. Se ejecuta a mano, una vez, en
-- el SQL Editor (es re-ejecutable: deja la cuenta igual).
--   · Tickets de la cuenta: 10.000 (o los que ya tenga, si son más).
--   · Una copia de cada uno de los cinco místicos: los tres legendarios (dragoncillo, zorro de bruma, cinta de
--     tormenta), que te acompañan desde el armario, y los dos que se colocan (farol azul y rosa bajo estrellas).
-- Excepción a «los tickets solo se ganan leyendo», solo para esta cuenta y por decisión de Francisco.
-- Necesita las migraciones de la tienda (1.67) y de los místicos (1.72), ya aplicadas.
-- Antes de ejecutarlo, pon el correo de la cuenta en `correo` y en la consulta de abajo (en el repositorio, que es
-- público, va sin el correo de verdad).
-- Antes, entra una vez en «El edificio del puerto» con esa cuenta (así existe su fila de tickets).

do $$
declare
  correo constant text := 'TU-CORREO@ejemplo.com';
  uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(correo);
  if uid is null then
    raise exception 'No hay ninguna cuenta con el correo %.', correo;
  end if;
  update public.piso_cuentas set tickets = greatest(tickets, 10000) where user_id = uid;
  if not found then
    raise exception 'La cuenta aún no ha entrado en el edificio: entra una vez y vuelve a ejecutar esto.';
  end if;
  insert into public.piso_inventario (user_id, mueble, copias)
  select uid, k.id, 1 from public.piso_catalogo k where k.rareza in ('mistico', 'legendario')
  on conflict (user_id, mueble) do update set copias = greatest(public.piso_inventario.copias, 1);
end;
$$;

-- Para comprobarlo (debe salir la cuenta con sus tickets y los cinco místicos)
select c.tickets, array_agg(v.mueble order by v.mueble) as misticos
from public.piso_cuentas c
join auth.users u on u.id = c.user_id
left join public.piso_inventario v on v.user_id = c.user_id and v.mueble in (select id from public.piso_catalogo where rareza in ('mistico', 'legendario'))
where lower(u.email) = lower('TU-CORREO@ejemplo.com')
group by c.tickets;
