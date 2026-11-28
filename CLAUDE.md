# BookShelf · guía para trabajar en el proyecto

Este archivo lo lee Claude Code al empezar cada sesión en esta carpeta. Lo comparten **dos cuentas de Claude** que
trabajan por turnos en este mismo ordenador y en esta misma carpeta, sin ver la conversación de la otra. Todo lo que
una cuenta sepa, decida o deje a medias solo llega a la otra a través de este archivo, `docs/ESTADO.md` y git.
La especificación completa está en `SPEC.md` (una sección por versión; la cabecera dice la versión vigente).

## 0. Traspaso entre cuentas (obligatorio, sin que Francisco tenga que pedirlo)

**Al empezar una sesión**, antes del primer cambio:
1. Leer `docs/ESTADO.md` entero (estado, pendientes y la bitácora, la entrada más reciente arriba).
2. Ejecutar `git log --oneline -15` y `git status`. Si hay commits posteriores a la última entrada de la bitácora,
   o cambios sin commit, los hizo la otra cuenta: revisarlos (`git show`, `git diff`) y no deshacerlos.
3. Si Francisco empieza con un encargo, hacerlo; si hay algo a medias de la otra cuenta que le afecte, decírselo.

**En cada commit** (cuando Francisco lo pida):
1. Añadir en `docs/ESTADO.md` una entrada arriba de la bitácora con el formato de ese documento (fecha, cuenta,
   versión, qué se hizo, qué queda a medias o sin verificar, decisiones nuevas de Francisco) y actualizar «Estado
   actual» y «Pendiente».
2. Incluir `docs/ESTADO.md` (y `CLAUDE.md` si cambió) **en ese mismo commit**. El hash no hace falta escribirlo:
   ya está en `git log`.

**Reglas nuevas**: si Francisco da una instrucción que deba valer más allá de la tarea («a partir de ahora…»,
«nunca…», «siempre…», una preferencia de diseño o de trabajo), escribirla en el apartado que toque de este archivo
en ese momento, aunque no haya commit todavía. Lo que no esté aquí, la otra cuenta no lo sabe.

**Sesión sin commit**: si se trabaja y Francisco no pide commit, antes de terminar anotar igualmente en la bitácora
lo que queda sin commit y por qué (el archivo se queda en disco y la otra cuenta lo leerá).

**Nunca a la vez**: si al empezar hay cambios sin commit que no están descritos en la bitácora, preguntar a
Francisco antes de tocarlos (puede que la otra cuenta esté trabajando en ese momento).

## 1. Reglas de trabajo (las pone Francisco, el dueño del proyecto)

- **Revisión por evidencias, sin entrar en previews** (8-11-2026). Cada entrega incluye: recorridos reales de la interfaz
  grabados en vídeo con los cambios terminados; capturas comparables si hay cambios visuales; las comprobaciones
  relevantes con sus fallos y limitaciones; y la versión o commit al que corresponden las evidencias.
  **Las evidencias se envían al chat** (Francisco, 12-11-2026: «Cuando hagas cambios pasame las evidencias para que yo pueda
  verlas en el chat»): al terminar cada cambio, mandar los vídeos y las capturas principales como archivos en la conversación
  (no basta con decir la carpeta de `qa-report/`).
  **Antes de fusionar con `main`, esperar su aprobación de esa entrega concreta.** Al aprobarla: commit si falta, fusionar
  con `main` y comprobar el despliegue de producción. Si hay cambios posteriores a lo revisado, indicarlos y volver a
  validar lo afectado. Aprobar este flujo no aprueba ninguna versión.
- **Todo en español**: respuestas, resúmenes, botones, mensajes de commit y comentarios de código. **Nunca en inglés**,
  ni una frase suelta ni en el cuadro final (Francisco lo recordó el 2-11-2026).
- **Commits y subidas, solo cuando se pidan** («haz el commit», «súbelo»). Subir `main` **despliega en producción**
  (Vercel). Nunca forzar el push ni reescribir historia publicada.
- **Sin líneas `Co-Authored-By`** ni firmas de IA en commits ni PR.
- **El nombre es Libotown** (Francisco, 15-11-2026; «BookShelf» era provisional). Se escribe «Libotown», sin subtítulo (confirmado el mismo día: las minúsculas son solo del dominio, `libotown.es`, y del logo). El
  icono lo da él: no inventarlo (los iconos salen de su material con `scripts/libotown-iconos.mjs`, §136.5). Lo interno sigue con «bookshelf» (`bookshelf:v1` y demás claves, `bookshelf:auth`, el
  IndexedDB, las cachés `bookshelf-`, `assets/bookshelf/`, `package.json`, el repositorio, Vercel y Supabase) y no se renombra
  sin una migración pensada y aprobada por él. Dominio: **libotown.es** (registrado en IONOS; Francisco, 15-11-2026). **Desde la
  1.136.1** (Francisco, «Hazlo ya») la dirección de antes redirige a libotown.es (308, todo menos `/sw.js`, que allí se despide;
  SPEC §136.7). Las direcciones de producción están en `src/domain/direcciones.js`.
- **Pantallas de carga, siempre la escena de Libotown** (Francisco, 15-11-2026: «cambia las pantallas de carga de la app para
  que utilicen la nueva escena de libotown y que como mucho cambie el mensaje de adonde te redirijen»): toda pantalla de carga
  de la app (al abrirla, al entrar en el piso, el edificio, el hotel y sus salas, el café…) es la misma escena que la del
  arranque (§136.5): el logo de Libotown sobre el marrón `#351c0e`, en el mismo sitio y tamaño. **Lo único que cambia es el
  mensaje**, que dice adónde vas. No volver a pantallas de carga propias de cada sitio (fondos, dibujos, barras o colores
  distintos).
- **Supabase**: nunca exponer claves de servicio ni secretas; no desactivar RLS. Las migraciones nuevas van en
  `supabase/migrations/` y **las aplica Francisco** en el SQL Editor. Desde el 1-11-2026, si él lo pide («hazlo tú»):
  abrir el SQL Editor del proyecto en el panel del navegador (él inicia sesión), pegar la migración comprobando su
  SHA-256 con el archivo, y que él pulse «Run» (el control de permisos no deja ejecutar en producción desde aquí);
  después, comprobarlo con la clave pública (las tablas nuevas deben dar «permission denied» al anónimo, no «not found»).
- **No manejar contraseñas** ni iniciar sesión en cuentas.
- **No borrar datos del usuario.** Al probar en el navegador, usar perfiles de prueba (Playwright con su propio
  `localStorage`), no sus datos reales. Si algo no cuadra con lo esperado, puede ser que él esté usando la app:
  no «arreglar» sus datos.
- **No cambiar** la paleta del Ático ni las reglas de recompensas, piezas, cajas y pity.
- **Figuras ocultas desde la 1.67** (decisión de Francisco del 1-11-2026, «Ocultarlas, sin borrar»): las figuras, el
  Ático, las Cajas Sorpresa, el Guardián y sus sellos no se ven en la app (`FIGURES_ENABLED = false` en
  `src/domain/figures.js`) mientras él decide cómo integrarlas; su lugar lo ocupan los tickets y la tienda del bajo.
  No se borra ningún dato de figuras. No volver a mostrarlas sin que lo pida.
- **Figuras SVG provisionales retiradas** (1.58.1, decisión de Francisco): el Pequeño Viajero, el Bardo del Viento y la
  Hechicera de Eea no deben volver como coleccionables ni sustituirse por otro marcador. Las cuentas antiguas conservan
  su inventario; se filtran con `RETIRED_FIGURES` (`src/domain/figures.js`).
- **Comunidad en el cuaderno de cuero** (1.60, decisión de Francisco): el panel de la comunidad usa el cuaderno con
  anillas (`NotebookShell`) y pestañas de papel en todas sus hojas, según sus maquetas; no volver a la tarjeta lisa. Se
  conserva «Visitar» (desde el 9-11-2026 abre el piso del lector). Una maqueta con una figura retirada no la recupera.
  **Desde la 1.62 (decisión de Francisco, paquete `material-diseno/social-radio/`)**: tres pestañas principales,
  Lectores / Salón / Clubes, visibles a 360 px sin desplazamiento; Perfil y Mi rincón se abren desde el avatar propio
  (no se pierde ninguna función). Sustituye a «se conservan las cinco pestañas» de la 1.60.
- **Visita social** (decisión de Francisco del 9-11-2026; sustituye a la fachada y al vídeo de la 1.62): «Visitar» abre directamente el piso actual del lector (`VisitaLector` → `VisitaPiso`). El rincón heredado, su vídeo y sus recursos están retirados: no volver a enlazarlos. Se puede ver el piso de los vecinos y de quien sigues (`piso_visita`, migración `20261119120000_piso_visita.sql`, la aplica Francisco), con comunidad activa y sin bloqueo. Volver lleva al origen: Comunidad, salón o edificio. **La biblioteca del visitante** enseña solo lo que el lector tiene expuesto en el mueble y lo que decide compartir (9-11-2026; `piso_expuestos`, migración `20261121120000_piso_expuestos.sql`), en solo lectura.
- **Tablón libre** (paquete «Tablón v2», 9-11-2026): composiciones libres de notas, libros y citas, privadas por defecto. **El tablón va montado en el escritorio del ordenador**, por encima del monitor, y se mueve con él (decisión de Francisco del 9-11-2026, «para que no se pierda»): ya no es un mueble que se coloque aparte, y se pulsa por separado del monitor. Con relieve y con su contenido nítido, no con la resolución baja de la escena. **El ordenador no abre el tablón** (no es una app suya; decisión de Francisco del 9-11-2026): se entra tocando el tablón, o desde «Tablón» en el Menú del piso. Tocarlo abre primero una **vista para mirar** (propia o de un visitante, como los libros de la estantería) y un botón discreto «Diseñar» pasa a editar, solo para el dueño. Las notas son objetos distintos entre sí (adhesiva, hoja rayada, ficha, cita mecanografiada, libro, correo). Monitor y tablón son objetos independientes: lo decide lo primero que se ve bajo el dedo, y la mesa, la pared o el hueco no abren ninguno. Lo público es una copia aparte, publicada con vista previa. Los post-its (texto plano ≤ 200, uno al día por remitente y destinatario en UTC) sustituyen al libro de visitas, que queda como archivo privado, y son, junto con los dibujos, la **única excepción a «sin texto libre»** entre vecinos; exponer uno exige permiso de quien lo escribió. Regalar no cambia. **Dibujos** (decisión de Francisco del 9-11-2026, levanta el veto al dibujo libre): quien visita puede dejar un dibujo en vez del post-it (comparten el cupo de uno al día) y el dueño puede dibujar en su tablón. Se guardan como trazos validados, nunca como imagen, con paleta cerrada y solo Deshacer y Empezar de nuevo. Se deja **la hoja o la forma** recortada: elige quien dibuja y el dueño puede cambiarlo al clavarlo. Mismas reglas que un post-it: solo lo ve quien lo recibe hasta clavarlo, exponerlo exige permiso de quien lo dibujó, y se puede retirar, denunciar y bloquear. Sin relleno, pinceles, capas, colores libres ni importar imágenes. No añadir fotos, colaboración en directo ni adornos de pago.
- **Paquete `material-diseno/social-radio/`** (1.62): se implementa por bloques, enseñando capturas al terminar cada uno
  antes de seguir (decisión de Francisco). Orden: 1) comunidad y tarjetas públicas, 2) asientos del salón y visita,
  3) radio y continuidad en el EPUB, 4) clubes.
- **Minijuego «La librería del puerto»** (prototipo, decisiones de Francisco del 31-10-2026):
  - Se entra desde una 7.ª app del ordenador.
  - Sin encargos: los libros no se distinguen.
  - Estrellas por movimientos: terminar, mínimo + 2, y mínimo sin pistas.
  - El ranking usa un nivel generado cada semana; el mes suma las semanas; en caso de empate gana quien llegó antes.
  - Distinción en el perfil para el top 3 semanal y el mensual.
  - Nada pasa a la app ni a Supabase sin su aprobación (plan en `docs/qa/libreria-puerto.md` §9).
- **Prototipo «El edificio del puerto»** (decisiones de Francisco del 1-11-2026):
  - Tu piso es una habitación isométrica que se decora y está en un edificio de 3 plantas × 2 pisos.
  - **No sustituye** al rincón ilustrado ni a su visita.
  - Visitas en diferido; el directo, más adelante.
  - Reparto en edificios **al azar** (confirmado el 1-11-2026):
    - Solo entran los perfiles con la comunidad activada.
    - Se llenan primero los edificios con hueco y la puerta se elige al azar.
    - Lo decide el servidor.
  - **Entrada en la app:** la tablet del Salón pregunta entre «Comunidad» (lo de antes) y «El edificio del puerto»; no se
    quita nada.
  - Catálogo gratis: no toca recompensas, cajas ni pity.
  - Sin texto libre: solo sellos de frase cerrada.
  - Otros cambios en a qué lleva la tablet del Salón Social necesitan su aprobación.
  - Del vídeo de referencia se toma el género, nunca su arte.
  - **Más personalidad** (encargo del 1-11-2026, por bloques con capturas entre uno y otro: 1) fachada que se vea como
    un edificio de verdad, 2) piso y personalización más integrados, con un catálogo lo más intuitivo y orgánico
    posible, 3) sets de sagas). **Sets de sagas**: nombre propio y un guiño («Para quien leyó …»); muebles originales
    que evocan la saga, nunca portadas, logos ni diseños oficiales. Primera tanda: Alas de sangre, Mistborn, El nombre
    del viento, Una corte de rosas y espinas y El archivo de las tormentas.
  - **Fachada** (1-11-2026): según una foto de un edificio clásico mostaza que pasó Francisco (estilo, no copia). En
    la azotea, el cartel «AQUÍ NO HAY QUIEN LEA» (guiño a «Aquí no hay quien viva»), con letra propia de píxeles:
    nunca el logotipo de la serie. Por las ventanas, siluetas de frente (`windowView.js`); al tocar una, la vista se
    asoma y entras.
  - **Controles del piso en el mismo pixel art** (1-11-2026, a Francisco las píldoras HTML le desentonaban):
    - marcos de píxel e iconos propios (`pixelUi.js`);
    - telón tramado dentro del dibujo;
    - «Decorar» y la luz en las esquinas de la habitación, y las herramientas flotando junto al mueble;
    - el catálogo es una balda de madera de la que se arrastran los muebles.
    - No volver a botones redondeados sueltos alrededor del piso.
  - **Pantalla completa** (2-11-2026, «que la app ocupe toda la pantalla sin dejar un borde encima»): en el móvil, el
    edificio (portal, piso, tienda) llena la pantalla hasta arriba, con su color bajo la barra de estado; nada de hojas
    con un hueco encima.
  - **Portal sin carteles** (2-11-2026): sin el título «El edificio del puerto» ni «Tu puerta… Toca una puerta para
    entrar» (queda solo para lectores de pantalla), y sin la tarjeta «Tu buzón»: el correo (sellos, regalos y firmas)
    es un **buzón dibujado junto al portal** del que asoma una carta con el número; al tocarlo, una nota de papel.
  - **Cuenta del fundador** (2-11-2026): la cuenta de Francisco tiene muchos más tickets y los místicos para probar,
    con el script `supabase/scripts/cuenta_fundador.sql` (a mano, solo su cuenta). Es la única excepción a «los
    tickets solo se ganan leyendo»; no se extiende a nadie más sin que lo pida.
  - **Regalo a la pareja de Francisco** (3-11-2026, lo pidió él: le ayuda a probar en iPhone): 200 tickets y un
    compañero legendario, el dragoncillo de escamas rojas, una sola vez. Se dio a mano en el SQL Editor con un script
    fuera del repositorio (el correo nunca va a git). Es una excepción puntual: no se repite ni se amplía a nadie más
    sin que Francisco lo pida.
  - **Vista «dentro de la habitación» por defecto** (1-11-2026):
    - el piso, a pantalla completa, con la balda (o los sellos) abajo;
    - se puede cambiar a la vista de ficha y queda recordado en el dispositivo.
  - **Sets de sagas en la balda** (1.64, §64): pestaña «Sagas» con un set cada vez (`SETS` en `catalog.js`). Cada
    mueble nuevo del catálogo necesita su fila en `piso_catalogo` con una migración nueva (la prueba de paridad lo
    exige); la de las sagas es `20261102120000_edificio_sagas.sql` y la aplica Francisco.
  - **Economía de muebles** (aprobada el 1-11-2026, «Sí a todo»; plan y fases en `docs/qa/economia-muebles.md`):
    - inventario con copias;
    - tickets, una moneda aparte de las Cajas de figuras, que solo se ganan leyendo (nunca con dinero);
    - tienda, rarezas que se animan al tocarlas y sorteo con probabilidades visibles y pity;
    - sagas que se desbloquean al terminar su libro;
    - primero regalar y cambiar entre vecinos, y el mercado abierto solo después.
    - Lo colocado hoy pasa a ser de cada uno. Inventario y tickets, en el servidor.
    - Se hace por fases, con capturas entre una y otra. Hasta que cada fase esté hecha sigue valiendo «catálogo gratis».
  - **Sobres de la tienda** (1.67, «tipo gacha», decisión de Francisco del 1-11-2026): sobres de 1 y de 5 (el de 5
    con al menos un poco común), probabilidades visibles, pity y sorteo en el servidor. Animaciones con emoción pero
    honestas: sin falsos «casi», sin cuentas atrás, sin presión para seguir abriendo; con movimiento reducido, directo
    al resultado. Las misiones semanales pagan en tickets.
    **Sobres por tipo y temporada** (mismo día): cada sobre trae un grupo de muebles y hay sobres más caros con más
    probabilidad de lo mejor (`piso_sobre` en la migración y `SOBRES` en `economy.js`, siempre iguales). Aspecto de
    sobre de cartas, colgados en una pared.
  - **Tienda por dentro: el antiguo videoclub** (1-11-2026): mezcla de la idea de una tienda de sobres de un juego de
    cartas (pared de sobres, uno marcado, bocadillo con precio) con el videoclub de «Aquí no hay quien viva», en
    nuestro pixel art y con perspectiva. Tiene dependienta propia. Solo guiños y género: nunca arte, logos, decorado ni
    personajes (ni su parecido) de esas obras.
    **Desde la 1.68** (maquetas de Francisco, «muy plano» la versión 2D):
    - la tienda y su mostrador de cerca se dibujan con el mismo motor isométrico que los pisos (`shopRoom.js`), con
      profundidad, sombras y luz de tarde;
    - Sobres, Muebles y Reciclar son objetos de la escena (expositor, rincón del sillón, caja de reciclaje) con un
      letrero y su contorno encendido;
    - no volver a una fila de pestañas grandes que le quite protagonismo a la tienda.
  - **El café-librería del bajo** (encargo de Francisco del 11-11-2026; plan en `docs/qa/cafe-libreria.md`, por bloques con
    capturas): la tienda del bajo deja la venta de muebles (ya está el almacén del hotel) y **desaparecen los sobres/gacha y el
    reciclaje de su vista** (sin borrar inventario, tickets ni datos). En su lugar, un **minijuego importante de la app**: tu
    propio café-librería cozy en 3D, con el motor y el estilo de las salas del hotel, que se decora a tu gusto y sube de nivel de
    forma adictiva pero orgánica (sin castigos, rachas que se pierdan, energía ni cuentas atrás). Clientes que piden libros de tu
    biblioteca real; tu lectura mueve el café. Decisiones de Francisco: **moneda propia del café** (solo sirve ahí, nunca se
    compra con dinero); **cada nivel da una recompensa de tickets** y **cada día se ganan unos tickets extra según el nivel**
    para animar a jugar (**cuarta excepción** a «los tickets solo se ganan leyendo»; las cifras, con tope, las aprueba él y las
    cuenta el servidor); **subir de nivel desbloquea muebles nuevos y funciones** para mejorar el local.
    **Plan aprobado** (Francisco, 11-11-2026, «Sí, las recomendadas»; detalle en `cafe-libreria.md` §10): tickets **10 / 20 / 40 /
    60 / 100 al subir** (230 en total) y **1 / 2 / 3 / 4 / 5 al día según el nivel, tope 5 al día**, al atender al primer cliente;
    **la dependienta se queda como camarera**; **cinco niveles** (Rincón, Café, Librería, Altillo, Terraza y escaparate) **con
    tres hitos dentro** de cada uno; **los muebles del café solo se colocan en el café**; **nombre del café de una lista cerrada**
    (sin texto libre); **reciclar desaparece** con la tienda; con menos de 3 leídos, **el café presta los de «Leyendo» y «Quiero
    leer»**; la moneda se llama **granos** (nunca se compra, no se cambia por tickets ni pasa entre cuentas).
    **Revisión del bloque 3** (Francisco, 12-11-2026): **el café pesa más que el libro**. Cada bebida se prepara en **la barra
    en 3D, artesanal y cozy**, según lo que pide cada cliente, y **se le lleva a su mesa**. La receta tiene **cuatro
    elecciones en el nivel 1**: bebida (café o té), grano u hoja (suave o intenso), leche (sin, entera o avena) y un toque
    (nada, canela o miel); el bloque 4 desbloqueará más. **El libro es un extra**: se elige entre **pocas fichas atractivas**,
    no de la estantería entera. **Fallar se puntúa con estrellas** (de 1 a 3 según lo acertado): paga menos, pero nunca cero
    ni quita nada, y se ve qué se falló. **Un cliente excéntrico al día**, claramente distinto a los demás, con un pedido raro
    y más difícil de interpretar: con 3 estrellas paga **el triple** (unos 15 granos y 40 de reputación) y deja **una reseña
    dorada** en la pizarra.
    **Preparar el café, divertido y adictivo** (Francisco, 12-11-2026, literal: «quiero que el proceso de hacer el cafe sea
    divertido y adictivo, y que cada paso se sienta unico, tanto por los movimientos que haga el usuario como por los objetos
    que tenga que ver»): **cada paso de la barra tiene su propio gesto y su propio objeto** (p. ej., moler girando la manivela,
    apisonar, tirar de la palanca y mantener, cremar la leche inclinando la jarra, servir con pulso), nunca elecciones parecidas
    entre sí. Con las reglas de efectos de siempre: respuestas discretas, sonido propio sintetizado, silencio, volumen y
    movimiento reducido; sin trucos de presión ni falsos «casi»; todo con el dedo a 390 px. Si un cambio tocara la economía,
    las recetas o el servidor, consultarlo antes con él.
    **Refinado antes de los siguientes bloques** (Francisco, 12-11-2026):
    - **Exclamaciones** («para que la gente no se líe a causa del pixel art»): una «!» de píxel ámbar que salta **solo sobre lo
      siguiente que hay que tocar** (el cliente, la cafetera, el tarro, la manivela…), en los **niveles 1 y 2**; después, solo si
      alguien se queda parado. En Ajustes, «Ayudas visuales» para tenerlas siempre o nunca.
    - **Libros comprados en cajas** (idea de Francisco tomada del género de Tiny Bookshop; solo la mecánica, nunca su arte):
      lo que lees **desbloquea el título** en la distribuidora del café; con **granos** se compran **cajas por género** (o de
      un título concreto, más caras) con ejemplares de libros leídos; la caja llega al café, se abre y **se arrastran los lomos a
      las baldas**. **Solo se recomienda lo que está en la balda**, y cada ejemplar que se lleva un cliente paga granos de más.
      **Caja de bienvenida gratis** al abrir el café; sin ejemplares, «Solo el café» (cobra el café y solo pierde el punto del
      libro). **Cifras aprobadas** (Francisco, 12-11-2026, «Sí, esas cifras»; `docs/qa/cafe-libreria.md` §11): caja de
      género, 5 ejemplares por 10 granos; de un título, 3 por 9; +2 granos por ejemplar que se lleva el cliente (solo si
      encaja; si no, vuelve a la balda); bienvenida de 8 una vez; 12 huecos en el nivel 1. Se hace antes del bloque 4.
      **Los libros, cozy y acogedores** (Francisco, 12-11-2026): lomos distintos por título, juntos en una balda cálida, la
      caja con papel de seda, Pilar comentando y sonidos suaves de papel y madera; no volver a un panel frío de huecos.
      **Bloque 4, decisiones de Francisco (12-11-2026)**: se parte en **4a** (subir de nivel con recorrido de cámara,
      tickets de nivel y diarios, hitos, niveles 2–3: ventanal, vitrina, estanterías altas y chimenea) y **4b** (altillo,
      terraza y escaparate en la fachada). **Una receta nueva por nivel**, cada una con su gesto y su objeto: nivel 2
      chocolate caliente (bebida; remover en el cazo con el molinillo), nivel 3 nata montada (toque; batir girando), nivel 4
      vainilla (toque; rascar la vaina), nivel 5 bebidas con hielo (agitar la coctelera). **Tres hitos por nivel** (cada
      tercio de la barra, una vez, los cuenta el servidor): 1.º un mueble nuevo del café a la venta (nivel 2 de 40 a 90 granos,
      nivel 3 de 80 a 160), 2.º lo nuevo de la carta, 3.º 15 granos. **Huecos de balda por nivel: 12 / 18 / 30 / 36 / 42.**
      **El local crece con los niveles** (Francisco, 12-11-2026): en los **niveles 1 a 5** se va haciendo más grande la planta de la
      calle; en los **niveles 6, 7 y 8**, un **sótano** (bodega y tostadero) que crece en cada uno; **pasado el 8**, una **segunda
      planta** que también crece. **Cada planta tiene su cuadrícula de Decorar** y en ella se sientan clientes. **El espacio tiene
      que servir para jugar mejor, no solo para decorar** (más sitio, más rendimiento). Sustituye al «altillo en el nivel 4» del
      bloque 4b. Las cifras de los niveles 6 en adelante (umbrales, tickets y lo que rinde cada planta) las aprueba él.
      **Bloque 4b, cifras aprobadas** (Francisco, 12-11-2026, «Sí, esas cifras»): **nivel 4, el ala lateral** (se abre la pared
      de la derecha: cuadrícula 9 × 9), **vainilla** (rascar la vaina deslizando el cuchillo) y muebles de 120 a 200 granos (mesa
      larga, biombo de librería, lámpara de bankers; hito, piano vertical de adorno); **nivel 5, terraza y escaparate** (tres
      filas en la acera con toldo y farolillos, escaparate con tres de tus leídos **visible desde la fachada** y placa con el
      nombre del café), **bebidas con hielo** (agitar la coctelera de lado a lado) y muebles de 150 a 250 granos (mesa de hierro,
      silla de terraza, macetero largo; hito, farol de forja). **Clientes al día 6 en el nivel 4 y 7 en el 5, solo con al menos
      tantos asientos colocados** (si faltan, vienen menos, sin castigo y con un aviso amable de Pilar; nunca menos que en los
      niveles 1 a 3); el **tope diario de reputación** sube en proporción. Tickets, huecos e hitos, sin cambios.
      **El sótano, cifras aprobadas** (Francisco, 13-11-2026, «Sí, esas cifras»; `docs/qa/cafe-libreria.md` §14): **nivel 6, la
      bodega** (desde 10.000 de reputación), **7, el tostadero** (15.000) y **8, la sala de catas** (21.000; sus hitos hasta
      27.000); tickets al subir **80 / 90 / 100** (el tope de 5 al día no cambia); **hasta 8 / 9 / 10 clientes** con asientos (los
      del sótano cuentan); **48 / 54 / 60 huecos**; muebles de 200–300, 250–350 y 300–400 granos; 3.er hito de 20, 20 y 25 granos.
      **El tostadero**: un saco al día (no se acumula más de uno, sin plazo), recogido tirando de la trampilla del tambor; 5 tazas de
      «tueste de la casa» por saco, a +3 granos y +4 de reputación. **Chai con especias** (nivel 8, bebida; mortero, cuatro golpes)
      y **café brûlée** (nivel 8, toque; soplete en zigzag). Los niveles 1 a 5 y sus hitos no cambian. Por bloques con capturas:
      6a bodega, 6b tostadero, 6c sala de catas; migración en cada uno (la aplica él).
      **Mejoras de la casa y del café**: se le recomendó mantenerlas separadas con los puentes que ya hay (12-11-2026); sin
      decisión suya todavía.
    **Tras probar la 1.125 en producción** (Francisco, 13-11-2026, «esta genial»), por orden de importancia:
    - **El sonido del café, lo primero**: la música del café tiene que sentirse **cozy**, y **cada acción tiene que tener un
      sonido** que case con lo que se hace, atractivo y orgánico (andar, los clientes, servir, cobrar, decorar, la trampilla…,
      no solo la barra). Sonidos y música propios y sintetizados, con las reglas de efectos de siempre.
    - **Las indicaciones de la barra, más orgánicas**: hoy ocupan mucho; no deben tapar las herramientas.
    - **Sin hablar de lo de antes**: la app la usan, por ahora, solo Francisco y su pareja; los diálogos no mencionan los
      sobres, la reforma ni lo que había antes en el bajo.
    - **Portadas reales** de los libros en el juego: quiere saber si se puede o si pesaría demasiado (se le contesta antes de
      hacerlo). **Hechas en la 1.126** («Sí, haz las portadas en las fichas y el escaparate»; «mejóralas un poco»): en las
      fichas, la imagen; en el escaparate, la portada pixelada a 36 × 54 (con 10 × 15 no se reconocía).
    - **Jornadas de prueba para su cuenta** (Francisco, 13-11-2026: «Quiero que mi cuenta pueda jugar todo lo que quiera para
      probar yo todas las funciones del juego y ver cosas cambiar o no»): las cuentas de `cafe_probadores` (solo la suya, con
      `supabase/scripts/cafe_probador.sql`, a mano) juegan un día de prueba propio y, con todos atendidos, «Otra jornada» trae
      clientes nuevos; lo ganado (granos, reputación, niveles y sus tickets) cuenta igual y no se borra nada. Para el resto no
      cambia nada. No se extiende a nadie más sin que lo pida. **Ampliado a la cuenta de su pareja** (Francisco, 13-11-2026,
      al aplicar la migración: las dos cuentas, añadidas en el SQL Editor; los correos nunca van a git). **Subidas al nivel 3**
      (Francisco, 15-11-2026, «para probar los cambios rapido»): las dos cuentas de prueba, una vez, con
      `supabase/scripts/cafe_subir_nivel3.sql`, cobrando como al subir jugando (+40 tickets y +15 granos cada una). Es una
      excepción puntual: no se repite, no se sube a otros niveles ni se amplía a nadie más sin que lo pida.
    - **Pilar prepara lo que ya dominas** (Francisco, 14-11-2026, «Vale lo de pilar»; para que preparar no se haga
      repetitivo; detalle en `cafe-libreria.md` §15): cada bebida se domina con 12 servidas de 2 estrellas o más; entonces, tras
      elegir tú la receta, «Que lo prepare Pilar» hace los gestos en 3D (unos 3 s; con movimiento reducido, directo). Siempre se
      puede hacer a mano; el excéntrico y lo recién desbloqueado, a mano; paga lo mismo; el contador, en el servidor. Del resto
      de ideas (pedidos de grupo, días distintos, arte latte, habituales con ficha, pistas, maridaje, tertulia) **no le
      convencieron**: no hacerlas. **Se implementa junto con lo de los libros**, cuando esté preparado («vamos a preparar antes
      lo demás y lo hacemos en conjunto»).
    - **Los libros, igual de importantes que el café** (Francisco, 14-11-2026, «Si, me parece bien»; cifras en
      `cafe-libreria.md` §15.5): los clientes **solo piden lo que hay en la balda**, en tres partes (género, corto o largo, y
      para regalar / leer aquí / llevar), sin «tu favorito», «el autor que más lees» ni «el último que terminaste»; **una sola
      lista de categorías** (los diez géneros de la distribuidora, una sección de la estantería con placa por género, solo las
      que tienen ejemplares); estrellas con 4 aciertos de la bebida y 3 del libro (3★ con los 7, 2★ con 4–6); el ejemplar que
      se lleva paga **+4 granos**; **el reparto** repone cada mañana lo vendido ayer (hasta 10, a 2 granos, nunca a deber).
      Con las recetas en manos de Pilar, **el libro lo hace siempre el jugador**, así que Francisco pide **especial mimo**:
      «que quiero que le pongas especial mimo de detalle, sonido, atractivo visual y mecanicas para que sea lo más divertido,
      cozy y cuidado posible asi como hiciste con la preparación del café pero hasta con más esmero». Cada paso del libro, su
      gesto, su objeto y su sonido, por encima del nivel de la barra. **Pilar y los libros, hechos juntos en la 1.130.0** (§130,
      migración `20261218120000_cafe_libreria.sql`; interpretaciones por confirmar en `cafe-libreria.md` §15.6).
      **Más cerca, más cozy y Pilar a mano** (Francisco, 14-11-2026, «me gustan como están pero querría que la camara esté un
      poco más cerca y que los sonidos sean más cozy»; «que cuando pilar prepara el café ella se haga más organico y no tan
      robotico»; 1.131, §131): la cámara del libro, más cerca (sección y tabla); los sonidos de la librería, de madera y notas
      suaves por una sala cálida propia (`calido` en `cafeSfx.js`), sin chasquidos brillantes; Pilar con el ritmo de una mano
      (nunca dos tazas iguales, el sonido con el movimiento), **sus manos** en cada herramienta (puño y un palmo de manga
      mostaza; no un brazo entero, que tapaba la barra) y la cámara siguiendo sus manos gesto a gesto, sin perder lo que hace.
    **Encargo del 14-11-2026, tras la 1.131** (plan en `cafe-libreria.md` §16; por bloques con capturas: 1) fuera la pizarra
    y el influencer, 2) taller, primera tanda, 3) taller, segunda tanda y encargo del amigo). Decisiones de Francisco del
    mismo día (las cuatro recomendadas):
    - **Un influencer antes de subir de nivel**: un «cliente extra», **fijo y diseñado para cada nivel** (siete personajes
      originales, nunca parecidos a influencers reales), que llega al llenar la barra; **el nivel sube al despedirle, salga como
      salga**. Siempre a mano (no lo prepara Pilar) y paga como el excéntrico. **El límite de tiempo es un reloj de arena de
      latón en la barra** (unos 2 min 30 s, sin números ni alarmas; con movimiento reducido, quieto; lo mide el servidor con
      margen). Si se acaba, paga como un cliente normal y el nivel sube igual: solo se pierde lo especial. **A tiempo y con 3★,
      «el vídeo se hace viral»**: al día siguiente, **3 clientes más** que vienen por su vídeo, y **una foto enmarcada y
      firmada** en la pared del café (una por influencer, colección de siete).
    - **El taller de restauración, desde el nivel 3 (Librería)**: «el taller de la trastienda», cuarto propio en 3D con don
      Celestino. Clientes que traen libros en mal estado; como mucho **uno al día, más otro de un amigo**, sin caducar ni reloj.
      Mecánicas **lo más artesanales y placenteras posible**, cada daño con su gesto, su objeto y su sonido. Dan **reputación y
      granos extra**, sin tickets, y tienen **identidad propia**. Pilar no restaura. **Cifras aprobadas** (Francisco, 14-11-2026,
      «Sí, esas cifras del taller»; §16.3): el encargo de un cliente, **6 / 9 / 12 granos y 15 / 22 / 30 de reputación** (1★ /
      2★ / 3★); el de un amigo, la mitad (**3 / 5 / 6 granos y 8 / 11 / 15**); aparte del tope diario de reputación. La
      interpretación del encargo del amigo (§16.4) sigue **pendiente de su visto bueno**; hace falta para el bloque 3.
      **Tras ver la 1.133** (Francisco, 14-11-2026, «me gusta pero…»): **los gestos, más cortos** («algunas acciones tardan
      demasiado, como quitar el polvo»); el taller con **sus propios sonidos** y **su propia música**, como el café; **don
      Celestino, mucho más único** (no una figura de cliente con mandil); y **el menú del taller con más alma** que el del café
      (identidad propia de banco de encuadernador, no la franja del café con otro color). Los vídeos de Playwright no graban
      sonido: para enseñarle sonidos y música, mandarlos aparte o mezclados en el vídeo.
    - **Rework de dónde salen los libros** (Francisco, 16-11-2026: «lo que no me convence es el tema de comprar libros y que
      dependan exclusivamente de tu biblioteca, porque la gente que lea poco no tendrá muchas opciones y si no tienes dinero
      pierdes esa parte del juego»; la mecánica de sacar y preparar el libro le gusta y no se toca). Decisiones del mismo día:
      **catálogo propio del café** (libros reales por género, igual para todos) **más tus leídos**, que se distinguen y pagan
      algo más; y **reparto diario gratis** cada mañana para que la balda nunca se quede vacía, con la compra de cajas con
      granos solo como extra (elegir género o título). Cifras en `cafe-libreria.md` §17, las aprueba él.
    - **La estantería, llena y apetecible; visitas y ranking de cafés** (Francisco, 16-11-2026, tras ver la 1.139 en el móvil:
      «sigue viendose algo vacía»). Decisiones del mismo día: **repartir y vestir la estantería** (cada género, su tramo a lo
      ancho de la pared; en los huecos, libros de cara con portada, pilas tumbadas, plantas y tarros; lo que está en cajas, a la
      vista abajo). **Visitar cafés** de los vecinos del edificio y de quien sigues (como los pisos: comunidad activa, sin
      bloqueo), **solo pasear y mirar** en 3D, en solo lectura. **Ranking** del edificio, con otra pestaña para quien sigues,
      en tres tablas: **nivel y reputación**, **granos ganados en total** (desde la migración, sin restar lo gastado) y
      **reputación de la semana**. Sin sellos de visita, placas de ranking ni guardar libros ajenos de momento. Los granos
      siguen sin pasar entre cuentas.
      **Tras ver la 1.141** (Francisco, 16-11-2026: «a los lados libros que no se pueden pulsar y pueden confundir»; «en los
      ranking no se ve bien la reputación»): **en la estantería, solo libros de verdad** (sin pilas de adorno; el libro de cara,
      dentro de su sección y pulsable como un lomo; los huecos, con objetos que no son libros) y la reputación del ranking, bien
      legible. **El cuaderno de Pilar**: tareas a cambio de granos como **mejoras para siempre** (se pagan una vez, con grados,
      nunca caducan): **colocar la caja** del reparto ella sola, **la hucha de propinas** (unos granos al día mientras no estás,
      con tope, sin perder nada) y **la pizarra de la acera** (un cliente más al día). **Cifras aprobadas** («Sí, esas cifras»):
      colocar la caja, 60 granos (nivel 1, de una vez); la hucha, desde el nivel 2, 120 / 250 / 450 granos para 3 / 6 / 10
      granos al día, guardando hasta 7 días; la pizarra, desde el nivel 3, 150 / 350 granos para 1 / 2 clientes más al día (y
      el tope diario de reputación sube en proporción). Lo cuenta el servidor; nada toca los tickets.
      **Tras ver la 1.142** (Francisco, 16-11-2026: «que los beneficios de los encargos sean mucho más atractivos [...] como
      objetivos a la larga y que su interfaz sea un poco más atractiva»; cifras «Generosos»): la hucha da **8 / 15 / 25** granos
      al día (mismos precios, guarda 7 días); la pizarra, **3 grados**: +1 / +2 / +3 clientes por 150 / 350 / **700** (el 3.º
      desde el nivel 5); la caja, un **2.º grado «Pilar pide a la distribuidora»**: +3 libros en cada reparto de la mañana
      (**300** granos, desde el nivel 4). El cuaderno, más vistoso y con lo que te ha dado cada tarea.
    - **La pizarra se quita del todo** («no me termina de convencer»): sin botón ni panel; la nota del habitual y la reseña
      dorada se ven en su bocadillo al despedirse, y Pilar no la menciona. Sin borrar datos del servidor.
    - **El obrador: vender comida** (encargo de Francisco del 17-11-2026: «una nueva mecanica que se desbloquearía a un nivel que
      tu consideres necesario. Vender comida, algo como starbucks pero super cozy que de pie a mejora y tenga mecanicas adictivas y
      que inciten a seguir jugando»; plan en `cafe-libreria.md` §18, por bloques con capturas a 360 y 390 y vídeo con sonido). De
      la cadena del ejemplo, solo el género: ni su nombre, marca, tamaños, nombres de vasos ni logos. **Aprobado** (17-11-2026, las
      cuatro recomendadas): se abre en el **nivel 4** (tras la pared del ala lateral aparece el horno de la antigua tahona con su
      recetario); **las cifras de §18.6 y §18.9** (piezas de 2 a 5 granos; horno 250 / 600; vitrina 150 / 350 / 700; maestría por
      receta con 3 / 10 / 25 hornadas de 2★); **la comida solo da granos, nunca reputación ni tickets**; ingredientes gratis; lo
      horneado nunca se estropea ni se quema y el horno no tiene números; **Pilar vende en el mostrador mientras no estás, como la
      hucha** (hasta 7 días); **cada habitual pide su favorito** (+2); **los maridajes, descartados**. Cada receta con dos gestos,
      sus objetos y su sonido. Bloques: 1.143 el obrador abre, 1.144 mejoras y mostrador, 1.145 el recetario crece; una migración
      por bloque (la aplica él).
      **Máximo dos cosas por cliente** (Francisco, 17-11-2026, tras ver la 1.143: «se volvería muy pesado el proceso, el maximo lo
      pondría en dos»; eligió «Dos máx., 1 de cada 3»): desde el nivel 4, cada cliente pide **bebida y libro** o **bebida y comida**,
      nunca las tres. **Uno de cada tres** pide comida (lo decide el servidor) y ese no pide libro; sus estrellas salen solo de la
      bebida (4 aciertos, 3★; 2 o 3, 2★; si no, 1★). Las pinzas siguen siendo del jugador, en el mismo viaje que la taza (barra,
      vitrina y mesa). **Pilar no sirve la comida** (Francisco: «perdería la gracia de incluir la nueva mecánica»).
      **El horno avisa al terminar** (Francisco, 25-11-2026: «una notificación cuando se terminen, o un indicador visual claro»;
      1.145.1, §145.7): mientras hay algo dentro, el horno del HUD (sin números) y, al terminar, la campanilla y una nota de papel
      estés donde estés del café, que nunca tapa la comanda ni las herramientas. No quitarlo.
    - **Olmo, el personaje de suscriptor** (Francisco, 26-11-2026: «Empieza con el personaje de suscriptor que sustituye a
      Pilar, y más allá de las funciones, haz mucho hincapié en que sea muy característico y atractivo para el público, y que en
      la cafetería también tenga una especie de guía como libo en los menús y botones»). Decisiones del mismo día (las cuatro
      recomendadas):
      - **Olmo**, un búho librero, grande y redondo, con gafas de alambre, chaleco de punto mostaza y bufanda de cuadros; sabio
        y tranquilo. Con la suscripción ocupa el sitio de Pilar en el café (hace lo que hace ella).
      - **Guía del café en menús y botones para todos**, cada uno con la suya: con la suscripción guía Olmo y sin ella, Pilar
        con su retrato.
      - **Vista previa** para las cuentas de `cafe_probadores` (Francisco y su pareja): ven a Olmo y su guía como si fueran
        suscriptoras, sin precios de suscriptor. La da el servidor (migración nueva, la aplica él).
      - **Lo diseña Claude en 3D**, original, con el motor de la casa (como el mapache del casino); sus retratos y poses de la
        guía salen del mismo modelo. Nunca parecido a búhos de otras obras.
      - Por bloques con evidencias: 1) Olmo en el café; 2) la guía en menús y botones (1.150.1, SPEC §150.6). En las e2e con
        cuenta simulada, el simulador da la guía del café por vista (`bookshelf:guia-cafe`), como a Libo; las pruebas de la
        guía quitan esa marca.
      - **Sus poses, como las de Libo** (Francisco, 26-11-2026, con su hoja de 24 poses: «Para después añade a olmo con las
        animaciones que te paso igual que a libo»): **después** del encargo de los edificios de amigos. La hoja está en
        `../libotown-marca/olmo-poses.png` (fuera de git). Se recortan de su material con un script como `scripts/libo-poses.mjs`
        (nunca inventarlas) y se eligen según el momento, como `src/features/libo/poses.js`; con movimiento reducido no cambia
        solo. Olmo es un modelo 3D en la barra (`cafe/olmo3d.js`): las poses de la hoja van donde hoy sale su retrato de píxel
        (la guía del café, los avisos, el cuaderno…); cómo encajarlas con el 3D, preguntárselo antes de hacerlo.
        **Decidido** (Francisco, 27-11-2026, «Igualar el 3D al dibujo»): las 22 poses sustituyen al retrato de píxel en todos
        los sitios donde sale, y **el modelo 3D se retoca para ser el mismo Olmo que el de la hoja**: bufanda a rayas roja y
        verde, sin chaleco mostaza y con gafas naranjas. Los gestos del 3D no cambian. Su dibujo manda sobre la descripción de la 1.150. **Hecho en la 1.156.0** (SPEC §156).
  - **Edificios de amigos, sección social y telefonillo** (Francisco, 26-11-2026: «Cada edificio debería tener como vecinos
    únicamente a tus amigos, y que cada grupo de amigos tenga como su propia comunidad de vecinos»; «que en el ordenador haya una
    sección social muy atractiva que deje buscar a amigos y tener funciones relacionadas con la lectura, y que fuera del edificio
    tengas como un telefonillo con funciones así, que Libo también esté relacionado»; plan en `docs/qa/amigos-vecinos.md`, por
    bloques con evidencias). Decisiones del mismo día (las cuatro recomendadas). **Sustituyen al reparto al azar** de la 1.63:
    - **La llave de tu edificio**: cada cuenta nueva estrena su propio edificio; para vivir con amigos, uno da una llave (enlace
      o código, desde el telefonillo o el ordenador) y el otro decide mudarse, con su piso y sus muebles. Nadie entra sin llave.
    - **Los edificios ya mezclados**: se queda quien tenga allí a algún amigo (os seguís los dos); quien no tenga ninguno se muda
      a un edificio propio con su piso y sus muebles intactos (nada se borra). Si luego os hacéis amigos, vuelve con una llave.
    - **El edificio crece por plantas**: al llenarse gana una planta (2 puertas más), hasta 5 plantas (10 vecinos); la fachada se
      dibuja más alta.
    - **Lo que ven tus amigos de tu lectura, lo eliges tú**: por defecto, qué lees ahora y los libros que terminas (nunca notas,
      reseñas privadas ni páginas por día); en Ajustes se apaga todo o una parte. Solo amigos, nunca toda la comunidad.
    - **Al final, en otro bloque, borrar las vistas isométricas** (Francisco, 26-11-2026: «borra las vistas isometricas, ya no
      creo que las usemos más»): cuando esté hecho todo lo anterior. Antes de borrar, enseñarle la lista exacta de vistas y
      archivos (y lo que las sustituye en cada sitio) para que la confirme; sin borrar datos de usuarios.
      **Lista confirmada a medias** (Francisco, 26-11-2026, «Sí, borra la A»; lista en `amigos-vecinos.md`, bloque 5): se borra
      la parte A (la tienda isométrica, el «Plano» del vestíbulo, los dibujos de respaldo sin 3D, las páginas de desarrollo y la
      visita isométrica a un vecino) y **la parte B se queda** hasta que haya 3D (Decorar, tu piso desde la fachada con el
      personaje y sus misiones, el respaldo de la habitación y el mercadillo de la Lonja). **La visita a un vecino es siempre
      en 3D** (eligió «Quitarla igualmente» sabiendo que así ya no se ven su personaje, su compañero legendario ni los «me
      gusta» por mueble): esto sustituye a «los vecinos lo ven al visitar tu piso» y a que el legendario te siga en las
      visitas, hasta que la visita 3D los tenga. **Parte A hecha en la 1.155.0.**
    - **Ideas anotadas para más tarde** (Francisco, 27-11-2026; detalle en «Pendiente» de `docs/ESTADO.md`): el ordenador que
      se queda en negro en el iPhone de una compañera (**hecho y publicado en la 1.159.0**: la red de seguridad
      `src/ui/RedDeSeguridad.jsx` envuelve la app; no quitarla, y un fallo nuevo no debe dejar la pantalla en negro); **los tickets como moneda con identidad** («libocoins o algo por el
      estilo», con la cara de Libo según la moneda que dibujó él, siempre a la vista y con una animación divertida de Libo al
      ganarlos; lo interno no se renombra sin migración aprobada y las reglas de ganarlos no cambian; **plan aprobado** el 27-11-2026, «Sí, así», en `docs/qa/libocoins.md`: se llaman **Libocoins** en todo lo visible, también la web; el saldo, siempre junto a Libo en su esquina; al ganarlos, Libo celebra; por dentro siguen siendo `tickets`, sin migración; la moneda se recorta de su dibujo en `../libotown-marca/`, nunca redibujada; **bloque 1, nombre y moneda, publicado en la 1.160.0**; **bloque 2, el saldo junto a Libo, en la 1.161.0**: Francisco eligió la moneda «Junto a su pata», pegada a Libo y con la cifra de píxel sin caja, no una placa aparte; **bloque 3, Libo lo celebra, publicado en la 1.162.0**: plan completo); la web en su dominio (ya estaba en libotown.es desde la 1.146; Francisco, 28-11-2026: «Dejarla así»);
      y **el menú de Libo más gracioso y limpio, que te cuente qué puedes hacer hoy** (intentos del casino que quedan, muebles
      en oferta de los que quieres, muebles nuevos, clientes nuevos, si alguien te ha dado algo…): proponerle el diseño antes.
      **Primera propuesta vista** (27-11-2026): la tarjeta «Lo de hoy» en tu piso (saludo con gracia, fichas tocables de lo que
      queda hoy, lo hecho en etiquetas, la idea del día al pie). Francisco: «Sí, que pregunte» (**Libo puede preguntar al servidor**
      por el casino y las misiones del día al abrir su tarjeta, con caché; excepción a «sin pedir nada nuevo al servidor» del
      bloque 3) y «no está mal pero todavía puede mejorar, darle más identidad pixel pero sin saturar y que los iconos sean más
      originales»: iconos de píxel propios, nunca de una librería. **Segunda propuesta aprobada** («Sí, constrúyelo»): hecha en
      la 1.158.0 (SPEC §158, `docs/qa/libo-lo-de-hoy.md`). **Publicada** el 27-11-2026.
    - **Después, borrar la versión antigua de la app** (Francisco, 26-11-2026: «quiero que se borre la versión antigua de la
      aplicación porque sigue saliendo cuando la gente se mete en la web para instalar la app»). Antes de borrar nada,
      investigar qué sale exactamente y enseñarle qué se quitaría para que lo confirme; sin borrar datos de usuarios.
      **Investigado y decidido** (27-11-2026): la versión antigua es la habitación ilustrada de la 1.86, a la que se llega con
      «Volver a la experiencia anterior» (pantalla sin cuenta y Menú del piso) y que se queda elegida en el dispositivo. Francisco:
      «Bórrala, pero déjala aparte en otra carpeta aquí por si acaso la necesitamos en el futuro para algo». Se borra de la app
      entera (código, dibujos y guía antigua) y **se guarda una copia fuera del build** en una carpeta aparte del repositorio,
      sin que se cargue ni se publique. Antes de borrar, enseñarle la lista exacta de archivos y lo que sustituye a cada cosa. Esto
      sustituye a «la habitación ilustrada se queda como está» (bloque 4 de Libo) y a «se conserva una opción para volver a la
      experiencia anterior» (7-11-2026). Sin borrar datos de usuarios (libros, lecturas, diario y decoración siguen igual).
      **Bloque 1 hecho en la 1.157.0** (lista confirmada: «Sí, adelante»): guardada en `archivo/habitacion-ilustrada/` (con
      `LEEME.md`; nada del archivo se importa desde `src/`). **Bloque 2 hecho** (las e2e entran por `e2e-community/entrada.js`:
      «Al edificio» y la navegación de la app, nunca la habitación). **Publicado** el 27-11-2026 («Sí, publícalo»).
  - **Carteles de la fachada** (Francisco, 12-11-2026, con maqueta; 1.124, `placas.js`): placas de madera de nogal,
    esmalte y latón mate con contorno de píxel (esquinas escalonadas) y sombra dura pequeña, **sin pastillas,
    degradados brillantes, resplandores ni desenfoque**, y legibles sin parecer que dan luz. Vivienda libre en marfil, la
    tuya en verde con llave, la de un vecino con su nombre real (nunca «Libre» ni un estado inventado); el café, rótulo
    colgante con «Se traspasa» en una tablilla de papel solo cuando toca; el hotel, placa azul con flecha y campanilla.
    Texto real siempre aparte del marco; nombres largos con puntos suspensivos y enteros en la etiqueta accesible; nunca
    letra ilegible para que quepa.
  - **Más vida en el edificio** (encargo del 1-11-2026, por bloques con capturas entre uno y otro: 1) más muebles,
    2) personaje, 3) misiones diarias, 4) vecinos). Decisiones de Francisco:
    - **Personaje propio y personalizable** en tu piso: tocas el suelo o un mueble y va andando hasta allí. En sillas,
      sillones y camas se sienta o se tumba; si no lo tocas, pasea solo de vez en cuando.
    - Su aspecto se guarda en el servidor y **los vecinos lo ven** al visitar tu piso (migración nueva, la aplica
      Francisco).
    - **Misiones diarias de la habitación**: dan **ropa y colores del personaje**. **Desde la 1.79** (decisión de
      Francisco del 3-11-2026): cuando ya tienes **toda la ropa** que se gana con ellas, las tres del día dan **5
      tickets** en su lugar (lo cuenta el servidor). Es la segunda excepción a «los tickets solo se ganan leyendo»,
      junto a la cuenta del fundador; no se extiende a más sin que lo pida. **Tercera excepción** (Francisco, 4-11-2026): el
      cambio de la lata del casino, 50 garbanzos por 5 tickets, hasta 10 tickets a la semana.
    - **Vecinos**, sin texto libre: regalar copias de muebles, libro de visitas con sellos de frase cerrada y «me
      gusta» por mueble. Visitar con tu personaje queda fuera por ahora.
  - **Sonidos cozy propios del edificio** (1-11-2026): sintetizados, por material y por acción (§6 del plan).
  - **Sintonía de «Aquí no hay quien viva»**: a Francisco le encantaría en versión chiptune cozy. Sin licencia no se usa
    ni se recrea esa melodía (tampoco de oído). En la app, solo un tema original con guiño.
  - **Melodía «Dos balcones»** (2-11-2026): Francisco pasó un audio (WhatsApp, título ID3 «Dos balcones») para usarlo
    **más adelante** como música del edificio. La generó él con ChatGPT y descartó la sintonía de la serie (confirmado
    el 2-11-2026): se puede usar. **Desde la 1.73 suena en el edificio** (`public/media/edificio/dos-balcones.mp3`,
    `edificio/music.js`): en bucle, bajita, solo con el sonido activado y callada mientras suena la radio. **Retirada del edificio en la Fase 1** (8-11-2026, Francisco la identificó como la «pista antigua» que no le gusta): el edificio sigue la música elegida en Sonido y no arranca ninguna por su cuenta; `dos-balcones.mp3` y `music.js` se conservan. Y **sonidos de acciones estilo Stardew Valley**, muy satisfactorios: solo el estilo, sonidos
    propios sintetizados (nunca muestras del juego).
  - **pixelfx** (2-11-2026, «adelante»): se puede usar https://github.com/patch-gg/pixelfx (MIT) para los efectos de
    muebles y diseños de aquí en adelante. Copiar solo el núcleo y los efectos que se usen, con su `LICENSE` y su
    `NOTICE.md`; **nunca su fuente «Patch Pixel»** (no es MIT).
  - **No usar `material-diseno/barrio-v2/`** (2-11-2026): Francisco pidió no usarla y borrarla (a la Papelera; el
    primer intento falló porque Windows tenía un archivo abierto).
  - **Rareza «místicos»** (2-11-2026, plan en `docs/qa/misticos.md`): dragones y otros seres con movimiento, de
    **diseño espectacular** y, si se puede, **con guiños a sagas** (originales que evocan, nunca personajes, nombres
    propios, logos ni diseños oficiales). Salen con **una probabilidad muy baja** en los sobres (Francisco lo eligió
    frente a un sobre propio o a premios por leer). Dentro de los místicos, **los más raros te siguen a todas partes**
    (tu piso, las visitas, el hotel). **Cifras aprobadas** («Sí, esas cifras», 2-11-2026): solo en el sobre «Edición
    coleccionista», **1 %** místico y, de esos, **1 de cada 4 legendario** (0,25 %); se resta de «raro», el resto de
    probabilidades y el pity actual no cambian; **sin pity propio**. Diseños de la primera tanda en `dev/misticos.html`.
    **No son moneda**: no se compran, no se reciclan ni se regalan. Solo un legendario te acompaña a la vez.
  - **El Gran Hotel del Puerto** (2-11-2026, plan en `docs/qa/gran-hotel.md`): más espectacular y, como la fachada del
    edificio, **que se pueda interactuar desde la propia fachada**. **Se llega en una limusina negra de lujo**
    (2-11-2026): para ir al hotel hay que coger la limusina (en nuestro pixel art, original). **Se coge delante del portal
    del edificio**, aparcada en el muelle con su chófer (aprobado «Sí, a la limusina», 2-11-2026; 1.74, §74.4). **Desde la 1.123
    va a la izquierda del portal**, delante de la librería (Francisco, 12-11-2026: que no tape el café ni su terraza),
    y **coche y chófer se ven en la vista inicial sin girar** (el chófer, delante del coche, del lado del muelle).
    **Salas del hotel** (2-11-2026, `gran-hotel.md` §9): cada sala es la versión física de una función de la app y se
    navega con **un ascensor de latón**, no con menús. La Lonja (intercambio de muebles; nunca místicos ni sagas), la
    suite de la semana (**quitada de la app desde la 1.81**: a Francisco no le convencía la sala de exposición de
    muebles, 4-11-2026; no se borran sus datos y quien tiene la placa la conserva) y **el casino del sótano**: minijuego
    «Las 21 páginas», **sin apostar** (partida diaria gratis, nunca se pierde nada, sin falsos «casi»), **abierto todos
    los días, leas o no** (desde la 1.81, decisión de Francisco del 4-11-2026: «da mucho conflicto con las lecturas»);
    las fichas nunca se compran y se canjean por sobres, ropa de casino y la mascota «el conejo de la chistera» (ocupa el sitio del legendario).
    Orden: vestíbulo con ascensor, suite, casino, sala de lectura y quiosco, Lonja, vitrinas y mirador.
    **El casino en 3D** (encargo de Francisco del 10-11-2026; plan en `docs/qa/casino-3d.md`, por bloques con capturas):
    sala más grande e impactante con el motor del almacén, «Las 21 páginas» en una mesa 3D, **una ruleta de premios una
    vez por semana** (decide el servidor, probabilidades a la vista, sin falsos «casi»; **se gira solo a solas, aunque
    los amigos que visitan la ven**), el tercer juego **«Las tres chisteras»** (seguir al conejo bajo las chisteras, de
    habilidad) y **una vitrina de premios** en la sala. Premios (aprobados el 10-11-2026, «Vale»): blackjack como hoy;
    ruleta con fichas, garbanzos, prenda y mueble trofeo exclusivos, sus fichas **fuera** del tope de 150; chisteras con
    pocas fichas al día **dentro** del tope; copas de hitos solo decorativas; **sin tickets nuevos ni sobres** (siguen
    cerrados). Lo ganado va al inventario para usarlo **y además** queda expuesto en la vitrina, que **ven los amigos**
    al visitar; Francisco quiere que la vitrina sea **lo más inmersiva posible**. **Los premios raros, apetecibles** (10-11-2026): la casilla más rara de la ruleta es una **mascota de casino que te acompaña**, el mapache crupier, con **modelo 3D de verdad** (volúmenes, no el dibujo de píxeles de pie; `mapache3d.js`), y te sigue. **La vitrina enseña todos los premios del casino** (aprobado el 10-11-2026, con 3-4 más de los propuestos; lista en `casino-3d.md` §4): lo ganado iluminado y lo que falta tapado con un paño y cómo se gana.
    **La mesa para dos del casino** (3-11-2026, «Fichas y garbanzos», «Os seguís los dos», «En diferido»): con un
    amigo (**seguimiento mutuo**) se juega contra el mismo crupier, cada uno cuando quiere; esas manos son de las 3 del
    día y dan **2 fichas de compañía** más a cada uno (el tope semanal de 150 sigue). **Única excepción a «sin
    apostar»**: entre los dos se pueden apostar **fichas, una vez al día por pareja y hasta 10**, y **garbanzos** (una
    empiezas con 100, +20 cada día que juegas, hasta 50 por mano; nunca se compran). Gana la apuesta quien
    acaba más cerca de 21 sin pasarse; empate, se devuelve. Solo con un amigo y aceptándolo los dos; nunca con
    desconocidos del hotel, nunca más de lo que se tiene. No se amplía sin que Francisco lo pida. **El aviso llega
    estés donde estés del edificio** (4-11-2026): una nota con «Ir al casino» y el buzón; quien invita guarda una de sus
    manos para esa mesa. **Mesas de garbanzos** (4-11-2026): tras la mesa del día se sigue apostando solo garbanzos, sin
    gastar manos ni ganar fichas, hasta 6 al día por persona y una abierta por pareja. **La lata de los garbanzos**, plegada
    al pie de la caja: premios humildes y el cambio con tickets, con tope semanal. Las fichas siguen sin convertirse en tickets.
  - **La sala de lectura del hotel** (4-11-2026, «Librería y compañía»): se ve a quien lee con su personaje, un libro y su
    compañero, nunca con iconos. Tiene que dejar huella: **librería común** (quien termina un libro leyendo ahí puede dejar
    su lomo, con su nombre; lo decide cada vez y puede retirarlo) y **saludo** cerrado entre quienes leen a la vez, sin texto
    libre. Al acabar te dice con quién has leído. No da tickets ni recompensas.
    **La sala en 3D** (encargo de Francisco del 11-11-2026; plan en `docs/qa/sala-lectura-3d.md`, por bloques con capturas):
    biblioteca de noche en 3D con el motor del casino. Decisiones de Francisco (11-11-2026): **a solas, tu sillón con tu libro**
    en la mesita (sin cuaderno de la sala, sin «Abrir el libro» ni mesa por libro de momento); **cita de lectura con un amigo**
    (seguimiento mutuo, aviso en el edificio, reloj común del servidor, «habéis leído juntos»; «haz lo que veas mejor»); **placa
    del sofá por pareja, sin rachas** (horas y libros juntos, solo adorno de la sala); y **una selección de gestos cerrados**
    para comunicarse con la otra persona, sin texto libre.
    **Aspecto de la sala** (11-11-2026): gran biblioteca mágica de triple altura y luz cálida («cozy»); la sala manda en la pantalla y la sesión va en una franja baja, nunca media pantalla; letreros discretos; la duración de la sesión la elige quien lee.
  - **Salas ampliadas y de varias plantas** (4-11-2026, idea de Francisco, con maquetas de un salón ampliado y de un piso de
    tres plantas): **toda la sala se ve a la vez, sin transiciones**. Varias plantas = un solo dibujo en corte, unas sobre otras
    con su escalera. A prueba en la Lonja (`hotel/lonjaArt.js`); los pisos de los vecinos, más adelante.
  - **La Lonja** (4-11-2026): el panel, con la soltura del casino («el mejor menú») **pero sin ser igual**: cara propia de
    mercado (clases `lj-`: toldo, pizarra, etiquetas de estraza). **Fuera las mascotas**, además de místicos y sagas. Tiene que
    dar libertad sin que se pueda explotar la economía: reglas en `20261114120000_hotel_lonja.sql`. Su minijuego lleva escena dibujada, no botones sueltos, y sus sellos nunca son tickets: desde la 1.86 es «La estiba» (`hotel/estibaArt.js`), que sustituye a la pesada de Remedios.
    **La Lonja pasa a ser un gran almacén de muebles en 3D** (encargo de Francisco del 9-11-2026): se recorre como la
    recepción 3D (mismo lenguaje de píxel), con pasillos, expositores, ambientes montados, carrito con planos, directorio y
    caja con cajero. Minijuego diario opcional «Sella el albarán» (0/3/6/10 % de descuento, uno al día por cuenta, reinicio en
    el servidor, alternativa sin reflejos). Compra atómica en el servidor, con la moneda y el catálogo de siempre. Se visita
    con un amigo (seguimiento mutuo), cada uno con su carrito, monedas y descuento. El mercadillo de la Lonja de antes
    (puestos, tablón «Se busca», «La estiba» y su pared de premios) **se conserva** como acceso secundario dentro del almacén.
    **El albarán se juega en el propio mostrador 3D** (9-11-2026): la cámara baja a la cinta, sin abrir nada encima.
    **Ampliación pedida el 9-11-2026** (por bloques con capturas): el carrito se ve delante de ti con los paquetes de lo
    que llevas; el albarán de la caja, más pequeño y orgánico; **ofertas** (cada día unos muebles al azar con descuento y
    cada semana alguno con un gran descuento, decididas por el servidor); **colecciones por zonas temáticas como en una
    tienda de muebles con habitaciones montadas** (una zona contigua de pequeñas habitaciones; la primera, de
    superhéroes, con su rincón especial, y un par de habitaciones normales alrededor para que no quede vacía); y algo
    para la ropa. Superhéroes: género y guiños originales, nunca personajes, emblemas, logos ni diseños oficiales.
    **Decisiones de Francisco (9-11-2026)**: ofertas, **4 muebles al día con −20 %** y **1 a la semana (desde el lunes) con
    −50 %**, al azar y decididas por el servidor; se suman al albarán con el descuento total limitado al 60 %. Solo en el
    almacén: la tienda y el resto de precios no cambian. Ropa: **un probador con espejo** para cambiarte la ropa que ya
    tienes (no vende ropa ni toca misiones ni casino). Superhéroes: **muebles nuevos a la venta** (5-6 originales con
    modelo 3D a la altura de la casa; migración nueva, la aplica Francisco).
    **Segunda ampliación** (encargo de Francisco del 10-11-2026, por bloques con capturas): al entrar, **escaleras mecánicas a una
    planta de abajo**, con el recorrido visible al bajar y subir; abajo, **la planta de ropa**, como una tienda de ropa, dividida por
    zonas, con una **cesta** para llevar lo que te gusta y **probadores** (los de arriba se mueven allí). **Antes de bajar, si llevas
    muebles en el carrito, hay que pasar por caja.** La zona de habitaciones, **más grande**, con más habitaciones **cerradas por
    ahora** hasta que lleguen muebles. Decisiones de Francisco (10-11-2026): **ropa nueva propia de la planta, a la venta con
    tickets**; la de misiones, casino y estiba se ve colgada pero **sigue sin venderse** (dice cómo se gana). Los muebles de las
    **habitaciones especiales** (hoy «Capa y Antifaz») cuestan **el doble** (común 40, poco común 80), en el almacén y en la tienda
    del bajo, y **nunca se rebajan**: ni ofertas del día o de la semana ni descuento del albarán. **Las habitaciones cerradas**
    (10-11-2026): nada industrial (no persianas metálicas), con cortina de terciopelo y caballete; la sala no es un pasillo plano
    (placita con bancos y arco del «ala nueva») y **las habitaciones con muebles van antes** que las cerradas.
    **El almacén en el ordenador** (encargo de Francisco del 15-11-2026; plan en `docs/qa/almacen-ordenador.md`, por bloques con
    capturas; aprobado «Sí, las recomendadas»): en el ordenador del piso, una tarjeta «En el almacén» en el escritorio y la
    pantalla «Almacén» (lo que sigues, ofertas de hoy, nuevo y todo el almacén). **Avisa** en esa tarjeta y con una «!» roja
    pequeña **sobre el monitor del piso**, solo para lo tuyo (un mueble que sigues rebajado hoy, un mueble nuevo sin ver); se va
    al verlo; sin sonidos de aviso, notificaciones, cuentas atrás ni las ofertas de mañana. **Nuevo** = lo que entra a la venta
    en el almacén (nuevo o un retirado que vuelve rehecho), 30 días desde que llega, con la «!» hasta verlo; lo que ya había
    cuenta como visto. **Los deseados**, lista propia y privada **en el servidor** (migración nueva, la aplica él), aparte de
    «Se busca»; los de las habitaciones especiales no se siguen (nunca se rebajan). **Tocar un mueble** abre el almacén
    **directamente** (sin limusina ni paseo), delante de él con su ficha abierta, y «Al ordenador» vuelve.
    **Las colecciones del ala nueva y la colección premium** (encargo de Francisco del 26-11-2026; 1.149, SPEC §149): las cuatro
    habitaciones del ala nueva, abiertas con sus sets (Lumbre y Lana, Cristal y Helecho, Buhardilla de Octubre, al doble como toda
    habitación especial, y **Medianoche, la colección premium**). **Modelo premium, el menos agresivo**: la ve todo el mundo, se
    compra con tickets a precios muy altos, **nunca se rebaja ni sale en sobres**, y con la futura suscripción será mucho más
    barata; la ficha lo dice sin presión (sin botones, cuentas atrás ni avisos). **Cifras aprobadas** (26-11-2026, aceptó la tabla
    propuesta): chéster 600, biblioteca 550, vidriera 400, globo 350 y candelabro 300 (2.200 en total), y con la suscripción el
    40 % (880). **Un solo punto dice si alguien es suscriptor**: `esSuscriptor()` en `src/domain/suscripcion.js` y
    `piso_es_suscriptor()` en el servidor; hoy siempre no. La suscripción se enchufa cambiando solo esos dos, nunca el catálogo.
    Antes de enchufarla hay que decidir qué pasa con regalar o poner en la Lonja lo premium comprado barato.
  - **Identidad de los muebles** (4-11-2026, aprobado por Francisco; por bloques con capturas). Motivo: nadie compraría en la
    Lonja un sofá que la tienda vende igual.
    - **Acabados**: algunas copias salen con un acabado propio (cambio de colores y efecto discreto sobre el mismo dibujo;
      empezar con tres o cuatro, unos más raros que otros). Solo comunes, poco comunes y raros; nunca místicos, mascotas ni
      sagas. En sobres, **1 de cada 20 copias**: se sortea primero el mueble, como siempre, y después el acabado, sin tocar
      rarezas ni pity, y la probabilidad se ve en el sobre. **La tienda vende siempre liso.** Con sellos se consigue uno
      concreto, sin azar y caro. La copia conserva el acabado al venderla o regalarla. Lo ya poseído sigue liso.
    - **Tiene que notarse**: una copia con acabado se ve claramente distinta a las demás, y el sobre que la trae se abre con
      **otro brillo, más llamativo**. Solo cuando de verdad la trae: nada de falsos «casi» (§ «Sobres de la tienda»).
    - **Colecciones de taller**: los muebles son de talleres con nombre; completar uno da una placa en el piso y un premio.
    - **Tablón «Se busca»** en la Lonja: marcas el mueble que quieres, sin texto libre.
    - **Catálogo rotatorio** de la tienda: idea aplazada, no hacerla sin que la pida.
  - **Reestructuración de muebles** (Francisco, 9-11-2026, «que cada mueble se sienta bien»; por bloques con capturas):
    - **Fuera todos los muebles de saga** y los que no tengan un modelo 3D a la altura de los de la casa. Se quedan los de la
      casa (sillón, lámpara de pie, estantería, mesa, escritorio, mesa baja, ventana) y lo de pared con dibujo (cuadro, espejo,
      mapa, balda, reloj, tapiz, guirnalda, neón y placas). Se retiran sin borrar (`RETIRADOS` en `retirados.js`): quien los
      tiene los conserva y vuelven cuando se rehagan al nivel de la casa. Galería para comparar: `e2e-community/muebles-galeria.spec.js`.
    - **Sobres cerrados por reforma** (decisión de Francisco del 9-11-2026): sin los muebles retirados apenas quedaba qué
      sortear. El servidor ya no abre sobres (también el de la caja del casino) y lo retirado no se compra, ni se cambia en el
      casino o la lata, ni se regala ni se pone en la Lonja (`20261123120000_muebles_reforma.sql`, la aplica Francisco); la
      tienda lo dice (`SOBRES_CERRADOS` en `economy.js`). Se reabren cuando haya muebles rehechos que sortear.
    - **Muebles divididos por zona de la casa** (no por tipo): rincón de lectura, salón, dormitorio, estudio, y paredes y suelo.
    - **Las cuatro paredes del piso 3D, del mismo color**: el elegido en Decorar, con la misma luz; solo cambia su sombra natural.
  - **«La estiba»** (4-11-2026, aprobada): sustituye a la pesada de Remedios, que a Francisco no le resultaba intuitiva ni veía
    sus recompensas. Encajar bultos con forma de mueble en la bodega de un barco; una bodega al día, igual para todos, y el
    servidor comprueba la carga. Los premios, siempre a la vista en una **pared de premios** en la Lonja, nunca plegados: sellos
    por nivel de carga, canjeables por toldos, ropa de estibador, una mascota gaviota y acabados. Los sellos ganados se
    conservan y **nunca crea tickets**.
  - **Encargo del 3-11-2026** (antes de seguir con el plan del rascacielos; por bloques con capturas):
    - **Sin «dejar una frase»** (los sellos de frase al vecino): sobra junto al libro de visitas. Se quita de la app;
      no se borran los datos.
    - **Regalos**: **un mueble al día**, solo de rareza **hasta «raro»** (común, poco común y raro) y solo si tienes
      **más de una copia** de ese mueble. Lo comprueba el servidor (migración nueva, la aplica Francisco).
    - El aviso del correo se va al leerlo y no se queda fijo al salir y entrar de una habitación.
    - En el vestíbulo, los menús con **menos protagonismo** que la escena.
    - Más impacto en los sobres y las recompensas (colores y efectos), siempre honestos (§ «Sobres de la tienda»).
    - Más efectos en el edificio; **una tanda de ropa** con **un conjunto aparte con efectos**; **una tanda de muebles
      de todas las rarezas**, con una mascota.
    - **El personaje va andando de verdad** a donde le mandas (p. ej., a la limusina o a la puerta de una tienda) antes
      de cambiar de sitio; con movimiento reducido, directo.
    - **Más difícil mover un mueble sin querer**. Desde la 1.81 (4-11-2026, «cuesta mucho moverlos»): el seguro es
      elegirlo. Elegido con un toque se arrastra sin esperar; sin elegir, basta una pulsación corta.
    - **Al entrar en tu piso, la habitación es la protagonista**: sin la balda abierta; los menús que ya hay, detrás de
      **iconos claros** en la pantalla.
  - **Aprobado el paso a la app** («Sí, prepárala», 1-11-2026): 1.63, SPEC §63. La migración
    `20261101120000_edificio_puerto.sql` la aplica Francisco; sin ella, la tablet hace lo de siempre.
- **Versión privada y paso a producción del piso en primera persona** (7-11-2026, decisión de Francisco):
  - La habitación en primera persona será la pantalla inicial y su puerta llevará al edificio.
  - Mientras dure la transición se conserva una opción para volver a la experiencia anterior, sin reiniciar ni sustituir bibliotecas, lecturas ni decoración.
  - Los datos de demostración, siempre separados de las cuentas reales; en producción no se cargan.
  - Se integra en `main` solo después de que Francisco lo compruebe en Android y en Safari de iPhone con la preview.
  - ~~No ampliar todavía el contenido del rascacielos.~~ **Levantado el 9-11-2026** (Francisco: «ahora me gustaría que
    empezáramos con el rascacielos»): al llegar al Gran Hotel se entra en la recepción recreada en 3D, con el mismo
    motor que la habitación en primera persona y botones con el diseño de la recepción. Se planea primero y se hace por
    bloques, con capturas entre uno y otro.
  - **Publicado en la 1.87.0** (7-11-2026). La experiencia anterior va como en la 1.86: **Rincón 01 está apagado** (`RINCON_01` en `bookcaseLayout.js`) hasta que Francisco lo apruebe.
- **Hacia la Play Store** (Francisco, 20-11-2026): se prepara la app para publicarla en Google Play; plan y decisiones
  pendientes en `docs/qa/play-store.md` (empaquetado como TWA de `libotown.es`, borrar la cuenta, páginas legales,
  moderación, errores, Android). Por bloques con evidencias; las páginas legales no se redactan con datos inventados.
  Decisiones del mismo día (plan §7): responsable, él; **edad mínima 16** (casilla al crear la cuenta, sin fecha de
  nacimiento); al borrar una cuenta, **lo que dejó a otros queda como «Lector anónimo»** (no se borra); **modera él**;
  cuenta de desarrollador **personal** (prueba cerrada obligatoria); paquete `es.libotown.app`; planes de pago, por confirmar.
  El correo de contacto será uno de `libotown.es` que creará él. La migración del borrado, **aplicada** el 25-11-2026 (sin publicar la app todavía).
- **La web de Libotown** (Francisco, 26-11-2026: «he pensado que podríamos hacer ya la pagina web de la app, y que podriamos
  inspirarnos en la sección de libotown de mi portfolio»; eligió «En la raíz»): en `libotown.es`, **quien llega nuevo ve la web**
  y **quien ya usa la app** (con cuenta en ese navegador o con la app instalada) **entra directo**, como hasta ahora. La app **no
  se muda** a otra dirección (se perdería lo guardado en el dispositivo, como los EPUB, y la app instalada). Páginas estáticas en
  `public/web/` (sin librerías, como las legales), con el estilo de la sección de Libotown del portfolio (`../portfolio-web/`) y
  capturas de perfiles de prueba, nunca de sus cuentas. **Interactiva y espectacular** (Francisco, al ver la primera versión:
  «quiero que sea mucho más interactiva y con más espectacularidad»): portada que se acerca al hotel, historias con el móvil fijo,
  fachada con «!», minijuegos del café y las chisteras, y Libo acompañando; sonido solo tras activarlo. **Más cozy, con la portada tal cual** (Francisco, después: «quiero que se
  sienta más cozy aun, el inicio eso si creo que es perfecto»): luz de lámpara, papel con cinta, letra a mano, guirnaldas, vela y
  ambiente de lluvia y chimenea con el sonido; la portada no se cambia sin que lo pida. **Las historias del teléfono, claras** (Francisco, 26-11-2026: «que la sección que cuando bajas se mueven las imágenes […] sea más intuitiva»; 1.148): «02 / 04», «Baja para ver: …» y una barra por paso con flechas, que se tocan. Para lectores: sin «versiones», agentes de IA ni numeración de
  portfolio, y sin prometer nada que la app no haga. Por bloques con evidencias: 1) la web, 2) el reparto en la raíz y el
  service worker, 3) publicar.
- **Libo, el gato guía** (Francisco, 20-11-2026; plan en `docs/qa/libo.md`): el gato del logo, con su nombre, es el puente
  entre la app y el nombre; te guía poco a poco por todo (por capítulos, cuando tiene sentido, siempre saltable) y te da
  sugerencias. Decisiones del mismo día: **empezar con la mascota actual** (`libotown-marca/libotown-mascota.webp`, recortada,
  con poca animación; las poses vendrán después, de su material: no inventarlas); **vive en una esquina, siempre**, con el
  bocadillo del corazón cuando tiene algo que decir; **sugerencias, una al día como mucho y sin presión**, solo de cosas
  reales y apagables en Ajustes; y **acceso al edificio desde la habitación** (la tablet sigue igual). No es un chat con IA;
  dentro del café y del taller hablan Pilar y don Celestino. **Sus poses** (Francisco, 26-11-2026, con su hoja de 15 poses: «añadelas a lo largo de la app, para que parezca que libo esta vivo y le de más alegría»; 1.147, SPEC §147): se recortan de su material con `scripts/libo-poses.mjs` (nunca inventarlas) y las elige `src/features/libo/poses.js`; con movimiento reducido no cambia solo. **Vivo aunque no le toques** (Francisco, 26-11-2026: «que libo tenga un ligero movimiento incluso cuando no estés tocándolo»; 1.148): se mece y, en calma, de vez en cuando un saltito o mira al otro lado, en la app y en la web; nunca suena ni pide nada. **Bloques 1 a 4 aprobados y publicados** (1.145.1, 25-11-2026; `docs/qa/libo.md` §6): en las
  e2e con cuenta simulada, el simulador da por vistos todos sus capítulos (`bookshelf:libo`, una lista) y por asomado el
  bocadillo del día (`bookshelf:libo-asomo` = `9999-12-31`) para que no tapen la pantalla; las pruebas de Libo lo cambian.
  **Sus avisos y sugerencias solo dicen cosas de verdad** (bloque 3): si un dato no se puede saber sin preguntar al servidor
  o sin adivinar, Libo no lo dice; una sugerencia al día como mucho, el bocadillo asoma solo una vez al día y sin sonido, y
  nunca rachas, cuentas atrás, prisas ni nada de pago. **Libo se aparta de lo que tiene controles propios** (la barra, el obrador,
  el taller y Decorar del café, las salas del hotel, el armario): ahí no sale, para no tapar a Pilar ni la barra.
  **Bloque 4** (Francisco, 22-11-2026: estados vacíos, Atrás de Android y legibilidad; **la habitación ilustrada se queda como
  está**). **Atrás del móvil cierra lo último abierto** dentro de una escena, igual que su botón de volver: toda pantalla, hoja o
  capa nueva dentro de una escena se apunta con `useAtras` (`src/hooks/useAtras.js`); en el café, su botón de volver lleva
  `data-atras` y `Cafe.jsx` añade su condición a `capaAbierta`. Sin botón de volver a la vista (a mitad de un gesto) o con
  cambios sin guardar, Atrás no hace nada. **Toques de 44 px**: un control que se dibuja más pequeño se toca en 44 sin cambiar
  su aspecto; ojo, un `clip-path` (las esquinas de píxel del café) recorta también el toque, y un pseudo-elemento se mide desde
  dentro del borde.
- Las herramientas de prueba (p. ej. simular sellos) van solo con `import.meta.env.DEV`, botón y acción.
- **Biblioteca grande** (1.59, §59): la biblioteca cerrada no monta libros; el escaparate y los lomos solo montan lo
  cercano a la vista (no medir ni buscar libros en el DOM: puede no estar montado). Las portadas se piden una vez por URL
  (`watchCover` en `BookItem.jsx`). Para medir: `node scripts/perf-large-library.mjs` (datos sintéticos, nunca la
  cuenta de Francisco); no dar por resuelto el rendimiento del iPhone sin probarlo en el iPhone.
- **Pruebas acotadas** a lo que se cambia: build + pruebas relevantes. **Nada de `npm run qa:full`** ni auditorías
  globales salvo que lo pida.
- **No afirmar pruebas en iPhone o Safari reales**: aquí solo hay emulación (Chromium y WebKit de Playwright).
- **Fidelidad con maquetas**: comparar capturas al mismo tamaño (390 px; revisar 360, 430 y escritorio) y declarar
  las diferencias que queden. No usar una maqueta como fondo ni recortar botones con texto de ella. Si falta un
  recurso imprescindible, decirlo y pedirlo en vez de improvisarlo.
- **Maquetas como guía, no como relleno**: no inventar funciones, datos, iconos ni adornos para llenar huecos de una
  maqueta; no implementar controles (p. ej. escaneo) solo porque aparezcan en ella. Separar ilustración, recursos,
  contenido dinámico y controles reales.
- **Efectos**: solo respuestas discretas (presión, sonido breve por acción); respetar silencio, volumen y movimiento
  reducido; nada de sonido antes de una interacción.
- **Sonidos de lumina-sfx** (https://github.com/LuminaBench/lumina-sfx; Francisco, 27-11-2026, tras escuchar las muestras de
  `qa-report/lumina-muestras/`: «Ponlos todos menos el de la lluvia, pero vamos a dejar anotado este tema para más adelante»):
  **aprobados los 14 del vídeo** (lista en «Pendiente» de `docs/ESTADO.md`); la lluvia sigue siendo la de hoy. Es una excepción
  a «sonidos propios y sintetizados» solo para esos; para otros, enseñarle muestras antes. **Se hace más adelante**, no ahora.
  Al hacerlo: renderizar solo lo elegido a archivos pequeños (nunca meter su motor ni su catálogo en la app), con su `LICENSE`
  y los créditos al lado; sus sonidos no se reparten como paquete. Mismas reglas de efectos de siempre.
- **Al terminar un bloque**: subir la versión en `src/diag.js`, `package.json`, `public/sw.js` (constante `VERSION`)
  y la cabecera de `SPEC.md`; añadir su sección a `SPEC.md`; y anotarlo en `docs/ESTADO.md` (apartado 0).

## 2. Comandos

```bash
npm install
npm run dev -- --port 5190 --strictPort   # servidor de desarrollo (el que usan las capturas)
npm run build                              # siempre al cerrar un cambio
npm test                                   # Vitest (dominio, catálogo, RLS con PGlite)
npx playwright test e2e/v135.spec.js --project=chromium-390x844   # e2e de lo afectado
npx oxlint src                             # lint
```

- Proyectos Playwright (`playwright.config.js`): `chromium-360x800`, `chromium-390x844`, `chromium-412x915`,
  `chromium-430x932`, `chromium-844x390`, `chromium-1440x900`, `webkit-390x844`, `webkit-844x390`,
  `chromium-390x844-reduced`. Levantan su propio servidor (no hace falta tener `npm run dev` abierto).
- Comunidad con Supabase simulado: `playwright.community.config.js` + `e2e-community/`.
- La config del panel del navegador de Claude está en `../.claude/launch.json` (entrada «bookshelf», puerto 5190).
- Producción: https://libotown.es (la dirección de antes, https://bookshelf-wine-iota.vercel.app, redirige a ella desde la
  1.136.1) · repo: https://github.com/francisykza/bookshelf (rama `main`).
  Tras subir, comprobar que `https://libotown.es/sw.js` ya trae la versión nueva (y que la dirección de antes sigue con su 308).

## 3. Mapa del código

| Zona | Dónde |
| --- | --- |
| Arranque, paneles y navegación (History API) | `src/App.jsx`, `src/domain/navigation.js`, `src/hooks/useAppNavigation.js` |
| Estado (reducer + localStorage `bookshelf:v1` + migraciones) | `src/state/useLibrary.jsx`; nube: `src/state/cloudSync.jsx`, `src/services/cloud.js` |
| Reglas puras (sin React) y sus pruebas | `src/domain/*.js`, `src/domain/__tests__/` |
| Habitación (escena, hotspots, capas, reflejos, figuras en baldas) | `src/components/room/`, coordenadas en `src/scene/sceneMap.js` (px de la ilustración 941 × 1672) |
| Biblioteca y libro físico | `src/components/shelf/ShelfView.jsx`, `BookItem.jsx` (`PhysicalBook`) |
| Ficha del libro, diario y reseñas | `src/components/book/` |
| Ordenador (6 apps) | `src/components/panels/LaptopPanel.jsx`, `DiaryApp.jsx`, `ReadingCalendar.jsx`, `src/components/computer/ComputerApps.jsx` |
| Figuras (catálogo, Ático, unboxing, detalle) | `public/figures/catalog.json`, `src/domain/figures.js`, `src/domain/figureCatalog.js`, `src/components/figures/` |
| Comunidad, rincón del lector, club | `src/features/social/`, `src/features/reviews/` |
| Sonido (sintetizado con Web Audio, un evento por acción) | `src/audio/uiSounds.js`, `src/audio/ambientAudio.js` |
| Iconos ilustrados de sección | `src/components/SectionIcon.jsx`, `public/assets/icons/sections/` |
| Prototipo de minijuego (solo desarrollo, fuera del build y de la app) | `src/features/minigames/libreria-puerto/`, `dev/libreria-puerto.html` (y `dev/libreria-puerto-app.html`, vista en el móvil de la app), `docs/qa/libreria-puerto.md` |
| «El edificio del puerto» (pisos con vecinos, en la app desde la 1.63) | `src/features/edificio/` (panel, servicio, reglas, dibujo; usa `raster.js` y `audio.js` de `minigames/libreria-puerto/`), estilos en su `edificio.css` (se carga con el panel), páginas `dev/edificio-puerto.html` y `dev/edificio-puerto-app.html`, `docs/qa/edificio-puerto.md` |

**Estilos**: `src/index.css` importa las hojas en orden y **las últimas mandan**. Las capas recientes (cada una
acotada a su zona) son: `library-143.css` (biblioteca y libro físico), `craft-144.css` (materiales de los controles
de biblioteca y ficha), `figures-145.css` (figuras en baldas, su detalle y la pantalla del portátil) y
`computer.css` (ordenador, todo bajo `.pc`), y desde la 1.46: `room-146.css` (cabecera, «Ambiente», accesos, libro de la
cama, registro y pantalla del portátil), `books-146.css` (acabado del libro físico por edición) y `search-146.css`
(buscador y confirmación del alta); desde la 1.47: `library-147.css` (cabecera compacta y fila textil de la
biblioteca) y `room-147.css` (encabezado, accesos, registro y Ambiente); desde la 1.48: `ui-148.css` (correcciones de integración y
selector de lectura); desde la 1.49: `room-149.css` (lectura sobre el libro pintado, `BedPages.jsx`). Desde la 1.51:
`room-151.css` (controles compactos y correcciones generales) y desde la 1.52 `room-152.css` (contenido del libro
pintado y luz del libro de noche) y desde la 1.53 `diary-153.css` («Mi diario» del libro: Reseña, Notas,
Historial) y desde la 1.54 `imports-154.css` (importación de Goodreads, `src/features/imports/`). Desde la 1.55
`epub-155.css` (vinculación y lector EPUB, `src/features/epub/`: el archivo vive solo en IndexedDB del dispositivo, por
cuenta; la posición del archivo y el progreso registrado son cosas distintas, §54; paginado en `epubLayout.js` y
subrayados en `epubHighlights.js`, §55) y desde la 1.58 `social-visit.css` (visita a un rincón compartido, todo bajo
`.reader-visit`; lógica en `src/features/social/visit.js` y `visitScene.js`, §56) y desde la 1.58.1 `hotfix-1581.css`
(correcciones de la auditoría del vídeo, §57: cabecera de las reseñas) y desde la 1.59 `perf-159.css` (biblioteca grande:
filas virtuales, portadas 2:3 estables, figuras del perfil, visita sin pantalla oscura, registro con teclado, §59) y desde
la 1.60 `social-160.css` (comunidad en el cuaderno: perfil, Mi rincón, Entre lectores) y `room-160.css` (libro de la cama, §60) y desde la 1.61 `social-161.css` (habitación de llegada y «Los libros de X» de la
visita, §61; la vista de libros abiertos usa `select: 'libros'` y `'libros/clave'`) y desde la 1.62 `social-162.css` (comunidad en tres pestañas, sillones con tarjeta anclada y fachada de la visita; el volver de la visita es `.reader-visit__leave`, porque `.reader-visit__back` ya era de «Sus libros») y `radio-162.css` (la radio del rincón: objeto del salón, panel y control compacto del EPUB; reproductor único en `src/features/radio/radioPlayer.js`, §62) y `club-162.css` (dentro de un club: pestañas, conversación y redactor, §62.4). La edición visual
`kindle` está retirada: dibujar siempre con `visualEdition(book)`, nunca con `book.editionType` directamente. **Día y noche son la misma habitación** (decisión de Francisco, §50). **Ojo**: `fix-138.css` aún da `top`/`left` con el área segura a `.lib-hero__back`; en un móvil real
eso desplaza el botón (en emulación el área segura es 0). Las hojas antiguas siguen cargadas: antes de crear una clase nueva,
buscar si ya existe con otro uso.

**Recursos**: los originales de diseño están en `material-diseno/`, `art-inbox/` y `assets-source/` (**no están en
git**; solo existen en el ordenador de Francisco). La app usa derivados optimizados en `public/`. Correspondencias:
`docs/design/ordenador-recursos.md`, `docs/design/materiales-controles.md`, `docs/design/asset-manifest.md`.
Maquetas de referencia: `docs/design/references/`.

## 4. Particularidades de este Windows

- Muchos archivos tienen finales de línea **CRLF**. Un reemplazo hecho con un script que busca texto con `\n` falla
  en silencio: usar la herramienta Edit, o normalizar a `\n`, reemplazar y devolver el CRLF.
- En Git Bash, los heredocs y la escritura directa pueden estropear secuencias con barra invertida (`\n`, `\u…`):
  para parches grandes, escribir un script `.cjs` en la carpeta temporal y ejecutarlo con `node`.
- Un `cat > archivo` sin heredoc se queda esperando la entrada y bloquea la orden: no hacerlo.
- Capturas: Playwright con `isMobile`, `deviceScaleFactor: 2`, y esperar a que las imágenes estén `complete`.
  La app guarda el estado con retraso: para sembrar datos de prueba usar `page.addInitScript` antes de recargar.
- Área segura en Chromium: `Emulation.setSafeAreaInsetsOverride` por CDP (p. ej. `top: 45`, como el móvil de
  Francisco). El CDP **no** emula `display-mode`: para ver la app instalada, activar a mano las reglas de
  `@media (display-mode: …)` (así se reprodujo la franja de la biblioteca, §57.3).
- Atajos `border` y `font` de las hojas antiguas reinician `border-image` y las cifras: por eso algunas reglas de
  `craft-144.css` llevan `!important`.
- Desde la 1.58.2 la única prueba que falla es `e2e/v149` en WebKit (Windows no dibuja bien `matrix3d`, ver
  `docs/ESTADO.md`). Si aparece otra, investigar antes de tocarla: no ocultarlas cambiando
  la prueba sin investigar.
- **OneDrive y Node** (14-11-2026): de repente, Node 24 lista los archivos de la carpeta como enlaces (`readdir` con
  `withFileTypes`; el `lstat` dice que no lo son). Playwright los salta y dice «No tests found», con las dos configuraciones.
  Arreglo sin tocar nada en disco: cargar `scripts/onedrive-dirent.cjs` con
  `NODE_OPTIONS="--require ./scripts/onedrive-dirent.cjs"` delante de `npx playwright test` y de `npm run build`. Vitest
  con la ruta del archivo funciona sin él.
- **Windows no distingue mayúsculas en los nombres**: un componente `Libo.jsx` junto a un módulo `libo.js` hace que
  `import … from './Libo'` cargue el `.js`. No dar a dos archivos de la misma carpeta nombres que solo cambien en mayúsculas.
- **Mientras corre una e2e, no tocar ningún archivo del proyecto**, tampoco los `.md`. El escáner de Tailwind v4 lee
  también `SPEC.md`, `CLAUDE.md` o `docs/`, y al cambiar uno el servidor de Vite de la prueba recarga la página. El 14-11-2026
  una prueba del café falló así a mitad de un cliente: al guardar `SPEC.md`, la página volvió a la habitación. Escribir los
  documentos antes o después de la prueba, o en la carpeta temporal.
