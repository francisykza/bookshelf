-- La colección de superhéroes del Almacén del Puerto (1.101, SPEC §101; encargo de Francisco del 9-11-2026, CLAUDE.md «La Lonja»).
-- La aplica Francisco en el SQL Editor, después de 20261125120000_almacen_ofertas.sql. Sin ella, el almacén y la tienda no
-- pueden vender estos muebles (el servidor no los conoce) y la colección no se puede completar.
--
-- - Seis muebles nuevos, originales del género (capas, antifaces, viñetas, un foco y un rayo de neón; nunca personajes,
--   emblemas ni logos). Se venden con el precio de siempre de su rareza (común 20, poco común 40), en la tienda y en el
--   almacén, y entran en las ofertas como cualquier otro. Los sobres siguen cerrados por la reforma: no cambia ningún sorteo.
-- - Son el taller nuevo «Capa y Antifaz»: completarlo da su placa y los 30 sellos de siempre, como los demás talleres.
-- No se borra ni se cambia ningún dato.

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('sillon-capa', 'suelo', 2, 2, null, 3, 'poco-comun'),
  ('estanteria-comics', 'suelo', 2, 1, null, 3, 'comun'),
  ('foco-heroe', 'suelo', 1, 1, null, 3, 'poco-comun'),
  ('maniqui-capa', 'suelo', 1, 1, null, 3, 'poco-comun'),
  ('cartel-vinetas', 'pared', 2, null, null, 3, 'comun'),
  ('neon-rayo', 'pared', 1, null, null, 3, 'poco-comun'),
  -- Su placa: un premio, como las de los otros talleres (no se vende, no sale en sobres, no se regala ni se recicla)
  ('placa-heroes', 'pared', 1, null, null, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Los talleres, ahora siete (los mismos que TALLERES en talleres.js; una prueba lo comprueba)
create or replace function public.piso_talleres()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'ebanisteria', 'muebles', jsonb_build_array('silla', 'mesa', 'mesa-baja', 'mesilla', 'comoda', 'baul', 'escritorio', 'estanteria', 'piano')),
    jsonb_build_object('id', 'tapiceria', 'muebles', jsonb_build_array('sillon', 'banco', 'puf', 'sofa', 'mecedora', 'cama', 'alfombra', 'alfombra-redonda', 'alfombra-rayas', 'cesto-mantas')),
    jsonb_build_object('id', 'faro', 'muebles', jsonb_build_array('lampara-pie', 'lampara-mesa', 'velas', 'estufa', 'farol', 'chimenea', 'guirnalda')),
    jsonb_build_object('id', 'vivero', 'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'cactus', 'monstera', 'jarron', 'pecera', 'gato')),
    jsonb_build_object('id', 'almoneda', 'muebles', jsonb_build_array('globo', 'telescopio', 'mapa', 'reloj', 'radio', 'tocadiscos', 'tapiz')),
    jsonb_build_object('id', 'menaje', 'muebles', jsonb_build_array('libros', 'tetera', 'taza', 'perchero', 'ventana', 'cuadro', 'estante-pared', 'espejo')),
    jsonb_build_object('id', 'heroes', 'muebles', jsonb_build_array('sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo'))
  );
$$;
