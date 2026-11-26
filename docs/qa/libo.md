# Libo, el gato guía, y mejoras de la interfaz · plan

Encargo de Francisco (20-11-2026), dentro de la preparación para la Play Store (`play-store.md` §5, «primer uso»):
«me gustaría mejoras que creas que podamos aplicar a la interfaz, y un asistente que sirva de puente entre la app y el
nombre. Un gato que se llame Libo que sea como el del logo, que te vaya guiando poco a poco por todas las caracteristicas de
la app, y te de sugerencias». Nada está hecho todavía. Se hará por bloques, con capturas y vídeos entre uno y otro.

## 1. Lo que hay hoy (revisado el 20-11-2026 a 375 px)

- **Primer uso**: una guía de tres paradas en la habitación ilustrada (`OnboardingGuide`, `src/domain/onboarding.js`). Habla
  de «tus figuras», que están ocultas desde la 1.67, y solo enseña la habitación. Después sale «Toca los objetos de la
  habitación. Con “Guías” verás el nombre de cada uno.»
- **Lo más trabajado de la app está escondido**: el edificio, tu piso, el café-librería, el hotel y sus salas se alcanzan
  desde la tablet del salón social → «El edificio del puerto». Nada en el primer uso lo dice.
- **Dos lenguajes visuales**: la habitación pintada usa píldoras de interfaz («Ambiente», «Guías», «Mi biblioteca», «Social»,
  «Mi diario»); el edificio, el café y el hotel usan pixel art y madera. Al pasar de uno a otro parece otra app.
- **Avisos repartidos**: el buzón del portal, la «!» del monitor (almacén), la «!» del café, el cuaderno de Pilar y los
  avisos del casino. Cada uno funciona, pero no hay un sitio que diga «esto tienes pendiente».
- **Arte de Libo disponible** (carpeta `libotown-marca/`, fuera del repositorio): la cabeza del icono, el logo con el
  bocadillo del corazón y la mascota de cuerpo entero (gato atigrado con bufanda a rayas verde y crema, chaqueta verde, libro
  verde con corazón; render de vóxeles sobre fondo marrón, **sin transparencia**, 1254 × 1254).

## 2. Libo

### 2.1 Quién es
El gato del logo, con su nombre. Es el **puente entre la app y el nombre**: el mismo personaje del icono y de las
pantallas de carga te recibe, te enseña la app poco a poco y te sugiere cosas. Habla de tú, corto y cálido, sin prisas ni
exclamaciones de vendedor. No sustituye a Pilar ni a don Celestino: dentro del café y del taller hablan ellos; Libo solo
presenta el sitio la primera vez y se aparta.

### 2.2 Cómo aparece
- **Pequeño, en una esquina**, asomando (cabeza y patas) sobre el borde de la pantalla, en todas las escenas. Tocarlo abre
  su bocadillo; si no tiene nada que decir, te ofrece «¿Qué hago ahora?» y «Repasar la guía».
- **Cuando tiene algo que decir**, el bocadillo con el corazón del logo asoma junto a él (sin sonido de aviso, sin
  insistir). Se cierra tocando fuera y no vuelve a salir ese día.
- **En la guía**, sale más grande, junto a lo que hay que tocar, y lo señala; el resto de la pantalla se atenúa un poco.
- Movimiento discreto (respira, mueve la cola); con movimiento reducido, quieto. Un maullido corto sintetizado al abrir su
  bocadillo, solo con el sonido activado y nunca antes de un toque.

### 2.3 La guía, poco a poco (no todo el primer día)
Cada capítulo se abre **cuando tiene sentido**, no en un tutorial de diez pantallas:

1. **Bienvenida** (primer arranque): quién es Libo, tu habitación y tu primer libro (añadirlo y registrar una lectura).
2. **Tu biblioteca y tu diario**: al tener 1–3 libros.
3. **El edificio**: tras el primer registro, Libo te lleva a la puerta del edificio (hoy, la tablet del salón).
4. **Tu piso**: la primera vez que entras (decorar, tu personaje, el ordenador y sus apps).
5. **El café-librería**: la primera vez (barra, clientes, libros; después ya habla Pilar).
6. **El hotel y la limusina**: cuando llevas unos días (almacén, sala de lectura, casino).
7. **La comunidad**: solo si la activas (vecinos, visitas, tablón, clubes).

Siempre se puede saltar, pausar («luego») y repasar desde Libo. Lo que ya conoces no se vuelve a explicar. El progreso se
guarda con tu biblioteca (`settings`), así que viaja con tu cuenta sin migración nueva.

### 2.4 Sugerencias
Reglas, en la línea de las de siempre (sin presión):
- **Como mucho una al día**, y solo al abrir la app o al volver a la habitación.
- **Nunca** rachas que se pierden, cuentas atrás, «te lo estás perdiendo» ni recordatorios de pago.
- Se puede elegir en Ajustes: «Libo me sugiere cosas» / «Solo cuando le llamo» / «Libo descansa».
- Ejemplos (cerrados, escritos a mano, sin IA):
  - «Terminaste *Circe*. ¿Le dejas una reseña?»
  - «Tu café tiene clientes esperando.» (solo si es verdad)
  - «Ese sillón que sigues está rebajado hoy en el almacén.» (unifica la «!» del monitor)
  - «Hace un tiempo que no abres *El nombre del viento*. ¿Sigues con él o lo dejamos en pausa?»
  - «Todavía no has visto la sala de lectura del hotel.»
- Libo **reúne los avisos** (buzón, almacén, café, cuaderno de Pilar) en su bocadillo; los de cada sitio siguen donde están.

### 2.5 Lo que no hará
- No es un chat con IA: no escribe texto libre ni lee tus datos fuera del dispositivo.
- No sustituye ni tapa a los personajes de cada sitio, ni los controles de la barra del café.
- No retira la guía de objetos de la habitación («Guías»): la presenta.

## 3. Mejoras de la interfaz que propongo

Por orden de impacto para la tienda:
1. **Primer uso con Libo** en vez de la guía antigua (y quitar la mención a las figuras).
2. **Que el edificio se vea desde el primer día**: un acceso claro desde la habitación (p. ej. la puerta o la ventana
   «Bajar al edificio»), además de la tablet. *Cambia a qué lleva la habitación: necesita tu aprobación.*
3. **Menos píldoras en la habitación**: agrupar «Ambiente», «Guías», «Social», «Mi diario» y «Mi biblioteca» en un menú
   de Libo o en objetos de la escena, y dejar a la vista solo lo de cada momento.
4. **Un mismo acabado** en los controles de la habitación y del edificio (marcos de madera y papel, como los carteles de
   la fachada), para que pasar de la habitación al edificio no parezca otra app.
5. **Estados vacíos con un siguiente paso**: biblioteca sin libros, café sin abrir, piso sin decorar: Libo y un botón claro.
6. **Botón Atrás de Android** y «volver» coherentes en todas las escenas (`play-store.md` §3.4).
7. **Revisión de legibilidad y toques**: textos de pixel art pequeños, zonas táctiles de 44 px y contraste de las píldoras
   claras sobre el cielo (p. ej. «Guías» se pierde sobre la ventana).

## 4. Bloques

1. **Libo aparece**: su arte en la app, el componente (esquina, bocadillo, guía), la bienvenida y el primer libro;
   sustituye a la guía antigua; ajuste en «Tu cuenta». Capturas a 360 y 390 y vídeo con sonido.
2. **Libo te enseña el edificio**: capítulos 3–7 (cada sitio, la primera vez).
3. **Sugerencias y avisos reunidos**.
4. **Mejoras de la interfaz** que apruebes del §3.

## 5. Decisiones de Francisco

Tomadas el 20-11-2026:
1. **Arte: empezar con la mascota actual**, recortada de su fondo y con poca animación (respirar, la cola); las poses
   (saludar, señalar, leer, dormir) se añaden más adelante. **Hecho en la 1.147** (26-11-2026): Francisco pasó una hoja con 15
   poses y pidió ponerlas «a lo largo de la app, para que parezca que libo esta vivo»; SPEC §147.
2. **Libo vive en una esquina, siempre**, en todas las escenas; su bocadillo del corazón sale cuando tiene algo que decir.
3. **Sugerencias: una al día como mucho, sin presión**, solo de cosas reales, y se pueden apagar en Ajustes.
4. **Sí al acceso al edificio desde la habitación** (§3.2); la tablet del salón sigue igual.

Tomadas el 22-11-2026 («Vale, sigue al 4»), para el bloque 4: entran **los estados vacíos** (§3.5), **el botón Atrás de
Android** (§3.6) y **la legibilidad y los toques** (§3.7). **La habitación ilustrada se queda como está**: ni agrupar sus
píldoras (§3.3) ni el acabado de madera y papel (§3.4).

## 6. Estado

**Bloque 1, hecho sin versión ni commit (20-11-2026)**, a falta del visto bueno de Francisco:
- La mascota recortada (`scripts/libo-recorte.mjs` → `public/assets/libo/`, 320 y 640 px de alto).
- `src/features/libo/`: reglas puras (`libo.js`: modo y capítulos vistos en `settings.libo`, más la marca del dispositivo
  `bookshelf:libo`), el componente (`LiboRincon.jsx`: la esquina, el bocadillo con el corazón y la guía) y el maullido
  sintetizado (`maullido.js`, por el bus de «Sonidos táctiles», solo al tocarle).
- **En tu piso de inicio** (la pantalla con la que arranca la app): Libo sentado sobre la barra de abajo, a la derecha. La
  primera vez, la bienvenida en seis pasos (saludo, tu lectura, tus libros, el menú, la puerta al edificio y su esquina), cada
  uno sobre el control de verdad, con «Ahora no», «Atrás» y «Saltar». Al tocarle: «Repasar la bienvenida» y «Ajustes de Libo».
- **Sin cuenta o sin comunidad**: en la esquina de abajo; la primera vez saluda en su bocadillo y explica qué falta.
- **«Tu cuenta»**: «Libo, el gato guía» con los tres modos (sugiere, solo cuando le llamo, descansa: deja la esquina).
- **Habitación ilustrada** (la experiencia anterior): la guía de siempre la presenta Libo, sin la mención a las figuras, con
  una parada nueva, **la puerta-ventana, que baja al edificio del puerto** (§3.2; la tablet del salón sigue igual).
- «Ahora no» cuenta como vista (se repasa desde Libo); no hay un «luego» que vuelva otro día.

**Bloque 2, hecho sin versión ni commit (21-11-2026)**, a falta del visto bueno de Francisco. Libo te enseña cada sitio la
primera vez que llegas, sobre los controles de verdad (`EDIFICIO`, `TU_PISO`, `CAFE`, `HOTEL` y `COMUNIDAD` en `libo.js`):
- **El portal** (capítulo 3): tu ventana, las de tus vecinos (la de un vecino si hay alguno; si no, una puerta libre), el
  café-librería, la limusina, el buzón y la cruz para volver. Libo se queda en la esquina de abajo, en la acera.
- **Tu piso del edificio** (capítulo 4): tu personaje va a donde toques, Decorar, el armario, la luz y la otra vista. En la
  esquina de abajo, junto a los botones. El ordenador no está en esta vista: lo enseña la bienvenida (el menú).
- **El café-librería** (capítulo 5): el local, tu nivel, los granos y **Pilar, que toma el relevo**; Libo dice «Me aparto» y
  se sienta arriba a la derecha, en la franja de «Volver al portal», sin tocar el marcador. **No sale mientras atiendes,
  horneas, restauras, decoras o miras los libros**: solo en la sala con Pilar (por `libo.css`).
- **El hotel** (capítulo 6): las plantas se tocan en la fachada, el directorio (con lo que ya está abierto), la cartela y
  «Al puerto». Esquina de abajo; se aparta con el directorio abierto o una planta elegida. **Dentro de las salas (almacén,
  casino, sala de lectura) no sale**: tienen sus propios controles por toda la pantalla.
- **La comunidad** (capítulo 7, solo con la comunidad activada): Lectores, Salón, Clubes y tu avatar. Libo vive en la cabecera
  del cuaderno, junto a cerrar.
- Lo visto se apunta en tus ajustes y, además, en el dispositivo (`bookshelf:libo`, ahora una lista de capítulos; el
  «presentado» del bloque 1 vale como el saludo y la bienvenida). Al tocar a Libo: «Repasar el edificio», «Repasar el café»…
- **Diferencias con el plan** (§2.3), por decidir con Francisco: el hotel se enseña la primera vez que llegas, no «cuando
  llevas unos días»; el capítulo 3 se abre al bajar al portal, no «tras el primer registro»; y en las pantallas con controles
  propios Libo se aparta en vez de quedarse en la esquina («nunca tapar a los personajes ni la barra del café», §2.5).
- Francisco lo aprobó al pedir el siguiente («Vale, sigue al 3», 22-11-2026); no comentó las diferencias de arriba.

**Bloque 3, hecho sin versión ni commit (22-11-2026)**, a falta del visto bueno de Francisco. En tu piso de inicio, Libo reúne
lo pendiente y te da una sugerencia al día (`sugerencias.js`, reglas puras con sus pruebas; `useAvisosLibo.js`):
- **Avisos** (de verdad, sin pedir nada nuevo al servidor), cada uno una tira de papel que se toca entera y lleva a su sitio:
  - **El buzón**: cartas de tus vecinos sin leer (la misma consulta y el mismo texto que el buzón del portal, ahora en
    `edificio/correo.js`); leídas allí, Libo deja de avisar. «Ir al buzón» abre el portal.
  - **El almacén**: lo que sigues de oferta hoy o lo nuevo sin ver (el mismo estado que la «!» del monitor, que se queda
    donde estaba); al abrir el ordenador, los dos se apagan. «Ver el almacén» abre esa pantalla del ordenador.
  - **El café**: tu café apunta en este aparato, al estar dentro, lo que queda hoy y el grado de la hucha. Libo dice «Tu café
    tiene clientes esperando» si es otro día o quedan clientes, y lo de la hucha solo un día entero después de tu última
    visita (la hucha suma días enteros desde que se vació, así que es seguro). Si nunca has entrado en ese aparato, no dice
    nada del café. «Ir al café» entra directo.
- **La sugerencia del día** (una como mucho; si la de ayer quedó sin contestar, hoy otra distinta), por este orden: añadir tu
  primer libro si la estantería está vacía; reseñar un libro terminado hace menos de 30 días sin reseña ni estrellas
  («Terminaste *Circe*. ¿Le dejas una reseña?»); un libro de «Leyendo» sin tocar en 21 días («¿Sigues con él o lo dejas para
  más adelante?», con «Sigo con él» y «Ver su ficha»: no lo cambia de balda); y los sitios del edificio que aún no conoces
  (el edificio, el café, el hotel). Contestada (vayas o digas «Ahora no»), no vuelve en 30 días.
- **El bocadillo asoma solo una vez al día**, al llegar a tu piso y si tiene algo que decir, sin maullido ni sonido; se cierra
  tocando fuera y ese día ya no sale solo. Nunca el mismo día que la bienvenida. Mientras tenga algo, un corazón quieto junto a
  su oreja (sin latir). Con «Solo cuando le llamo», nunca asoma solo; con «Libo descansa», nada.
- **Sin nada que decir**, al tocarle: su saludo y «¿Qué hago ahora?», que da una idea tranquila con lo que tienes (apuntar tu
  lectura, elegir la próxima de «Quiero leer» o bajar al edificio). Esas ideas no cuentan como contestadas.
- Lo del día y lo contestado van en `settings.libo` (`dia`, `callados`), con tu cuenta; en el aparato, `bookshelf:libo-asomo`
  (la fecha en que asomó) y `bookshelf:libo-cafe:<cuenta>`. Sin migración.
- Diferencias con el plan, por decidir con Francisco: el cuaderno de Pilar se resume en la hucha (el mostrador del obrador no:
  depende de lo que haya en la vitrina y no se puede saber sin preguntar al servidor); la sala de lectura no tiene aviso propio
  (va dentro de «Todavía no has visto el Gran Hotel»); los avisos y la sugerencia solo salen en tu piso de inicio, no en las
  otras escenas.
- Francisco lo aprobó al pedir el siguiente («Vale, sigue al 4», 22-11-2026); no comentó las diferencias de arriba.

**Bloque 4, hecho sin versión ni commit (22-11-2026)**, a falta del visto bueno de Francisco. Las tres mejoras que eligió (§5):
- **Atrás de Android** (`src/hooks/useAtras.js`): lo que se abre dentro de una escena apunta una entrada en el historial
  (`history.state.capas`) y Atrás la cierra **igual que su botón de volver**; con todo cerrado, Atrás sale de la escena como
  siempre. Cerrar un panel con su botón salta de una vez las capas que tuviera (`domain/navigation.js`). Capas:
  - **El café**: la barra («Luego»: el cliente sigue esperando), el obrador, la caja del mostrador, el taller, el tostadero, los
    libros, el cuaderno de Pilar, el ranking, Decorar, el nombre y el escaparate (sus botones de volver llevan `data-atras`).
    **A mitad de una taza o de un gesto**, donde no hay botón de volver, Atrás no hace nada; **en Decorar con cambios sin
    guardar**, tampoco, para no perderlos.
  - **El edificio**: el armario, una planta del hotel (vuelve a la plaza), el directorio y el café de otro lector (vuelve al
    tuyo). La Lonja abierta desde el ordenador vuelve al ordenador, como antes.
  - **Libo**: el bocadillo, y la guía (Atrás es «Saltar»).
  - **El ordenador de tu piso**: el cajón «Aplicaciones» y una app abierta desde el escritorio (vuelve al ordenador, al cajón si
    venías de él). Abierto ya en una app (p. ej. desde un aviso de Libo), Atrás sale del ordenador.
  - **El tablón**: sus hojas (recibidas, añadir, detalle, menú…; las que salen de otra vuelven a ella) y la de publicar, salvo
    mientras publica. El editor de una nota ya tenía su ruta.
  - Ya lo hacían: el lector EPUB, «Tu mes en libros», la ficha y la comunidad con sus pestañas.
  - **Dentro de las salas del hotel** (Francisco, 22-11-2026, «Atrás en las salas»): Atrás cierra lo último abierto y, con
    todo cerrado, vuelve a la plaza del hotel. **El vestíbulo**: el papel del mostrador (encargos, tablón, guardarropa) y el
    ascensor (como «Salir del ascensor»). **El casino**: la mesa («Levantarse»), la ruleta, las chisteras y la vitrina («Volver
    a la sala»), la mesa de un amigo («Volver a la mía») y los sellos de las chisteras; **mientras gira la ruleta o se mueven las
    chisteras, Atrás no hace nada** (su botón está desactivado). **El almacén**: el papel abierto (ficha, directorio, carrito,
    caja, amigos, probador, una zona de ropa) y el mercadillo (vuelve al almacén); **la ficha con la que llegas desde el ordenador
    del piso no**: Atrás vuelve al ordenador, como antes. **La sala de lectura**: tu sillón o el sofá («Levantarte»), la librería
    común («Volver») y la elección de qué compartir al sentarte («Ahora no»: va primero, y la siguiente vez te levanta). Las
    pestañas del casino (mesa, caja, pareja) y las plantas del almacén no son capas: se cambian con su botón.
- **Estados vacíos** (§3.5): sin libros, el botón grande de tu piso dice **«Añade tu primer libro»** (antes «Elegir una
  lectura», que llevaba a una biblioteca vacía), y **la biblioteca vacía** enseña a Libo con «Tu estantería espera su primera
  historia», **«Añadir un libro»** e **«Importar de Goodreads»**. El café sin abrir ya tenía su paso («Hablar con Pilar»; dentro
  del café habla ella) y no se toca; el piso sin decorar tampoco (todo piso empieza con sus muebles).
- **Legibilidad y toques** (§3.7), medidos a 360 y 390 en tu piso, el bocadillo de Libo, el menú, la biblioteca, el portal, el
  café, el hotel y la habitación ilustrada (botones de menos de 44 px y letra de menos de 13 px):
  - las etiquetas de la barra de tu piso (Balda, Decorar, Menú), de 11 a 12 px;
  - **el café**: los botones de la franja de Pilar y los tres del lado, de 42 a 44 px; **los letreros «!» de los clientes se ven
    igual y en el mismo sitio, pero se tocan en 44 × 44** (el dibujo pasa a un pseudo-elemento: el recorte de las esquinas de
    píxel recortaba también el toque);
  - **la habitación ilustrada**, sin cambiar su aspecto: la cuenta (32 px de ancho) y el sol se tocan en 44 px; «Ambiente» y
    «Guías» ya lo hacían con su zona invisible; «Mi biblioteca» está sobre la estantería, que también se toca. «Guías» ya no
    está sobre la ventana y se lee bien.
  - Lo que se dibuja dentro del 3D (rótulos de la escena) no se mide así; a la vista, legible. La letra de 7 px que queda es la
    del autor en las portadas generadas (un dibujo de portada; el título va fuera).
- Pruebas: `e2e-community/libo-atras.spec.js` (café, hotel, Libo y ordenador), `libo-atras-salas.spec.js` (vestíbulo, casino,
  almacén y sala de lectura) y `libo-interfaz.spec.js` (vacíos y toques);
  la navegación con capas, en `navigation.test.js`.
