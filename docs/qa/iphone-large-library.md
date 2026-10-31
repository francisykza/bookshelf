# 1.59.0 · Rendimiento y errores visuales en iPhone con más de 1.000 libros

**Fuente:** el vídeo `VID-20261031-WA0014.mp4`, guardado en este ordenador como
`Descargas/WhatsApp Video 2026-10-31 at 15.03.57.mp4`. Lo he inspeccionado: mide 231,665 s y 384 × 832, igual que
la grabación del encargo. Saqué fotogramas en los tiempos señalados (con Edge, por canvas) y comprobé con ellos los
síntomas. Los FPS del vídeo no se han usado como FPS de la aplicación.

**Entorno de las comprobaciones:** Chromium y WebKit de Playwright en Windows. **Es emulación, no un iPhone.**
Nada de lo de abajo prueba que el rendimiento del iPhone esté resuelto; eso queda pendiente de probarlo en el
dispositivo.

Capturas de los estados corregidos (`docs/qa/iphone-large-library/`):

- **`01`, `02`, `11` · Biblioteca con 1.500 libros:** al abrir y al final del desplazamiento, en WebKit 390 y en
  escritorio. Cada balda está pintada con sus libros.
- **`03` · Portadas estables:** misma geometría con portada, sin ella y con la URL rota.
- **`04` · Vista de lomos con 1.500 libros.**
- **`05` · Figuras expuestas en el perfil de otra persona (WebKit):** se ven con su imagen.
- **`06`, `07` · Habitación de la visita (WebKit 390 y Chromium 320):** «Libros · N» en el mueble, sin tocar
  «Está leyendo…» ni los botones.
- **`08` · Perfil abierto desde la visita:** sin «Abriendo su rincón…».
- **`09` · Aviso «Lectura registrada».**
- **`10` · Registro con el teclado simulado:** panel dentro de la parte visible.

Los fotogramas del vídeo no se copian al repositorio, porque tienen datos de la cuenta de Francisco y de otra persona;
se citan por su tiempo.

## Medir antes de optimizar (FIX 1)

- **Instrumentación:** `src/perf/PerfProfiler.jsx`. Es un React Profiler que solo actúa en desarrollo; suma commits y
  `actualDuration` en `window.__bsPerf`. Envuelve la app, la biblioteca y la ficha.
- **Script:** `scripts/perf-large-library.mjs`. Arranca su propio Vite (puerto 5197) y usa un perfil de Playwright
  aislado.
  - **Datos:** 100, 1.000 y 1.500 libros sintéticos y deterministas. El 60 % lleva portada, el 25 % no lleva y el
    15 % tiene una URL que devuelve 404.
  - **Condiciones, idénticas antes y después:** Chromium 390 × 844 a 2×, CPU ralentizada ×4 por CDP, portadas
    servidas por una ruta local sin cabeceras de caché y el resto de la red externa cortada.
  - **Qué mide:**
    - Consultas y número de peticiones.
    - Commits y tiempo de React.
    - Libros montados.
    - Apertura de la biblioteca y cambios de filtro.
    - Cada tecla de la búsqueda.
    - El desplazamiento hasta el final, a saltos de 600 px.
    - Abrir y cerrar la ficha y el diario.
    - La vuelta a la habitación.
  - **Vista de lomos:** con `PERF_MODE=spine`.
- **Resultados en bruto:** `docs/qa/perf-antes.json`, `docs/qa/perf-despues.json`, `docs/qa/perf-lomos-antes.json` y
  `docs/qa/perf-lomos-despues.json`.
- **Advertencia:** son tiempos del servidor de desarrollo, con React en modo desarrollo y CPU ×4. Sirven para comparar
  entre sí, no como cifras absolutas de un móvil.

### Antes y después (mismas condiciones)

| Medida | 100 antes | 100 después | 1.000 antes | 1.000 después | 1.500 antes | 1.500 después |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arranque hasta la habitación (ms) | 5287 | 4197 | 16756 | 3308 | 37202 | 3256 |
| Libros montados en la habitación | 100 | 0 | 1000 | 0 | 1500 | 0 |
| Portadas pedidas en la habitación | 93 | 0 | 757 | 0 | 1360 | 0 |
| Render de la biblioteca cerrada (ms, Profiler) | 934 | 63 | 4147 | 63 | 5785 | 71 |
| Abrir la biblioteca (ms) | 1558 | 1476 | 11596 | 1273 | 16479 | 1495 |
| Libros montados al abrir | 100 | 100 | 1000 | 39 | 1500 | 39 |
| Portadas pedidas al abrir | 30 | 23 | 300 | 24 | 450 | 24 |
| Filtro «Leídos» (ms) | 228 | 222 | 1655 | 296 | 3393 | 309 |
| Volver a «Todos» (ms) | 625 | 522 | 4151 | 710 | 8620 | 734 |
| Tecla en la búsqueda, media (ms) | 211 | 166 | 1168 | 152 | 2191 | 160 |
| Tecla en la búsqueda, máx. (ms) | 403 | 221 | 2659 | 218 | 6917 | 226 |
| Desplazamiento: peor fotograma (ms) | 136 | 181 | 2647 | 474 | 4756 | 494 |
| Desplazamiento hasta el final (ms) | 489 | 860 | 94325 | 22407 | 268312 | 36115 |
| Libros montados al final | 100 | 100 | 1000 | 46 | 1500 | 45 |
| Abrir ficha (ms) | 714 | 805 | 8875 | 575 | 6794 | 651 |
| Abrir «Diario» de la ficha (ms) | 216 | 203 | 2677 | 215 | 2105 | 226 |
| Cerrar ficha (ms) | 544 | 516 | 6061 | 384 | 8596 | 396 |
| Volver a la habitación (ms) | 1525 | 1223 | 12507 | 963 | 43057 | 995 |
| Peticiones de portadas válidas (total) | 216 | 140 | 1586 | 179 | 3005 | 230 |
| Peticiones a URL rotas (total; hay 15, 150 y 225 URL rotas) | 126 | 15 | 2157 | 24 | 4092 | 36 |

| Vista de lomos, 1.500 libros | Antes | Después |
| --- | ---: | ---: |
| Abrir la biblioteca (ms) | 6749 | 1629 |
| Libros montados al abrir | 1500 | 114 |
| Filtro «Leídos» (ms) | 1221 | 159 |
| Volver a «Todos» (ms) | 3946 | 849 |
| Tecla en la búsqueda, media (ms) | 1511 | 178 |
| Tecla en la búsqueda, máx. (ms) | 2099 | 209 |
| Abrir ficha (ms) | 837 | 621 |
| Cerrar ficha (ms) | 490 | 436 |
| Volver a la habitación (ms) | 3482 | 1055 |

**Cómo leer la tabla:**

- **Antes**, la biblioteca montaba **todos** los libros desde el arranque, aunque estuviera cerrada en la habitación,
  y pedía casi todas sus portadas. Cada libro pedía su portada dos veces: la imagen y el fondo CSS del lomo. Las URL
  rotas se volvían a pedir en cada remontaje: 4.092 peticiones para 225 URL.
- **Después**, la biblioteca cerrada no monta nada. Abierta, monta unos 40 libros (39–46 en las medidas). Cada URL
  rota se pide **una sola vez**.
- **Peticiones de portadas válidas:** las cifras incluyen la del `<img>` después de la carga de comprobación, porque
  la ruta de la prueba no envía cabeceras de caché; Open Library sí las envía. No son segundas descargas de verdad.
- **Con 100 libros** no se virtualiza. Casi todo queda igual o mejor, con dos regresiones pequeñas en esta prueba de
  estrés:
  - El desplazamiento a saltos de 600 px por fotograma: peor fotograma de 181 ms frente a 136, y 860 ms frente a 489
    en total. Es el coste de que cada portada espere a acercarse y se pida una sola vez, en vez de `loading="lazy"`.
  - Abrir la ficha: 805 ms frente a 714.

  Las dos cifras son de modo desarrollo con CPU ×4.
- **Búsqueda:** se aplica un paso por detrás de lo escrito (`useDeferredValue`), y las baldas están memorizadas en un
  único `useMemo`. Al escribir, la tecla se pinta sin esperar a montar los libros que coinciden. Es la única
  memoización añadida, y la justifica la medición: sin ella, una búsqueda con 1.500 libros tardaba 0,6 s por tecla.
- **Medición intermedia descartada:** escribir variables de estilo en `:root` al abrir cualquier panel encarecía abrir
  la ficha en un 30 %. Ahora se escriben solo en el velo del registro.

## Causas comprobadas y cambios

### FIX 2 · Estantería incompleta y coste de renderizado (00:48–00:54)

En los fotogramas de 00:48–00:54, al desplazarse rápido aparecen bloques marrones con solo las líneas de las baldas.
Ese marrón es el fondo de `.library__shelves` (`#3d2817`): **la GPU no llegaba a pintar las filas**.

**Causas comprobadas:**

1. **`ShelfView` montaba todos los libros siempre**, también con la biblioteca cerrada (solo se ocultaba con
   `visibility`). Con 1.500 libros, el render de la biblioteca cerrada costaba 5,8 s (Profiler).
2. **Cada libro del escaparate es un objeto 3D:**
   - `preserve-3d`.
   - Portada con `translateZ(0)`.
   - Lomo y canto girados.
   - Grano con `mix-blend-mode`.

   Con todos montados había varias capas gráficas por libro. Es el patrón con el que WebKit en iOS deja zonas sin
   pintar cuando se queda sin memoria de capas. Desde aquí no puedo medir la memoria de la GPU de un iPhone: es la
   causa coherente con el síntoma, no una medición del dispositivo.
3. **La altura de las filas dependía de las imágenes:** la portada tenía `height: auto`.

No había virtualización (ni defectuosa ni de ningún tipo), ni altura colapsada de la balda.

**Cambios** (`ShelfView.jsx`, `perf-159.css`):

- **Biblioteca cerrada:** no monta ningún libro.
- **Escaparate con filas virtuales**, a partir de 25 filas por balda (≈ 72 libros en móvil):
  - Monta las filas que están a 1,25 pantallas de la vista y las dos primeras de cada balda, que sirven para medir.
  - Las demás son la misma balda pintada, vacía y con su alto exacto (`.lib-shelf--ghost`). No queda ningún hueco
    sin pintar.
  - Cada hueco de libro mide 2:3 de su columna, así que el alto de una fila no depende de ninguna imagen.
- **Vista de lomos virtual en horizontal**, a partir de 120 lomos:
  - El ancho sale de las páginas y de la edición (`spineW`).
  - Los lomos no montados se sustituyen por dos huecos con su ancho exacto, y la barra de desplazamiento no cambia.
- **Se conservan:**
  - Baldas, filtros, orden y arrastrar y soltar.
  - El encabezado con la cantidad real.
  - Los nombres accesibles: cada libro montado conserva el suyo y, con el tabulador, el siguiente ya está montado
    gracias al margen.
  - La posición al volver de una ficha y al volver a entrar desde la habitación.
- **El dado** lleva a la vista un libro que aún no esté montado.
- **No se ha añadido memoización.** El seguimiento del desplazamiento solo provoca renders cuando alguna balda es
  virtual.

**Aceptación** (`e2e/v159.spec.js`, en Chromium 390, WebKit 390 y escritorio):

- Con la biblioteca cerrada hay 0 libros montados y 0 portadas pedidas.
- Al abrir, menos de 160 libros montados.
- Hasta el final, ningún paso del desplazamiento muestra una balda vacía en el centro de la vista, y nunca hay más de
  200 libros montados.
- El último libro de «Abandonados» está montado al final.
- En la vista de lomos: menos de 400 montados y sin huecos hasta el último lomo de «Leídos», que queda pegado al final
  de la pista.

### FIX 3 · Portadas estables y carga controlada (03:23–03:26)

En el panel «Libros compartidos», las tarjetas salían primero aplastadas, solo con el título y una raya, y crecían al
llegar la imagen.

**Causa:** la portada (`<img>` con `height: auto` y sin proporción reservada) medía 0 de alto hasta descargarse.
Además:

- El lomo pedía la portada como fondo CSS, sin carga diferida.
- El color del lomo volvía a descargar cada portada visible con CORS.
- Una URL rota se repetía en cada remontaje.

**Cambios** (`BookItem.jsx`):

- **La portada reserva 2:3 siempre:** es completa, sin estirar, con `object-fit: contain` sobre el color de su lomo.
- **Mientras llega**, se ve la tapa lisa de ese color (`.cover-img--wait`). Si falla o tarda más de 6 s, se ve la
  cubierta tipográfica de siempre. Las dos tienen la misma geometría.
- **Una sola descarga por URL en la sesión** (`watchCover`, fuera del ciclo de vida de React):
  - Desmontar el libro no cancela ni repite la petición.
  - Lo que ya llegó se pinta al momento al volver a montarse.
  - Lo que falló no se vuelve a pedir.
- **Cada portada se pide al acercarse a menos de una pantalla de su contenedor con desplazamiento**, que se mide como
  raíz del IntersectionObserver. `loading="lazy"` medía contra la ventana y no adelantaba nada dentro de las baldas.
  Las visibles van primero, y abrir la biblioteca no pide todas.
- **El lomo** repite la portada solo cuando ya llegó, desde la caché.
- **El color calculado a partir de la portada** solo se usa en la vista de lomos; en el escaparate no se ve.

**Aceptación:**

- Antes y después de llegar las imágenes:
  - Cada fila mide lo mismo.
  - Cada portada tiene la misma proporción, con portada, sin ella y con la URL rota.
- Al abrir, no se piden más portadas que libros montados.
- Ninguna URL rota se pide dos veces.

### FIX 4 · Figuras definitivas que aparecían vacías (03:40–03:44)

En el perfil de Master se veían los nombres de La Dama de la Ceniza y de La Jinete de Dragones, pero no sus imágenes.

**Causa comprobada:**

- El catálogo, las URL y los archivos están bien: `dama-ceniza-box.jpg` y `jinete-dragones-box.jpg` existen y se
  sirven.
- El fallo es de maquetación: dentro de `.huella-figures li` (centrado, sin ancho propio), la caja de la figura tenía
  el 100 % de alto y proporción, pero **ningún ancho definido**, y **WebKit la resolvía con ancho 0**. La imagen nunca
  se dibujaba y el `loading="lazy"` de una caja de ancho 0 no llegaba a cargarla.
- **Reproducido:** con la corrección quitada, la prueba falla en WebKit 390 y pasa en Chromium 390.

**Cambios:**

- La caja de cada figura del perfil tiene un ancho del 100 % y un alto de 88 px.
- Si la imagen de una figura falla, se ve su silueta de papel con un ornamento (`.crop-img[data-failed]`), no un
  hueco.
- No vuelve ninguna figura SVG retirada.

**Aceptación:** `e2e-community/v159.spec.js`. Las dos figuras se ven con la imagen descargada y una caja de más de
30 × 60 px, en Chromium, WebKit y escritorio.

### FIX 5 · Sincronización segura con más de 1.000 libros

**Comprobado:**

- **El límite de filas por respuesta de Supabase no corta la biblioteca:** es **un documento JSON por cuenta**
  (`libraries.data`, una fila). Con 1.500 libros sintéticos ocupa 795 kB, y `JSON.stringify` tarda 3–4 ms con CPU ×4.
- **No hay paginación posible ni resultados parciales por páginas.**
- **Búsquedas y filtros** se hacen en local sobre la colección entera; se comprueba con «1499» y con el filtro
  «Leídos».

**Cambios** (`cloud.js`, `cloudSync.jsx`):

- **Solo la fecha primero:** al volver a la app, al recuperar la conexión o al iniciar sesión se pide antes solo
  `updated_at`. El documento entero (cientos de kB) se baja **únicamente si otro dispositivo guardó algo**; antes se
  bajaba siempre.
- **Copias sin lista de libros:** se **rechazan**. Antes, `hydrate` habría puesto los libros de ejemplo en lugar de
  una biblioteca incompleta.
- **Ediciones durante la descarga:** un cambio local hecho mientras se descargaba (aún sin marcar como pendiente)
  cuenta como cambio. Se pregunta cuál quedarse y nunca se pisa en silencio.

**Lo que no cambia:**

- Las subidas siguen agrupadas, 3 s después del último cambio, y nunca se hacen por render ni por pulsación.
- Cambiar un libro sigue subiendo el documento entero. Esa escritura es atómica y con control de versión
  (`updated_at`), así que nunca pisa lo de otro dispositivo; si se ha adelantado, se pregunta.

**Propuesta, no hecha:** subir solo lo que cambió exigiría pasar a una fila por libro, con una migración de Supabase
y RLS que aplicaría Francisco. Queda como propuesta en Pendiente.

**Verificación:** toda la suite de comunidad con el simulador, que incluye cuentas, cambio de cuenta y copias. No se
ha tocado la cuenta real.

### FIX 6 · Transición social sin pantalla oscura (03:06–03:07)

En el fotograma de 03:07, entre la comunidad y la casa, la pantalla se ve oscura entera.

**Causa:** al abrir la visita, el velo (`#2c1e14`) y el fondo de la escena tapaban todo **antes** de que la casa
estuviera decodificada. Además, el código de la visita se cargaba al tocar el botón, mostrando el fondo oscuro de
espera. El vídeo se mostraba en cuanto se emitía `playing`, que en iOS puede llegar antes del primer fotograma.

**Cambios** (`ReaderVisit.jsx`, `visitScene.js`, `perf-159.css`):

- **Hasta que la primera imagen esté decodificada**:
  - La visita **no tapa la escena anterior**: el velo y su fondo son transparentes, y la escena está a opacidad 0.
  - La espera dura como mucho 1,5 s y nunca es indefinida.
  - Después, un fundido de 180 ms; sin fundido con movimiento reducido.
- **Al tocar «Visitar rincón»** se adelantan el código y la casa ya decodificada.
- **El vídeo** lleva la casa como `poster`. Se muestra con su primer fotograma ya presentado
  (`requestVideoFrameCallback`) y, si el navegador no lo tiene, con `playing`.
- **Se mantiene todo lo de la 1.58.1:**
  - Sin franjas.
  - Sin selector de animación ni «Saltar».
  - La flecha de volver, desde el primer momento.
  - Ante un error o con movimiento reducido, entrada directa a la habitación.
  - Al salir se liberan el vídeo, los escuchadores y los temporizadores.

**Aceptación:**

- Con la casa retenida, la visita está montada sin `data-shown`, con el velo y su fondo transparentes, la escena a
  opacidad 0 y la flecha visible. Al soltarla, se muestra.
- `v158` (los 7 recorridos de la visita) sigue pasando.

### FIX 7 · Aviso de lectura con caducidad real (02:19 y 02:51–02:54)

**Causa:** el aviso solo se montaba sin panel abierto (`{!panel && <LogUndoToast/>}`), y sus 8 s los contaba un
temporizador interno. Al abrir otro panel se desmontaba; al cerrarlo, volvía a aparecer con 8 s nuevos.

**Cambio:**

- La caducidad la lleva `App` con la hora del registro (`at`); el aviso solo se pinta y nunca después de caducar.
- No había eventos ni guardados duplicados: hay un solo `onSaved` por guardado. La prueba lo comprueba (+1 registro).

**Aceptación:** registrar, abrir el portátil (el aviso queda oculto), esperar 8,5 s y cerrar: el aviso no reaparece.

### FIX 8 · Modal con teclado y área segura (02:12–02:16)

**Causa:** con el teclado de iOS abierto, la parte visible de la pantalla (`visualViewport`) es más baja y se desplaza.
El velo seguía a la ventana entera, y el código del registro colocaba el campo con `scrollIntoView`, que desplazaba
**la página**. Por eso el título del registro acababa bajo la barra de estado.

**Cambios:**

- `PanelShell` publica `--vv-top` y `--vv-h` a partir de `visualViewport`.
- El velo del registro ocupa esa parte visible, con su área segura.
- El panel cabe dentro y se desplaza por dentro.
- El campo se coloca moviendo el panel, no la página.
- No hay medidas fijas de ningún móvil.

**Aceptación:**

- Con un `visualViewport` simulado (430 px visibles, 120 px desplazado):
  - El velo ocupa esa franja.
  - El panel, su título y el cierre empiezan dentro de ella.
  - El campo está a la vista.
- Al cerrar el teclado, el velo vuelve a ocupar la pantalla entera.

**Limitación:** el teclado se simula. El comportamiento del teclado real de iOS solo se puede confirmar en el iPhone.

### FIX 9 · Perfil social y elementos superpuestos (03:04, 03:19–03:22, 03:35–03:38)

**03:04, lector genérico:** «Lectores que sigo» mostraba «Lector» hasta que llegaban los nombres, que además
esperaban a la actividad, porque se pedían en serie.

- Ahora los nombres se piden **en paralelo** con la actividad y salen en cuanto llegan. De los autores solo se piden
  los que faltan, porque los perfiles van en caché.
- Mientras tanto, un trazo de papel con «Cargando su nombre…» para lectores de pantalla.
- Un perfil que no está disponible lo dice.
- «Cargando su actividad…», el vacío («Nada nuevo por aquí») y el error se distinguen.

**03:19–03:22, «Libros · 8» bajo «Está leyendo…»:** la etiqueta iba al pie del mueble, justo donde flota el pie de
la habitación. Ahora va en mitad del mueble. La prueba comprueba que no se cruza con «Está leyendo…» ni con los
botones del pie a 320, 390 y 430 px, en Chromium y WebKit.

**03:35–03:38, perfil por fases:** el perfil volvía a lanzar las siete consultas que la visita acababa de hacer, y
cargaba su escena y su avatar desde cero.

- Ahora el rincón cargado se reutiliza durante un minuto (`useReaderCorner`, solo en memoria; «Reintentar» y
  bloquear lo descartan).
- La visita adelanta la escena y el avatar del perfil.
- La prueba comprueba que no hay ni una consulta a su rincón y que no aparece «Abriendo su rincón…».

**Baldas de la visita:** representan los libros que esa persona comparte (un lomo por libro compartido, como en la
1.58.1). No se inventan libros ni se muestran datos privados; la prueba `v158` lo cubre.

## Validación

- **`npm run qa:full`:** se **paró a petición de Francisco** («si no es necesario termina la qa full»), con 666 pruebas
  de Playwright superadas y 2 fallidas.
  - Vitest: 273 de 273.
  - Las dos que fallaron eran la misma: `e2e/v128` «librería… busca con o sin tildes», en `chromium-844x390` y en
    `webkit-390x844`. La prueba contaba los libros en cuanto aparecía el buscado, sin esperar a que se aplicara el filtro,
    que ahora va un paso por detrás de lo escrito (`useDeferredValue`). La app filtraba bien. Ajustada con
    `expect.poll` y comprobada en cuatro proyectos.
  - **No se ocultó ni se desactivó ninguna comprobación.**
- **Lo que el `qa:full` parado no llegó a cubrir** se ejecutó aparte, en `webkit-844x390` y
  `chromium-390x844-reduced`: v128, v134, v135, v146, v147, v154, v156 y v159. Resultado: 72 de 72.
- **`e2e/v159.spec.js`:** pasa entera en Chromium 390, WebKit 390 y escritorio.
- **Comunidad completa** (`playwright.community.config.js`): 104 pasan y 21 se omiten por proyecto. Ninguna falla.
- **`npm run build`:** correcto.
- **`v149` en WebKit** (límite conocido del WebKit de Windows con `matrix3d`) no llegó a ejecutarse en el tramo
  parado.

**Telemetría** (`qa-report/qa-telemetry.json`, analizada con `scripts/analyze-telemetry.py`, Python): 81 ejecuciones y
24 estados auditados.

- `overflowElements`: 0.
- `backgroundCheck`: 0 estados sin pintar.
- `brokenOrUncroppedAssets`: 0.
- `consoleErrors`: 0. Errores de página y de consola en toda la QA: 0.
- `overlappingInteractive`: 3 estados, todos anteriores a la 1.59 e intencionados:
  - Los lomos de la habitación bajo el hotspot de la balda: los dos abren la biblioteca.
  - Las flechas de desplazamiento sobre el primer y el último lomo visibles de una fila.
  - Dos hotspots de la habitación que se rozan.

Los estados de WebKit 390 del juego principal no entraron en la telemetría (se ejecutaron antes de vaciarla). Sus
pruebas pasan.

## Limitaciones y pendientes

- **Nada de esto se ha comprobado en un iPhone real.** WebKit de Playwright en Windows no es Safari en iOS. En
  particular, la falta de pintado por memoria de capas solo se puede confirmar en el dispositivo: grabar de nuevo el
  desplazamiento rápido con más de 1.000 libros.
- **Las cifras de rendimiento** son del servidor de desarrollo con CPU ×4. En producción y en el dispositivo serán
  otras; la comparación vale porque las condiciones son iguales.
- **La biblioteca en la nube** sigue siendo un documento: cada cambio sube el documento entero (≈ 800 kB con 1.500
  libros), con control de versión. Pasar a una fila por libro es una propuesta, pendiente de decidir con Francisco.
- **`localStorage`** guarda la biblioteca completa (≈ 800 kB con 1.500 libros, dentro del límite habitual de 5 MB).
  No se ha tocado.
