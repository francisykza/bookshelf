# Comunidad al día, la visita a un vecino y el telefonillo (plan)

Encargo de Francisco del 28-11-2026, con dos capturas del iPhone de su compañera:

> «A mi compañera se le ve la cafeteria asi a veces, cuando presiona el apartado comunidad del ordenador se le queda así en
> marron y ademas el apartado de comunidad está desfasado necesita que lo adaptemos a como está la app ahora mismo, incluido
> avatares. Tambien tocaría como se ven los pisos de los vecinos hay demasiados menús que afean la experiencia. Querría que se
> viese su piso y que estuviesen las opciones bien integradas y organicas de dejar un regalo y un post it.
> Además el telefonillo debería tener un indicador visual de que es clicable»

## 0. Lo primero: los dos fallos (hecho en la 1.162.2, SPEC §162.6)

- **El café «a veces» sin 3D**: su captura es el café isométrico que se quitó en la 1.155, con el cuaderno de Pilar (1.142):
  su iPhone seguía con una versión de hace dos semanas en memoria. La app ponía la versión nueva al pasar a segundo plano,
  pero sin recargar (SPEC §11.6), y Safari mantiene la pestaña viva días. Ahora, al volver a la app con una versión nueva ya
  puesta, se recarga (nunca escribiendo) y cada vuelta pregunta si hay otra (`src/ui/versionNueva.js`).
- **La pantalla marrón en Comunidad**: lo más probable, esa misma versión vieja pidiendo un trozo de código que ya no existe
  (sin la red de seguridad de la 1.159, no llega nada). Además, mientras se descargaba la comunidad no se enseñaba nada (fondo
  marrón) y, debajo, decía «Abriendo tu piso…». Ahora, la pantalla de carga con «Abriendo la comunidad…».
- **De paso**: las seis escenas 3D del edificio y el hotel se rendían en cuanto el móvil les quitaba el 3D (al ir a otra app);
  ahora esperan a que vuelva, como tu piso, y sueltan su contexto al salir (`src/features/edificio/contexto3d.js`).
- **Para su compañera, una vez**: cerrar la pestaña de Libotown (o la app) del todo y volver a abrirla, para que cargue la
  versión de hoy. Desde ahí ya se actualiza sola.

## 1. Cómo está hoy

- **Comunidad** (`src/features/social/`): el cuaderno de cuero con anillas de la 1.60 y tres pestañas (Lectores, Salón,
  Clubes), letra serif fina, avatares de retrato ilustrado (el gato pintado, el chico del jersey…) de antes del pixel art.
  No tiene nada del lenguaje de ahora (marcos de píxel, letra del puerto, Libo, los personajes).
- **El piso de un vecino** (`pisoLab/VisitaPiso.jsx`): encima de la habitación, una cabecera con su retrato y «Puedes mirar,
  pero no tocar nada», una tarjeta con «Está leyendo», «Biblioteca de…», «Grupo 1 de 3» y «Ver toda la biblioteca», el botón
  «Ver de noche» y un menú arriba a la derecha. La habitación queda en medio, recortada. El regalo y el post-it van en hojas
  aparte (`edificio/VecinoMesa.jsx`, `tablon/TablonVisita.jsx`).
- **El telefonillo** (`edificio/Telefonillo.jsx`): una plaquita gris junto a la puerta del portal, sin nada que diga que se toca.

## 2. Propuesta (por bloques, con capturas a 360 y 390 y vídeo entre uno y otro)

1. **El telefonillo, que se vea que se toca** (pequeño): su lucecita ámbar encendida que respira despacio y, al lado, una
   placa de latón «Telefonillo» con el mismo estilo de las placas de la fachada (1.124). Con movimiento reducido, la luz quieta.
   Sin «!» (esas son para avisos de verdad). **Hecho en la 1.163.0** (SPEC §163): una plaquita de latón con solo el auricular, al pie
   del telefonillo (con «Telefonillo» escrito «ocupa demasiado») y la luz parpadea mientras no lo has abierto nunca; después, respira.
2. **La visita, la habitación protagonista**: fuera la tarjeta, «Grupo 1 de 3», «Ver de noche» (la hora la pone el reloj, como
   en tu piso) y el menú. Arriba, solo una franja fina: volver y el nombre con su avatar. Todo lo demás se toca en la escena:
   - **su estantería** → su biblioteca (lo que comparte);
   - **el libro de la mesa** → lo que está leyendo;
   - **el tablón** → sus notas y dibujos clavados;
   - **una caja de regalo con lazo** junto a la puerta → «Dejar un regalo» (una hoja de papel pequeña con tus copias de sobra,
     las mismas reglas: uno al día, hasta «raro»);
   - **un post-it en blanco pegado en el marco de la puerta** → «Dejar un post-it» (o un dibujo; mismo cupo diario).
   Al tocarlos, una nota de papel pequeña, nunca una hoja que tape la habitación entera. Si ya regalaste hoy, la caja se ve
   cerrada con su etiqueta «mañana, otro». **Hecho en la 1.164.0** (SPEC §164). La hora no la pone el reloj: es la de tu piso al
   entrar (la tarde). Si su piso no tiene mesa, el libro que lee queda en el sillón, fuera de la vista; desde Comunidad sigue la
   cabecera de antes hasta el bloque 3.
3. **La Comunidad al día**: el mismo lenguaje que el resto de la app (papel y marcos de píxel como «Lo de hoy», la letra del
   puerto en los títulos, Libo de guía), las tres pestañas de siempre y sin perder ninguna función. **Avatares**: el retrato de
   píxel de su personaje (la cabeza del personaje que cada uno viste en su piso, con su ropa y colores), igual en Comunidad, en
   Amigos, en la visita y en el telefonillo. Quien no tenga personaje, un retrato de Libo neutro. Los retratos ilustrados
   antiguos se retiran sin borrar nada (el `avatar_id` se queda en el servidor). **Hecho en la 1.165.0** (SPEC §165; Francisco,
   «Sí, así»): sin el cuaderno de cuero; el busto del personaje necesita la migración `20270102120000_comunidad_personajes.sql`
   (sin ella, los retratos de antes). La lista de bloqueados sigue con los de antes.

## 3. Lo que decide Francisco

- El orden (propuesto: 1, 2, 3; el 1 es corto).
- Los avatares: el retrato de su personaje (recomendado) o un juego nuevo de avatares de píxel que dibuje él.
- En la visita, dónde van el regalo y el post-it (propuesto: la caja junto a la puerta y el post-it en el marco).
