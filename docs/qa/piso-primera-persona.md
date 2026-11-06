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

Sustituye `<PREVIEW>` por la dirección de Vercel.

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

## Pendiente y limitaciones

- **Sin vista propia** (se avisa y lleva a la vista de siempre): compañeros místicos con animación y copias con acabado.
- **Ventanas pintadas de los sets de sagas**: no se ha comprobado su hueco; la vista real solo sustituye a la `ventana` básica.
- **Lámpara de pie**: es simétrica; su giro se guarda y se comprueba en los datos, pero apenas se aprecia a la vista.
- **Estantería**: tu lectura de frente en la balda de la lámpara y lomos reales repartidos con `layoutSpines` (lo que no cabe no se dibuja). Cada libro lleva encima un botón HTML transparente para el dedo y el lector de pantalla. Primer toque: lo elige y lo saca de su sitio; segundo toque o «Abrir ficha»: abre la ficha vigente encima, sin desmontar el interior. En un piso ajeno siguen los lomos de adorno de `furniture.js`.
- **Libro de la mesa**: tocarlo abre el registro de ese ejemplar tras un acercamiento de 280 ms (ninguno con movimiento reducido, teclado o lector de pantalla). Sin lectura, la mesa queda vacía y el botón lleva a la estantería, o a Mi biblioteca si no hay libros. Sin portada, tela con el título repartido. Las guías (`showGuides`) se activan en el rincón: el piloto no tiene su interruptor.
- **Cámara**: sale del sillón real, sentada y mirando hacia donde mira el sillón. Un piso sin sillón usa una vista fija. Si el sillón queda de cara a una pared, se verá la pared.
- **Horizonte por planta**: valores artísticos, no físicos (`PLANTAS` y `ALTURAS`): sube un poco con la planta y los tejados bajan. Solo se ha comprobado a ojo el 1.º A; ningún piso de las plantas 2 y 3 del laboratorio da al hotel.
- **Ventana lateral del 1.º A**: no se alcanza desde el sillón y su exterior no se pinta. Si algún día se puede girar hasta ella, habrá que pintarlo.
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

**Sin probar**: cualquier móvil físico, Safari y Android reales, y la preview, que aún no está publicada.
