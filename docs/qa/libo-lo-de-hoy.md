# «Lo de hoy»: el menú de Libo en tu piso (1.158.0)

Encargo de Francisco (26-11-2026): «que el menú de Libo sea más gracioso y limpio, y que te diga de manera limpia y atractiva
qué cosas puedes hacer en el día» (intentos del casino que quedan, muebles en oferta de los que quieres, muebles nuevos, clientes
nuevos en el café, si alguien te ha dado algo…). Proceso:

1. **Primera propuesta** (27-11-2026, boceto): la tarjeta «Lo de hoy». Francisco: «Sí, que pregunte» (Libo **puede preguntar al
   servidor** por el casino y las misiones) y «no está mal pero todavía puede mejorar, darle más identidad pixel pero sin saturar y
   que los iconos sean más originales».
2. **Segunda propuesta** (27-11-2026, maqueta con la letra PuertoPixel, poses reales e iconos propios): Francisco: «Sí,
   constrúyelo».

## Qué es

Al tocar a Libo en tu piso de inicio, su bocadillo es ahora una tarjeta de papel con marco de madera de esquinas escalonadas
(como los marcos de 7 × 7 de `pixelUi.js`) y sombra dura pequeña:

- **Pestaña «Lo de hoy»** (salvia) y un **botón de cerrar** de 44 px (además de tocar fuera, Escape y Atrás).
- **Saludo** con lo que hay: «Hoy tienes **seis cosas** por aquí. Ninguna corre prisa.»; con todo hecho, «Hoy ya está **todo**.
  Me echo una siesta en tu piso.» (y Libo, en su esquina, se duerme mientras lo dice).
- **Filas**: cada una con su icono de píxel en una baldosa, el dato en corto (letra de píxel, mayúsculas) y una frase con gracia
  (cursiva). Toda la fila es un botón de 44 px como poco que lleva a su sitio; a la derecha, una flecha o un número en latón
  («3», «0/3»). Como mucho **cinco** a la vista; «y N cosas más · ver todo» enseña el resto.
- **Lo hecho hoy** va al final, en verde, con una marca de visto y **sin botón**.
- **Al pie**: la sugerencia del día (o la idea que le pides) en un recuadro salvia, «Idea de Libo», con sus botones; con todo
  hecho y sin idea, «Mañana: vuelvo a asomarme. Si hay algo nuevo, te lo cuento.». Debajo, discretos, «Repasar la bienvenida» y
  «Ajustes de Libo» (y «¿Qué hago ahora?» si no hay nada pendiente).

Fuera de tu piso (el café, el hotel, el edificio…) el bocadillo de Libo no cambia.

## De dónde sale cada fila (todo de verdad)

| Fila                             | Icono      | Dato                                                       | Lleva a                                 |
| -------------------------------- | ---------- | ---------------------------------------------------------- | --------------------------------------- |
| Cartas sin leer                  | `buzon`    | `loadSocial` / `correoSinLeer` (como el portal)            | el portal del edificio                  |
| Lo que sigues, de oferta         | `rebaja`   | el almacén de hoy (como la «!» del monitor)                | el almacén del ordenador                |
| Muebles nuevos                   | `nuevo`    | ídem                                                       | ídem                                    |
| Clientes / propinas del café     | `cafe`     | lo que tu café apuntó en este aparato                      | tu café                                 |
| Mesas para dos que te esperan    | `casino`   | `loadCasino(dia).mesas` (`mesasQueEsperan`)                | el casino                               |
| Manos del casino que quedan      | `casino`   | `loadCasino(dia).quedan`                                   | el casino                               |
| Misiones del día                 | `misiones` | `loadArmario(dia).hechas` de las tres de `missionsOf(dia)` | tu piso del edificio («Hoy en tu piso») |
| La ruleta de la semana sin girar | `ruleta`   | `loadRuleta(dia).giro`                                     | el casino                               |

- Las tres preguntas al servidor (`cargarHoyLibo`, en `useAvisosLibo.js`) se hacen **al abrir la tarjeta**, no al llegar: el
  corazón de «tiene algo que contarte» y el asomo de una vez al día siguen dependiendo solo de los avisos de siempre y de la
  sugerencia (si no, con manos del casino cada día, Libo llamaría siempre). Caché de **un minuto** (abrir y cerrar no repite) y
  corta, para que al volver de jugar diga lo de verdad. Mientras llegan, una fila tenue «Miro el casino y tus misiones…» (solo
  si tarda más de 120 ms). Lo que falle (sin migración, sin red) llega como null y **Libo no habla de ello**.
- Sin rachas, cuentas atrás, prisas ni nada de pago (una prueba unitaria lo vigila).

## Los iconos

Propios, dibujados a mano en `src/features/libo/iconos.js`: rejillas de 11 × 11 (una cadena por fila, un carácter por píxel)
con la tinta de `pixelUi.js` (madera, papel, salvia, terracota y latón). Se pintan como SVG (`shape-rendering: crispEdges`, un
trazo por color) a 33 px dentro de una baldosa de 42. **Nunca de una librería.**

- `casino`: un naipe con la huella del mapache crupier, delante de otro boca abajo.
- `buzon`: el buzón verde del portal con una carta lacrada asomando.
- `rebaja`: el sillón con su etiqueta de precio colgando.
- `nuevo`: la caja de madera con un destello.
- `cafe`: la taza con su vapor.
- `misiones`: la libreta de pinza con una hecha en verde y dos por hacer.
- `ruleta`: la ruleta de la semana.
- `hecho`: la marca de visto.

## Navegación

- `casino`: `{ type: 'edificio', id: 'hotel', section: 'casino' }`; `EdificioPanel` abre el hotel directamente en el casino.
  Como el almacén desde el ordenador, **Atrás y la barra («A tu piso») vuelven a tu piso**, no a la fachada del hotel.
- `misiones`: `{ type: 'edificio', id: <tu uid> }`, tu piso del edificio, donde está el botón «Hoy» con las tres del día.

## Comprobación

- Unitarias: `src/features/libo/__tests__/loDeHoy.test.js` (lo que dice de cada cosa, el saludo, que nada meta prisa y que los
  iconos sean de 11 × 11 con la tinta del kit).
- e2e (Supabase simulado): `e2e-community/v1158-libo-lo-de-hoy.spec.js` (con cosas por hacer, «ver todo», el casino, las
  misiones; con todo hecho, Libo dormido) y `libo-avisos.spec.js` adaptada. Capturas en `qa-report/v1158-lo-de-hoy/`.
  Emulación en Chromium y WebKit: no equivale a un iPhone real.
