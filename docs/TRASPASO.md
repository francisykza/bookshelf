# Traspaso entre cuentas de Claude

Guía para Francisco. Las dos cuentas trabajan por turnos **en este ordenador y en esta carpeta**
(`C:\Users\zaely\OneDrive\Escritorio\Claude\bookshelf`).

## Cómo funciona

No hace falta pegar mensajes. Claude Code lee `CLAUDE.md` automáticamente al abrir una sesión en esta carpeta, y su
apartado 0 obliga a cualquier cuenta a:

- **al empezar**: leer `docs/ESTADO.md` y revisar `git log` y `git status` para ver qué hizo la otra;
- **en cada commit**: añadir su entrada en la bitácora de `docs/ESTADO.md`, actualizar el estado y lo pendiente, e
  incluirlo en ese mismo commit;
- **cuando le das una regla nueva**: escribirla en `CLAUDE.md` en ese momento;
- **si no hay commit**: dejar anotado en la bitácora lo que queda sin commit.

| Se comparte | No se comparte |
| --- | --- |
| Código, `SPEC.md`, `CLAUDE.md`, `docs/ESTADO.md`, historial de git | Las conversaciones de cada cuenta |
| Las carpetas de recursos (`material-diseno/`, `art-inbox/`, `assets-source/`) | Las notas de memoria propias de cada cuenta |
| GitHub, Vercel y Supabase (son tuyos, no de Claude) | Los permisos aprobados en cada sesión |

## Lo único que tienes que cuidar

1. **Abrir la sesión en `bookshelf` o en `Claude`**, la carpeta de arriba. En `Claude` hay un `CLAUDE.md` breve (fuera
   de git) que manda leer el de `bookshelf` cuando la tarea es de BookShelf. Si la sesión se abre en otra carpeta,
   no leerá ninguno de los dos.
2. **Una cuenta cada vez.** Cierra o deja quieta una sesión antes de empezar en la otra cuenta.
3. **Si una sesión se corta** antes de anotar nada, no pasa nada grave: la siguiente verá los cambios en `git log` y
   `git status`. Si quieres, dile «anota en `docs/ESTADO.md` lo que ha pasado».

## Comprobación opcional

La primera vez con la otra cuenta puedes preguntarle «¿Qué dice `docs/ESTADO.md`?» para confirmar que lo ha leído.
