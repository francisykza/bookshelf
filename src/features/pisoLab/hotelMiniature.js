// El Gran Hotel visto desde lejos, reducido por zonas desde el dibujo de `hotelArt.js`: la silueta sale de cuánto cubre cada
// celda, con un umbral bajo para que no se pierdan la corona ni la aguja; el color es la media y una ventana queda encendida
// solo si la zona tiene bastantes. Sin suavizar. Rehacer el dibujo cuesta casi un segundo en un móvil modesto, así que el
// resultado va guardado en `hotelMini.js`; una prueba comprueba que coincide con el dibujo de verdad.

/** Alto del hotel en la vista, en píxeles: 0,78 celdas sobre la pared. */
export const MINI_TALL = 56;
const MIN_COVER = 0.2;
const MIN_LIT = 0.34;

/** `h`: lo que devuelve `renderHotel`. Devuelve { W, H, tip, cells } con cuatro bytes por celda: r, g, b y 0 vacía, 1 llena, 2 encendida. */
export function shrinkHotel(h, tall = MINI_TALL) {
  const shore = Math.min(h.H, Math.round(h.entryY));
  const empty = (i) => h.sky[i] || h.water[i] || !(h.pix[i] >>> 24);
  let top = shore;
  let left = h.W;
  let right = 0;
  for (let i = 0; i < h.W * shore; i += 1) {
    if (empty(i)) continue;
    const x = i % h.W;
    top = Math.min(top, Math.floor(i / h.W));
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  const lit = new Uint8Array(h.W * shore);
  let k = 0;
  for (const cells of h.windows.values()) {
    k += 1;
    if (k % 3) for (const i of cells) if (i < lit.length) lit[i] = 1;
  }
  const step = (shore - top) / tall;
  const W = Math.ceil((right - left + 1) / step);
  const cells = new Uint8Array(W * tall * 4);
  let tip = -1;
  for (let y = 0; y < tall; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const x0 = Math.floor(left + x * step);
      const x1 = Math.max(x0 + 1, Math.floor(left + (x + 1) * step));
      const y0 = Math.floor(top + y * step);
      const y1 = Math.max(y0 + 1, Math.floor(top + (y + 1) * step));
      const sum = [0, 0, 0];
      let solid = 0;
      let bright = 0;
      let total = 0;
      for (let iy = y0; iy < y1 && iy < shore; iy += 1) {
        for (let ix = x0; ix < x1 && ix < h.W; ix += 1) {
          total += 1;
          const i = iy * h.W + ix;
          if (empty(i)) continue;
          const p = h.pix[i];
          sum[0] += p & 255;
          sum[1] += (p >> 8) & 255;
          sum[2] += (p >> 16) & 255;
          solid += 1;
          bright += lit[i];
        }
      }
      if (!solid || solid / total < MIN_COVER) continue;
      const at = (y * W + x) * 4;
      cells[at] = Math.round(sum[0] / solid);
      cells[at + 1] = Math.round(sum[1] / solid);
      cells[at + 2] = Math.round(sum[2] / solid);
      cells[at + 3] = bright / solid > MIN_LIT ? 2 : 1;
      // La luz roja de la aguja: la primera celda llena, en lo más alto de la silueta
      if (tip < 0) tip = y * W + x;
    }
  }
  return { W, H: tall, tip, cells };
}
