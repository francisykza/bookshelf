# «El Gran Hotel del Puerto» · plan (sin decidir)

Estado: **bloque 1 en la app (1.74, §74.4): la limusina y la fachada del hotel; aún sin salas.** El resto, propuesta. El concepto está dibujado en `dev/hotel-concepto.html` (solo
desarrollo; captura en `qa-report/hotel-concepto.png`). Cada bloque se enseña con capturas y necesita el «sí» de Francisco
antes del siguiente, como en el edificio.

## 0. Hecho hasta ahora (solo desarrollo)

- **Fachada viva y que se toca** (2-11-2026, Francisco: «más espectacular aún» y «que de lugar a interacción desde la
  propia fachada»): `src/features/edificio/hotel/hotelView.js` sobre el dibujo de `hotelArt.js` (antes en `dev/`). Focos que barren el cielo, aguja
  que parpadea, bombillas de la marquesina que corren, neón que titila, ventanas que se apagan y encienden, agua que
  ondula, paseantes y bocadillos de frase cerrada; estrellas fugaces y fuegos artificiales de pixelfx
  (`src/vendor/pixelfx`) detrás de la torre. Cada planta se ilumina con su contorno dorado al pasar por encima y al
  tocarla abre su tarjeta (abajo, también una fila de botones por planta, para el teclado). Movimiento reducido: dibujo
  quieto que se sigue tocando. 60 fps en Chromium de escritorio; falta medirlo en un móvil.

## 1. La idea de Francisco (2-11-2026)

Un gran hotel rascacielos, de noche y espectacular, con nuestra estética, como **edificio principal** donde conocer
gente «un poco como Habbo» y donde viva **la parte social más abierta** de la app. Del género se toma la idea (salas
compartidas con tu personaje, gente moviéndose a la vez); nada de su arte, nombres ni interfaz.

## 1b. La llegada: en limusina (decisión de Francisco del 2-11-2026)

Para ir al hotel **hay que coger una limusina negra de lujo**: original, en nuestro pixel art. Responde en parte a §7.1
(por dónde se entra): la limusina espera en la calle y te lleva al hotel. **Hecho en la 1.74 (§74.4)**: aparcada delante del
portal del edificio, en el muelle, con su chófer; al tocarla, un viaje corto de noche y la fachada del hotel. Falta
decidir si también se llega desde la tablet del Salón.

## 2. Cómo encaja con lo que ya hay

| Hoy | Qué es | Con el hotel |
| --- | --- | --- |
| El edificio del puerto (§63–71) | Tu piso, 6 vecinos, visitas en diferido | Se queda igual: es **lo íntimo**. El hotel es **lo abierto** |
| Comunidad (Lectores / Salón / Clubes, §62) | Perfiles, sillones, clubes, radio | El hotel les da un sitio físico, sin quitar las pantallas actuales |
| Personaje (§69) | Anda y se viste en tu piso | Es el mismo con el que entras al hotel |
| Sellos y libro de visitas | Frases cerradas | Las mismas reglas: **sin texto libre** |

La regla vigente «visitas en diferido; el directo, más adelante» (CLAUDE.md) se mantiene hasta el bloque 3, donde
Francisco tendría que aprobar expresamente el paso al directo.

## 3. Las plantas (de abajo arriba)

1. **La plaza y la marquesina**: llegada. Se ve quién ha entrado hoy (personajes pequeños en la plaza).
2. **El vestíbulo**: la recepción. El conserje te orienta (texto fijo) y hay un tablón de «Busco quien lea…» con
   frases cerradas y la obra elegida de tu biblioteca.
3. **El café-biblioteca** (planta 1): mesas donde sentarse con tu personaje junto a alguien que lee lo mismo; cada
   mesa dice qué libro se está leyendo. Es el «Salón» de la comunidad, hecho sitio.
4. **Las suites de los clubes** (plantas intermedias): cada club tiene su habitación decorada por sus miembros (reutiliza
   el motor y el inventario de los pisos). Por las ventanas de la fachada se ve qué clubes están «encendidos».
5. **El salón de baile** (la franja de cristal): eventos con fecha (lectura conjunta de la semana, presentación de un
   club). Es la única sala grande.
6. **La terraza de la azotea**: guirnaldas, la radio del rincón sonando para todos los que estén, sentarse a mirar el
   puerto.
7. **El mirador de la corona**: el bar de arriba, con el ranking de «La librería del puerto» (si se aprueba el
   minijuego) y las distinciones del perfil.

No todas son necesarias: el bloque 2 solo necesita la plaza y el vestíbulo.

## 4. Cómo se habla (sin texto libre)

- **Bocadillos de frase cerrada** (como los sellos y el libro de visitas): «¡Hola!», «¿Qué estás leyendo?», «Me encanta
  ese libro», «Te lo recomiendo», «¿Lo leemos juntos?», «Me voy a leer, ¡hasta luego!»… y la obra que estás leyendo
  como tarjeta, tocando tu personaje.
- **Gestos**: saludar, sentarse, aplaudir, un corazón. Nada que se pueda escribir.
- **Bloquear y denunciar** desde el personaje de cualquiera; el bloqueo ya existe (`is_blocked_pair`) y se respeta en
  todas las salas.
- Ni mensajes privados ni nombres inventados: se ve el alias del perfil, como en la comunidad.

## 5. Técnica

- **Dibujo**: el mismo rasterizador (`raster.js`) y la misma luz de noche del concepto. La fachada, como la del
  edificio, es un dibujo con zonas que se tocan (cada planta lleva a su sala).
- **Salas**: el motor de los pisos (`render.js`, `actor.js`) con salas más grandes que 9 × 9 y varias personas.
- **Diferido (bloque 2)**: cada visita deja tu personaje «sentado donde estabas» unas horas, con su frase. Solo tablas y
  funciones en Supabase, como el libro de visitas. Barato y sin riesgos nuevos.
- **Directo (bloque 3)**: Supabase Realtime (presencia y mensajes por sala). Las posiciones y los bocadillos no se
  guardan; el servidor solo admite frases de la lista y limita la frecuencia. Cada sala tiene aforo (por ejemplo, 12
  personas) y, si se llena, se abre otra copia igual. **Hay que comprobar los límites de Realtime del plan de Supabase**
  (conexiones a la vez y mensajes al mes) antes de aprobarlo.
- **Pruebas**: PGlite para las funciones y Playwright con Supabase simulado; el directo, con dos navegadores a la vez.

## 6. Bloques (cada uno con capturas y su «sí» antes del siguiente)

| Bloque | Qué | Necesita |
| --- | --- | --- |
| 1 | **La fachada del hotel en la app.** El concepto pulido, con su luz que respira, el agua y la gente de la plaza; se llega desde el portal del edificio («al otro lado del muelle») o desde la tablet del Salón. Tocar el hotel aún no lleva a ninguna sala. | Que Francisco decida la entrada (§7) |
| 2 | **Vestíbulo y café en diferido.** Entras con tu personaje, ves a quien pasó hoy sentado donde lo dejó, con su frase y su libro; tablón «Busco quien lea…». | Migración (visitas del hotel, tablón) |
| 3 | **El directo en el café.** Gente moviéndose a la vez, bocadillos cerrados, gestos, aforo, bloquear y denunciar. | Aprobar el directo; comprobar Realtime; migración (límites y denuncias) |
| 4 | **Suites de los clubes.** Una habitación por club, decorada entre sus miembros. | Migración (piso del club y permisos) |
| 5 | **Salón de baile y terraza.** Eventos con fecha y la radio compartida. | Decidir quién crea eventos |
| 6 | **El mirador.** Ranking y distinciones. | Que el minijuego pase a la app |

## 7. Lo que tiene que decidir Francisco

1. **Por dónde se entra**: desde el portal del edificio (el hotel al fondo, al otro lado del muelle), desde la tablet
   del Salón (una tercera opción junto a «Comunidad» y «El edificio del puerto») o las dos.
2. **El directo**: si el hotel es el sitio donde la app pasa de «en diferido» a «en directo» (bloque 3), o si se queda
   en diferido.
3. **Quién entra**: solo perfiles con la comunidad activada (como el edificio) y, en el café, ¿todo el mundo o solo
   quien lee algo en común?
4. **El nombre**: «El Gran Hotel del Puerto» (el del concepto) u otro.
5. **Qué plantas**: las siete del §3 o menos.

## 8. Riesgos

- **El directo es lo más caro y lo más delicado**: moderación, abuso de los límites, gente que no conoces. Sin texto
  libre y con aforo se reduce mucho, pero hace falta la denuncia funcionando antes de abrirlo.
- **Rendimiento en el móvil**: muchas personas en una sala grande. El dibujo del motor ya se hace en un lienzo pequeño
  y se escala; habrá que medir con 12 personajes moviéndose a la vez, en emulación y luego en un iPhone real.
- **Que no se coma al edificio**: el piso sigue siendo lo tuyo; el hotel no debe sustituir al portal ni a la comunidad.

## 9. Las salas nuevas (encargo de Francisco del 2-11-2026) · propuesta, sin decidir

Francisco pidió tres salas concretas (la zona de intercambio de muebles, la habitación de la semana y un casino con su
moneda, ropa exclusiva y una mascota cara de temática casino) y «otras salas en las que intercalar otras funciones de
la app para que todo esté bien relacionado y orgánico». Idea que lo une todo: **cada sala del hotel es la versión
física de algo que la app ya hace**, de forma que no aparecen menús nuevos, sino sitios a los que ir.

### 9.1 El mapa (de abajo arriba)

| Dónde | Sala | Qué función de la app trae |
| --- | --- | --- |
| Sótano (puerta de neón al lado de la marquesina) | **El casino del sótano** | Minijuego diario y fichas (§9.4) |
| Plaza | **Quiosco «La Gaceta del Puerto»** | Reseñas y citas destacadas de la semana (`reviews/`, citas) |
| Vestíbulo | **Recepción, ascensor y guardarropa** | Misiones de la semana como «encargos del conserje», la guía de bienvenida, el tablón «Busco quien lea…» y el armario del personaje |
| Entresuelo | **La Lonja** | Intercambio de muebles (fase 7 de `economia-muebles.md`, §9.2) |
| Planta 1 | **El café-biblioteca y la sala de lectura** | El Pomodoro y el registro de lectura (§9.5) |
| Planta 2 | **La galería de vitrinas** | Tu colección de figuras, a la vista de los demás |
| Plantas intermedias | **Las suites de los clubes** | Clubes (como ya estaba) |
| Franja de cristal | **El salón de baile** | Lecturas conjuntas y eventos de clubes |
| Azotea | **La terraza** | La radio compartida |
| Ático | **La suite de la semana** | El piso con más «me gusta» de la semana (§9.3) |
| Corona | **El mirador** | Ranking de «La librería del puerto», distinciones y el calendario de lectura del año |

**El ascensor es la navegación.** Al entrar, una botonera de latón con una luz por planta (las que aún no abren,
apagadas). Sustituye a cualquier fila de menús (Francisco: «demasiados menús») y se usa también con el teclado. La
fachada sigue sirviendo para tocar una planta directamente.

### 9.2 La Lonja: el intercambio de muebles

En un puerto, la lonja es donde se compra y se vende lo que llega. Aquí hay puestos de madera con toldo, uno por
persona.

- **Tu puesto**: hasta 3 ofertas a la vez del tipo «Doy *sillón verde* · Busco *lámpara de pie*» o «… · Busco *N
  tickets*». El cartel del puesto usa frases cerradas, nunca texto libre.
- **Lo que ofreces queda apartado** hasta que alguien acepta o tú lo retiras, para que no se pueda ofrecer dos veces.
  El cambio lo hace el servidor de una sola vez: o se cambian las dos cosas, o ninguna.
- **Qué se puede ofrecer**: solo copias libres de muebles comunes, poco comunes y raros. **Quedan fuera** los místicos
  (no son moneda, regla vigente) y los sets de sagas (se ganan leyendo su libro).
- **Límites contra la especulación**: precios en tickets dentro de una horquilla por rareza (por ejemplo, un raro entre
  20 y 60), 3 cambios al día y se respetan los bloqueos.
- «Regalar» entre vecinos del edificio se queda como está: la Lonja es la parte abierta.

### 9.3 La suite de la semana

> **1.79 (decisión de Francisco del 3-11-2026): lo de abajo ya no vale.** La suite es una habitación común del ático
> que empieza vacía cada lunes. Cada huésped lleva un mueble suyo, sin perderlo (corriente, de suelo, alfombra o
> pared), lo puede mover, cambiar o retirar, y se ve quién trajo cada cosa. Con 4 semanas aportando, la «Placa de la
> suite» (una vez). Ni pisos de nadie, ni votos, ni tickets. Ver `hotel/SuiteSemana.jsx` y
> `20261109130000_hotel_suite_semana.sql`.

Arriba del todo, en el ático, se ve **el piso con más «me gusta» de la semana**, con el alias de quien vive en él y
una placa dorada. Se entra a mirarlo (solo mirar, como la visita a un vecino).

- **El problema de hoy**: los «me gusta» solo los dan tus vecinos (6 por edificio), así que ganaría siempre el edificio
  más activo. **Propuesta en dos pasos**:
  1. Durante la semana, el piso con más «me gusta» de cada edificio pasa a ser **candidato** y se expone en el
     vestíbulo.
  2. En el hotel, **cualquiera** puede visitar a los candidatos y darles «me gusta» (uno por persona y candidato). El
     lunes, el que más tenga pasa a la suite toda la semana.
- **Solo quien lo quiera**: hace falta un «Presentar mi piso a la suite de la semana» (desactivado de serie), porque
  supone que te vean personas de fuera de tu edificio.
- **Premio**: un mueble exclusivo, la «Placa de la suite» con la fecha, y una distinción en el perfil. Ni tickets ni
  fichas, para que nadie haga trampas para ganar moneda.
- El recuento lo hace el servidor a partir de `piso_megusta.creado`, que ya existe, más una tabla de candidatos y
  ganadores.

### 9.4 El casino del sótano

Un casino art déco de los años 20 bajo el hotel: moqueta roja, lámparas de flecos, mesas de tapete verde y un
crupier. Se entra **una vez al día**.

**Cuidado con esto.** Un juego de azar con una moneda que se cambia por sobres, que a su vez son de azar, es justo lo
que vigilan las normas sobre cajas de botín, y las tiendas de apps clasifican los «juegos de casino simulados» para
mayores de 17. Propuesta: todo el ambiente de casino, pero que **funcione como un juego de habilidad, sin apostar
nada**.

- **No se apuesta**: entras, juegas tu partida del día gratis y ganas entre pocas y muchas fichas según lo bien que lo
  hagas. Nunca se pierde lo que ya tienes, no hay «doble o nada» ni falsos «casi».
- **Se abre si has leído hoy.** La puerta del sótano solo se ilumina si has registrado lectura ese día. Así las fichas
  también se ganan leyendo, en el espíritu de la regla «los tickets solo se ganan leyendo».
- **Fichas**: una moneda aparte que nunca se compra con dinero, con un tope semanal y guardada en el servidor (la
  partida la reparte y la puntúa el servidor, para que no se pueda hacer trampa).

**El minijuego**, tres opciones:

1. **«Las 21 páginas»** *(la recomendada)*: como el veintiuno contra el crupier, pero las cartas son páginas de libro.
   Tres manos al día y fichas por cada mano ganada. Se decide pedir o plantarse, así que hay habilidad, y es lo que más
   sabe a casino.
2. **«La tragaperras de la imprenta»**: tres rodillos con símbolos de libros que paras tú, a tiempo. Habilidad pura y
   muy visual, pero se parece mucho a una tragaperras.
3. **«Parejas del crupier»**: memoria con naipes contrarreloj. La más tranquila y la menos de casino.

**La caja del casino (el canje)**, como la ventanilla de un casino antiguo:

- **Sobres**: uno temático por unas 120 fichas, más o menos uno por semana jugando a diario. Es el mismo sorteo del
  servidor, con sus probabilidades y su pity; no se toca ninguna regla.
- **Ropa exclusiva del personaje**: pajarita y chaleco de crupier, visera verde, fedora y vestido de lentejuelas (de
  80 a 200 fichas).
- **La mascota exclusiva: el conejo de la chistera.** Un conejo blanco que se asoma de una chistera y baraja un naipe
  en el aire, con destellos de picas, corazones, tréboles y diamantes (con pixelfx, como los místicos). Cuesta unas
  1.500 fichas, unos tres meses y medio de partidas diarias. Te acompaña como un legendario y ocupa su sitio: solo uno
  a la vez.
- **Cifras orientativas**: unas 15 fichas de media al día, con un tope de 150 a la semana.

### 9.5 Las otras salas que unen la app

- **Sala de lectura (planta 1)**: te sientas con tu personaje en un sillón y empieza el **Pomodoro** de la app. Los que
  están leyendo a la vez se ven sentados, con la tapa de su libro. Al acabar, ofrece apuntar las páginas con el mismo
  formulario de siempre.
- **Quiosco «La Gaceta del Puerto» (plaza)**: un periódico semanal con las reseñas publicadas y las citas más queridas
  de la semana. Tocar una lleva a la obra.
- **Recepción**: el conserje te da los **encargos de la semana** (las misiones de siempre, con otro nombre) y, la
  primera vez, hace de guía de bienvenida.
- **Guardarropa**: el armario del personaje en el hotel (la cabina de la 1.74) y el escaparate con la ropa del casino.
- **Galería de vitrinas**: tus figuras expuestas en vitrinas de cristal; la de cada uno se puede visitar.
- **Mirador**: el ranking del minijuego, las distinciones (la suite de la semana, las rachas de lectura) y un gran
  calendario de pared con tu año de lectura.

### 9.6 Orden propuesto (cada paso con capturas y su «sí»)

| Paso | Qué | Necesita |
| --- | --- | --- |
| A | **Vestíbulo con ascensor** (la navegación) y recepción con los encargos | Solo cliente |
| B | **La suite de la semana** (candidatos por edificio, votación en el hotel, ganador del lunes) | Migración (candidatos, ganadores, opción de presentarse) |
| C | **El casino** (el minijuego elegido, fichas, la caja, ropa y el conejo) | Migración (fichas, partida en el servidor, canje); decidir §9.4 |
| D | **Sala de lectura con el Pomodoro** y el quiosco | Solo cliente, más una tabla para «leyendo ahora» |
| E | **La Lonja** | Migración (puestos, ofertas apartadas, cambio atómico, límites) |
| F | Galería de vitrinas y mirador | Que el minijuego de la librería pase a la app |

### 9.7 Decisiones de Francisco (2-11-2026)

- **Minijuego del casino**: «Las 21 páginas» (veintiuno contra el crupier con cartas-página, 3 manos al día).
- **Casino**: sin apostar y tras leer. Partida diaria gratis, nunca se pierde nada, la puerta solo se abre si has
  registrado lectura ese día; las fichas se canjean por sobres, ropa y el conejo de la chistera.
- ~~**Suite de la semana**: en dos pasos (candidato por edificio, vota todo el hotel, gana el lunes) y voluntaria
  («Presentar mi piso», desactivado de serie).~~ **Cambiado el 3-11-2026**: el hotel es lo social, lejos del
  edificio, que es lo personal (amigos y conocidos); no se enseñan pisos fuera de su edificio ni se vota. La suite es
  una habitación común que decoran entre todos cada semana (hecha en la 1.79, ver la nota de §9.3).
- **Por dónde empezar**: el vestíbulo con el ascensor (paso A).
