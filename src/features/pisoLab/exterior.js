// Lo que se ve desde una ventana del piloto: cielo, mar y, solo si la ventana da al Gran Hotel, su silueta sacada del
// propio dibujo de hotelArt.js. Devuelve un lienzo 2D; quien lo usa lo convierte en textura y la libera al salir. El
// dibujo del hotel se calcula una vez por sesión y solo si alguna ventana lo necesita (carga diferida).
import { FACADE_SKY } from '../edificio/facade';

const SIZE = 512;
/** Alto del hotel en el lienzo: la corona queda en el cristal de arriba, con cielo alrededor y sin tocar el dintel. */
const HOTEL_H = 0.3;
/** La torre, en un cristal y no detrás del parteluz de la ventana. */
const HOTEL_X = -0.07;
const css = ([r, g, b]) => `rgb(${r},${g},${b})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Dónde queda el horizonte dentro del lienzo (0: arriba; 1: abajo). */
export const HORIZON = 0.58;

let hotelLayers = null;

async function hotelLayer(hora) {
  if (!hotelLayers) {
    hotelLayers = import('../edificio/hotel/hotelArt.js').then(({ renderHotel }) => {
      const h = renderHotel();
      // La silueta acaba en la entrada: de ahí abajo, el dibujo es la plaza y el agua
      const shore = Math.min(h.H, Math.round(h.entryY));
      const lit = new Set();
      let k = 0;
      for (const cells of h.windows.values()) {
        k += 1;
        if (k % 3) for (const i of cells) lit.add(i);
      }
      // El dibujo de verdad del hotel, velado por la distancia y por la luz de cada hora: así se reconoce, no es una mancha
      const paint = (veil, amount, glow, keepLit = true) => {
        const canvas = document.createElement('canvas');
        canvas.width = h.W;
        canvas.height = shore;
        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(h.W, shore);
        for (let i = 0; i < h.W * shore; i += 1) {
          if (h.sky[i] || h.water[i]) continue;
          const p = h.pix[i];
          const c = keepLit && lit.has(i) ? glow : mix([p & 255, (p >> 8) & 255, (p >> 16) & 255], veil, amount);
          image.data.set([c[0], c[1], c[2], 255], i * 4);
        }
        ctx.putImageData(image, 0, 0);
        return canvas;
      };
      return { dia: paint([168, 196, 214], 0.22, null, false), tarde: paint([214, 128, 120], 0.22, [255, 214, 150]), noche: paint([22, 22, 52], 0.62, [255, 206, 132]) };
    });
  }
  const layers = await hotelLayers;
  return layers[hora];
}

/** `vista`: 'hotel' | 'mar' | 'monte'. `hora`: 'tarde' (la de la fachada) | 'dia' | 'noche'. */
export async function paintExterior(vista, hora) {
  const night = hora === 'noche';
  const dusk = hora === 'tarde';
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const line = Math.round(SIZE * HORIZON);
  const sky = g.createLinearGradient(0, 0, 0, line);
  const stops = dusk ? FACADE_SKY.map(css) : night ? ['#171a3a', '#4a3a68'] : ['#7fb2cf', '#f0dcb8'];
  stops.forEach((color, k) => sky.addColorStop(k / (stops.length - 1), color));
  g.fillStyle = sky;
  g.fillRect(0, 0, SIZE, line);
  if (night || dusk) {
    g.fillStyle = '#e6d8b3';
    const count = dusk ? 40 : 140;
    const top = dusk ? line * 0.35 : line - 12;
    for (let i = 0; i < count; i += 1) g.fillRect((i * 73) % SIZE, (i * 37) % top, 2, 2);
  }
  if (vista === 'monte') {
    g.fillStyle = night ? '#23263f' : dusk ? '#54425f' : '#7f9a84';
    for (let x = 0; x < SIZE; x += 4) {
      const h = 34 + 24 * Math.sin(x / 31) + 10 * Math.sin(x / 11);
      g.fillRect(x, line - h, 4, h);
    }
  }
  if (vista === 'hotel') {
    const layer = await hotelLayer(hora);
    const h = Math.round(SIZE * HOTEL_H);
    const w = Math.round((layer.width / layer.height) * h);
    const x = Math.round((SIZE - w) / 2 + SIZE * HOTEL_X);
    // Reducir sin suavizar convierte las ventanas de la torre en ruido; suavizado, se lee su forma
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(layer, x, line - h, w, h);
    g.imageSmoothingEnabled = false;
    // El espigón sobre el que está: el dibujo acaba en la entrada y, sin él, el hotel flotaría sobre el mar
    g.fillStyle = night ? '#1a1a34' : dusk ? '#4a3a5c' : '#7a7f86';
    g.fillRect(x - 10, line - Math.round(h * 0.09), w + 20, Math.round(h * 0.09));
  }
  g.fillStyle = night ? '#1f2c46' : dusk ? '#3f4a6c' : '#4e7892';
  g.fillRect(0, line, SIZE, SIZE - line);
  g.fillStyle = night ? '#44506e' : dusk ? '#c98a7c' : '#a9c4cc';
  for (let i = 0; i < 180; i += 1) g.fillRect((i * 79) % SIZE, line + 2 + ((i * 13) % (SIZE - line - 3)), 4 + (i % 7) * 2, 2);
  return canvas;
}
