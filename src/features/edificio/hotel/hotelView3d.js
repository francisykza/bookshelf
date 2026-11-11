// La fachada del Gran Hotel en 3D en la app («Exteriores en 3D», bloque 3, 11-11-2026): la plaza del muelle de
// hotel3d.js a todo lo que da el panel, con la misma interfaz que la fachada 2D (mountHotel de hotelView.js), para que
// GranHotel.jsx no cambie de forma. Se toca una planta en la propia torre (la primera caja de ZONE_BOXES que contiene el
// punto, como en el 2D); la elegida se rodea con un filete de latón y un rombo a su izquierda, que se mueven con la
// vista. Los botones de cada planta (para el teclado) los pone GranHotel.jsx y aquí se colocan sobre su planta; al
// enfocar uno que no se ve, la vista gira hasta él. Al bajar de la limusina se aparece junto a ella, mirando la torre
// de abajo arriba, y se anda hasta la plaza. Si no hay WebGL (o se pierde), la fachada 2D de siempre.
import { ZONE_BOXES } from './hotelArt';
import { EYE_Z, SPOTS, mountHotel3d } from './hotel3d';
import { mountHotel } from './hotelView';

const SVG = 'http://www.w3.org/2000/svg';
const ARRIVE_MS = 3200;
const DOOR_MS = 2400;
// Hacia dónde mirabas al entrar en una sala: al volver, sigues mirando ahí
let lastView = null;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ¿Se puede dibujar en 3D? (sin WebGL, la fachada 2D y el viaje de siempre) */
export function canHotel3d() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const corners = ([x0, y0, z0, x1, y1, z1]) => [
  [x0, y0, z0],
  [x1, y0, z0],
  [x0, y1, z0],
  [x1, y1, z0],
  [x0, y0, z1],
  [x1, y0, z1],
  [x0, y1, z1],
  [x1, y1, z1],
];

// La envolvente convexa (cadena monótona) de unos puntos de la pantalla
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (const q of p.reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function inside(poly, x, y) {
  let c = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a, a += 1) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) c = !c;
  }
  return c;
}

/**
 * Mismas opciones y misma forma que mountHotel (hotelView.js), más `arrive` (vienes en la limusina) y `onFallback(v)`
 * (se perdió el 3D y ahora hay una fachada 2D: la vista nueva). Devuelve { canvas, zones, select, entry, goIn, destroy }.
 */
export function mountHotelView3d(host, { onPick = () => {}, still = false, t0 = 0, arrive = false, onFallback = () => {} } = {}) {
  const box = document.createElement('div');
  box.className = 'gh-3d';
  host.prepend(box);
  const outline = document.createElementNS(SVG, 'svg');
  outline.setAttribute('class', 'gh-3d__outline');
  outline.setAttribute('aria-hidden', 'true');
  host.append(outline);

  let selected = null;
  let busy = false;
  let view = null;
  // Las envolventes de cada planta en la pantalla, en este fotograma
  let shapes = [];
  const measure = () => {
    if (!view) return;
    shapes = ZONE_BOXES.map((z) => ({
      id: z.id,
      polys: z.boxes.map((b) => {
        const pts = corners(b).map(([x, y, zz]) => view.toScreen(x, y, zz));
        return { visible: pts.every((p) => p.visible), poly: hull(pts.map((p) => [p.x, p.y])) };
      }),
    }));
  };
  const w = () => box.clientWidth || 1;
  const h = () => box.clientHeight || 1;
  const center3d = (id) => {
    const b = ZONE_BOXES.find((z) => z.id === id).boxes[0];
    return { x: (b[0] + b[3]) / 2, y: Math.min(b[4], SPOTS.home.y - 3), z: (b[2] + b[5]) / 2 };
  };
  // Dónde se señala una planta: el centro de su cara de delante (o, en la plaza, el de la plaza), en fracciones del
  // lienzo y dentro de él
  const centerOf = (s) => {
    const t = center3d(s.id);
    const p = view.toScreen(t.x, t.y, t.z);
    const clip = (v) => Math.min(0.97, Math.max(0.03, v));
    return { x: clip(p.x / w()), y: clip(p.y / h()) };
  };
  const draw = () => {
    measure();
    // Los botones del teclado, cada uno sobre su planta
    for (const el of host.querySelectorAll('.gh-zone[data-zone]')) {
      const s = shapes.find((x) => x.id === el.dataset.zone);
      if (!s) continue;
      const c = centerOf(s);
      el.style.left = `${c.x * 100}%`;
      el.style.top = `${c.y * 100}%`;
    }
    outline.setAttribute('viewBox', `0 0 ${w()} ${h()}`);
    const s = selected && shapes.find((x) => x.id === selected);
    if (!s) {
      outline.replaceChildren();
      return;
    }
    const kids = [];
    for (const { poly } of s.polys) {
      const p = document.createElementNS(SVG, 'polygon');
      p.setAttribute('points', poly.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '));
      kids.push(p);
    }
    // El rombo, a la izquierda de la planta, a media altura
    const poly = s.polys[0].poly;
    const ys = poly.map((q) => q[1]);
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const x = Math.max(8, Math.min(...poly.map((q) => q[0])) - 12);
    const d = document.createElementNS(SVG, 'rect');
    d.setAttribute('x', String(x - 5));
    d.setAttribute('y', String(cy - 5));
    d.setAttribute('width', '10');
    d.setAttribute('height', '10');
    d.setAttribute('transform', `rotate(45 ${x} ${cy})`);
    d.setAttribute('class', 'gh-3d__rhombus');
    kids.push(d);
    outline.replaceChildren(...kids);
  };

  const pickAt = (x, y) => {
    measure();
    for (const s of shapes) if (s.polys.some((p) => p.visible && inside(p.poly, x, y))) return s.id;
    return null;
  };
  // Girar la vista hasta una planta, si no se ve bien
  const lookAt = (id, ms = 600) => {
    const s = shapes.find((x) => x.id === id);
    const c = s && centerOf(s);
    if (c && c.x > 0.12 && c.x < 0.88 && c.y > 0.1 && c.y < 0.8) return;
    const p = view.where();
    const t = center3d(id);
    const yaw = Math.atan2(t.x - p.x, p.y - t.y);
    const pitch = Math.atan2(t.z - EYE_Z, Math.max(1, p.y - t.y));
    view.glideTo(yaw, pitch - view.pitchHome(), ms);
  };

  const toFallback = () => {
    view?.destroy();
    view = null;
    box.remove();
    outline.remove();
    onFallback(mountHotel(host, { onPick, still, t0 }));
  };
  try {
    view = mountHotel3d(box, {
      dragArea: host,
      onFrame: draw,
      onLost: toFallback,
      startYaw: arrive ? -0.15 : (lastView?.yaw ?? 0),
      startPitch: arrive ? 0.4 : (lastView?.pitch ?? 0),
    });
  } catch {
    box.remove();
    outline.remove();
    return mountHotel(host, { onPick, still, t0 });
  }
  lastView = null;
  const canvas = view.canvas;
  canvas.classList.add('hotel-canvas');
  canvas.setAttribute('aria-label', 'El Gran Hotel del Puerto desde la plaza del muelle, de noche. Toca una planta para ver qué hay; arrastra para mirar.');

  const walking = (on) => {
    busy = on;
    host.classList.toggle('is-walking', on);
  };
  // Bajas de la limusina: junto a su puerta, mirando la torre de abajo arriba, y andas hasta la plaza
  if (arrive && !reducedMotion()) {
    walking(true);
    view.walk([{ spot: 'home', yaw: 0, pitch: 'home' }], { from: { spot: 'curb', yaw: -0.15, pitch: 0.72 }, ms: ARRIVE_MS }).then(() => walking(false));
  }

  canvas.addEventListener('click', (e) => {
    if (busy) return;
    const r = box.getBoundingClientRect();
    onPick(pickAt(e.clientX - r.left, e.clientY - r.top));
  });
  host.addEventListener('focusin', (e) => {
    const id = e.target?.dataset?.zone;
    if (id && view) lookAt(id, 500);
  });

  return {
    canvas,
    mode: '3d',
    /** Dónde está cada planta ahora mismo, en fracciones del lienzo (como en el 2D; para las pruebas). */
    get zones() {
      measure();
      return shapes.map((s) => ({ id: s.id, center: centerOf(s) }));
    },
    /** Hasta dónde baja la entrada en el lienzo (fracción). */
    get entry() {
      const p = view?.toScreen(5, SPOTS.door.y - 1.6, 0);
      return p ? p.y / h() : 0.9;
    },
    select(id) {
      selected = id;
      if (id && view) {
        measure();
        lookAt(id);
      }
      // Sin esperar al fotograma: el filete aparece o se va a la vez que la cartela
      draw();
      view?.invalidate();
    },
    /** Andar hasta la puerta del hotel antes de entrar en una sala (con movimiento reducido, directo). */
    goIn() {
      if (!view || reducedMotion() || busy) return Promise.resolve();
      walking(true);
      // Rodeando la limusina por detrás (está aparcada delante de la alfombra roja)
      const keys = [
        { spot: 'rodeo', yaw: -0.2, pitch: 0.05 },
        { spot: 'alfombra', yaw: 0.25, pitch: 0.1 },
        { spot: 'door', yaw: 0, pitch: 0.12 },
      ];
      return view.walk(keys, { ms: DOOR_MS }).then(() => walking(false));
    },
    /** Para las pruebas y la página de desarrollo. */
    hotel: () => view,
    destroy() {
      if (view) lastView = { yaw: view.yaw(), pitch: view.pitch() - view.pitchHome() };
      view?.destroy();
      box.remove();
      outline.remove();
    },
  };
}
