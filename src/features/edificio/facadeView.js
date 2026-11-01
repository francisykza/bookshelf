// La fachada montada en la página (SPEC §64): el dibujo de facade.js y, encima, un botón por ventana (con su placa:
// puerta y quién vive). Al tocar una ventana, la vista se acerca a ella (te asomas) y entras; al volver, se aleja
// desde esa misma ventana. Con movimiento reducido, sin animación. Lo usan el panel de la app y la página de desarrollo.
import { FACADE_H, FACADE_W, renderFacade } from './facade';

const pct = (v) => `${(v * 100).toFixed(3)}%`;
const ZOOM = 3.4;
const ZOOM_MS = 520;
const ARRIVE_MS = 1100;

// La última ventana a la que te asomaste: al volver al portal, la vista se aleja desde ella
let lastPeek = null;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const centerOf = (w) => `${pct(w.left + w.width / 2)} ${pct(w.top + w.height * 0.45)}`;
const box = (node, r) => Object.assign(node.style, { left: pct(r.left), top: pct(r.top), width: pct(r.width), height: pct(r.height) });

/** Las estrellas ya pintadas: píxeles claros y sueltos en la parte de arriba (con el cielo alrededor). */
function findStars(canvas, max = 14) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i] * 0.3 + data[i + 1] * 0.55 + data[i + 2] * 0.15;
  };
  const found = [];
  for (let y = 2; y < h * 0.4; y += 1)
    for (let x = 1; x < w - 1; x += 1) {
      if (lum(x, y) > 200 && lum(x - 1, y) < 140 && lum(x + 1, y) < 140 && lum(x, y - 1) < 140 && lum(x, y + 1) < 140) found.push({ x, y });
    }
  // Unas pocas, repartidas (siempre las mismas: el dibujo no cambia)
  const step = Math.max(1, Math.floor(found.length / max));
  return found.filter((_, i) => i % step === 0).slice(0, max);
}

/** Una gaviota de píxeles, dos fotogramas (alas arriba y abajo) en una tira. */
function gullSprite() {
  const frames = [
    ['#.......#', '.##...##.', '...#.#...', '....#....'],
    ['.........', '.........', '###.#.###', '...###...'],
  ];
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6eee0';
  frames.forEach((rows, f) => rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && ctx.fillRect(f * 9 + x, y, 1, 1))));
  return c.toDataURL();
}

/** Destellos del agua: rayitas de 2 a 4 píxeles en una tesela de 40 × 12 que se repite. */
function glintSprite() {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 12;
  const ctx = c.getContext('2d');
  const dashes = [[3, 1, 3, '#ffe2b0'], [21, 3, 2, '#fff0d0'], [33, 6, 4, '#ffd9a0'], [11, 8, 2, '#fff0d0'], [26, 10, 3, '#ffe2b0']];
  for (const [x, y, w, color] of dashes) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
  }
  return c.toDataURL();
}

/**
 * La vida de la fachada (1.65): estrellas que titilan, un brillo que corre por el agua, la luz de las ventanas habitadas
 * que respira y, de vez en cuando, una gaviota. Solo CSS sobre el dibujo; con movimiento reducido, nada (lo quita el CSS).
 */
function ambientLayer(canvas, { panes, shore }) {
  const layer = document.createElement('div');
  layer.className = 'ed-ambient';
  layer.setAttribute('aria-hidden', 'true');
  // Un píxel del dibujo, en unidades del contenedor (la fachada)
  layer.style.setProperty('--px', `${(100 / FACADE_W).toFixed(4)}cqw`);
  for (const [k, s] of findStars(canvas).entries()) {
    const star = document.createElement('span');
    star.className = 'ed-star';
    box(star, { left: s.x / FACADE_W, top: s.y / FACADE_H, width: 1 / FACADE_W, height: 1 / FACADE_H });
    star.style.animationDelay = `${-((k * 1.37) % 5).toFixed(2)}s`;
    star.style.animationDuration = `${3 + (k % 4) * 0.9}s`;
    layer.append(star);
  }
  for (const [k, p] of panes.entries()) {
    const glow = document.createElement('span');
    glow.className = 'ed-glow';
    box(glow, p);
    glow.style.animationDelay = `${-((k * 2.3) % 7).toFixed(2)}s`;
    layer.append(glow);
  }
  const water = document.createElement('span');
  water.className = 'ed-water';
  const [a, b] = shore;
  water.style.backgroundImage = `url(${glintSprite()})`;
  water.style.clipPath = `polygon(${pct(a.x)} ${pct(a.y)}, ${pct(b.x)} ${pct(b.y)}, 100% 100%, 0 100%)`;
  layer.append(water);
  const gull = document.createElement('span');
  gull.className = 'ed-gull';
  gull.style.backgroundImage = `url(${gullSprite()})`;
  layer.append(gull);
  return layer;
}

/**
 * `flats`: [{ puerta, room, label (aria), name (placa), mine, badge, onOpen }] de las puertas ocupadas. Devuelve
 * { destroy }.
 */
export function mountFacade(container, { flats }) {
  const byDoor = Object.fromEntries(flats.map((f) => [f.puerta, { room: f.room }]));
  const { canvas, windows, panes, shore, sign } = renderFacade(byDoor);
  const root = document.createElement('div');
  root.className = 'ed-facade';
  root.style.aspectRatio = `${FACADE_W} / ${FACADE_H}`;
  // Que el edificio entero quepa en la pantalla también en escritorio
  root.style.maxWidth = `min(460px, calc(78dvh * ${(FACADE_W / FACADE_H).toFixed(4)}))`;
  const stage = document.createElement('div');
  stage.className = 'ed-facade__stage';
  root.append(stage);
  let busy = false;
  canvas.className = 'ed-facade__art';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `La fachada del edificio. En la azotea, un cartel: «${sign}».`);
  stage.append(canvas, ambientLayer(canvas, { panes, shore }));

  const list = document.createElement('ul');
  list.className = 'ed-facade__flats';
  // De arriba abajo, como se lee un edificio (y como se recorren con el tabulador)
  const order = ['3A', '3B', '2A', '2B', '1A', '1B'];
  for (const puerta of order) {
    const w = windows.find((x) => x.puerta === puerta);
    const flat = flats.find((f) => f.puerta === puerta);
    const li = document.createElement('li');
    const el = document.createElement(flat ? 'button' : 'div');
    el.className = `ed-window${flat?.mine ? ' ed-window--mine' : ''}${flat ? '' : ' ed-window--free ed-door--free'}`;
    Object.assign(el.style, { left: pct(w.left), top: pct(w.top), width: pct(w.width), height: pct(w.height) });
    const plate = document.createElement('span');
    plate.className = 'ed-window__plate';
    const door = document.createElement('strong');
    door.textContent = `${puerta[0]}.º ${puerta[1]}`;
    const who = document.createElement('span');
    who.textContent = flat ? flat.name : 'Libre';
    plate.append(door, who);
    el.append(plate);
    if (flat) {
      el.type = 'button';
      el.setAttribute('aria-label', flat.label);
      el.addEventListener('click', () => {
        if (busy) return;
        lastPeek = { puerta, at: Date.now() };
        if (reducedMotion() || typeof stage.animate !== 'function') {
          flat.onOpen();
          return;
        }
        busy = true;
        root.classList.add('is-peeking');
        stage.style.transformOrigin = centerOf(w);
        const run = stage.animate([{ transform: 'scale(1)' }, { transform: `scale(${ZOOM})` }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' });
        run.finished.then(() => flat.onOpen(), () => flat.onOpen());
      });
      if (flat.badge) {
        const badge = document.createElement('span');
        badge.className = 'ed-window__badge';
        badge.textContent = flat.badge;
        el.append(badge);
      }
    } else {
      el.setAttribute('aria-label', `${puerta[0]}.º ${puerta[1]}: puerta libre`);
      el.setAttribute('role', 'img');
    }
    li.append(el);
    list.append(li);
  }
  stage.append(list);
  container.replaceChildren(root);
  // Vuelves de un piso: la vista se aleja desde su ventana
  const back = lastPeek && Date.now() - lastPeek.at < 10 * 60 * 1000 ? windows.find((x) => x.puerta === lastPeek.puerta) : null;
  lastPeek = null;
  if (back && !reducedMotion() && typeof stage.animate === 'function') {
    stage.style.transformOrigin = centerOf(back);
    stage.animate([{ transform: `scale(${ZOOM})` }, { transform: 'scale(1)' }], { duration: ZOOM_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
  } else if (!back && !reducedMotion() && typeof stage.animate === 'function') {
    // Llegas por el muelle: la vista sube desde el agua hasta el cartel y las placas aparecen al final
    root.classList.add('is-arriving');
    stage.style.transformOrigin = '50% 100%';
    const run = stage.animate(
      [
        { transform: 'scale(1.35) translateY(-4%)', filter: 'brightness(0.75)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: ARRIVE_MS, easing: 'cubic-bezier(0.25, 0.6, 0.25, 1)' },
    );
    run.finished.then(
      () => root.classList.remove('is-arriving'),
      () => root.classList.remove('is-arriving'),
    );
  }
  return {
    destroy() {
      root.remove();
    },
  };
}
