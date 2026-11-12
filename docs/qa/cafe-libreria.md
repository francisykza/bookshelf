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
