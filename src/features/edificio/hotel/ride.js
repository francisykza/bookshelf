// El camino al Gran Hotel (1.74, §74.4; Francisco: «el camino se ve muy simple y plano»): la calle del puerto de noche,
// con el mismo rasterizador que las fachadas. Detrás, una hilera de casas con ventanas encendidas, tiendas con toldo y
// farolas en la acera; delante, la calzada con su raya dorada, el paseo con bolardos y cadenas, y el agua con el reflejo
// de las farolas. Al fondo del cielo, los focos del hotel. `mountRide` lo anima: la limusina recorre la calle y la
// cámara la sigue; al llegar, avisa.
import { createRaster, hash, noise, rgb } from '../../minigames/libreria-puerto/raster';
import { limoSprite } from '../limo';

const S = 12;
const YAW = 0.3;
const LEN = 46; // largo de la calle
const LANE = 0.55; // por dónde va la limusina (y del mundo)
const GLOW = 0x8000;
const SKY_PAD = 90;

const STONE = [150, 140, 132];
const PAVER = [128, 120, 116];
const ASPHALT = [62, 60, 70];
const GOLD = [240, 196, 104];
const IRON = [44, 40, 50];
const LAMP = [255, 226, 160];
const WATER = [30, 50, 84];
const COBBLE = [124, 116, 112];
const FRONTS = [
  [226, 186, 78],
  [196, 112, 92],
  [232, 214, 178],
  [150, 120, 160],
  [118, 146, 128],
  [214, 150, 96],
];
const AWNINGS = [
  [176, 52, 48],
  [70, 112, 78],
  [86, 112, 142],
];
const WINDOW = [
  [255, 214, 140],
  [255, 198, 122],
  [250, 232, 182],
];

function frame() {
  const probe = createRaster({ W: 1, H: 1, S, yaw: YAW, ox: 0, oy: 0 });
  const pts = [];
  for (const x of [-2, LEN + 2]) for (const y of [-4.5, 8]) for (const z of [0, 7.5]) pts.push(probe.project(x, y, z));
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  return { W: Math.ceil(maxX - minX) + 2, H: Math.ceil(maxY - minY) + SKY_PAD, ox: Math.round(1 - minX), oy: Math.round(SKY_PAD - minY) };
}

/** El dibujo quieto de la calle. Devuelve { canvas, project, laneAt(x) }. */
export function renderRide() {
  const F = frame();
  const { W, H } = F;
  const r = createRaster({ W, H, S, yaw: YAW, ox: F.ox, oy: F.oy });
  r.clear(0);
  const lights = [];
  const lampXs = [];
  for (let x = 2.5; x < LEN; x += 5.5) lampXs.push(x);
  // El reflejo de cada farola cae en vertical bajo su luz, desde la orilla
  const shoreAt = (sx) => {
    const a = r.project(0, 3.9, 0);
    const b = r.project(10, 3.9, 0);
    return a.sy + ((sx - a.sx) * (b.sy - a.sy)) / (b.sx - a.sx);
  };
  const refl = lampXs.map((lx) => {
    const head = r.project(lx + 0.4, -0.57, 2.25);
    return { sx: head.sx, sy: shoreAt(head.sx) + 2 };
  });
  // Los píxeles del reflejo brillan de noche (no se oscurecen con lo demás)
  const shine = new Uint8Array(W * H);

  // El suelo: acera, calzada con su raya, bordillo, paseo de adoquines y el agua
  const paver = r.rampOf(PAVER);
  const asphalt = r.rampOf(ASPHALT);
  const stone = r.rampOf(STONE);
  const cobble = r.rampOf(COBBLE);
  const water = r.rampOf(WATER);
  const gold = r.rampOf(GOLD);
  r.floor((x, y, ix, iy) => {
    if (y < -4.5) return 0;
    const d = (r.bayerAt(ix, iy) - 0.5) * 0.5;
    if (y < 0) return paver[(x * 1.4) % 1 < 0.06 || (y * 1.4) % 1 < 0.06 ? 1 : 2 + (hash(Math.floor(x * 1.4), Math.floor(y * 1.4)) > 0.7 ? 1 : 0)];
    if (y < 2.4) {
      if (y > 1.13 && y < 1.27 && x % 2 < 1.05) return gold[2];
      return asphalt[Math.max(0, Math.min(4, Math.floor(2 + (noise(x * 3, y * 3) - 0.5) * 1.2 + d)))];
    }
    if (y < 2.6) return stone[3];
    if (y < 3.7) {
      const cy = Math.floor(y * 2.6);
      const cx = Math.floor(x * 2.2 + (cy % 2) * 0.5);
      const seam = (x * 2.2 + (cy % 2) * 0.5) % 1 < 0.12 || (y * 2.6) % 1 < 0.14;
      return cobble[Math.max(0, Math.min(4, Math.floor(3 + (hash(cx, cy) - 0.5) * 1.2 + d - (seam ? 1.3 : 0))))];
    }
    if (y < 3.85) return stone[1];
    // El agua: ondas y, bajo cada farola, su reflejo, una raya vertical que tiembla
    for (const p of refl) {
      const dy = iy - p.sy;
      if (dy < 0 || dy > 46) continue;
      const dx = Math.abs(ix - p.sx + Math.sin(iy * 0.8) * 1.4);
      const fade = 1 - dy / 46;
      if (dx < 1.2 + fade && hash(ix, Math.floor(iy / 2)) < 0.4 + fade * 0.5) {
        shine[iy * W + ix] = 1;
        return rgb(255, 214, 140);
      }
      if (dx < 2.6 + fade * 2 && hash(ix + 3, Math.floor(iy / 2)) < fade * 0.5) {
        shine[iy * W + ix] = 1;
        return rgb(176, 136, 96);
      }
    }
    const ripple = Math.sin(x * 2.4 + y * 6.5 + noise(x, y * 2) * 4);
    return water[ripple > 0.8 ? 4 : ripple < -0.6 ? 1 : 2];
  });

  // La hilera de casas, cada una de su color, con ventanas (casi todas encendidas) y tienda con toldo abajo
  let x0 = -2;
  let k = 0;
  while (x0 < LEN + 2) {
    const w = 3 + hash(k, 1) * 2.2;
    const h = 3.4 + hash(k, 2) * 2.8;
    const front = FRONTS[k % FRONTS.length];
    const ramp = r.rampOf(front);
    const lit = (a, b) => {
      const cx = Math.floor((a - x0 - 0.35) / 0.8);
      const cz = Math.floor((b - 1.6) / 1.05);
      const inWin = (a - x0 - 0.35) % 0.8 < 0.42 && (b - 1.6) % 1.05 < 0.6 && a > x0 + 0.3 && a < x0 + w - 0.3 && b > 1.6 && b < h - 0.4;
      return inWin ? (hash(cx + k * 9, cz) > 0.25 ? 1 : 0) : -1;
    };
    r.box(x0, -2.3, 0, x0 + w - 0.06, -1.25, h, front, {
      seed: k,
      face: (f, a, b) => {
        if (f === 'top') return r.rampOf([120, 84, 76])[(a * 3) % 1 < 0.12 ? 1 : 2];
        if (f !== 'front') return undefined;
        if (b > h - 0.18) return ramp[1];
        return lit(a, b) === 0 ? rgb(40, 40, 60) : undefined;
      },
    });
    // Las ventanas encendidas y el escaparate brillan (se marcan como luz)
    r.setId(GLOW);
    for (let a = x0 + 0.35; a + 0.42 < x0 + w - 0.3; a += 0.8)
      for (let b = 1.6; b + 0.6 < h - 0.4; b += 1.05) if (lit(a + 0.1, b + 0.1) === 1) r.box(a, -1.25, b, a + 0.42, -1.22, b + 0.6, WINDOW[Math.floor(hash(a * 2, k) * 3)], { grain: 0 });
    r.box(x0 + 0.4, -1.25, 0.3, x0 + w - 0.5, -1.2, 1.25, [250, 210, 150], { grain: 0 });
    r.setId(0);
    const awning = AWNINGS[k % AWNINGS.length];
    r.box(x0 + 0.25, -1.25, 1.3, x0 + w - 0.35, -0.85, 1.42, awning, { grain: 0, face: (f, a) => (f !== 'top' && Math.floor(a * 3) % 2 ? r.rampOf([240, 232, 214])[3] : undefined) });
    lights.push(r.project(x0 + w / 2, -1.1, 0.9));
    x0 += w;
    k += 1;
  }

  // Farolas en la acera, con su luz
  for (const lx of lampXs) {
    r.box(lx, -0.62, 0, lx + 0.1, -0.52, 2.5, IRON, { grain: 0, step: 0.03 });
    r.box(lx - 0.06, -0.68, 0, lx + 0.16, -0.46, 0.2, IRON, { grain: 0, step: 0.03 });
    r.box(lx + 0.1, -0.6, 2.4, lx + 0.45, -0.54, 2.46, IRON, { grain: 0, step: 0.03 });
    r.setId(GLOW);
    r.box(lx + 0.3, -0.66, 2.1, lx + 0.5, -0.48, 2.4, LAMP, { grain: 0, step: 0.03 });
    r.setId(0);
    r.box(lx + 0.27, -0.69, 2.4, lx + 0.53, -0.45, 2.46, IRON, { grain: 0, step: 0.03 });
    lights.push({ ...r.project(lx + 0.4, 0.4, 0), big: true });
  }
  // El paseo: bolardos unidos por cadenas
  for (let x = 1; x < LEN; x += 2.2) {
    r.box(x, 3.45, 0, x + 0.2, 3.65, 0.45, IRON, { grain: 0, step: 0.03 });
    r.box(x + 0.2, 3.53, 0.3, x + 2.2, 3.57, 0.33, [80, 74, 84], { grain: 0, step: 0.03 });
  }
  r.applyShadows();
  r.shadeEdges();

  // La noche: el cielo con estrellas y los dos focos del hotel, al fondo a la derecha
  const beam0 = { sx: W * 0.86, sy: r.project(LEN, -4.5, 0).sy - 40 };
  for (let iy = 0; iy < H; iy += 1) {
    for (let ix = 0; ix < W; ix += 1) {
      const i = iy * W + ix;
      if (r.zb[i] > -1e8) continue;
      const t = Math.min(1, iy / H);
      let c = [10 + t * 34, 12 + t * 22, 34 + t * 40];
      if (hash(ix, iy) > 0.992) c = [250, 240, 220];
      for (const a of [-0.32, 0.22]) {
        const ang = Math.atan2(ix - beam0.sx, beam0.sy - iy);
        if (iy < beam0.sy && Math.abs(ang - a) < 0.06) c = c.map((v, j) => v + [34, 30, 24][j] * (1 - (beam0.sy - iy) / beam0.sy));
      }
      r.pix[i] = rgb(...c);
    }
  }
  // Luz de noche sobre lo demás: casi todo más oscuro y azulado, cálido cerca de las farolas y los escaparates
  const lamp = r.rampOf(LAMP);
  for (let i = 0; i < r.pix.length; i += 1) {
    if (r.zb[i] < -1e8) continue;
    const p = r.pix[i];
    if (shine[i]) continue;
    if (r.ids[i] & GLOW) {
      r.pix[i] = lamp[((p & 255) + ((p >> 8) & 255)) / 510 > 0.6 ? 4 : 3];
      continue;
    }
    const ix = i % W;
    const iy = (i / W) | 0;
    let g = 0;
    for (const l of lights) {
      const dd = Math.hypot(ix - l.sx, (iy - l.sy) * (l.big ? 1.9 : 1.4)) / (l.big ? 34 : 22);
      if (dd < 1) g += (1 - dd) ** 1.5;
    }
    g = Math.min(1, g);
    r.pix[i] = rgb((p & 255) * (0.5 + g * 0.62), ((p >> 8) & 255) * (0.5 + g * 0.5), ((p >> 16) & 255) * (0.68 + g * 0.18));
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  image.data.set(new Uint8ClampedArray(r.pix.buffer));
  ctx.putImageData(image, 0, 0);
  return { canvas, W, H, at: (x, y = LANE, z = 0) => r.project(x, y, z) };
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Monta el viaje en `host` (que pone el tamaño): la limusina recorre la calle en `ms` y la cámara la sigue. `onArrive`
 * al llegar. Devuelve { destroy }.
 */
export function mountRide(host, { ms = 3400, onArrive = () => {} } = {}) {
  const scene = renderRide();
  const limo = limoSprite(S, YAW);
  const layer = document.createElement('div');
  layer.className = 'gh-ride__layer';
  layer.style.width = `${scene.W}px`;
  layer.style.height = `${scene.H}px`;
  scene.canvas.className = 'gh-ride__scene';
  limo.canvas.className = 'gh-ride__car';
  const beam = document.createElement('span');
  beam.className = 'gh-ride__beam';
  layer.append(scene.canvas, beam, limo.canvas);
  host.append(layer);

  // Hacia dónde va la calle en la pantalla (para los faros)
  const h0 = scene.at(0);
  const h1 = scene.at(1);
  const heading = Math.atan2(h1.sy - h0.sy, h1.sx - h0.sx);
  const from = 7;
  const to = LEN - 11;
  let raf = 0;
  let start = 0;
  let arrived = false;
  const place = (t) => {
    const x = from + (to - from) * ease(t);
    const p = scene.at(x);
    // Un traqueteo de un píxel de vez en cuando, como sobre los adoquines
    const bob = Math.floor(t * 40) % 7 === 0 ? -1 : 0;
    limo.canvas.style.transform = `translate(${Math.round(p.sx - limo.ox)}px, ${Math.round(p.sy - limo.oy) + bob}px)`;
    const nose = scene.at(x + 3.4, LANE + 0.45, 0.42);
    beam.style.transform = `translate(${Math.round(nose.sx)}px, ${Math.round(nose.sy) - 11}px) rotate(${heading}rad)`;
    // La cámara: la limusina, un poco a la izquierda del centro y abajo
    const k = Math.max(2, host.clientHeight / 190);
    const cx = host.clientWidth * 0.4 - (p.sx + 20) * k;
    const cy = host.clientHeight * 0.6 - p.sy * k;
    layer.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px) scale(${k})`;
  };
  const step = (now) => {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / ms);
    place(t);
    if (t >= 1) {
      if (!arrived) {
        arrived = true;
        onArrive();
      }
      return;
    }
    raf = requestAnimationFrame(step);
  };
  place(0);
  raf = requestAnimationFrame(step);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      layer.remove();
    },
  };
}
