# El almacén en el ordenador del piso (plan; hecho en la 1.134 y la 1.135)

Encargo de Francisco del 15-11-2026, literal: «querría añadir al ordenador un apartado del almacen de muebles que avise si hay
descuentos, los muebles nuevos, y que permita seguir descuentos en muebles deseados y que de darle te lleve directamente al
almacen y al mueble en cuestión».

**Estado**: plan propuesto el 15-11-2026 y **aprobado por Francisco el mismo día con las cuatro opciones recomendadas** («Sí,
las recomendadas»). Bloque 1 hecho como 1.134.0 (SPEC §134), aprobado («Sí, sigue al bloque 2»). Bloque 2 hecho como
1.135.0 (SPEC §135), aprobado («vale»); los dos salen juntos como 1.137.0 (§137), con Libotown. La migración
`20261221120000_almacen_deseados.sql`, aplicada en producción el 15-11-2026 («Hazlo tú»). **Publicado** el 15-11-2026, junto
con la 1.138.0.

## 1. Lo que ya hay y se reutiliza

- **El ordenador del piso**: `PisoDesktop.jsx` (seis objetos ilustrados del atlas, «Leyendo ahora» y el cajón «Aplicaciones»
  por grupos) dentro de `LaptopPanel` con `ComputerShell` (barra de título, volver y cerrar). Las pantallas se abren con
  `open(id)` o, fuera del ordenador, con `tool(nombre)` (`App.jsx`, `select: 'ordenador…'` y `'abrir:…'`).
- **Las ofertas**: las decide el servidor (`piso_almacen_ofertas_de`, migración `20261125120000_almacen_ofertas.sql`): cada día
  4 muebles con −20 % y cada semana 1 con −50 %, por un hash del día, iguales para todos. Se leen con `loadAlmacen()`
  (`piso_almacen_estado`: `ofertas`, `vuelve`, `semana_hasta` y `tickets`). El precio, con `precioOferta` y `mapaOfertas`
  (`hotel/ofertas.js`), que ya ignora los muebles de las habitaciones especiales (nunca se rebajan).
- **El catálogo del almacén**: `ARTICULOS`, `EXPOSITORES` y `SECCIONES` (`hotel/almacenLayout.js`): unos 20 muebles (los 14
  de la casa y los 6 de «Capa y Antifaz»). Las miniaturas, con `renderThumb`, como en el directorio del almacén.
- **Llegar a un mueble**: el directorio del almacén ya lo hace (`api.go(expositor)` y luego `abrirFicha`). `puntoDeMirar(e)` da
  el sitio desde el que se mira cada expositor.
- **Entrar en el almacén desde otro sitio**: el aviso de invitación ya lo hace (`irAlAlmacen` en `EdificioPanel.jsx`: guarda
  la sala en `sessionStorage`, pone `hotelRoom = 'lonja'` y abre el hotel).
- **La «!» roja de lo nuevo** (1.128, pedida por Francisco: «que desaparezca cuando las pulses o veas»): `cafeNuevo.js` y
  `.cf3-nuevo`. Lo visto se recuerda en el dispositivo y la primera vez se da por visto lo que ya había.
- **«Se busca»** (`piso_lonja_buscados`, 1.86): **no sirve** para los deseados. Es pública (los vecinos ven qué buscas y quién),
  como mucho tres, caduca a los 30 días y su fin es cambiar muebles entre vecinos en el mercadillo.

## 2. Propuesta

### 2.1 Dónde va y cómo se ve

- **En el escritorio**, debajo de «Leyendo ahora», una tarjeta **«En el almacén»** con el mismo marco y la misma letra de
  píxel. Enseña hasta tres muebles, cada uno con su miniatura de píxel en una etiqueta de precio como las del directorio del
  almacén (precio tachado y el de hoy en rojo) y «Ver el almacén ›». El orden: lo que sigues y está rebajado, lo nuevo, la
  oferta de la semana y las del día. Sin conexión, sin cuenta o sin nada que enseñar, la tarjeta no sale.
- **En «Aplicaciones»**, un grupo nuevo «El edificio» con «Almacén» (y, como «Sobre por abrir» en Citas, una nota corta:
  «2 que sigues, rebajados»).
- **La pantalla «Almacén»** (dentro del marco del ordenador, una sola columna que se desplaza):
  1. **Lo que sigues**: cada mueble con su precio de hoy («Hoy −20 %: 16 tickets» o «Sin oferta hoy · 20 tickets»).
  2. **Ofertas de hoy**: la de la semana primero y las cuatro del día, con «hasta medianoche» o «hasta el domingo» (las
     mismas palabras que ya usa el almacén).
  3. **Nuevo en el almacén**: lo llegado en el último mes; si no hay nada, «Nada nuevo por ahora».
  4. **Todo el almacén**: por pasillos, como el directorio, para elegir qué seguir.

  Cada fila: miniatura, nombre, precio y, a la derecha, «Seguir» como una marca de píxel (iconos de `PortIcon`, nada de
  píldoras HTML). Tocar la fila lleva al almacén. Los de «Capa y Antifaz» dicen «No se rebaja nunca» y no se siguen.
  Arriba, en pequeño, los tickets que tienes.
- Solo en el ordenador del piso en primera persona; la experiencia anterior (`LaptopPanel` con el dock) no cambia.

### 2.2 Qué es un «mueble nuevo»

Un mueble que **entra a la venta en el almacén**: uno nuevo o uno retirado que vuelve rehecho. Cada uno lleva en el código la
fecha en que llega (lista `LLEGADAS`, con una prueba que exija fecha a todo lo que se añada al almacén). Sale en «Nuevo» durante
**30 días**, y con la «!» roja hasta que lo ves. Como en el café, la primera vez se da por visto lo que ya había: «Capa y
Antifaz» (llegó el 10-11-2026) saldría en «Nuevo» hasta el 10-12, pero sin «!». Ni la ropa de la planta de abajo ni los
muebles del café cuentan.

### 2.3 Los deseados

- **Lista propia y privada**, aparte de «Se busca»: nadie más la ve. Sin tope práctico (cabe todo el almacén; el servidor
  pone un tope de 40 para que no se abuse).
- **En el servidor**, con una migración nueva que aplica Francisco: tabla `piso_almacen_deseados (user_id, mueble, creado)`,
  con RLS y sin permisos directos; `piso_almacen_desear(mueble, quiere)` solo admite lo que vende el almacén (no retirado, no
  de saga, con precio, no de habitación especial); y `piso_almacen_estado` añade `deseados`. Así es la misma lista en el
  móvil y en cualquier otro dispositivo. Pruebas de RLS con PGlite y la simulación de `e2e-community`.
- Se marcan **desde la pantalla «Almacén»** y **desde la ficha del mueble en el almacén** («Seguir su precio», junto a
  «Añadir al carrito»). En el directorio del almacén, los que sigues llevan una marca pequeña.

### 2.4 Cómo y cuándo avisa (sin presión)

- La «!» roja solo para **lo tuyo**: un mueble que sigues y hoy está rebajado (una vez por oferta) y un mueble nuevo que no has
  visto. Las ofertas de cada día no la encienden: cambian a diario y sería ruido. Se va al verlo.
- Dónde: en la tarjeta «En el almacén», en «Almacén» de Aplicaciones y en la fila del mueble. **Además, en el piso**: una «!»
  roja pequeña sobre el monitor del ordenador, solo en esos casos, que se va al abrir el ordenador.
- **Nunca**: sonidos de aviso, notificaciones del sistema, cuentas atrás con números, «¡corre!» ni las ofertas de mañana (las
  decide el servidor el mismo día). El estado se pide una vez al entrar en el piso o abrir el ordenador, sin preguntar cada
  pocos segundos.

### 2.5 Tocar un mueble: al almacén, delante de él

- Se cierra el ordenador y se abre el almacén **directamente**: sin limusina, sin recepción y sin paseo. Apareces en el
  pasillo, mirando el mueble desde `puntoDeMirar`, con su ficha abierta (y, si está rebajado, su etiqueta de oferta).
- Arriba, en vez de «A la calle», **«Al ordenador»**, que vuelve a la pantalla «Almacén» (Atrás, lo mismo). Dentro, el almacén
  funciona como siempre (carrito, caja, albarán, planta de ropa).
- Con movimiento reducido es igual (no hay viaje). Sin WebGL, el almacén de siempre con la ficha abierta.

## 3. Decisiones de Francisco

1. **Dónde avisa**: recomendado, la tarjeta del escritorio y la «!» sobre el monitor del piso. Alternativa: solo dentro del
   ordenador.
2. **Qué es nuevo**: recomendado, lo que entra a la venta en el almacén, 30 días, «!» hasta verlo. Alternativa: solo lo que
   llegue a partir de ahora (sin la sección los primeros días).
3. **Deseados**: recomendado, lista propia, privada y en el servidor (migración nueva). Alternativa: solo en el dispositivo, sin
   migración (no pasa de un móvil a otro).
4. **Ir al mueble**: recomendado, directo y delante del mueble con su ficha. Alternativa: con el viaje en limusina y andando
   hasta él.

## 4. Bloques (con capturas a 390 y 360 y vídeo entre uno y otro)

1. **1.134.0, sin migración**: la tarjeta «En el almacén», la pantalla «Almacén» (ofertas de hoy, nuevo, todo el almacén), la
   «!» de lo nuevo y el salto al almacén delante del mueble con «Al ordenador».
2. **1.135.0, migración nueva** (la aplica Francisco): seguir muebles (pantalla y ficha del almacén), «Lo que sigues», la «!»
   de un deseado rebajado y la del monitor del piso. Sin la migración, la app va como en el bloque 1 y no deja seguir.
