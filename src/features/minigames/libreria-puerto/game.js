// «La librería del puerto» (prototipo, solo desarrollo): montaje del minijuego en un contenedor. Separa reglas
// (puzzle.js), dibujo (scene.js + raster.js), controles (aquí), audio (audio.js) y recompensas (fuera: el juego solo
// informa con `onEvent`). Se carga solo al abrirlo y `destroy()` lo deja todo como estaba: sin bucles, escuchadores,
// temporizadores ni contexto de audio colgando.
//
// Controles: arrastrar un libro y soltarlo; o tocarlo y tocar después el destino; «Girar» (o R) cambia de pie a
// tumbado. Teclado en el lienzo: ←/→ eligen libro o columna, ↑/↓ eligen balda o caja, Intro/Espacio coge y deja, R gira,
// Escape suelta sin mover, Z deshace.
import './game.css';
import { createSfx } from './audio';
import { canLift, createGame, dropAt, exportState, footprint, hint as nextHint, minMoves, place, reset as resetGame, restoreState, returnToCrate, shelfFull, stars, undo as undoMove } from './puzzle';
import { ART_H, ART_W, GEO, bookBox, crateBox, createScene } from './scene';

const REASON = {
  fuera: 'No cabe ahí.',
  solape: 'Ahí ya hay otro libro.',
  flota: 'Quedaría en el aire: tiene que apoyarse entero.',
  encima: 'Primero quita el libro que tiene encima.',
};
const SETTLE_MS = 140;
const RETURN_MS = 220;
const GLOW_MS = 900;
const HINT_MS = 4000;
const LAMP_MS = 900;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const easeOut = (t) => 1 - (1 - t) ** 3;
const lerpBox = (a, b, t) => ({ ...b, x0: a.x0 + (b.x0 - a.x0) * t, x1: a.x1 + (b.x1 - a.x1) * t, y0: a.y0 + (b.y0 - a.y0) * t, y1: a.y1 + (b.y1 - a.y1) * t, z0: a.z0 + (b.z0 - a.z0) * t, z1: a.z1 + (b.z1 - a.z1) * t });

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children);
  return node;
}

/**
 * Monta el juego. `level`: un nivel de levels.js; `mode`: 'practica' | 'reto'; `saved`: estado exportado (opcional);
 * `mode`: 'practica', 'reto' o 'semanal' (el nivel de la semana: cuenta para el ranking y no tiene pistas);
 * `onEvent({ type, level, mode, moves, stars })` con 'start', 'exit' y 'win' (la victoria, una sola vez por partida;
 * `stars` y `jugadas` solo en 'win': con las jugadas el servidor podría repetir y comprobar la partida);
 * `onNext`: si se pasa, el final ofrece «Siguiente nivel».
 */
export function mountLibreria(container, { level, mode = 'practica', saved = null, muted = false, onEvent = () => {}, onNext = null } = {}) {
  const sfx = createSfx({ muted });
  const scene = createScene(level);
  const { layout } = scene;
  const libroOf = (id) => level.libros.find((b) => b.id === id);
  let game = (saved && restoreState(level, saved)) || createGame(level);
  // La victoria se anuncia una sola vez por partida (un estado restaurado ya ganado no la repite)
  let announced = game.won;
  let held = null; // { id, orient, kind: 'drag' | 'select' | 'key', px, py, lift, target }
  let pending = null; // pulsación aún sin decidir si es toque o arrastre
  let cursor = 0; // libro enfocado con el teclado
  let keyTarget = null; // { shelf: índice o 'caja', column }
  let usingKeys = false; // el contorno del foco de teclado solo se ve si se está usando el teclado
  let hits = [];
  let hints = 0; // pistas pedidas en esta partida (quitan la tercera estrella)
  const ranked = mode === 'semanal';
  let hintShown = null; // { libro, target, ok, t0 }
  let lampT0 = game.won ? 0 : null; // la lámpara se enciende al terminar (la librería abre)
  const anims = new Map(); // id → { from, to, t0, dur }
  const glows = []; // { shelf, t0 }
  let raf = 0;
  let destroyed = false;
  const still = reducedMotion();

  // ── Interfaz HTML (accesible y legible; la escena va en el lienzo) ──
  const helpId = `lp-help-${Math.random().toString(36).slice(2, 8)}`;
  const canvas = el('canvas', { class: 'lp-canvas', width: ART_W, height: ART_H, tabindex: 0, role: 'application', 'aria-roledescription': 'estantería', 'aria-label': `La librería del puerto: ${level.nombre}`, 'aria-describedby': helpId });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(ART_W, ART_H);
  const status = el('p', { class: 'lp-status', role: 'status', 'aria-live': 'polite' });
  const count = el('p', { class: 'lp-count' });
  const rotateBtn = el('button', { type: 'button', class: 'lp-btn lp-btn--rotate', 'aria-keyshortcuts': 'R', disabled: true }, 'Girar');
  const undoBtn = el('button', { type: 'button', class: 'lp-btn', 'aria-keyshortcuts': 'Z' }, 'Deshacer');
  const resetBtn = el('button', { type: 'button', class: 'lp-btn' }, 'Reiniciar');
  const hintBtn = el('button', { type: 'button', class: 'lp-btn' }, 'Pista');
  const soundBtn = el('button', { type: 'button', class: 'lp-btn lp-btn--sound', 'aria-pressed': String(!muted) }, muted ? 'Sonido: no' : 'Sonido: sí');
  const doneText = el('p', { class: 'lp-done__text' });
  const starsEl = el('p', { class: 'lp-stars', role: 'img' });
  const starsList = el('ul', { class: 'lp-stars__list' });
  const againBtn = el('button', { type: 'button', class: 'lp-btn lp-btn--primary' }, 'Volver a jugar');
  const nextBtn = el('button', { type: 'button', class: 'lp-btn lp-btn--primary' }, 'Siguiente nivel');
  const done = el('div', { class: 'lp-done', hidden: true, role: 'group', 'aria-label': 'Nivel completado' }, el('p', { class: 'lp-done__title', text: '¡Estantería lista!' }), starsEl, doneText, starsList, el('div', { class: 'lp-done__actions' }, againBtn, ...(onNext ? [nextBtn] : [])));
  const help = el(
    'details',
    { class: 'lp-help' },
    el('summary', { text: 'Cómo se juega' }),
    el(
      'ul',
      { id: helpId },
      el('li', { text: 'Arrastra un libro de la caja a una balda y suéltalo donde encaje. También puedes tocarlo y tocar después el sitio.' }),
      el('li', { text: '«Girar» (o la tecla R) cambia el libro de pie a tumbado. Los libros se apoyan enteros: nada queda en el aire.' }),
      el('li', { text: 'Puedes mover libros ya colocados o devolverlos a la caja. Deshacer y Reiniciar no tienen castigo.' }),
      el('li', { text: `Estrellas: una por terminar, dos si lo haces en el mínimo + 2 movimientos y tres en el mínimo exacto (un movimiento por libro) sin pistas. Deshacer cuenta como movimiento.` }),
      el('li', { text: 'Con teclado: ←/→ eligen libro o columna, ↑/↓ la balda o la caja, Intro coge y deja, Escape suelta sin mover, Z deshace.' }),
    ),
  );
  const root = el(
    'section',
    { class: 'lp', 'aria-label': 'La librería del puerto', 'data-mode': mode },
    el('header', { class: 'lp-head' }, el('h2', { class: 'lp-title', text: level.nombre }), el('p', { class: 'lp-goal', text: level.objetivo }), count),
    el('div', { class: 'lp-stage' }, canvas),
    status,
    el('div', { class: 'lp-tools', role: 'group', 'aria-label': 'Acciones' }, rotateBtn, undoBtn, ...(ranked ? [] : [hintBtn]), resetBtn, soundBtn),
    done,
    help,
  );
  container.append(root);

  // ── Tamaño: escala entera de píxeles del dispositivo (como Pixel Plays), adaptada al ancho del móvil ──
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, root.clientWidth || container.clientWidth || ART_W);
    const height = Math.max(ART_H, window.innerHeight * 0.66);
    const scale = Math.max(1, Math.floor(Math.min(width / ART_W, height / ART_H) * dpr)) / dpr;
    canvas.style.width = `${ART_W * scale}px`;
    canvas.style.height = `${ART_H * scale}px`;
  }
  // Solo cuentan los cambios de ancho del contenedor o del alto de la ventana: el alto del contenedor cambia con el
  // propio juego (texto de estado, final) y no debe reajustar el lienzo ni cancelar un arrastre
  let lastSize = '';
  const resize = new ResizeObserver(() => {
    const size = `${container.clientWidth}x${window.innerHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    fit();
    // Cambiar de tamaño durante un gesto lo cancela sin perder el libro
    if (held?.kind === 'drag') cancelHeld();
  });
  resize.observe(container);

  // ── Dibujo bajo demanda: solo hay bucle mientras algo se mueve ──
  function boxOf(id) {
    const p = game.placed[id];
    return p ? bookBox(layout, libroOf(id), p) : crateBox(layout, libroOf(id));
  }
  function heldBox() {
    const libro = libroOf(held.id);
    const { w, h } = footprint(libro, held.orient);
    if (held.kind === 'drag') {
      const at = scene.unprojectOnPlaneY(held.px, held.py - held.lift, GEO.bookY1);
      return { x0: at.x - w / 2, x1: at.x + w / 2 - GEO.gap, y0: GEO.bookY0, y1: GEO.bookY1, z0: at.z, z1: at.z + h, orient: held.orient };
    }
    // Seleccionado: elevado en su sitio (con su orientación nueva si se ha girado)
    const b = boxOf(held.id);
    const x0 = b.x0;
    return { x0, x1: x0 + w - GEO.gap, y0: b.y0, y1: b.y1, z0: b.z0 + (still ? 0.15 : 0.35), z1: b.z0 + (still ? 0.15 : 0.35) + h, orient: held.orient };
  }
  function render(now = performance.now()) {
    raf = 0;
    if (destroyed) return;
    let moving = false;
    const animated = (id) => {
      const a = anims.get(id);
      if (!a) return boxOf(id);
      const t = Math.min(1, (now - a.t0) / a.dur);
      if (t >= 1) {
        anims.delete(id);
        return boxOf(id);
      }
      moving = true;
      return lerpBox(a.from, a.to, easeOut(t));
    };
    const books = [];
    const inCrate = [];
    for (const libro of level.libros) {
      if (held?.id === libro.id) continue;
      (game.placed[libro.id] ? books : inCrate).push({ libro, box: animated(libro.id), faded: false });
    }
    for (let i = glows.length - 1; i >= 0; i -= 1) if (now - glows[i].t0 > GLOW_MS) glows.splice(i, 1);
    const glow = glows.map((g) => ({ shelf: g.shelf, k: Math.min(1, (now - g.t0) / (GLOW_MS * 0.5)) }));
    if (glow.length) moving = true;
    if (hintShown && now - hintShown.t0 > HINT_MS) hintShown = null;
    if (hintShown) moving = true;
    const hintPreview = hintShown && !held ? { box: bookBox(layout, libroOf(hintShown.libro), hintShown.target), ok: true } : null;
    const preview = held?.target && held.target.where !== 'caja' ? { box: bookBox(layout, libroOf(held.id), held.target.target), ok: held.target.ok } : hintPreview;
    let light = 0;
    if (lampT0 !== null) {
      light = still || !lampT0 ? 1 : Math.min(1, (now - lampT0) / LAMP_MS);
      if (light < 1) moving = true;
    }
    const keyCursor = usingKeys && !held && document.activeElement === canvas && !game.won ? level.libros[cursor]?.id : null;
    if (keyCursor) {
      // El foco del teclado: el contorno continuo sobre el libro elegido
      hits = scene.draw(ctx, image, { books, inCrate, preview: { box: boxOf(keyCursor), ok: true }, glow, held: null, light });
    } else {
      hits = scene.draw(ctx, image, { books, inCrate, preview, glow, held: held ? { libro: libroOf(held.id), box: heldBox() } : null, light });
    }
    if (moving) schedule();
  }
  function schedule() {
    if (!raf && !destroyed && document.visibilityState !== 'hidden') raf = requestAnimationFrame(render);
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      cancelAnimationFrame(raf);
      raf = 0;
      if (held?.kind === 'drag') cancelHeld();
    } else schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ── Estado y avisos ──
  function say(text) {
    status.textContent = text;
  }
  function refreshUi() {
    const placed = level.libros.filter((b) => game.placed[b.id]).length;
    count.textContent = `${placed} de ${level.libros.length} libros · ${game.moves} ${game.moves === 1 ? 'movimiento' : 'movimientos'} · mínimo ${minMoves(level)}`;
    rotateBtn.disabled = !held || game.won;
    undoBtn.disabled = game.won || !game.history.length;
    hintBtn.disabled = game.won;
    done.hidden = !game.won;
    root.dataset.won = game.won ? 'true' : 'false';
    if (game.won) {
      const st = stars(level, game, { hints });
      doneText.textContent = `Todos los libros en su sitio, en ${game.moves} movimientos. La librería abre.`;
      starsEl.textContent = '★'.repeat(st.total) + '☆'.repeat(3 - st.total);
      starsEl.setAttribute('aria-label', `${st.total} de 3 estrellas`);
      starsList.replaceChildren(
        el('li', { text: '✓ Estantería completa' }),
        el('li', { 'data-ok': String(st.total >= 2), text: `${st.total >= 2 ? '✓' : '·'} En ${st.min + 2} movimientos o menos` }),
        el('li', { 'data-ok': String(st.total === 3), text: `${st.total === 3 ? '✓' : '·'} En ${st.min} (el mínimo)${ranked ? '' : ' y sin pistas'}` }),
      );
    }
  }
  function emit(type) {
    onEvent({ type, level: level.id, mode, moves: game.moves, ...(type === 'win' ? { stars: stars(level, game, { hints }).total, jugadas: game.jugadas } : {}) });
  }
  function commit(next, from, id) {
    if (next === game) return false;
    const before = game;
    game = next;
    hintShown = null;
    // Acomodarse: del sitio del que viene al nuevo, breve
    if (!still && from) anims.set(id, { from, to: boxOf(id), t0: performance.now(), dur: SETTLE_MS });
    for (const s of layout.shelves) {
      if (!shelfFull(level, before, s.id) && shelfFull(level, game, s.id)) {
        if (!still) glows.push({ shelf: s, t0: performance.now() });
        sfx.play('shelf');
      }
    }
    if (game.won && !announced) {
      announced = true;
      lampT0 = performance.now();
      sfx.play('win');
      say('¡Estantería lista! Todos los libros están en su sitio.');
      emit('win');
    }
    refreshUi();
    schedule();
    return true;
  }

  // ── Coger, mover y dejar ──
  function describe(id) {
    const b = libroOf(id);
    return `«${b.titulo}» (${b.grosor} × ${b.alto})`;
  }
  function take(id, kind, px = 0, py = 0, lift = 0) {
    if (game.won) return false;
    const can = canLift(level, game, id);
    if (!can.ok) {
      sfx.play('invalid');
      say(REASON[can.reason]);
      return false;
    }
    held = { id, orient: game.placed[id]?.orient ?? 'pie', kind, px, py, lift, target: null };
    hintShown = null;
    sfx.play('lift');
    say(`${describe(id)} en la mano${kind === 'key' ? ': ←/→ columna, ↑/↓ balda, R gira, Intro deja' : ''}.`);
    refreshUi();
    schedule();
    return true;
  }
  /** Destino bajo un punto del lienzo (en píxeles del arte): balda y columna con gravedad, o la caja. */
  function targetAt(px, py) {
    const libro = libroOf(held.id);
    const { w } = footprint(libro, held.orient);
    const at = scene.unprojectOnPlaneY(px, py, GEO.bookY1);
    let best = null;
    for (const s of layout.shelves) {
      const dist = at.z < s.z0 - 0.9 ? Infinity : at.z > s.z0 + s.alto + 0.3 ? Infinity : Math.abs(at.z - (s.z0 + s.alto / 2));
      if (dist < (best?.dist ?? Infinity)) best = { shelf: s, dist };
    }
    if (best && at.x > -1.2 && at.x < layout.caseX1 + 1.2) {
      const column = Math.round(at.x - best.shelf.x0 - w / 2);
      const drop = dropAt(level, game, held.id, best.shelf.id, column, held.orient);
      return { where: 'balda', ...drop };
    }
    if (at.z < GEO.base - 0.4) return { where: 'caja', ok: true, reason: null };
    return null;
  }
  function settleHeld(target) {
    const id = held.id;
    const from = heldBox();
    let next = game;
    if (target?.where === 'caja') next = returnToCrate(level, game, id);
    else if (target?.ok) next = place(level, game, id, target.target);
    held = null;
    if (target?.where === 'caja' && !game.placed[id]) {
      // Ya estaba en la caja: vuelve a su hueco
      if (!still) anims.set(id, { from, to: boxOf(id), t0: performance.now(), dur: RETURN_MS });
      sfx.play('back');
      say(`${describe(id)} sigue en la caja.`);
      refreshUi();
      schedule();
      return;
    }
    if (commit(next, from, id)) {
      if (!game.won) {
        sfx.play(target.where === 'caja' ? 'back' : 'place');
        say(target.where === 'caja' ? `${describe(id)} vuelve a la caja.` : `${describe(id)} colocado.`);
      }
      return;
    }
    // No vale: vuelve suavemente a su sitio y el tablero no cambia
    if (!still) anims.set(id, { from, to: boxOf(id), t0: performance.now(), dur: RETURN_MS });
    sfx.play('invalid');
    say(target ? REASON[target.reason] ?? 'Ahí no encaja.' : 'Suéltalo sobre una balda o en la caja.');
    refreshUi();
    schedule();
  }
  function cancelHeld() {
    if (!held) return;
    const id = held.id;
    if (!still && held.kind === 'drag') anims.set(id, { from: heldBox(), to: boxOf(id), t0: performance.now(), dur: RETURN_MS });
    held = null;
    pending = null;
    keyTarget = null;
    say(`${describe(id)} vuelve a su sitio.`);
    refreshUi();
    schedule();
  }
  function rotate() {
    if (!held || game.won) return;
    held.orient = held.orient === 'pie' ? 'tumbado' : 'pie';
    if (held.kind === 'drag') held.target = targetAt(held.px, held.py - held.lift);
    if (held.kind === 'key') updateKeyTarget();
    say(`${describe(held.id)} ${held.orient === 'pie' ? 'de pie' : 'tumbado'}.`);
    refreshUi();
    schedule();
  }

  // ── Puntero: arrastrar, o tocar y tocar ──
  const toArt = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * ART_W) / r.width, y: ((e.clientY - r.top) * ART_H) / r.height, scale: r.width / ART_W };
  };
  /** El libro bajo el punto, con holgura: el área de toque es más grande que el libro dibujado. */
  function pick(x, y, slack) {
    let best = null;
    for (const h of hits) {
      if (x < h.x0 - slack || x > h.x1 + slack || y < h.y0 - slack || y > h.y1 + slack) continue;
      const d = Math.hypot(x - (h.x0 + h.x1) / 2, y - (h.y0 + h.y1) / 2);
      if (!best || d < best.d) best = { id: h.id, d };
    }
    return best?.id ?? null;
  }
  function onPointerDown(e) {
    usingKeys = false;
    if (game.won || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = toArt(e);
    const slack = Math.max(3, 10 / p.scale); // ≈ 10 px de pantalla alrededor de cada libro
    if (held && held.kind !== 'drag') {
      // Ya hay uno elegido: este toque es el destino (o elige otro libro, o lo suelta si es el mismo)
      const other = pick(p.x, p.y, 0);
      if (other === held.id) {
        cancelHeld();
        return;
      }
      if (other && !game.placed[other] && game.placed[held.id] === null) {
        held = null;
        take(other, 'select');
        return;
      }
      settleHeld(targetAt(p.x, p.y));
      return;
    }
    const id = pick(p.x, p.y, slack);
    if (!id) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture?.(e.pointerId);
    pending = { id, x: p.x, y: p.y, pointerId: e.pointerId, touch: e.pointerType !== 'mouse', scale: p.scale };
  }
  function onPointerMove(e) {
    const p = toArt(e);
    if (pending && pending.pointerId === e.pointerId) {
      if (Math.hypot(p.x - pending.x, p.y - pending.y) * pending.scale < 8) return;
      // Arrastre: el libro se eleva y va por encima del dedo (más alto con el dedo que con el ratón)
      const lift = (pending.touch ? 44 : 10) / pending.scale;
      const id = pending.id;
      pending = null;
      if (!take(id, 'drag', p.x, p.y, lift)) return;
    }
    if (held?.kind === 'drag') {
      held.px = p.x;
      held.py = p.y;
      held.target = targetAt(p.x, p.y - held.lift);
      schedule();
    }
  }
  function onPointerUp(e) {
    if (pending && pending.pointerId === e.pointerId) {
      // Toque sin arrastre: elegir el libro (tocar y tocar)
      const id = pending.id;
      pending = null;
      take(id, 'select');
      return;
    }
    if (held?.kind === 'drag') settleHeld(held.target);
  }
  function onPointerCancel() {
    pending = null;
    if (held?.kind === 'drag') cancelHeld();
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onPointerCancel);

  // ── Teclado ──
  function keyTargets() {
    return [...layout.shelves.map((s, i) => ({ shelf: i })), { shelf: 'caja' }];
  }
  function updateKeyTarget() {
    if (!held || !keyTarget) return;
    if (keyTarget.shelf === 'caja') {
      held.target = { where: 'caja', ok: true, reason: null };
      return;
    }
    const s = layout.shelves[keyTarget.shelf];
    held.target = { where: 'balda', ...dropAt(level, game, held.id, s.id, keyTarget.column, held.orient) };
    keyTarget.column = held.target.target.x;
  }
  function announceKeyTarget() {
    const t = held?.target;
    if (!t) return;
    if (t.where === 'caja') say('Destino: la caja.');
    else {
      const s = layout.shelves[keyTarget.shelf];
      say(`Balda ${s.id}, columna ${t.target.x + 1}${t.target.y ? `, encima (fila ${t.target.y + 1})` : ''}: ${t.ok ? 'encaja' : REASON[t.reason]}`);
    }
  }
  function onKey(e) {
    if (game.won) return;
    if (e.key !== 'Tab') usingKeys = true;
    const k = e.key;
    if (k === 'r' || k === 'R') {
      e.preventDefault();
      rotate();
      if (held?.kind === 'key') announceKeyTarget();
      return;
    }
    if ((k === 'z' || k === 'Z') && !held) {
      e.preventDefault();
      doUndo();
      return;
    }
    if (k === 'Escape') {
      if (held) {
        e.preventDefault();
        e.stopPropagation();
        cancelHeld();
      }
      return;
    }
    if (!held) {
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault();
        cursor = (cursor + (k === 'ArrowRight' ? 1 : -1) + level.libros.length) % level.libros.length;
        const id = level.libros[cursor].id;
        say(`${describe(id)}, ${game.placed[id] ? `en la balda ${game.placed[id].balda}` : 'en la caja'}. Intro para cogerlo.`);
        schedule();
      } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        const id = level.libros[cursor].id;
        if (take(id, 'key')) {
          const p = game.placed[id];
          keyTarget = p ? { shelf: layout.shelves.findIndex((s) => s.id === p.balda), column: p.x } : { shelf: 0, column: 0 };
          updateKeyTarget();
          announceKeyTarget();
          schedule();
        }
      }
      return;
    }
    if (held.kind !== 'key') return;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      if (keyTarget.shelf !== 'caja') keyTarget.column += k === 'ArrowRight' ? 1 : -1;
      updateKeyTarget();
      announceKeyTarget();
      schedule();
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      const list = keyTargets();
      const i = list.findIndex((t) => t.shelf === keyTarget.shelf);
      const next = list[Math.max(0, Math.min(list.length - 1, i + (k === 'ArrowDown' ? 1 : -1)))];
      keyTarget = { shelf: next.shelf, column: keyTarget.column ?? 0 };
      updateKeyTarget();
      announceKeyTarget();
      schedule();
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      const t = held.target;
      keyTarget = null;
      settleHeld(t);
    }
  }
  canvas.addEventListener('keydown', onKey);
  const onFocusChange = () => schedule();
  canvas.addEventListener('focus', onFocusChange);
  canvas.addEventListener('blur', onFocusChange);

  // ── Botones ──
  function doUndo() {
    if (held) cancelHeld();
    if (commit(undoMove(level, game), null, null)) {
      sfx.play('back');
      say('Deshecho.');
    }
  }
  function doReset(silent = false) {
    held = null;
    pending = null;
    keyTarget = null;
    anims.clear();
    glows.length = 0;
    game = resetGame(level);
    announced = false;
    hints = 0;
    hintShown = null;
    lampT0 = null;
    refreshUi();
    if (!silent) {
      say('Nivel reiniciado: todos los libros vuelven a la caja.');
      emit('start');
    }
    schedule();
  }
  rotateBtn.addEventListener('click', () => {
    rotate();
    canvas.focus({ preventScroll: true });
  });
  undoBtn.addEventListener('click', doUndo);
  hintBtn.addEventListener('click', () => {
    if (game.won) return;
    if (held) cancelHeld();
    const h = nextHint(level, game);
    if (!h) return;
    hints += 1;
    hintShown = { ...h, t0: performance.now() };
    const t = h.target;
    say(`Pista: ${describe(h.libro)} va en la balda ${t.balda}, columna ${t.x + 1}${t.orient === 'tumbado' ? ', tumbado' : ''}${t.y ? ', encima de otro' : ''}.${h.ok ? '' : ' Antes tendrás que hacerle sitio.'}`);
    schedule();
  });
  resetBtn.addEventListener('click', () => doReset());
  soundBtn.addEventListener('click', () => {
    sfx.setMuted(!sfx.muted);
    soundBtn.textContent = sfx.muted ? 'Sonido: no' : 'Sonido: sí';
    soundBtn.setAttribute('aria-pressed', String(!sfx.muted));
  });
  againBtn.addEventListener('click', () => doReset());
  nextBtn.addEventListener('click', () => onNext?.());

  fit();
  scene.bake();
  refreshUi();
  say(game.won ? '¡Estantería lista!' : 'Arrastra un libro de la caja a la estantería.');
  render();
  emit('start');

  return {
    root,
    /** Estado serializable con versión (el puzle; nada de recompensas). */
    exportState: () => exportState(game),
    get state() {
      return game;
    },
    /** Para pruebas y depuración: cuántos fotogramas pendientes y contextos de audio hay. */
    debug: () => ({ raf: raf ? 1 : 0, audio: sfx.open, held: held ? held.id : null, hits: hits.map((h) => ({ ...h })) }),
    /** Para pruebas: dónde cae en pantalla (px CSS) un punto del mundo sobre la cara frontal de una balda. */
    screenOf(balda, x, y) {
      const s = layout.shelves.find((v) => v.id === balda);
      const p = scene.project(s.x0 + x, GEO.bookY1, s.z0 + y);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (p.sx * r.width) / ART_W, y: r.top + (p.sy * r.height) / ART_H };
    },
    artToScreen(ax, ay) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (ax * r.width) / ART_W, y: r.top + (ay * r.height) / ART_H };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      resize.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('lostpointercapture', onPointerCancel);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('focus', onFocusChange);
      canvas.removeEventListener('blur', onFocusChange);
      sfx.destroy();
      root.remove();
      emit('exit');
    },
  };
}
