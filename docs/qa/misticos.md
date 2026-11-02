# Los «místicos» de «El edificio del puerto» · plan

Estado: **decisiones de Francisco del 2-11-2026; bloque 1 hecho (diseños y seguir en `dev/misticos.html`), a falta de su visto bueno; nada en la app.** Cada bloque se enseña
con capturas y necesita su «sí» antes del siguiente.

## 1. Lo que decidió Francisco

- Una rareza nueva, por encima de «raro»: **místicos**. Dragones y otros seres con movimiento.
- **Diseño espectacular** y, si se puede, **guiños a sagas**: seres originales que evocan un libro («Para quien leyó…»),
  nunca personajes, nombres propios, logos ni diseños oficiales (la misma regla que los sets de sagas).
- Salen con **una probabilidad muy baja** en los sobres (eligió esto frente a un sobre propio o a premios por leer).
- Dentro de los místicos, **los más raros te siguen a todas partes**: tu piso, las visitas a otros pisos y el hotel.

## 2. Propuesta (cifras aprobadas: «Sí, esas cifras», 2-11-2026)

- Dos escalones: **místico** (un objeto vivo que se coloca en el piso, como un mueble que se mueve solo) y **místico
  legendario** (un ser que te acompaña: va detrás de tu personaje, flota, reacciona al sentarte o al pasear).
- **Dónde salen**: en el sobre «Edición coleccionista», con una probabilidad muy baja y visible en la tienda, por
  ejemplo **1 %** un místico y, dentro de eso, **1 de cada 4** legendario (0,25 % en total). Se resta de lo «raro»,
  así que las demás probabilidades y el pity actual (raro seguro cada N) **no cambian**. Sin pity propio, para que
  sigan siendo un acontecimiento (aprobado).
- **Al salir**: una animación propia en el sobre, honesta como las demás (sin falsos «casi», con movimiento reducido,
  directo al resultado), con pixelfx.
- **Uno a la vez**: solo te acompaña un legendario; se elige en el armario de tu personaje. Los vecinos lo ven al
  visitarte y te sigue en el hotel.
- **No se reciclan por tickets** ni se regalan (al menos al principio), para que no sean moneda.

## 3. Primera tanda de diseños (`src/features/edificio/misticos.js`, página `dev/misticos.html`)

| Ser | Escalón | Guiño |
| --- | --- | --- |
| Dragoncillo de escamas rojas | Legendario (te sigue) | Para quien leyó *Alas de sangre* |
| Zorro de bruma y ceniza | Legendario (te sigue) | Para quien leyó *Mistborn* |
| Cinta de luz de tormenta | Legendario (te sigue) | Para quien leyó *El archivo de las tormentas* |
| Farol de llama azul | Místico (se coloca) | Para quien leyó *El nombre del viento* |
| Rosa bajo la lluvia de estrellas | Místico (se coloca) | Para quien leyó *Una corte de rosas y espinas* |

## 4. Bloques

| Bloque | Qué | Necesita |
| --- | --- | --- |
| 1 | Diseños animados y el seguir (página de desarrollo, capturas) | Nada |
| 2 | En tu piso: colocar los místicos y llevar un legendario (armario), visto por los vecinos | Migración (rareza nueva en el catálogo, compañero en `pisos`) |
| 3 | En los sobres: la probabilidad muy baja y su animación al salir (**hecho, 1.73**, SPEC §73.1) | Migración `20261107120000_edificio_misticos_sobres.sql` (la aplica Francisco) |
| 4 | En el hotel, cuando exista | El hotel en la app |
