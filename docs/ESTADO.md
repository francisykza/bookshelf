# Estado del proyecto y bitácora de sesiones

Documento compartido entre las cuentas que trabajan en BookShelf. **Al empezar**, leerlo entero. **Al terminar**
cada sesión (o cada bloque), actualizar «Estado actual» si cambia y añadir una entrada arriba del todo en la
bitácora. Es lo que permite a la siguiente sesión retomar sin repetir trabajo ni deshacer decisiones.

## Estado actual

- **Aprobada por Francisco («Sí, haz el commit»), con commit en la rama `1.90-escritorio-puerto` y sin publicar: 1.128.0** (2026-11-13, §128). La lista de Francisco tras el tostadero («Sí, empieza»): la «!» roja de lo
  nuevo (Decorar, tienda, opciones de la barra y sitios nuevos; se va al verlo), la música sin petardeo, los sonidos igualados
  (medidos), la barra despejada (comanda plegada en el gesto, el excéntrico con un acertijo, la palanca libre), la cámara hacia
  el cliente y las portadas que faltaban buscadas por su ISBN en Google Books. **Sin migración**. Evidencias en
  `qa-report/cafe-ajustes/`. Publicar (subir a `main`), solo cuando lo pida.
- **Publicada en producción: 1.127.0** (2026-11-13, §127; «Aplicar migración y publicar»; `main` avanza sin forzar desde `b6453ac`; migración `20261216120000_cafe_tostadero.sql` aplicada). El café-librería del bajo,
  **bloque 6b, el tostadero** (cifras aprobadas, «Sí, el tostadero»): nivel 7 desde 15.000, el sótano de 7 × 5 con el tostador,
  un saco al día recogido tirando de la trampilla del tambor (5 tazas de «tueste de la casa», +3 granos y +4 de reputación cada
  una), 90 tickets, 9 clientes, 54 huecos, saco de arpillera y estantería de latas. **Migración aplicada** el 13-11-2026:
  `20261216120000_cafe_tostadero.sql` (va después de la del probador). Evidencias en `qa-report/cafe-tostadero/`.
  Las interpretaciones de `cafe-libreria.md` §14.8 quedan aceptadas con la aprobación. 
- **Publicada en producción: 1.126.0** (2026-11-13, §126; `main` avanzó sin forzar de `cbb6d22` a `28d3f1c` y `/sw.js` de producción ya sirve v1.126.0; migración `20261215120000_cafe_probador.sql` aplicada y el script del probador con las dos cuentas, la de Francisco y la de su pareja). Tras probar la 1.125 en producción («esta genial»): la música
  propia del café (sintetizada, jazz lento de café; calla la de Sonido mientras estás dentro), un sonido por cada acción del
  café, la barra con una franja ligera y el cómo de cada gesto en una notita junto al objeto, y Pilar sin hablar de los sobres
  ni de lo de antes; portadas reales en las fichas y en el escaparate de tu café (pedidas el 13-11-2026); jornadas de prueba
  para la cuenta de Francisco. Migración y script del probador, aplicados. Evidencias en `qa-report/cafe-sonido/` y muestras de audio en `qa-report/v1126/`.
  Sin publicar: subir a `main` solo cuando él lo pida. Migración y script, sin aplicar (los aplica él).
- **Publicada en producción: 1.125.0** (2026-11-13; «vamos a aplicar todas las migraciones pendientes y fusionar con main lo que queda»; `main` avanzó sin forzar de `3d9bf6d` a `cbb6d22` y `/sw.js` de producción ya sirve v1.125.0). Lleva de la 1.119 a la 1.125: el café-librería del bajo (bloques 1, 2, 3, 4a, 4b y 6a), la limusina a la vista y los carteles de la fachada. **Las cinco migraciones del café, aplicadas** el 13-11-2026 (ver la bitácora). Las líneas de abajo de la 1.119 a la 1.125 son su historia; lo que decían «sin commit» o «sin aplicar» ya no vale.
- **Aprobada por Francisco («Sí, haz el commit»), con commit en la rama `1.90-escritorio-puerto` y sin publicar: 1.125.0** (2026-11-13, §125). El café-librería del bajo, **bloque 6a** (cifras aprobadas, «Sí, esas cifras»): el nivel 6, «La bodega», con la trampilla tras la barra, la cámara que baja, la cuadrícula 5 × 5 del sótano con sus asientos y clientes, Decorar en dos plantas y tres muebles nuevos. **Migración nueva sin aplicar**: `20261214120000_cafe_sotano.sql` (va después de la del bloque 4b). Evidencias en `qa-report/cafe-bodega/`. Las interpretaciones de `cafe-libreria.md` §14.7 quedan aceptadas con la aprobación. Siguiente: 6b (el tostadero), solo con su visto bueno.
- **Aprobada por Francisco («Me valen, commit»), con commit en la rama `1.90-escritorio-puerto` y sin publicar: 1.124.0** (2026-11-12, §124). Los carteles de la fachada, según la maqueta de Francisco: placas de madera, esmalte y latón para las viviendas (libre, tuya y de un vecino), el rótulo colgante del café con «Se traspasa» y la placa azul del Gran Hotel. Solo visual; ni migraciones ni datos. Capturas en `qa-report/placas/`.
- **En la rama `1.90-escritorio-puerto`, sin publicar: 1.123.0** (aprobada por Francisco con la limusina movida; commit pedido por él) (2026-11-12, §123). El café-librería del bajo, **bloque 4b** (cifras aprobadas, «Sí, esas cifras»): el ala lateral del nivel 4 (pared de la izquierda abierta, cuadrícula 9 × 9, vainilla rascando la vaina), la terraza y el escaparate del nivel 5 (acera con toldo y farolillos, tres leídos de cara a la calle y visibles desde la fachada, placa con el nombre, café con hielo agitando la coctelera), clientes según los asientos (6 y 7, nunca menos de 5, con aviso de Pilar) y ocho muebles nuevos. **Migración nueva sin aplicar**: `20261213120000_cafe_ampliacion.sql` (va después de la del bloque 4a). Evidencias en `qa-report/cafe-ampliacion/`. Interpretaciones por confirmar en `cafe-libreria.md` §13 (el ala a la izquierda, 32 cosas, leche fría).
- **Aprobada por Francisco, con commit en la rama `1.90-escritorio-puerto` y sin publicar: 1.122.0** (2026-11-12, §122; «Sí, lo apruebo», con las interpretaciones de `cafe-libreria.md` §12). El café-librería del bajo, **bloque 4a**: subir de nivel con el cartel y un recorrido de cámara, tickets del nivel y del día, tres hitos por nivel, la tienda del café en Decorar (nueve muebles nuevos), el fondo del local en los niveles 2 (ventanal al puerto) y 3 (estanterías hasta el techo y chimenea), la cuadrícula tres filas más honda desde el nivel 2, la carta por días y en la barra el chocolate (cazo y molinillo) y la nata (bol y varillas). **Migración nueva sin aplicar**: `20261212120000_cafe_niveles.sql` (va después de las dos del café). Evidencias en `qa-report/cafe-niveles/`. Siguiente: el bloque 4b, ya con el local que crece por plantas (§12.1), tras aprobar sus cifras.
- **En revisión, con commit en la rama `1.90-escritorio-puerto` (sin subir): 1.121.0** (2026-11-12, §121). El café-librería del bajo, bloque 3, rehecho tras la revisión de Francisco: la barra 3D con la receta de cuatro elecciones, llevar la taza a la mesa, el libro como extra en tres fichas, estrellas y el excéntrico del día. **Migración nueva sin aplicar**: `20261211120000_cafe_clientes.sql`. Evidencias en `qa-report/cafe-clientes/`. **Encima, sin commit (§121.1, 12-11-2026)**: preparar el café con un gesto y un objeto por paso (manivela, apisonar, palanca, tetera, colador, vapor, verter con dibujo, canela y miel), con sonidos propios; sin cambios de economía, recetas ni servidor.
- **En revisión, sin commit: 1.120.1** (2026-11-12, §120.1). La interfaz del café, más de videojuego (solo aspecto).
- **En revisión, sin commit: 1.120.0** (2026-11-12, §120). El café-librería del bajo, bloque 2: las llaves, el nombre, el rincón y Decorar. **Migración nueva sin aplicar**: `20261210120000_cafe_local.sql`. Evidencias en `qa-report/cafe-decorar/`.
- **En revisión, sin commit: 1.119.0** (2026-11-12, §119). El café-librería del bajo, bloque 1: el local vacío en 3D en lugar de la tienda. Evidencias en `qa-report/cafe/`. Falta que Francisco lo revise antes del bloque 2.
- **Publicada en producción: 1.118.0** (2026-11-11, §118; «Sí, súbela»; `main` avanzó sin forzar de `4ff1399` a `e8cead7` y `/sw.js` de producción ya sirve v1.118.0). La sala de lectura, bloque c: la placa del sofá por pareja de amigos (minutos y libros juntos; sin rachas; latón, plata desde 10 h y oro desde 50 h; en el panel y atornillada al respaldo del sofá) y los gestos cerrados (siete, sin texto libre) a quien lee contigo y a tu amigo en la cita. Francisco aprobó la entrega (12-11-2026, «Sí, a la migración»). **Migración `20261207120000_sala_parejas.sql` aplicada** el 12-11-2026 (SQL Editor, SHA-256 comprobado, Francisco pulsó «Run»; 42501 al anónimo). Evidencias en `qa-report/sala-placa/`. Commit `e8cead7` («Sí, haz el commit») y publicada el 12-11-2026 («Sí, súbela»).
- Anterior: **1.117.0** (2026-11-11, §116 y §117; «Sí, súbela»; `main` avanzó sin forzar de `0d3dde5` a `5e14874` y `/sw.js` de producción ya sirve v1.117.0). La sala de lectura, bloques a y b en un solo commit. Bloque b: la cita de lectura con un amigo en el sofá para dos (invitar, aviso en el edificio, reloj común del servidor, «habéis leído juntos»). **Migración `20261206120000_sala_citas.sql` aplicada** el 2026-11-11 (SQL Editor, SHA-256 comprobado, Francisco pulsó «Run»; 42501 al anónimo). Aprobada por Francisco tras revisar capturas y vídeos (`qa-report/sala-cita/`). Sin probar entre dos cuentas reales ni en móviles reales. Siguiente: el bloque c (placa del sofá sin rachas y gestos cerrados), solo con su visto bueno.
- Con ella, **1.116.0** (2026-11-11, §116; publicada en el mismo commit que la 1.117). La sala de lectura en 3D, bloque a: biblioteca de noche, tu sillón con tu libro en la mesita, el reloj de pie del Pomodoro y la librería común con sus lomos; sin WebGL, la sala de siempre. Sin migraciones. Aprobada por Francisco tras revisar capturas y vídeos (`qa-report/sala3d/`). Sin probar en móviles reales.
- Anterior: **1.115.0** (2026-11-11, §115; `main` avanzó sin forzar de `2446b2a` a `6f148a6` y `/sw.js` de producción ya sirve v1.115.0). «Exteriores en 3D», bloque 3: la fachada del Gran Hotel es la plaza del muelle en 3D (gente con cuerpo, neón, focos que barren, plaza mojada); se baja de la limusina y se anda hasta la puerta; sin WebGL, la fachada 2D y el viaje de siempre. Sin migraciones. Aprobada por Francisco tras revisar vídeo y capturas. Sin probar en móviles reales.
- Anterior: **1.114.0** (2026-11-11, §114; `main` avanzó sin forzar de `b965882` a `6281864` y `/sw.js` de producción ya sirve v1.114.0). «Exteriores en 3D», bloque 2: salir a pie del piso a la calle (la cámara anda hasta la puerta, el portal empieza en el umbral y se vuelve), y a la limusina y la tienda andando. Sin migraciones. Sin probar en móviles reales.
- Anterior: **1.113.0** (2026-11-11, §113; `main` avanzó sin forzar a `3b97d43` y `/sw.js` de producción ya sirve v1.113.0). «Exteriores en 3D», bloque 1: el portal del edificio es la calle en 3D desde el muelle, con los botones de pisos, tienda, buzón y limusina encima; sin WebGL, la fachada 2D. Sin migraciones. Queda fuera, hasta el bloque 2, el paseo de tu personaje. Sin probar en móviles reales.
- Anterior: **1.112.0** (2026-11-11; `main` avanzó sin forzar a `c68c2a7` y `/sw.js` de producción ya sirve v1.112.0) (2026-11-11, §107 a §112). El casino del sótano en 3D, bloques a, b, c, d y e: la sala, «Las 21 páginas» jugada sentado en la mesa 3D, **la ruleta de premios semanal** (decide el servidor; probabilidades a la vista; tres muebles, una prenda y, la casilla más rara, el mapache crupier: compañero legendario con modelo 3D que te sigue por el casino y se queda contigo en tu piso en primera persona) , **«Las tres chisteras»** (seguir al conejo, tres rondas al día, 1/3/6/10 fichas dentro del tope; baraja y comprueba el servidor) y **la vitrina de premios** (lo ganado expuesto en 3D, lo que falta bajo un paño con cómo se gana, doce copas de hitos y la de un amigo) con **los seis premios nuevos** (reloj de bolsillo y alfombra de rombos en la caja; chistera de mago, varita, baúl de mago y el acabado «Polvo de estrellas» por sellos de partidas perfectas de las chisteras). **Las cuatro migraciones, aplicadas** (11-11-2026, «hazlo tú»; ver la bitácora). Francisco aprobó la 1.112 con sus cifras (sellos 2/4/6/10, precios 180 y 350; 11-11-2026, «Sí, apruebo») y decidió fusionar con `main` después de las migraciones («Tras las migraciones»).
- Anterior: **1.106.0** (2026-11-10, «Sí, súbela»; `main` avanzó sin forzar a `ec553d6` y `/sw.js` de producción ya sirve v1.106.0). Antes, en la rama `1.90-escritorio-puerto`: (2026-11-10, §103 a §106). La segunda ampliación del almacén, sus cuatro bloques: escaleras mecánicas y planta de ropa con zonas, cesta y probadores; ropa propia a la venta con tickets; habitaciones más grandes con placita y el ala nueva cerrada; muebles de habitación especial al doble y sin rebajas. Francisco aprobó la entrega del bloque 4 y pidió el commit el 10-11-2026 («Sí, a commit»). **Migraciones aplicadas** (10-11-2026, «Sí, hazlo tú»): Claude pegó en el SQL Editor del proyecto `bookshelf`, en orden, `20261128120000_almacen_ropa.sql` (11.362 B, `61e56d48…8c18a325e`) y `20261129120000_almacen_especiales.sql` (9.774 B, `6e2b1f63…92b720f1`), con bytes y SHA-256 iguales a git; Francisco pulsó «Run» en cada una («Success»). Con la clave pública dan 42501 al anónimo `piso_almacen_ropa_comprar`, `piso_de_habitacion_especial`, `piso_precio_mueble`, `piso_almacen_ofertas_de`, `piso_comprar`, `piso_almacen_comprar` y `piso_almacen_pulso`. `piso_almacen_ropa()` (la lista de precios de la ropa) respondía al anónimo porque la migración no le quitaba el permiso público; lo cierra `20261130120000_almacen_ropa_permisos.sql` (675 B, `ae93492a…9d36e550`, un `revoke` a public, anon y authenticated; solo la usan funciones del servidor), pegada y comprobada igual, Francisco pulsó «Run» («Success») y ahora da 42501. `almacenRopa.rls.test.js` lo comprueba. **Sin commit**: esta migración, su prueba y este ESTADO. Sin probar en móviles reales.
- Anterior: **1.102.0** (2026-11-10, §99 a §102; `sw.js` de producción ya trae v1.102.0). El Almacén del Puerto: la Lonja en 3D con carrito, caja, «Sella el albarán» y visita con un amigo; el mercadillo de antes, dentro; el carro delante, ofertas del día y de la semana, las habitaciones con la colección de superhéroes «Capa y Antifaz» y el probador con espejo. Necesita tres migraciones, por orden (las aplica Francisco): `20261124120000_hotel_almacen.sql`, `20261125120000_almacen_ofertas.sql` y `20261126120000_almacen_heroes.sql` (el probador no lleva). Los cuatro bloques de la ampliación, hechos. Francisco pidió el commit el 10-11-2026 («Sí, a commit») tras ver las evidencias del probador y después la subida («sube a main lo que reste»). Las cuatro migraciones (las tres del almacén y la corrección del pulso) están aplicadas. Sin probar en móviles reales.
- Anterior: 1.98.0 (2026-11-09, §98; `sw.js` de producción ya trae v1.98.0). La recepción del Gran Hotel en 3D, con la cabina del ascensor por dentro; «Plano» lleva al vestíbulo isométrico. Aprobada por Francisco tras revisar capturas y vídeos («Sí, publícala»). Sin migraciones. Sin probar en móviles reales.
- Anterior: 1.96.0 (2026-11-09, §96). Tablón montado en el escritorio, con relieve y contenido nítido; dibujos en hoja o forma; biblioteca del visitante con lo expuesto y lo compartido. Migraciones `20261121120000_piso_expuestos.sql` y `20261122120000_tablon_dibujos.sql` aplicadas por Francisco el 2026-11-09 (SHA-256 comprobado). Sin probar en móviles reales; **la capa nítida del tablón se descuadra en WebKit para Windows y falta verla en un iPhone**.
- Anterior: 1.95.0 (2026-11-09, §95). Tablón libre: mueble de dos casillas, vista para mirar y «Diseñar» aparte, notas con formatos distintos y post-its. Migración `20261120120000_tablon.sql` aplicada por Francisco el 2026-11-09 (SHA-256 comprobado). Aprobada por Francisco tras revisar capturas y vídeo. Sin probar en móviles reales.
- **Anterior: 1.94.0** (2026-11-09, §94). «Visitar» abre el piso del lector y las portadas se conservan al filtrar. Migración `20261119120000_piso_visita.sql` aplicada por Francisco el 2026-11-09 (SHA-256 comprobado; el anónimo recibe «permission denied»). Aprobada por Francisco tras revisar las capturas («Sí, publícala»). Sin probar en móviles reales.
- **Anterior: 1.93.0** (2026-11-09, §93). Ficha y registro unificados, «Favoritos» y «Recuerdo» de Tu mes en libros, y Diario del ordenador como cuaderno. Sin migraciones. Aprobada por Francisco tras revisar las capturas («Sí, publícala»). Sin probar en móviles reales ni con teclado real.
- **Anterior: 1.92.0** (2026-11-08, §92). Biblioteca, ficha y «Tu mes en libros» con el acabado literario y favoritos ordenados. Sin migraciones. Aprobada por Francisco tras revisar capturas, PNG y vídeos.
- **Anterior: 1.91.1** (2026-11-08, §91.1). Ajustes del resumen del mes, páginas por día en el calendario y filtros y «Añadir libro» en la biblioteca. Sin migraciones.
- **Anterior: 1.91.0** (2026-11-08, §91). Fase 1 (scroll, audio, visitas, paredes), caché persistente de portadas y «Tu mes en libros». Sin migraciones. Aprobada por Francisco tras revisar vídeo y PNG.
- **Anterior: 1.90.0** (2026-11-08, §90). Puerto Pixel: ordenador, registro, menú, calendario, radio, diario, estadísticas, biblioteca y decorar. Aprobada por Francisco tras revisar las evidencias; sin migraciones. El mar está retirado de Sonido por ahora. Sin probar en móviles físicos ni con cuentas reales; ficha de libro y Ajustes siguen sin reestilizar.
- **Anterior: 1.89.3** (2026-11-08, §89 a §89.8). Migración `20261118120000_edificio_esenciales.sql` aplicada.
- **Versión publicada: 1.88.2** (2026-11-07, §88.4 a §88.6). Lleva la 1.88.1 (la fachada al volver de un piso, sin
  placas fuera del dibujo) y la 1.88.2 (místicos, mascota, muebles vivos y acabados en primera persona; sin estantería,
  «Biblioteca» en vez de «Ver la balda»). Viene de la rama `1.88.1-fachada`, con avance rápido de `main`, a petición de
  Francisco («súbelo», confirmado «Sí, a main»). Sin migraciones.
- **Anterior: 1.88.0** (2026-11-07, §88). La habitación de inicio es el piso del edificio de tu cuenta
  (primera persona, vista de siempre y Decorar sobre el mismo piso de Supabase) y cada libro de la estantería es el
  mismo ejemplar que el de la mesa, con su portada real y un lomo reconstruido (dicho como tal). Viene de la rama
  `1.88-habitacion-real`, con avance rápido de `main`, tras probarla Francisco en la preview («ya lo he probado,
  publícalo en main»). Sin migraciones.
- **Anterior: 1.87.0** (2026-11-07, §87). La habitación en primera persona es el inicio y su puerta lleva al
  edificio del puerto. De forma temporal, «Volver a la experiencia anterior» abre la habitación ilustrada como en la 1.86
  (Rincón 01, apagado). Incluye el registro con Deshacer, la relectura con historial y el rendimiento con 5.000 libros.
  Viene de la rama `experimento/piso-primera-persona`, con avance rápido de `main`. Sin migraciones.
- **Anterior: 1.86.0** (2026-11-04, §85 y §86, PR #10); `/sw.js` ya la trae y sus tres migraciones están aplicadas. Reseña como imagen, acabados, La estiba con su pared de premios, talleres y tablón «Se busca». `api/portada.js` responde en producción: sirve una portada de Open Library y rechaza otros hosts.
- **Anterior: 1.84.0** (2026-11-04, §84), junto con la 1.82 y la 1.83; `/sw.js` ya la trae. La Lonja de dos plantas, con su panel de mercado, sus reglas contra los
  abusos y la pesada de Remedios. Está en la rama `1.84-lonja` (PR #9), que sale de la 1.83. **Su migración
  `20261114120000_hotel_lonja.sql` está aplicada en producción** (4-11-2026).
- **Antes, 1.83.0** (2026-11-04, §83). La sala de lectura del hotel, con personajes y mascotas, la librería
  común y el saludo. Está en la rama `1.83-sala-lectura`, que sale de la 1.82. **Su migración
  `20261113120000_hotel_sala_lectura.sql` está aplicada en producción** (4-11-2026).
- **Antes, 1.82.0** (2026-11-04, §82). Avisos de mesa al momento, mesas de garbanzos, la lata con sus premios
  y el cambio de garbanzos y tickets. Está en la rama `1.82-casino-garbanzos`. **Su migración
  `20261112120000_hotel_casino_garbanzos.sql` está aplicada en producción** (4-11-2026).
- **Antes, 1.81.0** (2026-11-04, §81). El casino abre todos los días, las mesas para dos avisan en todo el
  edificio, los muebles se mueven con menos esfuerzo y ya no está la suite de la semana. Su migración
  `20261111120000_hotel_casino_arreglos.sql` está aplicada en producción. El casino del sótano del Gran Hotel tiene:
  - «Las 21 páginas»: tres manos al día sin apostar;
  - la mesa para dos con un amigo, en diferido, con fichas y garbanzos;
  - la caja, donde las fichas se cambian por ropa, muebles con efectos, el sobre del casino y el conejo de la chistera.

  Desde la rama `1.80-casino` (PR #5), con avance rápido de `main`; `/sw.js` ya trae la 1.80.0. **Su migración `20261110120000_hotel_casino.sql` está aplicada en
  producción** (3-11-2026).
- **Antes, 1.79.0** (2026-11-03, §79). Las misiones del día dan 5 tickets cuando ya tienes toda la
  ropa, la cartela de la fachada del hotel es más pequeña y está la suite de la semana del ático, decorada entre todos
  (sin votos ni pisos ajenos: decisión de Francisco). Desde la rama `1.79-suite-semana` (PR #4), con avance rápido de `main`; `/sw.js` ya trae la 1.79.0. **Sus dos migraciones
  están aplicadas en producción** (3-11-2026): `20261109120000_edificio_diarias_tickets.sql` y
  `20261109130000_hotel_suite_semana.sql`.
- **Antes, 1.78.0** (2026-11-03): el encargo del 3-11-2026 entero (§78): revelación del sobre
  que cabe en el iPhone, sin sellos de frase, correo que se lee, regalos uno al día hasta «raro» y con copias de sobra,
  vestíbulo discreto, sobres con más impacto, tanda 3 (muebles con el perrito y el búho, ropa «Noche estrellada»,
  efectos en la fachada), tu personaje (y tu compañero) andando a la tienda y a la limusina, mantener pulsado para
  mover un mueble y tu piso sin decorar al entrar con iconos claros. Desde la rama `1.78-encargo-3-11` (PR #3), con avance rápido de `main`; `/sw.js` ya trae la 1.78.0.
  **Sus dos migraciones están aplicadas en producción** (3-11-2026): `20261108120000_edificio_regalos_diarios.sql` y
  `20261108130000_edificio_tanda3.sql`.
- **Antes, 1.77.0** (2026-11-02): la fachada del Gran Hotel con la cartela al pie y el Directorio, y el
  armario como modo propio del piso con Ropa / Aspecto / Compañía y «Listo» (§77). Sin migraciones. Fusionada desde
  el PR #2 (rama `1.77-hotel-armario`); `/sw.js` ya trae la 1.77.0.
- **Antes, 1.76.0** (2026-11-02): la apertura de sobres sobre el mostrador (§76): un sobre por colección,
  de frente e inclinado en la madera, tres gestos («1 de 5» con 2 × 2), 3 + 2, y «Colocar [nombre]» al editor del
  piso. Sin migraciones. Fusionada desde el PR #1 (rama `1.76-sobres-mostrador`); `/sw.js` ya trae la 1.76.0.
- **Antes, 1.75.0** (2026-11-02): el vestíbulo del Gran Hotel con el ascensor de latón (§75; plan de
  salas en `docs/qa/gran-hotel.md` §9). Sin migraciones.
- **Antes, 1.74.0** (2026-11-02), en https://bookshelf-wine-iota.vercel.app: los menús de debajo de las
  habitaciones y la cabina del armario (§74) y la limusina negra al Gran Hotel, con el viaje por la calle del puerto y
  la fachada viva del hotel, aún sin salas (§74.4, bloque 1 del hotel). Sin migraciones nuevas.
- **Antes (1.73.0, publicada en `01585c3`)**: místicos en los sobres, melodía del edificio, pantalla completa y el
  buzón en la fachada (§73); su migración `20261107120000_edificio_misticos_sobres.sql` está aplicada en producción.
- **Antes (1.71.0, publicada)**: «más vida en el edificio», los cuatro bloques: diecisiete muebles nuevos y el arreglo del
  sobre cortado en el móvil (§69), tu personaje en el piso (§69), las misiones del día que dan ropa (§70) y vecinos con
  «me gusta» por mueble, libro de visitas y regalos (§71). **Sus cuatro migraciones ya están aplicadas en producción**
  (2-11-2026): `20261105120000_edificio_muebles_tanda2.sql`, `20261105130000_edificio_personaje.sql`,
  `20261105140000_edificio_misiones_diarias.sql` y `20261105150000_edificio_vecinos.sql`. La 1.68 publicada no las usa
  y sigue funcionando; falta subir la 1.71.
- **1.67.0**: la tienda del bajo (el antiguo videoclub con su dependienta), sus sobres por tipo y misiones con tickets
  (§67), y las figuras ocultas. Su migración `20261104120000_edificio_tienda.sql` está aplicada en producción.
- **Árbol de trabajo**: **1.65.0 y 1.66.0 publicadas** (§65 portal con vida y balda corregida; §66 inventario de
  muebles, fase 1 de `docs/qa/economia-muebles.md`, con su migración **ya aplicada en producción**). Antes, 1.64.0 publicada (sets de
  sagas) y 1.63.0: «El edificio del puerto» en la app (§63), con su migración **ya aplicada en
  producción** (1-11-2026; ver la bitácora). Antes, **1.62.0 completa (bloques 1 a 4), publicada** del paquete «salón social y radio» (§62): comunidad
  con tres pestañas y «Lectores» nuevo; sillones del salón y visita con fachada; radio del rincón; clubes con Lectura / Conversación / Miembros. Fuera de git quedan las carpetas de recursos: `material-diseno/`, `art-inbox/`
  (incluye `maqueta-146/`), `assets-source/` y `BookShelf-fotogramas-QA/`.
- **Supabase**: aplicadas en producción las migraciones de `supabase/migrations/` hasta
  `20261025150000_huellas_rincon.sql`. **Pendiente de aplicar (1.60)**: `20261031120000_avatares_nuevos.sql` (amplía la
  lista de avatares admitidos; sin ella, el servidor rechaza un perfil con uno de los seis nuevos). **Preparada (1.62,
  no aplicar aún sin decidirlo con Francisco)**: `20261031200000_radio_sintonia.sql` (`profiles.radio_station` para
  «Mostrar mi sintonía», opción que la app todavía no enseña). **Aplicada (1.63, 1-11-2026)**:
  `20261101120000_edificio_puerto.sql` (pisos, reparto en edificios, sellos). La 1.63 ya la usa. **Aplicada (1.66, 1-11-2026)**:
  `20261103120000_edificio_inventario.sql` (copias de muebles). La 1.66 ya la usa. **Aplicada (1.67, 1-11-2026)**:
  `20261104120000_edificio_tienda.sql` (tickets, tienda, sobres por tipo, reciclar).

### Últimos bloques (detalle en `SPEC.md`)

| Versión | Qué | SPEC |
| --- | --- | --- |
| 1.99.0 | El Almacén del Puerto: la Lonja en 3D (sin publicar) | §99 |
| 1.89.3 | Coherencia de visitas, estantería, zona del libro y acceso 3D (publicada) | §89.8 |
| 1.89.2 | Cámara del sillón y arquitectura del rincón (publicada) | §89.7 |
| 1.89.1 | Arranque sin la habitación antigua, noche con las lámparas reales, cámara del sillón y puesto del ordenador (preview) | §89.6 |
| 1.89.0 | Retirados sin perder datos, Esenciales, pasada del rincón y visita en primera persona (preview) | §89 |
| 1.88.2 | Místicos, mascota, muebles vivos y acabados en primera persona; «Biblioteca» sin estantería | §88.5–§88.6 |
| 1.88.1 | La fachada al volver de un piso, sin placas fuera del dibujo | §88.4 |
| 1.88.0 | La habitación de inicio es tu piso del edificio; cada libro de la estantería con su portada real (publicada) | §88 |
| 1.87.0 | La habitación en primera persona como inicio (publicada) | §87 |
| 1.86.0 | Reseña como imagen, acabados de muebles, La estiba con pared de premios, talleres y tablón «Se busca» (publicada) | §85, §86 |
| 1.79.0 | Misiones del día que dan 5 tickets con el armario completo, cartela del hotel más pequeña y la suite de la semana decorada entre todos en el ático (publicada; migraciones aplicadas) | §79 |
| 1.78.0 | El encargo del 3-11-2026: arreglos (sobre en el iPhone, sin sellos, correo leído, regalos uno al día hasta «raro»), vestíbulo discreto, sobres con más impacto, tanda 3 con mascota y conjunto «Noche estrellada», paseo hasta la tienda y la limusina, mantener pulsado para mover y la habitación primero con iconos (publicada; migraciones aplicadas) | §78 |
| 1.77.0 | La fachada del Gran Hotel entera sobre una cartela crema, planta elegida con filete y rombo de latón y el Directorio de las plantas; el armario como modo propio del piso («← Al piso» / «Armario»), Ropa, Aspecto y Compañía con vista previa que se guarda con «Listo», y el dragón posado a tu lado (publicada) | §77 |
| 1.76.0 | La apertura de sobres sobre el mostrador: un sobre por colección (expositor, selector y mostrador), de frente e inclinado en la madera, tres gestos (tira, carta que asoma con 2 × 2, 3 + 2), el sobre sale del encuadre, elegir con ✓ y «Colocar [nombre]» al editor del piso (publicada) | §76 |
| 1.75.0 | El vestíbulo del Gran Hotel por dentro: recepción con los encargos de la semana, ascensor de latón con la botonera de plantas, tablón y guardarropa (publicada) | §75 |
| 1.74.0 | Los menús de debajo de las habitaciones (balda con nombres, armario-cabina, mesita del vecino de madera) y la limusina negra delante del portal que lleva, con un viaje corto, a la fachada viva del Gran Hotel (publicada) | §74 |
| 1.73.0 | Místicos en el sobre de coleccionista (1 %, ¼ legendario, sin pity propio) con su aparición; la melodía «Dos balcones» en bucle en el edificio; el edificio a pantalla completa en el móvil; el buzón en la fachada (publicada; migración aplicada) | §73 |
| 1.72.0 | Místicos (publicada): cinco seres animados con pixelfx, dos se colocan sobre su peana y tres legendarios te acompañan detrás de tu personaje (armario «Te acompaña»); no se reciclan ni regalan; migración aplicada | §72 |
| 1.71.0 | «Más vida en el edificio» (publicada): muebles nuevos, personaje que anda y se viste, misiones del día que dan ropa, y vecinos con «me gusta» por mueble, libro de visitas y regalos | §69–71 |
| 1.68.0 | La tienda por dentro con el motor isométrico de los pisos; Sobres, Muebles y Reciclar como objetos de la escena (expositor, rincón del sillón, caja de reciclaje) con letrero y contorno; mostrador de cerca, casi de frente, para abrir sobres | §68 |
| 1.67.0 | La tienda del bajo (por dentro, el antiguo videoclub con su dependienta): tickets por las misiones, muebles a precio fijo, sobres por tipo de la temporada 1 (y uno de coleccionista más caro con más suerte), de 1 y de 5, con animación, probabilidades y pity, reciclar; figuras ocultas sin borrar datos (migración aplicada) | §67 |
| 1.66.0 | Inventario de muebles: copias por mueble, lo colocado pasa a ser tuyo, diez de inicio y «Tu mudanza» con seis comunes; la balda enseña «×N» y apaga lo agotado | §66 |
| 1.65.0 | Portal del edificio con cielo de borde a borde, llegada animada, estrellas, luces, agua y gaviota; balda sin desplazamiento de más y «En el piso» con dibujos | §65 |
| 1.63.0 | «El edificio del puerto»: la tablet del Salón pregunta entre la comunidad y el edificio; portal con seis puertas, tu piso que se decora y se guarda solo, visita a los vecinos con sellos; reparto al azar en el servidor y RLS (migración aplicada) | §63 |
| 1.62.0 | Comunidad: tres pestañas, lo tuyo desde el avatar, buscador, opiniones compactas con ficha pública y pendientes por la obra; sillones con elección y tarjeta anclada, pestaña «Salón» y visita con fachada, «Entrar», «Saltar» y vuelta al origen; radio del rincón (un reproductor, temporizador, EPUB) | §62 |
| 1.61.0 | Visita: un acceso por cosa en la habitación de llegada, etiqueta «Libros compartidos ›» en la estantería, lectura actual como libro en la mesita y «Los libros de X» como biblioteca frontal con buscador | §61 |
| 1.60.0 | Comunidad en el cuaderno de cuero según las maquetas (perfil, Mi rincón con «Ambiente y recuerdos», Entre lectores), seis avatares nuevos (migración pendiente) y libro de la cama más asentado | §60 |
| 1.59.0 | Biblioteca grande en el móvil: nada montado con la biblioteca cerrada, filas y lomos virtuales, portadas 2:3 con una descarga por URL, figuras del perfil en WebKit, nube con comprobación de fecha, visita sin pantalla oscura, aviso con caducidad real, registro con teclado, perfil social sin solapes | §59 |
| 1.58.2 | Flecha del salón que saltaba al pulsar (con movimiento reducido no navegaba) y pruebas antiguas al día | §58 |
| 1.58.1 | Hotfix de la auditoría del vídeo: figuras SVG retiradas, visita a pantalla completa sin opciones de animación, libros en las baldas, franja de la biblioteca instalada, alias en reseñas, simular sellos solo en desarrollo | §57 |
| 1.58.0 | Visita a un rincón compartido: casa, entrada en vídeo bajo demanda, habitación con los libros que comparte, pendientes y vuelta paso a paso | §56 |
| 1.57.0 | Lector EPUB: estructura sin desbordes, paneles con «Volver a la lectura» y Atrás, lectura página a página con paso entre secciones, subrayados persistentes | §55 |
| 1.56.0 | Vincular un EPUB a tu ejemplar con confirmación, posición anclada (local y sincronizada), notas con comentario, «Una pausa junto al mar» y lector con la identidad de BookShelf | §54 |
| 1.55.0 | Leer EPUB en la app: archivo solo en el dispositivo, posición y notas con la cuenta, lector diferido y límites | §53 |
| 1.54.0 | Sin edición visual ebook, baldas de la habitación con toda la biblioteca e importación de Goodreads por CSV | §52 |
| 1.53.0 | «Mi diario» del libro en tres secciones (Reseña con guardado explícito y borrador, Notas, Historial) y noche con su fondo pintado | §51 |
| 1.52.0 | Una sola habitación de día y de noche (se retira la escena nocturna de la 1.51) y libro con el contenido integrado | §50 |
| 1.51.0 | Habitación nocturna de la maqueta con su propio mapa, libro con la lectura real y controles compactos | §49 |
| 1.50.0 | Texto del libro sin cizalla, botón integrado en la página, «Mi biblioteca» en la perspectiva del mueble y «Social» más suave | §48 |
| 1.49.0 | Lectura sobre el libro pintado (sin libro superpuesto), cascos en el encuadre, «Mi biblioteca» en la balda inferior e indicadores anclados | §47 |
| 1.48.0 | Cabecera de biblioteca sin solapes, cinco filtros sin scroll, material de libros, habitación sin título, cascos visibles, carteles orientados y selector de lectura | §46 |
| 1.47.0 | Estado «Abandonado», biblioteca compacta con fila textil y herramientas en un icono, pulido de habitación, registro y Ambiente | §43–45 |
| 1.46.1 | Ventana del calendario del portátil centrada en la zona visible | §42 |
| 1.46.0 | Buscador por ISBN y elección de edición (§40), acabado físico de libros por edición (§39) y libro abierto grande en la cama con la lectura actual, «Ambiente» y «Guías» de papel, accesos «Mi biblioteca», «Mi diario» y «Rincón social», registro enfocado con «Deshacer» | §38–40 |
| 1.45.0 | Cuatro posiciones de figuras en las baldas de la habitación, detalle de figura, dos figuras nuevas («El Guardián de los Clavos», «El Maestro y el Superviviente») y pantalla del portátil | §37 |
| 1.44.0 | Materiales artesanales (terracota, lino salvia, papel crema) en biblioteca y ficha; libro con volumen 3D | §36 |
| 1.43.0 | Biblioteca de tres libros por fila, libro físico, rincón del lector y mapa sonoro | §35 |
| 1.42.0 | Ordenador como escritorio digital con seis apps e iconos de sección ilustrados | §34 |
| 1.41.x | Reflejos de la habitación sin guías; ajustes de Mi diario | §32–33 |

### Pendiente (por orden de prioridad aproximada)

- **Café, lista de Francisco del 13-11-2026 (tras el tostadero)**: hecha en la 1.128.0 (§128), con commit y sin publicar.
  Queda por confirmar con los datos de su pareja que la causa de las fichas sin portada era la de Open Library (§128.6).

- **Café-librería, traspaso a la otra cuenta (13-11-2026, tras el commit de la 1.126.0)**. Francisco seguirá con la otra
  cuenta en este punto y con el mismo método.
  - **Dónde**: carpeta `BookShelf-piso-lab` (no `bookshelf/`), rama `1.90-escritorio-puerto`, último commit «1.126.0: el
    café-librería del bajo, su música, un sonido por acción, portadas reales y jornadas de prueba». **Sin subir**: producción
    y `main` siguen en la 1.125.0. Árbol limpio salvo `.claude/` (no tocarlo ni subirlo).
  - **Lo que hay en la 1.126** (SPEC §126; reglas en `CLAUDE.md`, «Tras probar la 1.125 en producción» y «Jornadas de
    prueba»): música propia del café (`cafeMusica.js`, sin vinilo ni murmullo), un sonido por acción (`cafeSfx.js`), la barra
    en una franja ligera con la notita del gesto, Pilar sin hablar de lo de antes, portadas reales (fichas con la imagen;
    escaparate a 36 × 54 con `cafePortadas.js`) y **jornadas de prueba** solo para la cuenta de Francisco.
  - **Hecho el 13-11-2026** (migración aplicada, script con las dos cuentas, publicada): **Antes pendiente de Francisco, en este orden**: 1) aplicar `supabase/migrations/20261215120000_cafe_probador.sql` (flujo del
    SQL Editor: SHA-256 del archivo, él pulsa «Run»; comprobar con la clave pública que `cafe_probadores` da «permission
    denied» al anónimo); 2) ejecutar a mano `supabase/scripts/cafe_probador.sql` con su correo (el correo nunca va a git);
    3) decir «súbelo» para fusionar con `main` y comprobar que `/sw.js` de producción sirve v1.126.0. Sin la migración, el café
    funciona como en la 1.125 (sin «Otra jornada»).
  - **Siguiente trabajo del café**, solo cuando él lo pida: **bloque 6b, el tostadero** (nivel 7: un saco al día recogido
    tirando de la trampilla del tambor, «tueste de la casa» y su receta), y luego **6c, la sala de catas** (nivel 8: chai con
    mortero y café brûlée con soplete). Cifras ya aprobadas: `CLAUDE.md` («El sótano, cifras aprobadas») y
    `docs/qa/cafe-libreria.md` §14. Cada bloque con su migración nueva (la aplica él) y capturas antes de seguir. Sin decidir:
    «Mejoras de la casa y del café» (se le recomendó mantenerlas separadas).
  - **Cómo se trabaja**: por bloques, con capturas a 390 (y 360, 430 y escritorio) y vídeo a 390, **enviados al chat** con
    los archivos; pruebas acotadas, nunca `npm run qa:full`; Prettier solo en archivos nuevos (`--single-quote
    --print-width 200`). Al cerrar un bloque: versión en `src/diag.js`, `package.json`, `public/sw.js` y cabecera de
    `SPEC.md`, su sección en SPEC y entrada aquí. Commit, migraciones y `main`, solo cuando Francisco lo pida.
  - **Comprobaciones del café** (verdes el 13-11-2026): `npx vitest run src/features/edificio` (395; dos de
    `sala-parejas.rls.test.js` pueden pasarse de 5 s con todo a la vez y pasan solas); `npx playwright test -c
    playwright.community.config.js e2e-community/v1126-cafe-sonido.spec.js e2e-community/v1119-cafe.spec.js
    e2e-community/v1121-cafe-clientes.spec.js --project=chromium-390x844` (11); `npx oxlint src/features/edificio/cafe`;
    `npm run build`. Con `PORTADAS_REALES=1`, `v1126` usa portadas reales de Open Library (de la red). Nunca dos tandas de
    Playwright a la vez (comparten el puerto 5196) ni editar mientras corren.
  - **Ojo**: las cinco migraciones del café hasta la 1.125 ya están aplicadas en producción: los cambios de servidor van
    siempre en **una migración nueva**, y `cafeMock.js` y las reglas de `cafeClientes.js`/`cafeNiveles.js` deben dar lo mismo
    (las pruebas de paridad lo vigilan). En `cafe3d.js` las coordenadas de la app son (x, y hondo, z arriba) y Three usa
    (x, z, y). La música del café sale por `sceneMusicOut()` de `audioController.js`.
- **1.99.0 (sin publicar):** que Francisco revise la entrega (vídeos y capturas en `qa-report/almacen/`); aplicar `20261124120000_hotel_almacen.sql` antes de publicar; probar en un iPhone real. `v186-tablon` «se ve lo que se busca…» falla desde la 1.97 (usa el sofá, retirado), no por el almacén.
- **1.89.3 (producción):** probar en Android y Safari de iPhone físicos; decidir cuándo restaurar los objetos retirados (§89.1).
- **1.88.2 (publicada):** comprobarla en Android y en Safari de iPhone reales (solo se ha probado en emulación).
- **1.88 (publicada):** quedan sin causa identificada la franja oscura de Chromium (no se reproduce) y los fallos
  intermitentes de §88.3 (entre ellos, el del decorador del edificio en WebKit).
- **1.87:** cuándo retirar la opción temporal «Volver a la experiencia anterior» y decidir si Rincón 01 se enciende
  (`RINCON_01`).
- **Probar la 1.86** en un móvil real el arrastre de la estiba, los sonidos nuevos y la exportación de la reseña, que Francisco vea las cifras de sellos y precios, y decidir si la tienda dice de qué taller es cada mueble.
- **Probar entre dos cuentas reales y en un iPhone** lo de las 1.82, 1.83 y 1.84, y escuchar los sonidos de la pesada.
- **Rascacielos**: quiosco descartado por ahora y Lonja cerrada. Lo siguiente, en `docs/qa/gran-hotel.md` §9.6.
- **Pisos ampliados o de varias plantas para los vecinos**: más adelante, con lo aprendido en la Lonja.
- **Figuras como muebles animados: aplazado** (Francisco, 4-11-2026, «dejamos aplazado este tema»). Muestra en
  `material-diseno/figuras-habitacion/`. Propuesta sin decidir: ganarlas al terminar el libro y exponerlas en las vitrinas. Antes
  hay que decidir qué hacer con el parecido a personajes de las sagas. No retomarlo sin que lo pida.
- **Reciclar solo lo repetido en los sobres** (idea de Francisco del 3-11-2026, para más adelante): un ajuste en la tienda
  del tipo «si ya tengo N copias de un mueble, recicla las que salgan de más en los sobres» (N lo elige la persona).
  Al abrir el sobre, lo que pase de N se recicla solo por sus tickets (las mismas cifras de `piso_reciclar`), y la
  revelación lo dice («Reciclado: +3 tickets»). Lo decide el servidor dentro de `piso_abrir_sobre` (migración nueva):
  nunca místicos, legendarios, sagas ni lo especial. Sin tocar probabilidades ni pity.
- **Cartel de la tienda (1.76)**: el local dice VIDEOCLUB y la maqueta de Francisco «LA TIENDA DEL BAJO»; preguntarle
  antes de cambiarlo.
000. **Paquete «salón social y radio» (1.62, §62): publicado completo.** Lo que sigue es el resumen del encargo del bloque 4,
   ya cumplido: Encargo completo en `material-diseno/social-radio/BookShelf-social-radio/` (fuera de git, en este
   ordenador): `PROMPT-CLAUDE.md` apartado 5 y la maqueta `maquetas/04-comunidad.png` (columna derecha). Resumen:
   dentro de un club, pestañas Lectura / Conversación / Miembros conservando lo que ya hay (`ClubTab.jsx`,
   en `src/features/social/components/`); administrar y archivar en un menú del propietario con confirmación (no entre mensajes); redactor
   accesible por encima del teclado con «Contiene spoilers» y mensajes con spoiler plegados; paginar mensajes; nada de
   adjuntos ni chat privado; no prometer bloqueo por capítulo. Autorizaciones en el servidor (RLS), no solo ocultas.
   Forma de trabajo (CLAUDE.md): enseñar capturas a Francisco al terminar el bloque. Al acabar: §62.4 en SPEC, entrada
   en la bitácora y, solo si lo pide, commit. Quedan además: Francisco debe escuchar la pista piloto de la radio y
   decidir si se queda; la migración de la sintonía está preparada, sin aplicar.

00. **Noche de la misma habitación (§50–51)**: el fondo nocturno ya está (1.53). Falta, si se quiere, la lámpara y
   la vela pintadas apagadas o sus luces por separado (`docs/design/recursos-noche-misma-habitacion.md`): hoy, de
   noche, apagarlas no las apaga en la ilustración. Las capas recortadas de día (hiedras, cortina) se tiñen por CSS.
0. **Encargo de la 1.46 terminado** (portátil, §42, publicado en la 1.46.1). Figuras revisadas (§41): sin el
   fondo de baldas anchas (punto 1) no pueden igualar el tamaño de la maqueta; faltan recortes con transparencia de
   la Dama, la Jinete y las tres figuras SVG. El escaneo de códigos no existe en el proyecto.
   En calendario y ficha el formulario de registro conserva su fila de guardado fija (lo exige `e2e/v123`): decidir
   con Francisco si se quita también ahí. Pruebas `e2e/ia1.spec.js` de recomendaciones fallan en 844×390 ya en 1.45.
1. **Fondo con baldas más anchas y frontales** para las figuras: con las baldas actuales del fondo (≈ 195 px de la
   ilustración por balda y en perspectiva) se ven más pequeñas que en `docs/design/references/habitacion-figuras-maqueta.png`.
   Hace falta que Francisco entregue ese recurso; no improvisarlo.
2. **`e2e/v149` en `webkit-390x844`**: falla por una limitación del entorno (el WebKit de Playwright en Windows no
   dibuja bien `matrix3d`; las baldas de la habitación salen inclinadas). Confirmar en un iPhone real que las baldas
   se ven rectas. Las demás pruebas antiguas (panorama 9, entrega2, v123 pulsación…) se resolvieron en la 1.58.2 (§58).
4. **Sonidos**: todos sintetizados (mapa en SPEC §35.4). Faltan grabaciones reales de papel, cubierta, madera y
   sobre, con licencia registrada; descargar algo requiere permiso de Francisco.
5. **Bloques registrados y no hechos** (SPEC §32.3): las demás pantallas según sus maquetas (Perfil y Avatar,
   Lectores y actividad, Mi rincón…); salón y club con **capítulos y encuentros** (migraciones de Supabase con RLS
   y pruebas PGlite, más la interfaz); el icono `encuentros` espera a esa función.
6. Iconos de sección sin ubicación todavía: biblioteca, comunidad, reseñas y notas (no se añaden donde la maqueta no
   los pone).
7. Figuras antiguas (Dama de la Ceniza y Jinete de Dragones) no tienen imágenes con transparencia para exponerse en la
   habitación: siguen en el Ático. Las tres en SVG se retiraron en la 1.58.1 (§57).
7b. **Rendimiento en el iPhone real (1.59, §59)**: todo lo medido es emulación (Chromium y WebKit de Playwright). Grabar
   otra vez en el iPhone con más de 1.000 libros: desplazamiento rápido de la biblioteca (sin bloques marrones), lomos,
   «Libros compartidos», figuras del perfil, entrada a una visita y registro con el teclado abierto.
7c. **Nube por libro (propuesta, §59.5)**: la biblioteca sigue siendo un documento por cuenta (cada cambio sube el
   documento entero, con control de versión). Pasar a una fila por libro exige migración y RLS: decidir con Francisco.
8. **EPUB de otra obra** (§57.3): «The Ballad of Songbirds and Snakes» tiene vinculado «El árbol de la ciencia» en el
   móvil de Francisco. Sin defecto de código; confirmar con él si fue a propósito. No tocar sus datos.

### Decisiones vigentes que no deben deshacerse

- (1.52, decisión de Francisco) Día y noche son **la misma habitación**: la composición de día manda y de la noche solo
  se toma la luz. No usar otra ilustración para la noche. El libro es el pintado del día. Las pruebas e2e corren con el
  reloj a mediodía (`playwright.config.js`).
- (1.49, decisión de Francisco) La lectura se escribe sobre el libro **pintado** de la cama en coordenadas de la escena;
  no volver a poner un libro superpuesto en píxeles de pantalla. Encuadre vertical `x: 0.29` para ver los cascos (§47).
- (1.48) Los cinco filtros siempre a la vista sin desplazamiento horizontal (dos filas 3 + 2 si no caben); la
  habitación no muestra «Mi rincón» ni su subtítulo; los carteles se orientan según su superficie (§46).
- Biblioteca (1.47, sustituye a lo anterior): buscador y cinco filtros textiles siempre visibles; el resto de
  herramientas en un icono; sin título grande, sin hueco «Añadir libro» en las baldas; los libros no se agrandan (§44).
- «Abandonado» es un estado real y reversible; nunca automático por inactividad (§43).
- «Tu cuenta y copias» tiene acceso propio en la esquina, fuera de Ambiente (§45).
- Las placas de navegación de la habitación son iconos y nombres con Guías y reflejos sin Guías (§31, §33).
- Ordenador sin cuero, anillas ni pestañas de tela; Mi diario con pestañas digitales (§34).
- Biblioteca sin etiquetas de título bajo las portadas; tres libros por fila en móvil (§35).
- Materiales artesanales en biblioteca y ficha (§36) y, desde la 1.46 por petición de Francisco, en la esquina,
  los accesos y el libro de la habitación y en la vista de registro (§38). No en el resto.
- El libro abierto grande de la cama sustituye a la tarjeta de lectura flotante; nunca duplicar sus datos (§38).
- En la habitación solo se exponen figuras obtenidas con imágenes con transparencia; las cajas fotografiadas y los
  personajes planos no (§37).

## Bitácora

### 2026-11-13 · Ajustes del café tras el tostadero · 1.128.0 (§128), commit en la rama (Claude)

- **Qué se hizo** (lista de Francisco del 13-11-2026, «Sí, empieza»): la «!» roja de lo nuevo (`cafeNuevo.js`; Decorar,
  pestaña Tienda, cada mueble nuevo, opciones nuevas de la barra y letreros del escaparate, la trampilla y el tostador; la
  primera vez todo lo que ya tenías cuenta como visto); la música sin petardeo (`cafeMusica.js`: menos ganancia, margen tras el
  compresor, notas tardías descartadas y nodos soltados); los sonidos igualados por medida (`GANANCIA` y bucles en
  `cafeSfx.js`, `medirSonidos`); la comanda plegada durante el gesto y el excéntrico con un solo acertijo en la barra; la
  cámara de la palanca; al atender, andar hasta el cliente; las portadas que Open Library no tiene, de su mismo ISBN en Google
  Books (`cafePortadaIsbn.js`, fichas y escaparate, recordadas en el dispositivo, sin tocar la biblioteca).
- **Arreglos**: `barra(false)` y `decorar(false)` en `cafe3d.js` cortaban cualquier paseo en curso aunque no se estuviera en
  la barra ni en Decorar (por eso la cámara no iba al cliente); `TOPE_CLIENTES` se leía fuera de la tabla en el nivel 8.
- **Comprobado**: build, oxlint (sin errores en el café), Vitest del café (77, con `cafe-nuevo.test.js` nueva), e2e
  `v1128-cafe-ajustes.spec.js` en 390, 360, 430, escritorio y WebKit 390 (en la tanda seguida, 360 y 430 fallaron al arrancar
  en frío; repetidas solas, pasan las dos), y regresión a 390 de v1119, v1121, v1125, v1126 y v1127 (15, bien). Evidencias en
  `qa-report/cafe-ajustes/` (capturas y dos vídeos a 390). Solo emulación; el sonido, medido y no escuchado en un móvil; la
  causa de las fichas sin portada de su pareja es probable, no comprobada con sus datos.
- **Aprobada** («Sí, haz el commit», tras ver vídeos y capturas) y con commit en la rama. Sin migración. **Queda**: publicar
  cuando Francisco lo pida.

### 2026-11-13 · Migración del tostadero aplicada y 1.127.0 a producción (Claude)

- Francisco: «Aplicar migración y publicar». `20261216120000_cafe_tostadero.sql` pegada en el SQL Editor del proyecto `bookshelf`
  con `setValue` de Monaco (16 605 B, SHA-256 `4f09fbde…dcfdc77da`, igual al archivo de git) y ejecutada por él («Success.
  No rows returned»). Con la clave pública dan 42501 al anónimo `cafe_recoger_saco`, `cafe_servir`, `cafe_granos_carta`,
  `cafe_receta_carta`, `cafe_json`, `cafe_carta`, `cafe_casilla_valida`, `cafe_hito_umbral` y las tablas `cafe_locales` y
  `cafe_catalogo`; una función inexistente da PGRST202, como control. Después, `main` avanzó sin forzar y se subió. Sin probar
  con cuentas reales ni en móviles reales. Siguiente: la lista de Francisco del 13-11-2026 en «Pendiente».

### 2026-11-13 · Café, bloque 6b: el tostadero · 1.127.0 (§127), commit en la rama (Claude)

- **Qué se hizo** (Francisco: «Sí, el tostadero», con las cifras del sótano ya aprobadas): migración
  `20261216120000_cafe_tostadero.sql` (catálogo, `cafe_locales.tazas` y `saco_dia`, cifras del nivel 7, el tueste en la
  carta, `cafe_recoger_saco` y `cafe_servir` con el bono); `cafeMock.js` con las mismas reglas; en la app, el tostador en 3D
  en la esquina del sótano (tambor, trampilla, rampa, enfriador con brazo), `Tostadero.jsx` con el gesto «tambor» (tirar y
  mantener), cinco sonidos y un bucle nuevos, el saco junto al molinillo en la barra y la opción «Tueste de la casa · N tazas».
  Las ayudas «!» siguen la regla de siempre (niveles 1 y 2, luego 6 s parado; el ajuste manda).
- **Arreglo de la 1.125**: con 8 clientes en el nivel 6 la app descartaba al 8.º (el excéntrico) al leer el día.
- **Comprobado**: build, oxlint, Vitest de `src/features/edificio` (todas bien salvo `sala-parejas`, que se pasa de tiempo
  con todo a la vez y sola pasa), `cafe-tostadero.rls.test.js` (8 pruebas) y la e2e `v1127-cafe-tostadero.spec.js` en 360, 390, 430, escritorio y WebKit 390 (la subida, a 390); regresión a 390 de v1119, v1121, v1125 y v1126, bien. En `v1125` la cuenta de Pilar pasa de 7 a 8 clientes por el arreglo de abajo. Solo
  emulación: nada probado en un móvil real.
- **Aprobada** («Sí, haz el commit», tras ver vídeos y capturas) y con commit en la rama, con las interpretaciones de §14.8. **Queda**:
  aplicar la migración (flujo del SQL Editor) y publicar, cuando Francisco lo pida; después, su lista del 13-11-2026 en «Pendiente».

### 2026-11-13 · Migración del probador aplicada y 1.126.0 a producción (Claude, la otra cuenta)

- Retomado el traspaso. Francisco: «Migración y publicar». `20261215120000_cafe_probador.sql` pegada en el SQL Editor (SHA-256
  `24289f16…5a28fb`, igual al archivo) y ejecutada por él («success»); con la clave pública, `cafe_probadores`,
  `cafe_jornada` y `cafe_nueva_jornada` dan «permission denied» al anónimo. Después, el script del probador con **las dos
  cuentas que pidió Francisco: la suya y la de su pareja** (él dio los correos; ejecutado por él, salen las dos con jornada
  `3000-01-01`; los correos no van a git). Regla ampliada en `CLAUDE.md` («Jornadas de prueba»). Fusión con `main` sin forzar.

### 2026-11-13 · Traspaso a la otra cuenta tras la 1.126.0 (Claude)

- Francisco: «dejame esto preparado para que lo continue con la otra cuenta». Puesto al día el punto de traspaso del café en
  «Pendiente» (dónde está, qué falta de Francisco, el siguiente bloque y cómo se comprueba). Sin cambios de código.

### 2026-11-13 · El sonido del café, la barra más ligera, portadas reales y jornadas de prueba · 1.126.0 (§126), con commit (Claude)

- **Qué se hizo** (encargo de Francisco tras probar la 1.125, por orden de importancia): `cafe/cafeMusica.js` (música propia
  y generativa del café, por `sceneMusicOut()`, una salida nueva de `audioController.js` que sigue el volumen de música, «Sin
  música», el silencio y la radio; el café bloquea la música de Sonido con `setMusicBlocked('cafe')` y la suelta al salir);
  unos 30 sonidos nuevos en `cafeSfx.js` (pasos por suelo, trampilla y peldaños desde `cafe3d.js` con `onSonido`, Pilar,
  comanda, taza, libro, estrellas, granos, despedida, Decorar, pizarra, escaparate, llaves); la barra con
  `.cf3-franja--barra` y la notita `.cf3-gesto__nota`; la frase de Pilar sobre el almacén, los sobres y la reforma, fuera.
- **Comprobado**: build, oxlint, Vitest de `src/features/edificio` (50 archivos, 392 pruebas), e2e
  `v1126-cafe-sonido.spec.js` y `v1119-cafe.spec.js` en 360, 390, 430, escritorio y WebKit 390. La música y los sonidos se
  renderizaron fuera de la app (`qa-report/v1126/*.wav`): la música queda al nivel de «Luz de escritorio» y los efectos al de
  los de la barra. **Solo emulación**: no se ha escuchado en un móvil real.
- **Portadas reales** (Francisco: «Sí, haz las portadas en las fichas y el escaparate»): fichas con la portada real y, en el
  escaparate de tu café, cada portada en una rejilla de 10 × 15 dibujada con cubitos (`cafePortadas.js`, por Open Library o
  `/api/portada`). En desarrollo `/api/portada` no existe (es de Vercel): ahí solo salen las de Open Library. Desde la fachada
  y para los vecinos, la cubierta de color (haría falta migración).
- **Escaparate, mejor** (Francisco: «Sí, mejóralas un poco»): con portadas reales, la rejilla de 10 × 15 se quedaba en
  manchas; ahora cada portada es una imagen de 36 × 54 píxeles pintada sin suavizar sobre la cubierta, y se reconoce. Capturas
  con portadas reales de Open Library (`PORTADAS_REALES=1`, sufijo `-reales`).
- **Jornadas de prueba** (Francisco: «Quiero que mi cuenta pueda jugar todo lo que quiera para probar yo todas las funciones
  del juego»): tabla `cafe_probadores` (solo su cuenta, con el script a mano), `cafe_jornada` y `cafe_nueva_jornada`; con
  todos atendidos, «Otra jornada» trae clientes nuevos. Sin borrar nada; lo ganado cuenta (también los tickets de nivel y los
  del día, por jornada, solo en su cuenta). Al resto, nada. **Sin aplicar** la migración ni el script: los aplica Francisco.
  Vitest del edificio: 395, todas bien salvo dos de `sala-parejas` que se pasan de los 5 s con todo a la vez (solas, pasan).
- **Música sin «lluvia»** (Francisco: «se escucha como una lluvia de fondo que la empaña mucho»): fuera el vinilo y el
  murmullo, escobillas más suaves; mismo volumen.
- **Aprobada** («Sí, haz el commit») y con commit en la rama; sin subir a `main`. **Queda**: aplicar la migración y el script
  de las jornadas y publicar, cuando Francisco lo pida. Fuera del café siguen los «En reforma» de la caja del casino y la lata
  de garbanzos y el aviso de sobres cerrados de `Tienda.jsx` (no se tocaron: el encargo era el diálogo del café).

### 2026-11-13 · Migraciones del café aplicadas y 1.125.0 a producción (Claude)
- Francisco pidió aplicar todas las migraciones pendientes y fusionar con `main` lo que quedaba. Con el flujo del SQL Editor
  (él inició sesión en el panel del navegador y pulsó «Run» en cada una; las cinco, «Success»), Claude pegó en el proyecto
  `bookshelf`, una a una y en orden, con bytes y SHA-256 de lo pegado iguales a git:
  - `20261210120000_cafe_local.sql` (16 987 B, `cebe163c…dae693`)
  - `20261211120000_cafe_clientes.sql` (26 922 B, `2347f4e2…2ccb10b`)
  - `20261212120000_cafe_niveles.sql` (23 881 B, `9d321d1f…444c24b`)
  - `20261213120000_cafe_ampliacion.sql` (11 869 B, `c8475886…bc39c262`)
  - `20261214120000_cafe_sotano.sql` (12 497 B, `1eef4de2…f10fa88`)
- Cómo se pegó: el portapapeles de Windows no llega al panel del navegador y la página no puede leer un servidor local, así
  que el texto se pasó al editor con `setValue` de Monaco y se comprobó la huella dentro de la página antes de cada «Run».
- Con la clave pública, al anónimo le dan 42501 las 18 funciones del café que se probaron (`cafe_mio`, `cafe_inaugurar`,
  `cafe_guardar`, `cafe_comprar`, `cafe_comprar_caja`, `cafe_bienvenida`, `cafe_colocar`, `cafe_dia`, `cafe_habitual`,
  `cafe_servir`, `cafe_poner_escaparate`, `cafe_fachada` y las internas `cafe_progreso`, `cafe_nivel_de`, `cafe_granos_hito`,
  `cafe_plano_valido`, `cafe_casilla_valida`, `cafe_asientos`) y las nueve tablas (`cafe_locales`, `cafe_catalogo`,
  `cafe_inventario`, `cafe_dias`, `cafe_servicios`, `cafe_resenas`, `cafe_libros`, `cafe_niveles_cobrados`, `cafe_hitos`).
  Una función inexistente da PGRST202, como control.
- Después, `main` avanzó sin forzar de `3d9bf6d` a `cbb6d22` y se subió; `/sw.js` de producción ya sirve v1.125.0. Sin probar con cuentas reales ni en
  móviles reales.

### 2026-11-13 · Café, bloque 6a: la trampilla y la bodega · 1.125.0 (§125), commit en la rama (Claude)
- Francisco aprobó las cifras del sótano («Sí, esas cifras»; en `CLAUDE.md` y `cafe-libreria.md` §14) y pidió hacerlo por bloques
  con capturas: este es el 6a.
- Hecho: nivel 6 en dominio (`cafeCatalogo.js`, `cafeNiveles.js`, `cafeClientes.js`), la bodega en 3D (`cafe3d.js`,
  `cafeLayout.js`: sala aparte a x 39,4–47,6, `cambiarPlanta` con cortes de cámara), tres muebles (`cafeMuebles.js`,
  `cafeIconos.js`), Decorar por planta y botón «Subir al café» (`Cafe.jsx`, `cafe.css`), el simulador (`cafeMock.js`) y la
  migración `20261214120000_cafe_sotano.sql` (**sin aplicar; la aplica Francisco**).
- Interpretaciones por confirmar (§14.7): 40 cosas desde el nivel 6, preparar siempre en la barra de arriba, el botón de subir
  en la esquina, y el 2.º hito del 6 sin premio.
- Pruebas: Vitest de `src/features/edificio` (392, con `cafe-sotano.rls.test.js`) en verde; e2e `v1125-cafe-bodega.spec.js`
  en Chromium 360, 390, 430 y 1440 y WebKit 390: 7 en verde (la subida de nivel solo va a 390). Una primera tanda falló en
  360 y 430 porque el cartel «Primer cliente del día» tapaba «Hasta luego»: la prueba ahora lo cierra; no era un fallo de la
  app. Regresión `v1119` a `v1123` en Chromium 390: 15 en verde. Build limpio y oxlint sin avisos en el café. Sin móviles reales. Francisco lo aprobó («Sí, haz el commit»):
  **commit en la rama**, sin subir ni fusionar con `main`; las interpretaciones de §14.7 quedan aceptadas. La migración sigue sin
  aplicar.

### 2026-11-13 · Propuesta del sótano del café (niveles 6 a 8), sin commit (Claude)
- Francisco pidió la propuesta («Proponer el sótano»). Está en `docs/qa/cafe-libreria.md` §14: umbrales 10.000 / 15.000 / 21.000,
  tickets 80 / 90 / 100 al subir (tope diario de 5 sin cambios), hasta 8 / 9 / 10 clientes con asientos, 48 / 54 / 60 huecos,
  el tostadero (un saco al día, 5 tazas de «tueste de la casa» a +3 granos y +4 de reputación), el chai (mortero) y el café
  brûlée (soplete), y una alternativa más rápida. **Pendiente de su aprobación**; no se ha tocado código. Sin commit.

### 2026-11-12 · Los carteles de la fachada · 1.124.0 (§124), commit en la rama (Claude)
- Encargo de Francisco con maqueta: rediseñar solo los carteles que se tocan en la fachada (viviendas, café y hotel). La
  regla está en `CLAUDE.md`.
- Hecho: `placas.js` (constructor común e iconos SVG de 16 × 16) y `placas.css`; `calleView.js` y `facadeView.js`
  los usan en vez de sus placas de antes. No cambian botones, posiciones, etiquetas accesibles ni acciones.
- Diferencias con la maqueta, a confirmar:
  - **Sin hora de día**: la calle 3D es siempre de noche y la fachada 2D (sin WebGL), al atardecer; la «captura de día» es la
    de la fachada 2D.
  - **Café inaugurado**: el rótulo dice el nombre del café (antes iba debajo de «Café-librería»), sin tablilla.
  - El vecino va en esmalte de pergamino, un poco más cálido que el marfil de lo libre, para distinguirlos.
  - La placa del hotel va bajo el coche, como antes, no al lado.
- Pruebas: `v1124-placas.spec.js` (3) en Chromium 360, 390, 430 y 1440 y WebKit 390, más `calle3d`, `v1881-fachada` y
  `v1119-cafe` en esos tamaños: 27 en verde y 1 fallo de `v1119` («el bajo en traspaso», Chromium 390) que se quedó en la
  habitación antes de abrir la tablet; repetida sola, en verde. Build y oxlint limpios. Sin móviles reales. Francisco lo aprobó («Me valen, commit»): **commit en la rama**, sin subir ni fusionar con `main`. Las diferencias de arriba quedan aceptadas con la aprobación.

### 2026-11-12 · Café, bloque 4b: el ala lateral, la terraza y el escaparate · 1.123.0 (§123), commit en la rama (Claude)
- Francisco aprobó las cifras del bloque 4b («Sí, esas cifras»; están en `CLAUDE.md`).
- Hecho:
  - `cafeCatalogo.js`: `columnasDe`, `casillaValida`, `TERRAZA`, `ASIENTOS`/`asientosDe` y `maxCosas` (32 desde el nivel 4).
  - `cafeClientes.js`: `clientesDelNivel(nivel, asientos)` y el café con hielo y la vainilla en la carta.
  - `cafeNiveles.js`: los hitos 4 y 5 y lo que se abre.
  - En la barra, la tabla de la vainilla y la coctelera con la cubitera (gestos `rascar` y `coctelera`, con sus sonidos).
  - En `cafe3d.js`: el ala lateral (pared a `ALA.x0`, pilares, viga, campanas, luz propia), la terraza (frente abierto, acera, muelle, fachada por fuera, toldo con farolillos, puerta abierta, placa fuera), el escaparate con tus libros, las cuadrículas por nivel, la cámara de Decorar y la niebla en los niveles 4 y 5, los asientos de dos y el recorrido de los niveles 4 y 5.
  - En `Cafe.jsx`: el aviso de los asientos y el selector del escaparate.
  - Ocho muebles con modelo 3D e icono.
  - La fachada: `drawFacadeBody(r, flats, cafe)` con los libros y la terraza, `cargarFachada` en `EdificioPanel.jsx`, y la placa con el nombre del café.
  - Servidor: `20261213120000_cafe_ampliacion.sql`, **sin aplicar**.
  - Página de desarrollo: `dev/calle3d.html?cafe=1`.
- **Por confirmar con Francisco** (`cafe-libreria.md` §13):
  - el ala se abre a la izquierda, no a la derecha como le dije, porque a la derecha está la barra;
  - 32 cosas desde el nivel 4;
  - el nivel 4 se llama «Ala lateral»;
  - la leche fría del café con hielo;
  - la placa con el nombre del café.
- Pruebas:
  - PGlite `cafe-ampliacion` (6), `cafe-niveles`, `cafe`, `cafe-clientes` y `rpc-solo-lectura`, más `cafeGestos` y `cafeClientes`: en verde. Build y oxlint limpios.
  - `npx vitest run src/features/edificio`: 387 de 388. Falla `estiba.rls` «no se cuela nada», que también falla sola; esa prueba depende de la bodega del día y este bloque no toca la estiba ni sus migraciones. No he comprobado si falla igual en el commit anterior.
  - e2e `v1123-cafe-ampliacion` (3 pruebas): en verde en Chromium 360, 390, 430 y 1440 y en WebKit 390. A 360, la del nivel 5 falló una vez y pasó al repetirla sola.
  - Regresión en Chromium 390: `v1119`, `v1120`, `v1121`, `v1122` y `calle3d`, 16 de 16 en verde.
- Versión subida a 1.123.0. Evidencias en `qa-report/cafe-ampliacion/`. Sin móviles reales. **Commit en la rama** (lo pidió Francisco: «Sí, haz el commit»); sin fusionar con `main` ni subir.
- **Revisión de Francisco** («Sí, pero… la limusina con el chófer la movería a la izquierda para que no interfiera»): la
  limusina pasa a la izquierda del portal, delante de la librería (`LIMO_X = -0.6` en `facade.js`; `SPOTS.limo` en
  `calle3d.js`; el rectángulo `LIMO` en `calleView.js`; el camino a pie), y el bolardo, a la derecha. Anotado en
  `CLAUDE.md`. La prueba del portal en `calle3d.spec.js` ya no espera que la limusina quede fuera de vista al mirar a la
  izquierda. En verde: `calle3d.spec.js` y la fachada de `v1123` en Chromium 390 (WebKit se salta esa prueba). Build y
  oxlint limpios.
- **Segundo ajuste** (Francisco: «¿la limusina y el chófer se verían en la primera vista inicial sin necesidad de girar?»;
  «Sí, ajústala»): en la vista inicial se cortaba la mitad del coche y el chófer quedaba fuera. Ahora el coche va pegado al
  borde del edificio (`LIMO_X = 0.05`) y el chófer, delante de él, del lado del muelle (`chauffeurAt: 'side'` en
  `limo.js`; el hotel no cambia). Se ven los dos a 360, 390 y 430 px, en escritorio y en WebKit 390 (solo la punta del
  parachoques trasero toca el borde). En la calle 3D, la vista se para un poco más lejos (`SPOTS.limo` en `BD + 4,4`) para
  no quedarse pegada al chófer. **Commit en la rama** (lo pidió Francisco), aparte del del bloque 4b; sin fusionar con `main` ni subir.

### 2026-11-12 · Commit del bloque 4a en la rama · 1.122.0 (Claude)
- Francisco aprobó el bloque 4a («Sí, lo apruebo») y pidió el commit **solo en la rama** y pasar al bloque 4b. No se fusiona con `main` ni se aplican migraciones: los bloques 1 a 4a del café siguen sin publicar.
- Se le planteó si las mejoras de la casa deberían ir ligadas al café; la recomendación fue mantenerlas separadas, con los puentes que ya hay (tickets del café, «De tu casa»). **Sin decisión suya todavía.**

### 2026-11-12 · Café, bloque 4a: subir de nivel, hitos y la carta · 1.122.0 (§122), sin commit (Claude)
- Francisco: «Vale me convence, continua con los siguientes bloques». Decisiones nuevas (en `CLAUDE.md`): bloque 4 partido en 4a y 4b; una receta por nivel con su gesto y su objeto (chocolate, nata, vainilla, hielo); hitos «mueble, carta, granos»; huecos 12/18/30/36/42.
- Hecho: `cafeNiveles.js` (cifras, hitos, carta), `LogroCafe.jsx` (el cartel), la tienda en Decorar, nueve muebles con modelo e icono, `cafe_progreso` y la carta del día en el servidor (`20261212120000_cafe_niveles.sql`, sin aplicar), el fondo del local por nivel con `recorrido(nivel)`, la cuadrícula hasta la fila −3 (`filasDe`, `cafe_plano_valido(plano, nivel)`), y en la barra el cazo con el molinillo y el bol con las varillas (gestos `molinillo`, `cazo` y `batir`, con sus sonidos). Las ayudas de los gestos de la barra del e2e pasan a `e2e-community/cafeBarra.js` (las usan `v1121` y `v1122`).
- **Aprobado por Francisco** («Sí, lo apruebo», 12-11-2026), con las interpretaciones de `docs/qa/cafe-libreria.md` §12 (hitos al 25/50/75 %, el 2.º hito del nivel 1 vacío, los 10 tickets del nivel 1 con el primer cliente, los muebles y precios, el cacao sin gesto propio).
- Pruebas: PGlite `cafe-niveles`, `cafe`, `cafe-clientes` (22) y `cafeGestos`/`cafeClientes` (25) en verde; `rpc-solo-lectura` en verde (49 en total); build y oxlint limpios. e2e `v1122-cafe-niveles` (2 pruebas) y `v1121-cafe-clientes` en Chromium 360/390/430/1440 y WebKit 390, en verde (el spec 1.121 cierra ahora el cartel del primer día con `despedir`; «libros en cajas» falló una vez en 360 y pasó al repetir). Versión subida a 1.122.0. Evidencias en `qa-report/cafe-niveles/` (montajes en `entrega/`), enviadas al chat. Tras la entrega, Francisco decidió cómo crece el local (`CLAUDE.md` y `cafe-libreria.md` §12.1): planta de la calle en los niveles 1 a 5, sótano en el 6 al 8 y segunda planta después, con el espacio dando rendimiento; aprobó la propuesta en lo general, las cifras siguen pendientes. Sin móviles reales. **Sin commit.**

### 2026-11-12 · Café: libros y caja con volumen, títulos parejos · 1.121.0 (§121.3), sin commit (Claude)
- Francisco: «se ven demasiado planos como imágenes pegadas y los títulos de los libros salen desparejos». Causa de los títulos: se colaba la regla antigua de `.cf3-lomo` (rejilla de dos columnas, esquinas recortadas y fondo oscuro al pasar el dedo); anulada para los lomos de libro. Títulos con la misma letra y arranque, de arriba abajo, con palabras enteras (`tituloLomo` en `LibrosCafe.jsx`); libros con cabeza de hojas, lomo redondeado y sombra; cartón con textura, canto y luz. Solo aspecto.
- Pruebas: e2e «libros en cajas» en verde en Chromium 360/390/430/1440 y WebKit 390, y la e2e del café completa en 390 (3 de 3); build y oxlint limpios. Antes y después en `qa-report/cafe-clientes/entrega-cajas/9-…`, `10-…` y `11-caja-de-cerca.png` (el antes, en `antes-volumen/`), enviados al chat. Sin móviles reales. **Sin commit.**

### 2026-11-12 · Café: la caja de los libros, en 3D · 1.121.0 (§121.3), sin commit (Claude)
- Francisco: «La quiero más 3d». La caja pasa a ser un sólido con caras en perspectiva (CSS 3D): fondo, suelo, laterales en rampa hasta el frente recortado, solapa trasera de pie y sombra en el suelo; cerrada, las solapas tapan la boca y se abren girando. Solo aspecto: ni reglas ni servidor.
- Pruebas: e2e «libros en cajas» en verde en Chromium 360/390/430/1440 y WebKit 390, y la e2e del café completa en 390 (3 de 3); build y oxlint limpios. Antes y después en `qa-report/cafe-clientes/entrega-cajas/7-caja-3d-antes-despues.png` (el antes, en `antes-3d/`), enviado al chat con el vídeo. Sin móviles reales (el 3D de CSS en Safari de iPhone no está comprobado). **Sin commit.**

### 2026-11-12 · Café: la caja de los libros, de cartón de verdad · 1.121.0 (§121.3), sin commit (Claude)
- Francisco: la caja no le convencía. Rehecha como una caja de cartón abierta (pared del fondo, libros asomando, papel de seda en el borde, cinta y etiqueta delante, solapas abiertas hacia fuera; cerrada, con su tapa precintada). Solo aspecto: ni reglas ni servidor.
- Pruebas: e2e «libros en cajas» en verde en Chromium 360/390/430/1440 y WebKit 390; build y oxlint limpios. Antes y después en `qa-report/cafe-clientes/entrega-cajas/6-caja-carton.png` (el antes, en `antes-caja/`), enviado al chat. **Sin commit.**

### 2026-11-12 · Café: los libros, más cozy · 1.121.0 (§121.3), sin commit (Claude)
- Francisco: «me gusta pero quiero un toque más cozy y acogedor con los libros». **Hecho** sin tocar reglas, cifras ni servidor: lomos distintos por título (tela, piel o rústica; alto y grosor), libros juntos en la balda con los huecos como siluetas, luz de lámpara y guirnalda, el último se asienta con un balanceo, papel de seda y etiqueta en la caja, Pilar comenta lo que pasa y sonidos sintetizados de cartón, papel, madera y campanilla. Anotado en `CLAUDE.md`.
- Pruebas: e2e «libros en cajas» en verde en Chromium 360/390/430/1440 y WebKit 390; build y oxlint limpios. Antes y después en `qa-report/cafe-clientes/entrega-cajas/` (`antes/`, `4-cozy-antes-despues.png`, `5-cozy-mas.png`), enviados al chat. Los sonidos no se pueden comprobar en las grabaciones (van sin audio). Sin móviles reales. **Sin commit.**

### 2026-11-12 · Café: libros en cajas (distribuidora, caja de reparto y balda) · 1.121.0 (§121.3), sin commit (Claude)
- Francisco aprobó las cifras («Sí, esas cifras»): caja de género 5 por 10 granos, de título 3 por 9, +2 granos por ejemplar que se lleva el cliente (solo si encaja), bienvenida de 8 una vez y 12 huecos en el nivel 1.
- **Hecho** (§121.3): servidor en `20261211120000_cafe_clientes.sql` (`cafe_libros`, `cafe_bienvenida`, `cafe_comprar_caja`, `cafe_colocar`, `cafe_servir` con `libro`), reglas en `cafeClientes.js`, servicio, simulador `cafeMock.js`; en el café, la caja de reparto 3D con su letrero, el cuadro «Tus libros» (`LibrosCafe.jsx`: arrastrar o tocar los lomos a la balda, la distribuidora por géneros y títulos), fichas solo de la balda, «Se lleva …» y «2 por el libro», y «Solo el café» sin ejemplares.
- **La migración sigue sin aplicar** (la aplica Francisco). Ojo: cambia la firma de `cafe_servir` (5 parámetros) y borra las dos anteriores.
- Pruebas: Vitest del café y de solo lectura 38 en verde (8 de `cafe-clientes.rls`, con la nueva de libros); build y oxlint limpios; e2e `v1119`, `v1120` y `v1121` (Chromium 360/390/430/1440 y WebKit 390, dos trabajadores): 23 en verde y 3 fallos, uno de la propia prueba (corregido) y dos por carga de WebGL; los tres en verde al repetirlos de uno en uno. Evidencias en `qa-report/cafe-clientes/` (`10-`…`16-*`, `cajas-*.webm`, mosaicos en `entrega-cajas/`), enviadas al chat. A 360 la pestaña «La caja · n» parte la línea (detalle menor, sin tocar). Sin móviles reales. **Sin commit.**

### 2026-11-12 · Café: la «!» de ayuda y la propuesta de libros en cajas · 1.121.0 (§121.2), sin commit (Claude)
- Francisco pidió, antes de seguir con los bloques, que lo que hay que tocar resalte con una exclamación en los primeros niveles, y adaptar la compra de libros en cajas de Tiny Bookshop. Decidió (12-11-2026): **«!» solo sobre lo siguiente**, en los niveles 1 y 2 y después si alguien se queda parado, con ajuste «Ayudas visuales»; **cajas por género**; **caja de bienvenida gratis** y, sin ejemplares, «Solo el café». Anotado en `CLAUDE.md`.
- **Hecho** (§121.2): la «!» sobre las cosas que se pueden elegir (todas las de esa parte; nunca delata la buena) y sobre el objeto de cada gesto; desde el nivel 3, a los 6 s sin avanzar; ajuste en «Tu cuenta» (`settings.ayudasCafe`). Sin cambios de economía ni servidor.
- **Propuesta sin hacer**: libros en cajas, en `docs/qa/cafe-libreria.md` §11 (caja de género 5 ejemplares por 10 granos, de título 3 por 9, +2 granos por ejemplar que se lleva el cliente, bienvenida de 8, 12 huecos en el nivel 1; tablas y funciones nuevas). Aprobada después («Sí, esas cifras»): hecha en la entrada de arriba.
- Pruebas: Vitest del café 35 en verde (13 de `cafeGestos`); e2e `v1121` en Chromium y WebKit 390 en verde con las capturas `*-ayuda-*`; build y oxlint limpios. Tanda completa `v1119`, `v1120` y `v1121` (Chromium 360/390/430/1440 y WebKit 390, dos trabajadores): 18 en verde y 3 fallos por carga («Error creating WebGL context»), en verde al repetirlos de uno en uno. **Sin commit**. Sin móviles reales.

### 2026-11-12 · Preparar el café: un gesto y un objeto por paso · 1.121.0 (§121.1), sin commit (Claude)
- Francisco, literal: «quiero que el proceso de hacer el cafe sea divertido y adictivo, y que cada paso se sienta unico, tanto por los movimientos que haga el usuario como por los objetos que tenga que ver». Anotado como regla en `CLAUDE.md` («Revisión del bloque 3»).
- **Hecho** (§121.1, en la misma 1.121.0 porque la entrega no está aprobada; sin subir versión): la barra va por cinco etapas (Bebida, Grano u Hoja, Extraer o Reposar, Leche, Toque) y cada paso tiene su objeto y su gesto: girar la manivela del molinillo, llevar la cucharada de hoja al colador, apisonar deslizando, bajar la palanca y mantener, levantar la tetera y mantener, subir y bajar el colador, inclinar la jarra bajo el vapor y mantener, servir la leche con un trazo (recto, corazón; ondulado, hoja), agitar la canela y dibujar el hilo de miel. La cámara se acerca a cada objeto; tras extraer, la taza sale a la madera. Sonidos propios sintetizados por acción y material (`cafeSfx.js`, por el bus de efectos de la app y solo con el sonido del edificio). Ningún gesto falla, no hay tiempo límite y soltar no pierde nada; con movimiento reducido o teclado, cada gesto se hace de una vez.
- **No cambia la economía, las recetas ni el servidor**: las cuatro elecciones y `cafe_servir` son las mismas y los gestos no tocan las estrellas. Las dos migraciones del café siguen **sin aplicar**.
- Archivos nuevos: `cafe/cafeGestos.js`, `cafe/cafeSfx.js`, `__tests__/cafeGestos.test.js`; cambiados: `cafe/Atender.jsx` (reescrito), `cafe/cafe3d.js` (la barra), `cafe/Cafe.jsx` y `EdificioPanel.jsx` (pasan `soundOn`), `cafe/cafe.css`, `audio/uiSounds.js` (`uiSfxBus`), la e2e `v1121-cafe-clientes.spec.js` (cada gesto con el ratón sobre su objeto) y `CLAUDE.md`. Capturas de cada paso y vídeos en `qa-report/cafe-clientes/`; las de la versión anterior, en `qa-report/cafe-clientes/antes-1121/`.
- Pruebas: Vitest del café (`cafeGestos` 12, `cafeClientes`, `cafe-clientes.rls`, `cafe.rls`: 34) en verde; build, oxlint del café y Prettier limpios. e2e `v1119`, `v1120` y `v1121` en Chromium 360/390/430/1440 y WebKit 390 con dos trabajadores: 17 en verde y 4 fallos por carga («Error creating WebGL context», la habitación sin llegar a la tablet); repetidos de uno en uno, los 4 en verde. Vídeos `dia-chromium-390x844.webm`, `dia-webkit-390x844.webm` y `reducido-chromium-390x844.webm` (la reducida no corre en WebKit a propósito).
- Después (Francisco: «Afina lo de la canela, que caiga desde encima»): el bote gira sobre su centro, boca abajo justo encima de la taza, y el polvo cae en vertical; e2e del día en Chromium y WebKit 390 en verde, capturas enviadas al chat.
- **Sin commit** (no lo pidió Francisco): todo queda en la carpeta. Sin probar en móviles reales (solo emulación de Chromium y WebKit) ni con el servidor de verdad. Pendiente: que Francisco revise la entrega.

### 2026-11-11 · La sala de lectura, bloque c: la placa del sofá y los gestos cerrados · 1.118.0 (§118), publicada (Claude)
- Francisco: «Sí, al bloque c» (tras publicar la 1.117). **Hecho** (§118): `hotel/gestos.js` (siete gestos: ¡Hola!, Alzar la taza, ¿Qué tal va?, ¡Qué bueno!, Un capítulo más, Momento intenso, Buenas noches); en «Leyendo ahora», «Saludar» como antes y «Gestos» al lado; en la cita, gestos en su panel y, en el sofá, «Gestos» en la franja; el gesto que llega sale en un bocadillo sobre quien lo hace (también sobre su plaza del sofá) y como frase. «Vuestras placas del sofá» en «Leer con un amigo» y la placa de metal en el dorso del respaldo (la de tu cita o, sin cita, la de más horas); tocar el sofá con placa mira al respaldo. Al terminar un libro en una cita con minutos juntos, «¿Lo apuntáis en la placa del sofá?» antes de la oferta del lomo.
- **Migración nueva** `supabase/migrations/20261207120000_sala_parejas.sql`, **aplicada** el 2026-11-12 tras aprobar Francisco la entrega («Sí, a la migración»): pegada en el SQL Editor del proyecto `bookshelf` con bytes (9 408) y SHA-256 (`455e6b20…7974aec`) iguales al archivo, también justo después de ejecutarla; Francisco pulsó «Run» («Success. No rows returned»). Con la clave pública, `sala_gesto`, `sala_gestos_nuevos`, `sala_placas`, `sala_placa_libro`, las internas `sala_en_cita` y `sala_pareja_minutos` y la tabla `sala_pareja_libros` dan 42501 al anónimo (una función inexistente da PGRST202, como control). Contiene: `sala_saludos.gesto`, `sala_pareja_libros` (RLS cerrada), `sala_gesto`, `sala_gestos_nuevos`, `sala_placas`, `sala_placa_libro` (`security definer`, `volatile`) y dos internas sin permiso (`sala_en_cita`, `sala_pareja_minutos`). Cupos: 30 min por persona en la sala, 1 min en la cita; 3 libros al día en la placa, hasta 3 h después de la cita.
- **Pruebas**: `sala-parejas.rls.test.js` 10/10 y `gestos.test.js` (la lista coincide con la del servidor); `sala-citas`, `sala-lectura`, `rpc-solo-lectura` y `salaLayout` en verde. e2e `v1118-sala-placa.spec.js` en verde a 360, 390 y 1440 en Chromium y a 390 en WebKit, con vídeo de Chromium y WebKit a 390; regresiones v1117, v1116 y v183 en verde de una en una (con dos navegadores a la vez, Chromium a veces no crea el contexto WebGL y fallan por carga, no por el cambio). «Saludar» sigue usando `sala_saludar` (el servidor nuevo lo guarda como «¡Hola!») para no añadir un viaje sin la migración. Nada probado entre dos cuentas reales ni en móviles reales.
- **Commit** (Francisco: «Sí, haz el commit», 12-11-2026) solo con lo del bloque c, con la versión en 1.118.0 y la SPEC hasta la §118. Lo del café-librería (`CLAUDE.md`, `docs/qa/cafe-libreria.md`, `edificio/cafe/`, sus e2e, la §119, la 1.119.0 de los archivos de versión y su entrada de abajo) es de otra sesión y queda fuera, sin commit, en la carpeta. Commit `e8cead7`. **Publicada** con «Sí, súbela» (12-11-2026): `main` avanzó sin forzar de `4ff1399` a `e8cead7` (solo ese commit; lo del café no iba) y `/sw.js` de producción ya sirve v1.118.0.

### 2026-11-12 · Revisión del bloque 3 del café: la barra, las estrellas y el excéntrico · 1.121.0 (§121), commit en la rama (Claude)
- Francisco revisó el bloque 3: «el café pesa más que el libro», la cafetera «demasiado plana», demasiadas opciones al recomendar y sin reto al fallar; pidió preparar cada bebida en una barra artesanal 3D y llevarla a la mesa, y un cliente excéntrico al día. Decidió (12-11-2026): **estrellas** (de 1 a 3, nunca cero), **el triple y reseña dorada** para el excéntrico con 3 estrellas, y **cuatro elecciones** en el nivel 1 (bebida, grano u hoja, leche y toque). Anotado en `CLAUDE.md`.
- Hecho (§121 reescrita): barra 3D (cafetera de palanca de cobre, tetera, tarros, jarras, canela, miel, taza que se llena), tocar en la barra o en las casillas, mantener pulsado para verter, la taza en la mano y andar hasta el cliente (de frente y a un paso), tres fichas de libro con una que encaja o «Solo el café», estrellas con lo acertado y lo fallado, seis excéntricos con tocado 3D, aura, acertijos y reseña dorada en la pizarra.
- **La migración `20261211120000_cafe_clientes.sql` se reescribió en su sitio** (seguía sin aplicar): `cafe_servir(dia, cliente, receta, encaja)` sustituye a la de `bebida` (se borra la firma vieja), `cafe_servicios` guarda receta, aciertos y estrellas, y `cafe_resenas` admite las doradas. Las dos migraciones del café siguen **sin aplicar**. **Commit en la rama, sin subir**, para el traspaso a la otra cuenta (lo pidió Francisco: «preparámelo todo para que yo pueda continuar exactamente por el mismo punto»).
- Pruebas: Vitest del café y `rpc-solo-lectura` (24) en verde; e2e `v1119`, `v1120` y `v1121` en Chromium 360/390/430/1440 y WebKit 390; build y oxlint del café limpios. Sin móviles reales ni servidor de verdad. Pendiente: que Francisco apruebe la entrega; luego las migraciones por el flujo del SQL Editor y el bloque 4.

### 2026-11-12 · El café-librería del bajo, bloque 3: clientes, lectura y granos · 1.121.0 (§121), sin commit (Claude)
- Francisco aprobó la 1.120.1 («Sí, me gusta») y pidió «Seguir al bloque 3». Hecho: clientes del día (3 en el Rincón, sentados en las sillas del plano, con bocadillo «!»), pedidos según tu estantería, recomendar (corazón si encaja; nunca hay fallo), servir café o té manteniendo pulsada la cafetera (un toque con movimiento reducido), granos y reputación del servidor, habituales por las sesiones de lectura de hoy (tope 2) con reseña en la pizarra. **Migración nueva sin aplicar**: `20261211120000_cafe_clientes.sql` (requiere `20261210120000_cafe_local.sql`, también sin aplicar). Sin subidas de nivel ni tickets (bloque 4). Evidencias en `qa-report/cafe-clientes/`. **Sin commit**, como la 1.119 a la 1.120.1. Pendiente: que Francisco lo revise; luego las dos migraciones por el flujo del SQL Editor y el bloque 4 (niveles, tickets y desbloqueos).

### 2026-11-12 · La interfaz del café, más de videojuego · 1.120.1 (§120.1), sin commit (Claude)
- Francisco: «Cambia como se ve la interfaz para que se vea un poco más cercana al estilo videojuego y más atractiva». Hecho: cuadro de diálogo de RPG con retrato de Pilar y pestaña con su nombre, botones de píxel con relieve (verde para confirmar), letra PuertoPixel, HUD con insignia de nivel, barra de reputación y granos, placas de madera para el nombre y la balda de Decorar como inventario con iconos de píxel propios. Solo aspecto: sin cambios en servidor ni migración (sigue sin aplicar `20261210120000_cafe_local.sql`). Evidencias en `qa-report/cafe-decorar/`. Pruebas del café en verde; en la tanda de cuatro tamaños a la vez fallaron por tiempo una de 360 y otra de 430, que pasan repetidas por separado (3 de 3). **Sin commit**, como la 1.120.0. Pendiente: que Francisco lo revise; luego la migración y el bloque 3.

### 2026-11-12 · El café-librería del bajo, bloque 2: las llaves, el nivel 1 y Decorar · 1.120.0 (§120), sin commit (Claude)
- Francisco: «Sí, al bloque 2». Hecho: Pilar da las llaves, el nombre se elige de una lista cerrada, llegan los muebles del rincón (nivel 1) y tus libros leídos llenan las estanterías; Decorar desde arriba con rejilla (elegir, arrastrar, girar, guardar en la balda, muebles del café y de casa). **Migración nueva sin aplicar**: `20261210120000_cafe_local.sql` (redefine `piso_falta_copia` para contar lo de casa que está en el café); sin ella, el bajo sigue como en la 1.119. Evidencias en `qa-report/cafe-decorar/`. **Sin commit**, como la 1.119 (bloque 1) y la 1.118 de la sala (otra sesión): `diag.js`, `package.json`, `sw.js` y la cabecera de `SPEC.md` llevan las tres. Pendiente: que Francisco revise; luego la migración por el flujo del SQL Editor y el bloque 3 (clientes y granos).

### 2026-11-12 · El café-librería del bajo, bloque 1: el local vacío en 3D · 1.119.0 (§119), sin commit (Claude)
- Plan aprobado por Francisco el 11-11-2026 («Sí, las recomendadas»; `docs/qa/cafe-libreria.md` y la regla en `CLAUDE.md`). Bloque 1 hecho: la tienda del bajo se retira de la vista (sin borrar tickets, inventario ni datos) y se entra en el antiguo videoclub vacío en 3D, de noche, con Pilar, cajas, la cortina del fondo y el escaparate a la calle; sin WebGL, el dibujo isométrico del local vacío. Sin migraciones. Evidencias en `qa-report/cafe/` (las de «antes» son `qa-report/reforma-muebles/despues/4-tienda-*.png`, solo a 390). **Sin commit**, a la espera de que Francisco revise la entrega. La versión 1.119 se apoya en la 1.118 de la sala (también sin commit, de otra sesión): `diag.js`, `package.json`, `sw.js` y la cabecera de `SPEC.md` llevan los dos cambios; si la 1.118 se publica antes, el commit del café solo añade lo suyo. Pendiente: la fachada aún dibuja el escaparate de la tienda (bloque 4).

### 2026-11-11 · La sala de lectura, bloque b: la cita de lectura y el sofá para dos · 1.117.0 (§117), publicada (Claude)
- Francisco: «Sí, al bloque b» (tras revisar el bloque a; la cita, «haz lo que veas mejor»). **Hecho** (§117): invitar a un amigo desde «Leer con un amigo» (ahora / en 15 / en 30 min; 15, 25 o 45 min), el aviso en todo el edificio con «Ir a la sala», aceptar o «Ahora no» (rechazar se ve como no venir: «No ha podido venir»), el sofá para dos con la vista por detrás (los dos junto a la chimenea), la cuenta atrás en el sofá, el reloj común del servidor (`timer.startFor` con lo que queda), el latido mientras estás en el sofá con la app a la vista y «Habéis leído juntos N minutos».
- **Migración nueva** `supabase/migrations/20261206120000_sala_citas.sql` (`sala_citas`, `sala_latidos`, cinco funciones `security definer` y `volatile`, RLS cerrada, amigo con `piso_casino_amigo`). **Aplicada** el 2026-11-11 con el flujo del SQL Editor: pegada en el proyecto `bookshelf` con bytes (10 533) y SHA-256 iguales al archivo; Francisco pulsó «Run» («Success. No rows returned»). Con la clave pública, `sala_citas` y `sala_latidos` y las cinco funciones (`sala_citas`, `sala_cita_invitar`, `sala_cita_responder`, `sala_cita_latido`, `sala_cita_dejar`) dan 42501 al anónimo (una función inexistente da PGRST202, como control). La app publicada aún no la usa (1.117 sin commit ni despliegue).
- Pruebas: `sala-citas.rls.test.js` nueva (10), `rpc-solo-lectura`, `sala-lectura.rls` y `salaLayout.test.js` en verde (31 en total); build en verde; Prettier limpio en los archivos nuevos. e2e: nueva `v1117-sala-cita` en verde a 360, 390 y escritorio (Chromium) y 390 (WebKit); a escritorio falló una vez con todo en paralelo y pasó sola tres veces seguidas. Vídeos en Chromium y WebKit a 390. `v1116-sala3d` y `v183-sala-lectura` siguen en verde (17). Capturas y vídeos en `qa-report/sala-cita/`. SHA-256 de la migración: `c8c2fc950e6b68a6cbc442956734b088d9339d8f20fd7f2073eade33a2fdded4`.
- **Commit** de los bloques a y b juntos en `1.90-escritorio-puerto` («Sí, haz el commit»), tras aplicar la migración (commit `5e14874`). **Publicada** con «Sí, súbela»: build en verde, `main` avanzó sin forzar de `0d3dde5` a `5e14874` y `/sw.js` de producción ya sirve v1.117.0. El bloque c (placa del sofá sin rachas y gestos cerrados), después y solo con su visto bueno.

### 2026-11-11 · La sala de lectura en 3D, bloque a: a solas, tu sillón con tu libro · 1.116.0 (§116), publicada (Claude)
- Encargo de Francisco (11-11-2026): darle a la sala de lectura un sentido real para ir solo o acompañado, y recrearla en 3D como las otras salas. Primero el plan, `docs/qa/sala-lectura-3d.md`. Sus respuestas: a solas, «el sillón y el libro»; cita de lectura con un amigo, «haz lo que veas mejor»; placa del sofá sin rachas; y «sí, añade una selección de gestos». Quedan en `CLAUDE.md` («La sala en 3D») y reagrupadas en tres bloques: a) 1.116 la sala y tu sillón, b) 1.117 la cita de lectura en el sofá para dos (migración `…_sala_citas.sql`), c) 1.118 la placa del sofá y los gestos (`…_sala_parejas.sql`).
- **Bloque a, hecho** (§116): `hotel/sala3d.js` (escena), `hotel/salaLayout.js` (plano, pasillos, reparto de sillones, `lomoDe` compartido con `SalaLibreria.jsx`), `hotel/sala3d.css` y `SalaLectura.jsx` (el 3D encima del panel de siempre; sin WebGL, la sala isométrica). Tu sillón se recuerda en el dispositivo; tu libro en la mesita y en las manos al sentarte; el reloj de pie es el del Pomodoro; la librería común con sus lomos, que se tocan; el sofá, «pronto». Francisco pidió, al ver las primeras capturas, «más profundidad»: relieve en las librerías, niebla de fondo, resplandor y haces de luna con motas. Después, «luces más cozy», «más magnificencia, como una gran biblioteca mágica», las tiras de la librería sin deslumbrar y que la lectura no ocupe media pantalla: triple altura con segunda galería, bóveda celeste, araña grande, libros que vuelan en corro y chispas doradas; luz ámbar y malva; la sala al 80 % del alto y, sentado, la sesión en una franja baja. Y, a petición suya, más detalle en los muebles (capitoné, tachuelas, pantallas plisadas, globo terráqueo, tintero…) y letreros discretos (plaquitas translúcidas). Por último, la sesión del panel es una franja baja y se elige su duración (15/25/45/60 o de 5 en 5; el ajuste del Pomodoro de la app). De este último cambio, solo capturas (Francisco no pidió vídeo). Sin migraciones.
- Pruebas: `salaLayout.test.js` nueva y vitest de `edificio` (308) en verde; build en verde; oxlint sin avisos en lo cambiado. e2e: nueva `v1116-sala3d` en verde a 360, 390, 430 y escritorio (Chromium) y 390 (WebKit), con vídeo en Chromium y WebKit; `v1115-hotel3d`, `v174-limusina`, `v177-armario` y `v177-hotel-directorio` en verde a 390 y `v183-sala-lectura` adaptada (fuerza la sala sin WebGL; su flujo 3D lo cubre la v1116). Capturas y vídeo en `qa-report/sala3d/`. **Sin verificar**: móviles reales.
- Francisco revisó las evidencias y pidió el bloque b («Sí, al bloque b»); el bloque a va en el mismo commit que el b (ver la entrada de la 1.117).

### 2026-11-11 · Exteriores en 3D, bloque 3: el Gran Hotel en 3D desde la plaza · 1.115.0 (§115), publicada (Claude)
- Francisco: «Sí, bloque 3». **Hecho, solo en la página de desarrollo** `dev/hotel3d.html` (la app no cambia): `hotel/hotel3d.js`, el rascacielos visto desde la plaza del muelle, de noche y a la altura de una persona. Las cajas del hotel salen a `drawHotelBody` en `hotelArt.js` (el 2D sale idéntico: misma huella SHA-256 de `renderHotel`); en 3D la plaza es más honda, la gente a tamaño de persona, el rótulo en neón con la letra del 2D, el naipe del casino, luna, focos y la luz de cada ventana sobre la fachada. 2.267 caras, atlas 2048 × 1367, ~1 s de montaje.
- Francisco, al ver las capturas: «Me gustaría que se viese más espectacular y que la gente no parezcan palos». **Hecho** (aún en `dev/hotel3d.html`): gente con cuerpo (`person3d`: zapatos, piernas o falda, abrigo, brazos, bolso, pelo, sombrero; el botones con uniforme; opción `drawPerson` de `drawHotelBody`, el 2D sigue idéntico); el motor `exterior3d.js` gana `bloom` (resplandor con `UnrealBloomPass` a la misma resolución baja) y `tick` (animación a ~30 fps, parada con movimiento reducido); el hotel tiene resplandor en ventanas, neón y farolas, **focos que barren el cielo**, baliza roja que late en la aguja y **plaza mojada** (estelas de las luces y charcos, pintadas en el suelo). La calle sale idéntica (misma huella de capturas). Capturas y vídeo en `qa-report/hotel3d/` (`comparativa-390.png`, `hotel3d-390x844.webm`). ~2.950 caras, ~1,4 s de montaje. Falta su visto bueno para montarlo en la app.
- Francisco: «Sí, móntalo». **En la app** (`hotel/hotelView3d.js`, `GranHotel.jsx`): la fachada del hotel es la plaza en 3D con la cartela, el Directorio y las plantas de siempre; se tocan en la torre (cajas `ZONE_BOXES`, ahora exportadas de `hotelArt.js`, el 2D idéntico) con un filete de latón en SVG que sigue a la vista. **Sin viaje 2D**: bajas de la limusina junto a la marquesina mirando la torre y andas a la plaza; entrar en una planta abierta es andar a la puerta rodeando la limusina. Sin WebGL, la fachada 2D y el viaje de siempre. El panel del hotel en 3D tiene alto fijo (en escritorio la cartela quedaba cortada). `setView` del motor corta un giro en marcha. Versión 1.115.0 y SPEC §115. Pruebas: nueva `v1115-hotel3d` (3 pasan: 390 Chromium y WebKit, escritorio, reducido, vídeo); `v174-limusina` y `v177-hotel-directorio` adaptadas (pasan a 360, 390 Chromium y WebKit y escritorio); `v175`, `v180`, `v183`, `v184`, `v186-estiba`, `v198`, `v1107`–`v1112`, `reforma-tienda`, `calle3d` y `hotel3d` en verde a 390; `v186-tablon` falla en dos (el sofá retirado y un taller de más: ya fallaba, no es del hotel). Vitest de `edificio` (303) y build en verde. Capturas y vídeo en `qa-report/hotel3d-app/`. **Sin verificar**: móviles reales. Francisco revisó el vídeo y las capturas y la aprobó («Sí, apruebo»): commit, fusión con `main` y despliegue.
- **Motor compartido** `exterior3d.js`: lo que era de `calle3d.js` (grabar cajas, caras, atlas, cámara, arrastre, andar). La calle sale idéntica (misma huella de tres capturas). Admite `pitchUp` (mirar por encima de la vista de siempre; el hotel lo usa en apaisado).
- Capturas en `qa-report/hotel3d/` (`comparativa-390.png`, `comparativa-escritorio.png`); prueba `e2e-community/hotel3d.spec.js`. **Pendiente**: que Francisco lo vea; después, montarlo en la app (plantas que se tocan, llegada en limusina) y versión. Sin commit.

### 2026-11-11 · Exteriores en 3D, bloque 2: salir a pie · 1.114.0 (§114), publicada (Claude)
- Francisco: «Sí, bloque 2». **Hecho**: en tu habitación de inicio, «Al edificio» y la puerta llevan la cámara andando hasta la puerta (`walkToDoor` en `interior3d.js`); el portal 3D empieza en el umbral mirando al muelle, da unos pasos, se vuelve y acaba en la vista de siempre (3,4 s; `salida.js` marca la salida, caduca a los 8 s). La cámara de la calle anda (`SPOTS` y `walk` en `calle3d.js`), con el agua del puerto hasta el horizonte. A la limusina y a la tienda se va andando (1,7 s) en lugar del paseo 2D de la 1.78; mientras se anda, los botones se esconden y no se pulsan. Corregido de la 1.113: en el móvil el portal 3D ocupaba el 94 % del alto y dejaba ver lo de debajo; ahora llega hasta abajo.
- Pruebas: build en verde; `vitest src/features/edificio src/features/pisoLab`, 379 en verde; `calle3d.spec.js` con dos pruebas nuevas (de tu piso a la calle en la app; la salida a cámara lenta en `dev/calle3d.html`). e2e a 390: `calle3d` (4) y `v1881-fachada` (también en WebKit), `v167-tienda`, `v174-limusina`, `reforma-tienda`, `v198-recepcion3d`, `fase1-visitas` y `v178-paseo`, en verde (con las placas escondidas de verdad mientras se anda: `v1881` lo pedía). Fallan igual en la 1.113 publicada (comprobado en una copia aparte de `b965882`), no son de este bloque: `v188-habitacion-real` (2: el número de muebles al abrir Decorar y «Cuenta y copias» en el ordenador) y `v163-edificio` (el chip «Plantas» ya no existe). Capturas en `qa-report/calle3d/3-salida-*.png`, `4-app-*.png` y la tira `4-app-tira.png`; vídeos `4-app-salida.webm` (la app) y `3-salida-lenta.webm`. Sin probar en móviles reales.
- Francisco revisó las evidencias y pidió el commit («Sí, a commit»); luego, «Publicar en main»: `main` avanzó sin forzar a `6281864` y `/sw.js` de producción ya sirve v1.114.0. Quedan los bloques 3 (rascacielos y limusina) y 4 (placas). Las tres pruebas saltadas de `v178-paseo` (paseo 2D) siguen saltadas: el paseo ahora es la cámara.

### 2026-11-11 · Exteriores en 3D, bloque 1: el edificio desde el muelle · 1.113.0 (§113), publicada (Claude)
- Francisco, con capturas del edificio y del rascacielos: «descuadra demasiado cuando sales a ellos y entras en los entornos 3D, como podríamos hacer para darles más peso, y, forma». Eligió **«Exteriores en 3D»**: los exteriores en el mismo motor que el piso y la recepción, con la vista a la altura de una persona. Bloques: 1) el edificio desde el muelle; 2) salir del piso a la calle sin corte; 3) el rascacielos y la limusina; 4) placas de latón y letreros.
- **Bloque 1** (solo en la página de desarrollo `dev/calle3d.html`; la app no cambia todavía): `src/features/edificio/calle3d.js`. Las cajas de la fachada salen a `drawFacadeBody(r, flats)` en `facade.js`, compartida: el 2D las pinta y el 3D las **graba** con un rasterizador de mentira y pinta cada cara visible en un atlas con las mismas rampas, tramado y detalles (`face`), ventanas por dentro (`windowPictures`), letras del cartel (`signGlyphs`, a doble tamaño) y luz de tarde. El 2D sale idéntico (misma huella SHA-256 del dibujo antes y después).
- Vista: en el muelle a 8,6 del portal, ojos a 1,6; mira un poco hacia arriba para que entre el cartel. Gira ±0,5 rad con el dedo o las flechas y baja la vista hasta 0,3 rad. En apaisado, campo vertical de 74°. Solo en 3D: el cartel va 0,8 más alto (desde abajo lo tapaba el antepecho), dos vecinos más a los lados, farolas en el bordillo, adoquines más menudos, charcos y hojas. 1.762 caras, atlas de 2048 × 587, montaje en ~0,7 s.
- Pruebas: `e2e-community/calle3d.spec.js` (capturas y vídeos en `qa-report/calle3d/`, antes y después a 390 × 844); `vitest src/features/edificio` en verde (303).
- Francisco vio las capturas: «Sí, móntalo». **Montado en la app** (1.113.0, §113): el portal del panel del edificio es la calle 3D (`calleView.js`, mismas opciones que `mountFacade`), con los botones de pisos, tienda, buzón y limusina colocados sobre la vista. Arrastrar encima también gira; al entrar y volver, la vista se acerca y se aleja desde allí; lo que queda fuera de la vista sigue para el teclado y gira la vista al llegar. Sin WebGL, la fachada 2D. Lo pintado se reutiliza al volver a montar (en desarrollo, StrictMode monta dos veces).
- Francisco aprobó la entrega y pidió el commit («Sí, a commit»): `4a15ee3`. Luego, «Publicar en main»: `main` avanzó sin forzar de `0c6beb0` a `3b97d43` y `https://bookshelf-wine-iota.vercel.app/sw.js` ya sirve v1.113.0. Sin probar en móviles reales.
- **Se queda fuera, de momento** (decisión de Claude, para que Francisco la valide): el paseo de tu personaje hasta la tienda o la limusina (1.78), las gaviotas y los destellos del 2D. El paseo vuelve con el bloque 2. Las tres pruebas del paseo de `v178-paseo` se saltan con ese motivo.
- Pruebas a 390 en Chromium: `calle3d` (2), `v1881-fachada` (2, ahora cuenta solo las placas a la vista), `v163-edificio`, `v167-tienda`, `v174-limusina`, `reforma-tienda`, `v198-recepcion3d`, en verde. Además, el resto de e2e de comunidad que pasan por el portal (40 archivos), a 390 en Chromium: 108 en verde, 25 saltadas, ninguna en rojo. Capturas y vídeos de antes (fachada 2D) y después en `qa-report/calle3d/`. `v171-vecinos`: tres fallos que **ya estaban** con la fachada 2D (`__edificioPiso.screenOfItem` da null en el piso isométrico; comprobado montando el 2D). Sin probar en móviles reales.

### 2026-11-11 · Arreglo: la ruleta del casino no se podía girar · 1.112.0 (Claude)
- Francisco: «Pero no puedo girar la ruleta todavía»; la sala decía «La ruleta aún no gira: falta prepararla en el servidor».
- **Causa**: `piso_casino_ruleta(dia)` estaba declarada `stable`. PostgREST ejecuta las funciones `stable` e `immutable` en una transacción de solo lectura, pero esta llama a `piso_yo()`, que escribe (asegura el inventario), así que fallaba con cualquier cuenta real; la app trata cualquier error al cargar la ruleta como «sin migración». PGlite no pasa por PostgREST y las pruebas no lo vieron. Era la única función así.
- **Arreglo**: `20261205120000_casino_ruleta_volatil.sql` (874 B, `d26a0c85…c311e29f8e8`; solo `alter function … volatile`). Pegada en el SQL Editor con bytes y SHA-256 iguales al archivo; Francisco pulsó «Run» («Success»). Con la clave pública, sigue dando 42501 al anónimo. Prueba nueva: `rpc-solo-lectura.rls.test.js` (ninguna función `stable`/`immutable` que pueda llamar una cuenta usa `piso_yo()`; falla sin el arreglo y pasa con él). La app no cambia: no hace falta desplegar.
- **Commit y subida** pedidos por Francisco («Sí, haz el commit»): la migración, la prueba y esta entrada, en `main` sin forzar. **Comprobado por Francisco** con su cuenta tras recargar la app: la ruleta ya gira («Sí, gira»).

### 2026-11-11 · Migraciones del casino 3D aplicadas en producción · 1.112.0 (Claude)
- Francisco: «Tras las migraciones» (fusionar con `main` solo después de aplicarlas) y «hazlo tú». Él inició sesión en el panel del navegador; Claude pegó cada migración en el SQL Editor del proyecto `bookshelf` comprobando bytes y SHA-256 con git, y Francisco pulsó «Run» («Success»), en este orden:
  - `20261201120000_casino_ruleta.sql` (13.798 B, `3865b125…c9d4c8`)
  - `20261202120000_casino_chisteras.sql` (10.921 B, `8b937b13…4b7585`)
  - `20261203120000_casino_vitrina.sql` (5.772 B, `b48359e9…5faa5db9`): **la primera ejecución no se aplicó** (con la clave pública, `piso_casino_vitrina` y `piso_casino_vitrina_hitos` daban «not found» mientras lo de la migración 4 sí existía). Se volvió a pegar y ejecutar, y después **otra vez la 4**, porque la 3 redefine `piso_casino_vitrina_premios` y `piso_casino_vitrina_de_cuenta` en su versión sin las chisteras. Las dos son re-ejecutables.
  - `20261204120000_casino_premios_nuevos.sql` (19.312 B, `4e8c115b…b7959a7`)
- **Comprobado con la clave pública** (nunca la de servicio): dan 42501 al anónimo `piso_casino_ruleta`, `_ruleta_girar`, `piso_casino_chisteras`, `_ver`, `_elegir`, `_canjear`, `_premios`, `_ropa`, `_sellos`, `_tienda`, `_vista`, `piso_casino_vitrina`, `_premios`, `_de_cuenta`, `piso_casino_semana` y las tablas `piso_casino_chisteras`, `piso_casino_chisteras_canjes` y `piso_casino_ruleta`. Responden al anónimo, como las reglas de antes del casino (son públicas a propósito, sin datos de nadie): `piso_casino_chisteras_reglas`, `piso_casino_ruleta_casillas`, `piso_casino_lata_precios` y `piso_casino_vitrina_hitos`.
- **Publicada**: `main` avanzó sin forzar de `7b87ac0` a `c68c2a7` y `https://bookshelf-wine-iota.vercel.app/sw.js` ya sirve v1.112.0. Sin probar en móviles reales.

### 2026-11-11 · El casino en 3D, bloque e (segunda parte): los seis premios nuevos · 1.112.0 (§112), commit en la rama (Claude)
- Francisco: «Sí, la 1.112»; al verla, «Sí, apruebo» (con las cifras propuestas). Commit de 1.107 a 1.112 en la rama; sin fusionar con `main`.
- **Hecho**: dos premios en la caja (reloj de bolsillo, 180 fichas; alfombra de rombos dorados, 350) y los **sellos de las chisteras** (uno por partida perfecta) con sus cuatro premios: chistera de mago 2, varita 4, baúl de mago 6 y el acabado «Polvo de estrellas» 10, este en una copia lisa que eliges. Modelos nuevos en `furniture.js` (alfombra y baúl, vistos en el piso 3D y en el de pixel art), ropa en `actor.js`, hoja de sellos en el panel de las chisteras (`Casino.jsx`), vitrina con 35 premios y el armario «Chisteras y copas», migración `20261204120000_casino_premios_nuevos.sql` (una tabla de canjes; amplía las comprobaciones de acabado y redefine caja, ropa, aspecto válido y vitrina).
- **Aprobado por Francisco** (11-11-2026): los precios (180 y 350 fichas) y los sellos (2/4/6/10). Cada premio de las chisteras, una vez. «Polvo de estrellas» no entra en el sorteo de los sobres ni en la pared de la Lonja.
- **Queda / sin hacer**: la migración **sin aplicar** (después de la de la vitrina). Las tres prendas nuevas son complementos: no se llevan dos a la vez (chistera y varita, tampoco). Pruebas: vitest de edificio y pisoLab, 377 en verde; build en verde; e2e `v1112`, `v1111`, `v1110`, `v1107`, `v1109-ruleta`, `v1109-mapache`, `v180-casino`, `v1102`, `v1104`, `v1105` y `v170` en 360, 390, 430, escritorio y WebKit 390: 105 en verde y dos fallos a 360 (`v1110` y `v1111`, la escena se perdió con la máquina cargada) que pasan al repetirlos solos. **Sin verificar**: móviles reales.

### 2026-11-11 · El casino en 3D, bloque e (primera parte): la vitrina de premios · 1.111.0 (§111), sin commit (Claude)
- Francisco: «Sí, la vitrina».
- **Hecho**: la vitrina en 3D (`casino3d.js`: cada premio encajado en su balda, lo que falta bajo un paño; cámara delante de cada armario; tocar un premio lo agranda y lo hace girar), el panel en `Casino.jsx` (pestañas de armario, ficha del premio con cómo se gana, ver la de un amigo), la lista en `hotel/vitrina.js` y la migración `20261203120000_casino_vitrina.sql` (cuatro funciones, sin tablas). Doce hitos de adorno, cuatro por juego: **propuesta de Claude**, pendiente de que Francisco la confirme. «Pronto» fuera del letrero de la vitrina: ya no queda nada «pronto» en la sala.
- **Decisión de Claude, para que Francisco la valide**: el bloque e se parte en dos. Esta entrega es la vitrina con todo lo que ya existe; los seis premios nuevos del §4 (reloj de bolsillo y alfombra de rombos en la caja; chistera de mago, baúl, «Polvo de estrellas» y varita por partidas perfectas) van en la 1.112, porque necesitan modelos, ropa, precios y otra migración.
- **Queda / sin hacer**: la migración **sin aplicar** (después de la de las chisteras). En la vitrina la ropa sale en una figurita con la cara del personaje por defecto, no en un maniquí. Pruebas: vitest de `edificio` y `pisoLab` en verde (372, con `casino-vitrina.rls.test.js`); e2e `v1111-vitrina`, `v1110-chisteras`, `v1107-casino3d`, `v1109-mapache`, `v1109-ruleta` y `v180-casino` en verde a 360, 390, 430, escritorio y WebKit 390 (`v1107` y `v1109-mapache` adaptadas: tocar la vitrina ya te pone delante, y el mapache se espera a que llegue); build en verde. Capturas `qa-report/casino/22` a `26-vitrina-*`; vídeos `vitrina-chromium-390x844.webm` y WebKit. **Sin verificar**: móviles reales.

### 2026-11-11 · El casino en 3D, bloque d: «Las tres chisteras» · 1.110.0 (§110), sin commit (Claude)
- Francisco: «Sí, las chisteras» (el tercer juego recomendado en el plan).
- **Hecho**: el juego en la mesa de la sala (`casino3d.js`: chisteras y conejo como piezas que se mueven, cámara delante de la mesa, toque en la chistera), el panel en `Casino.jsx`, las reglas en `hotel/chisteras.js` y la migración `20261202120000_casino_chisteras.sql` (tabla, siete funciones y `piso_casino_semana` redefinida para que las chisteras cuenten en el tope de 150). Tres rondas de 3, 5 y 7 cambios; 1, 3, 6 o 10 fichas. Las cifras son **propuesta de Claude**, pendiente de que Francisco las confirme. Se quita «pronto» del letrero de las chisteras.
- **Queda / sin hacer**: la migración **sin aplicar** (la aplica Francisco, después de la de la ruleta). Las partidas perfectas solo se cuentan: sus premios (chistera de mago, baúl, acabado, varita) llegan con la vitrina (bloque e). Sin la sala 3D (sin WebGL) las chisteras no se juegan. Pruebas: vitest de `edificio` en verde (291, con `casino-chisteras.rls.test.js`); e2e `v1110-chisteras`, `v1107-casino3d`, `v1109-mapache`, `v1109-ruleta` y `v180-casino` en verde a 360, 390, 430, escritorio y WebKit 390 (59); build en verde. Capturas `qa-report/casino/17` a `21-chisteras-*`; vídeos `chisteras-chromium-390x844.webm` y WebKit. **Sin verificar**: móviles reales.

### 2026-11-10 · El casino en 3D, bloque c (cambio): el mapache crupier en 3D, la casilla más rara · 1.109.0 (§109), sin commit (Claude)
- Francisco, al ver la ruleta: «Sí, pero me gustaría que los premios más raros sean mucho más apetecibles. Por ejemplo, el último… una mascota que pueda ir contigo, como las que teníamos antes, pero tematizada de casino». Y después: «no lo quiero isométrico, lo quiero 3D» (por compañero, «mascota»), y eligió **«Modelo 3D de verdad»** frente a «como las de ahora» (los compañeros de antes son todos dibujos de píxeles, de pie en el 3D como un cartón).
- **Hecho**: la ruleta pasa a **nueve casillas** y la última, dorada, es el **mapache crupier** (2 %), compañero legendario original (antifaz, cola de anillos, visera verde, pajarita roja). Se reparten los pesos (20 fichas 28, esmoquin 7, 40 fichas 20, lámpara 6, garbanzos 20, ruleta de sobremesa 5, 80 fichas 9, reloj 3, mapache 2): **propuesta de Claude**, pendiente de que Francisco la confirme. Modelo de cajas en `src/features/edificio/mapache3d.js`; en el casino te sigue (a tu lado al andar, delante y a la vista al pararte, con malabares). Migración `20261201120000_casino_ruleta.sql` actualizada (casilla 0..8, el compañero en el inventario, su fila legendaria y `piso_casino_exclusivos` con él): **aún sin aplicar**, la aplica Francisco.
- **Después, «Sí, al piso 3D»**: el mapache también está **en el piso en primera persona** (`interior3d.js`): en el suelo, delante del sillón y a la vista, mirándote y con malabares; lo lee de quien vive en el piso, así que **quien te visita lo ve**. Con movimiento reducido, quieto.
- **Queda / sin hacer**: en la recepción del hotel y el almacén 3D todavía no sale. En el armario y el piso isométrico se ve su dibujo de píxeles, como los demás. `v188-habitacion-real` falla 2 de 3 **también sin estos cambios** (comprobado sobre el último commit en una copia aparte): el isométrico enseña 5 muebles de 11 y «Cuenta y copias» no se ve; ajeno al mapache, sin investigar. Pruebas: vitest de `edificio` en verde (dos archivos de PGlite fallaron una vez por tiempo con todo a la vez y pasan solos); e2e `v1109-mapache` (casino y piso), `v1109-ruleta`, `v1107-casino3d`, `v180-casino` y `fase1-visitas` en verde a 360, 390, 430, escritorio y WebKit 390 (la ruleta en WebKit falló una vez con todo a la vez y pasa sola); build en verde. Vídeos `qa-report/casino/mapache-chromium-390x844.webm` y `mapache-piso-chromium-390x844.webm` (y WebKit). **Sin verificar**: móviles reales.

### 2026-11-10 · El casino en 3D, bloque c: la ruleta de premios semanal · 1.109.0 (§109), sin commit (Claude)
- Francisco aprobó el bloque b («vale me parece bien continua»). **Bloque c hecho**: la ruleta de la sala se gira una vez por semana, solo a solas. El servidor sortea y da el premio antes de que la rueda se mueva; la rueda gira cinco vueltas con una frenada que solo frena y se para en la casilla decidida, dentro y lejos de la raya. Cartel de latón con las ocho casillas y su probabilidad, siempre a la vista delante de la rueda. Lo repetido, 40 fichas; las fichas de la ruleta, fuera del tope de 150; sin tickets ni sobres.
- **Propuesta de Claude, pendiente de que Francisco la confirme** al ver la entrega: las probabilidades (20 fichas 30 %, esmoquin 7 %, 40 fichas 22 %, lámpara de flecos 5 %, 100 garbanzos 20 %, ruleta de sobremesa 4 %, 80 fichas 10 %, reloj de pie art déco 2 %), el reloj como «pieza rara» y el esmoquin de terciopelo (jersey 22) como prenda exclusiva. Cambiarlas es tocar `RULETA` (ruleta.js) y la migración a la vez (la prueba de paridad avisa).
- **Migración nueva**: `supabase/migrations/20261201120000_casino_ruleta.sql` (tabla del giro semanal, `piso_casino_ruleta` y `piso_casino_ruleta_girar`, tres filas de `piso_catalogo`, y redefine `piso_personaje_valido` y `pisos_personaje_prendas` con el esmoquin). **La aplica Francisco**; sin ella la ruleta dice que aún no gira.
- Pruebas: `casino-ruleta.rls.test.js` (8) y `hotel/__tests__/ruleta.test.js` (4) en verde; e2e `v1109-ruleta`, `v1107-casino3d` y `v180-casino` en verde a 360, 390, 430, escritorio y WebKit 390 (45 pasan); vitest de `src/features/edificio` 282 en verde; build en verde. Vídeo `qa-report/casino/ruleta-chromium-390x844.webm` (y WebKit) con la rueda girando de verdad. Capturas 09 a 12 en `qa-report/casino/` y retratos de los tres muebles en `qa-report/muebles-retratos/`. **Sin commit** (bloques a, b y c). **Sin verificar**: móviles reales; la migración en el Supabase de verdad. **Sigue**: bloque d, «Las tres chisteras».

### 2026-11-10 · El casino en 3D, bloque b: «Las 21 páginas» en la mesa 3D · 1.108.0 (§108), sin commit (Claude)
- Francisco, al ver el bloque a, preguntó por los premios de la vitrina y aprobó el catálogo propuesto «aunque añadiría quizás 3-4 más», y pidió seguir con el resto de bloques. **Catálogo de la vitrina** (unos 34: los 12 de caja y lata, 4 de la ruleta, 4 de las chisteras, 2 nuevos de la caja y unas 12 copas de hitos; lo ganado iluminado y lo que falta tapado con un paño y cómo se gana) en `docs/qa/casino-3d.md` §4 y en CLAUDE.md. Los muebles nuevos necesitarán modelo 3D a la altura de la casa y migración.
- **Bloque b hecho**: la partida a solas se juega sentado en la mesa de la sala. Cámara en el taburete, cartas-página de píxel que salen del sabot y se deslizan por el paño, la tapada se da la vuelta, fichas de hoy apiladas al lado, marcador, cartel y botones encima de la escena, «Levantarse». La mesa para dos se ve en el paño con el amigo sentado en la punta con su personaje; sus jugadas siguen en el panel. Sin migración; reglas y premios, iguales.
- Pruebas: vitest de `src/features/edificio` en verde (270); `v1107-casino3d`, `v180-casino` y `v198` en verde a 360, 390, 430, escritorio y WebKit 390 (un fallo de `v180` era la prueba, que buscaba «Plano» sentado; corregida y en verde). Vídeos regrabados (`sala-chromium-390x844.webm`, `sala-webkit-390x844.webm`). En el registro del servidor de pruebas sale una vez «Error creating WebGL context» (Chromium sin GPU con varios contextos); ninguna prueba falla por ello. **Sin commit** (bloques a y b, plan, CLAUDE.md y ESTADO). **Sin verificar**: móviles reales. **Sigue**: bloque c, la ruleta semanal (migración nueva).

### 2026-11-10 · El casino en 3D, bloque a: la sala · 1.107.0 (§107), sin commit (Claude)
- Francisco respondió al plan (10-11-2026): tercer juego «Las tres chisteras»; premios «Vale»; la vitrina, lo más inmersiva posible; los amigos la ven y la ruleta se gira solo a solas (todo en CLAUDE.md, «El casino en 3D»).
- **Bloque a hecho**: la sala del casino en 3D (`hotel/casinoLayout.js`, `hotel/casino3d.js`, `hotel/casino3d.css`, montada desde `Casino.jsx`): rellano y escalera de mármol, ruleta al fondo, mesa de «Las 21 páginas» con crupier, caja con cajera, chisteras y vitrina, neones, placas de latón y «Plano». La mesa y la caja llevan a los paneles de siempre; ruleta, chisteras y vitrina dicen «pronto». Sin WebGL, la escena de antes. Sin migración.
- Pruebas: `casinoLayout.test.js` (4); `v1107-casino3d` y `v180-casino` en verde a 360, 390, 430, escritorio y WebKit 390 (27 pruebas; dos fallos a 430 y escritorio eran recargas de Vite por compilar a la vez, repetidas en verde); build y oxlint de los archivos nuevos. Vídeos regrabados con la 1.107.0. Capturas en `qa-report/casino/` y vídeos `sala-chromium-390x844.webm` y `sala-webkit-390x844.webm`. **Sin commit** (todo el bloque, el plan y esta entrada). **Sin verificar**: móviles reales. **Sigue**, si Francisco lo aprueba: bloque b, «Las 21 páginas» en una mesa 3D.

### 2026-11-10 · El casino en 3D: plan por bloques, pendiente de Francisco · sin versión, sin commit (Claude)
- Encargo de Francisco (10-11-2026): casino más grande e impactante, «Las 21 páginas» en 3D como el almacén, una ruleta de premios una vez por semana y un tercer juego a elección, todos con premios y en 3D, y los premios a la vista en una sección de la sala. **Solo el plan**: `docs/qa/casino-3d.md` (bloques a–e, 1.107 a 1.111) con las preguntas del §3 (tercer juego, premios de cada juego, si la vitrina exhibe o también se usa). No se ha tocado código. **Sin commit**: el plan y esta entrada. Ojo: los sobres siguen cerrados por la reforma, así que el sobre del casino no puede ser premio de los juegos nuevos.

### 2026-11-10 · Segunda ampliación del almacén, bloque 4: habitaciones y muebles especiales · 1.106.0 (§106), publicada (Claude)
- **Bloque 4 hecho** (encima del 1, 2 y 3, los cuatro sin commit): la sala de habitaciones llega hasta la pared de delante. Primero las habitaciones con muebles, luego **una placita** (baldosa, bancos, macetas, lámpara de araña) y, pasado un arco de madera, **el ala nueva**: cuatro habitaciones cerradas con **cortina de terciopelo** y un caballete con pizarra (Francisco pidió durante el bloque que no fueran persianas metálicas, que el pasillo no fuera plano y que lo abierto fuera antes). El pasillo de la sala lleva tarima y alfombra. Los muebles de **habitaciones especiales** (taller `heroes`) **al doble y sin rebajas** en el almacén y en la tienda. **Migración nueva `20261129120000_almacen_especiales.sql`, sin aplicar** (va después de la del bloque 3; sin ella, comprar uno de esos muebles da «el total ha cambiado» y no cobra). Arreglos de paso: la capa de letreros del almacén recorta (se podía desplazar en horizontal) y las texturas de pared se redondean. Pruebas: vitest de `src/features/edificio` y `social` en verde (324); `v1106`, `v1101`, `v199`, `v1103` y `v1105` en verde a 360, 390 (Chromium y WebKit) y escritorio. Vídeo `qa-report/almacen/habitaciones-cerradas-chromium-390x844.webm`. **Sin verificar**: móviles reales; las dos migraciones nuevas (bloques 3 y 4), solo en PGlite.

### 2026-11-10 · Segunda ampliación del almacén, bloque 3: ropa propia con tickets · 1.105.0 (§105), publicada (Claude)
- **Bloque 3 hecho** (encima del 1 y el 2, los tres sin commit): diez prendas nuevas propias de la planta (`ROPA_TIENDA` en `actor.js`, con dibujo propio), con su precio en la zona; se pagan desde la cesta, sin rebajas, todo o nada y sin cobrar dos veces. Lo de misiones, casino y estiba sigue sin venderse. La visita con un amigo manda la zona `'ropa'` y quien está abajo se ve abajo. **Migración nueva `20261128120000_almacen_ropa.sql`, sin aplicar** (la aplica Francisco; sin ella el pago avisa y no cobra). Ojo: `normalizeArmario` en `service.js` filtraba la ropa que no conocía; ya admite la de la planta. Pruebas: `almacenRopa.rls.test.js` (7/7), `plantaRopa.test.js`, vitest de `src/features/edificio` en verde; `v1105-ropa-tickets.spec.js` en verde a 390 (y `v1104`, `v1102`, `v1103`, `v1101`, `v199` siguen en verde a 390). Quien te acompaña abajo lleva una cesta al brazo, no la carretilla. Vídeo `qa-report/almacen/ropa-tickets-chromium-390x844.webm`. **Sin verificar**: móviles reales; la migración, solo en PGlite. **Sigue**: bloque 4 (habitaciones más grandes y cerradas, muebles especiales al doble y sin rebajas; migración).

### 2026-11-10 · Segunda ampliación del almacén, bloque 2: la planta de ropa · 1.104.0 (§104), publicada (Claude)
- **Bloque 2 hecho** (encima del 1, los dos sin commit): la planta −1 con cuatro zonas de ropa (Jerséis, Pantalones, Gafas y complementos, Fiesta y faena), escaparate con cuatro maniquíes y **los probadores movidos abajo** (arriba ya no están). Tocar el letrero de una zona anda hasta ella y abre su papel: cada prenda con su muestra y de dónde sale («De serie», «Ya es tuya» o cómo se gana). **Cesta** de hasta 8 prendas (barra y cesta de mimbre en 3D abajo; en el dispositivo, `bookshelf:almacen-cesta`); con ella, al probador: lo que no es tuyo se prueba marcado, pero no se guarda. Todavía no se vende ropa (bloque 3). Archivos nuevos: `hotel/plantaRopa.js` (plano y reglas) y `hotel/RopaPapeles.jsx` (papeles; no llamarlo `PlantaRopa.jsx`: en Windows choca con `plantaRopa.js`). `place()` del motor ahora avisa con `onMove` (cambia la planta en la interfaz). Sin migración. Pruebas: `v1104-planta-ropa.spec.js` (capturas 60–69, cesta y vídeo con `ALMACEN_VIDEO=1`), `v1102-probador` actualizada al probador de abajo; `v1103-escaleras`, `v1101-habitaciones` y `v199-almacen` en verde a 390. **Sin verificar**: móviles reales.

### 2026-11-10 · Segunda ampliación del almacén, bloque 1: escaleras mecánicas y planta de abajo · 1.103.0 (§103), publicada (Claude)
- Encargo de Francisco del 10-11-2026 (resumen en CLAUDE.md, «La Lonja», «Segunda ampliación»), por bloques con capturas. **Bloque 1 hecho**: dos escaleras mecánicas junto a la pared derecha nada más entrar (bajada y subida, peldaños que se mueven, se ve el viaje entero) y la planta de abajo vacía, con su red de pasillos. Con muebles en el carrito no se baja: aviso «pasa por caja» con «Ir a caja». Sin migración. Pruebas: vitest `almacenLayout.test.js` (5/5), `v1103-escaleras.spec.js` en verde a 390 y escritorio; `v199-almacen`, `v1101-habitaciones` y `v1102-probador` en verde a 390. Vídeo `qa-report/almacen/escaleras-chromium-390x844.webm`. Capturas 50–59 en `qa-report/almacen/`. **Siguen**: bloque 2 (la planta de ropa por zonas, cesta y probadores movidos abajo), bloque 3 (ropa nueva con tickets; migración, que también llevará la planta en el pulso de la visita) y bloque 4 (más habitaciones, cerradas por ahora, y los muebles especiales al doble y sin rebajas; migración). **Sin verificar**: móviles reales.

### 2026-11-10 · El Almacén del Puerto (la Lonja en 3D) · 1.99.0 a 1.102.0 (§99 a §102), publicada (Claude)
- **Publicada** (10-11-2026, «sube a main lo que reste»): `origin/main` avanzó sin forzar de `0c6a6da` a `a166e1c` (también la rama `1.90-escritorio-puerto`); `/sw.js` de producción sirve v1.102.0. El `main` local de la carpeta `bookshelf` está atrasado y tiene cambios sin commit de antes: no se ha tocado.
- **Migraciones aplicadas** (10-11-2026, «vale preparalas»): Claude pegó en el SQL Editor del proyecto `bookshelf`, una a una y en orden, `20261124120000_hotel_almacen.sql` (22.619 B, `e0d852b8…54ebc9`), `20261125120000_almacen_ofertas.sql` (8.953 B, `164ed0cb…8d80ff`) y `20261126120000_almacen_heroes.sql` (3.046 B, `22ce2694…a681f`), con bytes y SHA-256 iguales a git; Francisco pulsó «Run» en cada una («Success»). Con la clave pública, las 13 funciones nuevas o cambiadas, las cuatro tablas del almacén y `piso_catalogo` dan 42501 al anónimo. **Corrección aplicada el mismo día**: `piso_almacen_pulso` limitaba la x de la visita a 18 (la pared de la nave) y con un amigo en las habitaciones o el probador se le veía en la pared. `20261127120000_almacen_pulso_habitaciones.sql` (3.958 B, `0cf3ff5c…0392a`) sube el límite a 29,5 (`HAB.x1`); pegada y comprobada igual, Francisco pulsó «Run» («Success») y el anónimo sigue recibiendo 42501. El simulador (`mockSupabase.js`) y `almacen.rls.test.js` (17/17) usan el límite nuevo; `v199-almacen` (visita) en verde. **Sin commit todavía** (migración, simulador, prueba y este ESTADO).
- **Commit** (10-11-2026, «Sí, a commit»): todo el almacén de una vez, de la 1.99 al probador de la 1.102. Sin subir ni fusionar con `main`: falta que Francisco apruebe la entrega para producción y aplique, por orden, `20261124120000_hotel_almacen.sql`, `20261125120000_almacen_ofertas.sql` y `20261126120000_almacen_heroes.sql`. `.claude/launch.json` se queda fuera del commit (configuración local).
Encargo de Francisco (pegado entero en la conversación): la Lonja pasa a ser un almacén de muebles 3D con carrito, caja,
minijuego diario «Sella el albarán» y visita con un amigo.
- **Terminado (segunda sesión):** escena ajustada con capturas (caja que enmarca al cajero, letreros dentro de la pantalla, emblema
  limpio); RPC del almacén en `mockSupabase.js` (con `cortar`/`caida` para simular fallos de red); aviso de invitación en
  `EdificioPanel.jsx` («Ir al almacén», deja de preguntar si no hay migración); `v184-lonja`, `v186-estiba` y `v186-tablon` entran por
  el almacén y «Mercadillo»; `e2e-community/v199-almacen.spec.js` (capturas 360/390/430/escritorio; recorrido, saldo, doble toque,
  red, albarán con recarga, visita con dos cuentas y aviso, en Chromium y WebKit 390) en verde. Vídeos `qa-report/almacen/recorrido-*.webm`
  (`ALMACEN_VIDEO=1`). Versión 1.99.0 y SPEC §99. **Sin verificar:** móviles reales; el fallo de `v186-tablon` del sofá es anterior (1.97).
- **Retoque de la interfaz** (Francisco: «me gusta mucho… pero quiero que la interfaz sea un poco más atractiva y los menús también»; muebles y distribución, sin cambios): cara propia de almacén en `almacen.css`. Papeles de estraza con rótulo verde, antetítulo e icono; ficha con muestra en tarima y precio en sello rojo, tonos en muestrario; directorio en fichas por pasillo; carrito con cinta de total; caja con bocadillo del cajero, ticket a máquina (Courier Prime) y sello «Pagado»; albarán en hoja azul de papel carbón con los premios a la vista y botón de sello. Barra como balda metálica verde con la Caja en el centro (placa de latón con el total) y chapa roja con el número del carrito. Letreros de la escena: pasillo con su número, señales amarillas con flecha y etiquetas de estraza con el precio. Comparativa en `qa-report/almacen/comparativa-interfaz.png` (capturas anteriores en `antes/`).
- **Minijuego más vivo** (Francisco: «que sea más divertido e interactivo»; los menús nuevos le gustan más que los de antes): cinta con los muebles del carrito en los planos, sello de goma que baja, tinta donde cae, «¡Clavado!/¡Sellado!/Fuera de la casilla», albarán que se llena, descuento estampado al cerrar y hoja sellada en la caja; sonidos en `hotel/albaranSfx.js`. Tiempos del servidor sin cambios. Capturas 14, 14b, 14c y 15 en `qa-report/almacen/`. Sonido sin escuchar (aquí no hay altavoces que comprobar).
- **Albarán en el mostrador 3D** (Francisco: «que la cámara se acercase a la caja… sin abrir nada externo»): `almacen3d.js` monta cinta, sello con riel, marca y planos (`mostrador()`, `albaran()`, `juego()`); `SellaAlbaran` con `escena` deja solo letrero, planos y botón (`.alm-juego`), y `Almacen.jsx` entra y sale del modo (`data-mostrador`). El acierto se calcula con el reloj al tocar. Pruebas: el albarán se lee de `data-pos`/`data-marca` de `.alb`. Sin 3D y al mirar a un amigo, la versión 2D. Sin commit, a la espera de que Francisco lo vea.
- **Ampliación del almacén, bloque 1** (9-11-2026, sin commit): carro de plataforma en 3D pegado a la cámara con un paquete por unidad del carrito (hasta 8) y la pegatina del mueble; tocarlo abre el carrito (la carretilla de la esquina solo queda sin 3D; el botón Carrito de la barra lleva el nombre accesible con la cuenta). El albarán de la caja es un resguardo grapado: una línea con «Jugar», «Sin prisa» y «¿Cómo va?» plegado. Capturas 8b, 9 y 15 y vídeos de nuevo en qa-report/almacen. **Siguen** (por bloques con capturas): ofertas del día y de la semana (servidor, migración nueva), zona de habitaciones temáticas con la de superhéroes y sus muebles nuevos, y el probador. Cifras y decisiones en CLAUDE.md (La Lonja).
- **Bloque 2, ofertas (1.100.0, sin commit)**: migración nueva `supabase/migrations/20261125120000_almacen_ofertas.sql` (la aplica Francisco, después de la del almacén): `piso_almacen_ofertas_de(dia)` (4 del día −20 %, 1 de la semana −50 %, hash del día/semana), el estado trae `ofertas` y `semana_hasta`, y la compra cobra el precio de oferta y guarda `ahorro`. Cliente: `hotel/ofertas.js`; ofertas en etiquetas, ficha, directorio, carrito, caja y recibo. El carro se dibuja en una segunda pasada (capa 1) para no meterse en los muebles. Vitest del edificio: 244/245; el que falla (casino, «el tope de la semana») falla igual sin esta migración, no es de esto. **Sigue**: zona de habitaciones temáticas con superhéroes, y el probador.
- **Bloque 3, las habitaciones y Capa y Antifaz (1.101.0, SPEC §101, sin commit)**: seis muebles nuevos de superhéroes (`catalog.js` con `coleccion: 'heroes'`, formas en `furniture.js`, el sillón con la tapicería de la casa en `interior3d.js`), taller nuevo «Capa y Antifaz» con `placa-heroes`, y migración `supabase/migrations/20261126120000_almacen_heroes.sql` (la aplica Francisco, después de la de ofertas; SHA-256 `22ce26943db86a2acf81a8e157fd36a9f53c1941a10c8f92a91f29512dfa681f`). No entran en los sobres (cerrados); **al reabrirlos, `piso_abrir_sobre` tiene que dejarlos fuera también en el servidor**. En el almacén, una sala contigua por un paso en la pared derecha, con el pasillo 4: Capa y Antifaz con su rincón (escenario, maniquí, foco y mural de la ciudad con la señal), el Estudio con vistas y la Salita de tarde. Pruebas: vitest del edificio 244/245 (el del casino, anterior), `v1101-habitaciones.spec.js` y `reforma-tienda.spec.js` (20 muebles). Ayudantes del almacén movidos a `e2e-community/almacenHelpers.js`. Retratos en `qa-report/heroes-retratos.png`; capturas 30–38 en `qa-report/almacen/`.
- **Bloque 4, el probador (1.102.0, SPEC §102, sin commit, 10-11-2026)**: espejo grande de pie y dos cabinas con cortina en la entrada de las habitaciones (`PROBADOR` en `almacenLayout.js`, `buildProbador` en `almacen3d.js`). El letrero «Probador» lleva andando al espejo, la cámara se pone delante y tu personaje sale reflejado (`probador()`/`vestir()`); el papel (`hotel/Probador.jsx`, filas en `hotel/ropa.js`) enseña solo la ropa de serie, la ganada y la puesta, y «Listo, me lo quedo» guarda con `savePersonaje`. `loadMiPersonaje()` nuevo en `service.js`. No cuenta misiones ni toca monedas; sin migración. Los sitios (rótulo y toque) ahora también filtran por lado de la pared. Pruebas: `v1102-probador.spec.js` y las del almacén. **Sin verificar**: móviles reales.
- Lo de la primera sesión:
- `hotel/almacenLayout.js` (plano, pasillos, expositores, rutas), `hotel/almacen3d.js` (escena), `hotel/Almacen.jsx`
  (vista, ficha, directorio, carrito, caja, mercadillo, visita), `hotel/AlmacenCaja.jsx` (caja y minijuego), `hotel/albaran.js`,
  `hotel/almacen.css` (primera pasada). `GranHotel.jsx` abre `<Almacen>` en la sala 'lonja'; la Lonja de siempre sigue entera
  como «Mercadillo y estiba» (en el muelle y en la barra). Rótulos de la planta «E» cambiados en `Vestibulo.jsx` y `hotelView.js`.
- Migración `20261124120000_hotel_almacen.sql` (la aplica Francisco) y su prueba `__tests__/almacen.rls.test.js` (13 en verde).
- Servicios nuevos al final de `service.js`. `npm run build` pasa.
No desplegar ni pasar a `main` sin que Francisco lo diga.

### 2026-11-09 · Recepción del Gran Hotel en 3D · 1.98.0 (§98), aprobada por Francisco («Sí, publícala») y subida a `main` desde la rama `1.90-escritorio-puerto`

- **Encargo de Francisco:** al llegar al rascacielos (el Gran Hotel), entrar en la recepción recreada en 3D como la habitación, con botones del diseño de la recepción; plan primero, avance por bloques con capturas, qué hacer con la vista isométrica y dónde va la cámara.
- **Hecho:** regla «No ampliar todavía el contenido del rascacielos» levantada en `CLAUDE.md`; capturas del estado actual a 390 px en `qa-report/recepcion3d/antes/` con `e2e-community/recepcion3d-capturas.spec.js` (`ETAPA=antes|bloque1|…`).
- **Plan aprobado** («Sí, empieza»): 1) la sala, 2) muebles y personas, 3) tocar y botones art déco, 4) integración (entrar desde la fachada, «Plano» isométrico como alternativa y respaldo sin WebGL), vídeo y 1.98.0. Cámara: de pie (ojos a 2,1) en la entrada, esquina (9,7; 7,25), mirando entre la recepción y el ascensor; giro del carrito al guardarropa.
- **Bloque 1 hecho, a la espera de que Francisco lo vea:** `hotel/recepcion3d.js` (sala con texturas de píxel y luz pintada, apliques, araña, ventanales y entrada; arrastre y flechas) y `hotel/lobbyLayout.js` (medidas y colores que ahora comparten `lobbyArt.js` y el 3D). Solo en `dev/recepcion3d.html`; la app aún no lo enseña. Evidencias en `qa-report/recepcion3d/bloque1/` (capturas, comparativa y vídeo). Build, oxlint y `v175-vestibulo` a 390 en Chromium, verdes.
- **Bloque 2 hecho («Sí, bloque 2»), a la espera de que Francisco lo vea:** en `recepcion3d.js` (`furnish`), el ascensor con su esfera, el casillero, el conserje, el mostrador, el tablón, el guardarropa, el diván, las palmeras, el carrito y la huésped, con calcomanías para lo dibujado sobre una cara; araña con cristales. **La huésped se movió** a (6,15; 1,4), junto al ascensor, en las dos vistas (tapaba al conserje desde la entrada). Evidencias en `qa-report/recepcion3d/bloque2/`. Mismas pruebas, verdes.
- **Más detalle (Francisco: personajes más detallados y el mueble de detrás del conserje con más detalle y profundidad):** casillero con huecos de verdad (fondo, baldas, separadores, plaquitas, llaves con borla, cartas y paquetes), aparador de cajones y copete con abanico; conserje con chaqueta entallada, charreteras, pechera, pajarita, botones, bocamangas, orejas, nariz, patillas, bigote y gorra de plato con visera; huésped con abrigo de vuelo, cinturón, cuello de piel, bolso, melena con flequillo, sombrero con pluma y la mano en el asa de la maleta. Las pilastras ya no atraviesan el casillero. `view(ojos, punto)` en la API del 3D para mirar de cerca (lo usará el bloque 3). Evidencias en `qa-report/recepcion3d/bloque2b/`. Mismas pruebas, verdes.
- **Bloque 3 · tocar las cosas (hecho, sin commit):** al tocar el vestíbulo en la fachada se entra ya en la recepción en 3D (`RecepcionVista.jsx`; no se llama `Recepcion3D.jsx` porque Windows la confunde con `recepcion3d.js`). Letreros de latón sobre recepción, ascensor, tablón y guardarropa, que siguen a la vista. Tocar una cosa (en la escena, en su letrero o en la barra de nogal de abajo: «Encargos de la semana» en terciopelo y tres iconos de píxel) acerca la cámara y abre su papel crema con marco de latón: los mismos encargos, la botonera del ascensor y «Abre pronto» del plano. Lo enfocado queda en el hueco que deja el papel (desplazamiento de lente, `focus(id, top)`). «Volver», tocar fuera o Escape vuelven a la entrada; otro Escape sale a la plaza. «Plano» cambia al isométrico (se recuerda en el dispositivo, `bookshelf:vestibulo-vista`) y su placa «Entrar en la recepción» vuelve al 3D; sin WebGL o si se pierde la GPU, el plano. `v175-vestibulo` siembra «plano» porque prueba el isométrico. Evidencias en `qa-report/recepcion3d/bloque3/` (comparativa-bloque3.png, 20–25, vídeos `video/` y `video-app/`). Build, oxlint de los archivos del hotel, `v175-vestibulo` y `recepcion3d-capturas` (7) verdes a 390 px en Chromium; sin probar en 360/430, escritorio ni WebKit. Falta el bloque 4 (integración, recorrido completo, versión 1.98.0).
- **El ascensor por dentro (Francisco: «cuando presiones el ascensor se abra y entres a él, que sea todo muy lujoso y veas las opciones como si fuesen los botones de él»; hecho, sin commit):** el ascensor ya no abre un papel. La cámara llega delante, las dos hojas de latón se deslizan, se entra en la cabina mirando al fondo y se gira hacia la botonera. Con movimiento reducido, directo. La cabina (`buildCabina` en `recepcion3d.js`, detrás de la pared del fondo, con su propia luz) tiene nogal con marquetería e hilos de latón, espejos biselados, friso en zigzag, un sol de marquetería en el fondo, banco de terciopelo granate, pasamanos de latón, suelo de mármol verde con una estrella de ocho puntas y un plafón de abanico. Los botones son la botonera de siempre (`Ascensor` de `Vestibulo.jsx`), colocados justo encima de la placa de latón de la pared derecha (`plateRect()`); lo que hay en cada planta va en una placa de nogal debajo, y «Salir del ascensor» (o Escape) vuelve: se sale de espaldas y se cierran las puertas. Dentro no hay barra de abajo ni «Plano», y tocar la cabina no saca de ella. Evidencias en `qa-report/recepcion3d/bloque3b/` (comparativa-ascensor.png, 16–18, 22 y 22b, `video-app/bloque3b-ascensor.webm`). Build, oxlint y las pruebas de `recepcion3d-capturas` (7) y `v175-vestibulo` verdes a 390 px en Chromium. Sin probar en otros tamaños, en WebKit ni en un móvil real. Pendiente: el bloque 4.
- **Bloque 4 · integración (hecho, sin commit; versión 1.98.0, SPEC §98):** dentro de la cabina, al pulsar una planta abierta la aguja va hasta ella («Bajando al casino del sótano…») y luego se llega. Sin WebGL se abre el plano, comprobado anulando `getContext`. En escritorio el alto llega al pie del panel y la barra ya no se corta. `preserveDrawingBuffer`: el WebKit de Playwright en Windows no presentaba los fotogramas nuevos (la escena se quedaba en la entrada); con él se ve bien. Prueba nueva `e2e-community/v198-recepcion3d.spec.js`: 360, 390, 430 y escritorio en Chromium, y WebKit a 390, más casino desde la cabina y sin WebGL. `v180-casino` («la «S» del ascensor») baja ahora desde la cabina en 3D. Pasan build, oxlint, `v198-recepcion3d`, `v175-vestibulo` y `v180-casino` en 360, 390, 430, escritorio y WebKit 390 (31 pruebas; la de `v180` que fallaba por la pestaña isométrica, corregida y verde en Chromium y WebKit), además de `v174-limusina` y `v177-hotel-directorio` en Chromium y WebKit a 390. Evidencias en `qa-report/recepcion3d/bloque4/` (comparativa-tamanos.png, comparativa-escritorio.png y `video-app/bloque4-recorrido-completo.webm`, de la casa al casino). **Sin verificar:** móviles reales (iPhone, Android), rendimiento en un móvil modesto y WebKit en otros tamaños. Aprobada por Francisco («Sí, publícala»): commit y avance rápido de `main` con la rama (también subida a GitHub como `1.90-escritorio-puerto`). Despliegue comprobado: `https://bookshelf-wine-iota.vercel.app/sw.js` trae v1.98.0. Sin migraciones.

### 2026-11-09 · Reestructuración de muebles · 1.97.0, publicada

Entrega por evidencias de los bloques 1 a 3 y los sobres cerrados; aprobada por Francisco («Vale, me parece bien»). Los vídeos de la tienda y el casino entran por la experiencia anterior (las pruebas locales arrancan ahí); Francisco no quiso regrabarlos.
- **Versión 1.97.0** en `diag.js`, `package.json`, `sw.js` y SPEC (§97).
- **Arreglo de paso:** «Sustituir» en Esenciales ya no ofrece modelos retirados (`opcionesDe` en `esenciales.js`; la mecedora se ofrecía y luego no se dibujaba).
- **Evidencias:** vídeos en `qa-report/reforma-muebles/videos/` (piso en primera persona y balda, tienda con sobres cerrados, caja y lata del casino), comparativas en `comparativa/` y hojas en `zonas/`.
- **E2E ajustadas a lo retirado:** `v166` (mudanza sin silla ni banco), `v170` (el mueble nuevo es un sillón), `v180` (la lata en reforma), `v189` (sin mecedora para sustituir), `e2e/edificio-puerto` (lámpara de pie en vez de la de mesa y la planta; sagas, saltada). Las de abrir sobres se saltan con `SOBRES_CERRADOS`.
- **Comprobado:** build; Vitest de `edificio` y `pisoLab` (301 pasan, 1 falla que ya fallaba: `casino.rls` «el tope de la semana»); e2e de comunidad v166, v167, v170, v173, v176, v178, v180, v186, v189 y las dos de la reforma a 390 en Chromium (falla `v189` «un piso antiguo sin esenciales», que también falla en la 1.96: hay dos botones «Decorar»); `e2e/edificio-puerto` (7 pasan, 1 saltada). Solo emulación. oxlint: sin errores nuevos (los de `src/vendor/pixelfx` ya estaban).
- **Migración aplicada** (`20261123120000_muebles_reforma.sql`, SHA-256 comprobado en el SQL Editor; Francisco pulsó Run, sin errores). Con la clave pública, `piso_retirados`, `piso_retirado`, `piso_abrir_sobre` y `piso_comprar` dan 42501 al anónimo.

### 2026-11-09 · Reestructuración de muebles, bloque 3 (paredes) · sin commit, en la rama `1.90-escritorio-puerto`

- **Causa:** en el piso 3D, tres paredes (fondo, izquierda y derecha) llevan la lámina dibujada con el color elegido y la luz de las lámparas (`wallTexture`), pero la cuarta, la de enfrente, era solo la caja del armazón, con el color crudo y sin luz: se veía rosada frente al gris claro de las demás.
- **Hecho:** cuarta lámina `frente` en `WALLS` (`interior3d.js`) y en `wallPlates` (`materials.js`): el mismo dibujo, la misma luz y la misma hora; solo cambian las sombras de cada pared. La vista isométrica no cambia.
- **Pruebas:** build, oxlint y Vitest de `pisoLab` y `edificio` (301 pasan; falla `casino.rls` «el tope de la semana», que ya fallaba). Capturas en primera persona en `qa-report/reforma-muebles/comparativa/1-primera-persona-*` y `zonas/paredes-despues.png`. Solo de tarde y con el yeso por defecto; noche y otros colores, sin capturar.

### 2026-11-09 · Reestructuración de muebles, bloque 2 (por zonas) · sin commit, en la rama `1.90-escritorio-puerto`

- **Hecho:** `ZONAS` y `zonaOf` en `catalog.js`: rincón de lectura, salón, dormitorio y estudio, más «Paredes y suelo» (lo de pared y las alfombras, junto a los colores y el suelo, en la pestaña de la casa). `cat` no cambia, porque lo usan los sobres y la paridad con el servidor. La balda (`piso.js`) y «Tu mudanza» (`StarterPicker.jsx`) agrupan por zona; los místicos siguen en su pestaña, solo si tienes alguno. Sin pestañas vacías: hoy **no sale «Dormitorio»** (cama, mesilla, cómoda, baúl, perchero y lámpara de mesa están en reforma); vuelve cuando se rehaga alguno.
- **Pruebas:** `zonas.test.js` (4) y Vitest de `edificio` y `pisoLab` (sigue fallando solo `casino.rls` «el tope de la semana»). `reforma-muebles.spec` a 390 px; hojas en `qa-report/reforma-muebles/zonas/` (antes por tipo y después por zonas). En `despues/` quedan capturas viejas del bloque 1 con nombres de pestaña de entonces.

### 2026-11-09 · Reestructuración de muebles: sobres cerrados por reforma · sin commit, en la rama `1.90-escritorio-puerto`

Decisión de Francisco («Cerrarlos por reforma»), escrita en `CLAUDE.md`.
- **Migración nueva, sin aplicar ni publicar:** `20261123120000_muebles_reforma.sql` (la genera `migracion-reforma.mjs`, del scratchpad de esta sesión). `piso_retirados()` con los 63 retirados (solo para el servidor), `piso_abrir_sobre` cerrado (también el sobre de la caja del casino) y una comprobación al empezar en `piso_comprar`, `piso_casino_canjear`, `piso_casino_lata_canjear`, `piso_regalar` y `piso_lonja_poner` (copias literales de su última versión). No borra ni cambia datos. Para reabrir los sobres, volver a crear la función de `20261115120000_edificio_acabados.sql`.
- **Cliente:** `SOBRES_CERRADOS` en `economy.js`; la tienda enseña «Cerrado por reforma» sin botones de abrir ni probabilidades (muebles y reciclaje siguen); en la caja y la lata del casino, el sobre y los muebles retirados llevan el sello «En reforma».
- **Pruebas:** `reforma.rls.test.js` (PGlite: paridad con `RETIRADOS`, sobres cerrados sin cobrar, nada retirado se da, nada se borra). Las pruebas RLS de sobres, tienda, místicos, acabados, Lonja, regalos y casino cargan todo menos esta migración (`{ sin: [REFORMA_MUEBLES] }` en `supabaseHarness.js`), porque prueban las reglas para cuando se reabran. Vitest de `edificio` y `pisoLab`: 297 pasan; falla `casino.rls` «el tope de la semana», que ya fallaba. Las e2e que abren sobres (v167, v173, v176 ×2, v178, v180 caja, v186) se saltan con `SOBRES_CERRADOS`. Nueva `e2e-community/reforma-tienda.spec.js` (2 pasan a 390 en Chromium), con capturas en `qa-report/reforma-muebles/comparativa/` (4, 5 y 6).
- **Sigue pendiente de decidir:** talleres (piden muebles retirados), puestos de la Lonja ya puestos con algo retirado (`piso_lonja_aceptar` no se ha tocado), si el reciclaje debe enseñar copias retiradas, y que en la Lonja aún se puede *pedir* un mueble retirado.

### 2026-11-09 · Reestructuración de muebles, bloque 1 (retirar) · sin commit, en la rama `1.90-escritorio-puerto`

Encargo de Francisco: fuera las sagas y los muebles que no estén a la altura de los de la casa, divididos por zonas y con las cuatro paredes del 3D del mismo color, enseñándolo poco a poco. Eligió la propuesta tras ver la galería (`e2e-community/muebles-galeria.spec.js`, hojas en `qa-report/muebles-hojas/`).
- **Hecho (sin commit):** `EN_REFORMA` (39 muebles hechos de cajas) y todas las piezas de saga entran en `RETIRADOS` (`retirados.js`): no se dibujan ni se ofrecen en balda, tienda, mudanza inicial ni para poner en la Lonja, y el piso guardado no cambia. Sin pestaña «Sagas» y sin pestañas vacías en la balda. Quedan 14 muebles a la venta: los 7 de la casa y lo de pared con dibujo.
- **Evidencias:** `e2e-community/reforma-muebles.spec.js` (antes en una copia de la 1.96 y después), comparativa en `qa-report/reforma-muebles/comparativa/`.
- **Pruebas:** build y Vitest de `edificio` y `pisoLab` (291 pasan; falla `casino.rls` «el tope de la semana», que ya fallaba). `retirados.test` usa ahora la lámpara de pie en vez de la silla, que está retirada.
- **Pendiente de decidir con Francisco antes de publicar:** los sobres se quedan sin raros ni poco comunes de suelo y el de «Balcón» vacío, y el servidor seguiría dando muebles retirados (no conoce `RETIRADOS`); los seis talleres piden muebles retirados y no se pueden completar; los puestos de otros en la Lonja aún pueden ofrecer algo retirado. Hace falta una migración.
- **Siguen:** bloque 2, división por zonas de la casa; bloque 3, paredes del mismo color (en el 3D la del fondo sale gris y las demás rosadas).

### 2026-11-09 · Dibujos en el tablón · 1.96.0, publicada

Aprobada por Francisco tras revisar capturas y vídeo.
- **Hecho:** quien visita puede dejar un dibujo en vez de un post-it (mismo cupo diario) y el dueño dibujar en su tablón desde Añadir. Se guardan como trazos (`dibujo.js`, `Dibujar.jsx`), con hoja o forma recortada: elige quien dibuja y el dueño puede cambiarlo en Editar. Se ve en el lienzo, la visita y la habitación.
- **Migración aplicada, junto con la de libros expuestos:** `20261122120000_tablon_dibujos.sql`, comprobada con la clave pública.
- **Decisión de Francisco:** levanta el veto al dibujo libre; regla escrita en `CLAUDE.md`.
- **Sin firma en la tarjeta:** el dibujo recibido no enseña «De…» en el corcho, solo en su detalle.
- **Sin moderación automática:** solo denuncia, bloqueo, retirada y permiso para exponerlo.
- **Pruebas:** `npx vitest run src/features/tablon` (con RLS sobre PGlite) y `tablon.spec` en Chromium y WebKit a 390 px. Solo emulación.

### 2026-11-09 · Tablón en el escritorio, nitidez, bandeja y libros expuestos · 1.96.0, publicada

Publicado junto con los dibujos. Incluye la entrada siguiente.
- **Hecho:** el tablón va montado sobre el monitor del escritorio que tiene el ordenador, con relieve; deja de colocarse aparte (lo guardado antes se ignora, sin borrar datos). El contenido se superpone en DOM a alta resolución (`.plab-board-sharp` en `interior3d.js`, con `matrix3d`). Bandeja de diseño encuadrada, con Alejar y Acercar solo con icono. La visita añade lo expuesto en la estantería (`expuestos.js`).
- **Migración aplicada:** `20261121120000_piso_expuestos.sql`, comprobada con la clave pública.
- **Decisión a confirmar:** «lo que decide compartir» sigue siendo lo elegido en su rincón y las colecciones visibles. La lectura actual no se publica como expuesta.
- **Pruebas:** build, oxlint, Vitest de `pisoLab`, `tablon` y `social` (149, con RLS sobre PGlite) y `tablon`, `fase1-visitas` y `visita-directa` en Chromium y WebKit a 390 px (32 pasan, 4 omitidas). Solo emulación. WebKit en Windows no dibuja bien `matrix3d` (§4 de `CLAUDE.md`): la nitidez en iPhone está sin comprobar.

### 2026-11-09 · Biblioteca del visitante en solo lectura · 1.96.0, publicada

Publicado junto con los dibujos.
- **Hecho:** «Ver toda la biblioteca» de una visita usa `PisoLibrary` con la prop `visit`: portadas y lista, búsqueda y orden («Como lo comparte», título, autoría). Sin filtros por estado, Exponer, Añadir ni fechas, porque de otra persona solo llega lo que comparte. Cada fila indica su origen. `SharedLibrary` retirada; la ficha sigue siendo `VisitBookSheet` con «Añadir a pendientes».
- **Límite heredado:** «compartido» sigue siendo lo del rincón y las colecciones visibles, no toda su biblioteca.
- **Pruebas:** `fase1-visitas`, `visita-directa` y `portadas-filtros` en Chromium y WebKit a 390 px. Sin migraciones. Solo emulación.
- **Comunidad, sin empezar:** el paquete solo dice «diferencias visuales de Comunidad» y no hay lista de cuáles son; pendiente de que Francisco las concrete o apruebe compararla con las maquetas.

### 2026-11-09 · Tablón libre (paquete Tablón v2) · 1.95.0, publicada

- **Segunda vuelta (encargo de Francisco, prevalece sobre lo de abajo):** el ordenador ya no abre el tablón ni lleva icono; acceso por el mueble o por «Tablón» en el Menú del piso si está colocado. Rutas: `select:'tablon'` es la vista para mirar; `'tablon:diseno'`, diseñar; `'tablon:diseno:editar'`, el editor. Sin el segmento Ver/Organizar. Mueble de 2 casillas (1,9 × 1,42 m), textura de 1536 × 1152 y migración con `w = 2` (sigue sin aplicar). Formatos de nota en `formatOf` (`model.js`), también en `drawBoard.js`. Marco de la vista en 4:3, como el mueble.

Aprobada por Francisco tras revisar capturas y vídeo a 390 px.
- **Hecho:** mueble «Tablón» opcional en Decorar (especial, gratis, fuera de tienda y sobres); monitor y tablón se pulsan por separado y la mesa ya no abre el ordenador ni la puerta de detrás; lienzo libre en `src/features/tablon/` (Ver/Organizar/Conectar, deshacer, lista, borrador y revisiones); icono en el ordenador; post-its con cuota atómica, Recibidas, publicación con vista previa y copia pública limpia, revocación y archivo del libro de visitas.
- **Migración `20261120120000_tablon.sql` aplicada** por Francisco el 2026-11-09 en el SQL Editor; comprobada con la clave pública.
- **Pruebas:** `e2e-community/tablon.spec.js` (Chromium y WebKit, 390 px), `src/features/tablon/__tests__/tablon.rls.test.js` (Postgres real). Build correcta. `casino.rls.test.js` («el tope de la semana») falla también sin estos cambios.
- **Sin verificar:** móviles reales, gesto de pinza con dos dedos, colocar y retirar el mueble recorriendo Decorar, y las pantallas de bloquear, denunciar y libro antiguo.
- **No había tablón v1** en este proyecto (el «Tablón» de la Lonja es otra cosa): no hay nada que migrar.
- **Después, según el paquete:** biblioteca del visitante en solo lectura y diferencias visuales de Comunidad.


### 2026-11-09 · Visitar abre el piso y portadas estables al filtrar · 1.94.0, publicada tras aprobar la entrega («Sí, publícala»)

«Visitar» abre el piso con `VisitaLector` y `VisitaPiso`; retirados `ReaderVisit.jsx`, `visitScene.js` y `public/media/social-visit/`. Migración nueva `20261119120000_piso_visita.sql`, aplicada ese mismo día (decisión de Francisco: se ve el piso de quien sigues). Las pruebas antiguas `e2e-community/v158`, `v159`, `v161` y `v162` siguen describiendo la escena retirada y hay que adaptarlas. Portadas: al desmontarse por el filtro se perdía la imagen aunque constara como cargada; en la biblioteca actual (`PisoLibrary.jsx`) cada portada empezaba además como hueco y con retardo aunque ya estuviera cargada. `BookItem.jsx` guarda hasta 300 ya decodificadas y recoloca el mismo elemento `<img>`. «Abrir Mi biblioteca» desde tu piso ya no lleva a la biblioteca antigua. Pruebas: `visita-directa.spec.js`, `portadas-filtros.spec.js`, `pisoVisita.rls.test.js`. Solo emulación.

### 2026-11-09 · Diario del ordenador como cuaderno · 1.93.0, publicada tras aprobar la entrega («Sí, publícala»)

`DiaryNotebook` en `DiaryApp.jsx` (pestañas Hoy, «Notas y citas» y Reseñas; editor en la misma app), acabado en `literario.css` y retorno desde la ficha en `App.jsx`. Calendario, estadísticas, habitación y wrap-up, sin tocar. Datos sin cambios: siguen siendo `book.quotes` y `book.review`. Prueba y capturas: `e2e-community/diario-cuaderno.spec.js`, `qa-report/diario-cuaderno/`. Solo emulación; sin probar en móviles reales ni con teclado real.

### 2026-11-09 · acabado de la ficha y del registro, Favoritos y Recuerdo · 1.93.0, publicada tras aprobar la entrega

Campos, botones, desplegables y selección unificados en `src/theme/literario.css` (ficha, registro, «Notas y citas» y «Reseña»). En «Mi lectura», el recorrido y las sesiones van primero (5 días y «Ver registros anteriores») y Ajustar posición, EPUB, Sobre el libro y Datos de la edición quedan plegados en esa pestaña. El aviso «Deshacer» ya no flota sobre el título. En «Tu mes en libros», «Favoritos» pasa a tarjetas con medalla CSS y mandos con nombre, y «Recuerdo» a página de cuaderno con estado de guardado visible; resumen y exportación, sin cambios. El Diario del ordenador es un cuaderno (`DiaryNotebook` en `DiaryApp.jsx`) con pestañas Hoy, «Notas y citas» y Reseñas. Decisión de Francisco (9-11-2026): notas y citas siguen siendo un solo tipo de anotación, en una pestaña conjunta, y «Hoy» va primero. Prueba y capturas: `e2e-community/ficha-acabado.spec.js`, `qa-report/ficha-acabado/`.

### 2026-11-08 · Fase 3 y acabado visual v4 · 1.92.0, publicada tras aprobar la entrega («Sí, publícala»)

Biblioteca con portadas y lista, ficha con pestañas, ranking de 3 favoritos por mes (`monthNotes.favorites`; `favorite` antiguo se lee como puesto 1), exportación con estados y límites, y acabado v4 (`src/theme/literario.css`, `public/assets/puerto/acabado/`). Publicada desde la rama `1.90-escritorio-puerto` con avance rápido de `main`.
Pruebas: `e2e-community/fase3`, `fase2-mes` y `acabado-v4` en verde. Pendiente: adaptar a la vista de portadas `e2e/piso-lab-grande` y 3 casos de `e2e/piso-ficha-visita` (foco tras abrir «Ajustar posición»); el caso «5.000 libros: registrar, cancelar» de `piso-lab-grande` falla en Cancelar y no está investigado. Evidencias en `qa-report/acabado-v4/`.

Segunda pasada visual, por «sigue viéndose simple»: adornos pixel originales en `public/assets/puerto/acabado/` (`rama`, `rama-oro`, `destello`, `libros`, `calendario`, `lupa`, `marco`), marco y baldas de lado a lado en biblioteca, selector de vista unido, pie «Tu biblioteca, a tu ritmo», y en el mes pestañas de carpeta, laureles, cifras con icono y marcos; también en la tarjeta PNG. Las etiquetas de cifras pasan a «libros», «páginas» y «días leyendo».
Sin verificar: WebKit no se repitió tras la segunda pasada (ya fallaba en él la prueba de `fase3` de volver a la posición de la biblioteca); tampoco móviles físicos. El resto de `fase3` y `fase2-mes` no se repitió tras el último retoque, limitado a pantallas de hasta 380 px.

Formato de cada entrada (la más reciente arriba):

```
### AAAA-MM-DD · cuenta (nombre corto) · versión
- Qué se hizo y por qué.
- Commits (hash) y si se subió a producción.
- Qué quedó a medias o sin verificar.
- Decisiones nuevas de Francisco que haya que respetar.
```

### 2026-11-08 · 1.91.1, publicada tras aprobar la entrega («Si súbelo»)

Encargo de Francisco tras ver la 1.91.0.
- **Resumen del mes:** el favorito se elige tocando la portada en la balda y se destaca en su propia balda; cifras como composición editorial; frase sobre papel rayado.
- **Navegación:** la flecha de la cabecera es la única para volver y la cabecera dice «Tu mes en libros»; cambiar de mes usa ángulos (`PixelChevron`), también en el calendario.
- **Salto de portadas:** ya estaban en caché (0 peticiones a la red); el hueco era montar y decodificar. Ahora `warmCovers` deja listas las del mes y las de los vecinos, y el mes cambia cuando se pueden pintar (espera máxima 350 ms). Medir a mano con `MEDIR_MES=salida.json` y `e2e-community/medir-mes.spec.js` sobre un build en `qa-report/dist-medir` con las variables del servidor simulado. Con CPU ×6: de 5 fotogramas y unos 60 ms con huecos a 0.
- **Tarjeta:** las portadas toman el sitio libre; con favorito o frase, la primera tarjeta lleva 8 portadas como máximo y las demás 12.
- **Calendario:** cada día con lectura dice sus páginas («18 p.») o su porcentaje.
- **Biblioteca:** cada filtro con color e icono propios y «Añadir libro» siempre a la vista.
- **Sin validar:** móvil físico; la caché y el salto solo se han medido en Chromium; primera descarga real sin caché no medida en este recorrido, porque la habitación ya pide esas portadas antes.

### 2026-11-08 · Fase 2 · 1.91.0, publicada tras aprobar la entrega (junto con la Fase 1)

Francisco aprobó la entrega («Si») tras revisar vídeo y PNG. Mar y lluvia siguen sin que él haya dicho cómo suenan.
- **Caché de portadas** (`public/sw.js`): Cache API `bookshelf-portadas-v1` (sin versión de app: sobrevive a las actualizaciones) + índice IndexedDB; 40 MiB / 300 portadas, LRU; clave estable por recurso; descargas agrupadas, 6 a la vez, visible primero; no guarda errores. Medir: `node scripts/perf-portadas.mjs salida.json` tras `npm run build`. Resultados en `qa-report/fase2/`.
- **Límites de la caché**: Google Books no envía CORS, sus portadas son opacas (se cuentan a 256 KiB, no sirven a 3D ni a la tarjeta exportada: va cubierta con título). Solo se guardan hosts públicos de `COVER_HOSTS`; no existe imagen privada de cuenta. Las copias antiguas `*-covers` se descartan una vez. SW solo en producción. WebKit sin medir. No es modo sin conexión completo.
- **«Tu mes en libros»** (`src/domain/monthSummary.js`, `src/features/monthBooks/`, botón en `PortCalendar.jsx`): notas en `progress.monthNotes['AAAA-MM']` (acción `setMonthNote`), sin migración. Tarjeta 1080×1920 en lienzo, máx. 12 portadas por tarjeta.
- **Limitación**: no existe edición de fecha de lectura: «Hay libros leídos sin fecha» solo los lista y lo explica.
- **Sin validar**: móvil físico (iPhone/Android), compartir real con `navigator.share` y teclado real (aproximado reduciendo la ventana).

### 2026-11-08 · Fase 1 · publicada dentro de la 1.91.0

- **Scroll del ordenador**: causa medida, `.pc--port .pc-win__body` con `overflow: visible` dentro de una ventana `overflow: hidden` (1.90). El cuerpo vuelve a ser el único con scroll; altura con teclado por `--vv-h`. Registrar desde el calendario vuelve a esa pantalla y a su altura. Pruebas: `e2e-community/fase1-scroll.spec.js`. Ojo: `Input.synthesizeScrollGesture` no desplaza ni una página de control aquí; usar `Input.dispatchTouchEvent`.
- **Audio**: el recorrido solo arrancaba «Dos balcones» por encima de la pista elegida. Francisco confirmó que esa es la pista antigua: el edificio ya no arranca música propia y la elegida sigue sin reiniciarse; con «Sin música», silencio. Archivo y `music.js` conservados, `v173-musica.spec.js` en pausa. Pruebas: `fase1-audio.spec.js`.
- **Mar y lluvia**: regenerados más suaves en `generate-port-audio.cjs`. **Sin escuchar**: faltan los oídos de Francisco. El mar sigue fuera de Sonido; ningún ambiente activo por defecto. Muestras en `qa-report/fase1/audio/`.
- **Visitas** (`VisitaPiso.jsx`): «Está leyendo» (solo el título que se comparte), «Biblioteca de X», grupos de 30 y biblioteca completa con ficha pública. Limitación: «compartido» sigue siendo lo del rincón y las colecciones visibles, no toda su biblioteca. Pruebas: `fase1-visitas.spec.js`.
- **Paredes**: mismo id y color base en todas las vistas; el malva de la tarde en primera persona borraba el matiz. Ajustado solo ese tinte en `materials.js`, sin tocar datos. La iso de la visita abre de día y Decorar y la 3D de tarde: sin cambiar. La luz de tarde de Decorar sigue azulada.
- **Sin validar en móvil físico** (iPhone/Android); WebKit emulado usa rueda, no toque, y el teclado se aproxima reduciendo la ventana.

### 2026-11-08 · cuenta principal · 1.90.0 «Puerto Pixel», publicada tras aprobar la entrega (rama `1.90-escritorio-puerto`, avance rápido de `main`)

- **Dónde:** rama local `1.90-escritorio-puerto` del worktree `BookShelf-piso-lab`, sobre `5114a4c` (1.89.3). Sin commit, sin subir y sin fusionar: espera la aprobación de Francisco.
- **Hecho:** tokens día/noche (`src/theme/tokens.css`, sigue a la hora del piso), `port.css`, iconos `src/ui/PortIcon.jsx`, barra inferior, menú «Tu rincón» (`PisoMenu`), `ComputerShell`, escritorio y `PortCalendar`, hoja de registro, `audioController.js`, `SoundPanel.jsx`, seis efectos y cuatro bucles originales en `public/media/sonido/` (`scripts/audio/generate-port-audio.cjs`).
- **Documentos:** `docs/audio/sonido-manifiesto.md`, `docs/qa/tabla-funciones-1.90.md`. Evidencias en `qa-report/v190/`.
- **Pruebas:** `e2e-community/v190-*.spec.js`; adaptadas al menú nuevo `piso-esenciales`, `piso-usabilidad` y `v1882-objetos`.
- **Limitaciones:** emulación; WebKit de Windows falló al poner la música; radio sigue con su comportamiento al ocultar; el equilibrio del sonido sin validar al oído; móviles físicos sin probar.
- **Puerto Pixel v2, primera fase (también sin commit):** ordenador y registro según el paquete de Francisco; capa `src/theme/puerto-pixel.css`, `src/ui/PixelIcon.jsx`, recursos en `public/assets/puerto/`; diferencias en `docs/design/puerto-pixel-v2.md`, vídeo en `qa-report/pixel-v2/`. Menú, calendario, Sonido, diario, estadísticas, biblioteca y decoración siguen pendientes hasta que apruebe esta fase. Tres pruebas de `e2e/piso-lab.spec.js` sobre tocar el libro 3D y las guías ya fallaban en 1.89.3.
- **Ajuste v3 (sin commit):** carcasa de monitor, cielo continuo (`cielo-puerto*.webp`, derivados de los fondos v2), cajón «Aplicaciones», papel cálido de noche y portadas estables (`steady` en `Cover`, `SteadyImage`). Detalle en `docs/design/puerto-pixel-v2.md`; prueba en `e2e/pixel-v3.spec.js`; vídeo en `qa-report/pixel-v3/`. Menú, calendario y sonido, en pausa hasta que Francisco revise esto.
- **Menú, calendario y radio Puerto Pixel (sin commit):** organizador de madera, agenda de anillas y radio con silencio por canal. Detalle y diferencias en `docs/design/puerto-pixel-v2.md`; prueba en `e2e-community/pixel-v4.spec.js`; evidencias en `qa-report/pixel-v4/`. Quedan diario, estadísticas, biblioteca y decoración, tras revisar esto.
- **Diario, estadísticas, biblioteca y decorar Puerto Pixel (sin commit):** capa `pp-` sobre lo existente; capturas y vídeo en `qa-report/pixel-v5/`. Mar retirado de Sonido por decisión de Francisco (archivo conservado). Revisión final con datos difíciles hecha en emulación (`e2e-community/pixel-final.spec.js`, `qa-report/pixel-final/`). Falta que Francisco apruebe esta entrega; hasta entonces, sin commit ni `main`. Sin probar: móviles físicos y cuentas reales.
- **Aprobada** por Francisco el 8-11-2026 («Si» a publicar como 1.90.0). Las menciones «sin commit» de arriba describen cada fase antes de aprobarse. Intermitente sin causa averiguada: dos pruebas de decorar en WebKit (`piso-esenciales` y `piso-usabilidad`); salen igual sin la capa de decorar.

### 2026-11-08 · cuenta principal · acabado de visitas, estantería, zona del libro y botón 3D (1.89.3, aprobada y publicada)

- **Archivos, sobre `515fc43`:** `pisoLab/interior3d.js`, `materials.js`, `shelfLayout.js`, `edificio/esenciales.js`, `piso.js`, `room.js`, `EdificioPanel.jsx`, `edificio.css`, pruebas `zonaLibro.test.js` y `v1894-*.spec.js`. Huella: `136661c029fc`.
- **Causas:** muebles lisos: sofás, camas, plantas y mesillas no tenían piel pixelada ni tinte de hora. Botón 3D: quedaba debajo de la etiqueta del piso. Respaldo: el asiento propio se dibujaba al girar.
- **Hecho:** piel común con filetes y tinte de hora; asiento oculto sentado; punto libre si no hay asiento; estantería con más aire, fondo liso, sombras limpias y lomos sin parpadeo de lejos (14 libros, igual que antes); celda del libro reservada en `GUARDIA` con sitio válido al soltar; aviso y «Dejar sitio al libro» en Decorar; «Entrar en 3D» bajo la etiqueta y «Ver en isométrica» bajo la vista 3D.
- **Limitaciones:** la celda del libro es regla de cliente, no de servidor (un piso antiguo sigue siendo válido). Con la mesa llena y sin resolver, el libro se solapa hasta usar el botón. Móviles físicos sin verificar.
- **Evidencias:** `qa-report/v1894/{antes,despues}/chromium-390x844/`. Aprobada por Francisco («Apruebo la entrega»); tras lo revisado solo cambian versión y documentación.

### 2026-11-08 · cuenta principal · 1.89.2 publicada en producción

- Aprobada por Francisco con vídeos y capturas («Apruebo la entrega»). Migración de Esenciales aplicada en el SQL Editor (SHA-256 comprobada, él pulsó «Run», sin error). `main` avanzó sin forzar a `1c5f5a6` y `/sw.js` de producción sirve la 1.89.2.
- **Sin verificar:** móviles físicos.

### 2026-11-08 · cuenta principal · pasada de arquitectura y materiales del rincón (incluida en el commit de la 1.89.2)

- **Archivos, sobre `7e0640b` y junto a la cámara del sillón:** `pisoLab/materials.js`, `pisoLab/interior3d.js` y `e2e-community/v1893-arte-rincon.spec.js`. Huella de esos dos archivos fuente: `4a3c6071e391`.
- **Hecho:** ventana con hoja interior, moldura, ménsulas, bisagras y falleba; enlucido sin repetición y sombras en uniones; viguetas y cornisa escalonada; mesas con doble canto, faldón, clavijas y regatones; escritorio con cuarterones y tiradores con volumen; noche con calor solo cerca de las lámparas. Sin cambios de medidas ni animación.
- **Evidencias:** `qa-report/v1893/` (comparativas, `recorrido-*.webm` con arrastre real y `*-rendimiento.json`).
- **Rendimiento (Chromium emulado):** mismas llamadas, geometrías y texturas; dibujo de 4,1–4,4 ms a 4,7–5,1 ms por fotograma.
- **Sin verificar:** móviles físicos; luz en WebKit (sus capturas pueden ir un fotograma atrás).
- **Aprobada** por Francisco («Apruebo la entrega», 8-11-2026). La fusión con `main` espera a la migración.

### 2026-11-08 · cuenta principal · cámara del sillón tras la 1.89.1 (incluida en el commit de la 1.89.2)

- **Archivos:** `pisoLab/interior3d.js`, `pisoLab/materials.js` y `e2e-community/v1892-camara-sillon.spec.js`.
- **Hecho:** ojos en el centro del asiento y por delante del respaldo; mirada fija al frente del sillón (fuera el giro hacia mesa o estantería, también en el piloto); solo baja la vista si la mesa está delante y cerca; noche más localizada alrededor de las lámparas.
- **Muestra:** distribución que solo existe en la prueba (ningún piso guardado cambia). Capturas y `giro.webm` en `qa-report/v1892/chromium-390x844/`.
- **Comprobado (emulación):** e2e de cámara, v189 y v188 en Chromium y WebKit; `piso-usabilidad` y `piso-esenciales` en Chromium; Vitest de piso y edificio; build.
- **Ojo:** un sillón de cara a una pared cercana ve esa pared, por decisión de Francisco: no se fuerza la mirada.

### 2026-11-08 · cuenta principal · 1.89.1 en preview: arranque, noche, cámara del sillón y ordenador (commit y subida a la rama)

- **Hecho:** §89.6. El destello venía de montar siempre la habitación ilustrada mientras llega el piso diferido. Noche cálida solo con lámparas colocadas; mirada inicial hacia mesa y libro; «Ordenador y escritorio» con miniatura propia.
- **Comparativas:** `e2e-community/v1891-comparativas.spec.js` (ETIQUETA=antes|despues) y hoja en `qa-report/v1891/`, solo con el piso de prueba.
- **Sin verificar:** móviles físicos; un piso real (no se inician sesiones); el cambio de hora en WebKit, cuyas capturas en Windows pueden quedarse un fotograma atrás, igual que antes de este cambio.
- **Limitaciones:** `cozy-book-room.jpg` sigue precargada aunque no se vea; la mirada prioriza la mesa, así que la estantería puede pedir girar o usar «Balda». La migración `20261118120000` sigue sin aplicar. `main` no se ha tocado.

### 2026-11-08 · cuenta principal · 1.89.0 en preview: rincón, Esenciales y visita en primera persona (commit y subida a la rama)

- Hecho (§89): retirados sin perder datos, pestaña Esenciales con básicos sin compra, cámara según el asiento real, pasada artística del
  rincón y visita en primera persona a otros pisos.
- **Sin publicar**, rama `1.89-rincon-esenciales`; Francisco dijo «No fusiones con main ni publiques en producción todavía».
- **Migración `20261118120000_edificio_esenciales.sql` sin aplicar**: la aplica Francisco. Sin ella, colocar un básico que no se posee o
  aparcar un retirado da error visible al guardar y no se pierde nada.
- Sin verificar en móviles físicos: todo es emulación. `v1882-objetos` (el primer caso) y `v1882-comparativas` quedan saltadas mientras
  esos objetos estén retirados.

### 2026-11-07 · cuenta principal · 1.88.1 y 1.88.2 publicadas en producción
- Francisco pidió «súbelo» y confirmó «Sí, a main». `main` avanza por avance rápido hasta la rama `1.88.1-fachada` (sin
  merge ni reescritura); Vercel despliega producción. Sin migraciones. Sin probar aún en un móvil real.

### 2026-11-07 · cuenta principal · 1.88.2 en preview: los objetos que faltaban en primera persona (commit y subida a la rama)
- Encargo de Francisco: completar la integración entre el piso real, la primera persona y el decorador, con el estilo
  pixel; sin mezclar con `main`. Misma rama `1.88.1-fachada`. SPEC §88.5 y §88.6. La fachada (1.88.1) ya estaba hecha:
  no se ha repetido.
- Hecho: místicos (farol, rosa, búho), perrito, gramola y mesa de tapete como su dibujo de pixelfx de pie en la escena,
  en el centro de su mueble y a la altura de su soporte; acabados como piel (`tintar`) y destellos. Animados solo si
  están a la vista y sin movimiento reducido. `pendientes()` ya solo avisa de lo que no tenga forma (hoy, nada).
  `misticoSprite().paint` acepta tono, acabado y ancho. `debug()`: `beings` y `placed`. Sin estantería, «Ver la
  balda» es «Biblioteca» (abre la biblioteca entera); no se añade ni guarda ningún mueble.
- Pruebas nuevas: `e2e-community/v1882-objetos.spec.js` (recorrido Decorar → Terminar → 3D → recarga → visita de Bruno, y
  accesos sin muebles) y `v1882-comparativas.spec.js` (mismo piso en isométrico y en primera persona). Pasan en Chromium
  y WebKit. Hoja en `qa-report/v1882/hoja.png` y trazas de WebKit en `qa-report/trazas/` (no van a git).
- Intermitentes de WebKit, ajenos al cambio: el de `screenOfItem` en el decorador (`piso-esenciales`, solo falla 2 de 3)
  y tres que solos pasan. `goodreads.test.js` falla en este ordenador (lector CSV, no tocado).
- Pendiente: compañero y personaje en primera persona; los seres son planos; textos de «Volver a la balda» sin
  estantería; sitio fijo para muebles esenciales (cambio aparte). Sin probar en un móvil real.

### 2026-11-07 · cuenta principal · 1.88.1 en preview: la fachada al volver de un piso (commit y subida a la rama)
- Encargo de Francisco tras usarla en Android: fachada recortada y desplazada con placas fuera del dibujo; además,
  comprobar que Decorar (mover o girar la estantería y «Terminar») llega a la primera persona y sigue tras recargar, y no
  tocar portadas ni lomos. Pidió publicar la corrección en la preview: rama `1.88.1-fachada` desde `main`; `main` no
  se toca. SPEC §88.4.
- **Causa** (reproducida con el build de producción): al volver de un piso, el alejamiento desde la ventana empieza a
  ×3,4 y, a diferencia de la llegada y del asomarse, no ocultaba las placas ni el buzón. En desarrollo no se veía porque
  StrictMode monta dos veces la fachada y el segundo montaje hacía la llegada por el muelle.
- **Corrección**: clase `is-returning` (oculta placas, insignias y buzón; sin toques hasta que acaba) y la ventana se
  olvida al terminar, no al montar. `debug().shelfAt` en el piso en primera persona, para la prueba.
- **Prueba nueva**: `e2e-community/v1881-fachada.spec.js` (fotograma a fotograma en los cuatro recorridos, y Decorar →
  primera persona → recarga). Con el código anterior en el build de producción falla; con la corrección pasa.
  Comparación en `qa-report/fachada-antes-despues/`.
- Pruebas: build y vitest de edificio y pisoLab (268) pasan. En Chromium y WebKit a 390 px, la prueba nueva pasa 6 de 6 (fachada) y 8 de 8 (Decorar); pase final con v1881, v188, v163-edificio y v178-paseo: 17 pasan, 5 se saltan. En una tanda más amplia fallaron dos de `v167-tienda` (pasos dentro del sobre, ajenos a la fachada), que solas pasan 8 de 8. Lo que pasaba antes con el mismo síntoma (`screenOfItem` nulo justo tras un cambio) se espera ahora en la prueba nueva.
- WebKit no abre la habitación con el build de producción servido en local (antes de llegar a la fachada): la evidencia
  antes/después en producción es de Chromium; WebKit pasa la prueba nueva en desarrollo. Sin probar en un Android real.

### 2026-11-07 · cuenta principal · 1.88.0 publicada en producción
- Francisco la probó en la preview y pidió publicarla («ya lo he probado, publícalo en main»). `main` avanza por avance
  rápido hasta la rama `1.88-habitacion-real` (sin merge ni reescritura); Vercel despliega producción. Sin migraciones.
  Versión 1.88.0 ya estaba en `diag.js`, `package.json`, `package-lock.json`, `sw.js` y la cabecera de `SPEC.md`.

### 2026-11-07 · cuenta principal · 1.88.0: cada libro de la balda con su portada real, igual en mesa y balda (commit y subida a la rama, lo pidió Francisco)
- Encargos de Francisco del 7-11-2026: «prioridad visual» (los libros de la estantería, con el tratamiento del de la mesa) y
  después cinco ajustes antes de cerrar la muestra, con «haz commit y sube la rama de preview… Mantén main sin cambios».
  `main` no se ha tocado. SPEC §88.2 y §88.3 reescritos.
- Hecho:
  - **Mismo ejemplar en mesa y balda**: mismos datos (`copyData`), medidas (`bookDims`, grosor 0,08–0,18), portada y lomo
    (`bookFace`); solo cambian la orientación y la luz.
  - **Portada real** de su edición en la tapa; el **lomo** es auténtico solo con `book.spine` y si no, **reconstruido**
    con los colores del borde de la portada en uno de cinco diseños. La tarjeta lo dice («Portada de su edición · lomo
    reconstruido»). La portada nunca se estira sobre el lomo.
  - Composición sin pisarse (`composeRow`, `shelfRows`), selección que sale recta, gira y deja la portada delante de su
    hueco (`poseSpot`), y `sweep()` para comprobar que nada se atraviesa.
  - **Cámara del acercamiento** encuadrada por los libros de la balda (`rowBoxes`, `rowView`): menos techo y suelo vacíos.
    Chromium y WebKit dan la misma cámara recorriendo la interfaz; la diferencia anterior era, probablemente, de la prueba.
  - Capas del paisaje de la ventana más anchas y la lejana más alta: con la cámara más cerca se veía su final (lo cazó
    «la ventana: no se ve el final de ninguna capa…»). Desde el sillón se ve igual.
  - Muestras en `e2e/piso-muestra.spec.js` (necesitan red): cinco ediciones frente a la mesa y 28 ediciones (27
    representadas, sin cruces, todas elegibles con un toque). Hojas en `qa-report/piso-muestra/` (no van a git).
- Franja oscura de Chromium: **no se reproduce** y su causa **no está confirmada** (comparación lienzo/pantalla en §88.3).
  Fallos intermitentes documentados en §88.3: dos sin identificar (no se repitieron), el del decorador del edificio en
  WebKit (falla 2 de 6 solo; esta rama no toca el edificio) y un tiempo agotado en WebKit.
- Pruebas: build, oxlint (solo avisos ya existentes), vitest de pisoLab (73) y tanda e2e final en Chromium y WebKit
  a 390 px (piso-lab, piso-lomos, piso-inicio, piso-usabilidad, piso-esenciales, piso-ficha-visita y piso-muestra): 144
  pasan, 1 se salta y 1 falla, el intermitente del decorador en WebKit.
- Sin probar en Android ni en Safari de iPhone reales: eso es lo que Francisco va a mirar con sus bibliotecas en la preview.

### 2026-11-07 · cuenta principal · 1.88.0 en preview: la habitación es tu piso y los lomos tienen cara (subido a la rama, «Sí, sube la rama»)
- Encargo de Francisco (dos fallos de la 1.87 publicada). Rama `1.88-habitacion-real` desde `main`; SPEC §88.
- **Piso real:** la habitación de inicio (`HOME_PISO = 'mio'`) lee y guarda tu piso con `loadEdificio`/`savePiso`
  (`src/features/edificio/myPiso.js`, hook `src/features/pisoLab/useMyPiso.js`). Primera persona, vista de siempre,
  Decorar y el edificio usan el mismo piso. En memoria, por usuario (`myPisoCache.js`); se olvida al cambiar de cuenta
  (`CommunityProvider`). Mientras llega la sesión o el piso, «Abriendo tu piso…»; sin cuenta o sin comunidad, un aviso.
  Nada de reparaciones: la puerta y el ordenador solo se dibujan si caben y nunca se guardan. Los pisos del piloto, solo
  con `?piloto=piso`; una entrada del historial de la 1.87 (`lab-1A`) lleva a tu piso.
- **Lomos:** miniatura de la portada de cada lomo dibujado (cuatro a la vez, caché de 64), con sus colores, título y
  apellido del autor; `book.spine` si algún día hay un lomo propio (hoy ningún libro lo trae). La escena se repinta si
  cambia la portada o la edición aunque el id sea el mismo. Caché de portadas grandes acotada a 6.
- Comprobado (emulación, no móviles reales): e2e con dos cuentas simuladas (`e2e-community/v188-habitacion-real`) en
  Chromium y WebKit 390; lomos con 1000 libros (`e2e/piso-lomos`); piloto, inicio, ficha, esenciales, usabilidad y
  edificio; Vitest.
- Pendiente: que Francisco lo pruebe con sus dos cuentas reales en la preview y apruebe producción.

### 2026-11-07 · cuenta principal · 1.87.0 publicada: la habitación en primera persona como inicio
- Francisco lo comprobó en Android y en Safari de iPhone con la preview («Si funciona») y pidió integrar y publicar en la
  dirección de siempre. `main` avanza sin fusión hasta la rama `experimento/piso-primera-persona`, con el commit de la
  integración. SPEC §87.
- **Integración:**
  - fuera el vaciado de Supabase de `vite.config.js`;
  - `__PISO_INICIO__` vale `true` en lo que compila Vercel (en local y en las pruebas, solo con `PISO_INICIO=1`);
  - `?piloto=piso` no abre nada en producción;
  - versión 1.87.0 en `diag.js`, `package.json`, `package-lock.json`, `sw.js` y `SPEC.md`.
- **Rincón 01 apagado** (Francisco: «Como en la 1.86»): `RINCON_01 = false` en `bookcaseLayout.js` y
  `e2e/rincon-01-estanteria.spec.js` omitida. La experiencia anterior se publica tal como era.
- **Cuentas, bibliotecas, lecturas y decoración:** no se tocan. La elección de inicio va en `bookshelf:inicio`, fuera
  de la biblioteca. En producción no hay datos de demostración.
- Comprobado: compilación como la de Vercel servida en local (arranca en la habitación con «Al edificio», sin marca de
  demostración, `sw.js` con la 1.87.0); e2e del piloto, del inicio, de la ficha y de la habitación ilustrada; Vitest.
- **Ojo, carpeta `bookshelf/`:** sigue en `f47c66b` con los cambios de Rincón 01 sin confirmar (copia en
  `respaldo/rincon-antes-del-piloto` y en el commit `9619b90`). Antes de trabajar ahí, traer `main`: esos cambios ya
  están en la 1.87, apagados.

### 2026-11-07 · cuenta principal · cierre del bloque y versión privada con la habitación como inicio (subido a la rama, «Sí, sube la rama»)
- Solo en la rama `experimento/piso-primera-persona`; `main` y producción no cambian. Detalle en `docs/qa/piso-primera-persona.md`, «Cierre del bloque y versión privada».
- **Cierre del registro aprobado** por Francisco. Comprobado en emulación: guardar, corregir y Deshacer siguen tras recargar; corregir no termina el libro; la relectura conserva el historial.
- **Versión privada:** la habitación es el inicio y su puerta lleva al edificio real. «Volver a la experiencia anterior» está en el menú del piso; «Ir a la habitación nueva», en «Ambiente». Por defecto, solo en la preview de la rama (`__PISO_INICIO__`).
- **Demostración separada:** con una biblioteca de demostración en el navegador, la nube se apaga. La habitación lo avisa con un enlace para volver a la tuya.
- **Antes de integrar en `main`:** quitar el vaciado de Supabase de `vite.config.js`, poner `__PISO_INICIO__` en `true`, ajustar las pruebas de la habitación ilustrada y subir la versión. Lista completa en el documento QA.
- Sin verificar: Android y Safari de iPhone reales, y el edificio con una cuenta (la preview no tiene nube).
### 2026-11-07 · cuenta principal · cierre del registro, final del libro y relectura (subido a la rama, «Sí, sube la rama»)
- Solo en la rama `experimento/piso-primera-persona`; `main` y producción no cambian. Detalle en `docs/qa/piso-primera-persona.md`, «Cierre del registro, final del libro y relectura».
- **Ficha:** al guardar se cierra el formulario con «Lectura registrada» y Deshacer. En la última página y aún en «Leyendo» ofrece terminar el libro. Con un libro leído, «Empezar relectura» en vez de registrar o mover la página.
- **Código compartido con la app:** `BookDetailModal.jsx`, `books.js` (`startReread`, `atLastPage`), `useLibrary.jsx` (acción `startReread`) y `ReadingLogSheet.jsx` (`className` del aviso). **Campo nuevo `pastReads`** en el libro, dentro de la biblioteca guardada; sin migración.
- Sin cambiar: elegir «Leyendo» en la balda de un libro leído lo reabre como antes, sin guardar la lectura anterior.
- Pruebas: `e2e/piso-ficha-visita.spec.js` 14 de 14 (Chromium y WebKit); piloto 92 de 92; `v134` y `v135` 22 de 22; Vitest de dominio 203 de 203 (nuevo `relectura.test.js`). Build bien.
- Sin verificar: teclado real en Android y en un iPhone.
### 2026-11-07 · cuenta principal · ficha con teclado, «0 libros rehechos» y visitas (subido a la rama, «Sí, sube la rama»)
- Solo en la rama `experimento/piso-primera-persona`; `main` y producción no cambian. Detalle en `docs/qa/piso-primera-persona.md`, «Ficha con teclado, «0 libros rehechos» y visitas».
- **Registrar lectura en la ficha:** la fila de Guardar y Cancelar ya no queda pegada al pie, como en el registro independiente (`library-sheet.css`). El campo se lleva a la vista también en Android (`BookDetailModal.jsx`, código compartido con la app).
- **«Libros rehechos»** cuenta los objetos de libro serializados de nuevo, no lo guardado: un guardado que no cambia el libro (p. ej., «Voy por la página» a la misma página) da 0 y se escribe igual. Comprobado tras recargar.
- **Visitas:** en la balda de la vecina pone «Volver a la sala», y el nombre del piso se ve entero con un toque. Nada se guarda al visitar.
- Pruebas: `e2e/piso-ficha-visita.spec.js` (8 de 8 en Chromium y WebKit 390 × 844). Las del piloto, 91 de 92: falla `piso-esenciales:245` en WebKit, el mismo fallo intermitente que ya había en `9461907`. Build bien.
- Sin verificar: teclado real en Android y en un iPhone (aquí es simulado).

### 2026-11-07 · cuenta principal · medidor por acción en el piloto (subido a la rama, «Sí, sube la rama»)
- Solo en la rama `experimento/piso-primera-persona`; `main` y producción no cambian. Detalle en `docs/qa/piso-primera-persona.md`, «Medidor por acción».
- El medidor (`&medir=1`) apunta guardar lectura, desplazar la biblioteca y 30 s de reposo, con la misma apariencia. `labActions.js` es nuevo.
- Toca código compartido con una marca de rendimiento en `ReadingEntryForm.jsx` y el registro de serializaciones y escrituras en `serialize.js` y `useLibrary.jsx` (solo números). A revisar si se integra.
- **Solo se reconstruye el libro modificado, pero todavía se escribe la biblioteca completa** (2,81 M caracteres en una sola clave). Francisco: no cambiar el almacenamiento ni añadir funciones hasta probar guardado, desplazamiento y reposo en Android y Safari de iPhone.
- Bibliotecas de prueba: solo en el almacenamiento de la preview, nunca en producción; **no iniciar sesión en la nube en la preview**, porque el piloto no apaga la sincronización.
- Guardar no vuelve a serializar la biblioteca: 1 de 5.000 libros rehecho, y una sola serialización y escritura de 2,81 M caracteres.
- **Dispositivo físico:** solo lo que dio Francisco: giro a 60,2 FPS y entrada de 1.131 ms, en su móvil, sin modelo anotado. Guardar, desplazar y reposo, sin medir en un móvil.
- En emulación, la sonda de temporizador inventa bloqueos con la CPU limitada: se usan tareas largas donde las hay.

### 2026-11-06 · cuenta principal · pasada de rendimiento del piloto (subido a la rama, «Sí, sube la rama»)
- Solo en la rama `experimento/piso-primera-persona`; `main` y producción no cambian. Resultados en `docs/qa/piso-primera-persona.md`, «Pasada de rendimiento».
- **Guardar** con 5.000 libros, CPU ×4: 758 → 301 ms; tarea más larga 483 → 90 ms. Quedan 1 o 2 tareas de más de 50 ms: `setItem` de 2,8 MB no baja sin cambiar el formato.
- **Desplazar:** la causa era `.bed-pages__page:has(…) > :not(…)`, ahora una clase. FPS de 31 a 60 con el ordenador libre; de 16–17 a 41–42 con carga.
- **Arrancar:** lo que crece de 50 a 5.000 libros, de 681 a 131 ms; casi todo era emparejar figuras ocultas.
- **Toca código compartido, aunque solo está en la rama del piloto:** `useLibrary.jsx`, `serialize.js` (nuevo), `cloudSync.jsx`, `ShelfView.jsx`, `BookItem.jsx`, `BedPages.jsx`, `room-149.css` y `ReadingEntryForm.jsx`. A revisar si se integra; la sincronización con sesión de nube no está probada con estos cambios.
- **Sin resolver:** diez portadas enormes montadas pueden sumar 75 MB descomprimidas.
- Fallos que ya estaban en 9461907: `piso-esenciales:245` y `piso-lab:817` en WebKit (intermitentes), `v128:422`, `v128:478`, `v159:139` y `e2e-community/v158`.
- Comprobado en emulación; **ningún móvil físico** ni la preview, que pide sesión.

### 2026-11-06 · cuenta principal · usabilidad móvil y medición del piloto (subido a la rama, «Sí, sube la rama»)
- Solo en la rama del piloto; `main` y producción sin tocar. Resultados y definiciones en `docs/qa/piso-primera-persona.md`, «Usabilidad móvil y medición».
- **«Entrada» de 118541 ms:** era el medidor, que restaba la vieja pulsación de la puerta en cada montaje (por ejemplo, al volver de Decorar). Reproducido y corregido; ahora hay fases y origen (`labTiming.js`).
- Encuadres a 320, 360 y 390 px, giro hasta cada esencial, posición recuperada, acceso a la estantería de 2 celdas, segundo toque para lo de detrás en el decorador y escritorio reorganizado.
- `src/state/useLibrary.jsx` lleva dos `performance.mark` y `edificio/piso.js` la opción `stackTaps`, apagada fuera del piloto. A revisar si esto se integra.
- **Por mirar:** guardar el registro con 5.000 libros bloquea 647 ms con CPU ×4; el arranque crece 950 ms; desplazar la lista va a 15 FPS en emulación.
- Comprobado en emulación; **ningún móvil físico** ni la preview, que pide sesión.

### 2026-11-06 · cuenta principal · esenciales movibles y barra integrada (subido a la rama, «Sí, sube la rama»)
- **Decisión de Francisco:** los esenciales siempre están, pero se pueden mover como el sillón para que cada cual reparta su habitación. Sustituye a las posiciones fijas de la entrada siguiente. Reglas en `docs/qa/piso-funciones.md`.
- Solo no se puede guardar el último de su clase. El paso reservado va con el mueble y depende de hacia dónde mira. El escritorio se lleva el ordenador al moverlo y girarlo (`rotateItem` lo permite solo si `room.guard` lo dice; el producto no cambia).
- Barra superior flotando sobre la habitación, a petición suya («que no cortase la pantalla»). La franja inferior no se ha tocado.
- Comprobado en emulación; **ningún móvil físico**.

### 2026-11-06 · cuenta principal · elementos esenciales del piloto (subido a la rama, «Sí, sube la rama»)
- Solo en `experimento/piso-primera-persona`. Inventario y reglas en `docs/qa/piso-funciones.md`; detalle y límites en `docs/qa/piso-primera-persona.md`.
- Estantería, mesa de lectura, escritorio con ordenador y puerta tienen sitio fijo por piso (`essentials.js`). Se cambia su color, pero no se mueven, giran ni guardan, y su paso queda reservado (`room.guard`, que `room.js` solo consulta si existe: el producto no cambia). Las distribuciones antiguas se completan al cargar sin perder decoración, con copia previa; lo que no cabe queda apartado y se reintenta. Hay «Restablecer la habitación».
- Ordenador y puerta son piezas solo del piloto: fuera de `CATALOG`, sin fila en `piso_catalogo`. Si pasan a la app, habrá que decidir su sitio.
- El ordenador reutiliza `LaptopPanel` y los paneles de siempre, con un escritorio por grupos (`PisoDesktop.jsx`). Menú compacto en `PisoMenu.jsx` (tecla M); la hora del día pasa a ese menú.
- Comprobado en emulación; **ningún móvil físico**. Subido solo a esa rama, sin tocar `main` ni producción. Integrar en la app sigue pendiente de su decisión.

### 2026-11-05 · cuenta principal · piloto «Del portal al sillón» (solo en este laboratorio)
- Implementado en `src/features/pisoLab/`, ruta `/?piloto=piso`, con `three@0.170.0` y sin Supabase. Detalle, campos, medidas y pendientes en `docs/qa/piso-primera-persona.md`.
- Commit local en `experimento/piso-primera-persona`, pedido por Francisco como punto de comparación, sobre el respaldo 9619b90. Sin subir. Integrar, subir y desplegar es decisión suya.
- Decisión de Francisco: el suelo, el sillón y la lámpara del interior son referencias aprobadas.
- **Primera pasada de la estantería, incluida en el commit de la preview** (6-11-2026, a la espera de que Francisco revise): tu lectura de frente y lomos reales en las tres baldas con `layoutSpines` (`shelfLayout.js`); veta, contacto y separación en `shelfTexture`; tocar balda → acercarse → elegir → abrir ficha encima sin desmontar el interior (`select` 'balda:N' y 'ficha:N:libro') → volver con el mismo giro; el toque se separa del arrastre con 8 px y 450 ms. Decisión de Francisco (6-11-2026, «Mantener en ambas»): tu lectura se ve en la mesa y en la estantería a la vez; no quitarla de ninguna de las dos. Sin probar en móvil físico.
- **Preview y bibliotecas grandes del piloto, subidas a la rama** (6-11-2026, «Sí, publica la rama»; solo `experimento/piso-primera-persona`, sin tocar `main` ni producción): la habitación representa una selección de hasta 30 ejemplares (`roomSelection.js`, `&visibles=N`; por la madera caben unos 20): lecturas actuales, elegidos (`roomFeaturedId` y el nuevo `settings.roomExhibit`) y el resto de la cola. Toda la biblioteca desde la balda (`PisoLibrary.jsx`, vista `toda`): búsqueda, filtros, bloques de 40 y como mucho 17 filas montadas. Bibliotecas reproducibles con `&biblioteca=0|50|1000|5000` (`sampleLibrary.js`, portadas en `public/lab/covers/`; nunca en el host de producción y guarda lo que hubiera). Render en pausa si está oculto o tapado, y si se pierde el contexto de la GPU espera 3 s a que vuelva. Medidor en el móvil con `&medir=1`. En esta rama la compilación no lleva Supabase (`vite.config.js`) y el piloto no registra el service worker. Toca código compartido: `library.js` (exporta el orden), `main.jsx` y `vite.config.js`. Medidas, recorrido y limitaciones en `docs/qa/piso-primera-persona.md`. Commit `840e0b0`; Vercel la compiló bien, en https://bookshelf-git-experimento-piso-primera-persona-francisykza.vercel.app/?piloto=piso. **Tiene activa la protección de Vercel**: pide iniciar sesión, así que aún no se ha podido abrir desde aquí. Esta nota queda sin commit para no volver a desplegar por ella. **Sin probar en ningún móvil físico.**
- **Pasada de la mesa y el libro, incluida en el commit de la preview** (6-11-2026; aprobada por Francisco ese mismo día, «Sí, buena»): mesa baja y mesa con tablas, juntas y veta a rodales (`tableTexture`, `pixelTable`); la mesilla sigue igual. Libro con tapas, lomo de su balda, hojas y sombra de contacto (`pixelBook`, `bookTexture`, medidas en `bookLayout.js`), algo girado respecto al sillón para que se vea el lomo. Tocarlo inclina la cámara 280 ms y abre el registro de siempre; al guardar o cancelar vuelve al mismo giro. La franja inferior pasa de 119 a 64 px. Además, en el piloto: `installPixelVars` para los marcos de botón, «Deshacer» al volver y, si el registro termina el libro, la reseña devuelve al piso (cambios en `App.jsx`; `pixelUi.js` solo añade un icono y una función). La vista conserva el ancho aunque la pantalla sea más alta (`WIDE_ASPECT`, `TILT` 0,215). Causa del fallo intermitente del agua, ya corregida en la prueba: un dibujo pedido justo antes de pasar a segundo plano. Sin probar en móvil físico ni con un lector de pantalla real.
- **Pasada de la ventana y el exterior, incluida en el commit de la preview** (6-11-2026; aprobada por Francisco ese mismo día, «Sí, buena»): marco y alféizar de madera pixelada con grosor y sombra de contacto (`pixelWindow`); exterior en tres planos alineados desde el sillón, más un atlas de brillos en el agua (`exterior.js`, `exteriorLayout.js`): barandilla propia con macetas, tejados y casa vecina, y puerto con el Gran Hotel. La miniatura del hotel está guardada en `hotelMini.js`; si cambia `hotelArt.js`, una prueba falla y se rehace con `UPDATE_HOTEL_MINI=1`. El agua se para en segundo plano, con la ficha encima y con movimiento reducido. «Dejar sobre la mesa» cambia `currentBookId`, solo en local, y con él el libro de la mesa, la cubierta de la estantería y el registro. Cambios mínimos fuera del piloto, en este laboratorio: `facade.js` exporta `POT`, `LEAF` y `neighbour`, y `BookDetailModal.jsx` admite `mainPlace`; sin esa prop todo sigue igual. Sin probar en móvil físico. Detalle y medidas en `docs/qa/piso-primera-persona.md`.
- **Sin commit, a la espera de que Francisco revise** (sobre da25aba): pared con menos salto entre las bandas exteriores del halo (`WARMTH` en `materials.js`; aprobada por Francisco el 6-11-2026, «Pared después») y balda de la lámpara: armazón de la estantería con material propio y luz dibujada, canto, sombra y reflejo; El Principito en tres cuartos y dos lomos reales que abren su ficha. Sustituye a las cuatro portadas HTML de la balda anterior. No extender el acabado al resto del catálogo sin que lo pida.
- Refinado el encuadre inicial a 390 × 844: la cámara sale del sillón real, con la cubierta real sobre la mesa, el hotel reconocible y el atardecer de la fachada. Plano de ejemplo cambiado y guardado con otra clave. Francisco lo revisa antes de seguir.
- Acabado del fotograma final: sillón tapizado (`materials.js`), veta en la mesa, sombra del libro, el suelo real de `floorColor`, cubierta pedida al tocar la puerta y hora heredada de la fachada (`FACADE_HORA`). Primera entrada con caché vacía: unos 2,5 s hasta ver el piso, porque espera a la cubierta hasta un máximo de 2,2 s.
- Pasada pixel acotada: lámpara de pie, su luz en las paredes y tapizado del sillón, con rampas y fórmula de tarde del decorador. El suelo aprobado no cambia (0 valores distintos en la franja comparada). No extender al resto del catálogo sin que lo pida Francisco.
- Sin verificar: ningún móvil físico. Los 60 FPS del giro son de WebGL por software en este ordenador y no demuestran el objetivo de 30 FPS.

### 2026-11-05 · cuenta principal · respaldo de Rincón 01 y laboratorio del piso en primera persona
- Francisco quiere probar `BookShelf-piso-piloto/02-Prompt-Claude.md` sin tocar esta carpeta, que queda como versión de comparación: sigue en `main` y con los cambios de Rincón 01 sin confirmar.
- Esos cambios están copiados en la rama local `respaldo/rincon-antes-del-piloto`, en un commit hecho con un índice temporal, sin cambiar de rama ni tocar el área de preparación. No se han subido. No incluye `Rincon/` ni las demás carpetas de material sin seguimiento.
- El piloto se hace solo en la rama `experimento/piso-primera-persona`, en el worktree `../BookShelf-piso-lab`, sin Supabase. La integración, la subida y el despliegue quedan pendientes de la decisión de Francisco.

### 2026-11-05 · cuenta principal · Rincón 01, corrección visual: prueba en una balda (sin commit)
- Francisco pidió probar el tamaño aparente de la maqueta `Rincon/referencias/04-maqueta-estanteria.png` **solo en la balda de debajo de Circe**, sin extenderlo todavía. Ahí van ahora tres ejemplares: uno de frente con su canto, el primero de la cola que tiene portada, y dos de lomo con su grosor natural. Para esta balda se usa una escala de 4,7 px por cm (`showcaseRow` en `roomShelf.js`): el grupo ocupa unos dos tercios del ancho y deja madera encima. Las dos baldas de abajo siguen con lomos estrechos. Cada ejemplar aparece una sola vez.
- Arreglado: los botones de los libros quedaban por debajo del hotspot general de la librería (z 2) en las baldas de abajo; ahora `.rb-hits` tiene z 3.
- Las capturas sacan las portadas de Google Books por ISBN porque Open Library no respondía (solo en `e2e/rincon-01-capturas.spec.js`; la app no cambia).
- Pruebas: build; Vitest `src/domain`, 198/198; e2e `rincon-01-estanteria`, 14/14 en Chromium y WebKit 390; `v149` y `v152`, 4/4.
- Pendiente de lo que diga Francisco: extender el tratamiento a las otras baldas o retocarlo; la versión y su sección del SPEC.

### 2026-11-05 · cuenta principal · Rincón 01 «Mi estantería desde la cama» (sin commit, sobre la 1.86.0)
- Encargo: «ejecuta únicamente `Rincon/prompts/01-estanteria.md`» y parar tras enseñar el antes y el después. Francisco eligió la biblioteca de ejemplo («Usa la de ejemplo»): no se entró en su cuenta.
- La estantería de la habitación se dibuja ahora así: un libro expuesto de frente en la balda de arriba (la antigua vitrina de figuras) y lomos estrechos en grupos en las tres de abajo, por detrás de la hiedra y del canto de las baldas.
  - **Libro expuesto**: el elegido (`settings.roomFeaturedId`, el id del ejemplar, se sincroniza con la cuenta); si no, la lectura actual, un favorito o el primero. Se elige desde la ficha con «Exponer en tu estantería». Al quitar el libro, se pone a null.
  - **Lomos**: primero las lecturas, sin duplicados. Cuántos caben lo decide la madera: con 1200 libros, entre 20 y 80 lomos y una sola imagen. Colores de la edición o del hash estable. Cinta en la lectura actual. Si falta la portada, tela mate con el título y el autor.
  - **Tocar**: los lomos son estrechos, así que cada grupo es un botón que abre la balda de cerca (panel `balda` con su entrada en el historial: Atrás y Escape la cierran). Desde ahí se toca el ejemplar y se abre su ficha.
- Archivos nuevos: `src/domain/roomShelf.js` (+ test), `src/components/room/{RoomBookcase.jsx,bookcaseLayout.js,BaldaPanel.jsx}`, `src/styles/rincon-01.css`, `e2e/rincon-01-estanteria.spec.js`, `e2e/rincon-01-capturas.spec.js`. Archivos tocados: `App.jsx`, `CozyRoom.jsx`, `BookDetailModal.jsx`, `BookItem.jsx` (exporta `watchCover`), `sceneMap.js` (`BOOKCASE_LIPS`), `useLibrary.jsx` (removeBook), `index.css`.
- Pruebas: build; Vitest `src/domain` 196/196; e2e `rincon-01-estanteria`, 12/12 en Chromium y WebKit 390; `v149` y `v152` en Chromium 390, 4/4. Capturas en `qa-report/rincon-01/{antes,despues}/`.
- Sin verificar en un iPhone físico (solo emulación). Falta subir la versión y escribir su sección del SPEC: se hará cuando Francisco lo apruebe. La fase 02 no se ha empezado.

### 2026-11-04 · cuenta principal · 1.86.0 cerrada
- Francisco pidió cerrarla con «Sí, ciérrala» tras ver los tres bloques. No hubo 1.85 aparte: la reseña como imagen va en la 1.86 (SPEC §85) y lo demás en §86. La rama `1.85-resena-imagen` pasa a llamarse `1.86-identidad-muebles`.
- PR #10 abierta. Las tres migraciones se aplicaron con el flujo del SQL Editor (Francisco pulsó «Run»; 42501 al anónimo en las cuatro tablas y las funciones nuevas). Publicada con «súbelo»: `/sw.js` trae la 1.86.0.

### 2026-11-04 · cuenta principal · reseña, acabados, estiba y talleres (en la 1.86.0)
- Encargo de Francisco, por una captura del TikTok de libros de Enola: **exportar la reseña como imagen**. Hecho en disco, sin commit ni versión: `src/features/reviews/reviewCard.js` (dibujo en lienzo, 1080×1920 y 1080×1350, tres papeles, reparto en carrusel), `ReviewExport.jsx`, `review-export.css`, `api/portada.js` (primera función de Vercel: portadas de Google, que no se pueden usar en un lienzo de otro modo) y el botón en `MyReview`.
- Pruebas: Vitest de `src/features/reviews`, y `e2e/v185-resena-imagen.spec.js` en Chromium 390 y WebKit 390, y antes de los últimos retoques en escritorio. **Sin verificar**: `api/portada.js` solo funciona desplegado; compartir con la hoja del sistema, en un móvil real. En WebKit de Windows los títulos salen más finos: mirarlo en el iPhone.
- **Aprobado por Francisco** (reglas en CLAUDE.md, «Identidad de los muebles» y «La estiba»): acabados a 1 de cada 20, «La estiba» con pared de premios, colecciones de taller y tablón «Se busca». Añadió que la copia rara se vea claramente distinta y que su sobre se abra con otro brillo.
- **Bloque 1, acabados: hecho en disco, sin commit ni versión, esperando su visto bueno.** Migración nueva `20261115120000_edificio_acabados.sql` (**sin aplicar**; generada a partir de las funciones publicadas), `src/features/edificio/acabados.js`, y cambios en dibujo, balda, regalos, Lonja, tienda y `GachaReveal.jsx`. Pruebas: `acabados.rls.test.js` y todo `src/features/edificio` en Vitest, `v186-acabados`, `v176`, `v184`, `v171`, `v167` y `v166` en Chromium 390.
- **Sin probar en el navegador**: regalar y poner en la Lonja una copia con acabado (el servidor sí está probado, la pantalla no, porque el simulador no los cubre). Los muebles de pared llevan el color pero no los destellos. El buzón aún no dice el acabado de un regalo, aunque se guarda.
- **Bloque 2, «La estiba» y la pared de premios: hecho en disco, sin commit ni versión, esperando su visto bueno.** Migración nueva `20261116120000_hotel_estiba.sql` (**sin aplicar**, va después de la de acabados; se generó desde las funciones publicadas). Bodega diaria de 8 × 5 igual para todos, partida en bultos, con carga perfecta garantizada; `piso_estiba_zarpar` comprueba la carga y da 1, 2, 4 o 7 sellos una vez al día. `piso_lonja_canjear` añade ropa de estibador (`jersey:17`, `pantalon:10`, `complemento:gorro-estibador`), la gaviota (`gaviota-puerto`, 120 sellos) y un acabado concreto sobre una copia lisa (40 a 100 sellos). Pantalla: `hotel/estiba.js`, `estibaArt.js`, `LonjaEstiba.jsx`, `LonjaPared.jsx`.
- **La pesada queda cerrada**: se borraron `LonjaPesada.jsx` y `pesadaArt.js`, y se revocan `piso_lonja_pesar` y `piso_lonja_senalar`. Su tabla, sus datos y los sellos ganados se conservan, y `piso_lonja()` sigue devolviendo `juego` para que la versión anterior no falle mientras se actualiza.
- **Cifras propuestas por Claude, pendientes de que Francisco las vea**: sellos por nivel, precios de la ropa, de la gaviota y de los acabados.
- **Pruebas del bloque 2**: `estiba.rls.test.js` y todo `src/features/edificio` en Vitest (186), `v186-estiba` en Chromium 360, 390 y escritorio y en WebKit 390, `v184-lonja` en Chromium y WebKit 390, y build. **Sin probar**: arrastrar con el dedo en un móvil de verdad (las pruebas usan ratón y toque simulados en el navegador), la sirena y los sonidos, y vestir la ropa nueva en el armario en el navegador (el servidor sí está probado).
- **Bloque 3, talleres y «Se busca»: hecho en disco, sin commit ni versión, esperando su visto bueno.** Migración nueva `20261117120000_edificio_talleres.sql` (**sin aplicar**, va después de la de la estiba). Seis talleres inventados en `talleres.js` (igual que `piso_talleres`; todo mueble de tienda está en uno): tener una copia de todo da su placa (`placa-<taller>`, rareza especial) y 30 sellos, una vez. Tablón en `hotel/LonjaTablon.jsx`, cuarto faldón del toldo: hasta tres marcas, sin texto, caducan a los 30 días y respetan bloqueos; «Ofrecer» abre tu puesto con ese mueble. En los puestos, etiquetas «Lo buscas» y «Te falta · taller».
- **Pruebas del bloque 3**: `talleres.rls.test.js`, todo `src/features/edificio` en Vitest y `v186-tablon`. **Sin probar**: colgar una placa en el piso en el navegador (usa la forma de la de la suite). La tienda aún no dice de qué taller es cada mueble.
- **Queda**: las tres cosas (acabados, estiba, talleres) esperan su visto bueno. Al cerrar: subir versión, SPEC §85 y §86 y ofrecer el flujo del SQL Editor para **tres** migraciones, en orden: `20261115120000`, `20261116120000`, `20261117120000`. Ninguna está aplicada: publicar sin ellas rompería la Lonja.

### 2026-11-04 · cuenta principal · 1.84.0 publicada
- `main` avanzó sin fusión desde la 1.81 hasta la 1.84, con las 1.82 y 1.83 dentro; `/sw.js` ya trae la 1.84.0.

### 2026-11-04 · cuenta principal · migraciones de la 1.82, la 1.83 y la 1.84 aplicadas
- Con el flujo del SQL Editor, en orden: SHA-256 comprobado y Francisco pulsó Run las tres veces. Con la clave pública, las seis
  tablas nuevas y las funciones de la Lonja dan 42501.

### 2026-11-04 · cuenta principal · 1.84.0 cerrada
- Francisco dio el «sí» a las capturas: versión subida, §84 en `SPEC.md` y commit en `1.84-lonja`. Quedan aprobadas las cifras de
  abajo. Sin publicar, migración sin aplicar. Sin probar entre dos cuentas reales ni en un iPhone, y los sonidos nuevos sin escuchar.

### 2026-11-04 · cuenta principal · la Lonja (en la 1.84.0)
- `hotel/Lonja.jsx`, `hotel/LonjaPesada.jsx`, `hotel/lonjaArt.js`, `hotel/pesadaArt.js`, migración
  `20261114120000_hotel_lonja.sql`, `lonja.rls.test.js` y `e2e-community/v184-lonja.spec.js`.
  Se llega por el ascensor (botón E) y por el Directorio.
- Lo ofrecido sale del inventario hasta que se retira o se cambia; mascotas, místicos, sagas y premios quedan fuera.
- Panel con cara propia de mercado (toldo, pizarra, etiquetas de estraza): a Francisco el calco del casino no le valía. Modos: Los
  puestos, Tu puesto, La pesada. **Cifras**: 3
  ofertas por puesto, 3 cambios al día, horquillas de 5-20, 10-40 y 20-60 tickets, comisión del 10 %, cobrar hasta 100 tickets a la
  semana, 3 días sin reofrecer lo recibido, un cambio por semana entre las mismas dos personas, rareza igual o contigua en los
  trueques, ofertas de 7 días y cuentas de menos de 3 días solo miran. Mascotas fuera.
- **La pesada de Remedios**: tres encargos al día en una escena dibujada: 6 cajas, 9 cajas y 8 sin saber si pesa de más o de menos.
  Sellos: 1, 2 y 3 en las pesadas justas; con una de más, uno menos (al menos uno). Fallar acaba el día y no quita nada. Canje: venta sin comisión 10, hueco extra 7 días 14 y toldo 18. Sin tickets ni muebles.
- Francisco pidió más personalidad y probar las **salas de varias plantas** en la Lonja. Primero se hizo con cámara entre
  plantas y la descartó con dos maquetas: quiere **toda la sala a la vista, sin transición**. Ahora es un solo dibujo en corte
  (`lonjaArt.js`): la nave abajo (cada puesto es una persona con su personaje y sus muebles en el mostrador; Remedios, la
  lonjera, y un gato) y el altillo arriba (tu puesto, almacén, pizarra y libro de cuentas), con su escalera. La migración da
  también `dueno` y `personaje`.

### 2026-11-04 · cuenta principal · quiosco de la Gaceta, descartado por ahora
- Se hizo y a Francisco no le terminó de convencer: «la descartamos por ahora». No entra en la app ni en git. El trabajo está en
  `material-diseno/gaceta-aparcada/` (archivos nuevos y `cambios.patch`), por si vuelve. La plaza sigue en «Próxima apertura».
- Si se retoma: sin citas, porque son privadas; y tocar una reseña no lleva a la obra, porque no hay vista pública.

### 2026-11-04 · cuenta principal · 1.83.0 cerrada
- PR #8, con base en la rama de la 1.82 (PR #7) para que se vea solo lo suyo.
- Francisco dijo «cierra la sala»: versión en `src/diag.js`, `package.json`, `public/sw.js` y la cabecera del SPEC, y §83
  escrito. Commit en la rama `1.83-sala-lectura`, subida y PR desde el navegador.
- **Sin publicar** y **la migración sin aplicar**. Antes de «súbelo», ofrecer el flujo del SQL Editor, primero la de la 1.82.

### 2026-11-04 · cuenta principal · sala de lectura (en la 1.83.0)
- Francisco pidió personajes con su mascota en vez de iconos: se dibujan sentados dentro de la escena, con un libro, y el
  legendario en el suelo. **Migración nueva sin aplicar**: `20261113120000_hotel_sala_lectura.sql` (`sala_lectura_personajes`,
  para ver a quien lee en otro edificio). Sin ella se ve a los vecinos y a ti; a los demás, con el personaje de base.
- Francisco no le veía sentido a la sala y eligió «Librería y compañía»: lomos en una balda común (`SalaLibreria.jsx`), saludo
  entre quienes leen a la vez y «Has leído con…» al acabar. Va en la misma migración. Sin ella no se enseñan.
- Probado con Supabase simulado y PGlite, **sin probar entre dos cuentas reales**. La presencia caduca a los 3 minutos sin
  renovar, y solo se renueva con la app visible: con el móvil bloqueado no se te ve ni llegan saludos.
- El quiosco espera a que Francisco dé por buena la sala.
- Francisco propuso recuperar las figuras como muebles animados que no salen en sobres. Muestra en
  `material-diseno/figuras-habitacion/figuras-habitacion.html` (fuera de git). Propuesta sin decidir: ganarlas al terminar el libro
  y exponerlas en la galería de vitrinas. Antes hay que confirmar con él el parecido con personajes de las sagas.
- Primer bloque del paso D, en la rama `1.83-sala-lectura`, **sin commit y sin subir versión**. El café-biblioteca ya abre
  (`SalaLectura.jsx`, `salaArt.js`). Sin migración: usa el temporizador de la app y `reading_presence`, con `SeatChoice`.
- Al sentarte empieza la sesión; al acabar, `SessionReport` (exportado de `PomodoroTray`) apunta las páginas ahí mismo y te
  levanta. Sin comunidad se puede leer igual, pero no te ven ni ves a nadie.
- Quien se sienta aquí también aparece en el salón: es la misma presencia.
- Pruebas: `v183-sala-lectura` en 320, 390, escritorio y WebKit (emulación). `v174` y `v177` usan ahora el salón de baile
  como planta cerrada. Capturas `v183-*`.

### 2026-11-04 · cuenta principal · 1.82.0 cerrada
- Francisco dijo «ciérrala antes» de seguir con el rascacielos: versión en `src/diag.js`, `package.json`, `public/sw.js` y
  la cabecera del SPEC, y §82 escrito. Commit `28ea034` en la rama `1.82-casino-garbanzos`, subida y PR #7 desde el navegador.
- **Sin publicar** y **la migración sin aplicar**. Antes de «súbelo», ofrecer el flujo del SQL Editor.

### 2026-11-04 · cuenta principal · garbanzos y avisos al momento (en la 1.82.0)
- Francisco pidió avisos más rápidos, seguir jugando con amigos apostando garbanzos, premios por garbanzos y cambio con
  tickets con límite.
- **Avisos**: toque sin datos por Realtime Broadcast al canal `casino-<uid>` (`escucharMesas` y `avisarMesa` en `service.js`),
  más consulta cada 20 s en el edificio y cada 15 s en el casino. Había un fallo: dentro del casino, sin mesa en marcha,
  una invitación nueva no llegaba. Broadcast comprobado en el proyecto real con la clave pública (menos de 1 s).
- **Por qué no se podían apostar garbanzos**: el formulario desaparecía tras la mesa del día con ese amigo o sin manos.
- **Mesas de garbanzos**: `solo_garbanzos`, manos numeradas desde la 11, sin fichas, 6 al día por persona.
- **La lata** (`LataGarbanzos.jsx`): tarro 150, baraja 300 y taburete 600. Cambio: 50 garbanzos por 5 tickets y 5 tickets por
  25 garbanzos, 10 tickets a la semana en cada sentido. Las cifras las he propuesto yo.
- **Migración nueva sin aplicar**: `20261112120000_hotel_casino_garbanzos.sql`.
- Pruebas: vitest de edificio (123) y e2e `v180-casino` en 320, 390, escritorio y WebKit (emulación). Capturas `v182-*`.
- **Sin verificar**: el aviso entre dos cuentas reales. Fuera del edificio (en la biblioteca) sigue sin haber aviso.

### 2026-11-04 · cuenta principal · 1.81.0 publicada
- Francisco dijo «Súbelo»: avance rápido de `main` hasta la rama `1.81-casino-avisos` (PR #6), push y Vercel; `/sw.js`
  ya sirve la 1.81.0. La migración ya estaba aplicada.
- **Decisión de Francisco** («Dejarlo así»): se mantiene el camino fichas → sobre del casino → reciclar, aunque dé
  tickets sin leer.

### 2026-11-04 · cuenta principal · 1.81.0 cerrada
- Francisco dijo «Cierra la 1.81»: versión en `src/diag.js`, `package.json`, `public/sw.js` y la cabecera del SPEC, y §81
  escrito. Commit `64a6f38` en la rama `1.81-casino-avisos`, subida y PR #6 desde el navegador.
- La migración se aplicó el 4-11-2026 con el SQL Editor: SHA-256 igual al del archivo de git, Francisco
  pulsó Run («Success. No rows returned») y anon recibe 42501 en las cuatro funciones.

### 2026-11-04 · cuenta principal · cambios tras probar el casino (en la 1.81.0)
- Francisco pidió cuatro cambios tras usar la 1.80:
  - **Casino sin exigir lectura**: abre todos los días. Fuera `leidoHoy` y el cartel de la puerta apagada; regla en CLAUDE.md.
  - **Mesa para dos**: las mesas que te esperan avisan en todo el edificio con una nota (`.ed-aviso`, «Ir al casino»
    sin el viaje en limusina) y en el buzón, que también dice cuándo ha terminado una mesa. El panel mira cada 45 s; dentro
    del casino, cada 15 s con una mesa en marcha. Con una mesa que te espera, el casino abre en «Con un amigo».
  - **Mover muebles**: ya elegido se arrastra sin esperar; sin elegir, pulsación de 200 ms (antes 320) con 14 px de margen.
  - **Sin la suite de la semana**: fuera de la fachada, el Directorio y el ascensor (su bloque cuenta como mirador).
    Borrados `SuiteSemana.jsx`, `suite.js`, su CSS, su servicio y `v179-suite`. Interpreté «sala de exposición de
    muebles» como esta sala. Sus tablas y funciones siguen en la base de datos y la placa sigue en el catálogo.
- **Migración nueva sin aplicar**: `20261111120000_hotel_casino_arreglos.sql` (la aplica Francisco). Tres arreglos:
  - **Fallo de la 1.80**: `piso_casino_semana` sumaba las fichas de siempre, porque `dia` era la columna y no el
    parámetro. El tope de 150 no se reiniciaba el lunes. Comprobado con una prueba que fallaba (150 en vez de 0).
  - Quien invita guarda una mano para esa mesa. Antes podía jugar sus tres y el amigo no podía aceptar.
  - Una invitación de ayer aceptada hoy cuenta entre las manos de hoy.
- Pruebas: vitest de edificio en verde; e2e `v180-casino` y `v178-mover` en 320, 390, escritorio y WebKit (emulación);
  `v174`, `v175`, `v177-hotel-directorio` y `v178-paseo` en 390. Capturas `v181-aviso-*`.
- **Sin verificar**: no sé qué falló exactamente a Francisco al invitar. Encontré y arreglé lo anterior, pero no he
  mirado sus datos: la lista de amigos exige que os sigáis los dos y tener la comunidad activada.
- **A decidir por Francisco**: sin exigir lectura, se pueden conseguir tickets sin leer (fichas → sobre del casino →
  reciclar). El tope de 150 fichas a la semana da para poco más de un sobre.

### 2026-11-03 · cuenta principal · 1.80.0 publicada
- Francisco dijo «Súbelo»: avance rápido de `main` hasta la rama `1.80-casino` (PR #5), push y Vercel; `/sw.js`
  ya sirve la 1.80.0. La migración ya estaba aplicada.

### 2026-11-03 · cuenta principal · migración de la 1.80.0 aplicada
- Francisco dijo «Sí, hazlo tú». Claude pegó `20261110120000_hotel_casino.sql` en el SQL Editor del proyecto
  `bookshelf` y su SHA-256 coincidía con el de git (`0eb0abf9…1539`). Francisco pulsó «Run» y salió «Success».
- Comprobado con la clave pública: las ocho funciones del casino y las tablas `piso_casino_cuentas`, `_mesas` y `_manos`
  dan 42501 («permission denied») al anónimo, no «not found».
- La 1.80.0 sigue sin publicar: falta «súbelo».

### 2026-11-03 · cuenta principal · 1.80.0 cerrada
- Francisco dijo «Cierra la 1.80»:
  - versión en `src/diag.js`, `package.json`, `public/sw.js` y la cabecera del SPEC;
  - §80 escrito;
  - commit `2c290b9` en la rama `1.80-casino`, subida y PR #5 desde el navegador.
- La migración se aplicó el 4-11-2026 con el SQL Editor: SHA-256 igual al del archivo de git, Francisco
  pulsó Run («Success. No rows returned») y anon recibe 42501 en las cuatro funciones.
- Las tres entradas de abajo (bloque 1, mesa y caja) van en ese commit.

### 2026-11-03 · cuenta principal · casino del sótano: «Las 21 páginas», la mesa para dos y la caja (en la 1.80.0)
- Francisco dijo «vale continua» tras publicar la 1.79.0: paso C del plan del hotel (`docs/qa/gran-hotel.md` §9.4,
  decisiones del 2-11-2026). Bloque 1 de 2, **sin commit y sin subir versión** (se cerrará como 1.80.0):
  - Migración `supabase/migrations/20261110120000_hotel_casino.sql` (**sin aplicar**): fichas aparte
    (`piso_casino_cuentas`), manos del día con el mazo guardado en el servidor (`piso_casino_manos`),
    `piso_casino(dia)`, `piso_casino_repartir(dia)`, `piso_casino_jugar(dia, 'pedir' | 'plantarse')`. Tres manos al
    día, sin apostar: veintiuna servida 12 fichas, ganar 8, empate 4, perder 2; tope de 150 a la semana. El crupier pide
    hasta 17. Mientras se juega solo se ve la primera carta del crupier. Pruebas PGlite en
    `src/features/edificio/__tests__/casino.rls.test.js` (10).
  - Cliente: `hotel/Casino.jsx` (sala), `hotel/casinoArt.js` (dibujo isométrico: moqueta roja, mesa de tapete,
    crupier con visera, neón «21», ventanilla de la caja), `hotel/veintiuna.js` (reglas, cartas y «¿has leído hoy?»; no
    se llama `casino.js` porque en Windows choca con `Casino.jsx`). Servicio en `service.js`. Puerta de neón rosa a
    la derecha de la marquesina (`hotelArt.js`, zona `casino`; el macetero de la derecha pasa a x = 11), planta en el
    Directorio y «S» del ascensor abierta.
  - **La lectura del día la sabe la app** (páginas registradas hoy o una sesión, como la caja del Ático): el servidor
    no puede comprobarlo; el límite real es el tope semanal. Como las misiones del día, acepta ayer, hoy y mañana.
  - e2e `e2e-community/v180-casino.spec.js` (4; capturas `v180-*`); `v175` usa ahora la terraza como planta cerrada
    y `v177` cuenta 10 plantas.
- **Más presencia y más videojuego** (Francisco, mismo día: «que el menú de fichas y el propio juego vaya acorde a los
  colores de la sala y sea más videojuego, que dé pie a jugar»): la mesa pasa a ser un tapete verde de cerca con marco
  de latón y nogal, marcador oscuro (fichas en cifras de píxel que suben al ganar, barra de la semana y las tres manos
  como fichas de colores), cartas grandes que se reparten deslizándose, totales en placas, cartel del resultado, botones
  gruesos que se hunden y el crupier que habla en un bocadillo con frases cerradas (nunca empuja a jugar otra). Sonidos
  breves (`deal`, `chips`, `mano-*` en `shopAudio.js`) solo con el sonido de la app; `GranHotel` recibe `soundOn`.
  Con movimiento reducido, sin animaciones. El botón de pedir dice «Pedir carta».
- **La mesa para dos** (Francisco, mismo día; respuestas «Fichas y garbanzos», «Os seguís los dos», «En diferido»;
  regla en CLAUDE.md). En la misma migración: `piso_casino_mesas` (una al día por pareja, índice único sobre la pareja
  sin contar las rechazadas), columnas `garbanzos`/`garbanzos_dia` en las cuentas y `mesa` en las manos (estado nuevo
  `esperando`). RPC `piso_casino_invitar(dia, amigo, fichas, garbanzos)`, `piso_casino_aceptar(mesa)`,
  `piso_casino_rechazar(mesa)` (también retira quien invita), `piso_casino_mesa_jugar(mesa, accion)`; internas
  `piso_casino_amigo` (seguimiento mutuo, comunidad, sin bloqueo), `piso_casino_llegar` (+20 garbanzos el primer juego
  del día), `piso_casino_mesa_resolver` y `piso_casino_mesas_vencer` (invitaciones de hace más de un día se retiran;
  partidas a medias se resuelven plantando a quien faltaba). `piso_casino(dia)` devuelve además `garbanzos`, `mesas` y
  `amigos`. Lo apostado (≤ 10 fichas, ≤ 50 garbanzos cada uno) se aparta al aceptar; gana quien acabe más cerca de 21
  sin pasarse, el empate (o pasarse los dos) devuelve. Cada mano de mesa da +2 de compañía dentro del tope semanal; el
  bote no cuenta para el tope. Las cartas del amigo no se ven hasta resolver. Pruebas `casino-mesa.rls.test.js` (11).
  - Cliente: pestañas «A solas» / «Con un amigo» (con aviso de lo que te espera), `hotel/MesaParaDos.jsx`
    (invitaciones, mesas en curso, invitar con cantidades fijas 0/2/5/10 fichas y 0/10/25/50 garbanzos, la mesa con el
    amigo y sus cartas boca abajo, el bote y el resultado), piezas comunes en `hotel/cartas21.jsx` y
    `hotel/useCountUp.js`. Garbanzos en el marcador. Simulado y e2e ampliados (`v180-casino.spec.js`, 7; capturas
    `v180-mesa-*`).
- **La caja** (Francisco, mismo día: «Sí, la caja», «muy atractiva con recompensas muy llamativas»; precios suyos). En la
  misma migración: `piso_casino_caja_precios()`, `piso_casino_exclusivos()` y `piso_casino_ropa()`; `piso_casino`
  devuelve `caja` ([{ id, tipo, precio, tienes }]) y `piso_casino_canjear(dia, articulo)` cobra y da. Visera 60, raya
  diplomática 80, chaleco de crupier 100, **sobre del casino 120** (una tirada del «Edición coleccionista» con sus
  probabilidades y su pity; los tickets no se tocan: se suman y se restan alrededor de `piso_abrir_sobre`), fedora 140,
  vestido de lentejuelas 200 (con destellos), neón «21» 250, mesa de tapete 300, gramola 400 y el **conejo de la
  chistera 1500** (legendario, compañero). Lo que no es el sobre se tiene una vez («Eso ya lo tienes» antes que las
  fichas). Los cuatro muebles son `especial`/`legendario` y exclusivos: no salen en sobres (`piso_al_azar` y
  `oddsTable` los excluyen), no se compran con tickets, no se reciclan ni se regalan. La ropa del casino no entra en el
  orden de las misiones del día (`piso_prendas_orden`), así que no cambia la regla de «toda la ropa → 5 tickets»;
  `piso_personaje_valido` y `pisos_personaje_prendas` la aceptan (paridad con `validateAvatar`). Pruebas
  `casino-caja.rls.test.js` (7).
  - Dibujos nuevos: ropa en `actor.js` (JERSEYS 15 y 16, PANTALONES 9, visera y fedora; `ROPA_CASINO`,
    `prendaOrigen`), muebles en `furniture.js` y `catalog.js` (`casino: true`), lo animado en `misticos.js`
    (conejo, gramola, tapete y los destellos del vestido); `piso.js` anima los muebles `vivo`.
  - Cliente: tercera pestaña «La caja» (y la ventanilla de la sala), `hotel/CajaCasino.jsx`: el conejo arriba, vivo,
    con rayos, cinta «Legendario · con efectos» y barra de lo que falta; tarjetas con su dibujo de verdad (recortado y
    ampliado), precio en cifras de píxel, «Cambiar» / «Faltan N», confirmación en el sitio y sello «Ya es tuyo»; al
    cambiar, «¡Es tuyo!» o «¡Sobre abierto!» con lo que trae y dónde encontrarlo. Sin cuentas atrás ni ofertas; con
    movimiento reducido, quieto. Estilos al final de `hotel.css`.
  - Simulado (`piso_casino_canjear`, `db.casino.caja` y `sobre`) y e2e `v180-casino.spec.js` (8; capturas
    `v180-caja*` en 320, 390, 1440 y WebKit). Regresión: v170, v172, v173, v175, v177, v178-tanda3 y v179, en verde.
  - **A tener en cuenta**: un mueble que sale del sobre del casino se puede reciclar por tickets como cualquier otro
    del sorteo (es el mismo sobre). El casino solo abre el día que lees y las fichas tienen tope semanal.
  - **Sin verificar**: la ropa y los muebles nuevos dentro del piso y del armario solo se ven en las pruebas de dibujo,
    no con capturas propias.

### 2026-11-03 · cuenta principal · 1.79.0 publicada
- Francisco dijo «Súbelo»: avance rápido de `main` hasta la rama `1.79-suite-semana` (PR #4), push y Vercel; `/sw.js`
  ya sirve la 1.79.0. Las dos migraciones ya estaban aplicadas.

### 2026-11-03 · cuenta principal · migraciones de la 1.79.0 aplicadas
- Francisco dijo «Sí, hazlo tú». Las pegó Claude en el SQL Editor del proyecto `bookshelf`, una a una y en orden,
  comprobando bytes y SHA-256 contra el archivo de git (misiones 2651 B `124268b0…`, suite 11606 B `37f4599d…`), y
  Francisco pulsó «Run» en cada una («Success»).
- Comprobado con la clave pública: el anónimo recibe 42501 en `piso_suite`, `piso_suite_llevar`,
  `piso_suite_retirar`, `piso_suite_semana`, `piso_mision_diaria` y en la tabla `piso_suite_aportes`. Sin una cuenta
  no he probado la suite por dentro en producción.

### 2026-11-03 · cuenta principal · 1.79.0 cerrada
- Francisco pidió «cierra 1.79.0»: versión en `src/diag.js`, `package.json`, `public/sw.js` y la cabecera del SPEC, y
  §79 escrito. Commit `81796fe` en la rama `1.79-suite-semana`, subida, y PR #4 desde el navegador. **Sin publicar** y **las dos
  migraciones sin aplicar**. Antes de «súbelo», ofrecer el flujo del SQL Editor.

### 2026-11-03 · cuenta principal · 1.79.0: misiones con el armario completo, cartela y suite (bloques)
- **Misiones del día con el armario completo**: decisión de Francisco. Con toda la ropa ya ganada, las tres del día dan
  **5 tickets** (`DIARIA_TICKETS`), contados en el servidor. La migración nueva
  `supabase/migrations/20261109120000_edificio_diarias_tickets.sql` está **sin aplicar**. La hoja «Hoy» lo dice y se
  abre sola al ganarlos. Es la segunda excepción a «los tickets solo se ganan leyendo» (anotada en CLAUDE.md).
- **Cartela de la fachada del hotel más pequeña** sin planta elegida: solo el nombre y «Toca una planta», con lo demás
  para el lector de pantalla. El hotel se ve más grande y se ajusta con una transición corta (sin ella con movimiento
  reducido).
- Pruebas: PGlite diarias (5), e2e v170 (390, escritorio) y v174/v177 (320, 390, escritorio, WebKit 390).
- **Paso B del hotel, «La suite de la semana»** (`hotel/SuiteSemana.jsx`, `hotel/suite.js`). Primero lo hice con
  candidatos por edificio y votación de todo el hotel, como decía el plan, pero Francisco lo rechazó el 3-11-2026: **el
  hotel es lo social y el edificio lo personal**. Ningún piso sale de su edificio y no se vota.
  - Ahora es una habitación común que empieza vacía cada lunes. Cada huésped lleva **un mueble suyo**, sin perderlo:
    corriente, de suelo, alfombra o pared.
  - Lo puede mover («Otro sitio»), cambiar o retirar, y se ve quién trajo cada cosa.
  - Con 4 semanas distintas aportando gana la «Placa de la suite», una vez. Es de rareza `especial`: no se compra, ni
    sale en sobres, ni se regala, ni se recicla. Ni tickets ni fichas.
  - El ático de la fachada es una zona nueva, abierta en el Directorio y con la «Á» del ascensor.
  - Migración `20261109130000_hotel_suite_semana.sql`, **sin aplicar**.
  - Pruebas: PGlite `suite.rls.test.js` (10) y e2e `v179-suite` (320, 390, escritorio, WebKit 390).
  - La placa colgada en un piso aún no se ha mirado en una captura.

### 2026-11-03 · cuenta principal · migraciones de la 1.78.0 aplicadas
- Francisco preguntó por qué no se habían hecho las migraciones «como siempre» y dijo «Sí, hazlo tú». Él inició sesión
  en Supabase en el panel; las pegó Claude en el SQL Editor del proyecto `bookshelf`, una a una y en orden, comprobando
  bytes y SHA-256 contra el archivo de git (regalos 2405 B `7d0c52c8…`, tanda 3 5415 B `0413ee58…`), y Francisco
  pulsó «Run» en cada una («Success»).
- Comprobado con la clave pública: `piso_sobre('balcon')` ya trae el telescopio y el perrito; `piso_prendas_orden`
  llega hasta la capa; `piso_personaje_valido` acepta el conjunto «Noche estrellada»; el anónimo recibe 42501 en
  `piso_regalar`.
- **Para la próxima**: al cerrar o subir una versión con migraciones, ofrecer este paso antes de publicar.

### 2026-11-03 · cuenta principal · 1.78.0 publicada
- Francisco dijo «Súbela»: avance rápido de `main` hasta la rama `1.78-encargo-3-11` (PR #3), push y Vercel; `/sw.js`
  ya sirve la 1.78.0. No he comprobado desde aquí si las dos migraciones están aplicadas: sin ellas, los regalos siguen
  con las reglas de antes en el servidor y los muebles nuevos no salen en los sobres.

### 2026-11-03 · cuenta principal · 1.78.0 cerrada
- Francisco pidió «cierra 1.78.0»: versión en `src/diag.js`, `package.json`, `public/sw.js` y la cabecera del SPEC;
  §78 en `SPEC.md` con los seis bloques; commit en la rama `1.78-encargo-3-11`, push de la rama y PR a `main` desde el
  navegador integrado (PR #3). Sin publicar (no se ha subido `main`).
- Las entradas de abajo (bloques 1 a 6) van todas en este commit.
- Queda: que Francisco aplique las dos migraciones y, cuando lo diga («súbelo»), fusionar y comprobar `/sw.js`. WebKit
  no pasado; nada probado en un iPhone real. Sigue pendiente su respuesta sobre el cartel VIDEOCLUB.

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 6: tu habitación, la protagonista (en la 1.78.0)
- Al entrar en tu piso ya **no se decora**: la habitación a pantalla completa, sin la balda, con el nombre del piso
  pequeño (sin «Tus vecinos lo ven…»). Abajo, una fila de **iconos con su nombre**: Luz, Hoy (si hay misiones),
  **Armario** (icono nuevo de jersey en `pixelUi.js`; antes solo se abría tocando a tu personaje, que sigue valiendo)
  y Decorar, que saca la balda. Decorando, los botones vuelven a las esquinas como antes (sin el armario, para que
  quepa a 320). En la vista de ficha y en casa de un vecino no cambia nada.
- Se sigue abriendo decorando cuando vienes de la tienda a poner un mueble y justo después de elegir «Tu mudanza»
  (prop `decorate` de `PisoView`), para colocar lo nuevo.
- Pruebas ajustadas a la entrada sin decorar: v163 (comprueba la fila de iconos), v166, v169, v170, v171, v172 y
  v178-mover. Pasan v163, v166, v169, v170, v171, v172, v173, v176, v177-armario, v178-mover y v178-tanda3 en Chromium
  320, 360, 390 y escritorio, y `e2e/edificio-puerto` a 390. WebKit no pasado.
- Con esto, el encargo del 3-11-2026 está entero. Falta cerrarlo como 1.78.0 (versión, SPEC, ESTADO y commit) cuando
  Francisco lo pida, y que aplique las dos migraciones (`20261108120000_edificio_regalos_diarios.sql` y
  `20261108130000_edificio_tanda3.sql`).

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 5: más difícil mover un mueble sin querer (en la 1.78.0)
- En tu piso, decorando (`piso.js`): un mueble solo se levanta si se **mantiene pulsado** un momento (`HOLD_MS`,
  320 ms) sin mover el dedo; entonces suena, se ve «en la mano» con su contorno y ya se arrastra. Un toque lo elige
  (con sus herramientas); un deslizamiento rápido no lo mueve y lo explica («mantenlo pulsado un momento y luego
  arrástralo»). **Tocar un hueco con un mueble elegido ya no lo lleva allí**: lo suelta. Lo levantado y soltado sin
  moverlo se queda donde estaba. La balda (sacar muebles) y el teclado no cambian.
- Pruebas: nueva `e2e-community/v178-mover.spec.js`; ajustada la de arrastrar de `e2e/edificio-puerto.spec.js`
  (mantiene pulsado antes de mover). Pasan v169, v170, v171, v172, v177-armario, v178-tanda3 y v178-mover en Chromium
  360, 390 y escritorio, y `e2e/edificio-puerto` a 390. WebKit no pasado.

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 4: tu personaje va andando a la tienda y a la limusina (en la 1.78.0)
- En la fachada (`facadeView.js`, `walkAlong`), al tocar la tienda o la limusina, tu personaje (con su ropa) sale del
  portal, cruza el muelle y entra; luego, lo de siempre (te asomas al escaparate, o el viaje en limusina). Tocar otra
  vez mientras anda lo salta. Con movimiento reducido, directo como antes. Las ventanas de los pisos siguen igual.
- Si te acompaña un legendario (el dragoncillo, el zorro o la cinta), sale detrás de ti con un poco de retraso y se
  mueve a su manera (`misticoSprite` en `misticos.js`), mirando hacia donde va. El perrito no: es un mueble del piso.
- Arreglado durante la prueba: sin aspecto guardado, el paseo fallaba y la limusina no hacía nada; ahora usa el aspecto
  de siempre y, si algo falla al dibujar, se entra directamente.
- Dibujo: `renderActorWalk` (`render.js`) hace una tira de cuatro pasos mirando hacia donde va, con la escala y el giro
  de la fachada; `facade.js` da el camino (`walk`) y la limusina con el chófer en una capa aparte, que se pone encima
  para que el coche lo tape cuando pasa por detrás (por debajo de las placas).
- Pruebas: nueva `e2e-community/v178-paseo.spec.js` (anda hacia la tienda y la tienda se abre al llegar; la limusina,
  también con el compañero; saltar tocando; movimiento reducido). Pasan v163, v167, v174 y v178-paseo en Chromium 360, 390 y escritorio. Lint
  sin avisos en el edificio. WebKit no pasado. En el hotel no hay paseo (no hay personaje en sus salas todavía).

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 3: tanda de muebles con mascota, ropa «Noche estrellada» y efectos en la fachada (en la 1.78.0)
- Muebles (`catalog.js`, `furniture.js`): perchero, cesto de mantas y jarrón (comunes); chimenea con lumbre, piano y
  tapiz (poco comunes); telescopio y **el perrito**, la mascota (raros; en su cojín, con tres pelajes); y un místico,
  el búho de las constelaciones (solo en «Edición coleccionista», como los demás). El perrito y el búho se mueven
  (`misticos.js`: el perrito mueve la cola, parpadea y a ratos se tumba con una «z»; el búho gira la cabeza).
  Van en los sobres de su tipo: salón (piano), luces (chimenea y tapiz) y balcón (el resto). Con 4 raros en el balcón,
  cada uno queda a 1,5 % (el 6 % de raro no cambia); ajustada v167.
- Ropa (`actor.js`): jerseys Coral, Turquesa y Noche estrellada; pantalones Burdeos y Medianoche; sombrero de paja,
  gorra marinera y capa de estrellas. Se ganan con las misiones del día, después de lo de antes. **Conjunto «Noche
  estrellada»** (jersey 14 + pantalón 8 + capa): el jersey lleva estrellitas que brillan; con la capa, polvo de
  estrellas a tu alrededor y una estela al andar; con el conjunto entero, más motas y un halo (`piso.js`).
- Fachada (`facadeView.js`, `edificio.css`): una gaviota lejana, una estrella fugaz de vez en cuando y luciérnagas a lo
  largo de la orilla. Con movimiento reducido, nada de esto se mueve.
- **Migración nueva `supabase/migrations/20261108130000_edificio_tanda3.sql`** (la aplica Francisco, después de
  `20261108120000_edificio_regalos_diarios.sql`): filas del catálogo, sobres con los muebles nuevos, ropa válida y su
  orden. Sin ella, los muebles nuevos no salen en los sobres del servidor.
- Pruebas: nueva `e2e-community/v178-tanda3.spec.js`; ajustadas `personaje.rls.test.js`, `inventario.rls.test.js` y
  v167. Pasan Vitest del edificio (68), v163, v167, v169, v170, v172, v173, v177 y v178 en Chromium. Build correcto y
  lint sin avisos en el edificio. WebKit no pasado.

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 2: vestíbulo discreto y sobres con más impacto (en la 1.78.0)
- Vestíbulo (`hotel/Vestibulo.jsx`, `hotel/hotel.css`): al entrar no hay nada abierto, solo el dibujo con letreros
  pequeños (plaquitas oscuras con filo de latón, la zona para el dedo sigue grande) y una línea «Toca la recepción…».
  Al tocar algo sale su papel, más compacto (encargos en una línea con barra fina), con «×»; tocar el mismo letrero o
  Escape lo cierra, y un segundo Escape sale a la plaza. Probé a acercar el dibujo en el móvil y cortaba el
  guardarropa: descartado.
- Sobres (`GachaReveal.jsx`, `tienda.css`): cada carta lleva el color de su rareza (fondo, cinta con el nombre y rayos
  desde poco común); lo raro o mejor, al darse la vuelta, tiñe la escena un instante y suelta confeti de píxel; el
  sobre cerrado lleva un brillo que lo cruza cada pocos segundos (igual en todos: no adelanta nada); al final, un
  recuento por rarezas con su color («1 raro · 2 poco comunes · 2 comunes»). Con movimiento reducido, colores y
  recuento sí; brillo, destello y confeti no. Arreglado además un aviso «ResizeObserver loop» del ajuste del bloque 1.
- Pruebas: nueva `e2e-community/v178-sobre-impacto.spec.js` (360/390 y movimiento reducido); ajustada v175. Pasan
  v167, v173, v174, v175, v176, v177 y v178 en Chromium (320/360/390/escritorio según cada una). Build y lint sin
  avisos en lo tocado. WebKit no pasado.

### 2026-11-03 · cuenta principal · encargo del 3-11-2026, bloque 1: arreglos (en la 1.78.0)
- Encargo de Francisco (captura de iPhone y lista de diez cosas, antes de seguir con el plan del rascacielos); las
  reglas están en `CLAUDE.md` («Encargo del 3-11-2026»). Este bloque hace las cuatro primeras:
  - Revelación del sobre cortada en el iPhone (`GachaReveal.jsx`, `tienda.css`): el panel es una rejilla y la escena,
    con su `overflow` recortado, se encogía y se comía el pie. Ahora no se encoge y su ancho se ajusta para que quepan
    la escena, «Colocar en mi piso» y «Volver a la tienda» (comprobado a 414×896 con zona segura de iPhone, emulado).
  - Sin sellos (`VecinoMesa.jsx`, `EdificioPanel.jsx`): la mesa del vecino tiene «Libro de visitas» y «Regalar»; sin la
    migración de vecinos no se enseña nada. El correo ya no lista sellos. Los datos de `piso_sellos` no se borran.
  - Buzón de la fachada (`facadeView.js`, `edificio.css`): la carta y su número solo cuentan lo no leído; al abrir la
    nota se marca leído (guardado por usuario en este aparato, `bookshelf:edificio:correo-leido:<uid>`) y la carta se
    va; al salir de un piso y volver no reaparece ni la nota se queda abierta. Lo nuevo va en negrita.
  - Regalos: uno al día (24 h), solo hasta «raro», solo si tienes más de una copia y alguna sin colocar. Lo comprueba
    `supabase/migrations/20261108120000_edificio_regalos_diarios.sql` (**Francisco tiene que aplicarla**; hasta
    entonces el servidor deja los cinco al día de antes, aunque la app ya solo ofrece lo permitido). La app recuerda
    en el aparato cuándo regalaste y, si el servidor dice que ya regalaste hoy, lo dice.
- Pruebas: Vitest RLS de vecinos (9, con las reglas nuevas) y místicos; e2e v163, v171 (ajustadas) y v176. Lint sin
  avisos en lo tocado.
- Queda: los bloques siguientes del encargo (vestíbulo, impacto de sobres, efectos y tandas de ropa y muebles con
  mascota, el personaje que camina, mover muebles sin querer, la habitación protagonista). Sin cerrar versión.

### 2026-11-02 · cuenta principal · 1.77.0: fachada del Gran Hotel y armario «Compañía» (publicada)
- Encargo de Francisco (dos textos y una maqueta de dos paneles): la fachada del hotel con su Directorio (panel
  izquierdo) y el armario de «Tu piso» con la pestaña «Compañía» (panel derecho). Cerrado como 1.77.0 («Sí, cierra
  1.77.0»): versión subida, SPEC §77 y PR #2 desde la rama `1.77-hotel-armario`; publicada con «súbela» (avance
  rápido de `main`; Vercel sirve la 1.77.0).
- Hotel (`hotel/GranHotel.jsx`, `hotelView.js`, `hotelArt.js`, `hotel.css`, barra de `EdificioPanel.jsx`): barra
  «← Al puerto» (antes «Volver en limusina») y «Directorio»; el hotel entero, de la aguja a la limusina, por encima de
  una cartela crema al pie (nombre corto, «Próxima apertura» o «Abierto», lema). La planta elegida lleva un filete de
  latón y un rombo unido a su izquierda, dibujados en el propio lienzo (van con la planta a cualquier tamaño). El
  Directorio es una lista HTML con las siete plantas y su estado; elegir una ahí da exactamente lo mismo que tocarla
  (la prueba compara los píxeles); el vestíbulo se entra. La animación se para cuando la fachada no se ve. La limusina
  lleva un filo de luz en su perfil (`bodyId` en `drawLimo`) para leerse sobre el empedrado, y la gente que la tapaba
  se ha apartado. Se quitó la nota flotante (`gh-card`).
- Armario (`piso.js`, `misticos.js`, `render.js`, `edificio.css`, barra de `EdificioPanel.jsx`): ya no va dentro de la
  balda: es un modo propio del piso (se abre tocando a tu personaje o la pestaña «Armario»). Barra «← Al piso» y
  «Armario»; arriba, el piso de verdad encuadrado en tu personaje (si no hay sitio a su lado, se coloca en el hueco
  libre más cercano) con quien te acompaña posado a su derecha, mirándolo; abajo, Ropa (jersey, pantalón, gafas,
  complemento), Aspecto (piel, pelo, color) y Compañía (dos tarjetas por fila, borde oliva y marca en la elegida,
  «Sin compañía» primero). Todo se ve al momento y **solo se guarda con «Listo»** (la misión «armario» cuenta al darle);
  «← Al piso» o Escape lo dejan como estaba. El dragón, posado, llega a la cintura, con las alas a medio abrir y un
  batido corto cada 3,4 s; el zorro mueve la cola como antes; con movimiento reducido, quietos. Se quitó la cabina 1.74.
- Pruebas: nuevas `e2e-community/v177-hotel-directorio.spec.js` (360/390) y `v177-armario.spec.js` (390 y 360 con
  movimiento reducido); ajustadas v169, v170, v172, v174 y v175. Pasan en Chromium; WebKit no se ha pasado esta vez
  (emulación; nada probado en un iPhone real). Build, Vitest (377) y lint sin errores nuevos.
- Queda: el
  cartel VIDEOCLUB / «LA TIENDA DEL BAJO» sigue pendiente de su respuesta.

### 2026-11-02 · cuenta principal · 1.76.0: apertura de sobres sobre el mostrador (publicada)
- Encargo de Francisco (dos documentos y una maqueta de tres pantallas: tienda, sobre cerrado y apertura de cinco), luego
  «haz que se parezca más a las maquetas», varias listas de correcciones y la maqueta del sobre cerrado y «1 de 5».
  Cerrado como 1.76.0 («Sí, cierra 1.76.0»): versión subida, SPEC §76 y PR #1; publicada con «súbelo» (avance
  rápido de `main`; Vercel sirve la 1.76.0).
- Hecho: una definición del sobre por colección (`shopArt.js`: faja crema alta con el mueble de portada con margen,
  borde del color de la colección, tira dentada con la pestaña roja de una pieza que asoma por arriba) usada en el
  expositor, el selector (sobres grandes, sin precio) y el mostrador. En el mostrador de cerca el sobre está **de frente
  e inclinado** en el centro de la madera (`counterPack` en `shopRoom.js`, misma cámara): un tercio del ancho y un alto
  visible 1,4 veces el ancho (la inclinación se despeja de la proyección), abombado y modelado por la luz, con sombra en
  cuña; sellados crema con estrías, tres pliegues, línea de rasgado discontinua y la pestaña roja levantada con sombra.
  La zona que se toca es su recuadro proyectado. Tres gestos: la tira se desprende entera y queda justo encima; el sobre
  se desliza a la izquierda y la primera carta asoma boca arriba por su boca (nombre legible) mientras las otras cuatro
  esperan en 2 × 2 a la derecha (dorsos con filete dorado): «1 de 5 reveladas» (`layout.peek` en `counterLayout`); al
  continuar (tocar un dorso o «Revelar todas»), las cartas van a **un solo reparto 3 + 2**, el mismo para la revelación
  y la elección, y el sobre vacío y la tira se deslizan hasta quedar **fuera del encuadre** (`exit` / `stripExit`,
  medidos con sus píxeles dibujados, sombra y giro incluidos, para que no asomen ni a 360 px); al final ya no se montan.
  Encuadre
  más bajo (ANCHOR_Y 0,344, tablero hasta 8,05): la cara de la dependienta libre y madera detrás de la primera fila y
  delante de la segunda. El pie tiene su alto reservado desde el principio. Con movimiento reducido, la misma
  composición final, sin sobre ni tira. Abajo, la franja crema de la maqueta («Sala de estar» /
  «Toca para rasgar el precinto.», luego «N de 5 reveladas» y «Revelar todas»). Rareza con texto y filo fino; «Nuevo»
  terracota; la carta elegida lleva un ✓ pequeño dentro, arriba a la izquierda, y la acción dice «Colocar [nombre]»: abre tu piso decorando con ese mueble puesto
  y elegido (`placeId` en `mountPiso`); «Guardar» lo devuelve al inventario y el piso queda como estaba. Nada se vuelve
  a cobrar ni a sortear.
- Pruebas: `e2e-community/v176-sobre-mostrador.spec.js` y `v176-rasgado.spec.js` (graba el rasgado a 360), v167 y v173
  ajustadas; pasan en Chromium 360/390/1440 y WebKit 390 (emulación; nada probado en un iPhone real).
- Queda: el cartel del local dice VIDEOCLUB y la maqueta «LA TIENDA DEL BAJO» (no se ha cambiado sin preguntar); nada más
  de este bloque.

### 2026-11-02 · cuenta principal · 1.75.0: el vestíbulo del Gran Hotel con el ascensor de latón (publicada)

- Francisco pidió para el hotel la Lonja (intercambio de muebles), la habitación de la semana, un casino con moneda
  propia, ropa exclusiva y una mascota cara de casino, y «otras salas» que unan las funciones de la app. Plan en
  `docs/qa/gran-hotel.md` §9. **Decisiones** (§9.7, también en CLAUDE.md): minijuego «Las 21 páginas»; casino sin
  apostar y solo si ese día has leído; suite de la semana en dos pasos y voluntaria; empezar por el vestíbulo.
- Hecho el paso A (SPEC §75): al tocar el vestíbulo en la fachada se entra; recepción con los encargos de la semana
  (las misiones, cobrables en tickets), ascensor con la botonera de plantas («P» sale a la plaza), tablón y
  guardarropa con «Abre pronto». «A la calle» y Escape vuelven a la fachada. Sin migraciones.
- Probado: `v175-vestibulo` y `v174-limusina` en Chromium 320/390/1440 y WebKit 390, build y oxlint del edificio.
  No probado en un iPhone real.
- Francisco: «me gusta mucho la habitación, no me gusta cómo se ve esto» (la botonera con degradado): rehecha en
  pixel art (placa de latón, esfera con aguja que gira, botones de píxel). Después, «Commit y súbelo».
- Siguiente paso del plan: B, la suite de la semana (necesita migración).

### 2026-11-02 · cuenta principal · 1.74.0: los menús de debajo de las habitaciones, la cabina del armario y la limusina al Gran Hotel (publicada)

- Francisco: «mejorar la interfaz de cómo se ven los menús que están debajo de las habitaciones», y para el armario
  «una cabina, que se vea tu personaje en grande y que puedas ir cambiando los tipos de accesorios, más organizado».
  SPEC §74.
- Balda: pestañas con su nombre a la vista y la fila difuminada donde sigue; sin la línea de título. Armario: cabina
  con el personaje en grande (y el compañero flotando) y una pestaña por clase con sus muestras en cuadrícula. Mesita
  del vecino: de madera, con las frases en dos columnas enteras.
- Probado en Chromium 320/390/1440 y WebKit 390 (e2e del edificio y `e2e/edificio-puerto.spec.js`), Vitest del
  edificio 67/67, build y oxlint. Francisco dio el visto bueno («Commit y súbelo») y se publicó.
- Francisco aprobó los menús («Sí, a la limusina»). **Limusina** (§74.4): dibujada en `edificio/limo.js`, aparcada en
  el muelle delante de la tienda con su chófer; al tocarla, el viaje (2,4 s, se salta tocando; sin él con movimiento
  reducido) y la fachada viva del Gran Hotel (movida de `dev/` a `src/features/edificio/hotel/`), con plantas que se
  tocan y «Abre pronto». «Volver en limusina» vuelve al portal. Prueba `v174-limusina.spec.js` en Chromium
  320/390/1440 y WebKit 390.
- Francisco: «el camino al gran hotel se ve muy simple y plano, y el gran hotel tiene demasiados menús y se
  empequeñece». El viaje es ahora una escena de pixel art (`hotel/ride.js`: la calle del puerto de noche con casas,
  farolas, paseo y agua con reflejos; la cámara sigue a la limusina) y el hotel va sin fila de botones, a toda la
  pantalla, con una nota pequeña por planta.
- Pendiente: decidir si al hotel también se llega desde la tablet del Salón (`docs/qa/gran-hotel.md` §7.1).

### 2026-11-02 · cuenta principal · 1.73.0: místicos en los sobres, melodía y pantalla completa (publicada en `01585c3`; migración aplicada)

- Francisco: «continúa» (bloque 3 de los místicos), «no oigo la melodía que te pasé», «que la app ocupe toda la
  pantalla sin dejar un borde encima» y sus instrucciones para el audio. SPEC §73.
- **Místicos en los sobres**: 1 % en «Edición coleccionista» (¼ legendario), restado de lo raro, sin pity propio;
  probabilidades a la vista y aparición propia en el sobre. **Migración aplicada en producción** (2-11-2026, «hazlo tú»: pegada con su SHA-256 y Francisco pulsó Run, «Success»; el anónimo recibe 42501 en `piso_abrir_sobre`, y `piso_sobre` ya devuelve raro 0,14 y místico 0,01):
  `supabase/migrations/20261107120000_edificio_misticos_sobres.sql` (5358 bytes, SHA-256 `8571fdc8…`).
- **Melodía**: no sonaba porque se quedó en «más adelante» y nunca se metió. Ahora `public/media/edificio/dos-balcones.mp3`
  (copiada del audio de WhatsApp de Francisco) suena en bucle en el edificio con `edificio/music.js` (Web Audio).
  Sin probar en un iPhone real; el WebKit de Playwright en Windows no tiene Web Audio.
- **Pantalla completa**: el edificio en el móvil ya no deja la franja de arriba (`edificio.css`, al final).
- **Portal sin carteles** (pedido después): sin título ni «Tu puerta…» y sin la tarjeta «Tu buzón»; el correo es un
  buzón dibujado junto al portal con una carta que asoma y una nota al tocarlo (§73.4).
- **Cuenta del fundador**: `supabase/scripts/cuenta_fundador.sql` (10.000 tickets y los cinco místicos para la cuenta
  la cuenta de Francisco, con su correo de BookShelf, que no se guarda en el repositorio porque es público). **Ejecutado** el 2-11-2026 (Run de Francisco): 10000 tickets y los cinco místicos. Probado antes en PGlite.
- **Decisión nueva**: al Gran Hotel se llega en una **limusina negra de lujo** (CLAUDE.md y `docs/qa/gran-hotel.md`).
  Es el siguiente bloque, tras las capturas de este.
- Pruebas: Vitest del edificio 67/67; e2e v163, v167, v169–v173 en Chromium 390 y WebKit 390 (la de música, solo
  Chromium); v167, v172 y v173 en 320 y 1440. Compila; oxlint limpio.

### 2026-11-02 · cuenta principal · 1.72.0: místicos en tu piso y el compañero (publicada; migración aplicada)

- Francisco aprobó las cifras («Sí, esas cifras»: 1 % en «Edición coleccionista», ¼ legendario, sin pity propio) y
  pidió empezar el bloque 2 («Sí, empieza»). SPEC §72.
- Hecho: los místicos en el catálogo (peana + dibujo animado con pixelfx mezclado con la profundidad), la fila «Te
  acompaña» del armario, el compañero que sigue a tu personaje y que ven los vecinos, y que no se reciclen ni regalen.
- **Migración aplicada en producción** (2-11-2026, pegada con SHA-256 `03724c9b…`, 9805 bytes; Francisco pulsó Run: «Success»): `supabase/migrations/20261106120000_edificio_misticos.sql`. Anónimo recibe 42501 en `pisos`, `edificio_portal` y `piso_reciclar`.
  Sin ella, nadie tiene místicos y todo sigue como en la 1.71.
- Pruebas: `misticos.rls.test.js` (7), las de inventario y tienda ajustadas, todas las del edificio en verde (PGlite);
  e2e `v172-misticos` en Chromium 390 y 1440 y WebKit 390, y las de edificio y vecinos en Chromium 390. Compila. Sin probar en un iPhone real.
- Siguiente: bloque 3 (que salgan en los sobres y su animación), cuando Francisco lo diga.

### 2026-11-02 · cuenta principal · místicos, bloque 1: diseños y seguir (sin commit, fuera de la app)

- `src/features/edificio/misticos.js` (no se importa en la app): cinco seres dibujados con el pintor de pixelfx
  (dragoncillo, zorro de bruma, cinta de luz de tormenta, farol de llama azul, rosa bajo estrellas) y `createFollower()`.
- `dev/misticos.html`: galería animada y un piso de prueba donde el legendario elegido sigue al personaje (lienzo
  encima, leyendo `data-actor-at`). 60 fps y sin errores en Chromium. Capturas `qa-report/misticos-*.png`.
- Falta que Francisco apruebe diseños y cifras (1 % en «Edición coleccionista», ¼ legendario, sin pity propio) antes
  de los bloques 2 y 3. Plan en `docs/qa/misticos.md`.

### 2026-11-02 · cuenta principal · hotel vivo y que se toca, pixelfx y reglas nuevas (sin commit, fuera de la app)

- Fachada del Gran Hotel animada e interactiva (`dev/hotel-vista.js`, ver `docs/qa/gran-hotel.md` §0).
- pixelfx (MIT) copiado en `src/vendor/pixelfx/` (núcleo + estrellas fugaces y fuegos artificiales; `LEEME.md` con la
  revisión). Sin la fuente «Patch Pixel». oxlint da avisos en su `rig.js` (no se toca el código ajeno).
- Reglas nuevas en CLAUDE.md: nunca en inglés, pixelfx sí, no usar `material-diseno/barrio-v2/`, rareza «místicos»,
  melodía «Dos balcones» y sonidos estilo Stardew Valley (más adelante), hotel que se toca desde la fachada.
- `material-diseno/barrio-v2/`: Francisco pidió borrarla; mandarla a la Papelera falló (Windows: un archivo en uso).
  Sigue en disco, sin tocar.
- Pendiente de Francisco: cómo se consiguen los místicos, de dónde es la melodía y las decisiones del hotel (§7).

### 2026-11-02 · cuenta principal · concepto «Gran Hotel del Puerto» (sin commit, fuera de la app)

- Francisco pidió imaginar un gran hotel rascacielos, de noche y espectacular, como edificio principal de la parte
  social más abierta (conocer gente, «un poco como Habbo»: solo el género, nunca su arte). Concepto dibujado con el
  motor de la fachada: `dev/hotel-concepto.js` y `dev/hotel-concepto.html` (solo desarrollo; la captura sale en
  `qa-report/hotel-concepto.png`). No toca la app ni Supabase. Plan por plantas y bloques en `docs/qa/gran-hotel.md`
  (sin aprobar): pendiente de que Francisco decida la entrada, el directo, quién entra, el nombre y las plantas (§7).

### 2026-11-02 · cuenta principal · 1.71.0 «más vida en el edificio», bloque 4 (vecinos) (publicada)

- §71: «me gusta» por mueble en la habitación del vecino (`piso.js`, botón con corazón; en tu piso el aviso da la
  cuenta), `VecinoMesa.jsx` con pestañas Buzón / Libro de visitas / Regalar en la franja de abajo, y el buzón del
  portal con regalos y firmas. Frases del libro en `FIRMAS` (`catalog.js`). Servidor:
  `20261105150000_edificio_vecinos.sql` (sin aplicar). El simulado de Supabase lo activa con `db.vecinosSocial`.
- Pruebas: Vitest edificio 59/59 (nueva `vecinos.rls`); e2e v163, v169, v170 y v171 en verde en Chromium 390 y 1440
  y WebKit 390 (v171 también en 320); build y oxlint limpios.
- Francisco vio las capturas y pidió el commit (los bloques 1 a 4 van juntos en él).
- **Migraciones aplicadas en producción** (2-11-2026, Francisco eligió aplicarlas): las pegó Claude en el SQL Editor
  del proyecto `bookshelf`, una a una y en orden, comprobando bytes y SHA-256 contra el archivo (tanda2 3135 B
  `747c2388…`, personaje 3999 B `e66a0a18…`, misiones 6868 B `7d523600…`, vecinos 10181 B `8d6d5483…`), y Francisco
  pulsó «Run» en cada una («Success. No rows returned»). Comprobado con la clave pública: el anónimo recibe
  «permission denied» (42501) en `piso_prendas`, `piso_diarias`, `piso_regalos`, `piso_visitas`, `piso_megusta` y
  en `piso_mi_armario`, `piso_mision_diaria`, `piso_social`, `piso_firmar`, `piso_megusta`, `piso_regalar` y
  `piso_vecino_visible`. Queda: subir la 1.71 cuando lo pida (esta nota de ESTADO va sin commit).

### 2026-11-02 · cuenta principal · 1.70.0 «más vida en el edificio», bloques 2 (personaje) y 3 (misiones del día) (en el commit de la 1.71)

- **Bloque 2** (§69): `actor.js` (aspecto, cajas por pose, caminos por celdas, asientos), dibujado en `render.js`
  (`ACTOR_ID`, `renderActorThumb`); andar, sentarse, tumbarse y pasear, y la pestaña «Tu personaje» (armario) en
  `piso.js`; guardado con `savePersonaje` (copia en el dispositivo) desde `EdificioPanel.jsx`
  (`window.__edificioPiso` solo en desarrollo, para las pruebas). Francisco vio las capturas y dijo «Sí, sigue».
- **Bloque 3** (§70): `dailyMissions.js` (tres de siete al día, por la fecha), complementos y colores nuevos que se
  ganan (`PRENDAS` en `actor.js`), hoja «Hoy en tu piso», candados en el armario. Servidor:
  `20261105140000_edificio_misiones_diarias.sql`. La migración del personaje (`…130000`, aún sin aplicar) se amplió
  para admitir el complemento y las prendas nuevas.
- Versión 1.70.0 en los cuatro sitios y SPEC §69-§70 (la 1.69 no se publicó sola: va dentro de la 1.70).
- Pruebas: Vitest edificio 51/51 (nuevas `actor`, `personaje.rls`, `diarias.rls`); e2e v163, v166, v167, v169 y v170
  en verde en Chromium 390 y 1440 y WebKit 390; build y oxlint limpios.
- **Decisión de Francisco** (ya en CLAUDE.md): las misiones diarias dan ropa del personaje, nunca tickets.
- Francisco: «se ven demasiado grandes las misiones, le quita protagonismo a la habitación». La hoja es ahora una nota
  pequeña encima de su botón (abajo a la izquierda), con textos cortos («Da un paseo», «Mueve un mueble»…); con ella
  abierta, el aviso de la habitación se aparta a la derecha.
- Queda: bloque 4 (vecinos), aplicar las tres migraciones, commit cuando lo pida.

### 2026-11-01 · cuenta principal · «más vida en el edificio», bloque 1 (muebles) y arreglo del sobre (en el commit de la 1.71)
- **Encargo de Francisco**: más muebles; personaje que se mueve por el piso y se personaliza; misiones diarias
  ligadas a la habitación; rework de las interacciones con los vecinos. Sus decisiones, en CLAUDE.md («Más vida en el
  edificio»). Se hace por bloques, con capturas entre uno y otro.
- **Arreglo** (lo vio en su móvil): al abrir un sobre, el papel de abajo se cortaba y no se veía «Colocar en mi
  piso». `.gacha` ya no tiene proporción fija: el alto lo da el papel. Se reproducía en WebKit; la prueba de la tienda
  ahora comprueba que el papel cabe entero con la letra grande.
- **Bloque 1, hecho y sin commit**: 17 muebles nuevos (`catalog.js`, `furniture.js` y la alfombra de rayas en
  `render.js`). Cinco poco comunes y uno raro, la pecera. Entran en los sobres según su tipo; precios,
  probabilidades y pity no cambian. Migración nueva `20261105120000_edificio_muebles_tanda2.sql`, **sin aplicar**:
  sin ella, el servidor rechaza guardar un piso con un mueble nuevo y los sobres no los sortean. Vitest de
  `edificio` y e2e v166/v167 en verde.
- **Pendiente**: que Francisco vea las capturas, aplicar la migración y seguir con el bloque 2 (personaje).

### 2026-11-01 · cuenta principal · 1.68.0 la tienda con el motor de los pisos y secciones en la escena (preparada, sin commit)
- **Encargo de Francisco**: tomar como referencia dos imágenes (una tienda acogedora ilustrada y un primer plano del
  mostrador con la dependienta) y enseñar maquetas. Tras la 1.ª ronda (dibujos 2D planos, ya borrados): «muy plano», que
  se parezca a las habitaciones, con más detalle y profundidad, y que el menú Sobres/Muebles/Reciclar esté integrado
  de forma orgánica y no le quite protagonismo a la tienda.
- **Hecho, sin commit** (la 1.67 sí está publicada, a448a48):
  - `src/features/edificio/shopRoom.js` (nuevo): la tienda con el motor de los pisos (`raster.js`, damero, sombras,
    oclusión y luz de tarde) y el mostrador de cerca, casi de frente, para abrir sobres.
  - Las secciones son objetos de la escena: expositor (Sobres), rincón del sillón (Muebles) y caja de reciclaje
    (Reciclar). Llevan un letrero de papel (`role=tab`) y se toca el objeto; el contorno de la elegida se enciende. Los
    cuatro sobres, en fila debajo.
  - Además: `Tienda.jsx`, `GachaReveal.jsx`, `tienda.css`, `EdificioPanel.jsx` («Volver a la tienda» durante la
    apertura), `App.jsx` (atajo a misiones), `render.js` (exporta `floorColor`), `dev/tienda-dibujos.html` y
    `e2e-community/v167-tienda.spec.js`.
- **Pruebas**: e2e de la tienda en Chromium 320/390/1440 y WebKit 390, más Vitest de `edificio`: todo pasa.
- **Aprobada** por Francisco («Sí, prepárala»). Versión 1.68.0 en los cuatro sitios, SPEC §68 y regla nueva en
  CLAUDE.md (la tienda usa el motor de los pisos y sus secciones son objetos de la escena, sin pestañas grandes).
- **Pendiente**: el commit y la subida, cuando Francisco los pida. No hace falta migración. El cartel «VIDEOCLUB» se lee
  regular a ese tamaño. Siguen pendientes los sonidos cozy del edificio y la prueba con una cuenta real.

### 2026-11-01 · cuenta principal · 1.67.0 la tienda del bajo, sobres y figuras ocultas (sin commit, migración aplicada)
- **Encargo de Francisco**: «vamos con la siguiente fase» y un sistema de sobres tipo gacha con animaciones propias en
  el mismo estilo, que sustituya a las figuras. Respuestas suyas: **ocultar las figuras sin borrar** y **sobres de 1 y
  de 5**. Le dije que las animaciones tendrían emoción pero sin trucos (sin falsos «casi», cuentas atrás ni presión) y
  con probabilidades visibles y pity: está escrito en CLAUDE.md.
- Servidor: `supabase/migrations/20261104120000_edificio_tienda.sql` (**sin aplicar**): rarezas, tickets (30 de
  bienvenida), reclamos por misión y semana, comprar, sobres con pity y reciclar; detalle en SPEC §67.
- App: tienda en el escaparate del bajo (`Tienda.jsx`, `GachaReveal.jsx`, `shopArt.js`, `shopAudio.js`,
  `tienda.css`, `economy.js`), misiones del ordenador que cobran tickets (`useMissionTickets.js`) y figuras ocultas con
  `FIGURES_ENABLED = false` (habitación, biblioteca, portátil, salón, rincón y perfil). Versión 1.67.0 en los cuatro sitios.
- QA: Vitest del edificio y dominio (223) con `tienda.rls.test.js`; `v167-tienda`, `v166` y `v163` en 320/390/1440/WebKit
  390 (16 pasan); e2e antiguas de figuras en 390: pasan o se saltan con su motivo (`hotfix1581`, `panorama`,
  `v134`, `v146`, `v154`, `v159`, `entrega3`); oxlint sin avisos nuevos; build correcto. Capturas:
  `qa-report/screenshots-community/<proyecto>/v167-*.png`.
- **Segunda vuelta (mismo día, con una captura de una tienda de sobres de un juego de cartas)**: Francisco pidió que
  la tienda por dentro mezcle esa idea, con más perspectiva, con el videoclub de «Aquí no hay quien viva», con su
  dependiente y en nuestra estética; sobres por tipo o temporada, alguno más caro con más suerte, y con aspecto de
  sobre de cartas. Hecho: escena del videoclub (`shopScene.js`, dependienta propia, cartel «VIDEOCLUB» tachado), pared
  de sobres y bocadillo (`Tienda.jsx`), cuatro sobres de la temporada 1 (tres temáticos de 10/45 y «Edición
  coleccionista» de 25/110 con 15 % raro y 35 % poco común) en la migración (`piso_sobre`, aún sin aplicar) y en
  `economy.js`, sobres metalizados (`packArt`) y rasgado de la tira de arriba. Solo el género y la idea: ningún arte,
  logo ni personaje ajenos. QA: Vitest del edificio 39/39, e2e de la comunidad del edificio 67 pasan (v163, v166,
  v167 en 320/390/430/1440/WebKit), oxlint y build correctos.
- **Migración aplicada en producción** (1-11-2026, «hazlo tú»): la pegó Claude en el SQL Editor (14016 bytes, SHA-256
  `137d8ee0…18eae9c8`, igual al archivo) y Francisco pulsó «Run» («Success»). Comprobado con la clave pública: el
  anónimo recibe «permission denied» en `piso_reclamos`, `piso_abrir_sobre`, `piso_mi_inventario`,
  `piso_reclamar_mision` y `piso_al_azar`; `piso_sobre` responde (solo las tarifas públicas, las mismas que enseña la
  tienda).
- **Pendiente**: commit y subida cuando lo pida, probar con
  una cuenta real; los sonidos propios del piso (§6 del plan) siguen sin hacer; la tetera y otros muebles pequeños se
  ven pequeños en las cartas.

### 2026-11-01 · cuenta principal · 1.66.0 inventario de muebles, fase 1 (publicada, migración aplicada)
- **Encargo de Francisco**: «Sí, fase 1» del plan `docs/qa/economia-muebles.md` (aprobado con «Sí a todo»).
- Servidor: `supabase/migrations/20261103120000_edificio_inventario.sql` (**aplicada en producción** el 1-11-2026, ver abajo).
  `piso_catalogo` con `rareza` y `saga`; tablas `piso_inventario` y `piso_cuentas` sin acceso directo; inventario que
  se crea solo la primera vez (lo colocado + los diez de `starterRoom`); `piso_mi_inventario()`, `piso_elegir_inicio()`
  (seis comunes, una vez); `pisos_validate` comprueba las copias. Los muebles de sagas no cuentan hasta la fase 5.
- App: `inventory.js` (reglas puras), `StarterPicker.jsx` («Tu mudanza»), balda con «×N» y agotados apagados
  (`piso.js`), `EdificioPanel.jsx` (carga el inventario; botón «Elige tus 6 muebles»), `service.js`. Sin la
  migración, todo libre como en la 1.65.
- QA: Vitest `inventario.rls.test.js` (6) + resto del edificio y `entrega2.rls` (44 en total); `v166-inventario` y
  `v163-edificio` en 320/390/1440/WebKit 390 (8 pasan); `e2e/edificio-puerto` en 390 y WebKit 390 (13 pasan); oxlint y
  build correctos. Capturas: `qa-report/screenshots-community/<proyecto>/v166-*.png`.
- **Migración aplicada en producción** (proyecto `bookshelf`, 1-11-2026, Francisco: «Hazlo tú»): la pegó Claude en el
  SQL Editor (9450 bytes, SHA-256 `bb0472fb…8cb06d4f`, igual al archivo) y Francisco pulsó «Run» («Success»).
  Comprobado con la clave pública: `piso_inventario` y `piso_cuentas` dan «permission denied» al anónimo, y
  `piso_mi_inventario`, `piso_elegir_inicio` y `piso_inventario_asegurar` también (no «not found»).
- **Publicadas 1.65 y 1.66** el 1-11-2026 a petición de Francisco («Commit y súbelo»), en un solo commit en `main`;
  Vitest completo 339/339 y build antes de subir. Entre aplicar la migración y la subida, la 1.64 publicada no sabía
  de copias (un piso con más de las que se tienen no se habría guardado).
- **Pendiente**: probar con una cuenta real el inventario y «Tu mudanza»; los sonidos propios del edificio
  (§6 del plan) siguen sin hacer; siguiente fase: tickets y tienda (fase 2).

### 2026-11-01 · cuenta principal · 1.65.0 edificio: portal con más vida y arreglos de la balda (publicada con la 1.66)
- **Encargo de Francisco («bloque 0»)**: entrar al edificio con más impacto y más orgánico, alguna animación pequeña; la
  balda se desplazaba más allá de los muebles; no le gustaba cómo se veía «En el piso».
- Balda: los textos ocultos de las pestañas (`.px-sr`, absolutos) se salían de su fila y ensanchaban toda la balda
  160 px. `.ep-chip` y `.ep-set` con `position: relative` y `.ep-shelf` con `overflow-x: clip`.
- «En el piso»: cada mueble de pie en la balda con su dibujo y su color (`.ep-inroom__item`, mismo aspecto que el
  catálogo); el elegido se levanta y su nombre va en papel.
- Portal (`.ed-portal` en `EdificioPanel.jsx`): fondo de cielo y agua, título sobre el cielo, fachada de borde a borde.
  `facadeView.js`: llegada (la vista sube desde el muelle; las placas salen al final) y capa `.ed-ambient`: estrellas
  ya pintadas que titilan, luz que respira en los cristales de los pisos ocupados (`panes` de `facade.js`), destellos
  de píxel en el agua (bajo la orilla, `shore`) y una gaviota que cruza. Con movimiento reducido, nada de esto.
- `e2e-community/v163-edificio` espera a que acabe la llegada antes de la captura. QA: `e2e/edificio-puerto` en
  360/390/1440/WebKit 390 (24 pasan) y `v163-edificio` en 390/1440/WebKit 390 (4 pasan); oxlint y build correctos.
  Capturas: `qa-report/v165-portal-390.png`, `v165-portal-1440.png`, `v165-en-el-piso.png`.
- Francisco aprobó las capturas («Me convence»): versión 1.65.0 y SPEC §65. **Sin commit** hasta que lo pida. También preguntó por una economía de muebles
  (copias, tickets por misiones, tienda, rarezas con animación, mercado). Plan en `docs/qa/economia-muebles.md`,
  **aprobado** («Sí a todo»: tickets aparte de las Cajas, lo colocado pasa a ser suyo, 10 + 6 muebles de inicio, sagas
  al terminar el libro, primero regalar entre vecinos). Añadió sonidos cozy propios del edificio (§6 del plan) y, para
  el futuro, la sintonía de «Aquí no hay quien viva» en chiptune: sin licencia no se puede (ver el plan). **Nada
  implementado**; siguiente: fase 1 (inventario), con migración que aplica él.

### 2026-11-01 · cuenta principal · 1.64.0 «El edificio del puerto» con más personalidad, bloques 1 a 3 (publicada, migración aplicada)
- **Encargo de Francisco** (por bloques, con capturas entre uno y otro):
  1. Fachada que se vea como un edificio de verdad.
  2. Piso y personalización más integrados, con un catálogo intuitivo y orgánico.
  3. Sets de sagas: Alas de sangre, Mistborn, El nombre del viento, Una corte de rosas y espinas y El archivo de las
     tormentas. Llevan nombre propio y un guiño «Para quien leyó …», con muebles originales y nada oficial.
  - Las reglas están en CLAUDE.md.
- **Bloque 1 hecho** (sin subir versión todavía; será la 1.64 al acabar los tres):
  - `facade.js` dibuja el edificio en pixel art con el mismo motor:
    - Planta baja de piedra con portal, rótulo, farol, buzones y ventanuco.
    - Tres plantas de estuco con balcones de hierro; tejado de teja con chimenea.
    - Muelle con bolardo y agua; atardecer con colinas y luces lejanas.
  - Por cada ventana se ve el interior real del piso, recortado de su miniatura de tarde.
  - Las contraventanas toman el color de la pared del piso; las de las puertas libres están cerradas.
  - El balcón muestra macetas, guirnalda o el gato si el piso los tiene.
  - `facadeView.js` pone un botón por ventana con su placa (puerta y nombre). Las etiquetas accesibles son las de
    siempre. La usan el panel y la página de desarrollo.
  - Sustituye a la cuadrícula de miniaturas.
  - **Rehecha según una foto de referencia de Francisco** (un edificio clásico mostaza; se toma el estilo, no se copia):
    - Estuco mostaza con pilastras e impostas; cada piso es un cuerpo de dos ventanas altas con recerco del color de
      su pared y un balconcito de hierro por ventana.
    - Escalera central con ventanas pequeñas encendidas.
    - Cornisa con dentículos, antepecho de balaustres, dos torreones y el rótulo «El edificio del puerto» en la azotea.
    - Planta baja con librería, portal y café; vecinos rosados a los lados.
    - Las puertas libres tienen la persiana bajada.
  - **Siluetas y asomarse** (Francisco eligió las dos):
    - Por las ventanas ya no se ve la miniatura encogida (era una mancha). `windowView.js` dibuja de frente, a
      14 × 22 píxeles, la pared del color del piso y sus piezas más reconocibles: estantería con lomos, lámpara con
      halo, planta, sofá, cuadro, reloj, guirnalda…
    - Al tocar una ventana la vista se acerca a ella y entras; al volver al portal se aleja desde esa misma ventana.
      Con movimiento reducido no hay animación.
  - **Cartel de la azotea: «AQUÍ NO HAY QUIEN LEA»**, guiño de Francisco a «Aquí no hay quien viva». La letra es
    propia, en píxeles, roja con sombra y algo saltarina; no copia el logotipo de la serie (es una marca registrada).
- **Bloque 2 hecho** (Francisco dio el visto bueno al 1 con «Sí, bloque 2»):
  - La habitación ocupa todo el ancho del panel, sobre un escenario con luz cálida. El fondo del dibujo ya es
    transparente (`BG = 0` en `render.js`), así que el piso flota sin el recuadro crema.
  - «Decorar»/«Terminar» y «Luz de tarde» van en la esquina de arriba de la habitación. Mientras hay un mueble elegido
    se apartan.
  - Las herramientas (Girar, Color, Guardar, Listo) flotan encima del mueble elegido, o debajo si arriba no caben.
    Se esconden mientras arrastras.
  - El catálogo es una balda de madera pegada abajo, con los muebles de pie sobre la tabla:
    - de lado se recorre;
    - tirando hacia arriba se saca un mueble y se arrastra al piso: se ve ya colocado bajo el dedo (en rojo si no cabe)
      y cae donde se suelta;
    - soltado fuera de la habitación, vuelve a la balda;
    - tocarlo sigue poniéndolo en el centro.
  - Paredes y suelo pasan a la última pestaña de la balda, «Paredes y suelo».
  - Los nombres accesibles de los botones son los de siempre.
- **Otra vuelta al entorno del piso** (Francisco: las habitaciones le encantan, pero los menús y la forma de poner
  muebles «desentonan» y no se ven orgánicos):
  - Todo lo que rodea al piso pasa al mismo pixel art:
    - `pixelUi.js` genera marcos de papel, madera y salvia con esquinas escalonadas, e iconos propios (girar, color,
      guardar, listo, decorar, sol, luna, lista);
    - cada píxel mide 3 px y las imágenes se generan ya a ese tamaño, para que se vean nítidas en cualquier navegador.
  - El telón de detrás del piso se pinta en el propio dibujo (`render.js`): un degradado tramado con la sombra de
    contacto del piso, crema de día y malva de tarde.
  - Botones del piso:
    - «Decorar»/«Terminar» y la luz (sol o luna) están en los huecos de las esquinas de abajo de la habitación;
    - las herramientas del mueble son una etiqueta de papel con cuatro iconos (su nombre accesible es el de siempre).
  - La balda es un mueble de madera:
    - pestañas de papel con el dibujo de un mueble de cada tipo;
    - «Paredes y suelo» con muestras que enseñan cómo quedaría tu piso;
    - «En el piso» es otra pestaña al decorar (antes era una caja suelta que la balda tapaba).
  - Más baja con el móvil tumbado.
  - Buzón y sellos con los mismos marcos.
- **Vista «dentro de la habitación»** (Francisco: que se pueda elegir y que sea la de por defecto, con el selector
  abajo):
  - Al abrir un piso en la app, el panel ocupa la pantalla y no se desplaza. La habitación es tan grande como quepa y
    el resto es telón tramado, con píxeles del mismo tamaño: `backdropImage` en `render.js`, y el lienzo deja
    transparente todo menos la sombra.
  - Abajo, en tu piso, la balda ya abierta (empiezas decorando); en el de un vecino, los sellos en una fila.
  - El nombre del piso es una etiqueta de papel arriba y el aviso va sobre la habitación.
  - El botón de la barra («Ver como ficha» / «Entrar en la habitación») cambia a la vista de antes. Se recuerda en el
    dispositivo (`bookshelf:edificio:vista`, en `localStorage` con try/catch).
  - La página de desarrollo sigue en la vista de ficha.
- **Peso** (Francisco preguntó; medido en este ordenador):
  - El panel del edificio se carga solo al abrirlo: 61 KB de JS (24 KB comprimido) y 12,5 KB de CSS (3,4 KB).
  - Cada mueble es una línea de catálogo y su forma en código, unos 350 bytes; no hay imágenes.
  - Un piso lleno (40 cosas) son unos 2,8 KB en Supabase.
  - Dibujarlo entero cuesta unos 32 ms al colocar o elegir; un fotograma al arrastrar, unos 2,5 ms. Un móvil irá más
    lento: no está medido en el iPhone.
- **QA:**
  - e2e del prototipo (con una prueba nueva de arrastre desde la balda): 24 pasan en Chromium 360, 390 y 1440, WebKit
    390 y movimiento reducido.
  - Los ayudantes de la prueba descuentan el desplazamiento de la vista visible de la emulación de móvil (con él, el
    ratón caía 50 px más abajo de lo calculado).
  - v163-edificio: 4 pasan.
  - Vitest del edificio 23/23, lint y build.
- **Bloque 3 hecho** (Francisco: «Sí, sagas»):
  - Pestaña «Sagas» en la balda con una fila de etiquetas, una por set; el título es el nombre del set y debajo va el
    guiño «Para quien leyó …».
  - Cinco sets de cuatro muebles (veinte en total, detalle en SPEC §64): Nido de jinetes, Bruma y ceniza, La posada del
    camino, Corte de rosas y estrellas y Luz de tormenta. Objetos corrientes que evocan la saga, nada oficial.
  - Lo de «encima» (huevo, viales, monedas, esferas) necesita una superficie: la barra y el barril de la posada sirven.
  - La balda tenía un fallo: las filas que se recorren de lado la ensanchaban (el texto centrado salía cortado). Ahora
    es una sola columna `minmax(0, 1fr)`.
  - Migración `supabase/migrations/20261102120000_edificio_sagas.sql`, generada desde `catalog.js`. **Por aplicar**:
    hasta entonces, guardar un piso con un mueble de sagas falla en el servidor.
- **QA final:**
  - Vitest del edificio 23/23 (con la paridad cliente/servidor y las dos migraciones), oxlint y build (panel: 70 KB de
    JS, 26,6 KB comprimido).
  - e2e del prototipo: 30 pasan (prueba nueva «sagas»: los cinco sets, los veinte muebles caben y capturas
    `ep-sagas-balda`, `ep-sagas-piso`, `ep-sagas-tarde`). v163-edificio: 4 pasan. Sin iPhone real.
- **Hecho al cierre:** versión 1.64.0 (`src/diag.js`, `package.json`, `public/sw.js`, SPEC) y SPEC §64.
- **Migración de sagas aplicada en producción** (proyecto `bookshelf`, rama `main`, 1-11-2026, Francisco: «Hazlo
  tú»): la pegó Claude en el SQL Editor (1776 bytes, SHA-256 `e9e589b5…cfcbd0af`, igual al archivo) y Francisco pulsó
  «Run» («Success. No rows returned»). Solo añade filas a `piso_catalogo`; no cambia permisos ni RLS.
- **Publicada** el 1-11-2026, a petición de Francisco («Commit y súbelo»): commit `837599b` en `main`, Vitest completo
  333/333 y build antes de subir; producción sirve `sw.js` con la v1.64.0. Las carpetas sueltas de material
  (`BookShelf-fotogramas-QA/`, `art-inbox/`, `assets-source/`, `material-diseno/`) siguen fuera de git.
- **Pendiente:**
  - Probar con una cuenta real que un piso con muebles de sagas se guarda.
  - Opcional: que las ventanas de la fachada (`windowView.js`) dibujen también piezas de sagas.

### 2026-11-01 · cuenta principal · 1.63.0 «El edificio del puerto» en la app (publicada, migración aplicada)
- **Qué:** Francisco aprobó pasar el prototipo a la app («Sí, prepárala») y eligió:
  - La tablet del Salón pregunta entre «Comunidad» y «El edificio del puerto»; no se quita nada.
  - El reparto al azar tal cual se propuso: solo con la comunidad activada, primero edificios con hueco, puerta al
    azar, lo decide el servidor.
- **Hecho** (detalle en SPEC §63):
  - Migración `supabase/migrations/20261101120000_edificio_puerto.sql`.
  - El código pasa de `src/features/minigames/edificio-puerto/` a `src/features/edificio/`.
  - `service.js`, `EdificioPanel.jsx`, la tarjeta «La tablet» en `SocialSeats.jsx` y el panel `edificio` en
    `App.jsx` y `navigation.js`.
  - El simulador de `e2e-community` entiende el edificio solo si la prueba siembra `edificio_vecinos` (las pruebas
    antiguas siguen viendo la tablet de siempre).
- **QA:**
  - Vitest completo y build (ver abajo), oxlint.
  - `edificio.rls.test.js` con la migración en PGlite, incluida la paridad de validación cliente/servidor.
  - e2e-community v161, v162 y v163-edificio: 33 pasan en Chromium 390, WebKit 390 y 1440.
  - `e2e/edificio-puerto.spec.js`.
  - Sin iPhone real.
- **Pendiente:**
  - **Migración aplicada en producción** (proyecto `bookshelf`, 1-11-2026): la pegó Claude en el SQL Editor (SHA-256
    igual al archivo) y Francisco pulsó «Run» («Success»). Comprobado con la clave pública: las cinco tablas y las dos
    funciones existen y niegan el acceso anónimo. Falta probarlo con una cuenta real tras subir la 1.63.
  - Commit y subida a producción el 1-11-2026, a petición de Francisco («Commit y súbelo»). Con el edificio entran en git
    también los prototipos de solo desarrollo: `src/features/minigames/libreria-puerto/` (el edificio usa su
    `raster.js` y su `audio.js`), las páginas `dev/` y sus pruebas y documentos de QA. La librería sigue fuera de la app.
  - Probar el edificio con una cuenta real (dos cuentas, para la visita y el sello).
  - Decidir qué pasa con la puerta de quien deja la app.
  - Ilustraciones de muebles, si hacen falta, e icono del edificio.

### 2026-11-01 · cuenta principal · prototipo «El edificio del puerto»: pisos cozy con vecinos (sin commit)
- **Qué es:** idea de Francisco, a partir de un devblog de un juego de pixel art en el que se decora una casa.
  - Tu piso es una habitación isométrica de 9 × 9 que se decora con un catálogo de 24 muebles.
  - Está en un edificio de seis pisos con vecinos que se visitan y en cuyo buzón se deja un sello.
  - Solo de desarrollo: `dev/edificio-puerto.html` y `dev/edificio-puerto-app.html` (cómo se entraría desde la tablet
    del Salón Social). El código está en `src/features/minigames/edificio-puerto/`.
  - Reutiliza el motor de píxeles de la librería. A `raster.js` se le ha añadido un búfer de identificadores, para tocar
    sobre el dibujo, y la proyección inversa sobre paredes y superficies. Ese cambio no afecta a la librería: sus pruebas
    siguen pasando.
- **Decisiones de Francisco (aceptó la propuesta entera):**
  - El piso no sustituye al rincón ilustrado.
  - Edificio de 3 plantas × 2 pisos.
  - Visitas en diferido; el directo, más adelante.
  - Catálogo gratis, sin tocar recompensas, cajas ni pity.
  - Sin texto libre: solo sellos de frase cerrada.
  - Prototipo aislado antes que nada.
  - Cambiar a qué lleva la tablet (hoy, Lectores) necesita su aprobación.
- **Datos:** inventados (cinco vecinos y sus sellos). Tu piso solo se guarda en este navegador. No se ha tocado la app,
  Supabase ni la biblioteca.
- **QA:**
  - Vitest del minijuego 42/42 (12 del piso).
  - e2e `edificio-puerto.spec.js` y `libreria-puerto.spec.js`: 43 pasan y 0 fallan, en Chromium 360/390/430/1440,
    WebKit 390 y movimiento reducido.
  - Sin iPhone real.
- **Pendiente:**
  - Que Francisco apruebe el plan del servidor de `docs/qa/edificio-puerto.md`.
  - Confirmar el detalle del reparto en edificios. Francisco decidió **al azar**; la propuesta concreta está en el
    documento de QA.
  - Ilustraciones de muebles, si el estilo de cajas no basta, e icono del edificio.
- **Sin commit**: Francisco no lo ha pedido.

### 2026-10-31 · cuenta principal · «La librería del puerto»: más acogedora, con más juego y vista en la app (sin commit)
- A petición de Francisco («más cozy», «más chicha», «cómo se vería en la app del móvil»). Todo sigue aislado en el
  prototipo; la app, su navegación y el build no cambian (`dist/` sin rastro, comprobado).
- Escena: pared de yeso con zócalo, ventana al mar de tarde, cuadro de un barco, alfombra bajo la caja y una gata dormida
  sobre la estantería. Al terminar se enciende la lámpara y la luz pasa a ser de tarde («la librería abre»), sin bucles
  continuos (solo dibuja mientras algo cambia) y sin animación con movimiento reducido.
- Juego: botón «Pista» (siguiente paso de la solución) y dos niveles nuevos con solución comprobada: n4 «Tres baldas» y
  n5 «Sin un hueco».
- **Decisiones de Francisco (misma sesión):**
  - **Fuera los encargos**: los libros no se distinguen.
  - **Estrellas por movimientos**: ★ terminar; ★★ mínimo + 2; ★★★ mínimo exacto sin pistas. El mínimo es un movimiento
    por libro.
  - **Ranking con un nivel nuevo cada semana**, generado automáticamente (`weekly.js`, semilla = semana ISO, siempre
    resoluble). El mes suma las semanas.
  - **Distinción en el perfil para el top 3 semanal y mensual.**
- Ranking y distinción, **solo de demostración**:
  - Lectores inventados y tu resultado en este navegador.
  - Panel «Ranking» con Semana y Mes, y vista previa de la distinción.
  - La partida guarda sus jugadas y `replay` las repite para validar, como debería hacer el servidor.
- **Plan del servidor, pendiente de aprobación:** tablas, RPC con validación por repetición, cierre de periodo que
  inserta en `distinctions`, app «Librería» en el ordenador, y las insignias ilustradas que faltan. Está en
  `docs/qa/libreria-puerto.md` §9; no se ha tocado Supabase ni la app.
- Vista en la app: `dev/libreria-puerto-app.html`. **Decisión de Francisco: el juego se abre como una app más del
  ordenador**, una séptima en el dock. El recorrido es habitación → portátil → app «Librería» → ventana con el juego
  (`?vista=pc`). Usa capturas de la app con un perfil de prueba vacío y los iconos reales del dock.
- Falta el icono ilustrado de «Librería»: ahora lleva uno provisional recortado del juego. `?vista=app` (pantalla
  completa con «Volver al rincón») sigue disponible.
- Arreglos: el ResizeObserver ya no reajusta ni cancela un arrastre cuando solo cambia el alto del juego; la página de
  desarrollo no se desborda a 360 px.
- QA: Vitest del minijuego 30/30; e2e del minijuego 20/20 (Chromium 360/390/430/1440, WebKit 390, reducido). Sin
  iPhone real. **Sin commit ni subida**: Francisco no lo ha pedido.
- Pendiente:
  - Que Francisco apruebe el plan del servidor.
  - El icono ilustrado de la app «Librería» y las insignias de podio.
  - Nada de esto está en la app real.

### 2026-10-31 · cuenta principal · prototipo «La librería del puerto» (sin commit)
- Encargo: minijuego jugable inspirado en Pixel Plays (MIT), aislado y solo de desarrollo. Abre en
  `http://localhost:5190/dev/libreria-puerto.html` con el servidor de siempre. Código en
  `src/features/minigames/libreria-puerto/` y `dev/libreria-puerto.html`; Vite no lo construye (comprobado en `dist/`)
  y la app no lo importa. Detalle, licencia, capturas y lo que falta para tickets y figura: `docs/qa/libreria-puerto.md`.
- Tres niveles hechos a mano con solución comprobada; arrastre, tocar y tocar, «Girar» y teclado. Datos ficticios «Demo»:
  no consume tickets, no concede figuras, no toca Supabase, biblioteca, misiones, pity ni sincronización.
- QA: Vitest 292/292 (12 del puzle); `e2e/libreria-puerto.spec.js` en Chromium 360/390/430/1440, WebKit 390 y movimiento
  reducido: 15 pasan. Build correcto. Sin iPhone real. Sin versión nueva de la app (no cambia nada publicado).
- **Sin commit ni subida**: Francisco no lo ha pedido.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 4 (publicada)
- Hecho el bloque 4, clubes (§62.4): `ClubTab.jsx` (dentro del club, pestañas Lectura / Conversación / Miembros;
  administrar y archivar en el menú del propietario con confirmación; salir en el de los miembros; conversación en orden
  de lectura con «Ver mensajes anteriores» arriba, spoilers plegados y redactor fijo abajo; sin adjuntos), `club-162.css`
  (nueva, importada al final), `PanelShell.jsx` (el velo de la comunidad sigue a `visualViewport` para que el redactor
  quede por encima del teclado), `mockSupabase.js` (entiende el `or` de la paginación por cursor).
- Sin migración: la RLS de la entrega 3 ya autoriza en el servidor (solo el propietario archiva, invita y retira).
- QA: `v162-clubes` (nueva) y la comunidad completa en 320, 390, 430, 1440 y WebKit 390: 155 pasan (las omitidas son
  por tamaño); tras el último ajuste de estilos, `v162-clubes` y `entrega3` otra vez en los cinco: 30 pasan; Vitest
  280/280 (con un caso nuevo de RLS: un miembro no archiva); build y oxlint correctos. Teclado simulado, sin iPhone real.
- Commit del bloque 4 en `main` y subida de los dos commits (bloques 1–3 y 4) a producción a petición de Francisco
  («súbelo»). Sin aplicar siguen las migraciones de avatares (1.60) y de la sintonía (1.62, preparada).

### 2026-10-31 · cuenta principal · 1.62.0, bloques 1–3 (commit local, sin subir)
- A petición de Francisco, commit local en `main` con los bloques 1, 2 y 3 tal como estaban (descritos abajo), **sin
  push**: producción sigue en la 1.61.0. Fuera del commit, las carpetas de recursos que no están en git. Siguiente: bloque 4
  (clubes), también sin commit hasta que lo pida.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 3 (sin commit)
- Hecho el bloque 3 (§62.3): `src/features/radio/` (nuevo: `catalog.js`, `catalogo-radio.json`, `radioPlayer.js`,
  `RadioControls.jsx`, `RadioPanel.jsx`, `RadioMini.jsx`), `radio-162.css` (nueva, importada al final),
  `ambientAudio.js` (`setAmbienceVolume`), `SocialSeats.jsx` y `socialMap.js` (la radio en la mesa), `RoomCorner.jsx`
  («Música» en Ambiente), `EpubReader.jsx` (hoja y control compacto), `App.jsx` (panel `radio`). Recursos en
  `public/media/social-radio/`.
- **Migración preparada, sin aplicar**: `supabase/migrations/20261031200000_radio_sintonia.sql` (para «Mostrar mi
  sintonía», que no se enseña hasta aplicarla). `entrega2.rls.test.js` ya espera la columna `radio_station`.
- QA: `v162-radio`, `v147`, `v152`, `v156`, `v157` en 360/390/430/1440/WebKit 390 pasan; `v162` y `entrega3` de
  comunidad en 320 y 390 pasan; Vitest 280/280; build y oxlint correctos. `v156` falló una vez en 1440 con la máquina
  cargada y pasó al repetirlo solo. Sin iPhone real (volumen y segundo plano sin comprobar allí).
- En escritorio la mesa del salón queda fuera del encuadre: a la radio se llega desde «Ambiente».
- **Sin commit**. Siguiente: bloque 4 (clubes), tras enseñar capturas a Francisco. Él tiene que escuchar la pista piloto.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 2 (sin commit)
- Hecho el bloque 2 (§62.2): `SocialSeats.jsx` (etiqueta «Sentarme», tarjetas ancladas), `SeatCard.jsx` y
  `SeatChoice.jsx` (nuevos), `SocialTabs.jsx` (pestaña «Salón» nueva), `usePresence.js` (sentarse/levantarse
  devuelven si salió bien), `ReaderVisit.jsx` (fachada, «Entrar al rincón», ventana, «Salir»/«Saltar», ahorro de datos),
  `navigation.js` (campo `from` de la visita), `App.jsx`, `SocialRoom.jsx` y `social-162.css`.
- Ojo: `.reader-visit__back` ya existía en `social-161.css` (cabecera de «Sus libros»); el botón de volver de la
  visita usa `.reader-visit__leave`.
- QA: `v162`, `v158`, `v159`, `v161` y `entrega3` en 320/390/430/1440/WebKit 390: 77 pasan (las omitidas son
  por tamaño); comunidad completa en Chromium y WebKit 390: 71 pasan y 1 falló por tiempo con la máquina cargada (le
  di más margen y pasa en la tanda posterior); Vitest 278/278; build y oxlint correctos. Sin iPhone real.
- **Sin commit**. Siguiente: bloque 3 (radio y control en el EPUB), tras enseñar capturas a Francisco.

### 2026-10-31 · cuenta principal · 1.62.0, bloque 1 (sin commit)
- Encargo: paquete `material-diseno/social-radio/BookShelf-social-radio/` (salón, visita, radio, clubes). Francisco
  decidió: seguir el paquete en la visita (fachada, «Entrar», «Saltar») y en las tres pestañas, y hacerlo **por
  bloques** enseñando capturas. Reglas actualizadas en `CLAUDE.md`.
- Hecho el bloque 1 (§62.1): `SocialHub.jsx`, `ReadersSection.jsx` (nuevo), `SocialTabs.jsx`, `AddToPending.jsx`,
  `huellas.js` (duplicados por obra), `services/community.js` (`searchProfiles`), `services/connections.js`
  (`fetchMoreActivity`), `App.jsx` (pestaña en la ubicación), `social-162.css`. Simulador: `ilike` y `lt`.
- QA: `v162` en 320/390/430/1440/WebKit 390 (8 pasan); comunidad completa en Chromium y WebKit 390: 64 pasan;
  Vitest 274/274; build correcto. Sin iPhone real.
- **Sin commit**: el encargo dice no hacer commit sin petición explícita. Siguiente: bloque 2 (asientos y visita).

### 2026-10-31 · cuenta principal · 1.61.0 (publicada)
- Encargo «Pulir la visita social ya implementada» con maqueta (`docs/design/references/visita-rincon-libros-maqueta.png`).
  Detalle en §61. Tocados: `ReaderVisit.jsx`, `VisitBookSheet.jsx` (nueva `SharedLibrary`), `visitScene.js`,
  `navigation.js` (`libros/clave`), `social-161.css` (nueva, importada al final). Pruebas: nueva
  `e2e-community/v161.spec.js`; `v158` y `v159` al día; `visit.domain.test.js` con la vuelta nueva.
- QA: Vitest 274/274; `v158` + `v159` + `v161` de la comunidad en 320, 390, 430, 1440 y WebKit 390: 29 pasan (las
  omitidas son por tamaño). Build y oxlint correctos. Sin iPhone real.
- Límite del fondo real: en la mesita solo cabe un libro pequeño en el extremo izquierdo; la etiqueta cuelga del canto
  (no cabe en otra parte sin tapar planta, taza o mueble).
- Primero sin commit por indicación de Francisco; después commit en `main` y subida a producción a petición suya
  («hazlo y súbelo»). Sin comprobar aún en su móvil real.

### 2026-10-31 · cuenta principal · 1.60.0 (publicada)
- Encargo: secciones de la comunidad como en las maquetas, avatares nuevos de `material-diseno`, «Entre lectores» y
  seguir ajustando el libro de la cama (§60).
- Decisiones de Francisco: cuaderno con anillas para las tres pestañas (no la tarjeta lisa); la Hechicera de Eea de la
  maqueta sigue retirada; se conservan «En la sala», «Club» y «Visitar rincón».
- Migración nueva **pendiente de aplicar por Francisco**: `supabase/migrations/20261031120000_avatares_nuevos.sql`.
- QA: Vitest 273/273 (incluida RLS con el avatar nuevo); comunidad completa en verde tras corregir un segundo scroll de
  las pestañas; libro de la cama y biblioteca (diegetic, gouache, v147–v152, v159) en 360/390/430 y WebKit: todo en verde
  salvo `v149` en WebKit (fallo conocido; comprobado que falla igual sin el cambio). Build correcto.
- Sin verificar en el móvil real. Commit en `main` y subido a producción por petición de Francisco («Commit y súbelo»);
  la migración de avatares sigue pendiente de aplicar.

### 2026-10-31 · cuenta principal · 1.59.0 (publicada)
- Encargo «Rendimiento y errores visuales en iPhone con más de 1.000 libros» (§59). Vídeo inspeccionado
  (`Descargas/WhatsApp Video 2026-10-31 at 15.03.57.mp4`, 231,665 s, 384 × 832). Causas, mediciones antes/después y
  criterios en `docs/qa/iphone-large-library.md`; capturas en `docs/qa/iphone-large-library/`.
- Medición: `scripts/perf-large-library.mjs` (100/1.000/1.500 libros sintéticos, CPU ×4) y `src/perf/PerfProfiler.jsx`
  (solo en desarrollo). Telemetría: `scripts/analyze-telemetry.py` sobre los estados que audita `e2e/audit159.js`.
- Pruebas nuevas: `e2e/v159.spec.js` y `e2e-community/v159.spec.js`. Ajustadas: `v135` (tapa en espera de la portada).
- QA: `qa:full` **parado a petición de Francisco**. Resultados hasta ahí: Vitest 273/273 y 666 de Playwright.
  - Falló solo `v128` «busca con o sin tildes», por la búsqueda diferida; prueba ajustada con `expect.poll`.
  - Afectadas en los proyectos que faltaban: 72/72.
  - Comunidad: 104 pasan y 21 omitidas.
  - Build correcto.
  - Telemetría: 0 desbordes, 0 fondos sin pintar, 0 imágenes rotas y 0 errores de consola o de página. Solo hay
    solapes intencionados anteriores.
- Sin verificar en el iPhone real (pendiente 7b). Commit en `main` y subido a producción por petición de Francisco
  («Commit y súbelo»).

### 2026-10-31 · cuenta principal · 1.58.2 (publicada)
- «Haz lo que falte» tras la 1.58.1: dejar las pruebas en verde (§58). Fallo real corregido: la flecha «Abrir rincón
  social» perdía su centrado al pulsar (`room-146.css`) y con movimiento reducido no navegaba. Actualizadas las pruebas
  desfasadas (v123 colores, formulario y pulsación; v128 librería y reseña; panorama 9 y 14; v135, entrega2, entrega3).
- Verificación por partes: los 8 de movimiento reducido, cada prueba corregida en todos sus proyectos (intermitentes con
  repetición) y toda la comunidad en verde; build correcto. `qa:full` final **parado** a petición de Francisco (vuelve
  a valer `CLAUDE.md`: pruebas acotadas). Queda `v149` en WebKit (limitación de `matrix3d` en el WebKit de Windows).
- Rama `qa/fallos-previos` fusionada en `main` y subida por petición de Francisco («paralo y súbelo»).

### 2026-10-31 · cuenta principal · 1.58.1 (publicada)
- Encargo «Hotfix SDD de la auditoría del vídeo» (`BookShelf-fotogramas-QA/`, §57). Detalle, causas y aceptación en
  `docs/qa/video-hotfix.md`; capturas en `docs/qa/video-hotfix/`.
- Hecho: figuras SVG retiradas con compatibilidad para cuentas antiguas; visita social a pantalla completa, sin opciones
  de animación y con escena única; un lomo por libro compartido; franja de la biblioteca instalada (relleno superior
  duplicado en `src/index.css`); alias completo en reseñas; simular sellos solo en desarrollo. EPUB de otra obra: sin
  defecto de código (pendiente de confirmar con Francisco).
- `qa:full`: no llega a 0 fallos. 15 fallos anteriores comprobados contra `main` (lista en el documento), 2
  intermitentes; corregidas la prueba desfasada `v123 colores` y las del hotfix. Build correcto.
- Hecho en la rama `hotfix/auditoria-video` y fusionado en `main` con permiso expreso de Francisco; sin PR (no hay
  `gh` en este equipo). Pendiente: investigar los fallos del proyecto `chromium-390x844-reduced`.

### 2026-10-30 · cuenta principal · 1.58.0 (publicada)
- Encargo `material-diseno/visita-social/PROMPT-CLAUDE.md` (§56). Recursos copiados a `public/media/social-visit/`
  (4 918 851 B en total; huellas SHA-256 comprobadas) y su inventario a `docs/design/visita-social-*`.
- Nuevos: `src/features/social/visit.js`, `visitScene.js`, `hooks/useReaderCorner.js`, `components/ReaderVisit.jsx`,
  `VisitBookSheet.jsx`, `AddToPending.jsx`, `src/styles/social-visit.css`. Tocados: `App.jsx` (panel `visit`),
  `navigation.js` (`safeParent`), `SocialHub`/`SocialTabs` (botón «Visitar rincón»), `ReaderProfile.jsx` (usa el hook
  nuevo), `public/sw.js` (excluye `/media/` y `Range`), `e2e-community/mockSupabase.js` (bloqueos y bibliotecas como la RLS).
- Pruebas ejecutadas: vitest de la visita y navegación, `e2e-community/v158` en chromium-390x844 y webkit-390x844,
  `oxlint` y `npm run build`. Chromium de Playwright no reproduce H.264; WebKit sí. Sin iPhone real.
- `e2e-community/v135` (chromium-390x844): 1 en verde y 2 fallos **previos a esta versión**: buscan `.huella-trio`, que
  desde la 1.43 se llama `.huella-readings` («Sus lecturas» sí sale con los tres libros). Sin corregir la prueba.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.57.0 (publicada)
- Encargo «El lector EPUB desborda…» (§55). Nuevos `src/features/epub/epubLayout.js` (paginado) y `epubHighlights.js`
  (subrayados); `EpubReader.jsx` y `epub-155.css` rehechos; `updateQuote` ya solo aplica los campos que llegan (antes un
  parche de solo color dejaba el texto en `undefined`). Pruebas: `e2e/v157.spec.js` (320, 390, 1440 y WebKit 390) y
  `e2e/v156` ajustada (nombres de paneles, espera de guardado).
- Desbordamiento de las capturas: **no reproducido** en Chromium ni en WebKit de Playwright con contenido ancho. Causa
  probable: Safari de iOS ensancha los iframes con su contenido y la rejilla no tenía columna explícita; ambas cosas
  corregidas en origen. Falta confirmarlo en el iPhone de Francisco.
- Página a página: el gesto es el desplazamiento nativo con `scroll-snap` (WebKit no deja escuchar dentro del iframe sin
  scripts); umbrales del gesto = los del sistema, no los 48 px del encargo. Sin probar con el dedo en un iPhone real.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.56.0 (publicada)
- Encargo «Vinculación explícita del EPUB e interfaz del lector según la maqueta» (§54). Se conserva el motor de la 1.55.
  Nuevos: `src/domain/bookMatch.js`, `src/features/epub/epubPosition.js`; rehechos `EpubSection.jsx` y `EpubReader.jsx`;
  `epubStore` guarda por cuenta (`usuario:libro`, traslada las claves de la 1.55); `epub-155.css` reescrita.
  `e2e/v155.spec.js` se sustituye por `e2e/v156.spec.js` (360, 390, 320, 1440 y WebKit 390).
- Hallazgo: en un iframe `srcdoc`, un enlace `#x` se resolvía contra la dirección de la app y el iframe cargaba la app
  (sin scripts). Se fija con `<base href="about:srcdoc">`; la prueba comprueba que el iframe no sale de su capítulo.
- Sin probar: iPhone real; cambio de cuenta de extremo a extremo (necesita Supabase simulado; cubierto por pruebas de
  dominio y por el cierre del lector al cambiar de usuario); EPUB comerciales o de dominio público reales (no había
  ninguno en el equipo y descargarlo requiere permiso: la prueba usa uno sintético representativo).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.55.0 (publicada)
- Encargo «EPUB local, progreso y notas con la cuenta, lector al pulsar Leer, límites» (§53). Nueva dependencia
  `jszip` (3.10.1); lector propio (`src/features/epub/`) en lugar de epub.js (sin versiones desde 2023). Pruebas:
  `src/features/epub/__tests__/epub.test.js` y `e2e/v155.spec.js` (390, 1440 y WebKit 390, EPUB sintéticos).
- Hallazgos de WebKit (Playwright en Windows): no guarda `Blob` en IndexedDB (se guarda `ArrayBuffer`) y no ejecuta
  escuchadores dentro de un iframe sin scripts (por eso se desplaza el contenedor, la selección se sondea y los enlaces
  internos no llevan `href`: el salto con un toque solo funciona donde el navegador lo permite; el índice siempre).
- `PanelShell` ya no atiende el teclado si queda inerte bajo otra capa (el lector).
- Sin probar en un iPhone real ni con EPUB comerciales (con DRM no se pueden abrir: no se intenta).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.54.0 (publicada)
- Encargo «Baldas con toda la biblioteca» + «Retirar ebook e importar de Goodreads» (§52). Nueva dependencia
  `papaparse` (5.5.3), cargada solo en el panel y su worker. Sin migraciones: el registro de importaciones viaja en
  la biblioteca privada (`state.imports`). Pruebas: `src/features/imports/__tests__/goodreads.test.js` (15 casos con
  fixtures sintéticos) y `e2e/v154.spec.js` (390 y 1440); ajustada `e2e/v146` (el e-reader ahora es bolsillo).
- Quedan en las hojas antiguas reglas CSS del e-reader sin uso (`.ereader__*`, `[data-device]`): inofensivas.
- Visto de paso, no corregido: con un libro terminado en la cama, «Lectura terminada» se corta en el libro pintado.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.53.0 (publicada)
- Encargo «11. Rediseñar el diario según la maqueta adjunta»: «Mi diario» con Reseña, Notas e Historial (§51).
  Desaparece el guardado automático de la reseña: ahora es «Guardar reseña» con confirmación real, error y reintento,
  y borrador por libro. Publicar en el rincón exige guardar antes. Pruebas: `e2e/v153.spec.js` (360, 390, 430, 1440
  y WebKit 390); ajustadas `v134`, `v135` y `e2e-community/entrega2` al nuevo diario.
- Con el encargo vino el fondo nocturno con la misma geometría (comprobado): integrado como `SCENE_REFRESH.night`.
- Teclado del móvil comprobado solo en emulación (visor más bajo); sin probar en un teléfono real.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-29 · cuenta principal · 1.52.0 (publicada)
- Encargo «Continuidad entre día y noche e integración del libro»: se retira la escena nocturna de la 1.51 y se
  rehace el contenido del libro pintado (ver §50). Falta el fondo nocturno equivalente (recurso pedido).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.51.0 (publicada)
- Habitación nocturna de la maqueta con los dos recursos que entregó Francisco (fondo y libro). Ver §49 y
  `docs/design/recursos-noche-maqueta.md`.
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.50.0 (publicada)
- Ajustes pedidos por Francisco sobre la 1.49: botón del libro que se salía, texto torcido en la página izquierda,
  «Mi biblioteca» sin la perspectiva de la estantería y «Social» demasiado marcado. Ver §48.
- Aviso: el WebKit de Playwright en Windows no pinta bien `matrix3d` (pantalla del portátil y lomos salen deformados
  en emulación, también en 1.49); en la captura del iPhone de Francisco se veían bien. Sin comprobar en Safari real.
- Commit y subida a producción pedidos por Francisco.

### 2026-10-28 · cuenta principal · 1.49.0 (publicada)
- Encargo «Corrige la integración visual de la pantalla principal»: diagnóstico y cambios en §47. Francisco eligió
  escribir sobre el libro pintado (frente a usar el fondo móvil o esperar recursos).
- El componente `BedBook` sigue en el código para `bedProgress`, `RoomHeader` y `RoomNavPlaques`; el libro
  superpuesto ya no se monta (`BedPages.jsx` lo sustituye).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.48.0 (publicada)
- Encargo «Corrección de integración visual y selector de lectura» con capturas de su móvil: ver §46. Causa del
  solape de «Volver» en el móvil: `fix-138.css` (top con el área segura), invisible en emulación.
- Pendiente de recursos: si se quiere el libro de la cama tan ancho como en la maqueta sin tapar los cascos, haría
  falta un recorte de los cascos con transparencia (o un fondo con los cascos más a la izquierda).
- Commit y subida a producción pedidos por Francisco. Sin comprobar aún en su móvil real.

### 2026-10-28 · cuenta principal · 1.47.0 (publicada)
- Encargo «Pulido de habitación y biblioteca compacta» (maqueta `biblioteca-compacta-maqueta.png`): estado
  «Abandonado» (§43), biblioteca compacta (§44) y pulido de habitación, registro y Ambiente (§45).
- Recursos nuevos: `public/assets/ui/textile/etiqueta-{marfil,terracota,crema,salvia,malva}.webp` (derivados del lino
  salvia; no hay bases textiles específicas entregadas).
- Pruebas: build; Vitest 227/227; `e2e/v147.spec.js` y suites de habitación y biblioteca en Chromium 360/390/430/
  844×390/1440 y WebKit 390. Adaptadas a lo pedido: cinco filtros (`v134`), placeholder con «…» (`v128`), cuenta
  fuera de Ambiente (`ia1`), hora en Ambiente (`panorama` 16), «Añadir libro» en herramientas (`v146`).
  Sigue fallando la prueba 9 de `panorama` en 1440 (anterior a la 1.45).
- Commit y subida a producción pedidos por Francisco.

### 2026-10-27 · cuenta principal · 1.46.0 (publicada)
- Encargo largo de Francisco (maqueta de habitación con libro abierto). Hecho: puntos 2, 3, 7 (vista enfocada,
  fecha, «Deshacer»), parte del 8 (sin «respaldo automático») y del 9 (sonidos de hojas y página). Detalle en §38.
- Recursos nuevos en `art-inbox/maqueta-146/` (fuera de git) y derivados en `public/assets/room/`; maqueta en
  `docs/design/references/habitacion-libro-abierto-maqueta.png`.
- Se mantiene la ilustración de la habitación actual: el fondo móvil entregado no tiene té, vela ni lámpara.
- Pruebas: build, oxlint (sin errores), Vitest 210/210; e2e de habitación (diegetic, panorama, gouache, v134,
  v135, anexos, v123, ia1) en Chromium 360/390/430/844×390/1440 y WebKit 390. Se adaptaron pruebas a lo pedido
  (nombre «Porcentaje», «Rincón social» legible, libro grande, hora en «Ambiente», cuenta dentro de «Ambiente»).
- Después, punto 6: acabado físico de los libros (§39), calibrado con la portada de *Songbirds and Snakes*.
  Ojo: la portada de Open Library por ISBN de ese libro es un escaneo con pegatina. Prueba nueva `e2e/v146.spec.js`.
- Después, punto 8: buscador por ISBN y elección de edición (§40). Google Books devolvía 429 (cuota sin clave)
  durante las pruebas: la app pasa a Open Library. Pruebas con proveedores simulados en `e2e/v146.spec.js`.
- Commit de la 1.46.0 pedido por Francisco y después subido a producción a petición suya.
- 2026-10-28 · 1.46.1, punto 5 (§42), con commit y subida a petición de Francisco: ventana del calendario de la pantalla del portátil centrada en la zona
  que no tapan la planta y el vaso pintados. Prueba en `e2e/v146.spec.js`. Queda el resto del encargo
  (ver «Pendiente» 0): figuras (punto 4) y ordenador (punto 5).
- Después, punto 4 (§41), en su propio commit, también publicado: placa «Mi biblioteca» bajada (tapaba la balda central de
  figuras), foco del cierre del detalle y pruebas de figuras en `e2e/v146.spec.js`. El resto ya cumplía desde 1.45.

### 2026-10-27 · cuenta principal · 1.45.0 (documentación)
- Protocolo de traspaso automático en el apartado 0 de `CLAUDE.md`: leer este documento y git al empezar, anotar
  aquí en cada commit y escribir las reglas nuevas en `CLAUDE.md`. Puntero en `Claude/CLAUDE.md` (fuera de git).
- Las dos cuentas trabajan solo en este ordenador; `docs/TRASPASO.md` simplificado.

### 2026-10-27 · cuenta principal · 1.45.0
- Preparado el traspaso entre cuentas: `CLAUDE.md` (reglas y mapa), este documento y `docs/TRASPASO.md`.
- Publicadas 1.42.0 a 1.45.0 (último commit `eff8031`). Todo subido; nada a medias.
