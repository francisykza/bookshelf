# Prototipo · «La librería del puerto» (minijuego, solo desarrollo)

Prototipo aislado y jugable. No forma parte de la app, del build ni de la navegación de BookShelf. Usa datos ficticios
rotulados «Demo»:

- No consume tickets ni concede figuras.
- No toca Supabase, la biblioteca, las misiones, el pity, las recompensas ni la sincronización.

Sin commit, push ni despliegue.

## 1. Cómo abrirlo

Con el servidor de desarrollo de siempre:

```bash
npm run dev -- --port 5190 --strictPort
```

Dirección: **http://localhost:5190/dev/libreria-puerto.html**

- **Parámetros opcionales:** `?nivel=n1…n5`, `&modo=reto` y `&vista=app` (como dentro de la app).
- **Vista en el móvil de la app:** **http://localhost:5190/dev/libreria-puerto-app.html** (ver §8).
- **Fuera de producción:** Vite solo construye `index.html`, así que `dev/` no llega a producción. Está comprobado:
  `dist/` no contiene nada del prototipo.
- **Carga diferida:** el juego se carga solo al abrir esa página. La app no importa nada de él.

## 2. Controles e instrucciones

- **Objetivo:** colocar todos los libros de la caja de recién llegados en la estantería.
- **Arrastrar:** coge un libro y suéltalo en una balda.
  - El libro se eleva y va por encima del dedo (44 px con el dedo, 10 px con el ratón).
  - Mientras se mueve, una previsualización marca dónde caería. Si encaja, contorno continuo con relleno salvia; si no,
    contorno discontinuo terracota con un aspa. No depende solo del color.
  - Si lo sueltas donde no encaja, vuelve suavemente a su sitio y el tablero no cambia.
- **Tocar y tocar:** toca un libro (queda elevado) y toca después el destino. Tocar el mismo libro lo suelta. Tocar la
  caja lo devuelve a ella.
- **Girar** (botón, o la tecla R, también a mitad de un arrastre): cambia el libro de pie a tumbado.
- **Teclado** (en la escena):
  - ←/→ eligen libro (o columna, con un libro en la mano).
  - ↑/↓ eligen balda o caja.
  - Intro o Espacio coge y deja; R gira; Escape suelta sin mover; Z deshace.
  - Los avisos se leen en una región `aria-live`.
- **Deshacer y Reiniciar:** no hay cuenta atrás, ni castigo, ni bloqueo por equivocarse.
- **Sonido:** se activa y desactiva con su botón.
- **Movimiento reducido:** sin elevación animada, sin acomodo y sin el brillo de la balda.

### Reglas

- **Cuadrícula:** cada balda es una cuadrícula lógica de `ancho` × `alto` celdas.
- **Medidas de un libro:** de pie ocupa grosor × alto; tumbado, alto × grosor. Girar intercambia ancho y alto.
- **Sin solapes:** ningún libro puede ocupar las celdas de otro.
- **Nada flota:** cada libro se apoya entero, en la tabla o sobre otros libros, en todas sus columnas.
- **Gravedad:** al soltarlo, el libro cae en su columna hasta apoyarse. Si cae torcido o no cabe, la posición no vale.
- **Libros de abajo:** no se puede sacar uno que tiene otro encima.
- **Victoria:** cuando todos los libros están en las baldas. Se anuncia una sola vez por partida, y después el tablero
  queda fijo hasta reiniciar.

### Niveles

Hechos a mano y con su solución en `levels.js`. La prueba de Vitest la recorre paso a paso.

| Nivel | Qué enseña | Libros | Baldas |
| --- | --- | ---: | --- |
| N1 · Primer pedido | Coger y colocar | 4 | A 6 × 4 |
| N2 · Dos baldas | Tamaños distintos: los altos solo caben arriba | 8 | A 6 × 4, B 5 × 3 |
| N3 · Los grandes, tumbados | Girar: dos libros de alto 5 no caben de pie en ninguna balda; tumbados y apilados | 9 | A 7 × 4, B 6 × 3 |

No he medido cuánto tarda una partida con personas reales. Las pruebas automáticas resuelven cada nivel en segundos,
pero eso no dice nada de la duración real.

## 3. Archivos

Todos son nuevos; no se ha modificado ningún archivo existente de la app.

- `dev/libreria-puerto.html`: página de desarrollo, con modo, nivel, guardar y restaurar, «Salir y volver», el ticket de
  demostración y el registro de eventos.
- `src/features/minigames/libreria-puerto/`:
  - `levels.js`: niveles y soluciones.
  - `puzzle.js`: reglas puras, sin DOM: colocar, mover, gravedad, girar, deshacer, reiniciar, victoria, y exportar y
    restaurar con versión.
  - `raster.js`: rasterizador de píxeles adaptado de Pixel Plays, con su aviso MIT.
  - `scene.js`: escena isométrica (estantería, caja, planta, lámpara, radio y suelo). Lo estático se hornea una vez por
    nivel.
  - `game.js`: montaje y desmontaje, controles, interfaz HTML y eventos.
  - `game.css`
  - `audio.js`: sonidos sintetizados con Web Audio.
  - `rewards.js`: adaptador de recompensas de demostración.
  - `devPage.js`
  - `__tests__/puzzle.test.js`
- `e2e/libreria-puerto.spec.js`
- Este documento y `docs/qa/libreria-puerto/` (capturas).

## 4. Qué se ha reutilizado de Pixel Plays y su licencia

He revisado `README.md`, `LICENSE` (MIT, © 2026 Amir Mushich), `MUSIC.md`, `engine.js`, `shell.js` y el juego
`laundry/` (arrastre con el puntero). No he ejecutado ningún script del repositorio, tampoco `serve.mjs`.

**Reutilizado y adaptado** (`raster.js`, con el aviso completo de la licencia MIT en su cabecera):

- La cámara ortográfica inclinada 30°.
- El búfer de profundidad.
- Las rampas de color con el matiz desplazado.
- El tramado Bayer.
- Las cajas con veta (`box`).
- Las sombras proyectadas.
- La oclusión horneada.
- Los bordes a partir de la profundidad.

**Adaptaciones:**

- Todo vive en una instancia, sin globales, y no hay bucle permanente.
- El giro de la cámara es de 20° en vez de 45°, para que la estantería se lea casi de frente en un móvil vertical.
- El lienzo es vertical (200 × 236) y se escala en múltiplos enteros de píxeles del dispositivo, ajustado al ancho del
  móvil.
- La escena solo se dibuja cuando algo cambia.
- Las sombras y los bordes se aplican también al libro que se lleva en la mano.

**De `laundry/` he tomado la idea de control:**

- Coger con `pointerdown`, capturar el puntero y seguirlo, con holgura al tocar.
- Soltar con `pointerup`, y `pointercancel` sin pérdidas.
- Alternativa de teclado.

**No he copiado:**

- La música: según `MUSIC.md` está excluida de la MIT y no se puede reutilizar. No hay ningún archivo de audio; los
  sonidos se sintetizan.
- `shell.js`, que es el menú, los créditos y la música de su propio sitio.
- Personajes, escenas ni ningún otro recurso.

La página de demostración cita el origen en su pie.

## 5. Capturas (`docs/qa/libreria-puerto/`)

| Archivo | Qué muestra |
| --- | --- |
| `01-inicio-n3-390.webp` | Nivel 3 al empezar, a 390 px. |
| `02-arrastre-no-cabe-390.webp` | El atlas de pie no cabe: contorno discontinuo con aspa. |
| `03-arrastre-encaja-tumbado-390.webp` | Girado durante el arrastre: encaja, con contorno continuo y relleno salvia. |
| `04-n3-completo-390.webp` | Nivel 3 terminado, con la estantería y la confirmación. |
| `05-n2-completo-360.webp` | Nivel 2 terminado, a 360 px. |
| `06-arrastre-webkit-390.webp` | El arrastre en WebKit. |
| `07-reto-mensual-demo-390.webp` | Reto mensual de demostración con su recompensa ilustrativa «Demo». |
| `08-n1-completo-escritorio.webp` | Nivel 1 terminado, en escritorio. |

## 6. Pruebas y limitaciones

### Vitest (`puzzle.test.js`, 12 casos)

- Cada nivel se resuelve con su solución, y soltar en la columna lleva exactamente a esa posición.
- El nivel 3 exige girar.
- Las colocaciones inválidas no cambian el estado.
- Gravedad y apoyo incompleto; un libro con otro encima no se saca.
- Mover un libro colocado y devolverlo a la caja.
- Deshacer y reiniciar.
- Victoria solo con todo colocado, y una sola vez.
- Guardar y restaurar. Se rechazan una versión distinta, otro nivel, un JSON roto y un estado manipulado con un libro
  flotando.

### Playwright (`e2e/libreria-puerto.spec.js`)

15 pruebas pasan en Chromium 360, 390 y 430, escritorio 1440, WebKit 390 y Chromium 390 con movimiento reducido. Las
omitidas lo son por tamaño. Cubren:

- **Los tres niveles jugados con tocar y tocar** (y «Girar» en el tercero), sin errores de consola y con exactamente
  tres victorias anunciadas.
- **Arrastre:** posición inválida que vuelve sin cambiar nada, girar en pleno arrastre, `pointercancel` sin pérdidas y
  un libro con otro encima que no se puede sacar.
- **Teclado:** el nivel 1 se resuelve sin ratón, incluidos Escape y deshacer; después, «Volver a jugar» devuelve el
  tablero al principio.
- **Guardar y restaurar.**
- **«Salir y volver» cinco veces:** queda un solo juego montado, sin fotogramas pendientes ni contextos de audio
  abiertos.
- **Reto mensual de demostración:** bloqueado hasta usar el ticket de demostración; la recompensa sale rotulada «Demo».
- **La clave `bookshelf:v1` sigue sin existir:** la biblioteca no se ha tocado.

Además: el build es correcto y no incluye el prototipo, y Vitest completo pasa (292).

### Limitaciones

- **Todo es emulación** (Chromium y WebKit de Playwright). Nada está probado en un iPhone físico: ni el tacto real, ni
  el audio en Safari, ni la sensación del arrastre.
- **Tamaño:** en un móvil de 360 px, un libro de una celda de grosor mide unos 18–20 px en pantalla. El área de toque
  añade unos 10 px de holgura alrededor de cada libro, y existe la alternativa de tocar y tocar. Aun así, conviene
  probarlo con el dedo.
- **El lienzo captura sus gestos** (`touch-action: none`): desplazar la página empezando sobre la escena no funciona.
  Fuera de ella, la página se desplaza con normalidad.
- **Un cambio de tamaño cancela el arrastre**, por ejemplo al girar el móvil: el libro vuelve a su sitio.
- **Geometría provisional:** la escena está hecha con cajas (estantería, libros, planta, lámpara, radio). No hay
  animación ambiental, a propósito.

### Recursos que mejorarían el resultado

- Una lámina de lomos pintados en pixel art con varios anchos, para que los libros no sean cajas lisas.
- Una planta y una lámpara con siluetas propias.
- Una pared de fondo con ventana al mar, en la misma perspectiva.
- Si se quiere música, una pista con licencia propia; la de Pixel Plays no se puede usar.

## 7. Qué faltaría para los tickets y la figura mensual

El juego ya separa reglas y recompensas.

- **Lo que el juego ofrece:**
  - Recibe un nivel y un modo.
  - Informa de `start`, `exit` y `win` (este último, una vez por partida).
  - Exporta y restaura un estado con versión.
- **Lo que hace el adaptador de demostración** (`rewards.js`):
  - Simula el ticket dorado, que abre el reto del mes con reintentos y sin gastarse en cada uno.
  - Simula una figura ilustrativa, todo en memoria.

Flujo previsto: misiones → ticket dorado → acceso al reto mensual → victoria → figura.

Para que fuera real haría falta:

1. **Servidor, no navegador:** una victoria anunciada por el navegador no prueba nada. Consumir el ticket y conceder la
   figura tienen que ser funciones del servidor (Supabase, con RLS), que validen:
   - Que el ticket existe y es de esa persona.
   - El mes del reto.
   - Que la figura no se ha concedido ya.
   - Opcionalmente, la partida: reproducir las colocaciones enviadas con estas mismas reglas (`puzzle.js` es puro y
     sirve también en el servidor).
2. **Esquema y migración:** tickets ganados por misiones, el reto del mes (nivel y figura) y el registro de victorias.
   Con RLS y pruebas PGlite, como el resto de migraciones. La migración la aplica Francisco.
3. **Integración en la app:** un acceso (por ejemplo, desde la radio o la librería del salón) que cargue el juego bajo
   demanda, sin cambiar las reglas actuales de misiones, pity y cajas, que no se deben tocar sin su decisión.
4. **Diseño de los retos:** un nivel nuevo por mes, hecho a mano y con su solución comprobada como estos.

## 8. Segunda iteración: más acogedora, más juego y vista en la app

- **Escena:** pared de yeso con zócalo, ventana al mar de tarde, cuadro de un barco, alfombra bajo la caja y una gata
  dormida sobre la estantería (todo con cajas del rasterizador, sin recursos de terceros). Al terminar, la lámpara se
  enciende y la luz se vuelve de tarde en 0,9 s (al instante con movimiento reducido). No hay animación ambiental
  continua: el lienzo solo se dibuja cuando algo cambia, para no gastar batería.
- **Encargos: retirados** (decisión de Francisco). Los libros no se distinguen a simple vista, así que un objetivo
  basado en títulos no tenía sentido.
- **Estrellas por movimientos** (decisión de Francisco). El mínimo de un nivel es su número de libros, porque cada uno
  se coloca una vez.
  - ★ por terminar.
  - ★★ si lo haces en el mínimo + 2 movimientos o menos.
  - ★★★ si lo haces en el mínimo exacto y sin pistas.
  - Deshacer cuenta como movimiento. El contador muestra «libros · movimientos · mínimo» mientras juegas.
  - Las estrellas se anuncian con `aria-label` («2 de 3 estrellas»). El evento `win` lleva `stars` y `jugadas`.
- **Pista:** marca durante 4 s el siguiente paso de la solución y lo dice en texto. Si algo lo estorba, avisa de que hay
  que hacer sitio. Quita la tercera estrella. En el nivel de la semana no hay pistas.
- **Niveles nuevos** (solución comprobada en Vitest):

| Nivel | Baldas | Libros | Idea |
| --- | --- | --- | --- |
| n4 «Tres baldas» | A 4×4, B 6×3, C 4×2 | 7 | Los de alto 6 solo caben tumbados en la del medio. |
| n5 «Sin un hueco» | A 7×4, B 5×3 | 7 | Las baldas quedan justas: no sobra ni una celda. |

- **Vista en la app** (`dev/libreria-puerto-app.html`). **Entrada elegida por Francisco: una app más del ordenador.**
  Es un móvil de 390 × 844 con este recorrido:
  1. La habitación real (captura con un perfil de prueba vacío, `app-habitacion.webp`). El portátil de la mesita ya
     abre el ordenador en la app.
  2. El escritorio del ordenador (captura, `app-ordenador.webp`) con el dock rehecho en HTML: los seis iconos reales de
     `public/assets/icons/sections/` y una séptima app, «Librería».
  3. El juego en una ventana como las demás apps (cabecera con icono, título y ✕), cargado en un marco con
     `?vista=pc`. Es como `?vista=app`, pero sin cabecera propia. Al cerrar la ventana el marco se vacía y el juego se
     desmonta; «Salir» vuelve a la habitación.
- **Recurso pendiente:** el icono de «Librería» (`icono-provisional.webp`) es un recorte de 64 px del propio juego.
  Haría falta un icono ilustrado como los otros seis del dock. Con siete apps, el dock sigue cabiendo a 360 px
  (columnas de 44 px como mínimo).
- **Capturas:** `09-n4-escena-acogedora-390.webp`, `10-n5-libreria-abierta-390.webp`, `11-app-entrada-portatil.webp`,
  `12-app-ordenador-dock.webp`, `13-app-juego-en-ventana.webp`.
- **Limitaciones:**
  - Las pistas no se guardan con la partida: al restaurar, cuentan desde cero.
  - En el escritorio, la vista previa dibuja el lienzo a escala 1. La escala entera depende de los píxeles del
    dispositivo; en el móvil sale a 1,5.

## 9. Ranking semanal y mensual y distinción en el perfil

Decisiones de Francisco: cada semana hay un **nivel nuevo generado automáticamente**, y la distinción es para el
**top 3 semanal y mensual**. En el prototipo todo es de demostración. Lo que haría falta en el servidor está en «Para
hacerlo de verdad».

### Nivel de la semana (`weekly.js`)

- **Semilla:** la semana ISO, p. ej. `2026-W44`. Así todo el mundo juega el mismo nivel, y el servidor puede generarlo
  igual.
- **Construcción:** llena cada balda a lo ancho, sin huecos. Usa libros de pie y pilas de libros tumbados del mismo
  largo; algunos son más largos que cualquier balda, así que solo caben tumbados. Esa construcción es la solución, de
  modo que **siempre se puede resolver** y el mínimo es un movimiento por libro.
- **Límites para que quepa en el lienzo:** como mucho 9 libros, grosor total ≤ 11 y alto total de baldas ≤ 9.
- **Comprobado en Vitest:** 200 semanas seguidas se resuelven paso a paso en el mínimo, y la misma semilla da siempre el
  mismo nivel.
- En el juego es el botón «Semana» (o `?nivel=semana`; `&semana=2026-W45` elige otra semana). Va en modo `semanal`:
  sin pistas y con «Cada movimiento cuenta para el ranking».

### Orden del ranking (`ranking.js`, puro y con pruebas)

- **Semana:** cuenta el mejor resultado de cada persona. Menos movimientos primero; a igualdad, quien lo consiguió
  antes.
- **Mes:** suma las semanas cuyo jueves cae en ese mes (como el año ISO).
  1. Primero, quien ha completado más semanas.
  2. Luego, menos movimientos de más (movimientos − mínimo) en total.
  3. A igualdad, quien terminó antes su última semana.
- **Podio:** los tres primeros de cada periodo reciben la distinción, con su puesto en la nota (`1.º · semana 44`).
- **Distinciones:** `libreria-semana` («Podio de la semana») y `libreria-mes` («Podio del mes»). Tienen la misma forma
  que `DISTINCTIONS` de `src/features/social/huellas.js`.
- **El panel «Ranking»** tiene pestañas Semana y Mes y muestra los 10 primeros más tu puesto. Te dice dónde quedarías
  si el periodo cerrara ahora y muestra cómo se vería la distinción. Escape lo cierra.

### Qué es de demostración

- Los demás lectores son inventados (`demoResults`, reproducibles por semana).
- Tu resultado se guarda en este navegador (clave `bookshelf:dev:libreria-puerto:semanas`). Antes de guardarlo, la demo
  repite tus jugadas con `replay`, como haría el servidor.
- No hay nada en Supabase ni en tu perfil real.

### Validación de partidas (`replay` en `puzzle.js`, ya hecho)

- La partida guarda sus **jugadas**: `poner` (libro, balda, x, y, orientación), `caja` y `deshacer`.
- `replay(level, jugadas)` las repite desde cero con las mismas reglas. Devuelve el estado final, o `null` si alguna no
  vale: libro en el aire, solapes, libros inventados, jugadas mal formadas, deshacer sin nada o jugar tras ganar.
- **Los movimientos se cuentan al repetir, nunca se toman del cliente.**

### Para hacerlo de verdad (pendiente de aprobación de Francisco; nada de esto está hecho)

1. **Migración** en `supabase/migrations/`, que aplica Francisco:
   - **`libreria_niveles (semana, nivel jsonb)`:** los niveles de las próximas semanas, generados con `weekly.js` por un
     script y publicados por adelantado. Así el servidor no tiene que portar el generador.
   - **`libreria_partidas (user_id, semana, movimientos, minimo, jugadas jsonb, creada_en)`:**
     - RLS activada.
     - Sin `insert` directo: solo mediante la función siguiente.
     - Cada persona lee sus filas.
   - **Función `libreria_enviar_partida(semana, jugadas)`** (`security definer`):
     - Exige sesión.
     - Exige la semana en curso (hora de Madrid).
     - Repite las jugadas con las reglas portadas a SQL. Una prueba con PGlite comprobaría que da lo mismo que `replay`.
     - Guarda el mejor resultado con la hora del servidor, que es la que desempata.
   - **Función `libreria_ranking(periodo)`:** devuelve los 10 primeros y tu puesto, solo con nombre y avatar públicos.
   - **Función `libreria_cerrar_periodo(...)`:** inserta el podio en `distinctions`. Puede ejecutarla `pg_cron` el lunes
     a las 00:05 (si se activa en el proyecto) o Francisco a mano.
2. **App:**
   - «Librería» como séptima app del ordenador, cargada solo al abrirla.
   - El ranking como pestaña de esa app.
   - Las dos distinciones nuevas en `DISTINCTIONS`.
3. **Recursos que faltan:**
   - El icono ilustrado de la app.
   - La ilustración de las dos insignias (`badge-…webp`), como las demás distinciones.
4. **Límites honestos:** repetir las jugadas garantiza que la partida es legal y que los movimientos son los que dice.
   No impide resolver el nivel con ayuda externa. Con niveles generados, los mejores empatarán a menudo en el mínimo, y
   decide quien llegó antes.

### Capturas y pruebas

- **Capturas:**
  - `09-n4-escena-acogedora-390.webp`, `10-n5-libreria-abierta-390.webp`.
  - `11-app-entrada-portatil.webp`, `12-app-ordenador-dock.webp`, `13-app-juego-en-ventana.webp`.
  - `14-nivel-semana-390.webp`, `15-ranking-semana-demo-390.webp`, `16-ranking-mes-demo-390.webp`.
- **Vitest (30 casos del minijuego):** reglas, soluciones, estrellas por movimientos, pistas, `replay` (incluidas
  partidas trampeadas), generador semanal (200 semanas) y orden del ranking y del podio.
- **e2e (20/20, emulación de Chromium y WebKit; sin iPhone real):**
  - Cinco niveles con tres estrellas.
  - Una pista quita una estrella.
  - Recorrido por el ordenador.
  - El nivel de la semana jugado con toques: entra validado en el ranking y Escape cierra el panel.
