-- La lista de precios de la ropa de la planta (`piso_almacen_ropa`, de 20261128120000_almacen_ropa.sql) quedó llamable por
-- cualquiera, también sin sesión: la migración no le quitaba el permiso público. No enseña nada que no esté ya en la app (los
-- mismos precios que `ROPA_TIENDA`), pero como las demás funciones internas, solo la usan otras del servidor
-- (`piso_almacen_ropa_comprar` y el aviso de `pisos_personaje_prendas`, que se ejecutan como su dueño). La aplica Francisco
-- en el SQL Editor, después de 20261129120000_almacen_especiales.sql. No cambia ningún dato.
revoke all on function public.piso_almacen_ropa() from public, anon, authenticated;
