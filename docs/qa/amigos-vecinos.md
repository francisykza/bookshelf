# Edificios de amigos, sección social y telefonillo

Encargo de Francisco del 26-11-2026:

> Cada edificio debería tener como vecinos únicamente a tus amigos, y que cada grupo de amigos tenga como su propia comunidad
> de vecinos, ahora mismo cada persona que entra en la app (he hecho la prueba con una compañera), se acopla al edificio
> disponible. Que en el ordenador haya una sección social muy atractiva que deje buscar a amigos y tener funciones
> relacionadas con la lectura, y que fuera del edificio tengas como un telefonillo con funciones así, que Libo también esté
> relacionado.

Y después: «borra las vistas isométricas, ya no creo que las usemos más», en otro bloque, cuando esté todo hecho.

## 1. Cómo está hoy

- `asignar_edificio()` (migración `20261101120000_edificio_puerto.sql`) mete a cada cuenta con la comunidad activada en un
  edificio **al azar** con hueco (6 puertas: 1A a 3B) o en uno nuevo si todos están llenos. Por eso la compañera de Francisco
  acabó en su edificio.
- Los pisos (`pisos`) son de cada cuenta, no del edificio: mudarse no toca el piso ni los muebles.
- `mismo_edificio()` decide quién ve qué entre vecinos (pisos, tablón, café, personaje, místicos…).
- **Amigos** ya existe: os seguís los dos (`follows`), los dos con la comunidad y sin bloqueo (`piso_casino_amigo`). Lo usan el
  casino, la sala de lectura, el almacén y las visitas.
- Buscar lectores por alias está en la Comunidad de la tablet (`searchProfiles`, como mucho 20, solo con la comunidad activada).
- El ordenador del piso tiene seis apps más el Almacén; ninguna social.

## 2. Decisiones de Francisco (26-11-2026, las cuatro recomendadas)

1. **La llave de tu edificio.** Cada cuenta nueva estrena su propio edificio. Para vivir con amigos, uno da una llave (enlace o
   código, desde el telefonillo o el ordenador) y el otro decide mudarse, con su piso y sus muebles. Nadie entra sin llave.
2. **Los edificios ya mezclados.** Se queda quien tenga allí a algún amigo; quien no tenga a ninguno se muda a un edificio propio,
   con su piso y sus muebles intactos. Si luego os hacéis amigos, vuelve con una llave.
3. **Crece por plantas.** Al llenarse, el edificio gana una planta (2 puertas más), hasta 5 plantas (10 vecinos). La fachada se
   dibuja más alta.
4. **Lo que ven tus amigos de tu lectura, lo eliges tú.** Por defecto, qué lees ahora y los libros que terminas; nunca notas,
   reseñas privadas ni páginas por día. En Ajustes se apaga todo o una parte. Solo amigos.

## 3. Bloques

Cada uno con evidencias (capturas a 360, 390 y escritorio y vídeo); a `main` solo tras su aprobación.

### Bloque 1 · El edificio de tus amigos (servidor y telefonillo)

Migración nueva (la aplica Francisco):

- `asignar_edificio()`: una cuenta sin puerta estrena **su propio edificio** (puerta al azar de las seis de abajo).
- `edificio_llaves`: la llave de tu edificio. Código corto legible (sin letras que se confundan), **de un solo uso, caduca a los
  7 días**, como mucho 3 vivas por persona; la puede dar cualquier vecino. Se puede retirar.
- `edificio_mudarse(codigo)`: con la comunidad activada, sin bloqueo con nadie del edificio y con hueco. Tu fila de vecino cambia
  de edificio y te da una puerta libre; tu piso y tus muebles van contigo. Gastar la llave y mudarse, en una sola operación.
- `edificio_irse()`: dejar el edificio y volver a uno propio (con confirmación en la app).
- **Una vez, al aplicarla**: en cada edificio, quien no tenga a ningún amigo dentro se muda a uno propio (con la misma letra de
  puerta). Nada se borra. **Ojo**: Francisco y su pareja siguen juntos solo si se siguen los dos; si no, se vuelven a juntar con
  una llave. Antes de aplicarla, que lo compruebe.
- `edificio_portal()` dice además cuántas plantas tiene el edificio y si quedan puertas.

En la app, **el telefonillo** junto al portal (en la calle 3D y en la fachada): una placa de latón con los botones de los
vecinos y una rejilla. Al tocarlo, su panel: llamar a un vecino (entras a su piso, como hoy), **dar una llave** (código y enlace
para compartir), **usar una llave** (escribir un código) e irse del edificio. El enlace `#llave=…` abre la app y pregunta si te
quieres mudar (como las invitaciones a clubes).

### Bloque 2 · El edificio crece por plantas

- Puertas 4A, 4B, 5A y 5B en el servidor (se abren solo cuando las de abajo están llenas).
- La fachada 2D, la calle 3D y sus botones con 3, 4 o 5 plantas; el tejado y el cartel suben con ellas.

### Bloque 3 · La sección social del ordenador

Una app nueva del ordenador del piso, «Amigos», con identidad propia (agenda de cuero y fichas):

- **Buscar amigos**: por alias o por **código de amigo** (el tuyo, para compartir); seguir y ver quién te sigue (solicitudes:
  quien te sigue y tú aún no).
- **Tus amigos**: qué leen ahora y lo último que han terminado (lo que cada uno comparta); visitar su piso, dar la llave del
  edificio.
- **Funciones de lectura**: recomendar un libro tuyo a un amigo (le llega al buzón, sin texto libre, con frase cerrada), «Leemos
  el mismo» (os apuntáis al mismo libro y veis el avance del otro en porcentaje) y la cita de lectura en la sala del hotel (lo
  que ya existe, a un toque).
- **Privacidad** en Ajustes: qué leo ahora, qué termino y el avance de «Leemos el mismo», por separado.

### Bloque 4 · Libo y los amigos

- Un capítulo de Libo para el telefonillo y otro para la app Amigos.
- Sugerencias reales, una al día como mucho: un amigo terminó un libro que tienes en «Quiero leer», tienes una llave sin usar,
  un amigo te recomendó un libro. Nunca rachas ni prisas.

### Bloque 5 · Fuera las vistas isométricas

Cuando esté todo lo anterior. Antes de borrar, la lista exacta de vistas y archivos (el piso, la recepción y el vestíbulo del
hotel, la tienda, las salas…) y qué queda en cada sitio, para que Francisco la confirme. No se borran datos de usuarios.

**Parte A hecha en la 1.155.0** (Francisco: «Sí, borra la A»; la visita, «Quitarla igualmente»; SPEC §155). **La parte B se
queda** hasta que haya 3D.

**Lista enseñada a Francisco (26-11-2026, tras la 1.154.0).** Se quedan siempre, porque los usa
también el 3D o los iconos: `render.js`, `furniture.js`, `catalog.js`, `lobbyLayout.js` (la recepción 3D), `estibaArt.js` y los
ayudantes `evening`, `outlineOf` y `toDataURL` de `shopRoom.js` (se mudarían a un archivo propio).

A. **Con sustituto en 3D (se puede borrar ya)**:
1. *La tienda isométrica del bajo*: `Tienda.jsx` (ya sin montar desde el café), `tienda.css`, `GachaReveal.jsx` (solo la usa la
   tienda) y el dibujo de la tienda en `shopRoom.js`; `dev/tienda-dibujos.html`. Sustituto: el café 3D.
2. *El «Plano» del vestíbulo del hotel*: la vista isométrica de `Vestibulo.jsx` y `lobbyArt.js`. Sustituto: la recepción 3D.
3. *La visita isométrica a un vecino*: entrar directamente en 3D (`VisitaPiso`), sin «Entrar en 3D» ni «Ver en isométrica».
   Se pierden los «me gusta» por mueble, que solo existen en la isométrica.
4. *Los dibujos de respaldo sin 3D* del casino (`casinoArt.js`), la sala de lectura (`salaArt.js`), el café (el local vacío
   de `shopRoom.js`) y el vestíbulo. Sustituto: una pantalla que diga que el móvil no puede mostrar la sala en 3D.
5. *Páginas de desarrollo*: `dev/edificio-puerto.html`, `dev/edificio-puerto-app.html` y `devPage.js`.

B. **Sin sustituto todavía (no se borra sin hacer antes el 3D o sin que Francisco renuncie a ello)**:
1. *Decorar tu piso*: el único editor de muebles es el isométrico (`VistaActual` en `PisoLabPanel.jsx`, `piso.js`).
2. *Tu piso desde tu ventana de la fachada* (`PisoView` en `EdificioPanel.jsx`): el personaje que anda y se sienta, las
   misiones diarias de la habitación (dan ropa o 5 tickets), el armario desde el piso y el capítulo 4 de Libo («tu-piso»).
3. *El respaldo de la habitación sin 3D*: «Ver el piso en la vista de siempre».
4. *El mercadillo de la Lonja* (`Lonja.jsx`, `lonjaArt.js`): los puestos, el tablón «Se busca», «La estiba» y su pared de
   premios. Se entra desde el almacén 3D.

## 4. Por confirmar

- Las cifras de la llave (un uso, 7 días, 3 vivas) y de «Leemos el mismo» se le enseñan con el bloque que las usa.
