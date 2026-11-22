# Libotown en la Play Store · plan

Encargo de Francisco (20-11-2026): «me gustaría ir preparando la app para puesta en producción, para la play store, que cosas
necesitarian cambios o revisar, para asegurar la estabilidad y exito de la app». Aprobó escribir este plan («Sí, el plan»).
Nada de lo que aquí se propone está hecho todavía. Las reglas de Google están escritas según lo que sabemos a esta fecha:
**confirmarlas en la Play Console antes de enviar**, porque cambian.

## 0. Punto de partida (revisado el 20-11-2026)

- Libotown es una web instalable (PWA) en Vercel (`libotown.es`): manifiesto con iconos normales y adaptables, pantalla
  completa en vertical, service worker con caché propia. Sin nada de Android todavía.
- Cuentas de Supabase con correo y contraseña (`src/services/cloud.js`). 66 migraciones; 86 claves ajenas a `auth.users`
  con `on delete cascade` y 2 con `on delete set null`.
- Hay denuncias (`reports`: reseñas, mensajes de club y notas del tablón) y una tabla `moderators`, pero **ninguna pantalla
  para revisar denuncias**: se guardan y nadie las ve.
- No hay política de privacidad, aviso legal ni normas de la comunidad, ni se puede borrar la cuenta.
- No hay seguimiento de errores: si la app se cae en el móvil de alguien, no llega nada.
- Build actual: unos 740 KB de JS y 690 KB de CSS al arrancar; el edificio y el café (three.js) suman unos 1,4 MB más.

## 1. Cómo se empaqueta: TWA

Recomendación: **Trusted Web Activity** (Bubblewrap o PWABuilder). La app de Android abre `libotown.es` en Chrome a
pantalla completa:
- **una sola app**: cada subida a `main` actualiza también la de Android, sin pasar por revisión salvo cambios del envoltorio;
- los datos son los del origen `libotown.es` en Chrome;
- no se reescribe nada en nativo.

Hace falta:
- un **paquete** (p. ej. `es.libotown.app`; no se puede cambiar después), firma con Play App Signing y la clave de subida
  guardada fuera del repositorio;
- **`/.well-known/assetlinks.json`** en Vercel con la huella SHA-256 de la firma de Google Play (si no, sale la barra de
  direcciones);
- revisar la regla de redirección de `vercel.json` para que no toque `/.well-known/`;
- revisar el nivel de API que pide Google cada año (Bubblewrap lo pone; hay que regenerar y volver a subir cuando suba).

Alternativa descartada por ahora: Capacitor (permite cosas nativas, pero duplica el mantenimiento y obliga a pasar cada
versión por revisión).

## 2. Bloqueantes (sin esto, Google rechaza o retira la app)

### 2.1 Borrar la cuenta
Google exige poder borrar la cuenta **desde la app** y **desde un enlace web** (para quien ya la desinstaló).
- Función de servidor `cuenta_borrar()` (security definer, solo la propia cuenta) que borre `auth.users` de quien llama; las
  cascadas se llevan casi todo. Auditar las 2 claves `set null` y cualquier tabla con identificadores de usuario **sin**
  clave ajena (p. ej. listas en `jsonb`, `piso_visitas`, rankings).
- En la app: Cuenta → «Borrar mi cuenta», escribiendo una palabra para confirmar; explica qué se borra y qué no (lo que solo
  está en el dispositivo se queda allí hasta desinstalar).
- Página web `libotown.es/borrar-cuenta` con los pasos (iniciar sesión y borrar), para la ficha de la tienda.
- Prueba PGlite: tras borrar, ninguna tabla conserva el `user_id`.
- **Decisión de Francisco**: lo que la cuenta dejó a otros (post-its y dibujos clavados en tableros ajenos, mensajes de
  club, lomos en la librería común del hotel, reseñas públicas): ¿se borra o queda como «lector anónimo»?

### 2.2 Privacidad, aviso legal y seguridad de datos
- Páginas públicas en `libotown.es`: **política de privacidad**, **aviso legal** (LSSI) y **normas de la comunidad**, enlazadas
  desde Cuenta y desde el alta. **No se redactan inventando datos**: hacen falta el responsable, el contacto y la edad mínima
  (decisiones de Francisco). Recomendación: que las revise alguien con conocimiento legal antes de publicar.
- Inventario de datos para el formulario «Seguridad de los datos» de la Play Console: correo, alias y perfil público,
  lecturas y reseñas, notas, post-its y dibujos, aspecto del personaje, progreso de los juegos, presencia en la sala de lectura;
  terceros: Supabase (base de datos), Vercel (alojamiento y la función de portadas), Google Books y Open Library (búsquedas).
  Sin publicidad ni analítica de terceros: decirlo.
- Aceptar las normas al crear la cuenta (casilla o texto claro).

### 2.3 Contenido de los usuarios
Google pide denunciar (hay), bloquear (hay), normas aceptadas y **que alguien actúe sobre las denuncias**.
- Pantalla de moderación solo para `moderators`: lista de denuncias, ver el contenido, retirarlo, avisar o suspender la cuenta.
- Lo que tiene texto libre o dibujo y aún no se puede denunciar: revisarlo todo (perfil público, nombres de club…).
- **Decisión de Francisco**: quién modera y en cuánto tiempo se responde.

### 2.4 Clasificación por edades
El cuestionario (IARC) obliga a declarar el **juego simulado**: casino «Las 21 páginas», apuestas de fichas y garbanzos entre
amigos, ruleta semanal y sobres con sorteo (cerrados ahora). Eso sube la clasificación. Con funciones sociales y apuestas
simuladas, **recomendación: público objetivo de 16 años en adelante** (en España, por debajo de 14 hace falta permiso de los
padres para tratar datos) y no inscribirla en el programa de familias.
- **Decisión de Francisco**: edad mínima, y si se pide la fecha de nacimiento o basta con declararla.

### 2.5 Cuenta de desarrollador
- Pago único de la cuenta y verificación de identidad.
- Si es **personal y nueva**: prueba cerrada con **al menos 12 personas durante 14 días seguidos** antes de poder pasar a
  producción. Empezar a reunir testers cuanto antes (con Android y cuenta de Google).

## 3. Estabilidad

### 3.1 Errores
- Capturar errores de pantalla (un límite de error general además de `DecorBoundary`), `error` y `unhandledrejection`.
- Mandarlos a una tabla `app_errores` de Supabase (solo insertar, con límite por cuenta, **sin datos personales**: versión,
  pantalla, mensaje y pila) o a un servicio (Sentry). Una consulta para revisarlos tras cada versión.
- Panel de Play Console: «Android vitals» solo ve el envoltorio, no los errores de la web; por eso hace falta lo anterior.

### 3.2 Que no se pierdan datos
- Pedir `navigator.storage.persist()` al crear la biblioteca o al vincular un EPUB (Android puede vaciar el almacenamiento
  con poco espacio).
- Avisar, sin cuenta, de que desinstalar borra la biblioteca, y ofrecer copia (exportar) o crear cuenta.
- Comprobar las migraciones de `bookshelf:v1` con datos de versiones antiguas.

### 3.3 Rendimiento y móviles modestos
- Reducir lo que carga al arrancar: dividir CSS por zonas (hoy se acumulan las hojas de cada versión) y comprobar que
  three.js, el EPUB, la importación de Goodreads y JSZip solo se cargan al usarlos.
- Medir en un Android barato de verdad (2–3 GB de RAM): arranque, entrar en el edificio, café, hotel y casino; memoria y
  calor tras 15 minutos.
- Que cada escena 3D tenga su salida si se pierde el contexto WebGL (`onLost`) y libere memoria al salir.

### 3.4 Android por dentro de la TWA
- **Botón Atrás**: en cada pantalla cierra lo último abierto; en la habitación sale de la app. Recorrer café (barra, obrador,
  taller), hotel y salas, lector EPUB, ordenador, comunidad y tablón.
- Teclado: que no tape los campos (alta, búsqueda, notas, post-its).
- Áreas seguras con muesca y barra de gestos (ojo a `fix-138.css`, ver CLAUDE.md §3), tamaño de letra del sistema grande y
  modo oscuro del sistema.
- Sin conexión: la app abre y dice qué no está disponible; volver a conectar sin perder lo hecho.
- Audio: pausar al ir a segundo plano y no sonar antes de tocar nada.
- Actualizaciones del service worker con la app abierta (que no deje una versión a medias).

### 3.5 Servidor
- **Supabase**: el plan gratuito pausa el proyecto tras una semana sin uso, sin copia a un momento concreto y con límites bajos.
  Con usuarios reales, plan de pago, copias activadas y **ensayar una restauración**.
- **Vercel**: el plan Hobby no admite uso comercial; revisarlo si la app genera ingresos.
- **Google Books**: sin clave tiene un cupo por IP; poner una clave con límites, en el servidor (función de Vercel), nunca en el
  código de la app.
- Repasar los límites de frecuencia (`enforce_rate_limit`) de todo lo que escribe un usuario.
- Revisar que las excepciones de las cuentas de prueba (fundador, probadores, regalos) solo afectan a esas cuentas y que
  ninguna herramienta de `import.meta.env.DEV` llega al build.

### 3.6 Pruebas antes de cada envío
- Una e2e de humo por zona (arranque, alta, biblioteca, edificio, café, hotel, comunidad) a 360 y 412 px en Chromium.
- La prueba cerrada de Google como prueba en dispositivos reales: lista de recorridos para los testers y un formulario
  para fallos.

## 4. Derechos y marca (riesgo de retirada)
Una reclamación de marca o de derechos puede retirar la app entera de la tienda.
- Revisar uno a uno los guiños con nombres ajenos: el cartel «AQUÍ NO HAY QUIEN LEA», «Para quien leyó …» de los sets de
  sagas (aunque estén retirados de la venta, el texto puede seguir en el código), títulos de series y juegos citados en
  textos visibles.
- Música y sonidos: anotar el origen y la licencia de cada archivo de `public/media/` (pistas generadas con IA:
  revisar los términos del servicio que las generó; `brisa-de-papel-demo.mp3`).
- Portadas de Google Books y Open Library: indicar la fuente donde se muestren.
- Fuentes tipográficas y recursos de terceros: lista con licencia (ya está `pixelfx` con su `LICENSE`/`NOTICE.md`).

## 5. Ficha de la tienda y primer uso
- Nombre, descripción corta y larga (español; inglés más adelante), icono de 512 px, imagen destacada 1024 × 500, capturas
  de móvil (piso, café, hotel, biblioteca, comunidad) y un vídeo corto.
- Categoría (Libros y obras de consulta o Estilo de vida), correo de contacto y la web de privacidad.
- **Primer uso**: con tantas funciones, un recorrido de un minuto (tu habitación, añade un libro, la puerta al edificio) y
  dejar lo avanzado para después.
- Decidir qué se queda oculto al lanzar: figuras (ya ocultas), sobres (cerrados), Rincón 01 (apagado) y lo que esté a medias.
- **Versión de lanzamiento congelada**: sin bloques grandes del café en las primeras semanas; solo correcciones.

## 6. Orden propuesto (por bloques, con evidencias como siempre)

Estado (20-11-2026): el bloque 2 está hecho a falta del correo de contacto y de aplicar la migración (`docs/ESTADO.md`).

1. **Cerrar o apartar lo que esté a medias** (1.145, el recetario del obrador).
2. **Cuenta y legal**: borrar la cuenta (app y web), páginas legales, aceptar normas, edad. Migración nueva (la aplica Francisco).
3. **Moderación**: pantalla de denuncias para moderadores.
4. **Errores y datos**: seguimiento de errores, almacenamiento persistente, aviso sin cuenta.
5. **Android**: botón Atrás, teclado, áreas seguras, sin conexión, audio en segundo plano; rendimiento en móvil modesto.
6. **Empaquetado**: TWA, `assetlinks.json`, firma, prueba interna y después prueba cerrada (14 días, 12 personas).
7. **Ficha y primer uso**, revisión de derechos, y paso a producción cuando Francisco lo apruebe.

## 7. Decisiones de Francisco (20-11-2026)
1. **Responsable**: él mismo. Falta el **correo de contacto** que aparecerá en las páginas legales y en la ficha (se recomienda
   uno del dominio, p. ej. en `libotown.es`, para no publicar el personal). Su nombre en las páginas, a confirmar.
   **Francisco creará uno de `libotown.es`** (20-11-2026); cuando diga cuál, sustituir `[correo de contacto pendiente]` en
   las cuatro páginas de `public/legal/`.
2. **Edad mínima: 16 años.** Se declara con una casilla al crear la cuenta («Tengo 16 años o más»), sin pedir la fecha de
   nacimiento (menos datos).
3. **Lo que una cuenta borrada dejó a otros queda como «Lector anónimo»**: no se borra, pero ya no se puede saber de quién era.
4. **Modera Francisco**; sin plazo fijo (las páginas dicen que las denuncias se revisan lo antes posible).
5. **Cuenta de desarrollador personal**: la prueba cerrada (12 personas, 14 días seguidos) es obligatoria.
6. **Planes de pago de Supabase y Vercel**: por confirmar.
7. **Nombre del paquete**: `es.libotown.app` (no se ve en la tienda, solo en la dirección de la ficha; lo que atrae es el nombre,
   el icono y las capturas).
