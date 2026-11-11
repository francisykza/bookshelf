# El casino del sótano en 3D: plan por bloques (borrador para Francisco, 10-11-2026)

Encargo de Francisco (10-11-2026): «querría que nos pusiéramos con el casino, hazlo más grande, que se vea atractivo e
impactante, y que aparte del minijuego del blackjack, que quiero que lo hagas 3D como el del almacén, añadas otro que sea
una ruleta con premios que se pueda jugar una vez por semana y otro a tu elección, todos con premios y en 3D, y que además
los premios se puedan ver físicamente en una sección de la habitación».

**Nada de esto se programa hasta que Francisco apruebe el plan y conteste las preguntas del §3.**

## 1. De dónde partimos

- Hoy el casino (1.80 a 1.82) es una sala isométrica pequeña (`casinoArt.js`, 9 × 7 casillas) con la mesa de tapete, el
  crupier, la ventanilla de la caja y el neón «21», y debajo la mesa de cerca en HTML (`Casino.jsx`, `cartas21.jsx`).
- «Las 21 páginas»: 3 manos al día, sin apostar, 12 / 8 / 4 / 2 fichas, tope de 150 fichas a la semana. Reparte y puntúa
  el servidor (`piso_casino_repartir`, `piso_casino_jugar`). Se conserva tal cual: solo cambia cómo se ve.
- Mesa para dos (fichas y garbanzos con un amigo), mesas de garbanzos, la caja (fichas → ropa, muebles con efecto, sobre,
  conejo) y la lata (garbanzos → premios humildes y el cambio por tickets). Todo se conserva.
- **Ojo**: los sobres están cerrados por la reforma de muebles (`SOBRES_CERRADOS`): el «Sobre del casino» de la caja no
  puede ser premio de los juegos nuevos.
- Motor de referencia: el almacén (`almacen3d.js`, `almacenLayout.js`) y la recepción (`recepcion3d.js`): Three.js a 320 px
  ampliado sin suavizar, texturas de píxel pintadas una vez con la luz dentro, sin luces ni sombras en tiempo real, se anda
  tocando el suelo por una red de pasillos y solo se dibuja cuando algo cambia.

## 2. Bloques (cada uno con capturas y vídeo a 390 px, comprobaciones, versión, SPEC y ESTADO; se pregunta antes del siguiente)

### a) 1.107 · La sala del casino en 3D, más grande e impactante
- Un sótano art déco de unas 18 × 14 casillas (el doble de largo que hoy): se baja por una escalera de mármol con
  barandilla de latón desde la recepción, con la vista del salón entero al llegar (el «impacto»).
- Moqueta granate con rombos dorados, columnas con capiteles de latón, techo con casetones y lámparas de flecos, neones
  propios («21», la ruleta, el tercer juego), una barra al fondo, palmeras en macetero.
- Cuatro zonas que se ven a la vez y se recorren andando: la mesa de «Las 21 páginas» (y la mesa para dos), la ruleta,
  el tercer juego y **la vitrina de premios**; la ventanilla de la caja y la lata siguen en su sitio.
- En este bloque las mesas aún abren los paneles de siempre (todo sigue jugable). Sin migración.
- Movimiento reducido: sin bajar la escalera animada, se aparece abajo.

### b) 1.108 · «Las 21 páginas» en una mesa 3D con su crupier
- Al tocar la mesa, la cámara se sienta delante del tapete, como el albarán en la cinta del almacén: cartas-página que se
  reparten deslizándose sobre el paño, el crupier en 3D con su bocadillo, las fichas que ganas apiladas a tu lado.
- Pedir / Plantarse como botones gruesos de píxel; el resultado en un cartel y ya (sin «otra más»).
- La mesa para dos se juega en la misma mesa 3D (el amigo en el otro asiento, con su personaje). Mismo servidor, sin migración.

### c) 1.109 · La ruleta de premios, una vez por semana
- Una ruleta grande de latón y nogal en su tarima. Cada casilla es un premio que se ve pintado en la rueda, con su
  probabilidad escrita en un cartel al lado (siempre a la vista).
- Un giro por semana (semana que empieza el lunes, la misma que las ofertas del almacén). **Decide el servidor** el premio
  antes de que la rueda gire; la rueda solo enseña lo decidido. Honesta: frena de forma natural y se para en su casilla,
  sin pasar despacio por el premio gordo para que parezca un «casi», sin cuenta atrás y sin «vuelve la semana que viene» insistente.
  Con movimiento reducido, directo al resultado.
- Migración nueva (`piso_casino_ruleta`, tabla de giros con un giro por cuenta y semana, `security definer`, RLS); la
  aplica Francisco.
- **Hecho en la 1.109** (SPEC §109; `20261201120000_casino_ruleta.sql`). Nueve casillas, propuestas y pendientes de que
  Francisco las confirme: 20 fichas 28 %, esmoquin de terciopelo 7 %, 40 fichas 20 %, lámpara de flecos 6 %, 100 garbanzos 20 %,
  ruleta de sobremesa 5 %, 80 fichas 9 %, reloj de pie art déco 3 % y, la más rara, **el mapache crupier** 2 % (compañero
  legendario en 3D que te sigue por el casino; petición de Francisco del 10-11-2026). Lo repetido, 40 fichas.

### d) 1.110 · El tercer juego (el que elija Francisco, §3.1)
- En 3D, en su rincón de la sala, una partida al día, con premio decidido o comprobado en el servidor. Migración nueva.
- **Hecho en la 1.110** (SPEC §110; `20261202120000_casino_chisteras.sql`): «Las tres chisteras». Tres rondas de 3, 5 y 7
  cambios; 1, 3, 6 o 10 fichas según las aciertas, dentro del tope de 150; el servidor baraja cada vez que se mira la ronda y
  comprueba la elección. Cifras propuestas, pendientes de que Francisco las confirme. Las partidas perfectas se cuentan para
  los premios de la vitrina.

### e) 1.111 · La vitrina de premios
- **Hecho en la 1.111** (SPEC §111; `20261203120000_casino_vitrina.sql`), primera parte: la vitrina con todo lo que ya existe
  (caja, lata, ruleta, pilas y doce copas de hitos), lo que falta tapado con su paño y cómo se gana, y la de un amigo. Los seis
  premios nuevos del §4, en la 1.112.
- **Hecho en la 1.112** (SPEC §112; `20261204120000_casino_premios_nuevos.sql`): el reloj de bolsillo y la alfombra de rombos en
  la caja (180 y 350 fichas) y los sellos de las chisteras (uno por partida perfecta) para la chistera de mago (2), la varita (4),
  el baúl de mago (6) y «Polvo de estrellas» (10). Cifras propuestas, pendientes de confirmar.
- Una pared de vitrinas iluminadas con baldas de cristal en un lado de la sala: cada premio que has ganado en los tres
  juegos se ve allí en 3D (los muebles con su modelo del catálogo, la ropa en un maniquí o percha, las fichas y garbanzos
  como pilas que crecen, y las copas/placas de hitos). Tocar uno lo enseña de cerca girándolo, como un mueble del almacén.
- Al visitar con un amigo se ve también la suya (solo lectura), si Francisco quiere.
- Migración (lo que se ha ganado y cuándo, si no basta con lo que ya guarda el servidor).

## 3. Preguntas para Francisco

### 3.1 ¿Cuál es el tercer juego? (todos originales, en 3D, una partida al día)
1. **«Las tres chisteras»** *(recomendado)*: el conejo de la chistera se mete en una de tres chisteras sobre el tapete y el
   crupier las cambia de sitio; tú sigues con la vista dónde está. Tres rondas cada vez más rápidas. Es de habilidad
   (observación), muy visual en 3D y encaja con la mascota del casino. El servidor fija los cambios y comprueba tu
   respuesta. Con movimiento reducido, los cambios van paso a paso, más despacio.
2. **«La bagatela de latón»**: un tablero inclinado de clavos y campanillas; eliges dónde soltar la bola y la fuerza, y
   cae rebotando hasta una casilla con premio. Muy espectacular, pero tiene más azar que habilidad.
3. **«Parejas del crupier»**: memoria con naipes boca abajo sobre el tapete; encuentras parejas en pocos intentos. La más
   tranquila y la menos de casino.

### 3.2 ¿Qué premios da cada juego?
Propuesta, dentro de las reglas: sin apostar, las fichas nunca se compran y sin tickets nuevos (los tickets solo con sus
tres excepciones; no se añade una cuarta salvo que lo pidas).
- **Blackjack**: igual que hoy (fichas, tope de 150 a la semana).
- **Ruleta semanal** (8 casillas): 20, 40 y 80 fichas; 100 garbanzos; una prenda exclusiva de la ruleta; un mueble trofeo
  exclusivo (p. ej., «Ruleta de sobremesa» con su rueda que gira); y una casilla rara con una pieza aún más especial. Lo
  que ya tienes y sale otra vez se cambia por fichas (sin perder el giro). Las fichas de la ruleta, **fuera** del tope
  semanal (ya es una vez por semana).
- **Tercer juego**: pocas fichas al día según cómo lo hagas (p. ej., 3 / 6 / 10), **dentro** del tope de 150, y una placa
  de hito al completarlo sin fallos.
- **Hitos** (para la vitrina): copas o placas por la primera veintiuna, 10 manos ganadas, el primer giro de la ruleta…
  Solo decorativos.

### 3.3 Los premios de la vitrina, ¿se exhiben o también se usan?
1. **Las dos cosas** *(recomendado)*: lo que ganas va a tu inventario (los muebles los colocas en tu piso, la ropa te la
   pones) y además queda su réplica expuesta para siempre en la vitrina del casino; las copas de hitos, solo en la vitrina.
2. **Solo se exhiben**: los premios de los juegos nuevos son trofeos que se quedan en la vitrina.
3. **Se recogen en la vitrina**: el premio espera allí hasta que lo canjeas en la caja.

### 3.4 Otras que hay que confirmar
- La vitrina, ¿la pueden ver los amigos al visitar el casino contigo?
- La ruleta, ¿también se gira desde la mesa para dos o solo a solas? (Propuesta: solo a solas.)

## 4. Catálogo de premios de la vitrina (aprobado por Francisco el 10-11-2026: «Me parece bien, aunque añadiría quizás 3-4 más»)

La vitrina enseña **todo** lo del casino: lo ganado, iluminado en 3D en su balda; lo que falta, su hueco con la silueta
bajo un paño de terciopelo y una plaquita con cómo se gana. Ocupa toda la pared derecha. Los amigos la ven, solo lectura.

- **De la caja, con fichas (9 de hoy + 2 nuevos)**: visera verde, pantalón de raya diplomática, chaleco de crupier, fedora,
  vestido de lentejuelas, neón «21», mesa de tapete, gramola y conejo de la chistera. **Nuevos**: «Reloj de bolsillo
  dorado» (complemento) y «Alfombra de rombos dorados» (mueble de suelo). El sobre no entra (siguen cerrados).
- **De la lata, con garbanzos (3)**: tarro de garbanzos, baraja de naipes, taburete de barra.
- **De la ruleta (4)**: prenda exclusiva, «Ruleta de sobremesa» (mueble trofeo que gira), una pieza rara y, **nueva**, la
  «Lámpara de flecos» de la mesa del 21 (la octava casilla). Fichas y garbanzos, como pilas que crecen.
- **De las chisteras (3 + 1 nuevo)**: chistera de mago con estrellas (prenda), baúl de mago (mueble), el acabado «Polvo de
  estrellas» y, **nueva**, la «Varita de mago» (complemento). Se ganan con sellos de partidas perfectas: nunca con dinero
  ni tickets.
- **Copas y placas de hitos (unas 12, solo decorativas)**, cuatro por juego.

Unos 34 en total. Los muebles nuevos necesitan su modelo 3D a la altura de los de la casa (si no, quedarían retirados) y su
fila en `piso_catalogo` con migración; los premios nuevos de la caja, su precio en `piso_casino_caja_precios`.
