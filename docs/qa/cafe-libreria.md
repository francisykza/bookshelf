# El café-librería del bajo: plan por bloques (borrador para Francisco, 11-11-2026)

Encargo de Francisco (11-11-2026): convertir la tienda del bajo en «un minijuego de tener tu propia biblioteca o
cafetería cozy, que vaya por niveles, y que permita a las lectoras ir decorándola a su gusto y avanzar de manera adictiva
y orgánica». Ya aprobado (propuesta + sus cambios): café-librería mixto que te traspasan vacío; 3D con el motor de las
salas del hotel, de noche y con luz cálida; el motor es la lectura real; 3–5 clientes al día que piden un libro de tu
biblioteca; servir con un gesto sencillo, sin reflejos y con tope diario; habituales que traen tus sesiones de lectura y
dejan reseñas cerradas en la pizarra; sin castigos, rachas que se pierdan, energía ni cuentas atrás; cinco niveles que se
ven en el local; Decorar como en el piso; visitas diferidas de amigos. **Cambios de Francisco**: moneda propia del café;
tickets al subir de nivel; tickets diarios según el nivel (cuarta excepción a «los tickets solo se ganan leyendo», con
tope y contados por el servidor); subir de nivel desbloquea muebles y funciones.

**Aprobado por Francisco (11-11-2026, «Sí, las recomendadas»)**: en todas las preguntas del §10, la opción recomendada
(tickets A, la dependienta se queda de camarera, cinco niveles con hitos, muebles del café solo en el café, nombre de una
lista cerrada, reciclar desaparece, el café presta «Leyendo» y «Quiero leer» con menos de 3 leídos, moneda «granos»).

## 1. De dónde partimos

- **La tienda de hoy** (1.67–1.68, `Tienda.jsx`, `shopRoom.js`, `shopArt.js`, `GachaReveal.jsx`, `economy.js`): local
  isométrico con el cartel «VIDEOCLUB», dependienta propia en el mostrador y tres objetos que se tocan: Sobres (cerrados
  por reforma, `SOBRES_CERRADOS`), Muebles (precio fijo en tickets) y Reciclar. Se entra desde el escaparate de la calle 3D
  (`calleView.js`, placa «Tienda» con el saldo de tickets) y el panel la abre como un «piso» más (`TIENDA_ID` en
  `EdificioPanel.jsx`). Captura de hoy: `qa-report/reforma-muebles/despues/4-tienda-sobres.png` y `4-tienda-muebles.png`.
- **Lo que solo hace la tienda**: reciclar. Los muebles ya se compran en el almacén del hotel (1.99–1.106) con los mismos
  precios; los sobres están cerrados.
- **Motores 3D**: recepción, almacén, casino y sala (`recepcion3d.js`, `almacen3d.js`, `casino3d.js`, `sala3d.js`):
  Three.js a 320 px de ancho ampliado sin suavizar, texturas de píxel pintadas una vez con la luz ya puesta, sin luces ni
  sombras en tiempo real, se anda tocando el suelo por una red de pasillos, solo se dibuja cuando algo cambia, y sin WebGL
  el dibujo de siempre. Son salas fijas: **ninguna se decora**. El que sí lee un plano decorable es el piso en primera
  persona (`pisoLab/interior3d.js`), que dibuja las mismas cajas de `furniture.js` en las coordenadas del `layout` que
  edita Decorar (`room.js`, `render.js`, la balda). El café junta las dos cosas.
- **Inventario y copias**: `piso_inventario` y `piso_falta_copia` (servidor) y `freeCopies` (app) cuentan lo colocado en
  el piso. Si un mueble del inventario se pone en el café, esa copia tiene que contar como usada (§6).
- **La lectura vive en la biblioteca de cada cuenta** (un documento sincronizado que escribe la app: libros con
  `status`, `rating`, `favorite`, `categories`, `pageCount`, `publishedDate`; sesiones en `progress.pomodoros`). **El
  servidor no puede comprobar qué has leído**: como en las misiones semanales (la app dice «cumplida» y el servidor solo
  pone tope), el café se diseña para que mentir no dé más que jugar bien un día normal (§6.3).
- **Tickets que ya entran** (para medir la excepción nueva): misiones semanales hasta 60/semana; diarias con toda la ropa
  5/día (35/semana); lata del casino hasta 10/semana. Precios: común 20, poco común 40, especiales el doble.
- **Amigos**: seguimiento mutuo con `piso_casino_amigo` (casino, almacén, sala). Gestos cerrados: `hotel/gestos.js`
  (sala de lectura, 1.118, en curso en otra sesión).

## 2. La idea en una frase

**Tu biblioteca real es la carta del café.** Cada libro que terminas se convierte en un lomo de tus estanterías y en
algo que recomendar; cada rato que lees trae a alguien que vuelve. El local empieza vacío y polvoriento y, sin prisa, se
llena de mesas, estanterías, una chimenea, un altillo y una terraza que se ve desde la calle.

## 3. El bucle diario (5–10 minutos, cuando quieras)

1. **Entras desde el escaparate de la calle.** De noche, luz ámbar, lluvia en el cristal, la cafetera humeando. Si hay
   clientes esperando, se ven sentados o en la barra con un bocadillo; si no hay, el local está tranquilo y se puede
   decorar o leer la pizarra.
2. **Llegan 3–5 clientes inventados al día** (3 en el nivel 1, 4 en el 2 y 5 del 3 en adelante). Los fija el servidor al
   empezar el día (Madrid, como el almacén), siempre los mismos aunque cierres y vuelvas, y **esperan todo el día**: no se
   van, no se enfadan, no se acumulan para mañana (los que no atiendas simplemente no vuelven ese día; no se pierde nada
   que tuvieras).
3. **Cada cliente pide un libro**, con una frase cerrada: un género («algo de fantasía que enganche»), un tipo
   («uno corto para el tren», «un tocho para el invierno», «uno que te hiciera llorar», «un clásico», «algo del autor que
   más lees», «el último que terminaste»). Los pedidos se eligen **de entre los que tu biblioteca puede cumplir**, para que
   siempre haya acierto posible.
4. **Recomiendas**: tocas la estantería (o «Recomendar») y eliges un lomo de tus libros leídos. Si encaja, el cliente lo
   celebra (corazón, sonido breve); si no del todo, «lo probaré» y se lo lleva igual. **Nunca hay fallo**: encajar solo da
   algo más.
5. **Le sirves algo**: eliges de la carta (café, té, chocolate… se amplía al subir) y **mantienes pulsada la cafetera
   hasta que la taza se llena** (un segundo, sin medir tiempos ni reflejos; con movimiento reducido, un toque y ya). El
   cliente se sienta con tu libro y su taza, lee un rato y deja **granos** (la moneda del café) en el tarro y
   **reputación**.
6. **Los habituales**: cada sesión de lectura de la app (Pomodoro o registro de al menos 15 min) ese día trae a un
   habitual, **hasta 2 al día**. Tienen nombre y aspecto fijos (un elenco de ~12 personajes propios que vuelven), dan
   algo más que un cliente nuevo y, al irse, **dejan una reseña cerrada en la pizarra** («Volveré por ese chocolate»,
   «Me llevé el que me dijiste y no pude parar», «El mejor rincón del puerto»…). Si terminas un libro, el día siguiente
   uno de ellos pregunta justo por él.
7. **Tickets del día**: al atender al primer cliente del día, el servidor suma los tickets diarios de tu nivel (una vez
   al día, §5). No hay botón que recordar ni nada que caduque.

Tope del día por diseño: **5 clientes + 2 habituales**. Cuando ya no queda nadie, la camarera (o el cartel) dice «Hoy
ya está todo el mundo atendido» y el local queda para decorar. Sin cuentas atrás hasta mañana.

## 4. El bucle de largo plazo

- **Reputación** (barra del nivel, siempre a la vista en la pizarra): sube con cada cliente atendido. Es lo que sube de
  nivel. Al alcanzar el umbral, **se sube solo** al entrar: la cámara recorre lo que se abre (obras que se retiran,
  estanterías que se montan, la escalera del altillo) y se cobran los tickets del nivel.
- **Hitos dentro del nivel**: cada tercio de la barra abre algo pequeño (un mueble del café a la venta, una bebida nueva
  en la carta, un tipo de pedido nuevo). Así hay algo nuevo cada pocos días sin esperar semanas al siguiente nivel: es lo
  que lo hace «adictivo pero orgánico».
- **Granos** (moneda del café): se gastan en muebles del café, bebidas de la carta y mejoras del local (§5.3). Lo que
  compras se ve en el local y en las visitas de tus amigos.
- **Tu lectura es el abono**: más libros leídos = estanterías más llenas y más pedidos posibles (variedad); más sesiones
  = más habituales y reseñas. Nada obliga: el café avanza también sin leer, solo más despacio.

## 5. Niveles, tickets y moneda

### 5.1 Tabla de niveles (propuesta)

Reputación por cliente: **10**, +4 si el libro encaja; habitual: **15**. Máximo posible al día: 5 × 14 + 2 × 15 = **100**;
un día normal ronda 50–70. La columna «días» es el mínimo con el máximo diario y, entre paréntesis, a un ritmo normal de
unos 60 al día.

| Nivel | Reputación total | Días mín. (normal) | Qué se abre en el local | Muebles y funciones nuevas | Tickets al subir |
| --- | --- | --- | --- | --- | --- |
| 1 · Rincón | 0 (al inaugurar) | — | La parte delantera (unas 5 × 4 casillas): barra pequeña, cafetera, una estantería baja con tus leídos, dos mesas. El fondo tapado con cortinas y caballetes de obra, nada industrial. | Decorar; carta con café y té; 3 clientes al día; pizarra. Muebles del café: barra, taburete, mesa redonda, silla de bistró, estantería baja, lámpara de cristal. | 10 (inauguración) |
| 2 · Café | 300 | 3 (5) | Todo el bajo (unas 10 × 8): se van las cortinas, aparecen el ventanal al puerto y la vitrina de tartas. | 4 clientes al día; chocolate y tartas en la carta; habituales con nombre; muebles: banco corrido, mesa de mármol, vitrina, planta grande, perchero. | 20 |
| 3 · Librería | 1.000 | 10 (17) | Estanterías altas hasta el techo con escalera de biblioteca corredera y **la chimenea**. | 5 clientes al día; pedidos de autor y de «el último que terminaste»; rincón de sillones junto al fuego; muebles: estantería alta, sillón orejero, alfombra persa, reloj de pared. | 40 |
| 4 · Altillo | 2.500 | 25 (42) | **Segunda planta** sobre el fondo, con **escalera visible** y barandilla; todo a la vez en la vista, sin transiciones (regla de las salas de varias plantas). | Decorar en dos plantas; el altillo como sala de lectura silenciosa (los habituales leen allí); muebles: mesa de estudio con lámpara verde, diván, balda de pared alta. | 60 |
| 5 · Terraza y escaparate | 5.000 | 50 (84) | **Terraza en la acera** con toldo y mesas, y el **escaparate** decorable: **se ve desde la fachada** de la calle 3D (y la placa del portal dice el nombre del café). | Escaparate con tres libros que eliges tú (de tus leídos); toldo y farolillos; muebles de terraza. Visitas de amigos sentados fuera. | 100 |

Total por subir los cinco: **230 tickets**, repartidos en meses (no se pueden adelantar: el tope diario de reputación lo
impide, §6.3). Después del nivel 5 la barra sigue para los hitos de decoración, sin más tickets de nivel.

### 5.2 Tickets diarios por nivel (propuesta)

| Nivel | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Tickets al día | 1 | 2 | 3 | 4 | 5 |

- **Tope: 5 al día** (35 a la semana como mucho), una vez por día de Madrid, al atender al primer cliente.
- Para comparar: con el café en el nivel 5, la suma de excepciones al mes sería como mucho ~150 (diarias con ropa) + ~43
  (lata) + ~150 (café): la lectura (misiones semanales, ~260/mes) sigue siendo lo principal.
- Las cuenta el servidor; la app solo las enseña («+3 tickets del café» al servir al primero).

### 5.3 La moneda del café: «granos» (propuesta de nombre)

- **Solo sirve en el café**, nunca se compra con dinero, **no se cambia por tickets** ni por nada fuera del café, no se
  regala ni pasa entre cuentas.
- **Se gana**: cada cliente deja 3 granos (+2 si el libro encaja); cada habitual, 6; cada hito de reputación, 15; cada
  amigo que te visita deja 2 (máximo 3 amigos al día, §8). Máximo del día ≈ 5 × 5 + 2 × 6 + 3 × 2 = **43**; normal, 25–30.
- **Se gasta en**:
  - **Muebles del café** (30–200 granos según rareza y nivel): modelos propios a la altura de la casa, que se abren por
    nivel e hitos. **Solo se colocan en el café** (propuesta; pregunta 4).
  - **La carta**: cada bebida o dulce nuevo (40–120) amplía lo que se puede servir y abre pedidos («algo para acompañar
    un chocolate caliente»).
  - **Mejoras del local**: suelo, color de pared, toldo, rótulo, la cafetera de latón (efecto de vapor) y el delantal de
    barista para tu personaje (prenda solo del café, no se vende en el almacén).
- **Sin sorteos**: todo se compra a la vista, precio fijo.

## 6. Qué se guarda en el servidor

Migraciones nuevas en `supabase/migrations/` (**las aplica Francisco**, en orden, con el flujo del SQL Editor si lo
pide), todas aditivas y re-ejecutables, con RLS activada, `revoke all` a `anon` y `authenticated` en las tablas y todo
el acceso por funciones `security definer`, `set search_path = ''` y **`volatile`** (la lección de la ruleta: ninguna
función `stable` que llame a `piso_yo()`; `rpc-solo-lectura.rls.test.js` lo comprueba). Pruebas con PGlite y una prueba
de paridad entre las cifras de la app y las del servidor (como `economy.js`). Nombres provisionales:

| Bloque | Migración | Qué trae |
| --- | --- | --- |
| 2 | `2026121012…_cafe_local.sql` | `cafe_locales` (nivel, reputación, granos con `check` 0–100.000, nombre de una lista cerrada, plano de cada planta, inaugurado), `cafe_catalogo` (muebles y mejoras del café con precio en granos y nivel mínimo), `cafe_inventario` (lo comprado con granos). Funciones `cafe_mio`, `cafe_inaugurar`, `cafe_guardar(plano)`, `cafe_comprar(id)`. Redefine `piso_falta_copia` para contar también lo colocado en el café. |
| 3 | `2026121112…_cafe_clientes.sql` | `cafe_dias` (por cuenta y día: clientes del día, atendidos, habituales, tickets del día cobrados), `cafe_servicios` (una fila por cliente y día: encajó o no, granos y reputación dados), `cafe_resenas` (frase cerrada por habitual y día). Funciones `cafe_dia(dia)`, `cafe_servir(dia, cliente, encaja, bebida)`, `cafe_habitual(dia)`. |
| 4 | `2026121212…_cafe_niveles.sql` | `cafe_niveles_cobrados` (clave cuenta + nivel), umbrales e hitos en `cafe_niveles`; la subida y sus tickets dentro de `cafe_servir` (misma transacción); tickets diarios por nivel. Altillo y terraza en el plano. |
| 5 | `2026121312…_cafe_visitas.sql` | `cafe_visitas` (anfitrión, visitante, día, gesto cerrado); `cafe_visita(dueño)` (ver el café de un amigo en solo lectura), `cafe_dejar_gesto(dueño, gesto)`. |

### 6.1 Reglas que no se pueden saltar (las comprueba el servidor)

- **Día**: solo hoy o ayer (Madrid), como el almacén; cualquier otro, error.
- **Clientes**: `cafe_dia` genera los del día con una semilla (cuenta + día) y los guarda; `cafe_servir` solo acepta
  un cliente que exista ese día y **una vez** (clave primaria cuenta + día + cliente). Número de clientes según el nivel
  **del servidor**.
- **Habituales**: como mucho 2 al día (la app dice que hubo sesión; el servidor solo pone tope, como las misiones).
- **Granos y reputación por servicio, fijos** (los de §5.1 y §5.3): el servidor no acepta cifras de la app.
- **Tickets de nivel**: una vez por nivel (clave cuenta + nivel), dentro de la misma transacción que sube el nivel.
- **Tickets diarios**: una vez por día (en `cafe_dias`), solo con al menos un servicio ese día, con la cifra del nivel del
  servidor; `least(100000, tickets + n)`.
- **Comprar con granos**: saldo con `for update`, precio y nivel mínimo de `cafe_catalogo`, nunca por debajo de 0.
- **Guardar el plano**: cada mueble en casillas abiertas en tu nivel (no se puede amueblar el altillo sin altillo), solo
  del catálogo del café que tengas, o de tu inventario con **copias libres contando piso + café** (una copia no está en
  dos sitios); sin místicos de peana fuera de su sitio si la regla de peanas lo exige; tamaño máximo del plano.
- **Visitas**: solo con seguimiento mutuo (`piso_casino_amigo`) y sin bloqueo; un gesto por pareja y día; el gesto, de la
  lista cerrada. Ver el café de otro no cambia nada suyo salvo el gesto.
- **Nada se transfiere**: ni granos, ni muebles del café, ni reputación entre cuentas.
- **La cuenta del fundador** no recibe nada especial del café (si Francisco quiere probar niveles altos, un script aparte
  como `cuenta_fundador.sql`, solo su cuenta y solo si lo pide).

### 6.2 Lo que la app decide (y por qué no importa)

Si el libro encaja con el pedido lo decide la app, porque la biblioteca no está en el servidor. Encajar solo da +4 de
reputación y +2 granos: mentir siempre da, como mucho, lo mismo que una lectora con buena biblioteca. Los tickets nunca
dependen de encajar.

### 6.3 Por qué no se puede explotar

Todo lo que da el café tiene un techo diario que pone el servidor: 100 de reputación, ~43 granos y 5 tickets. Así los
niveles (y sus 230 tickets) no se pueden adelantar más que a un día por día, y nada de lo que diga la app pasa ese techo.

## 7. Cómo se retira la tienda sin borrar datos

- **La vista**: el escaparate de la calle abre el café en lugar de `Tienda`. Se quitan de la vista la pared de sobres, el
  mostrador de abrir sobres, «Muebles» y «Reciclar», y el saldo de tickets de la placa (pasa a «Café · Nivel N»; los
  tickets se siguen viendo en el almacén, el casino y el armario).
- **El código** de la tienda (`Tienda.jsx`, `GachaReveal.jsx`, `shopRoom.js`, `shopArt.js`, `shopAudio.js`) **se
  conserva** sin montar, por si los sobres vuelven tras la reforma (`SOBRES_CERRADOS` sigue igual). Las pruebas que
  recorren la tienda (`v167-tienda`, `reforma-tienda`) se adaptan para comprobar que ya no se ve y que el café abre.
- **El servidor no se toca**: `piso_comprar`, `piso_reciclar`, `piso_abrir_sobre`, `piso_reclamos`, tickets, pity e
  inventario siguen igual. Ninguna migración del café borra ni cambia filas existentes (solo añade, y redefine
  `piso_falta_copia` para sumar lo del café).
- **Lo que deja de poder hacerse**: reciclar (solo existía en la tienda). Comprar muebles sigue en el almacén. El «Colocar
  [nombre]» de la tienda al piso desaparece con ella.
- **El cartel «VIDEOCLUB»** desaparece: el primer día el escaparate dice «SE TRASPASA» y, al inaugurar, el nombre del café.
- **Primera entrada**: la dependienta te recibe en el local vacío (polvo, sábanas sobre lo poco que queda, cajas) y te
  traspasa la llave; lo que haga después lo decide la pregunta 2.

## 8. Visitas de amigos (bloque 5)

- Desde el piso de un amigo (visita) o desde la Comunidad: «Su café». Entras en su café en solo lectura, con su
  decoración, su nivel, su escaparate y su pizarra.
- **Te sientas** con tu personaje en una mesa libre y dejas **un gesto cerrado** (la lista de la sala de lectura más dos
  propios: «¡Qué buen café!», «Me llevo una recomendación»). Uno por pareja y día.
- En diferido: la próxima vez que el dueño entra, **tu personaje está sentado allí** con su taza (hasta el final del día)
  y el gesto en un bocadillo; tocarlo dice quién vino. Le deja 2 granos (hasta 3 amigos al día). Quien visita no gana nada
  más que el gesto (para que no se visite por interés).
- En la pizarra, una columna «Han pasado por aquí» con los amigos de la semana. Sin texto libre.

## 9. Bloques y evidencias

Cada bloque, con capturas comparables a 390 px (y 360, 430 y escritorio) y vídeo en Chromium y WebKit a 390, las
comprobaciones con sus fallos, y la versión. Pruebas acotadas (nunca `npm run qa:full`). Al cerrar cada bloque: versión en
`src/diag.js`, `package.json`, `public/sw.js`, cabecera y sección de `SPEC.md`, y bitácora. Commit y `main` solo cuando
Francisco lo pida y tras aprobar cada entrega. Versiones: la siguiente libre al cerrar (la sala de lectura está con la
1.118 en otra sesión, así que previsiblemente **1.119 a 1.123**). Si la sesión se alarga, un bloque por sesión.

1. **Retirar la tienda y el local vacío en 3D** (sin migración). `cafe3d.js` + `cafeLayout.js` con el motor de las salas
   (luz cálida pintada, noche, lluvia en el escaparate) y la lectura del plano de `interior3d.js`. Se entra desde la calle;
   el local está vacío con la dependienta y el cartel «SE TRASPASA»; sin WebGL, un dibujo isométrico del local vacío.
   *Evidencias*: antes (las capturas de hoy) y después a los cuatro tamaños; vídeo de la calle al local; prueba e2e de
   que ya no hay sobres, muebles ni reciclar y de que tickets e inventario no cambian.
2. **Nivel 1 y Decorar** (migración `cafe_local`). Inaugurar (elegir nombre), los muebles iniciales gratis del rincón,
   la balda de Decorar con los muebles del café y los del inventario, guardar en el servidor, el 3D que lee el plano y
   tus libros leídos en la estantería (lomos como los del piso). *Evidencias*: vídeo decorando y volviendo a entrar;
   capturas del rincón vacío y decorado; pruebas PGlite de `cafe_guardar` (copias piso + café, casillas cerradas).
3. **Clientes, lectura y granos** (migración `cafe_clientes`). Clientes del día, pedidos según tu biblioteca, recomendar,
   servir con la cafetera, habituales por sesiones, pizarra con reseñas y la carta básica. *Evidencias*: vídeo de un día
   entero (de 3 clientes y 1 habitual hasta «todo el mundo atendido»), con movimiento reducido; pruebas PGlite de topes
   y de día.
   **Revisión de Francisco (12-11-2026)**: el café pesa más que el libro. Cada bebida se prepara en la barra 3D con una
   receta de cuatro elecciones (bebida, grano u hoja, leche y toque) y se lleva a la mesa; el libro es un extra entre tres
   fichas; se puntúa con 1 a 3 estrellas (nunca cero) y cada día llega un excéntrico que con 3 estrellas paga el triple y
   deja una reseña dorada. Detalle en SPEC §121.
4. **Niveles 2 a 5, tickets y desbloqueos** (migración `cafe_niveles`). Subida con su recorrido de cámara, hitos, tickets
   de nivel y diarios, chimenea, altillo con escalera, terraza y escaparate en la fachada de la calle 3D. Si pesa mucho,
   se parte en 4a (niveles 2–3) y 4b (altillo, terraza y fachada). *Evidencias*: vídeo de cada subida (con una cuenta de
   prueba sembrada, nunca la de Francisco), capturas del local en cada nivel y de la fachada con terraza; pruebas de que
   los tickets se cobran una vez.
5. **Visitas de amigos** (migración `cafe_visitas`). *Evidencias*: vídeo con dos cuentas de prueba en el Supabase
   simulado (`e2e-community`); sin probar entre dos cuentas reales salvo que Francisco lo haga.

Sin probar en móviles reales: se dirá en cada entrega.

## 10. Preguntas para Francisco

1. **Cifras de tickets.**
   - **A (recomendada)**: al subir 10 / 20 / 40 / 60 / 100 (230 en total) y diarios 1 / 2 / 3 / 4 / 5, tope 5 al día.
   - **B, más generosa**: al subir 20 / 30 / 60 / 90 / 150 (350) y diarios 2 / 3 / 4 / 5 / 6, tope 6 al día.
   - **C, más contenida**: al subir 5 / 10 / 20 / 30 / 50 (115) y diarios 1 / 1 / 2 / 2 / 3, tope 3 al día.
2. **La dependienta.**
   - **Se queda como camarera (recomendada)**: detrás de la barra, te saluda, avisa de los clientes y lleva las tazas; tú
     recomiendas y sirves.
   - Te traspasa el local y se despide (sale en la inauguración y en una foto de la pizarra).
   - Se jubila y vuelve como habitual (una clienta más).
3. **Número de niveles.**
   - **Cinco con hitos dentro (recomendada)**: Rincón, Café, Librería, Altillo y Terraza, cada uno con tres hitos.
   - Cinco sin hitos (solo se estrena algo al subir).
   - Cuatro (Altillo y Terraza en un mismo nivel).
4. **Muebles del café en tu piso.**
   - **Solo en el café (recomendada)**: los granos no salen del café y la economía de tickets no cambia.
   - También en el piso (se pueden llevar a casa).
5. **El nombre del café** (lo ven tus amigos).
   - **De una lista cerrada (recomendada)**: «La Última Página», «El Marcapáginas», «Café del Muelle», «Taza y Lomo»…
     (unos 12, sin texto libre).
   - Un nombre fijo para todos: «El café-librería del bajo».
6. **Reciclar** (hoy solo existe en la tienda).
   - **Desaparece con la tienda (recomendada, como ya está aprobado)**.
   - Se muda al almacén del hotel.
7. **Con menos de 3 libros leídos.**
   - **El café presta los de «Leyendo» y «Quiero leer» (recomendada)**, marcados como «aún sin leer».
   - Solo leídos: la estantería empieza vacía y los clientes piden «algo que tengas».
8. **Nombre de la moneda.**
   - **Granos (recomendada)** · Propinas · Terrones.

## 11. Libros comprados en cajas (propuesta, 12-11-2026)

Francisco, 12-11-2026: le gusta que en Tiny Bookshop los libros se compren con la moneda del juego, lleguen en cajas y
se coloquen en las estanterías. Eligió **cajas por género**, **caja de bienvenida gratis** y, sin ejemplares, **«Solo el
café»**. Se toma solo la mecánica (género), nunca su arte ni su interfaz. **Las cifras y la migración son una propuesta: las
aprueba él antes de hacerlas.**

- **La distribuidora** (en el café, un objeto de la escena: la caja de reparto junto a la puerta, con su albarán):
  - lo que tienes **leído desbloquea su título**; con menos de 3 leídos, también «Leyendo» y «Quiero leer» (como ya se
    aprobó para las fichas), marcados «aún sin leer»;
  - **caja por género** (Novela, Fantasía, Misterio, Amor, Clásico, Ciencia ficción, Poesía, Historia, Biografía,
    Juvenil; solo los géneros donde tengas algo): **5 ejemplares** al azar entre tus títulos de ese género, **10 granos**;
  - **caja de un título concreto**: **3 ejemplares**, **9 granos** (más cara por ejemplar: eliges sin azar);
  - lo que trae cada caja se ve **antes de pagar** («5 ejemplares de tu Fantasía, al azar entre 7 títulos»); sin sorteos de
    rareza ni pity, y la caja **llega al momento** (sin esperas ni cuentas atrás).
- **Colocar**: la caja aparece en el suelo del café; al tocarla se abre (los lomos saltan, como en un sobre, honesto) y
  **se arrastran los lomos a los huecos de las baldas** de las estanterías del café (con la «!» en los huecos libres en
  los niveles 1 y 2). Lo que no cabe se queda en la caja, sin perderse. Huecos: **12 en el nivel 1** (las estanterías que
  ya tiene el local), y más con cada estantería o nivel (bloque 4).
- **Recomendar**: las tres fichas salen **solo de lo que está en la balda** (si hay menos de tres títulos, menos fichas;
  si no hay ninguno, solo «Solo el café», que cobra el café y solo pierde el punto del libro).
  - Si el libro **encaja**, el cliente **se lleva el ejemplar** (sale de la balda) y paga **+2 granos** además de lo de hoy.
  - Si **no encaja**, lo hojea y lo devuelve a la balda: no se pierde el ejemplar.
  - Cuentas: una caja de género (10) se recupera con 5 aciertos (+10), y además cada acierto sube las estrellas. Comprar
    no es obligatorio para jugar; es lo que hace rendir el libro.
- **Caja de bienvenida**: **8 ejemplares gratis**, una vez, al abrir el café (o al llegar esta función para los cafés ya
  abiertos), elegidos entre tus títulos para que haya variedad de géneros.
- **El servidor** (en la migración `20261211120000_cafe_clientes.sql`, que sigue sin aplicar, o en una nueva si ya se
  aplicó): `cafe_libros` (por cuenta y título: clave, título y género que manda la app, ejemplares en caja y en balda,
  hueco), `cafe_comprar_caja(genero | clave, titulos[])` (cobra con `for update`, nunca por debajo de 0, y elige al azar
  en el servidor entre los títulos que manda la app), `cafe_colocar(clave, hueco)` y `cafe_bienvenida()` (una vez);
  `cafe_servir` recibe además la clave del libro y descuenta el ejemplar solo si encaja. Como la app es la que conoce tu
  biblioteca, **el servidor no puede comprobar que lo hayas leído**: por eso el techo diario de granos se mantiene (+2 por
  ejemplar dentro del máximo del día, §6.3), y comprar cajas solo gasta.
- **Preguntas para Francisco**: ¿estas cifras (caja de género 5 × 10 granos, de título 3 × 9, +2 por ejemplar que se
  lleva, bienvenida de 8, 12 huecos en el nivel 1)? ¿Se hace antes del bloque 4 (recomendado: cambia cómo funciona el
  libro y el bloque 4 añade estanterías) o dentro de él?

## 12. Bloque 4a: subir de nivel, hitos y la carta (hecho, 1.122.0, 12-11-2026)

Decisiones de Francisco (12-11-2026): partir el bloque 4 en **4a** y **4b**; **una receta nueva por nivel**, cada una con su
gesto y su objeto (nivel 2 chocolate caliente, 3 nata montada, 4 vainilla, 5 bebidas con hielo); **tres hitos por nivel**
(1.º un mueble nuevo del café a la venta, 2.º lo nuevo de la carta, 3.º 15 granos); **huecos 12 / 18 / 30 / 36 / 42**. Las
cifras de tickets (10 / 20 / 40 / 60 / 100 y 1 a 5 al día, tope 5) y los umbrales de nivel ya estaban aprobados.

Hecho en la 1.122.0 (detalle en SPEC §122): niveles, tickets del nivel y del día, hitos con marcas en la barra, el cartel de
lo conseguido, la tienda del café en Decorar con nueve muebles nuevos, el fondo del local en los niveles 2 (ventanal al
puerto) y 3 (estanterías hasta el techo y chimenea) con un recorrido de cámara, la cuadrícula tres filas más honda desde el
nivel 2, la carta por días y el chocolate (cazo y molinillo) y la nata (bol y varillas) en la barra. Migración
`20261212120000_cafe_niveles.sql`, sin aplicar.

Interpretaciones mías, **aprobadas por Francisco con la entrega** («Sí, lo apruebo», 12-11-2026):
- Los hitos caen a un cuarto, a la mitad y a tres cuartos de la barra de cada nivel (así ninguno coincide con la subida).
- En el nivel 1 el 2.º hito no da nada (no hay carta nueva en el nivel 1); se puede cambiar por granos o por otro mueble.
- Los 10 tickets del nivel 1 se cobran con el primer cliente atendido (no al inaugurar), y los del día, con el primer
  cliente de cada día, en el mismo cartel.
- Los muebles y precios nuevos: nivel 1 maceta (35, hito); nivel 2 banco corrido (70), vitrina de tartas (90), planta
  grande (45) y perchero (40, hito); nivel 3 estantería alta (140, 96 libros), sillón orejero (120), mesita con quinqué (80)
  y reloj de pared (160, hito). Están dentro de los márgenes que dio (nivel 2 de 40 a 90; nivel 3 de 80 a 160).
- El cacao del chocolate se elige en el tarro y va directo al cazo (sin gesto propio): los dos gestos del chocolate son
  remover con el molinillo e inclinar el cazo.

Bloque 4b (siguiente, con su visto bueno): el altillo (nivel 4) con la vainilla (rascar la vaina) y la terraza y el
escaparate de la fachada (nivel 5) con las bebidas con hielo (agitar la coctelera), sus muebles y sus hitos.

### 12.1 El local crece con los niveles (decisión de Francisco, 12-11-2026)

Francisco: en los niveles 1 a 5 se va haciendo más grande la planta de la calle; en los 6, 7 y 8, un sótano (bodega y
tostadero) que crece en cada uno; pasado el 8, una segunda planta que también crece. Cada planta, con su cuadrícula de
Decorar y clientes. «Que tuviese sentido la mejora de espacio con que la persona pueda ser más óptima, no solo decoración».
Sustituye al altillo del nivel 4.

Propuesta aprobada en lo general («Vale, me parece bien»); las cifras, pendientes de su aprobación:
- **Más asientos, más clientes al día**: los clientes del día salen de las mesas y sillas colocadas, con un tope por nivel.
- **Más baldas, más libros a la venta**: más ejemplares, más fichas que encajan, más estrellas y granos.
- **El tostadero del sótano**: un saco tostado al día que se recoge cuando se quiera (sin plazo ni pérdida); abre granos
  especiales en la carta, que pagan más.
- **La segunda planta**: una función propia (p. ej., sala de lectura donde los habituales se quedan y dejan más reseñas),
  por concretar.
- Sin castigos, rachas que se pierdan, energía ni cuentas atrás. Umbrales, tickets y rendimiento de los niveles 6 en
  adelante: los aprueba Francisco antes de hacerlos.

## 13. Bloque 4b: el ala lateral, la terraza y el escaparate (hecho, 1.123.0, 12-11-2026, pendiente de revisión)

Con las cifras aprobadas («Sí, esas cifras», 12-11-2026). Detalle en `SPEC.md` §123. Interpretaciones mías, para que
Francisco las confirme o las cambie:
- **El ala se abre a la izquierda**, no a la derecha como se dijo al proponerlo: a la derecha está la barra con Pilar y la
  cafetera; abrir esa pared la desmontaría. La cuadrícula crece por la izquierda (columnas −3 a −1).
- La estantería de la pared y las estanterías altas del nivel 3 se mueven con la pared, al fondo del ala.
- El nivel 4 se llama «Ala lateral» (antes «Altillo», que ya no existe con el plan de plantas de §12.1).
- **Hasta 32 cosas** en el plano desde el nivel 4 (24 antes): con una cuadrícula de 9 × 9 y la terraza, 24 se quedaban
  cortas.
- El café con hielo lleva **la leche fría** (solo servirla, sin vapor ni dibujo).
- Pilar avisa de los asientos que faltan una vez al día al entrar (y luego, cuando no hay nadie esperando).
- En la fachada, la placa del bajo dice el nombre del café desde que se inaugura (antes, «Se traspasa» siempre).
- **Revisión de Francisco** (12-11-2026): la limusina con el chófer tapaba la terraza; pasa a la izquierda del portal,
  delante de la librería. Hecho en la misma 1.123.0.

## 14. El sótano: niveles 6, 7 y 8 (aprobado, 13-11-2026)

Desarrolla §12.1 («Vale, me parece bien» en lo general). **Cifras aprobadas por Francisco** el 13-11-2026 («Sí, esas
cifras»), las de la tabla; la alternativa más rápida queda descartada.

### 14.1 Ritmo de hoy, para medir

Con 3 estrellas, un día completo deja unas 70 de reputación en el nivel 1 y unas 125 en el 5 (los clientes, más el
excéntrico). Hoy se tarda, más o menos, 4 días en el nivel 1, 9 en el 2, 16 en el 3, 23 en el 4 y unos 40 en el 5 hasta
su tercer hito (8.750). Los hitos del nivel 5 no cambian.

### 14.2 Los tres niveles

| | Nivel 6 · La bodega | Nivel 7 · El tostadero | Nivel 8 · La sala de catas |
| --- | --- | --- | --- |
| Empieza en | 10.000 de reputación | 15.000 | 21.000 (sus hitos, hasta 27.000) |
| Días aprox. (3 estrellas) | unos 35 | unos 38 | unos 38 hasta su 3.er hito |
| Tickets al subir | 80 | 90 | 100 |
| Tickets del día | 5 (el tope de 5 no cambia) | 5 | 5 |
| Clientes al día, con asientos | hasta 8 | hasta 9 | hasta 10 |
| Huecos en la balda | 48 | 54 | 60 |
| El sótano | se abre la trampilla tras la barra: bóveda de ladrillo, cuadrícula 5 × 5 | crece: cuadrícula 7 × 5, con el tostador | crece: cuadrícula 9 × 6, con la mesa de catas |
| Lo nuevo de la carta (2.º hito) | — (el nivel abre la bodega) | **Tueste de la casa** (grano) | **Chai con especias** (bebida) y **café brûlée** (toque) |
| Muebles (1.er hito y tienda) | barricas de mesa, banco de bodega, candil de pared: 200–300 granos | saco de arpillera, estantería de latas: 250–350 | mesa de catas, butaca de cuero, mapa de cafés: 300–400 |
| 3.er hito | 20 granos | 20 granos | 25 granos |

Los tickets de nivel suman 270 más (500 en total con los de los niveles 1 a 5). El tope de 5 tickets al día no sube.

### 14.3 Para qué sirve el espacio (que se juegue mejor, no solo decorar)

- **Más sitio, más clientes**: el sótano tiene su cuadrícula y sus asientos cuentan como los de arriba. Los clientes del día
  siguen saliendo de los asientos colocados, con el tope del nivel (si faltan, vienen menos, sin castigo, como en el 4 y el 5).
- **El tostadero** (nivel 7): **un saco al día**, que se recoge cuando quieras, sin plazo ni pérdida (si no lo recoges, no se
  acumula más de uno). Recogerlo es un gesto propio: **tirar de la trampilla del tambor hacia ti** y los granos caen al
  enfriador. Cada saco da **5 tazas de «tueste de la casa»**. Algunos clientes lo piden; si te queda, se elige en la barra
  como un grano más y esa taza paga **+3 granos y +4 de reputación**. Si no te queda, se sirve con otro grano y solo se pierde
  ese punto, como un fallo cualquiera.
- **La balda de la bodega**: los 6 huecos más de cada nivel son baldas del sótano; se recomiendan igual que las de arriba.

### 14.4 Las recetas nuevas, cada una con su gesto y su objeto

- **Tueste de la casa** (nivel 7, grano): el saco del tostadero junto al molinillo; luego se muele como siempre.
- **Chai con especias** (nivel 8, bebida): **machacar las especias en el mortero** con toques secos (cuatro golpes), y después
  la tetera como el té.
- **Café brûlée** (nivel 8, toque): una capa de azúcar sobre la espuma y **pasar el soplete en zigzag** sin soltar hasta que
  dore. Con movimiento reducido, un toque.

Nada de esto puede salir mal del todo: fallar paga menos, nunca cero, como ahora.

### 14.5 Lo que no cambia

Los niveles 1 a 5 y sus hitos, los pagos por estrellas, el excéntrico del día, las cajas de libros, el tope de 5 tickets al
día y las reglas de siempre (sin castigos, rachas, energía ni cuentas atrás). La segunda planta, pasado el 8, queda para
más adelante, con su propia propuesta.

### 14.6 Cómo se haría

Por bloques, con capturas entre uno y otro: **6a**, la trampilla y la bodega (nivel 6, la escalera, la cámara que baja,
la cuadrícula del sótano, los asientos y los clientes); **6b**, el tostadero y el tueste de la casa (nivel 7); **6c**, la
sala de catas, el chai y el café brûlée (nivel 8). Migración nueva en cada bloque, la aplica Francisco.

**Alternativa más rápida**, si los días parecen muchos: empezar el 6 en 8.000, el 7 en 12.000 y el 8 en 17.000 (unos 20, 30 y
32 días). Obliga a adelantar los hitos del nivel 5, que ya están hechos (el farol y el café con hielo llegarían antes).

### 14.7 Bloque 6a, hecho (1.125.0, 13-11-2026), con interpretaciones por confirmar

- **40 cosas colocadas** desde el nivel 6 (antes 32): con dos plantas no cabía lo de arriba más la bodega. No estaba en la tabla.
- **Preparar, siempre arriba**: a un cliente de la bodega se le prepara en la barra (la escena salta a la barra) y se le lleva
  la taza bajando la escalera.
- **Botón «Subir al café»** en la esquina, además de la escalera: al llegar abajo la escalera queda a la espalda.
- **El 2.º hito del nivel 6** no trae nada de la carta (la tabla dice «—»): se marca y se celebra, sin premio.

### 14.8 Bloque 6b, hecho (1.127.0, 13-11-2026), con interpretaciones por confirmar

- **El primer saco llega con el tueste en la carta** (2.º hito del nivel 7, 18.000). Antes, el tostador está en la bodega, frío,
  y Pilar dice cuándo llega. Se cambia en `tuesteAbierto` (app) y en la condición de `cafe_recoger_saco` (servidor).
- **La barra del nivel 7 mide 6.000**, hasta el umbral aprobado del 8 (21.000), para que sus hitos no se muevan al abrir el 6c.
- **Las tazas que sobran no caducan**: como mucho 99; si no caben las 5 del saco, el saco espera en el tambor.
- **El bono, solo a quien lo pidió y con tueste**: servirlo a quien no lo pidió gasta la taza y cuenta como fallo de grano.
  Sin tazas, la opción sale apagada («sin tazas»).
- **Solo con café**: con té o chocolate el tueste no se pide (la receta pasa a intenso), ni se puede elegir.
- **El saco de arpillera es un asiento**; la estantería de latas, el mueble del 1.er hito. Siguen cabiendo 40 cosas.
- **El tostador ocupa la esquina izquierda del fondo**, fuera de la cuadrícula; las columnas nuevas (−2 y −1) quedan delante.
  Si se pone un mueble justo delante del tostador, se sigue pudiendo usar (la cámara se coloca sola).
- **Arreglo de la 1.125**: con 8 clientes en el nivel 6, la app descartaba al 8.º (el excéntrico) al leer el día. Corregido.

### 14.9 Bloque 6c, hecho (1.129.0, 13-11-2026), con interpretaciones por confirmar

- **La escalera se corre a la pared nueva.** Las columnas nuevas (5 y 6) caen donde estaba la escalera: no cabían de otra forma
  (por la izquierda está el tostador, y el servidor no admite columnas por debajo de la −3). La sala se alarga por la derecha y
  la fila nueva (la 25) va hacia delante; la escalera baja ahora por la pared de la derecha, con su letrero y su llegada.
- **La barra del nivel 8 mide 8.000** (21.000 a 29.000), para que sus hitos caigan en 23.000, 25.000 y 27.000 («hitos hasta
  27.000»). El 8 es, por ahora, el último nivel.
- **El chai y el brûlée llegan juntos** en el 2.º hito del nivel 8 (25.000), los dos a la vez («lo nuevo de la carta»).
- **El chai lleva té** (hoja verde, suave, o negra, intensa) y se elige su fuerza con los tarros del té; nunca el tueste de la
  casa. El mortero va antes de la tetera, en lugar de la cuchara del té.
- **El brûlée solo dora apretando**: la llama se enciende al apretar y se apaga al soltar; lo dorado no se pierde.
- **Siguen cabiendo 40 cosas** (no se aprobó un tope nuevo). La butaca de cuero es un asiento; el mapa de cafés, el mueble del
  1.er hito.
- **El mostrador de catas** del fondo es decorado fijo de la sala (no se compra ni se mueve), como el botellero.

## 15. Que no se haga repetitivo y los libros (14-11-2026)

Francisco, tras usarlo más: «que añadirias para que no se haga repetitivo el tema de preparar todo el rato los cafés, y como
integrarías mejor el tema de los libros porque no termino de verlo bien implementado».

### 15.1 Pilar prepara lo que ya dominas (aprobado: «Vale lo de pilar»)

- Cada bebida (café, té, chocolate, café con hielo y chai) se **domina con 12 servidas de 2 estrellas o más**; Pilar lo dice
  («Esto ya lo bordas; si quieres, te lo preparo yo»).
- Tú lees la comanda y eliges la receta (bebida, grano, leche, toque). Con la bebida dominada aparece **«Que lo prepare
  Pilar»**: va a la barra y hace los gestos en 3D en unos 3 s, con sus sonidos; con movimiento reducido, directo.
- **Siempre se puede hacer a mano**; el dispositivo recuerda lo último elegido por bebida. **A mano siempre**: lo recién
  desbloqueado (hasta dominarlo) y **el excéntrico**.
- **Paga lo mismo** (granos y reputación); con la receta bien, 3 estrellas. Sin cambios de economía.
- Servidor: un contador de servidas por bebida en el local (migración pequeña, la aplica Francisco).

### 15.2 Descartado

Pedidos de grupo, «lo de siempre», clientes sin bebida, días distintos, arte latte, habituales con ficha y opinión, pistas
desde la biblioteca, maridaje, la lectura actual en el café y la tertulia: **no le convencieron** («el resto no me termina de
convencer»).

### 15.3 Los libros: por preparar

Francisco: «vamos a preparar antes lo demás y lo hacemos en conjunto cuando este todo». Falta concretar con él qué no le
encaja hoy de los libros antes de proponer otra dirección. Lo de Pilar no se hace por separado.

Sus respuestas (14-11-2026): no le encaja que **elegir una de tres fichas no tiene gracia**, que **las cajas y la balda son un
trámite** y que **los libros pesan poco en la partida**. Quiere que recomendar un libro sea **igual de importante que el café**,
con su propio gesto.

### 15.4 Por qué hoy lía (revisado en el código)

- Los pedidos salen de **toda tu biblioteca**, no de la balda (`pedidosDelDia(dia, libros)` en `Cafe.jsx`): un cliente puede
  pedir un género, tu favorito o el último que terminaste aunque no quede ningún ejemplar en la balda.
- Los pedidos y los géneros **no son la misma lista**: los pedidos son fantasía, misterio, amor, ciencia ficción, corto, tocho,
  clásico (por año), tu favorito, el autor que más lees y el último que terminaste; la distribuidora y la balda usan diez
  géneros (novela, fantasía, misterio, amor, clásico, ciencia ficción, poesía, historia, biografía y juvenil).

### 15.5 Propuesta de los libros (Francisco: «Si pero cambia tambien como piden los clientes los libros y las categorias»)

- **Una sola lista de categorías**: los diez géneros de la distribuidora. Cada uno es una **sección de la estantería con su
  placa**, y en el café **solo aparecen las secciones que tienen ejemplares** (nunca un género que no tienes).
- **Los clientes solo piden lo que hay en la balda en ese momento**: género de una sección con ejemplares y una extensión que
  exista en ella. **Fuera** «el que más te gusta», «el autor que más lees», «el último que terminaste» y «clásico» por año
  (Clásico queda como género, por las categorías del libro). Con la balda vacía, «Solo el café», como hoy.
- **El pedido del libro, en tres partes** (como las cuatro de la bebida): el **género** (la sección), la **extensión**
  (**corto**, hasta 300 páginas, o **largo**, más de 300; un libro sin páginas vale para las dos) y **cómo se lo lleva**
  (para regalar, para leerlo aquí o para llevar).
- **Los gestos**: pasar el dedo por los lomos de la sección; tirar del lomo y verlo (portada real y páginas); envolver con
  papel de estraza y cordel / meter el marcapáginas / meterlo en la bolsa; y el sello del café (apretar y mantener). Se lleva
  en la bandeja con la taza.
- **Estrellas, mitad y mitad**: hasta 4 aciertos de la bebida y 3 del libro (7). **3 estrellas con los 7**, 2 con 4 a 6, 1 con
  menos (nunca cero). Los premios por estrellas no cambian.
- **El ejemplar**: se lo lleva si aciertas el género y paga **+4 granos** (hoy +2); si no, vuelve a su sección.
- **El reparto**: cada mañana, al abrir el día, llega solo una caja que **repone lo vendido el día anterior** (los mismos
  títulos, hasta 10 ejemplares) a **2 granos el ejemplar** (lo mismo que hoy en la caja de género); si no llegan los granos,
  llega lo que se pueda pagar (nunca a deber). Abrirla, como hoy; **colocar, un solo gesto** que manda cada lomo a su sección.
  La distribuidora se queda para pedir un título o un género concreto.
- **Pilar** (§15.1) prepara las bebidas dominadas; **el libro siempre lo eliges tú**.
- **Servidor**: el reparto al abrir el día, el pago del ejemplar, las estrellas con las partes del libro y el contador de
  Pilar (migración nueva, la aplica Francisco). Los pedidos se siguen decidiendo en la app (tu biblioteca no está en el
  servidor), ahora con la balda.

### 15.6 Hecho (1.130.0, 14-11-2026), con interpretaciones por confirmar

Pilar y los libros, juntos (SPEC §130; migración `20261218120000_cafe_libreria.sql`, la aplica Francisco). Lo que se decidió
sin preguntar:

- **Lo que prepara Pilar cuenta como hecho a mano**: sus gestos siempre salen bien, así que con la receta bien son los cuatro
  aciertos de la bebida. Las estrellas dependen de lo que eliges tú.
- **«Lo recién desbloqueado», por cosa de la carta**: cada bebida y lo de la carta con gesto propio (el tueste de la casa, la
  nata, la vainilla y el brûlée) se domina por separado (12 servidas de 2 estrellas o más con eso). Si la receta lleva algo
  así sin dominar, Pilar hace el resto y **esa etapa la haces tú** (su gesto).
- **Sin libro, como mucho 2 estrellas**: si pedía libro y das «Solo el café», solo cuentan los 4 de la bebida (2 estrellas con
  todo bien). Es lo que sale de las cifras aprobadas (3 con los 7). Con la balda vacía nadie pide libro y la bebida bien da 2.
- **Si fallas el género, lo demás cuenta**: la extensión y la forma acertadas suman igual, pero el ejemplar vuelve a su sección
  (solo se lo lleva con el género bien).
- **El pedido se fija al empezar a atender**: si mientras tanto se va un ejemplar de la balda, ese cliente sigue pidiendo lo
  mismo (lo que había cuando llegó).
- **La estantería de la pared es la balda**, por secciones; **las estanterías del café que compras enseñan tus leídos de
  adorno** (no son ejemplares de la balda ni se venden). Antes enseñaban la balda.
- **Hasta tres secciones por balda**, cada una en su hueco con su placa, en un bloque centrado en la pared (con todas seguidas,
  en un móvil las placas se pisaban). Si no cabe todo en las cuatro baldas, el bloque se ensancha. Las baldas, de la del pecho
  a la de abajo, la de arriba y el suelo.
- **La tabla sale de la estantería** a la altura de la sección, con la bandeja y la taza a un lado; al elegir cómo se lo lleva,
  la cámara se corre hacia el tarro y las bolsas para que se vean los tres objetos en un móvil en vertical.
- **La extensión se ve en la etiqueta del lomo** al pasar el dedo («320 págs. · largo»; sin páginas, «corto o largo»), no
  pintada en los lomos.
- **El sello**: para regalar, en el papel del paquete; para leerlo aquí, en la primera página del libro abierto; para llevar,
  en el borde doblado de la bolsa.
- **La «!»** (niveles 1 y 2): sobre las placas de las secciones, no (diría qué sección pide); sobre el lomo que asoma, para
  tirar de él; en los tres objetos de la tabla, en los tres a la vez (nunca delata cuál); y sobre el objeto de cada gesto.
- **El reparto**: lo vendido antes de esta versión no guardaba el título y no se repone. El aviso de Pilar sale una vez por
  día en cada dispositivo. La caja se coloca empujándola hacia arriba; arrastrar de uno en uno y «Colocarlos todos» siguen.
- **Sin la migración**, la app sirve con `cafe_servir` como en la 1.129: las estrellas y el +2 de antes, sin reparto ni Pilar.

## 16. Influencers, el taller de restauración y fuera la pizarra (propuesta, 14-11-2026)

Encargo de Francisco tras la 1.131: «Para darle más impacto a cada nivel, añadiría que aparezca un influencer antes de subir
de nivel un "cliente extra" y que ese cliente sea fijo en cada nivel […] tendrías un limite de tiempo para hacer todo y si lo
haces bien algo pasaría»; «a partir de cierto nivel […] clientes que te traen libros en mal estado que necesitan que lo
restaures, al día pondría como maximo uno, más otro de un amigo […] lo más artesanales y placenteras posibles […] darían
experiencia adicional y monedas adicionales […] que tuviese su propia identidad»; «eliminaria el apartado de la pizarra».

Todo lo de abajo es **propuesta**: las cifras y lo marcado como decisión, con su visto bueno. Toca la economía (granos y
reputación) y el servidor (migraciones nuevas, las aplica él).

**Decisiones de Francisco (14-11-2026, las cuatro recomendadas)**:
- el límite del influencer, con **el reloj de arena** (§16.2);
- a tiempo y con 3★, **«el vídeo se hace viral» y la foto firmada**, la opción a) (§16.2);
- el taller, **desde el nivel 3** (§16.3);
- la pizarra, **fuera del todo**, sin cuadritos dorados (§16.5).

**Cifras del taller aprobadas** (Francisco, 14-11-2026, «Sí, esas cifras del taller»): las de §16.3, también la mitad para
el encargo del amigo.

Sigue **por aprobar**, antes del bloque 3 (el bloque 2 no la necesita):
- la interpretación del encargo del amigo (§16.4).

### 16.1 Para comparar: lo que paga hoy un cliente

| Quién | 1★ | 2★ | 3★ |
| --- | --- | --- | --- |
| Cliente | 2 granos · 6 rep. | 4 · 10 | 5 · 14 |
| Habitual | 3 · 8 | 5 · 12 | 6 · 15 |
| Excéntrico (uno al día) | 5 · 14 | 10 · 26 | 15 · 40 |

Clientes al día: 3 en el nivel 1, hasta 10 en el 8. Atender a uno a mano, bebida y libro, lleva más o menos un minuto.

### 16.2 El influencer de cada nivel

- **Cuándo**: al llenar la barra del nivel, el café **está a punto de subir** y ese día llega, además de los clientes del
  día, **el influencer de ese nivel**. **El nivel sube al despedirle**, salga como salga, con su ceremonia: él graba, publica
  y el café sube. La reputación que se gane mientras no se le atiende sigue contando (no se pierde). Si no entras ese día, te
  espera al siguiente.
- **Cuentas que ya pasaron niveles**: los influencers de esos niveles vienen igual, uno al día y del más antiguo al más nuevo,
  sin frenar nada, para que nadie se los pierda.
- **Fijos y diseñados**: siete personajes propios, uno por subida, del 1 al 8. Son personajes originales, nunca parecidos a
  influencers reales, cada uno con su silueta, su accesorio, su forma de pedir y lo que publica:

| Sube a | Personaje | Lo que lleva (en 3D) | Qué pide (receta fija) | Su libro (el género, de tu balda) |
| --- | --- | --- | --- | --- |
| 2 · Café | La Bloguera del Muelle | gorra y palo de selfi con el móvil | café suave con avena y canela | corto, para llevar |
| 3 · Librería | El Booktuber de las Gafas Redondas | gorro de lana con pompón y aro de luz | té negro (intenso), sin leche, con miel | largo, para leerlo aquí |
| 4 · Ala lateral | La Crítica de la Libreta Roja | boina, libreta roja y lápiz | chocolate intenso con leche entera y nata | corto, para leerlo aquí |
| 5 · Terraza | El Fotógrafo de Escaparates | gorra plana y cámara con flash | café suave con leche entera y vainilla | corto, para regalar |
| 6 · Bodega | La del Directo de Medianoche | diadema de auriculares y micro | café con hielo intenso, con avena, sin toque | largo, para llevar |
| 7 · Tostadero | El Catador de Cafés | sombrerito y cuenco de cata con cucharilla | café intenso, sin leche ni toque | largo, para leerlo aquí |
| 8 · Catas | La Autora de «Cafés con alma» | sombrero ancho y un libro con cinta dorada | café con hielo suave, con leche entera y vainilla | largo, para regalar |

  Siempre a mano (Pilar no lo prepara), y lo que pide ya está abierto en tu carta en ese nivel.
  **Hecho en la 1.132.0** (SPEC §132): la tabla de arriba es la que vale (`cafeInfluencers.js` y la migración
  `20261219120000_cafe_influencer.sql`). Respecto a la propuesta cambiaron dos recetas:
  - el 7 pide café intenso sin nada, porque el tueste de la casa gasta tazas del saco;
  - el 8, café con hielo, entera y vainilla, porque el chai y el brûlée se abren en el propio nivel 8.
- **El límite de tiempo** (**decisión**: choca con «sin cuentas atrás» del café):
  - **Propuesta**: **un reloj de arena de latón en la barra**, nada de números ni alarmas. Lleva unos **2 min 30 s**, más o
    menos el doble de lo que se tarda en atender a alguien. Empieza al tocar «Atender» y se para al darle la taza y el libro. **Hecho (1.132)**: empieza al ir a la barra («A la barra»), para que pedir y leer la comanda no gasten arena; volver a
    la barra le da la vuelta otra vez, sin castigo (interpretación por confirmar).
  - **Si se acaba la arena**, no pasa nada malo: él dice «¡Se me acabó el directo! Igual tiene una pinta buenísima», paga como
    un cliente normal y el café sube de nivel igual. Solo se pierde lo especial.
  - **Con movimiento reducido**, el reloj se ve igual pero sin arena cayendo, con una barra quieta que se vacía.
  - Lo mide el servidor (hora de empezar y de entregar), con unos segundos de margen por la conexión.
- **Si lo haces bien** (a tiempo y con 3★) pasa algo especial (**decisión**). Opciones:
  - a) **«El vídeo se hace viral»**: al día siguiente llegan **3 clientes más** de los normales, que vienen por su vídeo
    (lo dicen al pedir). Además deja **su recuerdo**: una foto enmarcada y firmada que se cuelga en el café (solo adorno, uno
    por influencer: una colección de siete).
  - b) **Su recuerdo y granos**: la foto enmarcada y un premio de **30 granos y 60 de reputación**, una vez.
  - c) **Solo su recuerdo**: la foto enmarcada, sin nada más.
  - Recomiendo la **a)**: se nota en el juego del día siguiente, no solo en un número. En todos los casos, el influencer
    paga como el excéntrico según sus estrellas (§16.1).

### 16.3 El taller de restauración

- **Desde qué nivel** (**decisión**): recomiendo el **nivel 3, la Librería**, cuando el café se hace librería (1.000 de
  reputación, unas dos o tres semanas de juego). Alternativas: nivel 4, o nivel 6 en el sótano (demasiado tarde: meses).
- **Identidad propia: «El taller de la trastienda»**. Una puerta detrás de la barra que se abre en ese nivel y lleva a un
  cuartito propio en 3D, con su cámara y su ambiente:
  - el banco de trabajo con tapete verde, la prensa de husillo, la lámpara de brazo con lupa;
  - hilos de colores, botes de cola y engrudo, papeles marmoleados colgados;
  - un ventanuco con lluvia;
  - su paleta (verde botella, cuero y latón), su música (más lenta, de cuerda pulsada) y sus sonidos, todo sintetizado y
    propio.
  Un encuadernador jubilado del barrio, **don Celestino**, te deja su banco y te enseña el primer encargo con un par de
  frases (luego, solo comenta).
- **Los encargos**:
  - **Como mucho uno al día de un cliente**, y **otro de un amigo** (§16.4). No caducan: el del día espera en el banco
    hasta que lo hagas, sin prisas ni reloj.
  - El cliente trae su libro con una historia corta («era de mi abuela; se le despegó el lomo con la humedad del puerto»).
  - Son títulos clásicos de dominio público (lista cerrada) con su cubierta dibujada y gastada.
  - Cada libro llega con **2 a 4 daños** al principio y **hasta 5 o 6** en niveles altos, y cada daño se arregla con
    **su propio gesto, objeto y sonido**:

| Daño | Objeto | Gesto | Lo que se ve y se oye |
| --- | --- | --- | --- |
| Polvo y moho | brocha de pelo suave | pasadas largas y suaves | nube de polvo dorado a contraluz; roce de cerdas |
| Manchas y lápiz | goma de miga | frotar en círculos pequeños | la mancha se aclara y caen migas que barres con el canto de la mano |
| Página arrugada | plegadera de hueso | apretar y deslizar a lo largo del pliegue | la página se alisa; papel que se tensa |
| Desgarro | papel japonés y engrudo | colocar la tira, pincelar y asentar con el dedo | la rotura desaparece; pincel húmedo |
| Cuadernillo suelto | aguja curva e hilo de lino | coser siguiendo los agujeros en orden y tirar del hilo | la puntada se tensa; hilo que corre |
| Lomo despegado | cola caliente y prensa | pincelar el lomo y girar el husillo hasta el tope | la prensa baja y la madera cruje |
| Esquinas rotas | piel nueva | doblar la esquina en diagonal | esquina de piel limpia |
| Título borrado | pan de oro y hierro caliente | apretar y mantener sobre cada letra | las letras se encienden en oro; tintineo suave |

  - Al terminar, el **ex libris del taller** sellado en la guarda y la **ficha «antes / después»** del libro.
  - **Estrellas de 1 a 3** según el mimo: alisar sin pasarse, que el pan de oro quede centrado, las puntadas parejas… Como en
    la barra, nunca cero y se ve qué se podía mejorar.
- **Hallazgos**: a veces, entre las páginas, aparece algo del dueño anterior: una flor prensada, un billete de tranvía, una
  postal del puerto, una carta sin abrir… Se guardan en **la caja de los hallazgos** del taller, una colección solo de adorno.
- **El libro del taller**: un registro con cada restauración (fecha, título, de quién era, estrellas, hallazgo), para
  hojearlo.
- **Lo que paga** (**cifras aprobadas**, Francisco, 14-11-2026, «Sí, esas cifras del taller»):
  - **Encargo de un cliente**: **6 / 9 / 12 granos** y **15 / 22 / 30 de reputación** (1★ / 2★ / 3★). Es más o menos lo de
    dos clientes, porque lleva su rato (3 a 5 minutos).
  - **Encargo de un amigo**: la mitad (**3 / 5 / 6 granos** y **8 / 11 / 15 de reputación**).
  - Va **aparte del tope diario de reputación**, porque es una cantidad fija y como mucho dos al día.
  - **Sin tickets**.
  - Con los dos encargos a 3★, como mucho **18 granos y 45 de reputación más al día**.
- **Pilar no restaura**: el taller es siempre a mano (es el sitio de hacerlo despacio).

### 16.4 El encargo de un amigo

- **Interpretación (por confirmar)**: un amigo (os seguís los dos) te manda **uno de sus libros leídos** para que se lo
  restaures. Se elige desde su taller: «Mandar un libro a…».
- Cada uno recibe **como mucho uno al día** de amigos y manda **como mucho uno al día**.
- Te llega como un paquete al banco del taller. Al terminarlo, **vuelve a su dueño restaurado**:
  - su buzón del edificio le avisa, con la ficha «antes / después» y tu nombre;
  - en la balda de su café, ese lomo lleva una franja dorada «restaurado por …».
- **Quien lo manda no gana granos ni reputación**, solo su libro restaurado, para que no se mande por interés (como las
  visitas de §8).
- Sin texto libre.

### 16.5 Fuera la pizarra

- **Se quitan** el botón y el panel de la pizarra.
- La nota del habitual y la reseña dorada del excéntrico se siguen viendo **en su bocadillo al despedirle**.
- Pilar ya no dice «en la pizarra».
- **No se borra nada del servidor**: las reseñas siguen guardadas por si algún día se quieren enseñar en otro sitio.
- ~~Si las doradas tienen que dejar huella, colgarlas como cuadritos dorados en la pared del café~~: **descartado** por
  Francisco (14-11-2026, «Quitarla del todo»).

### 16.6 Bloques (con capturas y vídeo al terminar cada uno)

1. **Fuera la pizarra y el influencer**: los siete personajes, el reloj de arena, la subida al despedirle y lo especial.
   Migración nueva (influencers y la subida de nivel).
2. **El taller, primera tanda**: la trastienda en 3D, don Celestino, el encargo del cliente con cinco daños (polvo, manchas,
   arrugas, lomo y prensa, y dorado), el ex libris y la ficha «antes / después». Migración nueva (encargos y pagos).
3. **El taller, segunda tanda**: coser, desgarro y esquinas, los hallazgos, el libro del taller y el encargo del amigo.
   Migración nueva (envíos entre amigos).

### 16.7 Bloque 2, hecho (1.133.0, 14-11-2026), con interpretaciones por confirmar

El taller de la trastienda, primera tanda (SPEC §133; migración `20261220120000_cafe_taller.sql`, la aplica Francisco). Lo
empezó una cuenta y lo terminó la otra. Lo que se decidió sin preguntar:

- **El primer encargo, siempre el mismo**: el Quijote, con polvo, una página arrugada y el título borrado. Es el que enseña don
  Celestino (dos frases la primera vez; después, solo comenta). Los demás, libro, cliente y daños al azar.
- **Cuántos daños**: 2 o 3 en los niveles 3 y 4, 3 o 4 en el 5 y el 6, y 4 o 5 desde el 7 (de los cinco de esta tanda; en la
  segunda, hasta 6).
- **«Lomo y prensa» es un solo daño con dos gestos**: pincelar la cola y girar el husillo. Cuenta lo peor de los dos (en la
  prensa no se puede fallar: el mimo lo pone la cola).
- **El mimo de cada daño, en dos valores**: «bien» o «se podía mejorar»; nunca cero. La brocha, sin prisa (pasadas rápidas
  levantan el polvo en vez de quitarlo); la goma, dentro de la mancha; la plegadera, cerca del pliegue; la cola, sin cargar
  demasiado un tramo; el hierro, centrado en la letra. El ex libris no puntúa.
- **Las estrellas** las pone el servidor: 3 con todos bien, 2 con al menos la mitad, 1 si no.
- **Uno al día que no caduca**: el encargo llega al abrir el café (desde el nivel 3) y se queda en el banco hasta que lo
  termines, aunque pasen días; el siguiente llega a partir del día después de terminarlo (nunca dos el mismo día).
- **«Luego» a medias**: lo hecho se recuerda mientras la app sigue abierta; si la cierras, el encargo sigue en el banco y se
  empieza otra vez desde el principio (el servidor solo guarda el encargo terminado).
- **La «!»**: el taller empieza en el nivel 3, así que solo sale si te quedas parado (o con «Ayudas visuales: siempre»), sobre
  lo siguiente: la mancha que queda, la letra que falta, el husillo, el sello.
- **Movimiento reducido**: un toque sobre el libro (o el botón del atajo, o Intro) hace cada gesto de una vez y queda bien.
- **La puerta del taller** está en la pared de la derecha, detrás de la barra, con su letrero desde el nivel 3. Sin la migración,
  no hay letrero y el café va como en la 1.132.

**Tras verlo Francisco** (14-11-2026, «me gusta pero…»; SPEC §133.5): los gestos, más cortos (el polvo, unas cuatro pasadas).
Don Celestino, hecho a mano, con visera verde, bigote de morsa, gafas de media luna, pajarita, chaleco y mandil con remaches.
El menú del taller, un libro en media piel con puntas: tejuelo rojo, lomo con nervios dorados, botones de piel y de estraza y
cinta de registro. El taller suena en su propia sala, la trastienda (la voz de don Celestino y un soplo por cada cuarto de
polvo), y su música lleva violonchelo con arco, lluvia en el cristal y brasas. Las evidencias van con sonido. Sin cambios de
servidor, cifras ni economía.

## 17. De dónde salen los libros (aprobada el 16-11-2026, «Sí, esas cifras»; hecha en la 1.139.0, SPEC §139)

Francisco, 16-11-2026: la mecánica de sacar y preparar el libro le gusta; lo que no le convence es **comprar los libros** y que
**dependan solo de tu biblioteca** («la gente que lea poco no tendrá muchas opciones y si no tienes dinero pierdes esa parte del
juego»). Eligió el **catálogo del café más tus leídos** y el **reparto diario gratis**. La librería (estantería por secciones,
tirar del lomo, la tabla y los gestos de envolver) **no cambia**.

### 17.1 El catálogo del café

- **80 libros reales**, 8 por cada uno de los 10 géneros, conocidos y variados (clásicos y actuales; cortos y largos), con
  título, autoría, páginas, año e ISBN para la portada (la misma vía que hoy: la portada por ISBN y, si no, la tapa de color).
  Igual para todos y fijo en la app y en el servidor (prueba de paridad). Solo datos del libro: ni sinopsis ni textos de nadie.
- **Tus leídos se suman**: cada uno lleva en la balda y en la tabla un **sello «Leído por ti»** (una cinta de tela en el lomo y
  el sello en la ficha). Se quita el préstamo de «Leyendo» y «Quiero leer»: ya no hace falta.

### 17.2 El reparto de la mañana, gratis

- Cada día llega **gratis** una caja con libros: **6 en los niveles 1 y 2, 8 del 3 al 5 y 10 del 6 en adelante**, nunca más de
  los huecos libres de la balda (sin hueco no llega nada; no se acumula).
- **Qué trae** (lo sortea el servidor): primero, lo que se vendió desde el último reparto (el mismo título); después, del
  catálogo, procurando que la balda tenga **al menos 3 géneros**. Si tienes leídos, **uno de cada tres** de la caja es tuyo.
- Sustituye al reparto de 2 granos por ejemplar de la 1.130: **ya no cuesta nada**. El aviso de Pilar y empujar la caja para
  colocar, igual.
- **Las cajas con granos siguen**, como extra: de un género, 5 por 10 granos, y de un título concreto, 3 por 9, ahora del
  catálogo y de tus leídos.

### 17.3 Lo que paga

- El ejemplar que se lleva el cliente: **+4 granos** como hoy; **+6 si es uno de tus leídos** («lo recomiendas tú»).
- Estrellas, reputación y tope diario, sin cambios.

### 17.4 Para las cuentas que ya juegan

- Lo que ya hay en tu balda y en tus cajas se queda. Los títulos del catálogo se añaden; nada se borra.
- Migración nueva (la aplica Francisco): el catálogo en el servidor, el reparto gratis y el +6 de tus leídos. Sin ella, el café
  sigue como en la 1.138.

## 18. El obrador: vender comida (aprobada el 17-11-2026, las cuatro recomendadas)

Encargo de Francisco (17-11-2026), literal: «una nueva mecanica que se desbloquearía a un nivel que tu consideres necesario.
Vender comida, algo como starbucks pero super cozy que de pie a mejora y tenga mecanicas adictivas y que inciten a seguir
jugando».

De la cadena del ejemplo **solo se toma el género** (una cafetería con mostrador de comida): ni su nombre, ni su marca, ni sus
tamaños, nombres de vasos o logos, ni escribir el nombre del cliente en el vaso. **Aprobado por Francisco** (17-11-2026, las
cuatro recomendadas de §18.13): **nivel 4**, **las cifras de la tabla**, **la venta del mostrador como la hucha** (7 días) y **solo
el favorito de los habituales**, sin maridajes. Toca la economía (granos) y el servidor (una migración por bloque, las aplica él).
**No toca los tickets ni la reputación.**

### 18.1 La idea en una frase

Al abrir la pared del ala lateral aparece **el horno de leña de la antigua tahona** que hubo en el bajo, con **el recetario de su
panadera** encima. Horneas por tandas con gestos de obrador; lo horneado espera en **la vitrina de la barra**, sin estropearse
nunca; se lo pones a los clientes que piden «algo para acompañar»; y **mientras no estás, Pilar vende en el mostrador** lo que
dejaste. Solo da **granos**: la lectura sigue moviendo los tickets y la reputación sigue al ritmo de siempre.

### 18.2 En qué nivel se abre: el 4, el ala lateral (recomendado)

Con el ritmo de §14.1 (unos 4 días en el nivel 1, 9 en el 2, 16 en el 3 y 23 en el 4), el nivel 4 (2.500 de reputación) llega
**hacia el día 30**, el primer mes de juego (algo antes con la pizarra de la acera y los virales).

- **Es cuando la barra se vuelve rutina**: a ese ritmo ya se han servido unas 150 tazas, Pilar domina el café, el té y el
  chocolate (12 de 2★ o más cada uno, §15.1) y las manos piden algo nuevo. El obrador devuelve los gestos a mano.
- **Tiene una razón en el local**: el 4 es el nivel que abre la pared de la izquierda (§13). Detrás aparece el horno: el espacio
  sirve para jugar, no solo para decorar (§12.1).
- **No se amontona**: el 3 ya trae el taller (hacia el día 13); juntar las dos cosas abruma. El 5 (hacia el día 50) sería tarde
  para un bucle principal.
- **Rellena el tramo largo del 5 al 6** (más de 40 días): las mejoras del horno y de la vitrina y las recetas de los niveles 5 a 8
  dan objetivos mientras tanto.
- Alternativas: **nivel 3** (junto al taller, hacia la 2.ª semana) o **nivel 5** (con la terraza, hacia la 7.ª u 8.ª semana).

### 18.3 Dónde está y cómo se ve

- **El obrador**, en el fondo del ala lateral, empotrado en la pared y fuera de la cuadrícula (como el tostador, §14.8): el arco de
  ladrillo con la boca del horno encendida, la mesa de amasar de mármol con harina, la pala de madera colgada y, desde la tortilla
  (nivel 8), el fogón de hierro. Al tocarlo, la cámara se acerca como a la barra.
- **La vitrina, en la barra**: lo horneado se ve pieza a pieza en 3D (magdalenas en su papel rizado, porciones de empanada,
  galletas con forma de ancla…), con la etiqueta de tiza de la especialidad del día. Así, servir comida no añade paseos: las pinzas
  se usan en la barra, después de la taza. **Crece con sus grados**: una campana de cristal en la punta de la barra (1), una
  vitrina de madera y cristal (2), el mostrador delante de la barra (3) y la vitrina de dos alturas (4).
- **El horno también se ve mejorar**: restaurado, con sus grietas y una bandeja (1); con puerta de hierro nueva y dos bandejas (2);
  con azulejos y tres bandejas (3).
- **En la mesa del cliente**, junto a la taza y el libro: en plato si lee aquí, en una bolsita de papel si se lo lleva y en una
  cajita atada con cordel si es para regalar (lo mismo que eligió para el libro, sin gesto de más).
- **El recetario**, la interfaz del obrador, con **identidad propia** (como el libro del taller, §16.7): un cuaderno de cocina con
  tapas de hule a cuadros, manchas de harina, recetas escritas a mano y fichas sujetas con una pinza de la ropa. Una página por
  receta: su dibujo, sus estrellas de maestría, sus gestos, lo que paga y cuándo se abre. Las cerradas dicen en qué nivel se abren
  (sin misterio ni sorteos). La última página es la del obrador: sus mejoras y lo que te ha dado cada una.
- El estilo de siempre: píxel y vóxel de Libotown, luz cálida pintada, sin luces en tiempo real.

### 18.4 El bucle: hornear, la vitrina y servir

1. **Elegir en el recetario** qué hornear.
2. **Preparar** en la mesa de mármol con los dos gestos de la receta (§18.5), unos 30 a 40 s.
3. **Al horno con la pala** (gesto común: empujar la pala hacia el fondo). El horno hornea **mientras haces otra cosa**, de 1 min a
   1 min 30 s (lo que se tarda en atender a un cliente), **sin números**: por la boca del horno se ve cómo sube y se dora, con el
   chisporroteo de la leña, y al estar suena una campanilla suave. **Nunca se quema ni se pasa**: si te vas, al volver está hecho.
4. **Sacar con la pala** (tirar hacia ti): la bandeja sale humeando y Pilar la lleva a la vitrina. Lo que no cabe espera en el
   horno, sin perderse; mientras tanto no se puede hornear otra (es la señal de vender primero, no un castigo).
5. **Servir** (cambiado el 17-11-2026, ver §18.13, punto 5: **máximo dos cosas por cliente**; lo de abajo era la propuesta): muchos clientes piden, además de la taza y el libro, **«y para acompañar…»**: algo dulce, algo salado o la
   especialidad del día. Tras la taza, en la barra, **las pinzas**: tocar la pieza en la vitrina y llevarla al plato (un gesto
   corto, con su clic de metal). Si das un dulce a quien pedía salado, lo dice («Uy, mejor algo salado») y la pieza vuelve a la
   vitrina: se elige otra, sin castigo. Si no te queda, «Hoy no me queda»: paga la taza y el libro como siempre.
6. **La comida no cambia las estrellas ni la reputación** del cliente: solo suma los granos de la pieza (§18.9).
7. **La venta del mostrador**: por cada día entero que pasa, Pilar vende a la gente de la calle unas pocas piezas de la vitrina
   (según su grado), guardando como mucho 7 días, como la hucha (§142). Al entrar, la caja de latón del mostrador: «Mientras no
   estabas se llevaron cuatro magdalenas y dos porciones de empanada». Se abre tirando del cajón (gesto y sonido de caja
   registradora) y caen los granos.

**Las estrellas de la hornada**: cada gesto tiene su **mimo**, «bien» o «se podía mejorar», como en el taller (§16.7); 3★ con
todo bien, 2★ con la mitad y 1★ si no. **Las estrellas dan piezas**: la bandeja llena con 3★, una pieza menos con 2★ y dos menos
con 1★. Nunca cero. Con movimiento reducido o con el teclado, un toque hace cada gesto de una vez y sale bien.

**Lo que lleva al día**: una o dos hornadas y dos o tres segundos de pinzas por cliente. Con el horno mejorado, una hornada da para
el día; con la receta dominada, la hornea Pilar (§18.6). La lectura no pierde su sitio.

### 18.5 Las recetas, cada una con su gesto, su objeto y su sonido

Seis recetas, tres dulces y tres saladas, una por nivel desde el 4 (dos al abrir). Cada una con **dos gestos propios** que no
están en la barra, la librería ni el taller; la pala y las pinzas son comunes a todas. Sonidos propios sintetizados, en la sala
cálida del café (`calido` en `cafeSfx.js`), con el crepitar de la leña de fondo junto al horno.

| Receta | Nivel | Gesto 1 | Gesto 2 | Objetos | Lo que se ve y se oye | El mimo |
| --- | --- | --- | --- | --- | --- | --- |
| Magdalenas de limón (dulce) | 4 | **Rallar el limón**: deslizarlo hacia abajo por el rallador, varias veces | **Colmar los moldes**: un barrido con la cuchara de masa por encima de los seis | rallador de latón, bandeja de moldes de papel rizado | raspado cítrico y lluvia amarilla de ralladura; plop blando de la masa | no pasarse a lo blanco; llegar a los seis |
| Empanada de bonito (salada) | 4 | **Estirar con el rodillo**: tres pasadas largas de arriba abajo | **El repulgo**: seguir con el dedo el borde redondo, que se pellizca a su paso | rodillo de madera, fuente redonda de barro | el rodillo rueda en el mármol; pellizcos de masa | pasadas parejas; no salirse del borde |
| Galletas del puerto (dulce) | 5 | **Los cortapastas**: tocar la masa donde quieras cortar (ancla, barco, estrella de mar y faro) | **La glasa**: seguir con la manga el contorno punteado | cortapastas de hojalata, manga de glasa | clic de hojalata; hilillo de glasa | que no se pisen las formas; seguir la línea |
| Pan de la bodega (salado) | 6 | **Amasar**: empujar con la palma hacia arriba y recogerla, cuatro veces (la masa se estira y vuelve) | **Greñar**, al día siguiente: un solo tajo curvo y decidido con la cuchilla | masa madre en su tarro, cesto de mimbre con un paño, cuchilla | masa elástica; la corteza que cruje al salir | ritmo parejo; un tajo sin dudar |
| Bizcocho del tostadero (dulce) | 7 | **Envolver con la espátula**: tres trazos en jota, por el centro hacia abajo y subiendo por el lado | **La plantilla**: pasar el dedo sobre el tamiz de azúcar glas y levantarla (aparece el ancla del café) | bol de loza, espátula, molde de cobre, tamiz; lleva el tueste de la casa | masa que se pliega; azúcar que cae como nieve | trazos enteros; cubrir toda la plantilla |
| Tortilla de patatas (salada) | 8 | **Cascar los huevos**: un toque seco en el borde del bol y abrir hacia los lados, tres | **Darle la vuelta con el plato**: medio giro decidido | bol, sartén de hierro en el fogón, plato de loza | chisporroteo del aceite; el golpe suave de la tortilla al caer | cascar sin cáscaras; un giro sin dudar |

La pala (meter: empujar hacia el fondo; sacar: tirar hacia ti), las pinzas (tocar y arrastrar al plato) y el cajón de la caja
(tirar hacia ti) tienen también su sonido: madera sobre ladrillo, clic de metal y el timbre de la caja.

### 18.6 Las mejoras y la maestría

Como el cuaderno de Pilar: se pagan una vez con granos, tienen grados y **nunca caducan**. Están en la última página del recetario,
con lo que te ha dado cada una.

| Mejora | Grado 1 | Grado 2 | Grado 3 | Grado 4 |
| --- | --- | --- | --- | --- |
| **El horno de leña**: bandejas por hornada, con los mismos gestos | 1 · al abrir, gratis | 2 · 250 granos · desde el nivel 4 | 3 · 600 · desde el 6 | — |
| **La vitrina**: piezas que caben · las que vende Pilar al día | 12 · 4 · gratis | 20 · 6 · 150 · nivel 4 | 30 · 9 · 350 · nivel 5 | 40 · 12 · 700 · nivel 7 |

- **Las vitrinas de tartas** (el mueble del nivel 2, 90 granos) **que tengas colocadas** suman **6 huecos** cada una a la vitrina,
  hasta dos. El mueble que ya se compró, ahora sirve.
- **La maestría** no se compra: se gana horneando. Por receta, con hornadas de 2★ o más: **★ con 3** (+1 pieza por bandeja), **★★
  con 10** (+1 grano por pieza) y **★★★ con 25** (la página se dora y aparece «Que lo hornee Pilar»: hace los gestos en 3D, como
  con las bebidas, §15.1; siempre se puede hacer a mano).
- **No hay mejoras que acorten el horno**: la espera es corta y no se vende.

### 18.7 Lo que engancha, sin trampas

- **La colección del recetario**: seis páginas que se abren con los niveles y se doran al dominarlas.
- **La maestría**: cada receta, sus tres estrellas, con un premio que se nota en la bandeja y en la caja.
- **La especialidad del día**: cada día el servidor elige una de tus recetas abiertas; se ve en la etiqueta de tiza de la vitrina,
  más clientes la piden y paga **+1 grano por pieza**, también en el mostrador. Si no la horneas, no pasa nada.
- **Listo al volver**: lo que dejaste en el horno está hecho; la caja del mostrador guarda lo que vendió Pilar; y **el pan de la
  bodega** (nivel 6) se amasa un día y reposa toda la noche en la bodega fresca: al día siguiente la masa ha subido bajo su paño y
  se greña y se hornea. Una masa al día y sin plazo: si no vuelves, sigue esperando (como el saco del tostadero).
- **Los hitos del obrador**, por piezas vendidas en total (mesa y mostrador): **25 / 100 / 250 / 500 / 1.000**. Cada uno deja **un
  adorno fijo en el obrador** (cazos de cobre, una ristra de moldes, el letrero pintado «Obrador» sobre el arco, la campanilla de
  latón del mostrador, que suena al vender, y el retrato de la panadera del recetario) y **20 granos**.
- **El favorito de cada habitual** (aprobado): los doce habituales, los que trae tu lectura, tienen su receta favorita. Si está
  en tu recetario, la piden por su nombre («¿Te quedan magdalenas?») y pagan **+2**. Tu lectura alimenta también el obrador.
- ~~Los maridajes~~: **descartados** (Francisco, 17-11-2026, «Solo el favorito»), como el 14-11.
- **El excéntrico** pide la comida con un acertijo («Algo con el mar dentro y masa por fuera») y paga el doble de la pieza. El
  influencer no pide comida: su pedido es fijo.
- **Cuando visitan tu café** (solo mirar, §141), se ven la vitrina con lo que tengas, el horno con su grado y los adornos de los
  hitos.

### 18.8 Lo que no se hace

- **No se castiga no entrar**: los clientes siguen sin irse, la venta del mostrador guarda 7 días y la masa de la noche espera.
- Lo horneado **no se estropea, no caduca y no se quema**. Lo que no cabe espera en el horno.
- **Sin cuentas atrás**: el horno no tiene números ni alarmas; sin rachas, energía ni «vuelve en tantos minutos»; ningún aviso fuera
  del café.
- **Sin cajas sorpresa**: las recetas se abren por nivel, a la vista; sin sorteos de piezas ni de recetas.
- **Los ingredientes son gratis** (la despensa no se acaba): quedarse sin granos nunca deja sin hornear. Es lo que no gustó de
  comprar libros (§17).
- **Nada de dinero real**: los granos no se compran, no pasan a tickets ni entre cuentas.
- **No toca los tickets** (tope de 5 al día, sin cambios) **ni la reputación** (los niveles, y sus tickets, llegan al mismo ritmo).
- Nada de pagar granos para esperar menos.

### 18.9 Economía: las cifras

**Las recetas** (cifras recomendadas):

| Receta | Abre en | Tipo | Piezas por bandeja (3★ / 2★ / 1★) | Granos por pieza | En el horno |
| --- | --- | --- | --- | --- | --- |
| Magdalenas de limón | nivel 4 | dulce | 6 / 5 / 4 | 2 | 1 min |
| Empanada de bonito | nivel 4 | salada | 6 / 5 / 4 porciones | 3 | 1 min 30 s |
| Galletas del puerto | nivel 5 | dulce | 8 / 7 / 6 | 2 | 1 min |
| Pan de la bodega | nivel 6 | salado | 8 / 7 / 6 rebanadas | 4 | reposa una noche; luego, 1 min |
| Bizcocho del tostadero | nivel 7 | dulce | 8 / 7 / 6 porciones | 4 | 1 min 30 s |
| Tortilla de patatas | nivel 8 | salada | 8 / 7 / 6 pinchos | 5 | 1 min en el fogón |

**Lo que se suma a la pieza**: la especialidad del día +1; la maestría ★★ +1; el excéntrico, el doble; y el favorito del habitual
+2. En el mostrador, Pilar vende a precio base (con la especialidad).

**Quién pide** (desde el 17-11-2026, §18.13, punto 5): **uno de cada tres** clientes del día (lo decide el servidor con la semilla
del día), y **ese no pide libro**. Ni el excéntrico ni el influencer. Los habituales, en el mismo sorteo (en la 1.145, su favorito).

**Comparado con lo que paga hoy un cliente (§16.1)**: un cliente a 3★ deja 5 granos y 14 de reputación, más 4 o 6 por el ejemplar
que se lleva. La pieza suma de 2 a 5 granos (hasta 7 con los extras): **acompañar la taza vale como medio cliente en granos y
nada en reputación ni en tickets**.

| Un día jugado entero | Nivel 4, recién abierto | Nivel 5, horno 2 y vitrina 3 | Nivel 8, todo mejorado y dominado |
| --- | --- | --- | --- |
| Lo de hoy, sin comida (clientes, libros, habituales, taller y hucha) | unos 105 granos | unos 120 | unos 190 |
| Piezas servidas en la mesa | ~5, unos 13 granos | ~6, unos 18 | ~9, unos 45 |
| Venta del mostrador | 4 piezas, unos 10 | 9, unos 23 | 12, unos 42 |
| **Lo que suma la comida** | **unos 23 (+22 %)** | **unos 41 (+34 %)** | **unos 87 (+46 %)** |
| Reputación y tickets | sin cambios | sin cambios | sin cambios |

Los niveles 6 a 8 suman más porque llevan unos 2.000 granos invertidos en el obrador (horno 250 + 600 y vitrina 150 + 350 + 700) y
las recetas dominadas. Los tickets siguen atados a la lectura: el tope de 5 al día del café no sube y la comida no da ninguno.

### 18.10 Las cuentas que ya están por encima (y las de debajo)

- **Por debajo del nivel 4**, nada cambia. El cartel de la subida al 4 añade «El obrador: el horno de la antigua tahona y su
  recetario». En el 3, Pilar comenta una vez que «detrás de esa pared huele a pan de otro tiempo», sin aviso ni prisa.
- **En el 4 o más, la primera vez que se entra** tras la versión: la cámara va al fondo del ala, donde Pilar ha descubierto el
  horno al mover la estantería («Mira lo que había detrás: el horno de la tahona de doña Amparo, la que tenía el bajo cuando yo era
  niña»), con su recetario. Un cartel como el de subir de nivel: «Se abre el obrador», con lo que trae.
  - **Las recetas de tu nivel, abiertas a la vez** (en el 6, las cuatro primeras), con la «!» roja de lo nuevo en cada página
    hasta verla (`cafeNuevo.js`).
  - **La primera hornada, de la casa**: la vitrina ya trae seis magdalenas, para servir desde el primer cliente.
  - El horno y la vitrina, en el grado 1; los grados siguientes, a la venta si tu nivel llega.
  - **Nada atrasado**: ni granos ni hitos por los niveles ya pasados; los hitos del obrador cuentan desde ese día. Así nadie recibe
    de golpe lo que a otros les cuesta jugar.
  - La «!» que guía la primera hornada y la primera pieza servida sale aunque estés por encima del nivel 2 (es nuevo para todos);
    después, solo si te quedas parado.
- **Las dos cuentas de prueba** (Francisco y su pareja) estaban en el nivel 3 desde el 15-11: con «Otra jornada» se llega al 4
  jugando. Para probarlo antes haría falta otro script como el del nivel 3, y solo si él lo pide.

### 18.11 Servidor: qué se guarda, qué se comprueba y por qué no se puede explotar

Migraciones nuevas (las aplica Francisco con el flujo del SQL Editor), aditivas y re-ejecutables, con RLS activada, `revoke all`
a `anon` y `authenticated` en las tablas y todo el acceso por funciones `security definer`, `set search_path = ''` y `volatile`
(§6). Pruebas con PGlite y de paridad entre las cifras de la app y las del servidor. Nombres provisionales:

| Bloque | Migración | Qué trae |
| --- | --- | --- |
| 1 | `20261225120000_cafe_obrador.sql` | **Hecha en la 1.143** (§143.5 del SPEC). Tablas `cafe_obrador` (por cuenta: abierto, vendidas y granos dados), `cafe_obrador_horno` (cuenta + bandeja: receta, piezas, estrellas y desde cuándo), `cafe_obrador_vitrina` (cuenta + receta: piezas), `cafe_obrador_hornadas` (lo horneado cada día, para el tope de 30) y `cafe_obrador_ventas` (cuenta + día + cliente: receta y granos). Las cifras, en funciones internas (`cafe_obrador_nivel`, `cafe_obrador_receta`, `cafe_obrador_bandejas`, `cafe_obrador_cabe`, `cafe_obrador_tope`). Para la app: `cafe_obrador(dia)` (el estado y quién pide comida ese día, **aparte de `cafe_json`**, que no se toca), `cafe_obrador_abrir()`, `cafe_hornear(receta, mimo)` (el mimo de los dos gestos, **2 bien o 1 se podía mejorar**, como el taller), `cafe_sacar_hornada(bandeja)` y `cafe_servir_comida(dia, cliente, receta)`. `cafe_entregar` no se toca. |
| 2 | `20261226120000_cafe_obrador_mejoras.sql` | Los grados del horno y de la vitrina (`cafe_obrador_mejorar`), las vitrinas de tartas del plano, la venta del mostrador (`cafe_mostrador_cobrar`), la especialidad del día y la maestría (`cafe_obrador_recetas`: hornadas buenas por receta). |
| 3 | `20261227120000_cafe_obrador_recetario.sql` | Las recetas de los niveles 5 a 8, la masa del pan (`cafe_masa_reposar`, una al día), los hitos del obrador, la comida del excéntrico, el favorito de los habituales y lo que ven las visitas. |

**Reglas que no se pueden saltar**:
- **El nivel es el del servidor**: el obrador y cada receta, solo desde su nivel; cada grado, desde el suyo.
- **Hornear**: con el horno libre y una receta abierta. El mimo llega como una lista del largo de esa receta con valores 0 o 1
  (como en el taller); las estrellas y las piezas las cuenta el servidor (la base por estrellas, más la maestría, por las
  bandejas). Hasta 30 hornadas al día, para no llenar tablas (nadie llega jugando).
- **Sacar**: solo si ha pasado el tiempo de la receta, medido por el servidor con 5 s de margen por la conexión. A la vitrina
  hasta su capacidad (grado más las vitrinas de tartas colocadas en el plano, hasta dos); lo demás sigue en el horno.
- **Servir comida**: solo a un cliente ya servido hoy (o ayer, como siempre), que **pidió comida** según `cafe_pide_comida` (lo
  decide el servidor con la semilla del día, nunca la app); la pieza tiene que encajar (dulce, salada o la receta pedida); con
  existencias, leídas con `for update`; **una vez por cliente y día** (clave primaria); granos fijos del servidor, nunca cifras de
  la app; `least(100000, granos + n)`.
- **El mostrador**: los días enteros desde la última vez, como mucho 7; vende lo que haya en la vitrina, como mucho el cupo diario
  de su grado por día, a precio base.
- **Mejorar**: el grado siguiente, con su precio y su nivel; saldo con `for update`, nunca por debajo de 0 (como
  `cafe_pilar_mejorar`).
- **El pan de la noche**: una masa al día; lista desde el día siguiente (Madrid), sin plazo.
- **Nada da reputación ni tickets** y nada pasa entre cuentas. Lo ganado cuenta en «granos ganados en total» del ranking (§141),
  como cualquier grano ganado jugando.
- **Las jornadas de prueba** (`cafe_probadores`, solo las dos cuentas): «Otra jornada» cuenta como un día para el mostrador y para
  la masa, como el saco del tostadero (`PRUEBA_DESDE`). Para el resto, nada cambia.
- **Sin la migración**, el café va como en la 1.142: sin obrador.

**Por qué no se puede explotar**: lo único que dice la app es el mimo de los gestos (como en el taller), y mentir da, como mucho, lo
mismo que una hornada perfecta. Lo que se gana con la comida tiene techo diario: las piezas que piden los clientes del día (los fija
el servidor) y el cupo del mostrador, a precios fijos. Hornear de más no da más: lo que sobra se queda en la vitrina. La reputación
y los tickets no se mueven.

### 18.12 Bloques (cada uno con capturas a 360 y 390 y un vídeo con sonido)

1. **1.143.0, el obrador abre**: la escena del horno en el ala lateral; el recetario con sus seis páginas (dos abiertas); las
   magdalenas y la empanada con sus cuatro gestos y sus sonidos; la pala; el horno con su campanilla; la vitrina de la barra (grado
   1); la primera hornada de la casa; los clientes que piden algo dulce o salado; las pinzas y la pieza en la mesa. Migración 1.
2. **1.144.0, las mejoras y el mostrador**: los grados del horno y de la vitrina, y cómo se ven; las vitrinas de tartas que suman;
   la venta del mostrador con la caja de latón; la especialidad del día; la maestría y «Que lo hornee Pilar». Migración 2.
   **Hecho en la 1.144.0** (19-11-2026, SPEC §144; publicada con la migración `20261226120000_cafe_obrador_mejoras.sql`
   aplicada, «Sí, aplicar y publicar»).
3. **1.145.0, el recetario crece**: las galletas (5), el pan de la bodega con su noche (6), el bizcocho del tostadero (7) y la
   tortilla en el fogón (8); los hitos con sus adornos; la comida del excéntrico; el favorito de los habituales; lo que ven las
   visitas. Migración 3. Si pesa mucho, 3a (niveles 5 y 6) y 3b (7 y 8).
   **Hecho en la 1.145.0** (22-11-2026, SPEC §145; Francisco: «Termina el obrador 1.145»), de una vez, sin partir. Sin publicar:
   la migración `20261227120000_cafe_obrador_recetario.sql` está **sin aplicar**. Interpretaciones **aprobadas** por Francisco (25-11-2026, «Si»):
   el excéntrico pide comida la mitad de los días, con acertijo (pista al fallar, el doble al acertar); la lista de favoritos; el
   pan se amasa un día y se greña al siguiente; la tortilla en un fogón en el rincón a la izquierda del horno (ocupa una bandeja);
   dónde cuelgan los adornos de los hitos; la campanilla del cuarto hito suena al vender; el bizcocho no gasta tueste.
   **1.145.1** (25-11-2026, SPEC §145.7; Francisco: «un cambio antes»): el aviso del horno (el horno del HUD y la nota de la campanilla).

Al cerrar cada bloque: versión, SPEC y ESTADO. Commit, migraciones y `main`, solo cuando Francisco lo pida. Sin probar en móviles
reales: se dirá en cada entrega.

### 18.13 Decisiones de Francisco (17-11-2026, las cuatro recomendadas)

1. **El nivel**: **el 4, el ala lateral** (elegido). Se descartan el 3 (con el taller) y el 5 (con la terraza).
2. **Las cifras**: **las de §18.6 y §18.9** (elegidas). Se descartan las más generosas y las más contenidas.
3. **La venta del mostrador mientras no estás**: **como la hucha, guardando 7 días** (elegida). Se descartan «una vez al día» y «solo
   a los clientes».
4. **El favorito de los habituales y los maridajes**: **solo el favorito de cada habitual** (elegido; une la comida con la lectura).
   Los maridajes siguen descartados, como el 14-11.
5. **Máximo dos cosas por cliente** (tras ver la 1.143, el mismo día: «se volvería muy pesado el proceso, el maximo lo pondría en
   dos»; eligió «Dos máx., 1 de cada 3»). Cada cliente pide bebida y libro, o bebida y comida, nunca las tres. Uno de cada tres pide
   comida y no libro; sus estrellas, solo de la bebida (4 aciertos, 3★; 2 o 3, 2★; si no, 1★); la comida, aparte, solo granos.
   La taza y la pieza van en el mismo viaje: de la barra a la vitrina (las pinzas, tuyas) y a la mesa, como el libro. Se descartó
   que Pilar sirviera la comida: «perdería la gracia de incluir la nueva mecánica».
