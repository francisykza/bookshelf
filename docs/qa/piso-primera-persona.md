# Piloto «Del portal al sillón» (solo laboratorio)

Rama `experimento/piso-primera-persona`, carpeta `BookShelf-piso-lab`, ruta `/?piloto=piso`. Subida solo como rama para la versión de
prueba (6-11-2026), sin integrar en `main` ni pasar a producción: eso sigue pendiente de la decisión de Francisco. No se conecta a Supabase: en esta rama la compilación deja vacías sus
variables (`vite.config.js`), así que tampoco hay cuentas. Los pisos se guardan en este navegador con la clave
`bookshelf:lab:piso-primera-persona:<id>`.

## Dónde está cada cosa en el edificio real

| Qué | Dónde | Campo |
| --- | --- | --- |
| Edificio | tabla `pisos`, asignado por el servidor | `edificio` |
| Planta y piso | puerta: 3B, 3A, 2B, 2A, 1B o 1A (`service.js`) | `puerta` (planta + letra) |
| Dueño, permiso | `editable={mine}` en `EdificioPanel`; RLS en el servidor | `user_id` |
| Mueble | `layout.items[]` (`room.js`) | `uid`, `id`, `tono`, `acabado` |
| Posición en el suelo | `layout.items[]` | `x`, `y`, en celdas de una habitación de 9 × 9 |
| Orientación | `layout.items[]` | `rot`, cuartos de vuelta (`toWorld` de `render.js`) |
| En la pared | `layout.items[]` | `pared` (`fondo` o `izq`), `a` |
| Paredes y suelo | `layout` | `pared`, `suelo` |
| Guardado | `savePiso(userId, room)` con `validateRoom` | `upsert` en `pisos` |
| Fachada | `mountFacade` (`facadeView.js`) | `flats[]` |
| Editor | `mountPiso` (`piso.js`) | `room`, `editable`, `onChange` |
| Registro de lectura | `ReadingLogSheet` en `App.jsx` | `bookId` |

**Cambio del piloto**: `labStore.js` sustituye a `savePiso` por `localStorage`, pero pasa por el mismo `validateRoom` y
`exportRoom`. Para integrar hace falta volver a `savePiso`; el formato del `layout` no cambia.

**Campos nuevos del piloto, que el edificio real no tiene**: planta → altura del horizonte (`PLANTAS`) y fachada → qué se ve
desde cada pared (`FACHADAS`). Hoy son una tabla de prueba; habría que decidir su lugar definitivo.

## Qué hay

- Dos pisos de prueba: `lab-1A` (tuyo, da al Gran Hotel) y `lab-2B` («Vecina de prueba», solo mirar, sin hotel).
- Interior en Three.js 0.170, cargado solo al cruzar la puerta. **Lee las cajas de `furniture.js`**, así que todo el catálogo
  con forma aparece, no solo sillón, lámpara y estantería.
- Decorar abre el editor isométrico de siempre sobre el mismo objeto; al volver, el interior muestra lo guardado.
- La silueta de la ventana es una miniatura guardada del dibujo de `hotelArt.js` (`hotelMini.js`; una prueba comprueba que coincide).
- **Exterior por capas** (`exterior.js`, `exteriorLayout.js`): tres planos paralelos a la pared y alineados desde el sillón, para que el paralaje sea real, más un atlas de brillos en el agua. Solo pinta las ventanas alcanzables desde el sillón, y la miniatura del hotel se pide solo si una de ellas da a él.
- **Agua**: cuatro fotogramas, uno cada 420 ms, cambiando solo el desplazamiento de la textura. Se para en segundo plano, con la ficha o el registro encima y con movimiento reducido; con la ventana fuera del encuadre no redibuja.
- **«Dejar sobre la mesa»**: en la ficha del piloto, cambia `currentBookId` en local y, sin desmontar el interior, el libro de la mesa, la cubierta de la estantería y «Registrar lectura de…».
- El libro y la estantería responden al toque y tienen botones HTML equivalentes.
- Sin GPU: mensaje en HTML con biblioteca, registro y vista de siempre.

## Bibliotecas grandes

- **Selección** (`roomSelection.js`): lecturas actuales, elegidos para exponer (`settings.roomFeaturedId` y `settings.roomExhibit`) y el resto de la cola de siempre, hasta 30 con la cubierta. Se cambia en `ROOM_LIMIT` o con `&visibles=N`. **Por la madera, a la escala actual se colocan unos 20**: el límite no se alcanza, y un elegido que no cabe lo dice en su fila.
- **Toda la biblioteca**: en la balda, «Buscar». Bloques de 40 (automático al bajar y con botón), filas de alto fijo, una portada solo si su fila sigue montada 160 ms. Al volver de una ficha conserva búsqueda, filtro y posición.
- **Exponer** solo escribe ajustes: una prueba compara el libro antes y después, también tras recargar.
- **Bibliotecas de prueba** (`sampleLibrary.js`): `&biblioteca=0`, `50`, `1000` o `5000`. Siempre iguales, sin libros reales, con 60 % de portadas buenas, 25 % sin portada y 15 % que fallan. Solo se siembran una vez por tamaño, así que recargar conserva lo registrado. `&biblioteca=propia` devuelve lo que hubiera. Nunca actúan en el host de producción.
- **Medidor**: `&medir=1` añade «Medir» en la barra, con el giro, la entrada, las portadas pedidas y lo guardado, sin consola y con botón de copiar.

### Resultados: todo emulado, ningún móvil físico

`node scripts/piso-lab-grande.mjs`. Versión compilada, Chromium móvil a 390 × 844, CPU ×4 y WebGL por software. Entrada y portal: mediana de 3 pasadas; el resto, una. Entre pasadas de 5.000, la entrada varió de 1.523 a 1.742 ms.

| Libros | 0 | 50 | 1.000 | 5.000 |
| --- | --- | --- | --- | --- |
| Hasta ver el portal | 1.744 ms | 1.879 ms | 2.257 ms | 2.562 ms |
| De tocar la puerta a ver el piso | 1.376 ms | 1.538 ms | 1.621 ms | 1.550 ms |
| Recargar ya dentro del piso | 1.576 ms | 1.638 ms | 2.097 ms | 2.405 ms |
| Giro: FPS y percentil 95 | 60 y 16,8 ms | 60 y 16,8 ms | 60 y 16,8 ms | 60 y 16,7 ms |
| Libros en la habitación | 0 | 20 | 19 | 19 |
| Geometrías, texturas y llamadas | 15, 15 y 21 | 39, 23 y 51 | 38, 23 y 50 | 38, 23 y 50 |
| Portadas pedidas antes de la puerta y al entrar | 0 y 0 | 3 y 1 | 3 y 1 | 3 y 1 |
| Búsqueda, de la tecla al resultado: primera, mediana y peor | no aplica | 29, 24 y 29 ms | 46, 29 y 54 ms | 72, 37 y 72 ms |
| Filas e imágenes montadas, como máximo | no aplica | 17 y 9 | 17 y 14 | 17 y 14 |
| Portadas al recorrer la lista | no aplica | 19 | 86 | 83 |
| Memoria de JavaScript en uso | no medida | 10 MB | 11 MB | 15 MB |
| Guardado | 3,5 mil caracteres | 31 mil | 563 mil | 2,81 M |

Al recorrer 560 filas a saltos: 0 portadas mientras se mueve, 22–29 al parar y 83–86 tras seis paradas. El giro no dice nada de un móvil real, porque la GPU es la del ordenador (ver «Medidas»).

### Qué crece con la colección

**Tocar la puerta no crece**: en el perfil de CPU, entre 50 y 5.000 no aparece ninguna función de la biblioteca con más de 10 ms. **Lo que crece es arrancar la app**, unos 800 ms con 5.000 libros y CPU ×4, antes de ver el portal o al recargar dentro. Tiempo propio añadido al pasar de 50 a 5.000:

| Trabajo | Añade | Dónde |
| --- | --- | --- |
| Emparejar libros con figuras, aunque las figuras están ocultas | ~418 ms | `fold`, `normalizeText`, `hasPhrase`, `figureForBook`: `ShelfView.jsx:743` y `:794`, `figures.js:174` |
| Guardar el estado entero | ~82 ms | `setItem` y `JSON.stringify` en `useLibrary.jsx` |
| Instantánea para la nube, aunque esté apagada | ~50 ms | `snapshot` en `cloudSync.jsx:80` y `:230` |
| Rehidratar cada libro | ~60 ms | `createBook` y `load` en `useLibrary.jsx` |

No se ha tocado: es código compartido con la app vigente. Cada cambio de estado cuesta además `JSON.stringify` y `setItem` de toda la biblioteca.

**Riesgo a comprobar en el iPhone**: 5.000 libros ocupan 2,81 M de caracteres, y en Chromium y en el WebKit de Playwright cabían 5,24 M en total. Si Safari real admite menos, la app no avisa al guardar en segundo plano y seguiría en memoria; solo el registro comprueba si se ha escrito (SPEC §14.6). «Guardado» en el medidor y recargar tras registrar lo descubren.

## Preview para móviles

Procedimiento de siempre: subir la rama a GitHub y Vercel crea su versión de prueba por HTTPS. Datos de prueba por navegador, sin cuentas ni nube. El piloto no registra el service worker, para que las medidas no cuenten lo guardado por él y una versión nueva se vea al momento.

`<PREVIEW>` es https://bookshelf-git-experimento-piso-primera-persona-francisykza.vercel.app. Tiene activa la protección de Vercel: hay que iniciar sesión en el móvil, abrir un enlace de «Share» del despliegue o desactivarla para Preview.

**Android (Chrome)**
1. Abre `<PREVIEW>/?piloto=piso&biblioteca=5000&medir=1`, toca tu puerta y anota la entrada en «Medir».
2. Gira con el dedo 10 s y pulsa «Medir el giro, 5 s».
3. En la balda, «Buscar». Escribe «cartografa de sal» y mira si el teclado tapa el buscador o la lista.
4. Baja rápido, para, y expón un libro: debe salir en la estantería y conservar su estado.
5. Toca el libro de la mesa: cancela; registra 10 páginas; «Deshacer»; registra otra vez y recarga. Debe seguir.
6. Con el registro abierto, comprueba que el campo y «Guardar lectura» siguen a la vista con el teclado.
7. Pasa la app a segundo plano 1 min y vuelve, y repítelo 5 min: el piso debe verse, sin negro ni mensaje de error. Vuelve a medir el giro.
8. Repite 1 y 2 con `biblioteca=0`, `50` y `1000`. Pulsa «Copiar» y pásame los datos.

**Safari en iPhone**: los mismos pasos, y además:
- que la muesca y la barra inferior no tapen «Al portal», «Volver a la balda», «Registrar lectura» ni la última fila;
- que tocar un campo no acerque la página;
- «Guardado» en el medidor con 5.000 libros y, tras registrar y recargar, que el registro siga (ver el riesgo de arriba);
- también añadida a la pantalla de inicio, si la usas así: abre la misma dirección desde ella.

## Elementos esenciales y ordenador

Inventario de funciones, posiciones y reglas en [piso-funciones.md](piso-funciones.md).

- **Barra superior:** flota sobre la habitación, sin franja; el dibujo llega hasta arriba. En tu piso el título queda solo para lectores de pantalla; en casa de otra persona se ve su nombre en una placa. La franja de abajo sigue igual.
- **Comprobado en emulación (Chromium y WebKit a 390 × 844; el ordenador también a 360 × 640):** entrar, biblioteca desde la estantería, registrar tocando el libro, calendario y diario desde el ordenador, y salir tocando la puerta; menú con teclado y foco; esenciales movidos y girados en el decorador; guardado antiguo completado; restablecer.
- **Sin comprobar:** ningún móvil físico, ni Safari real.
- **Acabados:** se personalizan con los tonos de cada pieza. Los acabados especiales de la tienda no tienen dibujo en el interior: si una copia trae uno, se conserva, pero no se ve.
- **Descubrir el ordenador y la puerta:** quedan fuera del encuadre inicial y aparecen al girar la vista hacia la derecha; el menú llega a ellos sin girar. A revisar en el recorrido físico.
- **Hueco del menú:** en Chromium por software, un fondo totalmente opaco encima del lienzo dejaba un rectángulo invertido del color del fondo. El menú usa un fondo al 99 %. No se ha comprobado si pasa en un móvil.
- **Comunidad y cuenta:** se abren desde el ordenador, pero sin nube en el piloto.

## Usabilidad móvil y medición (6-11-2026)

Todo en emulación: Chromium móvil a 390 × 844, CPU ×4 y WebGL por software, sobre la compilación local. **Ningún móvil físico.** La preview de Vercel pide sesión, así que no se ha medido allí. Script: `scripts/piso-lab-medidas.mjs`; vídeo: `scripts/piso-lab-video.mjs`; pruebas: `e2e/piso-usabilidad.spec.js`.

### El indicador «Entrada»

El número de la grabación (118541 ms) no era una entrada. El medidor guardaba el momento de tocar la puerta y volvía a restarlo cada vez que se montaba la habitación, y volver de Decorar la monta. Reproducido con la versión anterior: entrada real de 2221 ms, y tras 30 s y un paso por Decorar marcaba 34547 ms. No se puede saber qué se hizo exactamente en la grabación, pero el mecanismo da ese orden de magnitud. Con la página en segundo plano la medida tampoco valdría: ahora se marca como tal.

Cada montaje tiene ahora su origen (`puerta`, `recarga`, `vuelta`) y solo `puerta` es «Entrada». Definiciones en `src/features/pisoLab/labTiming.js`:

| Fase | Qué mide |
| --- | --- |
| Lectura de la biblioteca | Leer y preparar lo guardado, una vez, en el arranque de la página |
| Hasta el portal | Del inicio de la página al portal montado |
| Puerta | Del toque a que empieza el montaje (la animación del portal) |
| Datos | Traer el código de la escena |
| Escena | Construirla, con exterior y portadas |
| Interactuar | De ahí a que un toque se atiende: temporizadores seguidos sin retraso. Funciona también en Safari, sin la API de tareas largas |

### Entrada con 50 y 5.000 libros

Mismas condiciones, perfil nuevo en cada repetición, 7 alternando. Mediana y extremos, en ms.

| | 50 libros | 5.000 libros |
| --- | --- | --- |
| Lectura de la biblioteca | 4 (3–6) | 76 (73–94) |
| Arranque hasta el portal | 1312 (1240–1483) | 2266 (2135–2425) |
| Puerta | 647 (635–657) | 672 (670–678) |
| Datos | 103 (96–109) | 99 (96–113) |
| Escena | 954 (915–1016) | 949 (914–1036) |
| Interactuar | 24 (21–33) | 25 (3–40) |
| **Entrada, de la puerta a poder interactuar** | **1731 (1692–1784)** | **1750 (1699–1846)** |

La entrada no crece con la biblioteca: la diferencia queda dentro del ruido. Lo que crece es el arranque, unos 950 ms, y solo 72 son leer: el resto es lo que la app calcula sobre los libros al arrancar. El perfil de la sección «Qué crece con la colección» apunta a `fold`, `normalizeText` y `hasPhrase`. No se ha tocado.

### Giro y descanso

| Giro, 5 s con 5.000 libros | CPU ×1 | CPU ×4 |
| --- | --- | --- |
| Fotogramas por segundo | 60 | 60 |
| Tiempo de fotograma, mediana y percentil 95 | 16,7 y 16,8 ms | 16,7 y 16,7 ms |
| Peor fotograma | 16,8 ms | 33,3 ms (uno, sin esperar a la GPU) |
| Por encima de 33 ms | 0 | 0 |
| Coste de dibujar, esperando a la GPU | 5,1 ms | 8,7 ms |

26 llamadas de dibujo, 49 geometrías y 29 texturas. Dibuja la CPU por software: la GPU de un móvil no está medida, y la limitación de CPU no le afecta.

| Dibujos en 5 s | |
| --- | --- |
| Quieto, ventana a la vista | 4 (el agua, a su paso lento) |
| Quieto, sin ventana a la vista | 0 |
| Tapado por el registro | 0 |
| Página oculta | 0 |

### Biblioteca de 5.000 libros, CPU ×4

| Acción | Resultado |
| --- | --- |
| Abrir la biblioteca | 314 ms; 40 cargados |
| Buscar fuera del bloque: n.º 4873, n.º 5000, n.º 2500 | 189, 84 y 130 ms; una fila, el ejemplar correcto |
| Peor tecla escribiendo | 57 ms |
| Filtros | Entre 95 y 194 ms |
| Recorrer 3.399 resultados hasta el final | 17 filas como mucho; 12 imágenes como mucho; 704–724 nodos; memoria de JS de 29 a 25 MB; 330 portadas pedidas en todo el recorrido |
| Desplazar sin parar | **15 fotogramas por segundo**: mediana 66,7 ms, percentil 95 83,4, peor 183,3 |
| Abrir y cerrar una ficha | 396 y 683 ms; la búsqueda se conserva |
| Abrir el registro | 502 ms (280 son el acercamiento) |
| Guardar el registro | 1232 ms hasta cerrarse, con una **tarea larga de 647 ms**; la página pasa de 40 a 65 |

Dos cosas por mirar: guardar bloquea el hilo principal, sin que se haya perfilado todavía por qué, y el desplazamiento va justo aquí, aunque con la página dibujada por software no se puede atribuir a la lista sin probarlo en un móvil. Los tiempos de acción incluyen lo que tarda Playwright en ver el resultado.

### Qué ha cambiado

- **Sillón:** el giro llega ahora hasta cada esencial esté donde esté (`yawRange`), hasta 2,6 rad; más allá queda el respaldo y se llega por el menú. Más allá de 0,6 rad solo gira la mirada: los ojos no se mueven, y el exterior sigue comprobado desde ellos. Antes, en el 2.º B el ordenador no se podía ver.
- **Estantería:** cada balda se aleja lo justo para caber a lo ancho, sin salir de la habitación, y se reencuadra al girar el móvil. Antes, en la balda de abajo la estantería se salía por los dos lados a 320 y 390 px.
- **Ordenador:** al tocarlo la cámara se acerca y se ve entero, también a 320 px.
- **Volver:** el giro se conserva al cerrar registro, ordenador, ficha y Decorar; el escritorio recuerda su desplazamiento y el último botón.
- **Tocar y arrastrar:** ya se distinguían; ahora está comprobado con eventos táctiles: arrastrar desde el libro solo mira, ir y volver no es un toque, mantener no hace nada y un temblor de 5 px sí es un toque. Si el centro del dedo no da en nada, se mira a 14 px alrededor.
- **Accesos:** la estantería reserva 2 celdas delante en vez de 1. Lo que se interpone entre los ojos y la balda se oculta mientras la miras; no se mueve.
- **Superpuestos, en la habitación:** la decoración no quita el toque y, entre dos muebles útiles, gana el más cercano.
- **Superpuestos, en el decorador:** el primer toque avisa de lo que hay detrás y el segundo lo elige, y se puede arrastrar aunque siga tapado (`stackTaps`, solo en el piloto).
- **Ordenador por dentro:** Calendario, Mi diario y Estadísticas delante; las otras 14 funciones en Mi lectura, Mi progreso, Mis libros y Fuera del piso.

## Pasada de rendimiento: guardar, desplazar y arrancar (6-11-2026)

Todo en emulación: Chromium móvil a 390 × 844, 2 ppp, CPU ×4 y WebGL por software, sobre la versión compilada, 5.000 libros sintéticos y perfil nuevo en cada repetición. **Ningún móvil físico ni la preview.** La limitación de CPU no alcanza a la GPU. Scripts: `scripts/piso-lab-rendimiento.mjs` y `scripts/piso-lab-portadas-reales.mjs`; compilaciones y datos en `qa-report/rend/`, sin seguimiento.

### Antes y después

Mismo script y mismos datos, una compilación detrás de otra, 5 repeticiones. Mediana y extremos, en ms salvo donde se indica.

| | Antes | Después |
| --- | --- | --- |
| **Guardar, tiempo total**, 1.er registro | 758 (699–784) | 301 (210–349) |
| Guardar, tiempo total, 2.º registro | 920 (695–998) | 268 (218–283) |
| **Tarea bloqueante más larga**, 1.er registro | 483 (442–506) | 90 (67–118) |
| Tarea más larga, 2.º registro | 670 (443–736) | 92 (63–96) |
| Tareas de más de 50 ms al guardar | 3 | 2 (1–2) |
| **Desplazar, 40 px por fotograma**, FPS | 31,3 (30,7–31,7) | 60 (60–60) |
| Fotogramas del peor segundo | 28 (25–28) | 60 (60–60) |
| Fotograma, percentil 95 | 50 | 16,7 |
| Filas e imágenes montadas como mucho | 17 y 9 | 17 y 9 |
| **Arranque hasta el portal, 5.000 libros** | 1790 (1752–1862) | 1210 (1201–1304) |
| Arranque hasta el portal, 50 libros | 1109 (996–1138) | 1079 (1054–1160) |
| Lo que crece de 50 a 5.000 | 681 | 131 |
| Tarea más larga del arranque, 5.000 libros | 376 | 283 |
| Tareas de más de 50 ms del arranque, 5.000 libros | 7 | 5 |

El ordenador tenía poca carga en esta tanda. En tandas anteriores, con más carga y antes de los últimos ajustes: desplazar 15,9–17,3 FPS antes y 41,1–42,4 después, peor segundo 13–14 y 36–39. Con traza activa, 34,7 FPS. **Los 60 FPS son el techo de esta tanda, no lo esperable en un móvil.** La comparación vale; el valor absoluto, no.

### Guardar

Partiendo del perfil anterior, con una tarea principal de 511 ms:

| Parte | Antes | Qué era | Ahora |
| --- | --- | --- | --- |
| Actualizar el estado | Muy poco | El reducer solo copia el libro que cambia | Igual |
| Cálculos derivados | 394 ms | `figureForBook` en un efecto de `ShelfView`, siempre montada, sobre los 5.000 libros y **con las figuras ocultas** | No se ejecuta si `FIGURES_ENABLED` es falso; al reactivarlas se recalcula |
| Derivados de la biblioteca cerrada | ~20 ms | Ordenar y agrupar sin pintar nada | Esperan a que se abra |
| Serialización | 60 + 59 ms | `JSON.stringify` del estado entero, dos veces | Unos 28 ms: texto por libro en caché (`serialize.js`), con salida idéntica y prueba |
| Persistencia | 55 ms | `setItem` de 2,8 MB, más una segunda escritura | Una sola, unos 42 ms |
| Sonido | 44–75 ms | Crear el contexto de audio, solo la primera vez | Igual |
| Renderizado | El resto | Volver a dibujar la habitación | Va en otra tarea, separada de la escritura |

**El objetivo de reducir las tareas de más de 50 ms se cumple solo en parte:** quedan 1 o 2, de entre 51 y 118 ms. `setItem` de 2,8 MB es síncrono y tiene que acabar antes de confirmar; bajarlo pide cambiar el formato de almacenamiento (por ejemplo, libros por separado), lo que afecta a toda la app, y no se ha tocado. La caché cuesta unos 8–10 MB más de memoria de JS con 5.000 libros.

Integridad, en `e2e/piso-rendimiento.spec.js`: recarga justo al cerrarse, doble toque, tres registros seguidos con Deshacer, y fallo de escritura. Si `setItem` falla, el registro sigue abierto con el aviso y lo escrito, sin «Deshacer» ni progreso, lo guardado no cambia y reintentar entra una sola vez. `persistNow` siempre escribe de verdad; un estado solo cuenta como escrito si la escritura ha funcionado.

### Desplazar

- **La causa: una regla de CSS sin relación con la lista.** `.bed-pages__page:has(.bed-pages__action) > :not(.bed-pages__action)`, del libro de la cama, hacía recalcular toda la página con cada fila que entraba o salía: de unos 18.000 elementos a unos 970 en 2 s, y de 1.200 a 130 ms de estilos. Ahora es una clase. Una primera bisección culpaba a otra regla, la de `.book-sheet`; aislada en una página nueva no cambiaba nada, y se ha dejado como estaba. El mecanismo interno del navegador no está averiguado, y Safari puede comportarse distinto.
- Filas con `memo`: solo se dibujan las que entran y salen.
- Las portadas de la lista ya no buscan su contenedor con `getComputedStyle`, que forzaba estilos (206 ms en 6 s). Ya están acotadas por la lista.
- Moviendo la lista a más de 1 px/ms no se piden portadas; se piden al frenar.
- Sin cambios: búsqueda sobre toda la colección, filtros, posición al volver de una ficha y límites de filas e imágenes (`e2e/piso-lab-grande.spec.js`).

### Arrancar

Con 5.000 libros, lo que crecía en el perfil de partida:

| Trabajo | Coste | ¿Hace falta para el portal? | Ahora |
| --- | --- | --- | --- |
| Emparejar figuras | 429 ms | No | Apagado mientras estén ocultas |
| Leer y preparar lo guardado | 60–70 ms | Sí: hay un solo estado para toda la app | Igual |
| Render de más, con los derivados de la biblioteca cerrada | ~115 ms | No | Los derivados, al abrirla |
| Referencia para la nube | 46 ms | No | Solo si hay sesión |
| Reescribir lo cargado | ~110 ms | No | En reposo, a trozos, y solo si cambia |

Lo que no depende de los libros es lo que más pesa: la fachada dibujada, unos 295 ms (`getImageData` 240). Hace falta para ver el portal y no se ha tocado.

### Portadas reales

70 portadas reales de Open Library (36 ISBN, en español e inglés) en una mezcla de 126 archivos: tal cual, JPEG de 1600 y 3000 px, PNG de 900 px y WebP. Mediana 29 kB, máximo 3,2 MB. Red simulada de 80 ms + 3 Mbit/s; las URL que fallan siguen fallando. Las imágenes no están en el repositorio. 3 repeticiones.

| | Antes | Después |
| --- | --- | --- |
| Rápido (40 px), FPS y peor segundo | 31,7 y 28 | 60 y 60 |
| Rápido, portadas y datos pedidos en 6 s | 125, 27,2 MB | 43, 9,8 MB |
| Despacio (8 px), FPS y peor segundo | 55,2 y 51 | 60 y 60 |
| Despacio, portadas y datos pedidos en 6 s | 61, 12,6 MB | 65, 12,7 MB |
| Filas e imágenes montadas como mucho | 17 y 10 | 17 y 10 |
| Tareas de más de 50 ms | 0 | 0 |
| Peso descomprimido de lo montado, como mucho | 76 MB | 75 MB |

**Queda sin resolver:** diez imágenes montadas pueden sumar 75 MB descomprimidas si las portadas son enormes, aunque se muestren a 42 × 63. El límite cuenta imágenes, no su peso, y sin miniaturas en un servidor no se puede reducir desde aquí. Es lo primero que mirar en el iPhone.

### Pruebas

- Vitest: `src/features/pisoLab src/features/edificio src/domain src/state`, 461 de 461, con `src/state/__tests__/serialize.test.js`.
- `e2e/piso-*` en Chromium y WebKit: 130 pasan, 2 omitidas y 2 fallan en WebKit (`piso-esenciales:245`, `piso-lab:817`). Son intermitentes y **también fallan en 9461907**, 1 de cada 4 repeticiones.
- Fallan igual en 9461907, sin relación con esto: `e2e/v128:422`, `v128:478`, `v159:139` y los 4 casos de `e2e-community/v158`.
- **Sin comprobar:** la sincronización con una sesión de nube. `snapshot` usa ahora `serializeState`, de salida idéntica, y su referencia se calcula al hacer falta, pero ninguna prueba que pase recorre ese camino.

## Medidor por acción: guardar, desplazar y reposo (7-11-2026)

El medidor (`&medir=1`) apunta ahora, además del giro y la entrada, cada guardado de lectura, cada gesto de desplazamiento de la biblioteca y un recuento de 30 s en reposo. Lo mide aunque su hoja esté cerrada, y «Copiar» se lleva todas las líneas. Código: `src/features/pisoLab/labActions.js`; marcas `lectura:toque`, `lectura:confirmada` y `lectura:fallida` en `ReadingEntryForm.jsx`; registro de serializaciones y escrituras en `src/state/serialize.js`. El aspecto del medidor no cambia: son más líneas y un botón con las mismas clases.

| Línea | Qué mide |
| --- | --- |
| Guardar lectura | Del toque en «Guardar lectura» a la confirmación, y si se escribió. Bloqueo más largo y cuántos pasan de 50 ms, hasta 1,2 s después de confirmar |
| Guardar, por dentro | Serializaciones y escrituras de ese guardado, libros cuyo texto se rehízo, milisegundos y caracteres escritos |
| Desplazar biblioteca | Cada gesto sobre la lista: segundos y velocidad, FPS, peor segundo, percentil 95 y peor fotograma, bloqueos, y filas e imágenes montadas |
| Reposo 30 s | Sin tocar: dibujos de la escena, cambios en la página fuera del medidor y bloqueos. Si tocas la pantalla o la página se oculta, lo dice y no vale |
| Bloqueos medidos con | La API de tareas largas (Chrome, también en Android) o, en Safari, que no la tiene, una sonda de temporizador |
| Medido en | «navegador automatizado, emulación» si lo maneja un programa; si no, hay que decir qué móvil es |

Los FPS son los del hilo principal. En un móvil el desplazamiento lo mueve el compositor y puede verse más suave de lo que dicen.

### Dispositivo físico

| Medida | Resultado | Dónde |
| --- | --- | --- |
| Giro con 5.000 libros | 60,2 FPS | Móvil de Francisco, 7-11-2026, según su captura. Modelo y navegador sin anotar |
| Entrada | 1.131 ms | Ídem |
| Guardar, desplazar y reposo | **Sin medir en un dispositivo físico** | Hay que repetirlo con la preview, ya con estas líneas |

### Emulación

Chromium móvil a 390 × 844, CPU ×4, WebGL por software, 5.000 libros sintéticos, versión compilada, lo que apunta el propio medidor. 3 repeticiones (`node scripts/piso-lab-rendimiento.mjs panel …`).

| Acción | Resultado |
| --- | --- |
| Guardar, 1.er registro | 213–269 ms hasta confirmarse; bloqueo más largo 88–129 ms; 2 tareas de más de 50 ms |
| Guardar, 2.º registro | 145–151 ms; bloqueo más largo 72–74 ms; 2 tareas de más de 50 ms |
| Guardar, por dentro | 1 serialización y 1 escritura por guardado; **1 de 5.000 libros rehecho**; serializar 7–41 ms; escribir 2,81 M caracteres, 28–50 ms |
| Desplazar, 6 s a unos 2.400 px/s | 60,2 FPS, peor segundo 60, 0 bloqueos; 17 filas y 9 imágenes. Es el techo de la pantalla con el ordenador libre, no lo esperable en un móvil |
| Reposo 30 s | 49–51 dibujos de la escena, 0 cambios en la página, 0 bloqueos |

Los dibujos en reposo son el agua de la ventana: un paso cada 420 ms mientras se ve. Con movimiento reducido, 0.

**La sonda no sirve con la CPU limitada.** En reposo, con CPU ×4, encontraba unas 140 pausas en 10 s sin ninguna tarea larga, incluso sin dibujar nada; con CPU ×1, ninguna. Son las pausas con que Chrome emula la CPU lenta. Por eso, donde hay API de tareas largas, se usa esa. En Safari queda la sonda, sin esa limitación de por medio, pero no se ha podido contrastar en un iPhone.

### ¿Guardar vuelve a serializar toda la biblioteca?

**Resumen: solo se reconstruye el libro modificado, pero todavía se escribe la biblioteca completa.** No se cambia el almacenamiento por ahora (decisión de Francisco, 7-11-2026).

No. Rehace el texto del libro que cambia y toma los otros 4.999 de la caché (prueba en `src/state/__tests__/serialize.test.js` y en el medidor). Lo que sí se repite cada vez es juntar y escribir el texto entero, 2,81 M caracteres, porque todo se guarda bajo una sola clave: esos son los 30–50 ms que quedan. Una serialización y una escritura por guardado: el temporizador y el cierre de la página ya no repiten lo escrito.

### Persistencia, guardados seguidos y errores

En `e2e/piso-rendimiento.spec.js`, en Chromium y WebKit:

- Recargar justo al cerrarse el registro conserva el progreso y la sesión.
- Doble toque: una sola sesión.
- Tres registros seguidos y Deshacer: progreso e historial cuadrados, también tras recargar.
- Escritura que falla: no se confirma, avisa, conserva lo escrito y el medidor lo apunta como «no se pudo escribir».
- Arrancar no reescribe lo que no ha cambiado y sí lo que cambian las migraciones.
- El medidor apunta una serialización, una escritura y como mucho un libro rehecho por guardado, desplazamientos con FPS y límites de filas e imágenes, y el reposo de 30 s.

Los 15 FPS y la tarea de 647 ms eran del informe anterior, en emulación; la corrección está en 65a683b.

### Prueba en Android y Safari de iPhone (7-11-2026)

Decisión de Francisco: comprobar guardado, desplazamiento y reposo en Android y en Safari de iPhone **sin añadir funciones ni cambiar el almacenamiento** hasta tener esos datos.

Las bibliotecas de prueba están separadas de los datos reales así:

- Viven en el `localStorage` de la dirección de la preview, que es distinto del de producción (`bookshelf-wine-iota.vercel.app`). Lo de producción no se ve ni se toca desde la preview.
- `seedPilotLibrary` no siembra nada en producción.
- Si en la preview ya había algo, se copia a `bookshelf:lab:biblioteca-propia` antes de sembrar y vuelve con `&biblioteca=propia`.
- **No iniciar sesión en la nube dentro de la preview.** El piloto no apaga la sincronización: con sesión, la biblioteca de prueba podría subir a esa cuenta. No se ha comprobado si la preview tiene configurada la nube.

## Ficha con teclado, «0 libros rehechos» y visitas (7-11-2026)

### Registrar lectura dentro de la ficha

- **Causa:** la fila de «Guardar lectura» y «Cancelar» heredaba de `laptop.css` una fila pegada al pie (`position: sticky; bottom: 0`, fondo opaco). Con el teclado abierto, la ficha encoge y esa fila tapaba el campo y el resumen.
- **Arreglo, como en el registro independiente** (`ReadingLogSheet`, `.panel--log`): en la ficha la fila va en su sitio, después del resumen (`library-sheet.css`). Al enfocar el campo, la ficha lo lleva a la vista también cuando el teclado encoge la ventana entera (Android), no solo la parte visible (iPhone) (`BookDetailModal.jsx`).
- **Comprobado en emulación** (Chromium y WebKit, 390 × 844), con el teclado cerrado, con la ventana encogida 336 px (Android) y con la parte visible encogida y un teclado pintado encima (iPhone):
  - el campo con el foco se ve sin tocar nada;
  - campo, resumen, Guardar y Cancelar se ven y se pueden tocar sin nada encima al desplazar la ficha;
  - lo guardado sigue tras recargar.
- Prueba: `e2e/piso-ficha-visita.spec.js`. Teclado simulado: falta verlo con un teclado real en Android y en un iPhone.

### ¿Qué cuenta «libros rehechos»?

Cuenta los libros cuyo texto JSON hubo que volver a generar en las serializaciones del guardado. Son los objetos de libro nuevos, que no estaban en la caché de `serializeState`. **No cuenta cambios guardados ni escrituras.**

- Si el guardado cambia el libro (página, estado…), el reducer crea un objeto nuevo y sale **1**.
- Si el libro no cambia, sale **0** aunque se guarde algo. Pasa, por ejemplo, con «Voy por la página» a la página en la que ya estabas: se añade una sesión al registro de lecturas, pero el libro queda igual. También puede pasar si otra serialización anterior ya lo había rehecho.
- Lo que se escribe es siempre la biblioteca entera: mirar «escrituras» y «caracteres», no este contador.

Reproducido con 5.000 libros, Chromium emulado sin limitar la CPU:

| Guardado | Total | Rehechos | Escrituras | En el almacenamiento | Tras recargar |
| --- | --- | --- | --- | --- | --- |
| Ficha, «He leído» 5 | 51 ms | 1 | 1 | pág. 47 → 52, sesiones 2 → 3 | — |
| Ficha, otra vez seguido | 52 ms | 1 | 1 | 52 → 58, sesiones 3 → 4 | — |
| Ficha, «Voy por la página» 58 (la misma) | 45 ms | **0** | 1 | pág. 58, sesiones 4 → **5** | pág. 58, sesiones 5 |

No he visto el guardado de 48 ms de la grabación. Su «0 libros rehechos» encaja con este caso: se guardó una sesión sin cambiar el libro, y la escritura cuenta 1. Para confirmarlo en el móvil, mirar en el medidor que «escrituras» sea 1 y comprobar la sesión en el historial tras recargar.

### Visitar el piso de la vecina

- Recorrido sin cambios: tu piso → «Al portal» → piso de la vecina → «Al portal». El aspecto de tu piso no cambia: su título sigue oculto.
- De visita, la balda vuelve con **«Volver a la sala»** en vez de «Volver al sillón», porque el sillón no es tuyo.
- El nombre del piso visitado («Piso de Vecina de prueba · 2.º B») se cortaba en la balda a 360 px. Ahora es un botón: un toque lo muestra entero en dos líneas y otro lo recoge (`aria-expanded`, y `title` con el nombre completo).
- **Solo mirar:** sin registrar, Decorar ni Buscar. Al entrar, mirar la balda y salir, el `localStorage` queda igual, clave por clave (`e2e/piso-ficha-visita.spec.js`, y `piso-lab.spec.js` «el visitante»).

## Cierre del registro, final del libro y relectura (7-11-2026)

Medida de Francisco en esta prueba: guardados de 53 y 43 ms, un libro reconstruido y ninguna tarea de más de 50 ms. No se ha tocado el guardado.

- **Cierre del registro en la ficha:** al guardar, el formulario se cierra y aparece «Lectura registrada · +N páginas» con **Deshacer** (8 s, como en la habitación: `LogUndoToast` y `revertLog`). El progreso de la ficha se actualiza y el foco vuelve a «Registrar lectura». «Deshacer» devuelve la página y la sesión y avisa «Registro deshecho».
- **Última página en «Leyendo»:** la ficha ofrece «Marcar como terminado» (`atLastPage`) y, al pulsarlo, abre la reseña de terminar, como cuando un registro termina el libro. No se termina solo. Un registro que llega a la última página sigue terminando el libro como antes.
- **Relectura, solo a petición:** en un libro terminado, la ficha no ofrece «Registrar lectura» ni los controles de página, que lo devolvían a «Leyendo» sin querer y borraban la fecha en que se terminó. En su lugar está **«Empezar relectura»** (`startReread`):
  - la lectura anterior (inicio y fin) se guarda en `pastReads`;
  - se vuelve a la página 0;
  - las sesiones del registro no se tocan;
  - la ficha dice «Ya lo leíste una vez; la última terminó el …».
- **Campo nuevo `pastReads`** en el libro: va dentro de la biblioteca guardada, así que viaja igual a la nube. Los libros sin él siguen igual.
- **Sigue igual:** elegir «Leyendo» en la balda de un libro terminado lo reabre como antes, sin guardar la lectura anterior. Corregir la última sesión de un libro terminado también lo reabre.

Comprobado en emulación (Chromium y WebKit, 390 × 844), en `e2e/piso-ficha-visita.spec.js`:

- Guardar y Cancelar se alcanzan con el teclado abierto (Android e iPhone simulados) y cerrado.
- Al guardar, el formulario se cierra, aparece la confirmación con «Deshacer», el progreso queda al día y todo sigue tras recargar.
- «Deshacer» funciona y su resultado sigue tras recargar.
- En la última página se ofrece terminar el libro.
- La relectura conserva la sesión anterior y la fecha de fin, también tras recargar.
- Entrar en el piso de la vecina no cambia el almacenamiento.

Capturas: `qa-report/piso-ficha-visita/`.
## Cierre del bloque y versión privada (7-11-2026)

Francisco aprobó visualmente el cierre del registro y la confirmación con Deshacer, según su última grabación.

### Comprobaciones del cierre

Hechas en emulación (Chromium y WebKit, 390 × 844), en `e2e/piso-ficha-visita.spec.js`:

- **Guardar, corregir y Deshacer se conservan tras recargar.**
  - La corrección con «Voy por la página» pide «Guardar corrección».
  - La corrección con los botones de página también se conserva.
- **Corregir páginas no crea una lectura terminada.** El libro sigue en «Leyendo», sin fecha de fin y sin lecturas anteriores nuevas.
- **La relectura conserva el historial.** Corregir durante una relectura no la da por terminada, no toca la lectura anterior (`pastReads`) ni las sesiones, también tras recargar.

### La habitación como pantalla inicial

- La habitación en primera persona es el inicio. Su puerta, «Al edificio» y «Ir al edificio» del menú llevan al **edificio del puerto de la app**: el real, con su portal, tienda y hotel. Ya no llevan al portal de prueba con la vecina inventada.
- Desde el edificio, «atrás» vuelve a la habitación. Escape no cierra la habitación, porque es el inicio.
- **Volver a la experiencia anterior:** en el menú del piso, «Volver a la experiencia anterior» lleva a la habitación ilustrada. Se recuerda en este dispositivo (`bookshelf:inicio`).
- **Regresar a la habitación nueva:** desde «Ambiente», con «Ir a la habitación nueva».
- La elección no toca la biblioteca, las lecturas, la decoración ni la nube.
- **Dónde está activa por defecto:** solo en la preview de la rama del piloto. Lo decide `__PISO_INICIO__` en `vite.config.js`, según `VERCEL_GIT_COMMIT_REF` o `PISO_INICIO=1`. En producción y en las pruebas no cambia nada; en cualquier navegador se puede activar con `?inicio=habitacion` y desactivar con `?inicio=anterior`.
- `/?piloto=piso` sigue siendo el piloto de siempre, con el portal de prueba y la vecina.
- El edificio se precarga a los 2,5 s de estar en la habitación. Sin eso, mientras llegaba se veía debajo la habitación de antes.

### Datos de demostración, separados

- Las bibliotecas de demostración solo se siembran con `?piloto=piso&biblioteca=N` y nunca en producción.
- **Con una biblioteca de demostración en el navegador, la nube queda apagada** (`demoLibraryActive`, `cloudSync.jsx`): no baja ni sube nada.
- La habitación avisa con «Biblioteca de demostración en este navegador · Volver a la tuya» (`?piloto=piso&biblioteca=propia`).
- Comprobado: arrancar en la habitación, ir al edificio, volver, cambiar de experiencia y recargar dejan los libros y las sesiones como estaban, sin marca de demostración (`e2e/piso-inicio.spec.js`).

### Antes de integrar en `main` (hecho en la 1.87.0, 7-11-2026)

- **La rama del piloto compila sin la nube:** en `vite.config.js`, las variables de Supabase se vacían salvo con `PISO_LAB_CON_NUBE`. Al integrar hay que quitarlo, o producción se quedaría sin cuentas.
- `__PISO_INICIO__` tiene que valer `true` en producción.
- Las pruebas que dan por hecho que se empieza en la habitación ilustrada tendrán que fijar `bookshelf:inicio` a `anterior`.
- **En la preview no hay nube**, así que el edificio solo dice «Inicia sesión en "Tu cuenta"…» y no se puede probar entrar en él con una cuenta. Esa parte solo se verá en producción, salvo que se active la nube en la preview.
- Subir versión (`src/diag.js`, `package.json`, `public/sw.js`, `SPEC.md`) y comprobar `sw.js` en producción.
## Pendiente y limitaciones

- **Sin vista propia** (se avisa y lleva a la vista de siempre): compañeros místicos con animación y copias con acabado.
- **Ventanas pintadas de los sets de sagas**: no se ha comprobado su hueco; la vista real solo sustituye a la `ventana` básica.
- **Lámpara de pie**: es simétrica; su giro se guarda y se comprueba en los datos, pero apenas se aprecia a la vista.
- **Estantería**: tu lectura de frente en la balda de la lámpara y lomos reales repartidos con `layoutSpines` (lo que no cabe no se dibuja). Cada libro lleva encima un botón HTML transparente para el dedo y el lector de pantalla. Primer toque: lo elige y lo saca de su sitio; segundo toque o «Abrir ficha»: abre la ficha vigente encima, sin desmontar el interior. En un piso ajeno siguen los lomos de adorno de `furniture.js`.
- **Libro de la mesa**: tocarlo abre el registro de ese ejemplar tras un acercamiento de 280 ms (ninguno con movimiento reducido, teclado o lector de pantalla). Sin lectura, la mesa queda vacía y el botón lleva a la estantería, o a Mi biblioteca si no hay libros. Sin portada, tela con el título repartido. Las guías (`showGuides`) se activan en el rincón: el piloto no tiene su interruptor.
- **Cámara**: sale del sillón real, sentada y mirando hacia donde mira el sillón. Un piso sin sillón usa una vista fija. Si el sillón queda de cara a una pared, se verá la pared.
- **Horizonte por planta**: valores artísticos, no físicos (`PLANTAS` y `ALTURAS`): sube un poco con la planta y los tejados bajan. Solo se ha comprobado a ojo el 1.º A; ningún piso de las plantas 2 y 3 del laboratorio da al hotel.
- **Ventana lateral del 1.º A**: su exterior solo se pinta si el giro llega hasta ella, que ahora depende de dónde estén los esenciales.
- **Materiales**: la lámpara de pie, las paredes, el sillón, la estantería, la ventana y la mesa baja y la mesa van dibujados en píxel; la mesilla lleva veta y el suelo es el del decorador. Los demás muebles y la alfombra siguen siendo cajas con luz suave, y el brillo de la lámpara en la estantería también.
- **Cubierta**: se pide al tocar la puerta y el piso la espera hasta 2,2 s; si tarda más, aparece primero la tela con el título.
- **Hora**: se entra al atardecer, la hora fija de la fachada, también en el editor. La fachada no sigue el reloj, y el interior tampoco.
- **Portal**: la ruta se abre sobre el rincón, que se carga detrás. Si el portal pasara a ser la entrada, habría que evitarlo.
- **Multijugador**: fuera del piloto, como pide el encargo.

## Medidas

**Tomadas antes de refinar el encuadre**: el interior nuevo pide además la cubierta de la lectura y no se han repetido.

`node scripts/piso-lab-medir.mjs` (resultado completo en `qa-report/piso-lab/medidas.json`, no versionado).

**Son de emulación**: versión compilada servida en local, Chromium móvil a 390 × 844, CPU ×4 y WebGL por software
(SwiftShader). **Sin dispositivo físico.** Una sola pasada por caso, así que los tiempos son orientativos.

| Biblioteca de 1.200 libros | Rincón vigente (`/`) | Piloto (`/?piloto=piso`) |
| --- | --- | --- |
| Primera carga | 1.029 ms hasta la escena | 2.017 ms hasta el portal |
| Primer pintado con contenido | 684 ms | 760 ms |
| Bytes de la ruta (gzip) | 2.436 KB | 2.508 KB en el portal; 2.634 KB ya dentro |
| Hasta abrir el registro | 384 ms | 1.646 ms desde el portal (1.404 entrar + 242 registrar) |
| Giro | no aplica | 60 FPS, percentil 95 de 16,7 ms (301 fotogramas) |

Con la biblioteca de ejemplo: registro en 1.656 ms y giro igual. Su primera medida del rincón (1.978 ms) se hizo con el
servidor en frío y no sirve para comparar.

**Three.js no se pide en el portal** (`three: false`) y pesa unos 126 KB gzip al entrar.

**El giro no demuestra el objetivo de 30 FPS en un móvil**: la limitación de CPU no afecta al proceso de la GPU, que aquí es
el procesador de un ordenador de sobremesa. Lo mide de verdad un móvil físico: abrir el piso y ejecutar en la consola
`await window.__pisoLab().measureYaw(5000)`.

**Diez entradas y salidas en la versión compilada**: 10 contextos WebGL creados, uno por entrada, y 0 lienzos vivos al final;
memoria igual en la primera y la última visita de cada piso (13 geometrías y 3 texturas; 8 y 2). En desarrollo salen el doble
porque StrictMode monta dos veces, y por eso la prueba e2e admite hasta 22.

## Coste del exterior

Versión compilada, Chromium a 390 × 844, WebGL por software y una sola pasada por caso, así que son orientativas. **Sin dispositivo físico.**

| CPU ×4 | Antes | Con el exterior nuevo |
| --- | --- | --- |
| Quieta, 10 s: redibujados y uso del hilo | 0 y ~0 % | 9 y 1,1 % |
| Quieta con movimiento reducido | 0 y ~0 % | 0 y 0,1 % |
| Giro, 5 s: FPS, percentil 95 y uso del hilo | 60, 16,8 ms y 36,3 % | 60, 16,8 ms y 37,1 % |
| Giro con movimiento reducido: percentil 95 y uso del hilo | 16,7 ms y 24,4 % | 16,7 ms y 36,0 % |
| Entrada al piso | 2.649 ms | 2.896 ms |
| Geometrías y texturas | 40 y 20 | 41 y 24 |
| Llamadas de dibujo en el sillón | 48 | 51 |

Sin frenar la CPU, con la cámara quieta: 24 redibujados en 10 s, los esperados con un fotograma cada 420 ms, y 0,4 % del hilo. Pintar el exterior: 345 ms con CPU ×4 y 127 ms sin freno. Con la miniatura guardada, la entrada baja de 3.640 a 2.896 ms.

**Parpadeo en un giro muy lento** (píxeles que van y vuelven por fotograma): ventana 0,643 % (antes 0,198 %), pared y lámpara 0,199 % (antes 0,162 %). La ventana sube porque ahora tiene más detalle; se redujo el tramado de cielo y agua para contenerlo.

## Pruebas

- `e2e/piso-lab.spec.js`: 30 pruebas en `chromium-390x844` y en `webkit-390x844`. WebKit de Playwright en Windows no equivale a Safari. El fallo intermitente de «el agua se mueve poco…» era de la prueba: contaba un dibujo pedido justo antes de pasar a segundo plano. Lo de «con movimiento reducido…» no se llegó a confirmar; desde que espera a que el exterior esté pintado no ha vuelto a fallar.
- `e2e/piso-lab-grande.spec.js`: 11 pruebas con 5.000 libros, en `chromium-390x844` y `webkit-390x844` (las zonas seguras, solo en Chromium): selección, biblioteca hasta el último libro, exponer sin tocar el libro, registrar, cancelar, deshacer y recargar, render en pausa, contexto perdido y devuelto, teclado simulado reduciendo la ventana y zonas seguras por CDP. Última tanda con `piso-lab.spec.js`: 81 pasan y 1 se omite.
- `e2e/piso-lab-video.spec.js`: recorrido continuo; deja el vídeo en `qa-report/test-results/`.
- `e2e/rincon-01-estanteria.spec.js`: sin regresiones en `chromium-390x844`.
- Vitest de `src/features/pisoLab`, `src/features/edificio` y `src/domain`: 437 pasan.

**Emulado, no real**: el segundo plano (se simula `visibilityState`), el teclado (se reduce la ventana), las zonas seguras (CDP, solo Chromium) y la pérdida de contexto (`WEBGL_lose_context`).

**Sin probar**: cualquier móvil físico, Safari y Android reales, y la preview abierta de verdad: está publicada, pero la protección de Vercel no deja comprobarla desde aquí.
