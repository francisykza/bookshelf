// Montaje de un piso de «El edificio del puerto» (1.63, SPEC §63; integrado en la 1.64, §64): el tuyo, para
// decorarlo, o el de un vecino, solo para mirar. Reglas en room.js, dibujo en render.js. `destroy()` lo deja todo
// como estaba.
//
// La habitación ocupa todo el ancho y los controles viven en ella: «Decorar» y «Luz de tarde» en una esquina, y las
// herramientas del mueble elegido (Girar, Color, Guardar, Listo) flotando junto a él. Al decorar, abajo aparece una
// balda de madera con el catálogo: un mueble se arrastra de la balda al piso (cae en el hueco libre más cercano al
// dedo) o se toca para ponerlo en el centro. La última pestaña de la balda cambia paredes y suelo.
//
// Controles al decorar: tocar un mueble lo elige; arrastrarlo lo mueve (si al soltar no cabe, vuelve a su sitio); con
// uno elegido, tocar un hueco lo lleva allí. Teclado en el lienzo: flechas para moverlo (→ y ← a lo largo de la pared
// del fondo, ↑ y ↓ a lo largo de la de la izquierda), R gira, C cambia el color, Supr lo guarda y Escape lo suelta. La
// lista «En el piso» elige cualquier cosa sin tocar el dibujo.
import './edificio.css';
import { createSfx } from '../minigames/libreria-puerto/audio';
import { DIARIA_TICKETS } from './dailyMissions';
import { CATALOG, CATEGORIES, COMPANEROS, PAREDES, SETS, SUELOS, ZONAS, ZONA_PAREDES, catalogItem, zonaOf } from './catalog';
import { createCompanion, misticoThumb } from './misticos';
import { acabadoOf } from './acabados';
import { acabadosDe, freeCopies, ownedCopies, plainCopies } from './inventory';
import { houseSwatch, pixelIcon, pixelVars } from './pixelUi';
import { COLORES_PELO, COMPLEMENTOS, CONJUNTO_ESTRELLAS, DEFAULT_AVATAR, JERSEYS, PANTALONES, PELOS, PIELES, actorBoxes, isPrenda, prendaKey, prendaNombre, prendaOrigen, approachCell, blockedCells, facingOf, findPath, isSeat, nearestFree, seatOf, validateAvatar } from './actor';
import { ACTOR_ID, ART_H, ART_W, backdropImage, createRoomRenderer, renderActorThumb, renderThumb } from './render';
import { dejarSitioAlLibro, sitioValido, zonaLibro, ESENCIALES_TAB, GUARDIA, ROLES, conBasicos, faltan, itemsDeRol, opcionesDe, ordenadorDe, sustituir } from './esenciales';
import { EFECTOS_APAGADOS, esperanSitio, isRetirado, tieneVida } from './retirados';
import { ROOM, addItem, check, heightOf, itemsOn, moveItem, reasonText, recolorItem, rectOf, removeItem, rotateItem, setFloor, setWall, wallLength } from './room';

const DRAG_PX = 6;
// 1.78 (encargo del 3-11-2026, «más difícil mover un mueble sin querer»): un mueble del piso solo se levanta si se
// mantiene pulsado un momento sin mover el dedo; un toque lo elige y un deslizamiento rápido no lo mueve
const HOLD_MS = 200;
const HOLD_SLOP_PX = 14; // lo que puede temblar el dedo mientras se mantiene
const OUTFIT = 'personaje'; // pestaña de la balda con el armario de tu personaje (§69)
const WALK_SPEED = 2.4; // celdas por segundo
const STEP_S = 0.16; // cada zancada
const FRAME_MS = 70; // el personaje se redibuja a unos 14 fotogramas por segundo
// Las filas del armario: qué se cambia, cómo se llama cada opción y qué parte enseña la muestra
const WARDROBE = [
  { key: 'piel', nombre: 'Piel', frame: 'head', options: PIELES.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'pelo', nombre: 'Pelo', frame: 'head', options: PELOS.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'colorPelo', nombre: 'Color del pelo', corto: 'Color', frame: 'head', options: COLORES_PELO.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'jersey', nombre: 'Jersey', frame: 'torso', options: JERSEYS.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'pantalon', nombre: 'Pantalón', frame: 'legs', options: PANTALONES.map((p) => ({ value: p.id, nombre: p.nombre })) },
  { key: 'gafas', nombre: 'Gafas', frame: 'head', options: [{ value: false, nombre: 'Sin gafas' }, { value: true, nombre: 'Con gafas' }] },
  { key: 'complemento', nombre: 'Complemento', corto: 'Extras', frame: 'head', options: COMPLEMENTOS.map((p) => ({ value: p.id, nombre: p.nombre })) },
];
const PASEO = 6; // celdas andadas tocando el suelo para la misión «Da un paseo»
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TONE_NAMES = ['tono 1', 'tono 2', 'tono 3', 'tono 4', 'tono 5'];
const HOUSE = 'casa'; // pestaña de la balda con paredes y suelo
const INROOM = 'lista'; // pestaña de la balda con lo que hay en tu piso
const SAGAS = 'sagas'; // pestaña de la balda con los sets de sagas (§64), que se eligen de uno en uno
const HINT = 'Tira de un mueble hacia tu piso, o tócalo.';
// Cómo se pinta cada suelo en las muestras de la balda (x, y: píxel de la muestra)
const FLOOR_INK = {
  tablas: (x, y) => ((x + (y % 2) * 3) % 5 === 0 ? '#a87c52' : '#c69c70'),
  damero: (x, y) => ((x + y) % 2 ? '#a85c46' : '#e8dcc4'),
  barro: (x, y) => (x % 3 === 0 || y === 9 ? '#d6c4a8' : '#c47854'),
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

const nameOf = (item) => catalogItem(item.id).nombre;

/**
 * `room`: el piso (ya validado); `editable`: si se puede decorar; `evening`: luz de tarde al abrir; `onChange(room)`:
 * tras cada cambio (para guardarlo); `onAction(item)`: al tocar un mueble con acción (la estantería) sin decorar.
 * `inside`: vista «dentro de la habitación» (§64): el dibujo llena el sitio que haya y el aviso va sobre él; quien lo
 * monta pone el contenedor a pantalla completa. `decorate`: empezar ya decorando (con la balda abierta).
 * `avatar`: el aspecto del personaje (§69). En tu piso siempre hay uno (el de serie si aún no lo has cambiado) y
 * `onAvatarChange(avatar)` avisa al cambiarlo; en el de un vecino solo aparece si lo tiene guardado.
 * Misiones del día (§70): `prendas` (las ganadas; null: sin la migración, y lo que se gana no sale en el armario),
 * `missions` ({ items: [{ id, texto, hecha }], proxima } o null) y `onEvent(tipo)` al hacer algo que puede ser una
 * misión ('sentarse', 'mover', 'color', 'tarde', 'pasear', 'nuevo', 'armario').
 * Vecinos (§71): `likes` ({ megusta: { uid: n }, mios: [uid] } o null) y `onLike(uid, si)`: en el piso de un vecino,
 * al tocar un mueble sale «Me gusta»; en el tuyo, el aviso dice cuántos tiene.
 * `placeId` (1.76): un mueble recién sacado de un sobre; el piso se abre decorando con él ya puesto y elegido, para
 * arrastrarlo a su sitio. «Guardar» lo devuelve al inventario y el piso queda como estaba.
 */
/** Lo que se mueve el dedo, en px del dibujo, y sigue siendo el mismo punto de la pila de muebles. */
const STACK_SLOP = 6;

export function mountPiso(container, { room: initial, editable = false, evening = false, muted = true, label = 'Piso', inside = false, placeAcabado = null, decorate = false, inventory = null, avatar = null, prendas = null, missions = null, onChange = () => {}, onAction = null, onAvatarChange = () => {}, onEvent = () => {}, likes = null, onLike = null, companion = null, onCompanionChange = () => {}, onDressing = () => {}, placeId = null, stackTaps = false } = {}) {
  const sfx = createSfx({ muted });
  const renderer = createRoomRenderer();
  let room = initial;
  // Las reglas de los esenciales, solo al decorar tu piso (el piloto trae las suyas). No se guardan: `validateRoom` las quita
  if (editable && !room.guard) room = { ...room, guard: GUARDIA };
  // Copias de cada mueble (1.66, §66); null: todo libre (sin la migración del inventario, o en el prototipo)
  let inv = conBasicos(inventory);
  let selected = null; // uid del objeto elegido
  let stack = null; // Los toques seguidos en el mismo punto: { a, peeled }
  let drag = null; // { uid, pointerId, x0, y0, armed, timer, moved, grab, preview: { room, item, ok, reason, con } }
  let fresh = null; // mueble que llega de la balda: { id, pointerId, x0, y0, moved, base: { room, item }, preview, over }
  let isEvening = evening;
  let decorating = false;
  let isInside = false;
  let stageBack = ''; // telón de la página en la vista «dentro» (tamaño y luz con que se pintó)
  let raf = 0;
  let destroyed = false;
  // El personaje: su aspecto y dónde está. `path`: puntos del mundo que le quedan por recorrer; `seat`: el uid del
  // asiento en el que está (o al que va, en `goal`); `lookAt`: hacia dónde mirar al llegar
  let look = validateAvatar(avatar) ?? (editable ? DEFAULT_AVATAR : null);
  let me = null;
  let anim = 0;
  let lastT = 0;
  let lastFrame = 0;
  let wanderTimer = 0;
  let owned = prendas;
  // El místico legendario que te acompaña (docs/qa/misticos.md): su id o null. Los místicos que se colocan y el
  // compañero se mueven solos: un bucle propio («life») mientras haya alguno y no se pida menos movimiento.
  let pal = COMPANEROS.some((c) => c.id === companion) ? companion : null;
  const buddy = createCompanion();
  let life = 0;
  let lifeLast = 0;
  let lifeDrawn = 0;
  let lifeT = 1.3;
  let liked = likes;
  let likeShown = null; // uid del mueble con su «Me gusta» a la vista
  let today = missions;
  let walked = 0; // celdas andadas a mano (misión «Da un paseo»)

  const canvas = el('canvas', { class: 'ep-canvas', width: ART_W, height: ART_H, tabindex: 0, role: 'application', 'aria-roledescription': 'habitación', 'aria-label': label });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(ART_W, ART_H);
  const status = el('p', { class: 'ep-status', role: 'status', 'aria-live': 'polite' });
  const actionRow = el('div', { class: 'ep-action', hidden: true });

  // Botones de píxel: un icono y, si hace falta, su nombre al lado (si no, el nombre es solo para lectores de pantalla)
  const pxButton = (name, icon, { cls = '', label = true, attrs = {} } = {}) => {
    const b = el('button', { type: 'button', class: `px-btn ${cls}`, title: label ? null : name, ...attrs }, pixelIcon(icon));
    const text = el('span', { class: label ? 'px-btn__text' : 'px-sr', text: name });
    b.append(text);
    return b;
  };
  const setIcon = (b, icon) => b.querySelector('.px-icon').replaceWith(pixelIcon(icon));

  const lightBtn = pxButton('Luz de tarde', isEvening ? 'luna' : 'sol', { cls: 'px-btn--icon', label: false, attrs: { 'aria-pressed': String(isEvening) } });

  // ── Herramientas del objeto elegido: una etiqueta de papel que flota junto a él, dentro de la habitación ──
  const toolName = el('p', { class: 'ep-tools__name' });
  const rotateBtn = pxButton('Girar', 'girar', { cls: 'px-btn--icon', label: false, attrs: { 'aria-keyshortcuts': 'R' } });
  const colorBtn = pxButton('Color', 'color', { cls: 'px-btn--icon', label: false, attrs: { 'aria-keyshortcuts': 'C' } });
  const storeBtn = pxButton('Guardar', 'guardar', { cls: 'px-btn--icon', label: false, attrs: { 'aria-keyshortcuts': 'Delete' } });
  const doneBtn = pxButton('Listo', 'listo', { cls: 'px-btn--icon px-btn--sage', label: false, attrs: { 'aria-keyshortcuts': 'Escape' } });
  const tools = el('div', { class: 'ep-tools', hidden: true, role: 'group', 'aria-label': 'Mueble elegido' }, toolName, el('div', { class: 'ep-tools__row' }, rotateBtn, colorBtn, storeBtn, doneBtn));

  // «Decorar» y la luz, en las esquinas de abajo de la habitación (el dibujo deja ahí dos huecos)
  const decorateBtn = pxButton('Decorar', 'decorar', { cls: 'px-btn--sage ep-corner ep-corner--right', attrs: { 'aria-expanded': 'false' } });
  lightBtn.classList.add('ep-corner', 'ep-corner--left');
  // «Hoy en tu piso»: las tres misiones del día en una nota de papel, junto a la luz
  const todayBtn = pxButton('Hoy en tu piso', 'hoy', { cls: 'px-btn--icon ep-corner ep-corner--left2', label: false, attrs: { 'aria-expanded': 'false', hidden: true } });
  const todayCard = el('section', { class: 'ep-today', hidden: true, 'aria-label': 'Hoy en tu piso' });
  // 1.78 (encargo del 3-11-2026, «que la habitación sea la protagonista y con iconos claros se llegue a los menús»):
  // el armario, que antes solo se abría tocando a tu personaje, tiene su icono; y en la vista «dentro», sin decorar,
  // los cuatro (Decorar, Armario, Hoy y Luz) van juntos en una fila abajo, cada uno con su nombre debajo
  const wardrobeBtn = pxButton('Armario', 'armario', { cls: 'px-btn--icon ep-corner ep-corner--left3', label: false });
  const caption = (b, text) => b.append(el('span', { class: 'ep-menu__cap', 'aria-hidden': 'true', text }));
  caption(lightBtn, 'Luz');
  caption(todayBtn, 'Hoy');
  caption(wardrobeBtn, 'Armario');
  const menu = el('div', { class: 'ep-menu' }, lightBtn, editable ? todayBtn : null, editable ? wardrobeBtn : null, editable ? decorateBtn : null);
  const overlay = el('div', { class: 'ep-overlay' });
  const stage = el('div', { class: 'ep-stage' }, canvas, menu, todayCard, tools, overlay);
  const root = el('div', { class: 'ep' }, stage, status);
  for (const [k, v] of Object.entries(pixelVars())) root.style.setProperty(k, v);

  // ── La balda: catálogo, paredes y suelo ──
  const panel = el('section', { class: 'ep-panel ep-shelf', hidden: true, 'aria-label': 'Decorar tu piso' });
  let category = editable ? ESENCIALES_TAB : ZONAS[0].id;
  let essOpen = null;
  const catRow = el('div', { class: 'ep-cats', role: 'group', 'aria-label': 'Qué poner' });
  const catTitle = el('p', { class: 'ep-shelf__title', 'aria-hidden': 'true' });
  const grid = el('div', { class: 'ep-grid' });
  const wallRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Color de las paredes' });
  const floorRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Suelo' });
  // Paredes y suelo en una sola fila que se recorre de lado, como los muebles
  const house = el('div', { class: 'ep-house', hidden: true }, el('div', { class: 'ep-house__group' }, el('span', { class: 'ep-house__label', text: 'Paredes' }), wallRow), el('div', { class: 'ep-house__group' }, el('span', { class: 'ep-house__label', text: 'Suelo' }), floorRow));
  const hint = el('p', { class: 'ep-shelf__hint', text: HINT });
  // 1.89.3: un piso antiguo con algo en la celda del libro: se avisa al decorar y se arregla solo si se pide
  const bookNoteText = el('p', { class: 'ep-book-note__text' });
  const bookNoteBtn = el('button', { type: 'button', class: 'ep-book-note__btn', text: 'Dejar sitio al libro' });
  const bookNote = el('div', { class: 'ep-book-note', hidden: true }, bookNoteText, bookNoteBtn);
  // Sagas: una fila de etiquetas con el nombre de cada set; debajo, sus muebles y el guiño a quien leyó el libro
  let sagaSet = SETS[0].id;
  const setRow = el('div', { class: 'ep-sets', role: 'group', 'aria-label': 'Sets de sagas', hidden: true });
  const ghost = el('img', { class: 'ep-ghost', alt: '', width: 44, height: 44, hidden: true });
  // Lo que hay en el piso: al decorar, una pestaña más de la balda; mirando un piso ajeno, una lista plegada debajo
  const list = el('ul', { class: 'ep-inroom__list' });
  const listSummary = el('summary', {});
  const listBox = editable ? el('div', { class: 'ep-inroom', hidden: true }, list) : el('details', { class: 'ep-list' }, listSummary, list);
  // La pestaña del armario en la balda (lo abre: el armario es un modo propio del piso, 1.77)
  const outfitTab = el('img', { class: 'ep-chip__img', alt: '', width: 33, height: 33 });
  const essBox = el('div', { class: 'ep-ess', hidden: true });
  // Reestructuración de muebles (9-11-2026): pestañas por zona de la casa, no por tipo, y sin pestañas vacías (una zona
  // cuyos muebles están todos retirados no sale). «Paredes y suelo» es la pestaña de la casa: lo de pared, alfombras,
  // colores y suelo. Los místicos siguen aparte, solo si tienes alguno.
  const conMuebles = ZONAS.filter((z) => CATALOG.some((c) => zonaOf(c) === z.id && !c.compania && !isRetirado(c.id)));
  const misticosTab = CATEGORIES.filter((g) => g.id === 'misticos');
  const CATS = [{ id: ESENCIALES_TAB, nombre: 'Esenciales' }, ...conMuebles, { id: HOUSE, nombre: 'Paredes y suelo' }, ...misticosTab, { id: OUTFIT, nombre: 'Tu personaje' }, { id: INROOM, nombre: 'En el piso' }];
  // Cada pestaña lleva el dibujo de un mueble de su tipo; la de paredes y suelo, una muestra de los de tu piso
  // 1.74: el nombre corto, a la vista bajo el dibujo de cada pestaña
  const TAB_SHORT = { [ESENCIALES_TAB]: 'Esenciales', ...Object.fromEntries(ZONAS.map((z) => [z.id, z.corto])), [OUTFIT]: 'Armario', [HOUSE]: 'Paredes', [INROOM]: 'En el piso' };
  const TAB_ICON = { [ESENCIALES_TAB]: 'estanteria', ...Object.fromEntries(ZONAS.map((z) => [z.id, z.icono])), misticos: 'farol-azul' };
  const hasMisticos = () => CATALOG.some((c) => c.cat === 'misticos' && !c.compania && !isRetirado(c.id) && ownedCopies(inv, c.id) > 0);
  function syncMisticTab() {
    const b = catRow.querySelector('[data-cat="misticos"]');
    if (b) b.hidden = !hasMisticos();
    if (category === 'misticos' && b?.hidden) category = CATS[0].id;
  }
  const houseTab = el('img', { class: 'ep-chip__img', alt: '', width: 33, height: 33 });

  if (editable) {
    for (const c of CATS) {
      const img = c.id === HOUSE ? houseTab : c.id === OUTFIT ? outfitTab : c.id === INROOM ? pixelIcon('lista') : el('img', { class: 'ep-chip__img', alt: '', width: 33, height: 33, src: renderThumb(TAB_ICON[c.id], 0, 33).toDataURL() });
      const b = el('button', { type: 'button', class: 'ep-chip', 'data-cat': c.id, 'aria-pressed': String(c.id === category), 'aria-label': c.nombre, title: c.nombre }, img, el('span', { class: 'ep-chip__name', 'aria-hidden': 'true', text: TAB_SHORT[c.id] ?? c.nombre }));
      b.addEventListener('click', () => {
        if (c.id === OUTFIT) return openWardrobe();
        category = c.id;
        for (const x of catRow.children) x.setAttribute('aria-pressed', String(x.dataset.cat === category));
        fillGrid();
      });
      catRow.append(b);
    }
    syncMisticTab();
    for (const set of SETS) {
      const b = el('button', { type: 'button', class: 'ep-set', 'data-set': set.id, 'aria-pressed': String(set.id === sagaSet), text: set.nombre });
      b.addEventListener('click', () => {
        sagaSet = set.id;
        for (const x of setRow.children) x.setAttribute('aria-pressed', String(x.dataset.set === sagaSet));
        fillGrid();
      });
      setRow.append(b);
    }
    for (const p of PAREDES) {
      const b = el('button', { type: 'button', class: 'ep-swatch', 'data-pared': p.id }, el('img', { class: 'ep-swatch__img', alt: '', width: 33, height: 33 }), el('span', { text: p.nombre }));
      b.addEventListener('click', () => commit(setWall(room, p.id), `Paredes: ${p.nombre.toLowerCase()}.`));
      wallRow.append(b);
    }
    for (const s of SUELOS) {
      const b = el('button', { type: 'button', class: 'ep-swatch', 'data-suelo': s.id }, el('img', { class: 'ep-swatch__img', alt: '', width: 33, height: 33 }), el('span', { text: s.nombre }));
      b.addEventListener('click', () => commit(setFloor(room, s.id), `Suelo: ${s.nombre.toLowerCase()}.`));
      floorRow.append(b);
    }
    panel.append(el('div', { class: 'ep-shelf__head' }, catRow, catTitle), el('div', { class: 'ep-shelf__board' }, setRow, essBox, grid, house, listBox), hint);
    panel.prepend(bookNote);
    root.append(panel, actionRow);
    // Fuera del panel: un antepasado con transform haría que «fixed» no siguiera al dedo
    document.body.append(ghost);
  } else {
    root.append(actionRow, listBox);
  }
  container.append(root);

  const thumbs = new Map();
  /** La ficha de una copia con acabado (1.86): se distingue de la lisa de un vistazo. */
  function shelfTile(cat, acabado) {
    const key = `${cat.id}@${acabado}`;
    if (!thumbs.has(key)) thumbs.set(key, renderThumb(cat.id, 0, 44, acabado).toDataURL());
    const b = el('button', { type: 'button', class: 'ep-item is-acabado', 'data-id': cat.id, 'data-acabado': acabado, draggable: 'false' }, el('img', { src: thumbs.get(key), alt: '', width: 44, height: 44, draggable: 'false' }), el('span', { text: acabadoOf(acabado).nombre }), el('b', { class: 'ep-item__count', 'aria-hidden': 'true' }));
    b.addEventListener('click', (e) => {
      if (b.dataset.dragged) {
        delete b.dataset.dragged;
        e.preventDefault();
        return;
      }
      add(cat.id, acabado);
    });
    b.addEventListener('pointerdown', (e) => onShelfDown(e, cat.id, b, acabado));
    return b;
  }

  const essTitle = () => {
    const n = faltan(room).length;
    return n ? `Esenciales · falta${n > 1 ? 'n' : ''} ${n}` : 'Esenciales';
  };
  // Lo que no se dibuja se dice aquí, para que nadie crea que lo ha perdido
  const inRoomTitle = () => {
    const ocultos = room.ocultos?.length ?? 0;
    const esperan = esperanSitio(room).length;
    return `En el piso (${room.items.length})${esperan ? ` · ${esperan} esperan sitio` : ocultos ? ` · ${ocultos} retirados, guardados` : ''}`;
  };

  // El escritorio que lleva el ordenador se nombra y se enseña como lo que es: el conjunto
  const shownName = (item) => (item.id === 'escritorio' && ordenadorDe(room)?.uid === item.uid ? 'Ordenador y escritorio' : nameOf(item));
  function puestoThumb(tono, acabado) {
    const c = document.createElement('canvas');
    c.width = 44;
    c.height = 44;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(renderThumb('escritorio', tono, 44, acabado), 1, 7, 42, 42);
    g.drawImage(renderThumb('ordenador', 0, 44), 8, -3, 30, 30);
    return c;
  }
  const essThumb = (id, tono, acabado) => (id === 'escritorio' ? puestoThumb(tono, acabado) : renderThumb(id, tono, 44, acabado)).toDataURL();

  /** Ordenador, estantería y sillón: si faltan, se colocan; si están, se eligen para mover o girar, y se sustituyen. */
  function fillEss() {
    essBox.replaceChildren(
      ...ROLES.map((rol) => {
        const item = itemsDeRol(room, rol)[0] ?? null;
        const thumb = essThumb(item?.id ?? rol.base, item?.tono ?? 0, item?.acabado ?? null);
        // Un escritorio lleno no tiene sitio para el ordenador: se dice, en vez de dar por hecho que está
        const sinPc = rol.id === 'ordenador' && item && !ordenadorDe(room);
        const btn = (text, onClick, extra = {}) => {
          const b = el('button', { type: 'button', class: 'ep-ess__btn', text, ...extra });
          b.addEventListener('click', onClick);
          return b;
        };
        const actions = item
          ? [
              btn('Elegir', () => {
                if (!decorating) setDecorating(true);
                select(item.uid);
              }),
              btn('Sustituir', () => {
                essOpen = essOpen === rol.id ? null : rol.id;
                fillEss();
              }, { 'aria-expanded': String(essOpen === rol.id) }),
            ]
          : [btn('Colocar', () => {
              if (!decorating) setDecorating(true);
              add(rol.base);
            })];
        const card = el('div', { class: 'ep-ess__card', 'data-rol': rol.id, 'data-estado': item ? 'colocado' : 'falta' },
          el('img', { src: thumb, alt: '', width: 44, height: 44, draggable: 'false' }),
          el('div', { class: 'ep-ess__txt' }, el('b', { text: rol.nombre }), el('span', { text: sinPc ? 'Libera una celda del escritorio para el ordenador.' : item ? `${shownName(item)} · colocado` : `Falta. ${rol.falta}` })),
          el('div', { class: 'ep-ess__acts' }, ...actions));
        if (!item || essOpen !== rol.id) return card;
        const opts = opcionesDe(inv, room, rol, item);
        const row = el('div', { class: 'ep-ess__opts' });
        if (!opts.length) row.append(el('span', { text: 'Aún no tienes otro modelo.' }));
        for (const o of opts) {
          const nombre = `${catalogItem(o.id).nombre} · ${o.acabado ? acabadoOf(o.acabado).nombre : TONE_NAMES[o.tono]}`;
          const b = el('button', { type: 'button', class: 'ep-ess__opt', 'aria-label': `Sustituir por ${nombre}`, title: nombre, 'data-id': o.id, 'data-tono': String(o.tono) }, el('img', { src: essThumb(o.id, o.tono, o.acabado), alt: '', width: 44, height: 44, draggable: 'false' }));
          b.addEventListener('click', () => {
            const res = sustituir(room, item.uid, o);
            if (res.error) return fail(res.error, res.con);
            sfx.play('place');
            essOpen = null;
            selected = item.uid;
            if (!decorating) setDecorating(true);
            commit(res.room, `Ahora: ${nombre}.`);
          });
          row.append(b);
        }
        return el('div', { class: 'ep-ess__group' }, card, row);
      }),
    );
    catTitle.textContent = essTitle();
  }

  function fillGrid() {
    const isHouse = category === HOUSE;
    const isList = category === INROOM;
    const isEss = category === ESENCIALES_TAB;
    const set = category === SAGAS ? SETS.find((x) => x.id === sagaSet) : null;
    catTitle.textContent = isEss ? essTitle() : isList ? inRoomTitle() : set ? set.nombre : CATS.find((c) => c.id === category).nombre;
    hint.textContent = set ? set.guino : HINT;
    setRow.hidden = !set;
    house.hidden = !isHouse;
    listBox.hidden = !isList;
    essBox.hidden = !isEss;
    // En «Paredes y suelo», lo de pared y las alfombras encima de los colores y el suelo
    grid.hidden = isList || isEss;
    hint.hidden = isHouse || isList || isEss;
    grid.replaceChildren();
    if (isEss) fillEss();
    if (isList || isEss) return;
    const zona = isHouse ? ZONA_PAREDES : category;
    for (const cat of CATALOG.filter((c) => zonaOf(c) === zona && (!set || c.set === set.id))) {
      // Lo que no tienes no está en tu balda (llegará con la tienda)
      if (ownedCopies(inv, cat.id) === 0 || cat.compania || isRetirado(cat.id)) continue;
      for (const acabado of Object.keys(acabadosDe(inv, cat.id))) grid.append(shelfTile(cat, acabado));
      if (plainCopies(inv, cat.id) <= 0) continue;
      if (!thumbs.has(cat.id)) thumbs.set(cat.id, renderThumb(cat.id).toDataURL());
      const b = el('button', { type: 'button', class: 'ep-item', 'aria-label': `Añadir ${cat.nombre.toLowerCase()}`, 'data-id': cat.id, draggable: 'false' }, el('img', { src: thumbs.get(cat.id), alt: '', width: 44, height: 44, draggable: 'false' }), el('span', { text: cat.nombre }), el('b', { class: 'ep-item__count', 'aria-hidden': 'true' }));
      b.addEventListener('click', (e) => {
        // Si acaba de soltarse un arrastre desde este botón, el clic que lo sigue no añade otro
        if (b.dataset.dragged) {
          delete b.dataset.dragged;
          e.preventDefault();
          return;
        }
        add(cat.id);
      });
      b.addEventListener('pointerdown', (e) => onShelfDown(e, cat.id, b));
      grid.append(b);
    }
    if (!grid.children.length && !isHouse) grid.append(el('p', { class: 'ep-shelf__empty', text: 'Aún no tienes nada de esto.' }));
    grid.hidden = isHouse && !grid.children.length;
    grid.scrollLeft = 0;
    refreshCounts();
  }

  /** Cuántas copias te quedan de cada mueble de la balda; lo agotado se ve apagado (y no se puede sacar). */
  function refreshCounts() {
    for (const b of grid.querySelectorAll('.ep-item[data-id]')) {
      const id = b.dataset.id;
      const acabado = b.dataset.acabado ?? null;
      const free = freeCopies(inv, room, id, acabado);
      const name = `${catalogItem(id).nombre.toLowerCase()}${acabado ? ` ${acabadoOf(acabado).nombre}` : ''}`;
      const count = b.querySelector('.ep-item__count');
      count.hidden = free === Infinity;
      count.textContent = free === Infinity ? '' : `×${free}`;
      b.classList.toggle('is-out', free === 0);
      b.setAttribute('aria-label', free === Infinity ? `Añadir ${name}` : free ? `Añadir ${name} (te quedan ${free})` : `Añadir ${name} (no te quedan)`);
    }
  }

  // ── El armario ──
  const actorThumbs = new Map();
  function actorThumb(a, frame, size = 33) {
    const key = JSON.stringify(a) + frame + size;
    if (!actorThumbs.has(key)) actorThumbs.set(key, renderActorThumb(a, { frame, size }).toDataURL());
    return actorThumbs.get(key);
  }

  // El armario (1.77, maqueta de Francisco): un modo propio del piso. Arriba, tu piso de verdad encuadrado en tu
  // personaje, con sitio a un lado para quien te acompaña; abajo, tres pestañas (Ropa, Aspecto y Compañía). Lo que se
  // toca se ve al momento en el piso, pero solo se guarda con «Listo»; volver antes deja lo de antes. La barra del
  // panel («← Al piso» y «Armario») la pone EdificioPanel al avisarle con onDressing.
  const ROPA = ['jersey', 'pantalon', 'gafas', 'complemento'];
  const ASPECTO = ['piel', 'pelo', 'colorPelo'];
  const WTABS = [
    { id: 'ropa', nombre: 'Ropa' },
    { id: 'aspecto', nombre: 'Aspecto' },
    { id: 'compania', nombre: 'Compañía' },
  ];
  let wardrobeTab = 'ropa';
  let dressing = null; // con el armario abierto: { look, pal, decorating } de antes de abrirlo
  const myCompanions = () => COMPANEROS.filter((c) => ownedCopies(inv, c.id) > 0);
  const palThumbs = new Map();
  const palThumb = (id) => {
    if (!palThumbs.has(id)) palThumbs.set(id, misticoThumb(id, 96).toDataURL());
    return palThumbs.get(id);
  };
  const dressTabs = el('div', { class: 'ep-dress__tabs', role: 'tablist', 'aria-label': 'Armario' });
  const dressBody = el('div', { class: 'ep-dress__body', id: 'ep-dress-body', role: 'tabpanel' });
  const readyBtn = pxButton('Listo', 'listo', { cls: 'px-btn--sage ep-dress__ready' });
  const dock = el('section', { class: 'ep-dress', hidden: true, 'aria-label': 'Armario' }, dressTabs, dressBody, readyBtn);

  function rowOptions(row) {
    return (
      row.options
        // Lo que se gana con las misiones solo sale si el servidor las tiene
        .filter((o) => !isPrenda(row.key, o.value) || owned)
        .map((o) => {
          const next = { ...look, [row.key]: o.value };
          const locked = isPrenda(row.key, o.value) && !owned.includes(prendaKey(row.key, o.value));
          const b = el('button', { type: 'button', class: locked ? 'ep-swatch is-locked' : 'ep-swatch', 'data-outfit': prendaKey(row.key, o.value), 'aria-pressed': String(look[row.key] === o.value), 'aria-label': locked ? `${o.nombre} (${prendaOrigen(row.key, o.value)})` : null }, el('img', { class: 'ep-swatch__img', alt: '', width: 44, height: 44, src: actorThumb(next, row.frame, 44) }), el('span', { text: o.nombre }));
          b.addEventListener('click', () => {
            if (!locked) return setLook(next, `${row.nombre}: ${o.nombre.toLowerCase()}.`);
            sfx.play('invalid');
            say(`${o.nombre}: ${prendaOrigen(row.key, o.value)}.`);
          });
          return b;
        })
    );
  }

  /** Compañía: dos tarjetas por fila, con el ser en grande y su nombre entero; la elegida, con borde oliva y su marca. */
  function companionCards() {
    const opts = [{ id: null, nombre: 'Sin compañía', src: actorThumb(look, 'all', 96) }, ...myCompanions().map((c) => ({ id: c.id, nombre: c.nombre, src: palThumb(c.id) }))];
    return el(
      'div',
      { class: 'ep-pals', role: 'group', 'aria-label': 'Compañía' },
      ...opts.map((o) => {
        const b = el('button', { type: 'button', class: 'ep-pal', 'data-pal': o.id ?? 'nadie', 'aria-pressed': String(pal === o.id) }, el('img', { class: 'ep-pal__img', alt: '', width: 96, height: 96, src: o.src }), el('span', { class: 'ep-pal__name', text: o.nombre }), el('i', { class: 'ep-pal__check', 'aria-hidden': 'true' }, pixelIcon('listo')));
        b.addEventListener('click', () => setPal(o.id));
        return b;
      }),
    );
  }

  function fillWardrobe() {
    if (!dressing) return;
    dressTabs.replaceChildren(
      ...WTABS.map((t, k) => {
        const on = t.id === wardrobeTab;
        const b = el('button', { type: 'button', class: 'ep-dress__tab', role: 'tab', id: `ep-dress-${t.id}`, 'aria-selected': String(on), 'aria-controls': 'ep-dress-body', tabindex: on ? '0' : '-1', text: t.nombre });
        b.addEventListener('click', () => {
          if (wardrobeTab === t.id) return;
          wardrobeTab = t.id;
          sfx.play('lift');
          fillWardrobe();
          dressBody.scrollTop = 0;
          dressTabs.querySelector(`#ep-dress-${t.id}`)?.focus();
        });
        b.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          dressTabs.children[(k + (e.key === 'ArrowRight' ? 1 : WTABS.length - 1)) % WTABS.length].click();
        });
        return b;
      }),
    );
    dressBody.setAttribute('aria-labelledby', `ep-dress-${wardrobeTab}`);
    const keep = dressBody.scrollTop;
    if (wardrobeTab === 'compania') dressBody.replaceChildren(companionCards());
    else {
      const keys = wardrobeTab === 'ropa' ? ROPA : ASPECTO;
      dressBody.replaceChildren(...WARDROBE.filter((row) => keys.includes(row.key)).map((row) => el('div', { class: 'ep-dress__row' }, el('h3', { class: 'ep-dress__label', text: row.nombre }), el('div', { class: 'ep-swatches', role: 'group', 'aria-label': row.nombre }, ...rowOptions(row)))));
    }
    dressBody.scrollTop = keep;
  }

  function setPal(id) {
    if (pal === id) return;
    pal = id;
    if (me && pal) buddy.update(me, 1);
    fillWardrobe();
    sfx.play('lift');
    say(pal ? `Te acompaña: ${catalogItem(pal).nombre.toLowerCase()}.` : 'Sin compañía.');
    requestDraw();
    if (!dressing) onCompanionChange(pal);
  }

  function setLook(next, message) {
    look = next;
    fillWardrobe();
    sfx.play('lift');
    say(message);
    requestDraw();
    if (dressing) return;
    outfitTab.src = actorThumb(look, 'head');
    onAvatarChange(look);
    onEvent('armario');
  }

  /** Abre el armario: se apunta cómo vas (para volver a ello si no le das a «Listo»). */
  function openWardrobe() {
    if (!editable || dressing || !look) return;
    const wasDecorating = decorating;
    if (decorating) setDecorating(false);
    dressing = { look, pal, decorating: wasDecorating };
    wardrobeTab = 'ropa';
    // Quieto y mirando hacia donde se pone quien te acompaña
    if (me) {
      me.path = [];
      me.goal = null;
      if (me.pose === 'walk') me.pose = 'stand';
      if (me.pose === 'stand') me.facing = 3;
    }
    dressingSpot();
    clearTimeout(wanderTimer);
    root.classList.add('is-dressing');
    dock.hidden = false;
    dock.setAttribute('data-escape-local', 'open');
    document.addEventListener('keydown', onDressKey);
    window.addEventListener('resize', measureDressing);
    fillWardrobe();
    onDressing(true);
    measureDressing();
    fit();
    // La barra del panel cambia al avisarle: se vuelve a medir cuando ya está
    requestAnimationFrame(() => {
      measureDressing();
      fit();
      requestDraw();
    });
    requestDraw();
    say('Tu armario: lo que toques se ve ya; «Listo» lo guarda.');
    requestAnimationFrame(() => dressTabs.querySelector('[aria-selected="true"]')?.focus());
  }

  /** Cierra el armario: con «Listo» (`save`) se guarda lo elegido; si no, todo vuelve a como estaba. */
  function closeWardrobe(save) {
    if (!dressing) return;
    const before = dressing;
    dressing = null;
    if (save) {
      if (JSON.stringify(look) !== JSON.stringify(before.look)) {
        onAvatarChange(look);
        onEvent('armario');
      }
      if (pal !== before.pal) onCompanionChange(pal);
      sfx.play('place');
    } else {
      look = before.look;
      pal = before.pal;
    }
    if (me && pal) buddy.update(me, 1);
    outfitTab.src = actorThumb(look, 'head');
    root.classList.remove('is-dressing');
    dock.hidden = true;
    dock.removeAttribute('data-escape-local');
    document.removeEventListener('keydown', onDressKey);
    window.removeEventListener('resize', measureDressing);
    canvas.style.left = '';
    canvas.style.top = '';
    onDressing(false);
    fit();
    if (before.decorating) setDecorating(true);
    requestDraw();
    scheduleWander();
    say(save ? 'Listo: así vas.' : 'El armario, como estaba.');
    canvas.focus({ preventScroll: true });
  }

  /** El alto que queda de aquí al pie de la pantalla: arriba el piso, abajo el armario. */
  function measureDressing() {
    if (!dressing) return;
    root.style.setProperty('--ep-dress-h', `${Math.max(420, Math.round(window.innerHeight - root.getBoundingClientRect().top))}px`);
  }

  /**
   * Un sitio despejado para probarse la ropa: si a su lado no cabe quien te acompaña, el personaje se pone en el hueco
   * libre más cercano que tenga sitio a su derecha y delante.
   */
  function dressingSpot() {
    if (!me || me.pose !== 'stand') return;
    const grid = blockedCells(room);
    const open = (x, y) => x >= 0 && y >= 0 && x < ROOM.w && y < ROOM.d && !grid[y * ROOM.w + x];
    const roomy = (x, y) => open(x, y) && open(x + 1, y) && open(x, y - 1) && open(x + 1, y - 1) && open(x, y + 1);
    const here = cellOf(me);
    if (roomy(here.x, here.y)) return;
    let best = null;
    for (let y = 0; y < ROOM.d; y += 1)
      for (let x = 0; x < ROOM.w; x += 1) {
        if (!roomy(x, y)) continue;
        const d = Math.hypot(x - here.x, y - here.y);
        if (!best || d < best.d) best = { x, y, d };
      }
    if (!best) return;
    me.x = best.x + 0.5;
    me.y = best.y + 0.5;
  }

  function onDressKey(e) {
    if (e.key !== 'Escape' || !dressing) return;
    e.preventDefault();
    closeWardrobe(false);
  }

  /** Con el armario abierto, el piso se encuadra en tu personaje y en quien te acompaña (y se queda así al girar). */
  function frameDressing() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h || !me) return;
    const feet = renderer.project(me.x, me.y, 0);
    const side = palSpot();
    const buddyAt = side ? renderer.project(side.x, side.y, 0) : null;
    const x0 = Math.min(feet.sx - 8, buddyAt ? buddyAt.sx - 12 : Infinity);
    const x1 = Math.max(feet.sx + 8, buddyAt ? buddyAt.sx + 12 : -Infinity);
    // El personaje mide unos 40 píxeles del dibujo: que ocupe algo menos de la mitad del alto (y se vea el piso)
    const k = Math.max(2, Math.min((h * 0.46) / 40, (w * 0.6) / (x1 - x0)));
    canvas.style.width = `${Math.round(ART_W * k)}px`;
    canvas.style.height = `${Math.round(ART_H * k)}px`;
    canvas.style.left = `${Math.round(w / 2 - ((x0 + x1) / 2) * k)}px`;
    canvas.style.top = `${Math.round(h * 0.78 - feet.sy * k)}px`;
  }

  /**
   * Dónde se pone quien te acompaña con el armario abierto: a un lado de tu personaje, en un hueco libre del suelo
   * (primero a su derecha en la pantalla, a su misma altura; si no, delante o a la izquierda).
   */
  function palSpot() {
    if (!pal || !me) return null;
    const grid = blockedCells(room);
    const free = (x, y) => x > 0.2 && y > 0.2 && x < ROOM.w - 0.2 && y < ROOM.d - 0.2 && !grid[Math.floor(y) * ROOM.w + Math.floor(x)];
    const tries = [[0.6, -0.6], [0.9, 0], [0, -0.9], [0.7, 0.7], [-0.6, 0.6]];
    const [dx, dy] = tries.find(([a, b]) => free(me.x + a, me.y + b)) ?? tries[0];
    return { x: Math.min(ROOM.w - 0.3, Math.max(0.3, me.x + dx)), y: Math.min(ROOM.d - 0.3, Math.max(0.3, me.y + dy)) };
  }

  // ── Misiones del día ──
  function fillToday() {
    todayBtn.hidden = !today || !editable;
    if (!today) {
      todayCard.hidden = true;
      return;
    }
    const done = today.items.filter((m) => m.hecha).length;
    todayBtn.classList.toggle('is-done', done === today.items.length);
    todayBtn.querySelector('.px-sr').textContent = `Hoy en tu piso (${done} de ${today.items.length})`;
    const foot = today.proxima
      ? el('p', { class: 'ep-today__prize' }, el('span', { text: done === today.items.length ? 'Hecho. Mañana, más.' : 'Premio:' }), done === today.items.length ? null : el('b', { text: prendaNombre(today.proxima) }))
      : // Con todo el armario, las tres dan tickets (1.79)
        el('p', { class: 'ep-today__prize' }, el('span', { text: done === today.items.length ? `Hecho: +${DIARIA_TICKETS} tickets. Mañana, más.` : 'Premio:' }), done === today.items.length ? null : el('b', { text: `${DIARIA_TICKETS} tickets` }));
    // Recién ganada: la prenda, bien a la vista (y la hoja se abre sola)
    const won = today.ganada ? el('p', { class: 'ep-today__won' }, el('img', { class: 'ep-today__won-img', alt: '', width: 33, height: 33, src: actorThumb(wearing(today.ganada), 'head') }), el('span', { text: `Nueva: ${prendaNombre(today.ganada)}` })) : null;
    todayCard.replaceChildren(
      el('h3', { class: 'ep-today__title', text: 'Hoy' }),
      el('ul', { class: 'ep-today__list' }, ...today.items.map((m) => el('li', { class: m.hecha ? 'is-done' : null }, el('span', { class: 'ep-today__check', 'aria-hidden': 'true' }), el('span', { text: m.texto }), el('span', { class: 'px-sr', text: m.hecha ? ' (hecha)' : ' (pendiente)' })))),
      won ?? foot,
    );
  }

  /** El botón «Me gusta» de un mueble ajeno, con su cuenta (pulsado si ya es tuyo). */
  function likeButton(uid) {
    const mine = liked.mios.includes(uid);
    const n = liked.megusta[uid] ?? 0;
    const item = room.items.find((i) => i.uid === uid);
    const b = el('button', { type: 'button', class: 'px-btn ep-like', 'aria-pressed': String(mine), 'aria-label': `Me gusta: ${item ? nameOf(item).toLowerCase() : 'mueble'} (${n})` }, pixelIcon('corazon'), el('span', { class: 'px-btn__text', text: n ? `Me gusta · ${n}` : 'Me gusta' }));
    b.addEventListener('click', () => {
      sfx.play(mine ? 'back' : 'place');
      onLike(uid, !mine);
    });
    return b;
  }

  /** El personaje con una prenda puesta (para su muestra). */
  function wearing(prenda) {
    const [key, raw] = prenda.split(':');
    return { ...(look ?? DEFAULT_AVATAR), [key]: key === 'complemento' ? raw : Number(raw) };
  }

  function toggleToday(open = todayCard.hidden) {
    todayCard.hidden = !open;
    root.classList.toggle('has-today', open);
    todayBtn.setAttribute('aria-expanded', String(open));
  }

  // ── El personaje en la habitación ──
  const cellOf = (p) => ({ x: Math.max(0, Math.min(ROOM.w - 1, Math.floor(p.x))), y: Math.max(0, Math.min(ROOM.d - 1, Math.floor(p.y))) });

  function spawnActor() {
    if (!look) return;
    const free = nearestFree(blockedCells(room), ROOM.w / 2, ROOM.d / 2 + 1);
    if (!free) return;
    me = { x: free.x + 0.5, y: free.y + 0.5, facing: 0, pose: 'stand', step: 0, stepT: 0, h: 0, path: [], seat: null, goal: null, lookAt: null };
  }

  function actorFrame() {
    if (!me || !look) return null;
    const onFloor = me.pose === 'stand' || me.pose === 'walk';
    return { boxes: actorBoxes(look, me), shadow: onFloor ? { x: me.x, y: me.y } : null };
  }

  /** Se baja del asiento (o sale de una celda que ahora ocupa un mueble) a la celda libre más cercana. */
  function standUp(grid = blockedCells(room)) {
    const cell = cellOf(me);
    if (!me.seat && me.pose !== 'sit' && me.pose !== 'lie' && !grid[cell.y * ROOM.w + cell.x]) return cell;
    const free = nearestFree(grid, me.x, me.y);
    if (!free) return null;
    Object.assign(me, { x: free.x + 0.5, y: free.y + 0.5, pose: 'stand', seat: null, h: 0 });
    return free;
  }

  /**
   * Echa a andar hacia una celda (`to`), o hacia un mueble (`item`): si es un asiento libre, se sienta en él; si no, se
   * queda delante mirándolo. Devuelve false si no hay camino.
   */
  function walkTo({ to = null, item = null }) {
    if (!me) return false;
    const grid = blockedCells(room);
    const from = standUp(grid);
    if (!from) return false;
    let path = null;
    let seat = null;
    if (item) {
      const sitHere = isSeat(item.id) && !itemsOn(room, item.uid).length ? seatOf(item) : null;
      for (const c of approachCell(grid, item, from)) {
        path = c.x === from.x && c.y === from.y ? [] : findPath(grid, from, c);
        if (path) break;
      }
      if (!path) return false;
      seat = sitHere ? { uid: item.uid, ...sitHere } : null;
      const r = rectOf(item);
      me.lookAt = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    } else {
      const target = grid[to.y * ROOM.w + to.x] ? nearestFree(grid, to.x + 0.5, to.y + 0.5) : to;
      if (!target) return false;
      path = target.x === from.x && target.y === from.y ? [] : findPath(grid, from, target);
      if (!path) return false;
      me.lookAt = null;
    }
    me.path = path.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
    if (seat) me.path.push({ x: seat.x, y: seat.y });
    me.goal = seat;
    if (!me.path.length) return arrive();
    if (reducedMotion()) {
      // Sin animación: aparece ya donde iba
      const end = me.path[me.path.length - 1];
      me.facing = facingOf(end.x - me.x, end.y - me.y, me.facing);
      Object.assign(me, { x: end.x, y: end.y, path: [] });
      return arrive();
    }
    me.pose = 'walk';
    startAnim();
    return true;
  }

  function arrive() {
    const seat = me.goal;
    me.goal = null;
    me.path = [];
    if (seat) {
      Object.assign(me, { x: seat.x, y: seat.y, h: seat.h, facing: seat.facing, pose: seat.pose, seat: seat.uid });
      onEvent('sentarse');
    } else {
      me.pose = 'stand';
      if (me.lookAt) me.facing = facingOf(me.lookAt.x - me.x, me.lookAt.y - me.y, me.facing);
    }
    me.lookAt = null;
    requestDraw();
    return true;
  }

  function startAnim() {
    if (!anim && !destroyed) anim = requestAnimationFrame(tick);
  }

  function tick(t) {
    anim = 0;
    if (destroyed || !me || !me.path.length) return;
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    let left = WALK_SPEED * dt;
    while (left > 0 && me.path.length) {
      const p = me.path[0];
      const dx = p.x - me.x;
      const dy = p.y - me.y;
      const d = Math.hypot(dx, dy);
      me.facing = facingOf(dx, dy, me.facing);
      if (d <= left) {
        me.x = p.x;
        me.y = p.y;
        me.path.shift();
        left -= d;
      } else {
        me.x += (dx / d) * left;
        me.y += (dy / d) * left;
        left = 0;
      }
    }
    me.stepT += dt;
    me.step = 1 + (Math.floor(me.stepT / STEP_S) % 2);
    if (!me.path.length) {
      lastT = 0;
      arrive();
      return;
    }
    if (t - lastFrame >= FRAME_MS) {
      lastFrame = t;
      requestDraw();
    }
    anim = requestAnimationFrame(tick);
  }

  /** Tras cambiar los muebles: si el asiento ya no está (o se movió) o su celda se ocupó, se aparta. */
  function settleActor() {
    if (!me) return;
    if (me.seat) {
      const item = room.items.find((i) => i.uid === me.seat);
      const s = item ? seatOf(item) : null;
      if (s && s.x === me.x && s.y === me.y && !itemsOn(room, item.uid).length) return;
      me.seat = null;
    }
    me.path = [];
    me.goal = null;
    if (me.pose === 'walk') me.pose = 'stand';
    standUp();
  }

  /** Andar hasta el punto del suelo bajo el dedo (si cae dentro de la habitación). */
  function walkToGround(a) {
    const g = renderer.groundAt(a.x, a.y);
    if (!me || g.x < 0 || g.y < 0 || g.x >= ROOM.w || g.y >= ROOM.d) return false;
    const ok = walkTo({ to: cellOf(g) });
    if (ok) {
      const before = walked;
      walked += Math.max(1, me.path.length);
      if (before < PASEO && walked >= PASEO) onEvent('pasear');
    }
    return ok;
  }

  /** Andar hacia un mueble: a su lado (o a sentarse); a lo de la pared, hasta la pared; sobre una alfombra, encima. */
  function walkToItem(item, a) {
    const cat = catalogItem(item.id);
    if (cat.capa === 'alfombra') return walkToGround(a);
    if (cat.capa === 'pared') {
      const mid = item.a + cat.w / 2;
      return walkTo({ to: cellOf(item.pared === 'fondo' ? { x: mid, y: 0.5 } : { x: 0.5, y: mid }) });
    }
    // Lo de encima de una mesa: hacia la mesa
    const base = cat.capa === 'encima' ? room.items.find((o) => o.uid !== item.uid && catalogItem(o.id).capa === 'suelo' && itemsOn(room, o.uid).some((i) => i.uid === item.uid)) : item;
    return walkTo({ item: base ?? item }) || walkToGround(a);
  }

  /** De vez en cuando pasea solo (nunca con movimiento reducido, ni mientras mueves algo). */
  function scheduleWander() {
    clearTimeout(wanderTimer);
    if (!me || reducedMotion()) return;
    wanderTimer = setTimeout(wander, 6000 + Math.random() * 8000);
  }

  function wander() {
    if (destroyed) return;
    const busy = dressing || drag || fresh || me.path.length || (typeof document !== 'undefined' && document.hidden);
    if (!busy && (!me.seat || Math.random() < 0.35)) {
      const grid = blockedCells(room);
      const spots = [];
      for (let y = 0; y < ROOM.d; y += 1)
        for (let x = 0; x < ROOM.w; x += 1) {
          const d = Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y);
          if (!grid[y * ROOM.w + x] && d >= 1 && d <= 3.5) spots.push({ x, y });
        }
      if (spots.length) walkTo({ to: spots[Math.floor(Math.random() * spots.length)] });
    }
    scheduleWander();
  }

  // ── Estado y dibujo ──
  function say(text) {
    status.textContent = text;
  }

  function group(uid) {
    return [uid, ...itemsOn(room, uid).map((i) => i.uid)];
  }

  function rebake() {
    renderer.bake(room, selected ? group(selected) : []);
  }

  function render() {
    raf = 0;
    if (destroyed) return;
    // Qué hace el personaje y dónde se ve (en píxeles del dibujo), para las pruebas y las herramientas del navegador
    if (me) {
      const p = renderer.project(me.x, me.y, me.pose === 'stand' || me.pose === 'walk' ? 1 : me.h + 0.6);
      canvas.dataset.actor = me.pose;
      canvas.dataset.actorAt = `${Math.round(p.sx)},${Math.round(p.sy)}`;
    }
    if (fresh?.preview && fresh.over) {
      // Un mueble nuevo bajo el dedo: se ve ya en la habitación, en el sitio donde caería
      const p = fresh.preview;
      renderer.draw(ctx, image, { held: { room: p.room, items: [p.item] }, selected: p.item, ok: p.ok, evening: isEvening, inside: isInside, actor: actorFrame(), ...fxNow() });
      placeTools(null);
      return;
    }
    const item = selected ? room.items.find((i) => i.uid === selected) : null;
    if (!item) {
      renderer.draw(ctx, image, { evening: isEvening, inside: isInside, actor: actorFrame(), ...fxNow() });
      placeTools(null);
      return;
    }
    const p = drag?.armed ? drag.preview : null;
    const shown = p ? p.room : room;
    const ids = new Set(group(selected));
    renderer.draw(ctx, image, { held: { room: shown, items: shown.items.filter((i) => ids.has(i.uid)) }, selected: p ? p.item : item, ok: p ? p.ok : true, evening: isEvening, inside: isInside, actor: actorFrame(), ...fxNow(p ? ids : null) });
    placeTools(drag?.armed ? null : item);
  }

  function requestDraw() {
    if (!raf && !destroyed) raf = requestAnimationFrame(render);
    startLife();
  }

  // 1.78: también se mueven solas las mascotas y el polvo de estrellas de la capa (1.80: y los muebles vivos de la caja
  // del casino y los destellos del vestido de lentejuelas)
  const hasPlacedMisticos = () => room.items.some(tieneVida);
  const starry = () => Boolean(me && look?.complemento === 'capa');
  const sequined = () => Boolean(me && look?.jersey === 16);
  const alive = () => !destroyed && !reducedMotion() && ((pal && me) || hasPlacedMisticos() || starry() || sequined());

  function startLife() {
    if (!life && alive()) life = requestAnimationFrame(lifeTick);
  }

  function lifeTick(now) {
    life = 0;
    if (!alive()) {
      lifeLast = 0;
      return;
    }
    const dt = lifeLast ? Math.min(0.1, (now - lifeLast) / 1000) : 0;
    lifeLast = now;
    lifeT += dt;
    if (pal && me) buddy.update(me, dt);
    life = requestAnimationFrame(lifeTick);
    // Unos 30 fotogramas por segundo bastan para el pixel art
    if (now - lifeDrawn >= 32 && !raf) {
      lifeDrawn = now;
      raf = requestAnimationFrame(render);
    }
  }

  /** Los místicos que se ven ahora: los colocados (encima de su peana) y el compañero. `skip`: uids que van en la mano. */
  function beingsNow(skip = null) {
    const out = [];
    for (const it of room.items) {
      const cat = catalogItem(it.id);
      // Los destellos de un acabado, sobre el mueble
      if (!EFECTOS_APAGADOS && it.acabado && !skip?.has(it.uid) && cat?.capa !== 'pared') {
        const rc = rectOf(it);
        out.push({ id: 'chispas-acabado', x: (rc.x0 + rc.x1) / 2, y: (rc.y0 + rc.y1) / 2, z: heightOf(room, it), acabado: it.acabado, ancho: Math.max(rc.x1 - rc.x0, rc.y1 - rc.y0) });
      }
      if (skip?.has(it.uid) || !tieneVida(it)) continue;
      const rc = rectOf(it);
      // La mascota, sobre su cojín (más bajo que la peana); mira hacia donde mira el mueble. Lo vivo de la caja, desde
      // el suelo del mueble (su dibujo sabe a qué altura va)
      const lift = cat.vivo ? 0 : cat.mascota ? 0.2 : 0.22;
      out.push({ id: it.id, uid: it.uid, x: (rc.x0 + rc.x1) / 2, y: (rc.y0 + rc.y1) / 2, z: heightOf(room, it) + lift, tono: it.tono, flip: cat.mascota || cat.vivo ? it.rot === 1 || it.rot === 2 : false });
    }
    // Los destellos del vestido de lentejuelas, en tu personaje
    if (sequined()) out.push({ id: 'destellos', x: me.x, y: me.y, z: me.h ?? 0, moving: me.pose === 'walk', flip: me.facing === 1 || me.facing === 2 });
    // El polvo de estrellas de la capa, alrededor de tu personaje (y de quien te visita, si la lleva)
    // (con el conjunto entero, «Noche estrellada», hay más y brillan más)
    if (starry()) out.push({ id: 'polvo-estrellas', x: me.x, y: me.y, z: me.h ?? 0, moving: me.pose === 'walk', flip: me.facing === 1 || me.facing === 2, full: Object.entries(CONJUNTO_ESTRELLAS).every(([k, v]) => look[k] === v) });
    // Con el armario abierto, posado a un lado de tu personaje y mirándolo
    const spot = dressing && palSpot();
    if (spot) out.push({ id: pal, x: spot.x, y: spot.y, z: 0, flip: spot.x - spot.y > me.x - me.y, moving: false, perch: true });
    else if (pal && me) {
      if (reducedMotion() || buddy.state.x === null) buddy.update(me, 1);
      const s = buddy.state;
      out.push({ id: pal, x: Math.min(ROOM.w - 0.3, Math.max(0.3, s.x)), y: Math.min(ROOM.d - 0.3, Math.max(0.3, s.y)), z: 0, flip: s.flip, moving: s.moving });
    }
    return out;
  }

  const fxNow = (skip) => ({ beings: beingsNow(skip), t: reducedMotion() ? 1.3 : lifeT });

  /** Rectángulo (en píxeles del dibujo) que ocupa un mueble y lo que lleva encima. */
  function boxOf(uid) {
    const want = new Set(group(uid));
    const ids = renderer.raster.ids;
    let x0 = ART_W;
    let y0 = ART_H;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < ids.length; i += 1) {
      if (!want.has(ids[i] & 0x7fff)) continue;
      const x = i % ART_W;
      const y = (i / ART_W) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /** Las herramientas, encima del mueble elegido (o debajo, si arriba no caben), sin salirse de la habitación. */
  function placeTools(item) {
    const show = !!item && decorating;
    // Con un mueble elegido, «Terminar» y la luz se apartan: la habitación es para el mueble y sus herramientas
    root.classList.toggle('has-tools', show);
    tools.classList.toggle('is-away', !show);
    if (!show) return;
    const box = boxOf(item.uid);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!box || !w) return;
    const k = w / ART_W;
    const tw = tools.offsetWidth;
    const th = tools.offsetHeight;
    const cx = ((box.x0 + box.x1 + 1) / 2) * k;
    const above = box.y0 * k - th - 8;
    const top = above >= 4 ? above : Math.min(h - th - 4, (box.y1 + 1) * k + 8);
    const left = Math.max(4, Math.min(w - tw - 4, cx - tw / 2));
    // El lienzo puede estar centrado dentro del escenario (vista «dentro»): se suma dónde empieza
    tools.style.transform = `translate(${Math.round(canvas.offsetLeft + left)}px, ${Math.round(canvas.offsetTop + Math.max(4, top))}px)`;
  }

  function refreshUi() {
    if (editable) refreshCounts();
    if (editable && category === ESENCIALES_TAB) fillEss();
    const item = selected ? room.items.find((i) => i.uid === selected) : null;
    tools.hidden = !item;
    // Dentro de un panel de la app, Escape suelta lo elegido en vez de cerrar el panel (PanelShell lo respeta)
    if (item && decorating) root.dataset.escapeLocal = 'open';
    else delete root.dataset.escapeLocal;
    if (item) {
      const cat = catalogItem(item.id);
      const essential = Boolean(room.guard?.essential(room, item));
      toolName.textContent = `${shownName(item)}${essential ? ' (esencial)' : ''} · ${item.acabado ? acabadoOf(item.acabado).nombre : TONE_NAMES[item.tono]}`;
      rotateBtn.disabled = cat.capa === 'pared';
      storeBtn.disabled = Boolean(room.guard?.keeps(room, item));
      storeBtn.title = storeBtn.disabled ? 'Sustitúyelo desde Esenciales' : '';
      colorBtn.disabled = cat.tonos.length < 2 || Boolean(item.acabado);
    }
    // Las muestras enseñan cómo quedaría tu piso: cada pared con tu suelo, y cada suelo con tu pared
    const wallOf = (id) => PAREDES.find((p) => p.id === id)?.color ?? PAREDES[0].color;
    if (editable) {
      for (const b of wallRow.children) {
        b.setAttribute('aria-pressed', String(b.dataset.pared === room.pared));
        b.firstChild.src = houseSwatch(wallOf(b.dataset.pared), FLOOR_INK[room.suelo] ?? FLOOR_INK.tablas);
      }
      for (const b of floorRow.children) {
        b.setAttribute('aria-pressed', String(b.dataset.suelo === room.suelo));
        b.firstChild.src = houseSwatch(wallOf(room.pared), FLOOR_INK[b.dataset.suelo]);
      }
      houseTab.src = houseSwatch(wallOf(room.pared), FLOOR_INK[room.suelo] ?? FLOOR_INK.tablas);
    }
    listSummary.textContent = inRoomTitle();
    if (category === INROOM) catTitle.textContent = listSummary.textContent;
    list.replaceChildren(
      ...room.items.map((i) => {
        const fixed = Boolean(room.guard?.essential(room, i));
        const text = `${nameOf(i)}${fixed ? ', esencial' : ''}${i.uid === selected ? ' (elegido)' : ''}`;
        if (!editable) return el('li', { text });
        // Al decorar, cada cosa de pie en la balda con su dibujo (y su color), como en el catálogo
        const key = `${i.id}:${i.tono}:${i.acabado ?? ''}`;
        if (!thumbs.has(key)) thumbs.set(key, renderThumb(i.id, i.tono, 44, i.acabado ?? null).toDataURL());
        const b = el('button', { type: 'button', class: 'ep-item ep-inroom__item', 'aria-pressed': String(i.uid === selected), 'aria-label': text }, el('img', { src: thumbs.get(key), alt: '', width: 44, height: 44, draggable: 'false' }), el('span', { text: `${nameOf(i)}${fixed ? ' ★' : ''}` }));
        b.addEventListener('click', () => {
          if (!decorating) setDecorating(true);
          select(i.uid);
          canvas.focus({ preventScroll: true });
        });
        return el('li', {}, b);
      }),
    );
  }

  function syncBookNote() {
    const zona = editable ? zonaLibro(room) : null;
    bookNote.hidden = !zona?.invasores.length;
    if (!bookNote.hidden) bookNoteText.textContent = `El libro de lectura comparte sitio con: ${zona.invasores.map((i) => catalogItem(i.id).nombre.toLowerCase()).join(', ')}.`;
  }

  function commit(next, message) {
    room = next;
    syncBookNote();
    settleActor();
    rebake();
    refreshUi();
    requestDraw();
    if (message) say(message);
    onChange(room);
  }

  function select(uid) {
    selected = uid;
    actionRow.hidden = true;
    rebake();
    refreshUi();
    requestDraw();
    if (uid) {
      const item = room.items.find((i) => i.uid === uid);
      sfx.play('lift');
      say(`${shownName(item)}: arrástralo para moverlo.`);
    }
  }

  function fail(reason, con) {
    sfx.play('invalid');
    say(reasonText(reason, con));
  }

  const addError = (id, error) => (error === 'sitio' && catalogItem(id).capa === 'encima' ? 'apoyo' : error);

  function noCopies(id) {
    sfx.play('invalid');
    say(`No te quedan más: ${catalogItem(id).nombre.toLowerCase()} ya está en tu piso. Guárdalo para ponerlo en otro sitio.`);
  }

  function add(id, acabado = null) {
    if (isRetirado(id)) {
      sfx.play('invalid');
      return say(`${catalogItem(id).nombre}: retirado por ahora de la decoración. Sigue en tu inventario.`);
    }
    if (freeCopies(inv, room, id, acabado) <= 0) return noCopies(id);
    const res = addItem(room, id, { near: { x: ROOM.w / 2, y: ROOM.d / 2 }, acabado });
    if (res.error) return fail(addError(id, res.error));
    sfx.play('place');
    selected = res.item.uid;
    commit(res.room, `${catalogItem(id).nombre} en tu piso. Arrástralo a su sitio.`);
    onEvent('nuevo');
  }

  function apply(res, message, sound = 'place') {
    if (res.error) return fail(res.error, res.con);
    sfx.play(sound);
    commit(res.room, message);
  }

  bookNoteBtn.addEventListener('click', () => {
    const res = dejarSitioAlLibro(room);
    if (res.error) {
      sfx.play('invalid');
      return say('No queda otra superficie libre: mueve o guarda algo y vuelve a probar.');
    }
    sfx.play('place');
    commit(res.room, `Hecho: ${res.movidos.map((i) => nameOf(i)).join(', ')} se ha movido y el libro ya tiene su sitio.`);
  });

  function setDecorating(on) {
    decorating = on;
    root.classList.toggle('is-decorating', on);
    panel.hidden = !on;
    decorateBtn.querySelector('.px-btn__text').textContent = on ? 'Terminar' : 'Decorar';
    setIcon(decorateBtn, on ? 'listo' : 'decorar');
    decorateBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      syncBookNote();
      fillGrid();
      say('Decorando: arrastra algo de la balda o toca un mueble.');
      requestDraw();
    } else {
      select(null);
      say('Tu piso está guardado.');
    }
  }

  // ── Puntero en la habitación ──
  function toArt(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * ART_W, y: ((e.clientY - rect.top) / rect.height) * ART_H };
  }

  function overCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  }

  /** Dónde caería `item` (de la habitación `base`) con el dedo en `a`, teniendo en cuenta dónde se agarró. */
  function targetAt(item, a, grab, base = room) {
    const cat = catalogItem(item.id);
    if (cat.capa === 'pared') {
      const w = renderer.wallAt(a.x, a.y);
      if (!w) return null;
      const max = wallLength(w.pared) - cat.w;
      return { pared: w.pared, a: Math.max(0, Math.min(max, Math.round(w.s - (grab && w.pared === item.pared ? grab.s : cat.w / 2)))) };
    }
    const rc = rectOf(item);
    const fw = rc.x1 - rc.x0;
    const fd = rc.y1 - rc.y0;
    let g = renderer.groundAt(a.x, a.y);
    if (cat.capa === 'encima') {
      // Sobre qué mueble está el dedo: se prueba cada superficie, de la más alta a la más baja
      const bases = base.items.filter((o) => catalogItem(o.id).capa === 'suelo' && catalogItem(o.id).sup).sort((p, q) => catalogItem(q.id).sup - catalogItem(p.id).sup);
      for (const b of bases) {
        const p = renderer.groundAt(a.x, a.y, catalogItem(b.id).sup);
        const br = rectOf(b);
        if (p.x >= br.x0 && p.x <= br.x1 && p.y >= br.y0 && p.y <= br.y1) {
          g = p;
          break;
        }
      }
    }
    const x = Math.round(g.x - (grab ? grab.x : fw / 2));
    const y = Math.round(g.y - (grab ? grab.y : fd / 2));
    return { x: Math.max(0, Math.min(ROOM.w - fw, x)), y: Math.max(0, Math.min(ROOM.d - fd, y)) };
  }

  function grabOf(item, a) {
    const cat = catalogItem(item.id);
    if (cat.capa === 'pared') {
      const w = renderer.wallAt(a.x, a.y);
      return { s: w && w.pared === item.pared ? w.s - item.a : cat.w / 2 };
    }
    const g = renderer.groundAt(a.x, a.y, heightOf(room, item));
    const rc = rectOf(item);
    const gx = g.x - item.x;
    const gy = g.y - item.y;
    return { x: Math.max(0, Math.min(rc.x1 - rc.x0, gx)), y: Math.max(0, Math.min(rc.y1 - rc.y0, gy)) };
  }

  function previewAt(item, target, base = room) {
    if (!target) return { room: base, item, ok: false, reason: 'fuera' };
    const res = moveItem(base, item.uid, target);
    if (!res.error) return { room: res.room, item: res.room.items.find((i) => i.uid === item.uid), ok: true };
    // En la celda del libro no: se ofrece el sitio válido más cercano, y se ve ya donde caería
    if (res.error === 'libro') {
      const spot = sitioValido(base, item);
      const near = spot ? moveItem(base, item.uid, spot) : null;
      if (near && !near.error) return { room: near.room, item: near.room.items.find((i) => i.uid === item.uid), ok: true, aside: true };
    }
    // No cabe: se enseña igualmente donde caería (con su contorno en rojo) y lo de encima con él
    const moved = { ...item, ...target };
    const dx = (moved.x ?? 0) - (item.x ?? 0);
    const dy = (moved.y ?? 0) - (item.y ?? 0);
    const tops = new Set(itemsOn(base, item.uid).map((i) => i.uid));
    const shown = { ...base, items: base.items.map((i) => (i.uid === item.uid ? moved : tops.has(i.uid) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) };
    return { room: shown, item: moved, ok: false, reason: res.error, con: res.con };
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (dressing) return;
    const a = toArt(e);
    let uid = renderer.pick(a.x, a.y);
    // Volver a tocar en el mismo punto sigue con lo de detrás, aunque por delante haya otra cosa
    if (stackTaps && selected && stack && Math.hypot(a.x - stack.a.x, a.y - stack.a.y) <= STACK_SLOP && stack.peeled.has(uid)) uid = selected;
    // Tocar a tu personaje abre su armario en la balda
    if (uid === ACTOR_ID) {
      if (!editable) return say('Vive aquí.');
      e.preventDefault();
      openWardrobe();
      return;
    }
    if (!editable || !decorating) {
      if (!uid) {
        // En tu piso, tocar el suelo lo lleva andando hasta allí
        if (editable) walkToGround(a);
        return;
      }
      const item = room.items.find((i) => i.uid === uid);
      const cat = catalogItem(item.id);
      const n = liked?.megusta?.[uid] ?? 0;
      const hearts = n ? ` · ${n === 1 ? '1 me gusta' : `${n} me gusta`}` : '';
      say(cat.accion === 'libreria' && onAction ? `${cat.nombre}: toca «Ordenar la estantería» para jugar.` : `${cat.nombre}${hearts}`);
      actionRow.replaceChildren();
      actionRow.hidden = true;
      // En el piso de un vecino: «Me gusta» a ese mueble (si los «me gusta» aún no han llegado, sale al llegar)
      likeShown = !editable && onLike ? uid : null;
      if (likeShown && liked) {
        actionRow.append(likeButton(uid));
        actionRow.hidden = false;
      }
      if (cat.accion === 'libreria' && onAction) {
        const go = el('button', { type: 'button', class: 'px-btn px-btn--sage' }, el('span', { class: 'px-btn__text', text: 'Ordenar la estantería' }));
        go.addEventListener('click', () => onAction(item));
        actionRow.append(go);
        actionRow.hidden = false;
      }
      // Y en tu piso va hacia el mueble (en un asiento, se sienta o se tumba)
      if (editable) walkToItem(item, a);
      return;
    }
    e.preventDefault();
    if (!uid && !selected && me) {
      // Decorando sin nada elegido, tocar un hueco también lo lleva andando
      walkToGround(a);
      return;
    }
    // Ya elegido se arrastra sin esperar (1.81: mantener pulsado siempre costaba demasiado); elegirlo es el seguro
    const held = Boolean(uid) && uid === selected;
    if (uid && uid !== selected) {
      // Si se toca algo de encima del elegido, se elige eso (para poder quitar la lámpara de la mesa)
      select(uid);
    } else if (!uid && selected) {
      // Tocar un hueco con algo elegido lo suelta (desde la 1.78 ya no lo lleva allí: era fácil moverlo sin querer)
      select(null);
      say('Toca un mueble para elegirlo; después, arrástralo para moverlo.');
      return;
    } else if (!uid) {
      return;
    }
    const item = room.items.find((i) => i.uid === selected);
    const d = { uid: selected, at: a, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, armed: held, held, timer: 0, moved: false, grab: grabOf(item, a), preview: null };
    // Sin elegir, se levanta al rato de mantenerlo pulsado: entonces se ve en la mano, en su sitio, y ya se puede arrastrar
    if (!held) d.timer = setTimeout(() => {
      if (drag !== d) return;
      d.armed = true;
      d.preview = previewAt(item, targetAt(item, a, d.grab));
      root.classList.add('is-lifting');
      sfx.play('lift');
      say(`${nameOf(item)} en la mano: arrástralo a su sitio nuevo.`);
      requestDraw();
    }, HOLD_MS);
    drag = d;
    canvas.setPointerCapture?.(e.pointerId);
  }

  // Muebles superpuestos: lo de delante no deja tocar lo de detrás. Se dibuja sin lo ya elegido para ver qué hay debajo de
  // ese punto exacto, y otro toque en el mismo sitio lo elige; al acabarse, vuelve al de delante.
  function underAt(a, peeled) {
    renderer.bake(room, [...peeled].flatMap((uid) => group(uid)));
    const uid = renderer.pick(a.x, a.y);
    rebake();
    return uid && uid !== ACTOR_ID ? uid : 0;
  }
  function stackTap(d) {
    const same = stack && Math.hypot(d.at.x - stack.a.x, d.at.y - stack.a.y) <= STACK_SLOP;
    if (!d.held || !same) stack = { a: d.at, peeled: new Set() };
    stack.peeled.add(d.uid);
    const next = underAt(stack.a, stack.peeled);
    if (!d.held) {
      if (next) say(`${nameOf(room.items.find((i) => i.uid === d.uid))}. Detrás hay ${nameOf(room.items.find((i) => i.uid === next)).toLowerCase()}: otro toque aquí lo elige.`);
      return;
    }
    if (next) {
      select(next);
      return;
    }
    // Se ha acabado la pila: otra vez el de delante
    const first = [...stack.peeled][0];
    stack = { a: d.at, peeled: new Set() };
    if (first && first !== d.uid) select(first);
  }

  function endDrag() {
    if (drag) clearTimeout(drag.timer);
    drag = null;
    root.classList.remove('is-dragging', 'is-lifting');
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const far = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (!drag.armed) {
      // Se ha movido antes de levantarlo: no era para moverlo
      if (far > HOLD_SLOP_PX) {
        const item = room.items.find((i) => i.uid === drag.uid);
        endDrag();
        say(`Para mover ${nameOf(item).toLowerCase()}, tócalo y luego arrástralo.`);
      }
      return;
    }
    if (!drag.moved && far < DRAG_PX) return;
    if (!drag.moved && drag.held) sfx.play('lift');
    drag.moved = true;
    root.classList.add('is-dragging');
    const item = room.items.find((i) => i.uid === drag.uid);
    drag.preview = previewAt(item, targetAt(item, toArt(e), drag.grab));
    requestDraw();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    endDrag();
    if (!d.moved) {
      // Levantado y soltado sin moverlo: se queda donde estaba
      if (d.armed) requestDraw();
      if (stackTaps) stackTap(d);
      return;
    }
    const item = room.items.find((i) => i.uid === d.uid);
    if (d.preview?.ok) {
      sfx.play('place');
      commit(d.preview.room, d.preview.aside ? `${nameOf(item)} queda al lado: ese hueco es del libro.` : `${nameOf(item)} en su sitio nuevo.`);
      onEvent('mover');
    } else {
      sfx.play('back');
      say(`${reasonText(d.preview?.reason ?? 'fuera', d.preview?.con)} ${nameOf(item)} vuelve a su sitio.`);
      requestDraw();
    }
  }

  function onPointerCancel() {
    endDrag();
    requestDraw();
  }

  // ── De la balda al piso ──
  // En la balda, deslizar de lado la recorre; tirar hacia arriba (hacia la habitación) saca el mueble.
  function onShelfDown(e, id, btn, acabado = null) {
    if (e.button !== undefined && e.button !== 0) return;
    // Sin copias libres no se saca (el clic lo explica)
    if (freeCopies(inv, room, id, acabado) <= 0) return;
    fresh = { id, acabado, btn, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, base: null, preview: null, over: false };
    window.addEventListener('pointermove', onShelfMove);
    window.addEventListener('pointerup', onShelfUp);
    window.addEventListener('pointercancel', onShelfCancel);
  }

  function onShelfMove(e) {
    if (!fresh || e.pointerId !== fresh.pointerId) return;
    const dx = e.clientX - fresh.x0;
    const dy = e.clientY - fresh.y0;
    if (!fresh.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      // De lado es recorrer la balda (lo hace el navegador): no es un arrastre
      if (Math.abs(dx) > Math.abs(dy) * 1.2) return endShelf();
      const res = addItem(room, fresh.id, { near: { x: ROOM.w / 2, y: ROOM.d / 2 }, acabado: fresh.acabado });
      if (res.error) {
        fail(addError(fresh.id, res.error));
        return endShelf();
      }
      fresh.moved = true;
      // Lo elegido se suelta: ahora manda el mueble nuevo
      if (selected) {
        selected = null;
        rebake();
        refreshUi();
      }
      fresh.base = res;
      fresh.btn.dataset.dragged = '1';
      fresh.btn.releasePointerCapture?.(e.pointerId);
      ghost.src = thumbs.get(fresh.acabado ? `${fresh.id}@${fresh.acabado}` : fresh.id);
      ghost.hidden = false;
      root.classList.add('is-dragging');
      sfx.play('lift');
      say(`${catalogItem(fresh.id).nombre}: suéltalo en tu piso.`);
    }
    e.preventDefault();
    fresh.over = overCanvas(e);
    ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 52}px)`;
    ghost.classList.toggle('is-over', fresh.over);
    if (fresh.over) {
      const { room: withIt, item } = fresh.base;
      const target = targetAt(item, toArt(e), null, withIt);
      fresh.preview = previewAt(item, target, withIt);
    } else fresh.preview = null;
    requestDraw();
  }

  function onShelfUp(e) {
    if (!fresh || e.pointerId !== fresh.pointerId) return;
    const f = fresh;
    endShelf();
    if (!f.moved) return;
    const name = catalogItem(f.id).nombre;
    if (f.over && f.preview?.ok) {
      sfx.play('place');
      selected = f.preview.item.uid;
      commit(f.preview.room, f.preview.aside ? `${name} queda al lado: ese hueco es del libro.` : `${name} en tu piso.`);
      onEvent('nuevo');
    } else if (f.over && f.preview) {
      fail(f.preview.reason, f.preview.con);
      say(`${reasonText(f.preview.reason, f.preview.con)} ${name} vuelve a la balda.`);
    } else {
      sfx.play('back');
      say(`${name} vuelve a la balda.`);
    }
    // El clic que sigue al soltar no debe añadir otro (si no llega, se olvida)
    setTimeout(() => delete f.btn.dataset.dragged, 0);
  }

  function onShelfCancel() {
    endShelf();
  }

  function endShelf() {
    fresh = null;
    ghost.hidden = true;
    root.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onShelfMove);
    window.removeEventListener('pointerup', onShelfUp);
    window.removeEventListener('pointercancel', onShelfCancel);
    requestDraw();
  }

  // ── Teclado ──
  function nudge(dx, dy) {
    const item = room.items.find((i) => i.uid === selected);
    if (!item) return;
    const cat = catalogItem(item.id);
    let target;
    if (cat.capa === 'pared') {
      const step = item.pared === 'fondo' ? dx : dy;
      if (!step) return;
      target = { a: item.a + step };
    } else target = { x: item.x + dx, y: item.y + dy };
    const res = moveItem(room, item.uid, target);
    apply(res, `${nameOf(item)} movido.`, 'lift');
    if (!res.error) onEvent('mover');
  }

  function onKey(e) {
    if (!editable || !decorating) return;
    const keys = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (keys[e.key] && selected) {
      e.preventDefault();
      nudge(...keys[e.key]);
    } else if ((e.key === 'r' || e.key === 'R') && selected) rotate();
    else if ((e.key === 'c' || e.key === 'C') && selected) recolor();
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      store();
    } else if (e.key === 'Escape' && selected) {
      e.preventDefault();
      select(null);
      say('Listo.');
    }
  }

  function rotate() {
    const item = room.items.find((i) => i.uid === selected);
    apply(rotateItem(room, selected), `${nameOf(item)} girado.`, 'lift');
  }
  function recolor() {
    const res = recolorItem(room, selected);
    apply(res, res.room ? `${nameOf(res.room.items.find((i) => i.uid === selected))}: ${TONE_NAMES[res.room.items.find((i) => i.uid === selected).tono]}.` : '', 'lift');
    if (!res.error) onEvent('color');
  }
  function store() {
    const item = room.items.find((i) => i.uid === selected);
    const res = removeItem(room, selected);
    if (res.error) return fail(res.error);
    selected = null;
    sfx.play('back');
    commit(res.room, `${nameOf(item)} guardado.`);
  }

  const onLight = () => {
    isEvening = !isEvening;
    lightBtn.setAttribute('aria-pressed', String(isEvening));
    setIcon(lightBtn, isEvening ? 'luna' : 'sol');
    root.classList.toggle('is-evening', isEvening);
    fit();
    say(isEvening ? 'Luz de tarde: se encienden las lámparas.' : 'Luz de día.');
    requestDraw();
    if (isEvening && editable) onEvent('tarde');
  };
  const onToday = () => toggleToday();
  const onDecorate = () => setDecorating(!decorating);
  const onDone = () => {
    select(null);
    say('Listo.');
  };
  // Vista «dentro»: el aviso y la acción van sobre la habitación; en la normal, debajo
  function setInside(on) {
    isInside = on;
    root.classList.toggle('ep--inside', on);
    if (on) overlay.append(actionRow, status);
    else {
      stage.after(status);
      (editable ? panel : listBox).after(actionRow);
    }
    fit();
  }

  // En la vista «dentro», el dibujo llena el escenario sin deformarse (el resto es telón); en la normal, todo el ancho
  function fit() {
    if (dressing) {
      stage.style.backgroundImage = '';
      stageBack = '';
      frameDressing();
      return;
    }
    if (!isInside) {
      canvas.style.width = '';
      canvas.style.height = '';
      stage.style.backgroundImage = '';
      stageBack = '';
      return;
    }
    const k = Math.min(stage.clientWidth / ART_W, stage.clientHeight / ART_H);
    if (!k) return;
    canvas.style.width = `${Math.floor(ART_W * k)}px`;
    canvas.style.height = `${Math.floor(ART_H * k)}px`;
    // El telón de la página, tramado con píxeles del mismo tamaño que los del dibujo
    const bw = Math.ceil(stage.clientWidth / k);
    const bh = Math.ceil(stage.clientHeight / k);
    const key = `${bw}x${bh}:${isEvening}`;
    if (key !== stageBack) {
      stageBack = key;
      stage.style.backgroundImage = `url(${backdropImage(bw, bh, isEvening)})`;
    }
  }

  // Si cambia el sitio (girar el móvil, abrir la balda), el dibujo se ajusta y las herramientas se recolocan
  const resize =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          fit();
          requestDraw();
        })
      : null;
  resize?.observe(stage);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('keydown', onKey);
  lightBtn.addEventListener('click', onLight);
  todayBtn.addEventListener('click', onToday);
  decorateBtn.addEventListener('click', onDecorate);
  wardrobeBtn.addEventListener('click', () => openWardrobe());
  rotateBtn.addEventListener('click', rotate);
  colorBtn.addEventListener('click', recolor);
  storeBtn.addEventListener('click', store);
  doneBtn.addEventListener('click', onDone);
  readyBtn.addEventListener('click', () => closeWardrobe(true));
  if (editable) root.append(dock);

  spawnActor();
  fillToday();
  if (look) outfitTab.src = actorThumb(look, 'head');
  rebake();
  refreshUi();
  root.classList.toggle('is-evening', isEvening);
  setInside(inside);
  render();
  say(editable ? 'Tu piso. Toca «Decorar» para colocar muebles.' : `${label}. Puedes mirar, pero no tocar nada.`);
  if (editable && decorate) setDecorating(true);
  if (editable && placeId && catalogItem(placeId)) {
    if (!decorating) setDecorating(true);
    const before = room;
    add(placeId, placeAcabado);
    if (room !== before) say(`Ya está en tu piso: arrastra ${catalogItem(placeId).nombre.toLowerCase()} a su sitio. «Guardar» devuelve el mueble a tu inventario.`);
  }
  scheduleWander();

  // Solo para las pruebas: un punto del dibujo donde `top` tapa a `under` (o, sin `under`, uno de `top`)
  const stackProbe = (top, under) => {
    const uidOf = (id) => room.items.find((it) => it.id === id)?.uid;
    const a = uidOf(top);
    const b = under && uidOf(under);
    const points = [];
    for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) if (renderer.pick(x, y) === a) points.push({ x, y });
    let found = points[Math.floor(points.length / 2)] ?? null;
    if (b) {
      renderer.bake(room, group(a));
      found = points.find((q) => renderer.pick(q.x, q.y) === b) ?? null;
      rebake();
    }
    return found && { ...found, w: canvas.width, h: canvas.height };
  };

  return {
    ...(import.meta.env.DEV ? { stackProbe, placed: (id) => room.items.find((it) => it.id === id) } : {}),
    /** Elige un objeto desde fuera, como si se hubiera tocado. */
    selectItem(uid) {
      if (!decorating) setDecorating(true);
      select(uid);
    },
    get room() {
      return room;
    },
    get selected() {
      return selected;
    },
    /** Dónde está el personaje y qué hace (para las pruebas): { x, y, pose, facing, seat } o null. */
    get actor() {
      return me ? { x: me.x, y: me.y, pose: me.pose, facing: me.facing, seat: me.seat } : null;
    },
    get avatar() {
      return look;
    },
    setMuted(v) {
      sfx.setMuted(v);
    },
    setInside,
    /** El armario (1.77): abrirlo, y cerrarlo guardando («Listo») o dejándolo como estaba. */
    openWardrobe,
    closeWardrobe,
    get dressing() {
      return !!dressing;
    },
    /** Cambia el inventario (llega del servidor, o tras elegir los de inicio) y rehace la balda. */
    /** Las prendas ganadas (llegan del servidor, o al ganar una) y rehace el armario. */
    /** Un aviso en la línea de estado de la habitación (p. ej., una misión hecha). */
    notify(text) {
      say(text);
    },
    setPrendas(next) {
      owned = next;
      fillWardrobe();
    },
    /** Los «me gusta» del piso (llegan del servidor, o tras darle a uno). */
    setLikes(next) {
      liked = next;
      if (!likeShown || !liked || !room.items.some((i) => i.uid === likeShown)) return;
      const old = actionRow.querySelector('.ep-like');
      if (old) old.replaceWith(likeButton(likeShown));
      else actionRow.prepend(likeButton(likeShown));
      actionRow.hidden = false;
    },
    /** Las misiones del día (o null) y la próxima prenda. */
    setMissions(next) {
      // La hoja se abre sola con lo recién ganado: la prenda o, con todo el armario, los tickets (1.79)
      const won = (next?.ganada && next.ganada !== today?.ganada) || (next?.tickets > 0 && !(today?.tickets > 0));
      today = next;
      fillToday();
      if (won) toggleToday(true);
    },
    setInventory(next) {
      inv = conBasicos(next);
      if (!editable) return;
      syncMisticTab();
      fillGrid();
    },
    /** El legendario que te acompaña (llega del servidor; null: nadie). */
    setCompanion(id) {
      pal = COMPANEROS.some((c) => c.id === id) ? id : null;
      if (me && pal) buddy.update(me, 1);
      fillWardrobe();
      requestDraw();
    },
    /** Para las pruebas: punto de la pantalla donde se ve un objeto (el centro de sus píxeles) o un punto del mundo. */
    screenOfItem(uid) {
      const ids = renderer.raster.ids;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < ids.length; i += 1) {
        if ((ids[i] & 0x7fff) !== uid) continue;
        sx += i % ART_W;
        sy += (i / ART_W) | 0;
        n += 1;
      }
      if (!n) return null;
      return this.artToScreen(sx / n + 0.5, sy / n + 0.5);
    },
    screenOf(x, y, z = 0) {
      const p = renderer.project(x, y, z);
      return this.artToScreen(p.sx, p.sy);
    },
    artToScreen(ax, ay) {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (ax / ART_W) * rect.width, y: rect.top + (ay / ART_H) * rect.height };
    },
    check: (item) => check(room, item),
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (anim) cancelAnimationFrame(anim);
      if (life) cancelAnimationFrame(life);
      clearTimeout(wanderTimer);
      document.removeEventListener('keydown', onDressKey);
      window.removeEventListener('resize', measureDressing);
      endShelf();
      resize?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('keydown', onKey);
      sfx.destroy();
      ghost.remove();
      root.remove();
    },
  };
}
