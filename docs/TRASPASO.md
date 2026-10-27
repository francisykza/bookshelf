# Traspaso entre cuentas de Claude

Guía para Francisco: qué hacer al pasar BookShelf a otra cuenta de Claude y al volver a la cuenta principal.

## Qué se comparte y qué no

| Se comparte (está en la carpeta del proyecto o en tus servicios) | No se comparte |
| --- | --- |
| El código, `SPEC.md`, `CLAUDE.md`, `docs/ESTADO.md` | Las conversaciones de cada cuenta |
| El historial de git y el repo de GitHub | Las notas internas de memoria de cada cuenta |
| Vercel y Supabase (dependen de tus credenciales, no de Claude) | Las aprobaciones de permisos de cada sesión |
| `material-diseno/`, `art-inbox/`, `assets-source/` (solo en este ordenador, no están en git) | |

Si la otra cuenta trabaja **en este mismo ordenador y en esta carpeta**, lo tiene todo. Si trabaja **en otro
equipo**, necesita: `git clone https://github.com/francisykza/bookshelf.git`, `npm install` y una copia de las tres
carpetas de recursos (no están en git).

## 1. Antes de cambiar de cuenta

- Asegúrate de que la cuenta actual no tiene trabajo a medias: pídele «Actualiza `docs/ESTADO.md` y dime si queda
  algo sin commit». Ahora mismo no queda nada.

## 2. Mensaje para la otra cuenta, al empezar (cópialo tal cual)

> Vas a trabajar en BookShelf, en la carpeta `C:\Users\zaely\OneDrive\Escritorio\Claude\bookshelf`. Antes de hacer
> nada, lee `CLAUDE.md` y `docs/ESTADO.md` enteros, y la sección de `SPEC.md` de la versión actual. Sigue las reglas
> de `CLAUDE.md` en todo (español, commits solo cuando yo los pida, sin Co-Authored-By, pruebas acotadas, no tocar
> mis datos reales ni las claves de Supabase). Confírmame en cinco líneas qué versión está publicada, qué queda
> pendiente y qué reglas vas a seguir, y espera mi encargo.

## 3. Mensaje para la otra cuenta, al terminar cada sesión (cópialo tal cual)

> Antes de cerrar: añade una entrada arriba en la bitácora de `docs/ESTADO.md` (fecha, «cuenta secundaria», versión,
> qué hiciste, commits, qué queda a medias o sin verificar y cualquier decisión mía nueva), actualiza «Estado
> actual» y «Pendiente» si han cambiado, y si cambió alguna regla de trabajo, ponla en `CLAUDE.md`. Luego dime si
> queda algo sin commit. Si te pido commit, incluye esos documentos en él.

Si se le olvida o la sesión se corta, no pasa nada grave: al volver, la cuenta principal mira el historial de git.

## 4. Al volver a la cuenta principal (cópialo tal cual)

> He estado trabajando en BookShelf con otra cuenta. Antes de seguir: lee `docs/ESTADO.md` (sobre todo la
> bitácora), mira `git log` desde el commit `eff8031` y `git status`, y revisa si `CLAUDE.md` ha cambiado. Resúmeme
> qué se hizo, en qué versión estamos, qué quedó a medias y si hay cambios sin commit, y actualiza tus notas.

## 5. Consejos

- **Una cuenta a la vez** en la misma carpeta: si las dos editan a la vez, se pisan los cambios.
- Que cada bloque termine con commit (aunque no se suba): así la otra cuenta ve exactamente qué cambió.
- Si a la otra cuenta le das una regla nueva («no toques X», «a partir de ahora Y»), pídele que la escriba en
  `CLAUDE.md`; si no, la cuenta principal no la conocerá.
- Las migraciones de Supabase las sigues aplicando tú, con cualquiera de las dos cuentas: anota en
  `docs/ESTADO.md` cuáles están aplicadas.
