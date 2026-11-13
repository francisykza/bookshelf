-- Jornadas de prueba del café para la cuenta de Francisco (13-11-2026: «Quiero que mi cuenta pueda jugar todo lo que quiera
-- para probar yo todas las funciones del juego»). NO es una migración: se ejecuta a mano, en el SQL Editor, después de
-- aplicar `20261215120000_cafe_probador.sql`. Es re-ejecutable (deja la cuenta igual) y no toca a nadie más.
-- Antes de ejecutarlo, pon el correo de la cuenta en `correo` y en la consulta de abajo (en el repositorio, que es público,
-- va sin el correo de verdad).
-- Para quitarlo: delete from public.cafe_probadores where user_id = (select id from auth.users where lower(email) = lower('…'));
-- (lo jugado en las jornadas se queda: granos, reputación y niveles).

do $$
declare
  correo constant text := 'TU-CORREO@ejemplo.com';
  uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(correo);
  if uid is null then
    raise exception 'No hay ninguna cuenta con el correo %.', correo;
  end if;
  insert into public.cafe_probadores (user_id) values (uid) on conflict (user_id) do nothing;
end;
$$;

-- Para comprobarlo (debe salir la cuenta con su jornada de prueba)
select p.jornada
from public.cafe_probadores p
join auth.users u on u.id = p.user_id
where lower(u.email) = lower('TU-CORREO@ejemplo.com');
