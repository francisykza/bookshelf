# «El Gran Hotel del Puerto» · plan (sin decidir)

Estado: **propuesta, nada aprobado ni implementado.** El concepto está dibujado en `dev/hotel-concepto.html` (solo
desarrollo; captura en `qa-report/hotel-concepto.png`). Cada bloque se enseña con capturas y necesita el «sí» de Francisco
antes del siguiente, como en el edificio.

## 0. Hecho hasta ahora (solo desarrollo)

- **Fachada viva y que se toca** (2-11-2026, Francisco: «más espectacular aún» y «que de lugar a interacción desde la
  propia fachada»): `dev/hotel-vista.js` sobre el dibujo de `dev/hotel-concepto.js`. Focos que barren el cielo, aguja
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
(por dónde se entra): la limusina espera en la calle y te lleva al hotel. Falta que Francisco diga dónde se coge
(propuesta: aparcada delante del portal del edificio, junto al muelle) y si también se llega desde la tablet del Salón.

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
