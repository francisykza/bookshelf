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
      **Mejoras de la casa y del café**: se le recomendó mantenerlas separadas con los puentes que ya hay (12-11-2026); sin
      decisión suya todavía.
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
- Producción: https://bookshelf-wine-iota.vercel.app · repo: https://github.com/francisykza/bookshelf (rama `main`).
  Tras subir, comprobar que `https://bookshelf-wine-iota.vercel.app/sw.js` ya trae la versión nueva.

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
