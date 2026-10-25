// Superficie del mar en movimiento (SPEC §26.2): un canvas del tamaño de la bahía que redibuja el agua de la
// PROPIA ilustración con una deformación horizontal suave (dos ondas de distinta frecuencia y fase). Sustituye el
// agua dentro de la máscara —no es una copia semitransparente encima— y la deformación se anula al acercarse a los
// bordes del agua y alrededor de los veleros pintados, así que costa, pueblo, montes y marcos no se mueven y no hay
// costuras. Textura y máscara se preparan una vez; cada fotograma solo recorre los píxeles de agua (~30 fps), sin
// estado de React. En pausa cuando la bahía no anima; si algo falla, no se pinta nada (queda la ilustración).
import { useEffect, useRef, useState } from 'react';
import { insidePolygon } from '../../scene/sea';

/** Caja de las regiones de agua (px de la escena). */
export function waterBox(water) {
  const xs = water.flat().map((p) => p[0]);
  const ys = water.flat().map((p) => p[1]);
  const x = Math.floor(Math.min(...xs));
  const y = Math.floor(Math.min(...ys));
  return { x, y, w: Math.ceil(Math.max(...xs)) - x, h: Math.ceil(Math.max(...ys)) - y };
}

const FEATHER = 7; // px de escena: la deformación crece desde 0 en el borde del agua hasta su valor pleno
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/**
 * Peso de la deformación en un punto (0 fuera del agua; 0→1 en los `FEATHER` px junto al borde; 0 alrededor de
 * los veleros pintados `boats` = [cx, cy, rx, ry]).
 */
export function rippleWeight(x, y, water, boats = []) {
  const poly = water.find((p) => insidePolygon([x, y], p));
  if (!poly) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i += 1) d = Math.min(d, segDist(x, y, poly[i], poly[(i + 1) % poly.length]));
  let w = smooth(0, FEATHER, d);
  for (const [cx, cy, rx, ry] of boats) {
    const e = Math.hypot((x - cx) / rx, (y - cy) / ry);
    w *= smooth(1, 1.6, e);
  }
  return w;
}

const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;

export function SeaRipple({ src, sea, running }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const runningRef = useRef(running);
  runningRef.current = running;
  const box = waterBox(sea.water);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: false });
    if (!canvas || !ctx) {
      setFailed(true);
      return undefined;
    }
    let raf = 0;
    let alive = true;
    let job = null; // { W, H, s, src: Uint8ClampedArray, out: ImageData, idx, weight, depth, xs, ys }
    const img = new Image();
    img.decoding = 'async';

    // Prepara textura, máscara y búferes para la resolución actual (al cargar y al cambiar de tamaño)
    const prepare = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !img.naturalWidth) return;
      const s = Math.min(3, (rect.width / box.w) * Math.min(window.devicePixelRatio || 1, MAX_DPR));
      const W = Math.max(8, Math.round(box.w * s));
      const H = Math.max(8, Math.round(box.h * s));
      if (job && job.W === W && job.H === H) return;
      canvas.width = W;
      canvas.height = H;
      const fx = img.naturalWidth / (sea.imageWidth ?? img.naturalWidth);
      ctx.drawImage(img, box.x * fx, box.y * fx, box.w * fx, box.h * fx, 0, 0, W, H);
      const base = ctx.getImageData(0, 0, W, H);
      const idx = [];
      const weight = [];
      const depth = [];
      const xs = [];
      const ys = [];
      for (let py = 0; py < H; py += 1) {
        const y = box.y + (py + 0.5) / s;
        for (let px = 0; px < W; px += 1) {
          const x = box.x + (px + 0.5) / s;
          const w = rippleWeight(x, y, sea.water, sea.paintedBoats);
          if (w <= 0.001) continue;
          idx.push(py * W + px);
          weight.push(w);
          // Lejos (arriba) menos amplitud; en primer término, algo más
          depth.push(0.55 + 0.45 * ((y - box.y) / box.h));
          xs.push(x);
          ys.push(y);
        }
      }
      // px CSS → px del canvas (s ya incluye la escala de la escena y el DPR)
      const cssToCanvas = s / (rect.width / box.w);
      job = { W, H, src: base.data, out: new ImageData(new Uint8ClampedArray(base.data), W, H), idx: Int32Array.from(idx), weight: Float32Array.from(weight), depth: Float32Array.from(depth), xs: Float32Array.from(xs), ys: Float32Array.from(ys), cssToCanvas };
      ctx.putImageData(job.out, 0, 0);
    };

    // Un fotograma: desplazamiento horizontal de 1–2,5 px CSS (dos ondas, 6,4 s y 10,8 s), muestreo bilineal
    const draw = (now) => {
      if (!job) return;
      const { W, src: from, out, idx, weight, depth, xs, ys, cssToCanvas } = job;
      const o = out.data;
      const t = now / 1000;
      const p1 = (t * 2 * Math.PI) / 6.4;
      const p2 = (t * 2 * Math.PI) / 10.8;
      for (let k = 0; k < idx.length; k += 1) {
        const i = idx[k];
        const amp = (1 + 1.5 * (depth[k] - 0.55) / 0.45) * cssToCanvas * weight[k];
        const dx = amp * (0.62 * Math.sin(p1 + ys[k] * 0.21) + 0.38 * Math.sin(p2 + ys[k] * 0.09 + xs[k] * 0.035));
        const row = i - (i % W);
        const fx = (i % W) + dx;
        const x0 = Math.max(0, Math.min(W - 1, Math.floor(fx)));
        const x1 = Math.min(W - 1, x0 + 1);
        const f = fx - Math.floor(fx);
        const a = (row + x0) * 4;
        const b = (row + x1) * 4;
        const d = i * 4;
        o[d] = from[a] + (from[b] - from[a]) * f;
        o[d + 1] = from[a + 1] + (from[b + 1] - from[a + 1]) * f;
        o[d + 2] = from[a + 2] + (from[b + 2] - from[a + 2]) * f;
      }
      ctx.putImageData(out, 0, 0);
    };

    let last = 0;
    const loop = (now) => {
      raf = 0;
      if (!alive || !runningRef.current) return;
      if (now - last >= FRAME_MS) {
        last = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf && alive && runningRef.current) raf = requestAnimationFrame(loop);
    };

    img.onload = () => {
      if (!alive) return;
      try {
        prepare();
        kick();
      } catch {
        setFailed(true);
      }
    };
    img.onerror = () => alive && setFailed(true);
    img.src = src;
    const onResize = () => {
      try {
        prepare();
      } catch {
        setFailed(true);
      }
    };
    window.addEventListener('resize', onResize);
    canvas.__kick = kick;
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      job = null;
    };
  }, [src, sea, box.x, box.y, box.w, box.h]);

  // Reanudar al volver a animar (pestaña visible, habitación activa, sin panel)
  useEffect(() => {
    if (running) ref.current?.__kick?.();
  }, [running]);

  if (failed) return null;
  return <canvas ref={ref} className="sea-ripple" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true" />;
}
