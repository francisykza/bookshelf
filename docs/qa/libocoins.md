# Los libocoins: los tickets con identidad

Encargo de Francisco (27-11-2026, en «Pendiente» de `docs/ESTADO.md`): «que los tickets se llamen libocoins o algo por el
estilo…, y que sea como una moneda con la cara de libo», y «que aparezcan en todo momento de manera orgánica e intuitiva con
una animación divertida, brindado por Libo». La moneda la dibujó él (moneda dorada de píxel con Libo leyendo un libro verde,
bufanda a rayas, estrellas y libritos alrededor). Propuesta del 27-11-2026, **aprobada** el mismo día («Sí, así»): nombre «Libocoins», el saldo junto a Libo y también en la web.

## 1. Lo que hay hoy

- Los tickets salen en unos 34 archivos (unas 430 menciones): el almacén y su caja, la planta de ropa, la Lonja, la lata de
  garbanzos, las misiones del ordenador y del vestíbulo, las diarias del piso, los logros del café y la web (`public/web/`).
  El texto casi siempre pasa por `ticketsText` (`src/features/edificio/economy.js`) o un parecido (`ticketsDe` en la lata).
- **El saldo no está siempre a la vista**: solo se ve al ir a gastar (almacén, ropa, Lonja) o en el ordenador.
- Se ganan con: misiones semanales, las tres diarias del piso (con todo el armario), subir de nivel el café y su extra diario,
  la lata del casino y vender en la Lonja (y las excepciones de las cuentas de prueba). Las reglas no cambian.
- Sin icono propio: el café usa una tira de ticket dibujada (`cf3-logro__ticket`).

## 2. Lo que se propone (tres bloques, con evidencias entre uno y otro)

1. **Nombre y moneda.** *Hecho en la 1.160.0 (SPEC §160).* Todo texto visible dice el nombre nuevo (singular y plural), también en la web. La moneda se recorta
   de su dibujo (`../libotown-marca/`, nunca redibujada) en los tamaños de la app, nítida en píxel; sustituye a la tira de
   ticket del café. **Lo interno no cambia** (`tickets` en el servidor, en el código y en Supabase): sin migración.
2. **El saldo, siempre a mano, junto a Libo.** Libo vive en una esquina en todas partes: a su lado, una moneda pequeña con
   tu saldo. Tocarla abre una nota de papel con el saldo, cómo se ganan y dónde se gastan (sin botones de compra ni
   presión). No sale donde Libo se aparta (la barra del café, el obrador, el taller, las salas del hotel, el armario).
   Saldo del servidor, con caché; sin sesión o sin comunidad, no sale.
3. **Al ganarlas, Libo lo celebra.** Las monedas saltan hacia su contador, Libo pone la pose «celebra» de su hoja y la cifra
   sube; con movimiento reducido, solo la cifra. Un sonido breve de moneda con las reglas de efectos de siempre (el de
   Lumina, `coin-pickup-chime`, cuando se haga lo de los sonidos). En todos los sitios donde hoy se ganan.

## 3. Lo que decide Francisco

- El nombre: «Libocoins» (su palabra) u otro.
- Si el saldo va junto a Libo (lo propuesto) o en otro sitio.
- Si el nombre nuevo llega también a la web.
- **La imagen**: guardarla en `../libotown-marca/` (por ejemplo, `libocoin.png`). Sin ella no se puede hacer el bloque 1.
