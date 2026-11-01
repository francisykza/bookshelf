// Lo que se ve por las ventanas de un piso desde la fachada (SPEC §64). Una ventana mide unos 14 × 22 píxeles: a ese
// tamaño, la habitación isométrica encogida es una mancha. Por eso se dibuja aparte, de frente y píxel a píxel, como
// en los juegos de pixel art: la pared del color del piso, el suelo y las piezas que más lo caracterizan (la
// estantería con sus lomos, la lámpara con su halo, la planta, el sofá, un cuadro, la guirnalda…), repartidas entre
// las dos ventanas en el orden en que están en la habitación, de izquierda a derecha.
import { rgb } from '../minigames/libreria-puerto/raster';
import { PAREDES, catalogItem } from './catalog';

const LIT = [255, 226, 160];
const WOOD = [110, 72, 48];
const WOOD_DARK = [76, 50, 36];
const SPINES = [[178, 74, 56], [86, 112, 150], [104, 140, 92], [214, 166, 74], [132, 78, 112], [232, 220, 196]];
const LEAF = [92, 136, 82];
const LEAF_LIGHT = [132, 170, 102];
const POT = [184, 98, 70];
const SEA = [92, 126, 160];
const FLOOR = { tablas: [150, 104, 66], damero: [196, 170, 140], barro: [170, 98, 70] };

// Las piezas de suelo que mejor se reconocen, por orden de preferencia
const FLOOR_PRIORITY = ['estanteria', 'lampara-pie', 'planta-grande', 'sofa', 'sillon', 'estufa', 'cama', 'mesa', 'mesa-baja', 'mesilla', 'banco', 'silla'];
const WALL_PRIORITY = ['cuadro', 'reloj', 'ventana'];

const warm = (c, k = 1) => [Math.min(255, c[0] * 1.08 * k), Math.min(255, c[1] * 1.0 * k), Math.min(255, c[2] * 0.86 * k)];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Las piezas de un piso que se verán por sus ventanas: hasta cuatro de suelo y dos de pared, de izquierda a derecha. */
export function pickFeatures(room) {
  const items = [...(room?.items ?? [])].sort((a, b) => (a.x ?? a.a ?? 0) - (b.x ?? b.a ?? 0));
  const first = (id) => items.find((i) => i.id === id);
  const floor = FLOOR_PRIORITY.filter((id) => first(id))
    .slice(0, 4)
    .map((id) => first(id));
  // Mantener el orden de la habitación (izquierda → derecha) entre las elegidas
  floor.sort((a, b) => items.indexOf(a) - items.indexOf(b));
  const wall = WALL_PRIORITY.filter((id) => first(id))
    .slice(0, 2)
    .map((id) => first(id));
  return { floor, wall, guirnalda: !!first('guirnalda'), lamparaMesa: first('lampara-mesa') ?? null, encima: items.filter((i) => ['libros', 'tetera', 'radio', 'planta-pequena'].includes(i.id)) };
}

/**
 * Dos dibujos (uno por ventana) de `w` × `h` píxeles para un piso: Uint32Array con colores (0 = cristal sin nada:
 * no ocurre, siempre hay pared). `room` puede ser null (piso sin decorar: pared cálida y luz).
 */
export function windowPictures(room, w, h) {
  const pared = PAREDES.find((p) => p.id === room?.pared)?.color ?? [226, 204, 178];
  // Desde la calle, la barandilla del balcón tapa el tercio de abajo: se ve la parte alta de la habitación
  const floorY = Math.round(h * 0.68);
  const { floor, wall, guirnalda, lamparaMesa, encima } = pickFeatures(room);
  const pics = [new Uint32Array(w * h), new Uint32Array(w * h)];
  const halos = [[], []];

  for (const [k, pic] of pics.entries()) {
    const set = (x, y, c) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < w && y < h) pic[y * w + x] = rgb(...c);
    };
    const rect = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(x, y, c);
    };
    // Pared con zócalo y suelo
    const wainscot = floorY - 3;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (y >= floorY) set(x, y, warm(shade(FLOOR[room?.suelo] ?? FLOOR.tablas, y === floorY ? 0.75 : 1)));
        else if (y >= wainscot) set(x, y, warm(shade(pared, y === wainscot ? 0.7 : 0.82)));
        else set(x, y, warm(pared, 1 - y * 0.004));
      }
    }
    // Algo en la pared (un cuadro, el reloj, una ventana al mar)
    const wi = wall[k];
    if (wi) {
      const cat = catalogItem(wi.id);
      const tone = cat.tonos[wi.tono] ?? cat.tonos[0];
      const cx = Math.round(w / 2) - 2;
      const cy = Math.round(h * 0.17);
      if (wi.id === 'reloj') {
        rect(cx + 1, cy, cx + 3, cy + 2, warm(tone));
        set(cx + 2, cy + 1, [240, 232, 214]);
      } else if (wi.id === 'ventana') {
        rect(cx, cy, cx + 4, cy + 4, warm(tone));
        rect(cx + 1, cy + 1, cx + 3, cy + 3, SEA);
        set(cx + 2, cy + 2, warm(tone));
      } else {
        rect(cx, cy, cx + 4, cy + 3, warm(tone, 0.8));
        rect(cx + 1, cy + 1, cx + 3, cy + 2, SEA);
        set(cx + 2, cy + 1, [240, 232, 214]);
      }
    }
    // Dos piezas de suelo por ventana: una a la izquierda y otra a la derecha
    for (let s = 0; s < 2; s += 1) {
      const it = floor[k * 2 + s];
      if (!it) continue;
      const cat = catalogItem(it.id);
      const tone = cat.tonos[it.tono] ?? cat.tonos[0];
      const x = s === 0 ? 1 : w - 6;
      const fy = floorY - 1;
      switch (it.id) {
        case 'estanteria': {
          const top = Math.round(h * 0.14);
          rect(x, top, x + 4, fy, warm(shade(tone, 0.7)));
          for (let y = top + 1; y < fy; y += 1) {
            if ((y - top) % 3 === 0) {
              rect(x + 1, y, x + 3, y, warm(shade(tone, 0.5)));
              continue;
            }
            for (let c = 1; c <= 3; c += 1) set(x + c, y, warm(SPINES[(c * 3 + Math.floor((y - top) / 3) * 5 + k) % SPINES.length]));
          }
          break;
        }
        case 'lampara-pie': {
          const shadeY = Math.round(h * 0.22);
          rect(x + 2, shadeY + 2, x + 2, fy, warm(WOOD_DARK));
          rect(x + 1, fy, x + 3, fy, warm(WOOD_DARK));
          rect(x + 1, shadeY, x + 3, shadeY + 1, LIT);
          halos[k].push([x + 2, shadeY + 1, 6]);
          break;
        }
        case 'planta-grande': {
          rect(x + 1, fy - 1, x + 3, fy, warm(POT));
          for (let y = fy - 7; y < fy - 1; y += 1) {
            const half = y < fy - 5 ? 1 : 2;
            for (let c = 2 - half; c <= 2 + half; c += 1) set(x + c, y, (c + y) % 3 === 0 ? warm(LEAF_LIGHT) : warm(LEAF));
          }
          break;
        }
        case 'sofa':
        case 'sillon': {
          const wide = it.id === 'sofa' ? 5 : 4;
          rect(x, fy - 4, x + wide, fy - 3, warm(shade(tone, 0.78)));
          rect(x, fy - 2, x + wide, fy, warm(tone));
          set(x, fy - 2, warm(shade(tone, 0.7)));
          set(x + wide, fy - 2, warm(shade(tone, 0.7)));
          break;
        }
        case 'estufa': {
          rect(x + 1, fy - 4, x + 3, fy, warm(tone));
          rect(x + 2, fy - 8, x + 2, fy - 5, warm(shade(tone, 0.8)));
          rect(x + 1, fy - 2, x + 3, fy - 1, [255, 150, 70]);
          halos[k].push([x + 2, fy - 2, 5]);
          break;
        }
        case 'cama': {
          rect(x, fy - 2, x + 5, fy, warm(tone));
          rect(x, fy - 4, x, fy, warm(WOOD));
          set(x + 1, fy - 3, [244, 236, 220]);
          set(x + 2, fy - 3, [244, 236, 220]);
          break;
        }
        default: {
          // Mesas, banco y silla: tablero y patas (y, si hay, algo encima)
          const top = it.id === 'mesa' ? fy - 4 : it.id === 'silla' ? fy - 5 : fy - 3;
          rect(x, top, x + 4, top, warm(tone));
          set(x, top + 1, warm(shade(tone, 0.7)));
          set(x + 4, top + 1, warm(shade(tone, 0.7)));
          rect(x, top + 1, x, fy, warm(shade(tone, 0.7)));
          rect(x + 4, top + 1, x + 4, fy, warm(shade(tone, 0.7)));
          if (it.id === 'silla') rect(x, top - 3, x, top, warm(tone));
          if (lamparaMesa && s + k * 2 === floor.findIndex((f) => catalogItem(f.id).sup)) {
            rect(x + 2, top - 2, x + 2, top - 1, warm(WOOD_DARK));
            rect(x + 1, top - 4, x + 3, top - 3, LIT);
            halos[k].push([x + 2, top - 3, 5]);
          } else if (encima[k]) {
            const e = encima[k];
            const ecat = catalogItem(e.id);
            const etone = ecat.tonos[e.tono] ?? ecat.tonos[0];
            if (e.id === 'planta-pequena') {
              set(x + 2, top - 1, warm(POT));
              set(x + 2, top - 2, warm(LEAF_LIGHT));
              set(x + 1, top - 2, warm(LEAF));
              set(x + 3, top - 2, warm(LEAF));
            } else rect(x + 1, top - 1, x + 3, top - 1, warm(etone));
          }
        }
      }
    }
    // Guirnalda de luces a lo alto de la pared
    if (guirnalda) for (let x = 1; x < w - 1; x += 2) set(x, 2 + (x % 4 === 1 ? 1 : 0), [[255, 214, 140], [244, 170, 150], [250, 236, 190]][(x >> 1) % 3]);
  }

  // Halo cálido de cada luz sobre lo que la rodea
  for (const [k, pic] of pics.entries()) {
    for (const [hx, hy, rad] of halos[k]) {
      for (let y = hy - rad; y <= hy + rad; y += 1) {
        for (let x = hx - rad; x <= hx + rad; x += 1) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const d = Math.hypot(x - hx, (y - hy) * 0.9) / rad;
          if (d >= 1) continue;
          const i = y * w + x;
          const p = pic[i];
          const m = (1 - d) * 0.45;
          pic[i] = rgb((p & 255) + (LIT[0] - (p & 255)) * m, ((p >> 8) & 255) + (LIT[1] - ((p >> 8) & 255)) * m, ((p >> 16) & 255) + (LIT[2] - ((p >> 16) & 255)) * m);
        }
      }
    }
  }
  return pics;
}
