# Estado del proyecto y bitácora de sesiones

Documento compartido entre las cuentas que trabajan en BookShelf. **Al empezar**, leerlo entero. **Al terminar**
cada sesión (o cada bloque), actualizar «Estado actual» si cambia y añadir una entrada arriba del todo en la
bitácora. Es lo que permite a la siguiente sesión retomar sin repetir trabajo ni deshacer decisiones.

## Estado actual

- **Versión publicada**: 1.66.0 (2026-11-01), en https://bookshelf-wine-iota.vercel.app
- **Sin commit (1.67.0)**: la tienda del bajo (el antiguo videoclub con su dependienta), sus sobres por tipo y
  misiones con tickets (§67), y las figuras ocultas. Su migración `20261104120000_edificio_tienda.sql` **ya está
  aplicada en producción** (1-11-2026): la versión publicada (1.66) no la usa, así que nada cambia hasta subir la 1.67.
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

Formato de cada entrada (la más reciente arriba):

```
### AAAA-MM-DD · cuenta (nombre corto) · versión
- Qué se hizo y por qué.
- Commits (hash) y si se subió a producción.
- Qué quedó a medias o sin verificar.
- Decisiones nuevas de Francisco que haya que respetar.
```

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
