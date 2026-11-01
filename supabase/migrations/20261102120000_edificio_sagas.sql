-- 1.64 (SPEC §64): los sets de sagas de «El edificio del puerto». Veinte muebles nuevos en el catálogo del servidor
-- (la copia de src/features/edificio/catalog.js; una prueba comprueba que coinciden). Sin esta migración, guardar un
-- piso con uno de estos muebles lo rechaza piso_valido. Migración ADITIVA y re-ejecutable: solo añade filas a
-- piso_catalogo (o las deja como en el cliente si ya estaban). La aplica Francisco en el SQL Editor (desarrollo
-- primero). Probada con PGlite (src/features/edificio/__tests__/edificio.rls.test.js).
--
-- Los muebles son objetos corrientes que evocan cada saga (nombre propio y un guiño «Para quien leyó…»), sin portadas,
-- logos, emblemas ni diseños oficiales.
insert into public.piso_catalogo (id, capa, w, d, sup, tonos) values
  ('brasero', 'suelo', 1, 1, null, 2),
  ('silla-montar', 'suelo', 1, 1, null, 3),
  ('huevo-dragon', 'encima', 1, 1, null, 3),
  ('dagas-pared', 'pared', 1, null, null, 3),
  ('farol-bruma', 'suelo', 1, 1, null, 3),
  ('viales', 'encima', 1, 1, null, 2),
  ('monedas', 'encima', 1, 1, null, 3),
  ('ventana-ceniza', 'pared', 2, null, null, 3),
  ('barra-posada', 'suelo', 3, 1, 1.3, 3),
  ('barril', 'suelo', 1, 1, 1, 3),
  ('laud', 'pared', 1, null, null, 3),
  ('espada-pared', 'pared', 2, null, null, 3),
  ('rosal', 'suelo', 1, 1, null, 3),
  ('arco-rosas', 'suelo', 2, 1, null, 3),
  ('mascara', 'pared', 1, null, null, 3),
  ('ventana-estrellas', 'pared', 2, null, null, 3),
  ('esferas', 'encima', 1, 1, null, 3),
  ('lampara-gemas', 'suelo', 1, 1, null, 3),
  ('atril', 'suelo', 1, 1, null, 3),
  ('cuadro-tormenta', 'pared', 2, null, null, 3)
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos;
