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
import { CATALOG, CATEGORIES, PAREDES, SETS, SUELOS, catalogItem } from './catalog';
import { freeCopies, ownedCopies } from './inventory';
import { houseSwatch, pixelIcon, pixelVars } from './pixelUi';
import { ART_H, ART_W, backdropImage, createRoomRenderer, renderThumb } from './render';
import { ROOM, addItem, check, heightOf, itemsOn, moveItem, reasonText, recolorItem, rectOf, removeItem, rotateItem, setFloor, setWall, wallLength } from './room';

const DRAG_PX = 6;
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
 */
export function mountPiso(container, { room: initial, editable = false, evening = false, muted = true, label = 'Piso', inside = false, decorate = false, inventory = null, onChange = () => {}, onAction = null } = {}) {
  const sfx = createSfx({ muted });
  const renderer = createRoomRenderer();
  let room = initial;
  // Copias de cada mueble (1.66, §66); null: todo libre (sin la migración del inventario, o en el prototipo)
  let inv = inventory;
  let selected = null; // uid del objeto elegido
  let drag = null; // { uid, pointerId, x0, y0, moved, grab, preview: { room, item, ok, reason, con } }
  let fresh = null; // mueble que llega de la balda: { id, pointerId, x0, y0, moved, base: { room, item }, preview, over }
  let isEvening = evening;
  let decorating = false;
  let isInside = false;
  let stageBack = ''; // telón de la página en la vista «dentro» (tamaño y luz con que se pintó)
  let raf = 0;
  let destroyed = false;

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
  const overlay = el('div', { class: 'ep-overlay' });
  const stage = el('div', { class: 'ep-stage' }, canvas, lightBtn, editable ? decorateBtn : null, tools, overlay);
  const root = el('div', { class: 'ep' }, stage, status);
  for (const [k, v] of Object.entries(pixelVars())) root.style.setProperty(k, v);

  // ── La balda: catálogo, paredes y suelo ──
  const panel = el('section', { class: 'ep-panel ep-shelf', hidden: true, 'aria-label': 'Decorar tu piso' });
  let category = CATEGORIES[0].id;
  const catRow = el('div', { class: 'ep-cats', role: 'group', 'aria-label': 'Qué poner' });
  const catTitle = el('p', { class: 'ep-shelf__title', 'aria-hidden': 'true' });
  const grid = el('div', { class: 'ep-grid' });
  const wallRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Color de las paredes' });
  const floorRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Suelo' });
  // Paredes y suelo en una sola fila que se recorre de lado, como los muebles
  const house = el('div', { class: 'ep-house', hidden: true }, el('div', { class: 'ep-house__group' }, el('span', { class: 'ep-house__label', text: 'Paredes' }), wallRow), el('div', { class: 'ep-house__group' }, el('span', { class: 'ep-house__label', text: 'Suelo' }), floorRow));
  const hint = el('p', { class: 'ep-shelf__hint', text: HINT });
  // Sagas: una fila de etiquetas con el nombre de cada set; debajo, sus muebles y el guiño a quien leyó el libro
  let sagaSet = SETS[0].id;
  const setRow = el('div', { class: 'ep-sets', role: 'group', 'aria-label': 'Sets de sagas', hidden: true });
  const ghost = el('img', { class: 'ep-ghost', alt: '', width: 44, height: 44, hidden: true });
  // Lo que hay en el piso: al decorar, una pestaña más de la balda; mirando un piso ajeno, una lista plegada debajo
  const list = el('ul', { class: 'ep-inroom__list' });
  const listSummary = el('summary', {});
  const listBox = editable ? el('div', { class: 'ep-inroom', hidden: true }, list) : el('details', { class: 'ep-list' }, listSummary, list);
  const CATS = [...CATEGORIES, { id: HOUSE, nombre: 'Paredes y suelo' }, { id: INROOM, nombre: 'En el piso' }];
  // Cada pestaña lleva el dibujo de un mueble de su tipo; la de paredes y suelo, una muestra de los de tu piso
  const TAB_ICON = { asientos: 'sillon', mesas: 'mesa', luz: 'lampara-pie', plantas: 'planta-grande', detalles: 'tetera', pared: 'cuadro', alfombras: 'alfombra', sagas: 'esferas' };
  const houseTab = el('img', { class: 'ep-chip__img', alt: '', width: 33, height: 33 });

  if (editable) {
    for (const c of CATS) {
      const img = c.id === HOUSE ? houseTab : c.id === INROOM ? pixelIcon('lista') : el('img', { class: 'ep-chip__img', alt: '', width: 33, height: 33, src: renderThumb(TAB_ICON[c.id], 0, 33).toDataURL() });
      const b = el('button', { type: 'button', class: 'ep-chip', 'data-cat': c.id, 'aria-pressed': String(c.id === category), title: c.nombre }, img, el('span', { class: 'px-sr', text: c.nombre }));
      b.addEventListener('click', () => {
        category = c.id;
        for (const x of catRow.children) x.setAttribute('aria-pressed', String(x.dataset.cat === category));
        fillGrid();
      });
      catRow.append(b);
    }
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
    panel.append(el('div', { class: 'ep-shelf__head' }, catRow, catTitle), el('div', { class: 'ep-shelf__board' }, setRow, grid, house, listBox), hint);
    root.append(panel, actionRow);
    // Fuera del panel: un antepasado con transform haría que «fixed» no siguiera al dedo
    document.body.append(ghost);
  } else {
    root.append(actionRow, listBox);
  }
  container.append(root);

  const thumbs = new Map();
  function fillGrid() {
    const isHouse = category === HOUSE;
    const isList = category === INROOM;
    const set = category === SAGAS ? SETS.find((x) => x.id === sagaSet) : null;
    catTitle.textContent = isList ? `En el piso (${room.items.length})` : set ? set.nombre : CATS.find((c) => c.id === category).nombre;
    hint.textContent = set ? set.guino : HINT;
    setRow.hidden = !set;
    house.hidden = !isHouse;
    listBox.hidden = !isList;
    grid.hidden = isHouse || isList;
    hint.hidden = isHouse || isList;
    grid.replaceChildren();
    if (isHouse || isList) return;
    for (const cat of CATALOG.filter((c) => c.cat === category && (!set || c.set === set.id))) {
      // Lo que no tienes no está en tu balda (llegará con la tienda)
      if (ownedCopies(inv, cat.id) === 0) continue;
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
    if (!grid.children.length) grid.append(el('p', { class: 'ep-shelf__empty', text: 'Aún no tienes nada de esto.' }));
    grid.scrollLeft = 0;
    refreshCounts();
  }

  /** Cuántas copias te quedan de cada mueble de la balda; lo agotado se ve apagado (y no se puede sacar). */
  function refreshCounts() {
    for (const b of grid.querySelectorAll('.ep-item[data-id]')) {
      const id = b.dataset.id;
      const free = freeCopies(inv, room, id);
      const name = catalogItem(id).nombre.toLowerCase();
      const count = b.querySelector('.ep-item__count');
      count.hidden = free === Infinity;
      count.textContent = free === Infinity ? '' : `×${free}`;
      b.classList.toggle('is-out', free === 0);
      b.setAttribute('aria-label', free === Infinity ? `Añadir ${name}` : free ? `Añadir ${name} (te quedan ${free})` : `Añadir ${name} (no te quedan)`);
    }
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
    if (fresh?.preview && fresh.over) {
      // Un mueble nuevo bajo el dedo: se ve ya en la habitación, en el sitio donde caería
      const p = fresh.preview;
      renderer.draw(ctx, image, { held: { room: p.room, items: [p.item] }, selected: p.item, ok: p.ok, evening: isEvening, inside: isInside });
      placeTools(null);
      return;
    }
    const item = selected ? room.items.find((i) => i.uid === selected) : null;
    if (!item) {
      renderer.draw(ctx, image, { evening: isEvening, inside: isInside });
      placeTools(null);
      return;
    }
    const p = drag?.moved ? drag.preview : null;
    const shown = p ? p.room : room;
    const ids = new Set(group(selected));
    renderer.draw(ctx, image, { held: { room: shown, items: shown.items.filter((i) => ids.has(i.uid)) }, selected: p ? p.item : item, ok: p ? p.ok : true, evening: isEvening, inside: isInside });
    placeTools(drag?.moved ? null : item);
  }

  function requestDraw() {
    if (!raf && !destroyed) raf = requestAnimationFrame(render);
  }

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
    const item = selected ? room.items.find((i) => i.uid === selected) : null;
    tools.hidden = !item;
    // Dentro de un panel de la app, Escape suelta lo elegido en vez de cerrar el panel (PanelShell lo respeta)
    if (item && decorating) root.dataset.escapeLocal = 'open';
    else delete root.dataset.escapeLocal;
    if (item) {
      const cat = catalogItem(item.id);
      toolName.textContent = `${cat.nombre} · ${TONE_NAMES[item.tono]}`;
      rotateBtn.disabled = cat.capa === 'pared';
      colorBtn.disabled = cat.tonos.length < 2;
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
    listSummary.textContent = `En el piso (${room.items.length})`;
    if (category === INROOM) catTitle.textContent = listSummary.textContent;
    list.replaceChildren(
      ...room.items.map((i) => {
        const text = `${nameOf(i)}${i.uid === selected ? ' (elegido)' : ''}`;
        if (!editable) return el('li', { text });
        // Al decorar, cada cosa de pie en la balda con su dibujo (y su color), como en el catálogo
        const key = i.id + ':' + i.tono;
        if (!thumbs.has(key)) thumbs.set(key, renderThumb(i.id, i.tono).toDataURL());
        const b = el('button', { type: 'button', class: 'ep-item ep-inroom__item', 'aria-pressed': String(i.uid === selected), 'aria-label': text }, el('img', { src: thumbs.get(key), alt: '', width: 44, height: 44, draggable: 'false' }), el('span', { text: nameOf(i) }));
        b.addEventListener('click', () => {
          if (!decorating) setDecorating(true);
          select(i.uid);
          canvas.focus({ preventScroll: true });
        });
        return el('li', {}, b);
      }),
    );
  }

  function commit(next, message) {
    room = next;
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
      say(`${nameOf(item)}: arrástralo o toca un hueco para moverlo.`);
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

  function add(id) {
    if (freeCopies(inv, room, id) <= 0) return noCopies(id);
    const res = addItem(room, id, { near: { x: ROOM.w / 2, y: ROOM.d / 2 } });
    if (res.error) return fail(addError(id, res.error));
    sfx.play('place');
    selected = res.item.uid;
    commit(res.room, `${catalogItem(id).nombre} en tu piso. Arrástralo a su sitio.`);
  }

  function apply(res, message, sound = 'place') {
    if (res.error) return fail(res.error, res.con);
    sfx.play(sound);
    commit(res.room, message);
  }

  function setDecorating(on) {
    decorating = on;
    root.classList.toggle('is-decorating', on);
    panel.hidden = !on;
    decorateBtn.querySelector('.px-btn__text').textContent = on ? 'Terminar' : 'Decorar';
    setIcon(decorateBtn, on ? 'listo' : 'decorar');
    decorateBtn.setAttribute('aria-expanded', String(on));
    if (on) {
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
    const a = toArt(e);
    const uid = renderer.pick(a.x, a.y);
    if (!editable || !decorating) {
      if (!uid) return;
      const item = room.items.find((i) => i.uid === uid);
      const cat = catalogItem(item.id);
      say(cat.accion === 'libreria' && onAction ? `${cat.nombre}: toca «Ordenar la estantería» para jugar.` : cat.nombre);
      actionRow.replaceChildren();
      actionRow.hidden = true;
      if (cat.accion === 'libreria' && onAction) {
        const go = el('button', { type: 'button', class: 'px-btn px-btn--sage' }, el('span', { class: 'px-btn__text', text: 'Ordenar la estantería' }));
        go.addEventListener('click', () => onAction(item));
        actionRow.append(go);
        actionRow.hidden = false;
      }
      return;
    }
    e.preventDefault();
    if (uid && uid !== selected) {
      // Si se toca algo de encima del elegido, se elige eso (para poder quitar la lámpara de la mesa)
      select(uid);
    } else if (!uid && selected) {
      // Tocar un hueco con algo elegido lo lleva allí
      const item = room.items.find((i) => i.uid === selected);
      const p = previewAt(item, targetAt(item, a, null));
      if (p.ok) {
        sfx.play('place');
        commit(p.room, `${nameOf(item)} en su sitio nuevo.`);
      } else fail(p.reason, p.con);
      return;
    } else if (!uid) {
      return;
    }
    const item = room.items.find((i) => i.uid === selected);
    drag = { uid: selected, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, grab: grabOf(item, a), preview: null };
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_PX) return;
    drag.moved = true;
    root.classList.add('is-dragging');
    const item = room.items.find((i) => i.uid === drag.uid);
    drag.preview = previewAt(item, targetAt(item, toArt(e), drag.grab));
    requestDraw();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (!d.moved) return;
    const item = room.items.find((i) => i.uid === d.uid);
    if (d.preview?.ok) {
      sfx.play('place');
      commit(d.preview.room, `${nameOf(item)} en su sitio nuevo.`);
    } else {
      sfx.play('back');
      say(`${reasonText(d.preview?.reason ?? 'fuera', d.preview?.con)} ${nameOf(item)} vuelve a su sitio.`);
      requestDraw();
    }
  }

  function onPointerCancel() {
    drag = null;
    root.classList.remove('is-dragging');
    requestDraw();
  }

  // ── De la balda al piso ──
  // En la balda, deslizar de lado la recorre; tirar hacia arriba (hacia la habitación) saca el mueble.
  function onShelfDown(e, id, btn) {
    if (e.button !== undefined && e.button !== 0) return;
    // Sin copias libres no se saca (el clic lo explica)
    if (freeCopies(inv, room, id) <= 0) return;
    fresh = { id, btn, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, base: null, preview: null, over: false };
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
      const res = addItem(room, fresh.id, { near: { x: ROOM.w / 2, y: ROOM.d / 2 } });
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
      ghost.src = thumbs.get(fresh.id);
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
      commit(f.preview.room, `${name} en tu piso.`);
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
    apply(moveItem(room, item.uid, target), `${nameOf(item)} movido.`, 'lift');
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
  };
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
  decorateBtn.addEventListener('click', onDecorate);
  rotateBtn.addEventListener('click', rotate);
  colorBtn.addEventListener('click', recolor);
  storeBtn.addEventListener('click', store);
  doneBtn.addEventListener('click', onDone);

  rebake();
  refreshUi();
  root.classList.toggle('is-evening', isEvening);
  setInside(inside);
  render();
  say(editable ? 'Tu piso. Toca «Decorar» para colocar muebles.' : `${label}. Puedes mirar, pero no tocar nada.`);
  if (editable && decorate) setDecorating(true);

  return {
    get room() {
      return room;
    },
    get selected() {
      return selected;
    },
    setMuted(v) {
      sfx.setMuted(v);
    },
    setInside,
    /** Cambia el inventario (llega del servidor, o tras elegir los de inicio) y rehace la balda. */
    setInventory(next) {
      inv = next;
      if (editable) fillGrid();
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
