# La sala de lectura en 3D: plan por bloques (borrador para Francisco, 11-11-2026)

Encargo de Francisco (11-11-2026): «quería que nos pusiéramos con la sala de lectura. Darle un sentido y utilidad real
con respecto al hotel y el usuario para tener un motivo para ir hasta allí solo o acompañado y hacer su correspondiente
recreación en 3D como el resto de habitaciones».

**Respuestas de Francisco (11-11-2026)**: «Vale, me parece bien lo que propone». A solas, **el sillón con tu libro**
(fuera, por ahora, el cuaderno, «Abrir el libro» y la mesa por libro); la cita de lectura, «haz lo que veas mejor» (entra);
la placa del sofá **sin rachas**; y gestos, sí: **una selección de gestos cerrados** para comunicarse. Sin respuesta al
orden: va el recomendado. Con eso los bloques quedan así:

- **a) 1.116** · La sala en 3D y tu sillón con tu libro (sin migración).
- **b) 1.117** · La cita de lectura con un amigo y el sofá para dos (migración `…_sala_citas.sql`).
- **c) 1.118** · La placa del sofá y los gestos (migración `…_sala_parejas.sql`). Gestos propuestos, cerrados: ¡Hola!,
  alzar la taza, enseñar el libro («¿qué tal va?»), «¡qué bueno!», «un capítulo más», «momento intenso» y «buenas noches».

Lo que sigue es el borrador tal como se presentó.

## 1. De dónde partimos

- **La sala de hoy (1.83, §83)** es un dibujo isométrico de 9 × 7 casillas (`hotel/salaArt.js`): parqué en espiga,
  librerías de nogal, una ventana al puerto, alfombra, mesa baja con tetera y **seis sillones** con lámpara. Quien lee
  sale sentado con su personaje y un libro; su compañero legendario, en el suelo. Debajo, el panel (`SalaLectura.jsx`):
  reloj, «Sentarte a leer» (con `SeatChoice`: compartir o no el título), lista de quién lee, «Saludar» y la librería
  común (`SalaLibreria.jsx`, una fila de lomos en HTML).
- **El reloj es el de la app** (`useReadingTimer`, local, con marcas de tiempo): al acabar el foco, `logPomodoro` lo
  apunta en tu biblioteca y sale `SessionReport` para las páginas. La sala no guarda nada propio del rato leído.
- **La presencia es la del salón social** (`reading_presence`): una fila por persona, caduca a los 3 minutos sin
  renovar y **solo se renueva con la app visible** (con el móvil bloqueado no se te ve). Quien se sienta en la sala
  aparece también en el salón: es la misma.
- **Migración ya aplicada** `20261113120000_hotel_sala_lectura.sql`: `sala_lectura_personajes` (aspecto de quien lee,
  aunque sea de otro edificio), `sala_lomos` (hasta 3 al día, un título una vez por persona), `sala_saludos` (un «¡Hola!»
  cada media hora por pareja, entre dos sentados a la vez).
- **Reglas vigentes** (CLAUDE.md, «La sala de lectura del hotel»): se ve a quien lee con su personaje, libro y compañero,
  nunca con iconos; librería común con lomos y nombre (lo decide cada vez, se puede retirar); saludo cerrado sin texto
  libre; al acabar dice con quién has leído; **no da tickets ni recompensas**.
- **Por qué hoy no hay motivo para ir**: leer en la sala y leer en tu piso es lo mismo (mismo reloj, mismo formulario), la
  sala no recuerda nada de ti, y la compañía depende de que coincida alguien por casualidad.
- Motor de referencia: recepción (`recepcion3d.js`), almacén (`almacen3d.js` + `almacenLayout.js`) y casino
  (`casino3d.js` + `casinoLayout.js`): Three.js a 320 px de ancho ampliado sin suavizar, texturas de píxel pintadas una vez
  con las rampas y el tramado del dibujo isométrico y la luz ya pintada, sin luces ni sombras en tiempo real, se anda
  tocando el suelo por una red de pasillos, letreros como placas encima, solo se dibuja cuando algo cambia. Sin WebGL,
  el dibujo de siempre.

## 2. El sentido de la sala

La idea en una frase: **la sala es el sitio del hotel donde la lectura deja rastro** — tuyo cuando vas a solas, y
compartido cuando vas con alguien. Nada de esto da tickets, fichas ni objetos de inventario; lo que se gana es memoria
de lo leído, a la vista en la propia sala.

### 2.1 Ir a solas

1. **Tu sillón.** La primera vez que te sientas, ese sillón pasa a ser «el tuyo» (puedes cambiarlo). Al volver, la sala
   te lleva a él y en su mesita está **tu libro actual con su portada** y un punto de lectura en la página donde vas.
   Si alguien lo ocupa, te sientas en otro (nunca se echa a nadie).
2. **El cuaderno de la sala.** En tu mesita, un cuaderno de piel que lleva la cuenta de lo leído **aquí**: horas en la
   sala, sesiones, libros terminados en ella y con quién coincidiste. Solo lo ves tú. Sale del mismo `logPomodoro` de
   siempre marcado con «en la sala» (va en tu biblioteca sincronizada; sin migración).
3. **Lectura de foco, de verdad.** Al sentarte, la cámara baja a tu sillón mirando el ventanal del puerto (lluvia de
   noche, el faro), la sala se apaga un poco y el reloj del Pomodoro es **el reloj de pie de la sala** (sus campanadas,
   sintetizadas y suaves, marcan el fin del foco, con el sonido activado). Botones mínimos encima. Si tienes un EPUB
   vinculado a ese libro en el dispositivo, **«Abrir el libro»** abre el lector sin salir de la sala; al cerrarlo
   vuelves al sillón.
4. **La librería común, física.** La pared de la librería es la de verdad: los lomos que la gente ha dejado son lomos
   3D en las baldas (mismo color y alto que hoy, sacados del título), los más recientes a la altura de los ojos. Tocar
   uno lo saca un poco y dice qué libro es y quién lo dejó; el tuyo se puede retirar.
5. **La mesa de tu libro.** Una mesa larga de biblioteca con lámparas verdes. Si compartes el título al sentarte y hay
   más gente leyendo **el mismo libro** a la vez, os sentáis juntos en esa mesa, con su cartel («Leyendo *X*: 3»). En la
   mesa están también los lomos de ese libro que la gente ha dejado. Solo con el título compartido: sin compartirlo,
   nadie sabe qué lees.

### 2.2 Ir acompañado

6. **La cita de lectura.** Invitas a un amigo (**seguimiento mutuo**, sin bloqueo, como la mesa para dos del casino) a
   leer contigo: «Ahora», «En 15 min» o «En 30 min», y una duración cerrada (15 / 25 / 45 min). **El aviso le llega estés
   donde estés del edificio** (como el del casino: nota con «Ir a la sala» y el buzón). Si acepta, os sentáis en **el
   sofá para dos** junto a la chimenea, y el reloj es **uno para los dos**: lo pone el servidor, empieza a la vez y acaba
   a la vez aunque uno llegue tarde. Se puede rechazar o dejar caducar sin que pase nada (la invitación caduca a los
   10 min y dice solo «No ha podido venir»).
7. **«Habéis leído juntos».** Al acabar, además de las páginas de cada uno, la sala dice cuántos minutos habéis estado
   **los dos sentados a la vez**. Lo cuenta el servidor con un latido por minuto mientras estás sentado con la app a la
   vista; con el móvil bloqueado no cuenta (es honesto: se dice así).
8. **La placa del sofá.** Cada pareja tiene en el sofá una placa de latón con sus horas juntos y los libros que habéis
   terminado leyendo juntos. Hitos sin presión: 1, 5, 10, 25, 50 y 100 horas, que solo cambian la placa (latón, plata,
   oro). **Sin rachas que se pierdan**, sin avisos de «vais a perder…» ni cuentas atrás. La ven los dos (y nadie más).
9. **Más saludos cerrados.** Además de «¡Hola!», tres gestos sin texto entre quienes leen a la vez: alzar la taza de té,
   enseñar el libro («¿qué tal va?») y «buenas noches» al levantarte. Mismo cupo que hoy (uno cada media hora por pareja).
   Se ven como un bocadillo de píxel sobre su personaje en 3D.
10. **Con desconocidos del hotel** sigue igual que hoy: los ves leer, os podéis saludar y al acabar sabes con quién has
    leído. Las citas, la placa y el sofá son solo entre amigos.

### 2.3 Lo que no se hace

- Ni tickets, ni fichas, ni objetos de inventario, ni sobres: los sobres siguen cerrados y la sala no paga nada.
- Ni texto libre: invitaciones, gestos y carteles son frases cerradas.
- Ni rankings de horas, ni rachas con castigo, ni notificaciones fuera de la app.
- Ni medir «lectura» que no ocurre: los minutos juntos solo cuentan con los dos sentados y la app a la vista.

## 3. La recreación en 3D

Archivos nuevos, como el casino: `hotel/salaLayout.js` (plano, pasillos, sitios), `hotel/sala3d.js` (escena),
`hotel/sala3d.css` (placas y bocadillos); se monta desde `SalaLectura.jsx` con carga diferida; sin WebGL, el dibujo
isométrico de hoy (`salaArt.js` se conserva).

- **La sala**: una biblioteca de doble altura de unas 14 × 18 casillas, de noche. Parqué en espiga, librerías de nogal
  hasta el techo con **escalera corredera de latón**, **una galería alta** con barandilla a la que sube una escalera de
  caracol (en el bloque a, solo decorado; el corte «toda la sala a la vez» se respeta: desde la entrada se ve entera).
- **Entrada**: se llega desde la puerta del café-biblioteca de la plaza (1.115) o desde el ascensor; la cámara entra
  por la puerta acristalada y de un vistazo se ve todo: ventanal al puerto al fondo, chimenea a la izquierda con el sofá
  para dos, los sillones con su lámpara a la derecha, la mesa larga en el centro y la librería común al lado de la
  entrada.
- **Detalles con vida**: lluvia en el ventanal y el faro barriendo, fuego en la chimenea (animación de textura, quieta
  con movimiento reducido), vapor de la tetera, un gato dormido en la galería, el reloj de pie con su péndulo.
- **Quien lee**: con su personaje en 3D (las mismas cajas de `actorBoxes`, como el amigo del casino), sentado, con un
  libro en las manos del color del suyo; el compañero a su lado (el mapache con su modelo 3D; el resto, como en el
  casino). Los sillones vacíos, vacíos: nunca se inventa a nadie.
- **Cámaras**: andar tocando el suelo; al tocar un sillón vas a él y te sientas (cámara baja, mirando al ventanal); la
  librería pone la cámara delante de las baldas; la mesa larga, sentado en ella; el sofá, junto a tu amigo.
- **Lenguaje**: placas de latón con esquinas de píxel para los letreros, botones gruesos de píxel, el mismo tramado y
  rampas que el resto del hotel. Todo propio.

## 4. Bloques (cada uno con capturas comparables a 390 px —y 360, 430 y escritorio—, vídeo del recorrido, pruebas
acotadas, versión, SPEC y ESTADO; se pregunta antes del siguiente)

### a) 1.116 · La sala en 3D (sin migración)
- La sala entera, la entrada desde la plaza y el ascensor, andar, sentarse en un sillón con la cámara de foco, el reloj
  de pie como reloj del Pomodoro, quien lee en 3D con su compañero, la librería común en las baldas, el saludo como
  bocadillo. El panel de hoy, plegado bajo la escena. Sin WebGL, lo de siempre.
- Pruebas: `salaLayout.test.js`, e2e nueva `v1116-sala3d` (y `v183-sala-lectura` adaptada) a 360, 390, 430, escritorio
  y WebKit 390, con movimiento reducido.

### b) 1.117 · Ir a solas: tu sillón, el cuaderno y la mesa de tu libro
- Tu sillón con tu libro en la mesita, el cuaderno de la sala (horas, sesiones, libros terminados aquí, con quién) y
  «Abrir el libro» si hay EPUB. Sin migración para esto (va en tu biblioteca).
- **La mesa de tu libro necesita migración**: la presencia solo guarda el título como texto; para juntar a quien lee la
  misma obra hace falta una clave de obra (`reading_presence.obra`, solo si compartes el título) y una función que diga
  cuántos leen cada obra a la vez. Si Francisco prefiere, la mesa se deja para más adelante y el bloque va sin migración.

### c) 1.118 · Ir acompañado: la cita de lectura (migración)
- Invitar, aceptar o rechazar, el aviso en el edificio (Realtime Broadcast como el casino, y consulta periódica), el
  sofá para dos, el reloj común que pone el servidor y «habéis leído juntos N min».
- Migración nueva: `sala_citas` (una abierta por pareja, caducidad 10 min) y `sala_latidos` (minuto a minuto, solo
  sentado), con funciones `security definer` y RLS cerrada, comprobación de amigo como `piso_casino_amigo`. Ojo con la
  lección de la ruleta: ninguna función `stable` que escriba (`rpc-solo-lectura.rls.test.js` lo vigila).

### d) 1.119 · La placa del sofá y los gestos (migración)
- La placa por pareja con horas juntos y libros terminados juntos, sus hitos (latón, plata, oro) y los tres gestos nuevos.
- Migración nueva: `sala_parejas` (resumen por pareja) y `sala_saludos.gesto` (lista cerrada).

## 5. Preguntas para Francisco (respuestas cerradas)

1. **Ir a solas** — ¿qué entra? *(puede ser más de una)*: a) tu sillón con tu libro en la mesita; b) el cuaderno de la
   sala; c) foco con el reloj de pie y «Abrir el libro» (EPUB); d) la mesa de tu libro (lleva migración).
2. **La cita de lectura con un amigo** (seguimiento mutuo, aviso en el edificio, reloj común, «habéis leído juntos»):
   ¿sí / no?
3. **La placa del sofá** con horas y libros juntos: ¿sí, sin rachas (recomendado) / sí, con una racha **semanal** que no
   se pierde con un mal día sino que se pausa / no? Es solo un adorno de la sala, no un objeto ni un premio: confirma
   que no choca con «no da recompensas».
4. **Gestos**: ¿añadir los tres gestos cerrados (taza, libro, buenas noches) / dejar solo «¡Hola!»?
5. **Orden**: ¿a, b, c, d como arriba (recomendado) / primero lo acompañado (a, c, d, b)?

## 6. Migraciones (las aplica Francisco)

| Bloque | Migración | Qué |
| --- | --- | --- |
| a | — | Solo cliente |
| b | `…_sala_mesa_obra.sql` (solo si entra la mesa) | `reading_presence.obra` y quién lee cada obra |
| c | `…_sala_citas.sql` | Citas entre amigos y latidos |
| d | `…_sala_parejas.sql` | Placa por pareja y gestos |

Cada una con su prueba PGlite (`sala-*.rls.test.js`), sin tocar tickets, fichas ni inventario. Hasta aplicarla, la sala
funciona con lo de antes y no enseña lo nuevo.

## 7. Riesgos y límites

- La presencia y los minutos juntos dependen de la app a la vista: con el móvil bloqueado no se cuenta. Se dice en la
  sala.
- Nada probado entre dos cuentas reales ni en iPhone: las citas se probarán con Supabase simulado y PGlite.
- Chromium sin GPU da a veces «Error creating WebGL context» con varios contextos; ya pasa con el casino.
