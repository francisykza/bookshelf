# Economía de muebles de «El edificio del puerto» · propuesta (sin decidir)

Estado: **aprobado por Francisco el 1-11-2026 («Sí a todo»), nada implementado todavía.** Sustituye a «catálogo gratis»
cuando cada fase esté hecha; las reglas de figuras (sellos, Cajas Sorpresa, pity) no se tocan. Cada fase se enseña con
capturas y necesita su «sí» antes de la siguiente.

## 1. La idea de Francisco (1-11-2026)

- Empiezas con unos cuantos muebles; si quieres un sofá, tienes uno, o las copias que hayas conseguido.
- Misiones que dan **tickets**, para comprar en una **tienda** pixel art del propio edificio o gastarlos en un
  **mueble al azar**.
- **Rarezas**: los más raros, con una pequeña animación al tocarlos (chimenea que se enciende, tele que se enciende).
- Más adelante, un **mercado** para intercambiar muebles por tickets o por otros muebles.

## 2. Qué me parece y qué cambiaría

Me parece muy buena base: da motivo para volver, hace que tu piso diga algo de ti y engancha con la lectura. Cambiaría
o concretaría esto:

1. **Los tickets solo se ganan leyendo, nunca con dinero.** Ni compra de tickets ni de muebles. Así el «mueble al azar»
   es una sorpresa y no una caja de pago (en España y la UE las cajas de botín de pago están en el punto de mira).
2. **Separado de las figuras.** Las figuras ya tienen sus sellos, Cajas Sorpresa y pity (`src/domain/figures.js`), y
   las misiones semanales ya dan Cajas (`src/domain/missions.js`). Los tickets serían una moneda **aparte**, con sus
   propias misiones de edificio, para no tocar esas reglas (regla de CLAUDE.md).
3. **Ver las probabilidades y tener pity.** En el sorteo, las probabilidades visibles y un mínimo garantizado (por
   ejemplo, un raro como mucho cada 8 sorteos), igual de honesto que las cajas de figuras.
4. **Copias repetidas que sirvan.** Una copia que no quieres se puede **reciclar** por unos pocos tickets (menos de lo
   que costó), para que el azar nunca deje cosas inútiles.
5. **Nadie pierde lo que ya tiene.** Lo que hay hoy colocado en cada piso pasa a ser tuyo (una copia por mueble
   colocado). Y el set inicial debe dar para un piso bonito sin jugar: el mismo `starterRoom` más algún extra.
6. **Sagas ligadas a leer el libro.** Un set de saga se desbloquea al terminar el libro que evoca («Para quien leyó…»
   pasa a ser literal). Es la recompensa con más sentido de toda la app.
7. **Rarezas con interacción, no con brillo.** Común, poco común, raro y especial. Lo raro se nota en que hace algo
   (encender, abrir, sonar un instante, respetando silencio y movimiento reducido), no en marcos dorados ni destellos.
8. **El mercado, al final y con cuidado.** Es lo más caro y lo más arriesgado: hace falta que los tickets y el
   inventario vivan en el servidor (si no, se pueden inventar), intercambios atómicos, límites y nada de texto libre
   (regla del edificio: solo sellos de frase cerrada). Antes del mercado abierto, propondría **regalar y cambiar entre
   vecinos de tu edificio** (6 personas), que es más cozy, tiene menos especulación y cuesta mucho menos.

## 3. Dónde guardar las cosas

- **Inventario y tickets en el servidor** desde la fase 1 (tablas nuevas con RLS; nunca editables directamente por el
  cliente; solo por funciones `security definer` que comprueban). Validar el piso contra el inventario en
  `piso_valido` (hoy solo comprueba el catálogo): no puedes colocar 3 sofás si tienes 2.
- **Tickets que ganas leyendo**: las misiones de hoy se calculan en el dispositivo con lo que registras. Para tu propio
  piso es aceptable (como las figuras). Para el mercado no: ahí harían falta topes en el servidor (tickets por semana,
  como mucho N) para que inflar registros no rompa nada.

## 4. Fases (cada una con capturas y su «sí» antes de la siguiente)

| Fase | Qué | Necesita |
| --- | --- | --- |
| 1 | **Inventario.** Copias por mueble; set inicial; lo colocado hoy pasa a ser tuyo; la balda enseña «×2» y deja de ofrecer lo que no tienes libre (sale atenuado, «0 libres»). | Migración (inventario + `piso_valido` con copias) |
| 2 | **Tickets y tienda.** Misiones del edificio (3 a la semana, ligadas a leer) que dan tickets; tienda pixel art en el bajo del edificio (el local del toldo) con precios fijos por rareza; saldo visible. | Migración (saldo, compras por función) |
| 3 | **Rarezas animadas.** Primeros muebles especiales: chimenea, tele antigua, tocadiscos, lámpara de lava… al tocarlos fuera de «Decorar» se encienden. | Arte nuevo en `furniture.js`; filas en `piso_catalogo` |
| 4 | **Sorteo.** «Un mueble al azar» por tickets, probabilidades visibles, pity, reciclar copias. | Migración (sorteo en el servidor, nunca en el cliente) |
| 5 | **Sagas por lectura.** Cada set se desbloquea al terminar su libro. | Decidir si los ya colocados se conservan |
| 6 | **Regalar y cambiar entre vecinos.** Ofrecer un mueble a un vecino; él acepta o no; solo sellos de frase cerrada. | Migración (ofertas atómicas) |
| 7 | **Mercado abierto** (si la 6 funciona). Ofertas por tickets o por otro mueble, con límites. | Topes de tickets en el servidor, moderación |

## 5. Decisiones de Francisco (1-11-2026: «Sí a todo»)

1. Los tickets son una moneda nueva, separada de las Cajas de figuras.
2. Lo que cada uno tiene colocado hoy pasa a ser suyo (una copia por mueble colocado).
3. Muebles de inicio: los 10 del piso inicial más 6 comunes a elegir.
4. Los sets de sagas se desbloquean al terminar el libro que evocan; lo ya colocado se conserva.
5. Primero regalar y cambiar entre vecinos (fase 6); el mercado abierto (fase 7), solo si eso funciona.
6. Los tickets solo se ganan leyendo; nunca se venden ni se compran con dinero.

## 6. Sonido del edificio (encargo de Francisco, 1-11-2026)

Francisco quiere que esta sección tenga **sonidos cozy propios**. Hoy el piso usa cinco sonidos genéricos sintetizados
del minijuego (`createSfx` de `minigames/libreria-puerto/audio.js`: levantar, colocar, no cabe, volver, girar) y el
portal ninguno. Propuesta, con las reglas de la app (CLAUDE.md, «Efectos»): una respuesta breve por acción, nada antes
de la primera interacción, respetando silencio, volumen y movimiento reducido; todo sintetizado con Web Audio (grabar o
descargar sonidos necesita su permiso):

- **Muebles según su material**: madera que asienta con un golpe sordo, tela de un sillón que se hunde, alfombra que
  apenas roza, maceta de barro, metal de una lámpara, cristal y porcelana de lo pequeño que va «encima».
- **Portal**: una ventana que se abre al asomarte; el timbre o los nudillos en la puerta de un vecino; el buzón al
  abrirse; el sello al estamparse.
- **Ambiente del portal** (bajo, opcional, en bucle suave y solo tras tocar algo): olas contra el muelle y, de vez en
  cuando, la gaviota cuando cruza el cielo (la de la 1.65).
- **Tienda y sorteo** (fases 2 y 4): campanilla de la puerta de la tienda, tickets de papel al pagar y un pequeño
  arpegio al abrir un mueble raro, nunca de tragaperras.
- **Rarezas** (fase 3): cada mueble especial con su sonido al encenderse (chisporroteo de la chimenea, zumbido de la
  tele, aguja del tocadiscos).

Se haría en paralelo a las fases: el sonido de cada cosa nueva va con su fase, y lo del portal y los materiales puede
ir ya en la fase 1.

### Banda sonora: «Aquí no hay quien viva» en pixel art (futuro)

A Francisco le encantaría la sintonía de la serie reinterpretada en chiptune cozy. **Ojo:** una versión o arreglo de
esa melodía, aunque sea en 8 bits, sigue siendo la obra protegida, y meterla en una app publicada necesita licencia de
quien tenga los derechos (en España, normalmente a través de la editora musical o de la SGAE). Sin esa licencia, no se
puede usar ni recrear de oído. Opciones:

1. **Pedir la licencia** (lo correcto si se quiere esa melodía exacta). Lo tendría que gestionar Francisco.
2. **Tema original con guiño**: una pieza chiptune cozy propia, con el espíritu de comedia de vecinos, pero sin copiar
   melodía, ritmo reconocible ni letra (igual que el cartel: «AQUÍ NO HAY QUIEN LEA», con letra propia y no el logo).
   Se puede sintetizar en la app o encargar.
3. **Solo en privado**: una versión que no se publique nunca (en un ordenador, para escucharla él) no tiene ese
   problema, pero no puede ir en la app.

Mientras no haya licencia, la opción para la app es la 2.
