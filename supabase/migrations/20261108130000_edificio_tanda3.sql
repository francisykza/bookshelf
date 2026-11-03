-- 1.78 · Tanda 3 del edificio (encargo de Francisco del 3-11-2026: «otra tanda de muebles de todas las rarezas,
-- incluida una mascota» y «una tanda más de ropa con un conjunto a parte que tenga efectos»).
--   · Nueve muebles nuevos en piso_catalogo (los mismos que en src/features/edificio/catalog.js; una prueba lo
--     comprueba): tres comunes, tres poco comunes, dos raros (uno es la mascota, el perrito en su cojín) y un místico
--     (el búho de las constelaciones, que solo sale en «Edición coleccionista», como los demás místicos).
--   · Los sobres de la temporada los traen según su tipo (las mismas listas que SOBRES en economy.js). No cambian
--     precios, probabilidades ni el pity.
--   · Ropa: tres jerseys, dos pantalones y tres complementos más, que se ganan con las misiones del día después de
--     los de antes (lo ya ganado no cambia). El conjunto «Noche estrellada» (jersey 14, pantalón 8 y la capa) llega
--     al final. piso_personaje_valido admite los nuevos valores y piso_prendas_orden los añade al final.
-- Necesita las migraciones de la tienda (1.67), la tanda 2 (1.69), el personaje y las misiones (1.69 y 1.70) y los
-- místicos en los sobres (1.73). ADITIVA y re-ejecutable: añade filas y redefine funciones. No borra datos ni cambia
-- políticas. La aplica Francisco en el SQL Editor. Probada con PGlite (src/features/edificio/__tests__/).

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  ('perchero', 'suelo', 1, 1, null, 3, 'comun'),
  ('cesto-mantas', 'suelo', 1, 1, null, 3, 'comun'),
  ('jarron', 'encima', 1, 1, null, 3, 'comun'),
  ('chimenea', 'suelo', 2, 1, 1.3, 3, 'poco-comun'),
  ('piano', 'suelo', 2, 1, 1.4, 3, 'poco-comun'),
  ('tapiz', 'pared', 2, null, null, 3, 'poco-comun'),
  ('telescopio', 'suelo', 1, 1, null, 3, 'raro'),
  ('perrito', 'suelo', 1, 1, null, 3, 'raro'),
  ('buho-estrellas', 'suelo', 1, 1, null, 1, 'mistico')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Los sobres de la temporada, como en 20261107120000_edificio_misticos_sobres.sql, con los muebles nuevos
create or replace function public.piso_sobre(sobre text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case sobre
    when 'salon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('sillon', 'sofa', 'silla', 'banco', 'mesa-baja', 'mesa', 'mesilla', 'estanteria', 'cama',
        'puf', 'mecedora', 'escritorio', 'comoda', 'baul', 'piano'))
    when 'luces' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('lampara-pie', 'estufa', 'lampara-mesa', 'ventana', 'cuadro', 'reloj', 'guirnalda',
        'velas', 'farol', 'estante-pared', 'espejo', 'mapa', 'chimenea', 'tapiz'))
    when 'balcon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'libros', 'radio', 'tetera', 'gato', 'alfombra', 'alfombra-redonda',
        'cactus', 'monstera', 'pecera', 'globo', 'tocadiscos', 'taza', 'alfombra-rayas',
        'perchero', 'cesto-mantas', 'jarron', 'telescopio', 'perrito'))
    when 'coleccion' then jsonb_build_object('coste1', 25, 'coste5', 110, 'raro', 0.14, 'poco', 0.35, 'mistico', 0.01,
      'legendario', 0.25, 'muebles', null)
    else null
  end;
$$;

-- El aspecto válido (lo mismo que validateAvatar en actor.js), con la ropa nueva
create or replace function public.piso_personaje_valido(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) = 7
    and (select bool_and(k in ('piel', 'pelo', 'colorPelo', 'jersey', 'pantalon', 'gafas', 'complemento')) from jsonb_object_keys(p) k)
    and jsonb_typeof(p->'piel') = 'number' and (p->>'piel') in ('0', '1', '2', '3', '4')
    and jsonb_typeof(p->'pelo') = 'string' and (p->>'pelo') in ('corto', 'melena', 'mono', 'rizos', 'largo', 'rapado')
    and jsonb_typeof(p->'colorPelo') = 'number' and (p->>'colorPelo') in ('0', '1', '2', '3', '4', '5', '6', '7')
    and jsonb_typeof(p->'jersey') = 'number' and (p->>'jersey') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14')
    and jsonb_typeof(p->'pantalon') = 'number' and (p->>'pantalon') in ('0', '1', '2', '3', '4', '5', '6', '7', '8')
    and jsonb_typeof(p->'gafas') = 'boolean'
    and jsonb_typeof(p->'complemento') = 'string' and (p->>'complemento') in ('ninguno', 'bufanda', 'gorro', 'boina', 'auriculares', 'flor', 'sombrero', 'gorra', 'capa')
  )
$$;

-- Las prendas que se ganan, en orden (la misma lista que PRENDAS en actor.js): las de antes y, al final, las nuevas
create or replace function public.piso_prendas_orden()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['complemento:bufanda', 'jersey:8', 'complemento:gorro', 'pantalon:5', 'colorPelo:6', 'jersey:9', 'complemento:boina', 'jersey:10', 'pantalon:6', 'complemento:auriculares', 'colorPelo:7', 'jersey:11', 'complemento:flor',
    'jersey:12', 'complemento:sombrero', 'pantalon:7', 'jersey:13', 'complemento:gorra', 'jersey:14', 'pantalon:8', 'complemento:capa'];
$$;
