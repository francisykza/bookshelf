-- 1.69 (SPEC §69): segunda tanda de muebles de «El edificio del puerto» (encargo de Francisco del 1-11-2026, «más
-- muebles»). Diecisiete muebles nuevos en el catálogo del servidor (la copia de src/features/edificio/catalog.js; una
-- prueba comprueba que coinciden) y los sobres de la temporada 1 los traen según su tipo. No cambian precios,
-- probabilidades ni el pity. Sin esta migración, guardar un piso con uno de estos muebles lo rechaza piso_valido.
-- Migración ADITIVA y re-ejecutable: añade filas a piso_catalogo (o las deja como en el cliente si ya estaban) y
-- redefine piso_sobre con las listas nuevas. No borra datos. La aplica Francisco en el SQL Editor. Probada con PGlite
-- (src/features/edificio/__tests__/tienda.rls.test.js).

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('puf', 'suelo', 1, 1, null, 4, 'comun'),
  ('mecedora', 'suelo', 1, 1, null, 3, 'poco-comun'),
  ('escritorio', 'suelo', 2, 1, 1.22, 3, 'comun'),
  ('comoda', 'suelo', 2, 1, 1.3, 3, 'comun'),
  ('baul', 'suelo', 2, 1, 0.86, 3, 'comun'),
  ('velas', 'encima', 1, 1, null, 3, 'comun'),
  ('farol', 'suelo', 1, 1, null, 3, 'poco-comun'),
  ('cactus', 'encima', 1, 1, null, 3, 'comun'),
  ('monstera', 'suelo', 1, 1, null, 3, 'comun'),
  ('pecera', 'encima', 1, 1, null, 3, 'raro'),
  ('globo', 'encima', 1, 1, null, 3, 'poco-comun'),
  ('tocadiscos', 'encima', 1, 1, null, 3, 'poco-comun'),
  ('taza', 'encima', 1, 1, null, 4, 'comun'),
  ('estante-pared', 'pared', 2, null, null, 3, 'comun'),
  ('espejo', 'pared', 1, null, null, 3, 'comun'),
  ('mapa', 'pared', 2, null, null, 3, 'poco-comun'),
  ('alfombra-rayas', 'alfombra', 2, 3, null, 3, 'comun')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Los sobres de la temporada (los mismos que SOBRES en economy.js): igual que en la 1.67, con los muebles nuevos
create or replace function public.piso_sobre(sobre text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case sobre
    when 'salon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('sillon', 'sofa', 'silla', 'banco', 'mesa-baja', 'mesa', 'mesilla', 'estanteria', 'cama',
        'puf', 'mecedora', 'escritorio', 'comoda', 'baul'))
    when 'luces' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('lampara-pie', 'estufa', 'lampara-mesa', 'ventana', 'cuadro', 'reloj', 'guirnalda',
        'velas', 'farol', 'estante-pared', 'espejo', 'mapa'))
    when 'balcon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'libros', 'radio', 'tetera', 'gato', 'alfombra', 'alfombra-redonda',
        'cactus', 'monstera', 'pecera', 'globo', 'tocadiscos', 'taza', 'alfombra-rayas'))
    when 'coleccion' then jsonb_build_object('coste1', 25, 'coste5', 110, 'raro', 0.15, 'poco', 0.35, 'muebles', null)
    else null
  end;
$$;
