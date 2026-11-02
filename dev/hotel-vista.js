// La fachada del Gran Hotel, viva (concepto, solo desarrollo): sobre el dibujo quieto de hotel-concepto.js, los focos
// barren el cielo, la aguja parpadea, las bombillas de la marquesina corren, el neón rosa titila de vez en cuando,
// alguna ventana se apaga o se enciende, el agua ondula, cruzan estrellas fugaces y estallan fuegos artificiales detrás
// de la torre (efectos de pixelfx, src/vendor/pixelfx), la gente pasea y charla con bocadillos. Como en la fachada del
// edificio, se toca: cada planta se ilumina al pasar por encima y al tocarla se abre su tarjeta. Con movimiento
// reducido, el dibujo se queda quieto (pero se sigue tocando).
import { clearFrame, createFrame, createFx } from '../src/vendor/pixelfx/core/index.js';
import * as fireworkBurst from '../src/vendor/pixelfx/fx/explosions/firework-burst.js';
import * as shootingStars from '../src/vendor/pixelfx/fx/weather/shooting-stars.js';
import { renderHotel } from './hotel-concepto.js';

export const ZONES = {
  plaza: { nombre: 'La plaza del muelle', texto: 'Donde se llega. Aquí ves quién ha entrado hoy y te paras a saludar.' },
  vestibulo: { nombre: 'El vestíbulo', texto: 'La recepción: el conserje te orienta y el tablón «Busco quien lea…» junta a quien lee lo mismo.' },
  cafe: { nombre: 'El café-biblioteca', texto: 'Mesas para sentarte con tu personaje junto a alguien que lee lo mismo. Cada mesa dice qué libro se lee en ella.' },
  baile: { nombre: 'El salón de baile', texto: 'La sala grande, para los eventos con fecha: la lectura conjunta de la semana o la presentación de un club.' },
  suites: { nombre: 'Las suites de los clubes', texto: 'Cada club tiene su habitación, decorada entre sus miembros. Por la ventana se ve si hay alguien dentro.' },
  terraza: { nombre: 'La terraza', texto: 'Guirnaldas, la radio del rincón sonando para todos y el puerto a tus pies.' },
  mirador: { nombre: 'El mirador de la corona', texto: 'El bar de arriba, con las mejores vistas, el ranking y las distinciones.' },
};

const rgb = (r, g, b) => ((255 << 24) | (Math.min(255, Math.max(0, b | 0)) << 16) | (Math.min(255, Math.max(0, g | 0)) << 8) | Math.min(255, Math.max(0, r | 0))) >>> 0;
const scale = (p, k, add = 0) => rgb((p & 255) * k + add, ((p >> 8) & 255) * k + add, ((p >> 16) & 255) * k + add);
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Monta la fachada en `host`. `onPick(zona)` al tocar una planta (null al tocar fuera). Devuelve { canvas, select(zona), destroy() }.
 * `still`: sin animación (movimiento reducido o capturas); `t0`: el instante que se dibuja quieto.
 */
export function mountHotel(host, { onPick = () => {}, still = false, t0 = 0 } = {}) {
  const h = renderHotel();
  const { W, H, pix: base } = h;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.className = 'hotel-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'El Gran Hotel del Puerto, de noche. Toca una planta para ver qué hay.');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const out = new Uint32Array(image.data.buffer);
  const zoneIds = h.zones.map((z) => z.id);

  // Lo que el cielo necesita para los focos: el ángulo de cada píxel visto desde la corona
  const skyIdx = [];
  const skyAng = [];
  for (let i = 0; i < W * H; i += 1) {
    if (!h.sky[i]) continue;
    const ix = i % W;
    const iy = (i / W) | 0;
    if (iy >= h.beamFrom.sy) continue;
    skyIdx.push(i);
    skyAng.push(Math.atan2(ix - h.beamFrom.sx, h.beamFrom.sy - iy));
  }
  const waterIdx = [];
  for (let i = 0; i < W * H; i += 1) if (h.water[i]) waterIdx.push(i);
  const winList = [...h.windows.values()];
  const bulbs = h.bulbs.map((i) => ({ i, x: i % W }));

  // pixelfx: estrellas fugaces todo el rato y, de vez en cuando, un fuego artificial detrás de la torre
  const fxFrame = createFrame(W, H);
  const stars = createFx(shootingStars, { x: W / 2, y: Math.round(h.beamFrom.sy + 40), light: 0.7 });
  const PALETTES = [
    ['#3d0a33', '#701560', '#b0228f', '#f53cd1', '#ff86e6', '#ffd2f6', '#ffffff'],
    ['#2a1406', '#6a3a0c', '#b8701a', '#f0a830', '#ffd860', '#fff2b0', '#ffffff'],
    ['#06223a', '#0c4a6a', '#1a86a8', '#36c2d8', '#8ce8f0', '#d8fbff', '#ffffff'],
  ];
  let bursts = [];
  let nextBurst = 1.2;
  let burstN = 0;

  let hover = 0;
  let selected = 0;
  let t = t0;
  let raf = 0;
  let last = 0;

  function frame() {
    out.set(base);
    // Focos que barren el cielo despacio
    const beams = [-0.42 + Math.sin(t * 0.35) * 0.22, 0.33 + Math.sin(t * 0.27 + 2) * 0.2];
    for (let k = 0; k < skyIdx.length; k += 1) {
      const i = skyIdx[k];
      let add = 0;
      for (const bA of beams) {
        const d = Math.abs(skyAng[k] - bA);
        if (d < 0.075) add += (1 - d / 0.085) * Math.max(0, 1 - (h.beamFrom.sy - ((i / W) | 0)) / 280);
      }
      if (add > 0) {
        const p = out[i];
        out[i] = rgb((p & 255) + 64 * add, ((p >> 8) & 255) + 58 * add, ((p >> 16) & 255) + 46 * add);
      }
    }
    // pixelfx detrás de la torre: solo se pinta sobre el cielo; su luz, un poco también sobre la fachada
    clearFrame(fxFrame);
    stars.draw(fxFrame);
    for (const b of bursts) b.fx.draw(fxFrame);
    const C = fxFrame.color;
    const L = fxFrame.light;
    for (let i = 0; i < W * H; i += 1) {
      const c = C[i];
      const l = L[i] & 0xffffff;
      if (!c && !l) continue;
      const sky = h.sky[i] === 1;
      let p = out[i];
      if (sky && c >>> 24) {
        const a = (c >>> 24) / 255;
        p = rgb((c & 255) * a + (p & 255) * (1 - a), ((c >> 8) & 255) * a + ((p >> 8) & 255) * (1 - a), ((c >> 16) & 255) * a + ((p >> 16) & 255) * (1 - a));
      }
      if (l) {
        const k = sky ? 1 : 0.25;
        p = rgb((p & 255) + (l & 255) * k, ((p >> 8) & 255) + ((l >> 8) & 255) * k, ((p >> 16) & 255) + ((l >> 16) & 255) * k);
      }
      out[i] = p;
    }
    // Agua: el reflejo ondula y, a ratos, un destello
    for (const i of waterIdx) {
      const ix = i % W;
      const iy = (i / W) | 0;
      const wob = Math.round(Math.sin(iy * 1.3 + t * 2.4) * 0.9 + Math.sin(iy * 0.4 - t * 1.1) * 0.6);
      const sx = Math.min(W - 1, Math.max(0, ix + wob));
      const j = iy * W + sx;
      out[i] = h.water[j] ? base[j] : base[i];
      if (hash(ix, iy + Math.floor(t * 3)) > 0.996) out[i] = scale(out[i], 1.1, 40);
    }
    // Ventanas que se apagan y se encienden (pocas, despacio)
    for (let k = 0; k < winList.length; k += 1) {
      const cycle = Math.floor(t / 7 + hash(k, 3) * 5);
      if (hash(k, cycle) > 0.94) for (const i of winList[k]) out[i] = scale(base[i], 0.22, 6);
    }
    // La aguja parpadea
    if (t % 1.6 > 0.35) for (const i of h.spire) out[i] = scale(base[i], 0.35);
    // Las bombillas de la marquesina corren
    for (const b of bulbs) if (Math.floor(b.x / 2 - t * 8) % 3 !== 0) out[b.i] = scale(base[b.i], 0.72);
    // El neón rosa titila de vez en cuando
    const flick = t % 9;
    if ((flick > 4.0 && flick < 4.08) || (flick > 4.18 && flick < 4.3)) for (const i of h.neonPink) out[i] = scale(base[i], 0.35);
    // Paseantes por el borde del muelle
    for (let k = 0; k < 4; k += 1) {
      const dir = k % 2 ? 1 : -1;
      const u = ((t * (0.035 + k * 0.006) + k * 0.27) % 1 + 1) % 1;
      const v = dir > 0 ? u : 1 - u;
      const x = Math.round(h.walk[0].x + (h.walk[1].x - h.walk[0].x) * v);
      const y = Math.round(h.walk[0].y + (h.walk[1].y - h.walk[0].y) * v) - (Math.floor(t * 6 + k) % 2);
      if (x < 1 || x >= W - 1 || y < 3 || y >= H) continue;
      const shirt = [rgb(150, 92, 76), rgb(92, 108, 84), rgb(84, 98, 130), rgb(170, 140, 70)][k];
      out[(y - 3) * W + x] = rgb(180, 140, 110);
      out[(y - 2) * W + x] = shirt;
      out[(y - 1) * W + x] = shirt;
      out[y * W + x] = rgb(40, 34, 46);
    }
    // Bocadillos: aparecen sobre alguien de la plaza, se quedan un rato y se van
    for (let k = 0; k < 3; k += 1) {
      const slot = Math.floor((t + k * 1.7) / 5);
      const age = (t + k * 1.7) % 5;
      if (age > 3.2) continue;
      const who = h.people[Math.floor(hash(slot, k) * h.people.length)];
      bubble(who.x, who.y, ['dots', 'heart', 'note', 'book'][Math.floor(hash(k, slot + 9) * 4)], age < 0.15);
    }
    // La planta señalada se enciende, con su contorno dorado
    for (const z of [hover, selected]) {
      if (!z) continue;
      for (let i = W; i < W * H - W; i += 1) {
        if (h.zoneMap[i] !== z) continue;
        const edge = h.zoneMap[i - 1] !== z || h.zoneMap[i + 1] !== z || h.zoneMap[i - W] !== z || h.zoneMap[i + W] !== z;
        out[i] = edge ? rgb(255, 214, 128) : scale(out[i], z === selected ? 1.22 : 1.12, 6);
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function bubble(px, py, kind, pop) {
    const bx = px - 3;
    const by = py - 7 + (pop ? 1 : 0);
    if (bx < 0 || by < 0 || bx + 8 >= W) return;
    const ink = rgb(60, 44, 52);
    const paper = rgb(250, 244, 230);
    for (let y = 0; y < 5; y += 1)
      for (let x = 0; x < 8; x += 1) {
        if ((x === 0 || x === 7) && (y === 0 || y === 4)) continue;
        out[(by + y) * W + bx + x] = x === 0 || x === 7 || y === 0 || y === 4 ? ink : paper;
      }
    out[(by + 5) * W + bx + 3] = ink;
    out[(by + 5) * W + bx + 2] = paper;
    out[(by + 6) * W + bx + 3] = ink;
    const dots = {
      dots: [[2, 2], [4, 2], [6, 2]],
      heart: [[2, 1], [5, 1], [2, 2], [3, 2], [4, 2], [5, 2], [3, 3], [4, 3]],
      note: [[4, 1], [5, 1], [4, 2], [4, 3], [3, 3]],
      book: [[2, 1], [3, 1], [5, 1], [6, 1], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [4, 3]],
    }[kind];
    const c = kind === 'heart' ? rgb(206, 70, 76) : kind === 'book' ? rgb(96, 120, 170) : ink;
    for (const [x, y] of dots) out[(by + y) * W + bx + x] = c;
  }

  function step(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    t += dt;
    stars.update(dt);
    for (const b of bursts) b.fx.update(dt);
    bursts = bursts.filter((b) => !b.fx.done());
    nextBurst -= dt;
    if (nextBurst <= 0) {
      burstN += 1;
      const side = burstN % 2 ? -1 : 1;
      bursts.push({ fx: createFx(fireworkBurst, { x: Math.round(W / 2 + side * (38 + hash(burstN, 1) * 40)), y: Math.round(40 + hash(burstN, 2) * 50), seed: burstN, palette: PALETTES[burstN % 3], light: 0.8 }) });
      nextBurst = 4 + hash(burstN, 3) * 4;
    }
    frame();
    raf = requestAnimationFrame(step);
  }

  // Tocar y señalar
  const zoneAt = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * W);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return h.zoneMap[y * W + x];
  };
  const onMove = (ev) => {
    const z = zoneAt(ev);
    if (z === hover) return;
    hover = z;
    canvas.style.cursor = z ? 'pointer' : 'default';
    if (still) frame();
  };
  const onLeave = () => {
    hover = 0;
    if (still) frame();
  };
  const onClick = (ev) => {
    const z = zoneAt(ev);
    // Fuera de las plantas (cielo, agua) se cierra lo que hubiera abierto
    select(z ? zoneIds[z - 1] : null);
    onPick(z ? zoneIds[z - 1] : null);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);

  function select(id) {
    selected = id ? zoneIds.indexOf(id) + 1 : 0;
    if (still) frame();
  }

  if (still) {
    // Un fuego artificial a medio estallar, para el dibujo quieto
    bursts.push({ fx: createFx(fireworkBurst, { x: W / 2 - 52, y: 62, seed: 3, palette: PALETTES[0], light: 0.8 }) });
    bursts[0].fx.update(0.9);
    stars.update(t0 % 10);
    frame();
  } else raf = requestAnimationFrame(step);

  return {
    canvas,
    zones: h.zones,
    select,
    destroy() {
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
