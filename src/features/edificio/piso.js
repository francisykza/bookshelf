// Montaje de un piso de «El edificio del puerto» (1.63, SPEC §63): el tuyo, para decorarlo, o el de un
// vecino, solo para mirar. Reglas en room.js, dibujo en render.js. `destroy()` lo deja todo como estaba.
//
// Controles al decorar: tocar un mueble lo elige; arrastrarlo lo mueve (si al soltar no cabe, vuelve a su sitio); con
// uno elegido, tocar un hueco lo lleva allí. «Girar», «Color» y «Guardar» actúan sobre el elegido. Teclado en el lienzo:
// flechas para moverlo (→ y ← a lo largo de la pared del fondo, ↑ y ↓ a lo largo de la de la izquierda), R gira, C
// cambia el color, Supr lo guarda y Escape lo suelta. La lista «En el piso» elige cualquier cosa sin tocar el dibujo.
import './edificio.css';
import { createSfx } from '../minigames/libreria-puerto/audio';
import { CATALOG, CATEGORIES, PAREDES, SUELOS, catalogItem } from './catalog';
import { ART_H, ART_W, createRoomRenderer, renderThumb } from './render';
import { ROOM, addItem, check, heightOf, itemsOn, moveItem, reasonText, recolorItem, rectOf, removeItem, rotateItem, setFloor, setWall, wallLength } from './room';

const DRAG_PX = 6;
const TONE_NAMES = ['tono 1', 'tono 2', 'tono 3', 'tono 4', 'tono 5'];

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
 */
export function mountPiso(container, { room: initial, editable = false, evening = false, muted = true, label = 'Piso', onChange = () => {}, onAction = null } = {}) {
  const sfx = createSfx({ muted });
  const renderer = createRoomRenderer();
  let room = initial;
  let selected = null; // uid del objeto elegido
  let drag = null; // { uid, pointerId, x0, y0, moved, grab, preview: { room, item, ok, reason, con } }
  let isEvening = evening;
  let decorating = false;
  let raf = 0;
  let destroyed = false;

  const canvas = el('canvas', { class: 'ep-canvas', width: ART_W, height: ART_H, tabindex: 0, role: 'application', 'aria-roledescription': 'habitación', 'aria-label': label });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(ART_W, ART_H);
  const status = el('p', { class: 'ep-status', role: 'status', 'aria-live': 'polite' });
  const lightBtn = el('button', { type: 'button', class: 'ep-btn ep-btn--ghost', 'aria-pressed': String(isEvening) }, 'Luz de tarde');
  const actionRow = el('div', { class: 'ep-action', hidden: true });
  const stage = el('div', { class: 'ep-stage' }, canvas);
  const root = el('div', { class: 'ep' }, stage, status);

  // ── Herramientas del objeto elegido ──
  const toolName = el('p', { class: 'ep-tools__name' });
  const rotateBtn = el('button', { type: 'button', class: 'ep-btn', 'aria-keyshortcuts': 'R' }, 'Girar');
  const colorBtn = el('button', { type: 'button', class: 'ep-btn', 'aria-keyshortcuts': 'C' }, 'Color');
  const storeBtn = el('button', { type: 'button', class: 'ep-btn', 'aria-keyshortcuts': 'Delete' }, 'Guardar');
  const doneBtn = el('button', { type: 'button', class: 'ep-btn ep-btn--primary', 'aria-keyshortcuts': 'Escape' }, 'Listo');
  const tools = el('div', { class: 'ep-tools', hidden: true }, toolName, el('div', { class: 'ep-tools__row' }, rotateBtn, colorBtn, storeBtn, doneBtn));

  // ── Catálogo, pared y suelo ──
  const decorateBtn = el('button', { type: 'button', class: 'ep-btn ep-btn--primary', 'aria-expanded': 'false' }, 'Decorar');
  const bar = el('div', { class: 'ep-bar' }, editable ? decorateBtn : null, lightBtn);
  const panel = el('section', { class: 'ep-panel', hidden: true, 'aria-label': 'Decorar tu piso' });
  let category = CATEGORIES[0].id;
  const catRow = el('div', { class: 'ep-cats', role: 'group', 'aria-label': 'Tipo de mueble' });
  const grid = el('div', { class: 'ep-grid' });
  const wallRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Color de las paredes' });
  const floorRow = el('div', { class: 'ep-swatches', role: 'group', 'aria-label': 'Suelo' });
  const listBox = el('details', { class: 'ep-list' });
  const listSummary = el('summary', {});
  const list = el('ul', {});
  listBox.append(listSummary, list);

  if (editable) {
    for (const c of CATEGORIES) {
      const b = el('button', { type: 'button', class: 'ep-chip', 'data-cat': c.id, 'aria-pressed': String(c.id === category) }, c.nombre);
      b.addEventListener('click', () => {
        category = c.id;
        for (const x of catRow.children) x.setAttribute('aria-pressed', String(x.dataset.cat === category));
        fillGrid();
      });
      catRow.append(b);
    }
    for (const p of PAREDES) {
      const b = el('button', { type: 'button', class: 'ep-swatch', 'data-pared': p.id, style: `--sw: rgb(${p.color.join(' ')})` }, p.nombre);
      b.addEventListener('click', () => commit(setWall(room, p.id), `Paredes: ${p.nombre.toLowerCase()}.`));
      wallRow.append(b);
    }
    for (const s of SUELOS) {
      const b = el('button', { type: 'button', class: 'ep-swatch ep-swatch--floor', 'data-suelo': s.id }, s.nombre);
      b.addEventListener('click', () => commit(setFloor(room, s.id), `Suelo: ${s.nombre.toLowerCase()}.`));
      floorRow.append(b);
    }
    panel.append(el('h3', { class: 'ep-panel__title', text: 'Añadir' }), catRow, grid, el('h3', { class: 'ep-panel__title', text: 'Paredes' }), wallRow, el('h3', { class: 'ep-panel__title', text: 'Suelo' }), floorRow);
    root.append(tools, bar, panel, listBox, actionRow);
  } else {
    root.append(bar, actionRow, listBox);
  }
  container.append(root);

  const thumbs = new Map();
  function fillGrid() {
    grid.replaceChildren();
    for (const cat of CATALOG.filter((c) => c.cat === category)) {
      if (!thumbs.has(cat.id)) thumbs.set(cat.id, renderThumb(cat.id).toDataURL());
      const b = el('button', { type: 'button', class: 'ep-item', 'aria-label': `Añadir ${cat.nombre.toLowerCase()}`, 'data-id': cat.id }, el('img', { src: thumbs.get(cat.id), alt: '', width: 44, height: 44 }), el('span', { text: cat.nombre }));
      b.addEventListener('click', () => add(cat.id));
      grid.append(b);
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
    const item = selected ? room.items.find((i) => i.uid === selected) : null;
    if (!item) {
      renderer.draw(ctx, image, { evening: isEvening });
      return;
    }
    const p = drag?.moved ? drag.preview : null;
    const shown = p ? p.room : room;
    const ids = new Set(group(selected));
    renderer.draw(ctx, image, { held: { room: shown, items: shown.items.filter((i) => ids.has(i.uid)) }, selected: p ? p.item : item, ok: p ? p.ok : true, evening: isEvening });
  }

  function requestDraw() {
    if (!raf && !destroyed) raf = requestAnimationFrame(render);
  }

  function refreshUi() {
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
    for (const b of wallRow.children) b.setAttribute('aria-pressed', String(b.dataset.pared === room.pared));
    for (const b of floorRow.children) b.setAttribute('aria-pressed', String(b.dataset.suelo === room.suelo));
    listSummary.textContent = `En el piso (${room.items.length})`;
    list.replaceChildren(
      ...room.items.map((i) => {
        const text = `${nameOf(i)}${i.uid === selected ? ' (elegido)' : ''}`;
        if (!editable) return el('li', { text });
        const b = el('button', { type: 'button', class: 'ep-list__btn', 'aria-pressed': String(i.uid === selected) }, text);
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

  function add(id) {
    const res = addItem(room, id, { near: { x: ROOM.w / 2, y: ROOM.d / 2 } });
    if (res.error) return fail(res.error === 'sitio' && catalogItem(id).capa === 'encima' ? 'apoyo' : res.error);
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
    decorateBtn.textContent = on ? 'Terminar' : 'Decorar';
    decorateBtn.setAttribute('aria-expanded', String(on));
    if (on) {
      fillGrid();
      say('Decorando: elige algo del catálogo o toca un mueble.');
    } else {
      select(null);
      say('Tu piso está guardado.');
    }
  }

  // ── Puntero ──
  function toArt(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * ART_W, y: ((e.clientY - rect.top) / rect.height) * ART_H };
  }

  /** Dónde caería el objeto elegido con el dedo en `a` (teniendo en cuenta dónde se agarró). */
  function targetAt(item, a, grab) {
    const cat = catalogItem(item.id);
    if (cat.capa === 'pared') {
      const w = renderer.wallAt(a.x, a.y);
      if (!w) return null;
      const max = wallLength(w.pared) - cat.w;
      return { pared: w.pared, a: Math.max(0, Math.min(max, Math.round(w.s - (w.pared === item.pared ? grab.s : cat.w / 2)))) };
    }
    const rc = rectOf(item);
    const fw = rc.x1 - rc.x0;
    const fd = rc.y1 - rc.y0;
    let g = renderer.groundAt(a.x, a.y);
    if (cat.capa === 'encima') {
      // Sobre qué mueble está el dedo: se prueba cada superficie, de la más alta a la más baja
      const bases = room.items.filter((o) => catalogItem(o.id).capa === 'suelo' && catalogItem(o.id).sup).sort((p, q) => catalogItem(q.id).sup - catalogItem(p.id).sup);
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

  function previewAt(item, target) {
    if (!target) return { room, item, ok: false, reason: 'fuera' };
    const res = moveItem(room, item.uid, target);
    if (!res.error) return { room: res.room, item: res.room.items.find((i) => i.uid === item.uid), ok: true };
    // No cabe: se enseña igualmente donde caería (con su contorno en rojo) y lo de encima con él
    const moved = { ...item, ...target };
    const dx = (moved.x ?? 0) - (item.x ?? 0);
    const dy = (moved.y ?? 0) - (item.y ?? 0);
    const tops = new Set(itemsOn(room, item.uid).map((i) => i.uid));
    const shown = { ...room, items: room.items.map((i) => (i.uid === item.uid ? moved : tops.has(i.uid) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) };
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
        const go = el('button', { type: 'button', class: 'ep-btn ep-btn--primary' }, 'Ordenar la estantería');
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
    const item = room.items.find((i) => i.uid === drag.uid);
    drag.preview = previewAt(item, targetAt(item, toArt(e), drag.grab));
    requestDraw();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
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
    say(isEvening ? 'Luz de tarde: se encienden las lámparas.' : 'Luz de día.');
    requestDraw();
  };
  const onDecorate = () => setDecorating(!decorating);
  const onDone = () => {
    select(null);
    say('Listo.');
  };

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
  render();
  say(editable ? 'Tu piso. Toca «Decorar» para colocar muebles.' : `${label}. Puedes mirar, pero no tocar nada.`);

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
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('keydown', onKey);
      sfx.destroy();
      root.remove();
    },
  };
}
