-- Las colecciones del ala nueva del Almacén del Puerto (1.149, SPEC §149; encargo de Francisco del 26-11-2026: «sets de muebles
-- nuevos, lo más acogedores y atractivos que puedas, y una colección extra premium»). La aplica Francisco en el SQL Editor,
-- después de 20261228120000_cuenta_borrar.sql. Sin ella, el almacén enseña las cuatro habitaciones, pero el servidor no conoce
-- sus muebles y no los vende (la compra no se hace y no se cobra nada).
--
-- - Veinte muebles nuevos en cuatro talleres, uno por habitación del ala nueva: «Lumbre y Lana», «Cristal y Helecho»,
--   «Buhardilla de Octubre» y la colección premium «Medianoche». Completar un taller da su placa y los 30 sellos de siempre.
-- - Las cuatro son habitaciones especiales, como «Capa y Antifaz»: lo común cuesta 40 y lo poco común 80, en el almacén y en la
--   tienda, y nunca se rebajan (ni ofertas ni albarán).
-- - La colección premium (decisión de Francisco, el modelo menos agresivo): la ve todo el mundo y se compra con tickets a precios
--   muy altos (`piso_premium`); quien sea suscriptor la tendría mucho más barata. La suscripción aún no existe: el único punto que
--   lo dice es `piso_es_suscriptor()`, que hoy siempre responde que no (su gemelo en la app es src/domain/suscripcion.js).
-- - Los sobres siguen cerrados por la reforma: no cambia ningún sorteo, ninguna recompensa ni el pity.
-- - El sorteo de los sobres (para cuando se reabran) deja fuera los muebles de las habitaciones especiales, como la app.
-- No se borra ni se cambia ningún dato: filas nuevas del catálogo y funciones.

insert into public.piso_catalogo (id, capa, w, d, sup, tonos, rareza) values
  -- Lumbre y Lana
  ('hogar-ladrillo', 'suelo', 2, 1, null, 3, 'poco-comun'),
  ('orejero', 'suelo', 2, 2, null, 3, 'poco-comun'),
  ('lenero', 'suelo', 1, 1, null, 3, 'comun'),
  ('alfombra-escocesa', 'alfombra', 3, 2, null, 3, 'comun'),
  ('lamina-nevada', 'pared', 2, null, null, 3, 'comun'),
  -- Cristal y Helecho
  ('banco-forja', 'suelo', 2, 1, null, 3, 'poco-comun'),
  ('escalera-macetas', 'suelo', 2, 1, null, 3, 'poco-comun'),
  ('limonero', 'suelo', 1, 1, null, 3, 'comun'),
  ('lampara-jaula', 'suelo', 1, 1, null, 3, 'comun'),
  ('ventanal-invernadero', 'pared', 2, null, null, 3, 'poco-comun'),
  -- Buhardilla de Octubre
  ('nido-lectura', 'suelo', 2, 2, null, 3, 'poco-comun'),
  ('escalera-mantas', 'suelo', 1, 1, null, 3, 'comun'),
  ('calabazas', 'suelo', 1, 1, null, 3, 'comun'),
  ('lampara-seta', 'suelo', 1, 1, null, 3, 'poco-comun'),
  ('guirnalda-hojas', 'pared', 3, null, null, 3, 'comun'),
  -- Medianoche, la colección premium (raros con su precio propio: no salen en sobres)
  ('chester-terciopelo', 'suelo', 3, 2, null, 3, 'raro'),
  ('biblioteca-escalera', 'suelo', 2, 1, null, 3, 'raro'),
  ('candelabro-pie', 'suelo', 1, 1, null, 3, 'raro'),
  ('globo-celeste', 'suelo', 1, 1, null, 3, 'raro'),
  ('vidriera-luna', 'pared', 2, null, null, 3, 'raro'),
  -- Sus placas: premios, como las de los otros talleres (no se venden, no salen en sobres, no se regalan ni se reciclan)
  ('placa-lumbre', 'pared', 1, null, null, 1, 'especial'),
  ('placa-invernadero', 'pared', 1, null, null, 1, 'especial'),
  ('placa-octubre', 'pared', 1, null, null, 1, 'especial'),
  ('placa-medianoche', 'pared', 1, null, null, 1, 'especial')
on conflict (id) do update set capa = excluded.capa, w = excluded.w, d = excluded.d, sup = excluded.sup, tonos = excluded.tonos, rareza = excluded.rareza;

-- Los talleres, ahora once (los mismos que TALLERES en talleres.js; una prueba lo comprueba)
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
    jsonb_build_object('id', 'heroes', 'muebles', jsonb_build_array('sillon-capa', 'estanteria-comics', 'foco-heroe', 'maniqui-capa', 'cartel-vinetas', 'neon-rayo')),
    jsonb_build_object('id', 'lumbre', 'muebles', jsonb_build_array('hogar-ladrillo', 'orejero', 'lenero', 'alfombra-escocesa', 'lamina-nevada')),
    jsonb_build_object('id', 'invernadero', 'muebles', jsonb_build_array('banco-forja', 'escalera-macetas', 'limonero', 'lampara-jaula', 'ventanal-invernadero')),
    jsonb_build_object('id', 'octubre', 'muebles', jsonb_build_array('nido-lectura', 'escalera-mantas', 'calabazas', 'lampara-seta', 'guirnalda-hojas')),
    jsonb_build_object('id', 'medianoche', 'muebles', jsonb_build_array('chester-terciopelo', 'biblioteca-escalera', 'candelabro-pie', 'globo-celeste', 'vidriera-luna'))
  );
$$;

-- Las habitaciones especiales: la de superhéroes y las cuatro del ala nueva (las mismas que HABITACIONES_ESPECIALES en economy.js)
create or replace function public.piso_de_habitacion_especial(mueble text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(mueble = any (array(
    select jsonb_array_elements_text(t -> 'muebles')
      from jsonb_array_elements(public.piso_talleres()) t
     where t ->> 'id' in ('heroes', 'lumbre', 'invernadero', 'octubre', 'medianoche')
  )), false);
$$;
revoke all on function public.piso_de_habitacion_especial(text) from public, anon;
grant execute on function public.piso_de_habitacion_especial(text) to authenticated;

-- ¿Es suscriptor quien llama? El único sitio del servidor que lo sabe. La suscripción aún no existe: siempre no. Cuando exista,
-- se cambia solo esta función (por ejemplo, mirando una tabla de suscripciones con auth.uid()) y el catálogo no se toca.
create or replace function public.piso_es_suscriptor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;
revoke all on function public.piso_es_suscriptor() from public, anon;
grant execute on function public.piso_es_suscriptor() to authenticated;

-- Los precios de la colección premium: el de siempre y el de suscriptor (los mismos que PREMIUM en economy.js)
create or replace function public.piso_premium()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'chester-terciopelo', 'precio', 600, 'socio', 240),
    jsonb_build_object('id', 'biblioteca-escalera', 'precio', 550, 'socio', 220),
    jsonb_build_object('id', 'candelabro-pie', 'precio', 300, 'socio', 120),
    jsonb_build_object('id', 'globo-celeste', 'precio', 350, 'socio', 140),
    jsonb_build_object('id', 'vidriera-luna', 'precio', 400, 'socio', 160)
  );
$$;
revoke all on function public.piso_premium() from public, anon;
grant execute on function public.piso_premium() to authenticated;

-- El precio de siempre de un mueble (sin ofertas ni albarán): lo premium, el suyo (el de suscriptor si lo es); lo demás, el de su
-- rareza, el doble si es de una habitación especial. Nulo si no se vende. Lo retirado se comprueba aparte, como antes.
create or replace function public.piso_precio_mueble(mueble text)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when c.id is null or c.saga is not null then null
    when p.x is not null then (case when public.piso_es_suscriptor() then (p.x ->> 'socio')::integer else (p.x ->> 'precio')::integer end)
    else public.piso_precio(c.rareza) * (case when public.piso_de_habitacion_especial(c.id) then 2 else 1 end)
  end
  from (select 1) uno
  left join public.piso_catalogo c on c.id = mueble
  left join lateral (select x from jsonb_array_elements(public.piso_premium()) x where x ->> 'id' = mueble limit 1) p on true;
$$;
revoke all on function public.piso_precio_mueble(text) from public, anon;
grant execute on function public.piso_precio_mueble(text) to authenticated;

-- El sorteo de los sobres (cerrados por la reforma; esto vale para cuando se reabran): nunca trae los muebles de las
-- habitaciones especiales, como ya hace la app (`deSobre` en economy.js deja fuera todo lo que tiene colección). Sin esto, un
-- sobre sin raros propios podría sacar un mueble de la colección premium. Lo demás, igual que en 20261110120000_hotel_casino.sql.
create or replace function public.piso_al_azar(r text, lista jsonb)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(
    (select k.id from public.piso_catalogo k
      where k.rareza = r and k.saga is null and k.id <> all (public.piso_casino_exclusivos()) and not public.piso_de_habitacion_especial(k.id)
        and (lista is null or lista ? k.id)
      order by random() limit 1),
    (select k.id from public.piso_catalogo k
      where k.rareza = r and k.saga is null and k.id <> all (public.piso_casino_exclusivos()) and not public.piso_de_habitacion_especial(k.id)
      order by random() limit 1)
  );
$$;
revoke all on function public.piso_al_azar(text, jsonb) from public, anon, authenticated;
