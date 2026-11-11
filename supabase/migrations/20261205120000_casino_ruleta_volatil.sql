-- Arreglo de la ruleta del casino (1.112, 11-11-2026; Francisco: «no puedo girar la ruleta todavía»). La aplica Francisco en
-- el SQL Editor, después de 20261204120000_casino_premios_nuevos.sql.
--
-- piso_casino_ruleta(dia) se declaró `stable`, y PostgREST ejecuta las funciones `stable` en una transacción de solo
-- lectura. Pero llama a piso_yo(), que asegura la fila del inventario con un `insert`: en producción fallaba siempre
-- («cannot execute INSERT in a read-only transaction») y la app lo enseñaba como «La ruleta aún no gira: falta prepararla
-- en el servidor». Las pruebas con PGlite no pasan por PostgREST y no lo vieron (ahora lo prueba
-- rpc-solo-lectura.rls.test.js).
-- Solo cambia la volatilidad de esa función; no toca su código, sus permisos ni ningún dato. Re-ejecutable.

alter function public.piso_casino_ruleta(date) volatile;
