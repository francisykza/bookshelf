// El motor de los exteriores en 3D («Exteriores en 3D», 11-11-2026): lo que comparten la calle del edificio (calle3d.js)
// y la plaza del Gran Hotel (hotel/hotel3d.js). Las cajas de un dibujo 2D se «graban» con un rasterizador de mentira,
// cada cara que se ve se pinta en una lámina de textura con las mismas rampas y el mismo tramado que en el 2D, y todas
// van juntas en una sola malla. La vista es la de una persona de pie: se mira a los lados y arriba y abajo, y se anda
// entre unos sitios fijos. Three.js a 320 px de ancho, ampliado sin suavizar, y solo se dibuja cuando algo cambia.
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createRaster } from '../minigames/libreria-puerto/raster';

export const ART_W = 320;
export const PX = 32; // píxeles de textura por unidad, como el piso y la recepción
/** Campo de visión horizontal en vertical (móvil), y vertical en apaisado. Tope vertical para no deformar. */
const HFOV = 54;
const VFOV_LANDSCAPE = 74;
const VFOV_MAX = 90;
const DRAG = 0.004;
const KEY_STEP = 0.08;
const TAP_SLOP = 6;
/** El cilindro del cielo: radio y alto. */
export const SKY_R = 70;
export const SKY_H = 200;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const R = (c) => c & 255;
export const G = (c) => (c >> 8) & 255;
export const B = (c) => (c >> 16) & 255;
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Solo se usa por sus rampas de tonos y su tramado: no dibuja nada
let probeRaster = null;
export const probe = () => (probeRaster ??= createRaster({ W: 2, H: 2, S: 1, yaw: 0, ox: 0, oy: 0 }));

/**
 * Un rasterizador de mentira con lo que usan los dibujos de cajas: guarda las cajas en vez de pintarlas. `project` solo da
 * un píxel para el tramado de la pared (en el 3D, el de la textura); las sombras proyectadas se guardan para el suelo.
 */
export function recorder() {
  const p = probe();
  const boxes = [];
  const shadows = [];
  let id = 0;
  return {
    boxes,
    shadows,
    rampOf: p.rampOf,
    bayerAt: p.bayerAt,
    setId: (v) => {
      id = v;
    },
    project: (x, y, z) => ({
      sx: Math.round(x * PX),
      sy: Math.round(-z * PX),
      d: 0,
    }),
    castShadow: (x, y, z, r) => shadows.push({ x: x + z, y: y - 0.25 * z, r }),
    box(x0, y0, z0, x1, y1, z1, c, { seed = 0, grain = 1, face = null } = {}) {
      boxes.push({ b: [x0, y0, z0, x1, y1, z1], c, seed, grain, face, id });
    },
  };
}

/**
 * Las caras de una caja que se ven desde alguno de los ojos (`eyes`, [x, y, z]), cada una con su esquina de arriba a la
 * izquierda (`o`), sus dos lados (`u`, a lo ancho; `v`, hacia abajo), qué función de detalles le toca (la del 2D: 'top',
 * 'front' o 'side'), su tono de partida en la rampa (los del 2D: arriba 3,4, frente 2,3, lateral 1,2; los que el 2D no
 * ve, más oscuros) y cómo se pasa de un punto del mundo a las dos coordenadas (a, b) de esa función.
 */
export function facesOf({ b: [x0, y0, z0, x1, y1, z1] }, eyes) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const out = [];
  const add = (f) => {
    const n = f.n;
    if (eyes.some((e) => n[0] * (e[0] - f.o[0]) + n[1] * (e[1] - f.o[1]) + n[2] * (e[2] - f.o[2]) > 1e-6)) out.push(f);
  };
  if (dx > 1e-4 && dz > 1e-4)
    add({
      kind: 'front',
      fn: 'front',
      base: 2.3,
      n: [0, 1, 0],
      o: [x0, y1, z1],
      u: [dx, 0, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[0], p[2]],
    });
  if (dy > 1e-4 && dz > 1e-4)
    add({
      kind: 'side',
      fn: 'side',
      base: 1.2,
      n: [1, 0, 0],
      o: [x1, y1, z1],
      u: [0, -dy, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[1], p[2]],
    });
  if (dy > 1e-4 && dz > 1e-4)
    add({
      kind: 'side0',
      fn: 'side',
      base: 1.9,
      n: [-1, 0, 0],
      o: [x0, y0, z1],
      u: [0, dy, 0],
      v: [0, 0, -dz],
      ab: (p) => [p[1], p[2]],
    });
  if (dx > 1e-4 && dy > 1e-4)
    add({
      kind: 'top',
      fn: 'top',
      base: 3.4,
      n: [0, 0, 1],
      o: [x0, y0, z1],
      u: [dx, 0, 0],
      v: [0, dy, 0],
      ab: (p) => [p[0], p[1]],
    });
  if (dx > 1e-4 && dy > 1e-4 && z0 > 0.01)
    add({
      kind: 'bottom',
      fn: 'top',
      base: 1.0,
      n: [0, 0, -1],
      o: [x0, y1, z0],
      u: [dx, 0, 0],
      v: [0, -dy, 0],
      ab: (p) => [p[0], p[1]],
    });
  return out;
}

/** Reparte las láminas en un atlas (por estantes, de la más alta a la más baja), con un texel de margen repetido. */
export function packAtlas(items, width = 2048) {
  const order = [...items.keys()].sort((p, q) => items[q].h - items[p].h);
  let x = 0;
  let y = 0;
  let row = 0;
  for (const k of order) {
    const it = items[k];
    const w = it.w + 2;
    const h = it.h + 2;
    if (x + w > width) {
      y += row;
      x = 0;
      row = 0;
    }
    it.ax = x + 1;
    it.ay = y + 1;
    x += w;
    row = Math.max(row, h);
  }
  const height = y + row;
  const data = new Uint32Array(width * height);
  for (const it of items) {
    for (let j = -1; j <= it.h; j += 1) {
      const sj = clamp(j, 0, it.h - 1);
      for (let i = -1; i <= it.w; i += 1) data[(it.ay + j) * width + it.ax + i] = it.pix[sj * it.w + clamp(i, 0, it.w - 1)];
    }
  }
  return { width, height, data };
}

export function texture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
}
export function canvasFrom(w, h, data) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.buffer), w, h), 0, 0);
  return canvas;
}

/**
 * Las cajas grabadas, en una sola malla con su atlas. `paint(box, cara, w, h)` pinta cada cara (w × h texels). Mundo de
 * la app → Three: (x, z, y).
 */
export function buildMesh(boxes, eyes, paint) {
  const items = [];
  for (const box of boxes) {
    for (const f of facesOf(box, eyes)) {
      const len = (v) => Math.hypot(v[0], v[1], v[2]);
      const w = Math.max(1, Math.round(len(f.u) * PX));
      const h = Math.max(1, Math.round(len(f.v) * PX));
      items.push({ f, w, h, pix: paint(box, f, w, h) });
    }
  }
  const atlas = packAtlas(items);
  const pos = [];
  const uv = [];
  const index = [];
  for (const { f, w, h, ax, ay } of items) {
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const base = pos.length / 3;
    for (const [s, t] of corners) {
      const p = [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t, f.o[2] + f.u[2] * s + f.v[2] * t];
      pos.push(p[0], p[2], p[1]);
      uv.push((ax + s * w) / atlas.width, (ay + t * h) / atlas.height);
    }
    // El orden de los triángulos, para que miren hacia fuera (en Three, con y y z cambiados)
    const n3 = [f.n[0], f.n[2], f.n[1]];
    const u3 = [f.u[0], f.u[2], f.u[1]];
    const v3 = [f.v[0], f.v[2], f.v[1]];
    const cross = [u3[1] * v3[2] - u3[2] * v3[1], u3[2] * v3[0] - u3[0] * v3[2], u3[0] * v3[1] - u3[1] * v3[0]];
    if (cross[0] * n3[0] + cross[1] * n3[1] + cross[2] * n3[2] > 0) index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return {
    pos,
    uv,
    index,
    atlasCanvas: canvasFrom(atlas.width, atlas.height, atlas.data),
    faces: items.length,
    atlas: [atlas.width, atlas.height],
  };
}

/** Sube una malla de buildMesh a una escena. `own` apunta lo que hay que liberar al desmontar. */
export function meshOf(built, own) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(built.pos, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(built.uv, 2));
  geometry.setIndex(built.index);
  const atlasTex = texture(built.atlasCanvas);
  atlasTex.flipY = false;
  return new Mesh(own(geometry), own(new MeshBasicMaterial({ map: own(atlasTex) })));
}

/**
 * Monta un exterior en `container`. `world`: lo que cambia de un sitio a otro:
 * - `build(scene, own)`: añade lo suyo a la escena y devuelve sus cifras (para `stats`);
 * - `eye`: la altura de los ojos (`z`); `spots`: los sitios por donde se anda (`home`, la vista de siempre);
 * - `homePitch(fovRad)`: cuánto se mira hacia arriba en la vista de siempre, según el campo de visión vertical;
 * - `yawMax`, `pitchDown`, `pitchUp`: cuánto se gira a los lados y cuánto se baja (o se sube) la vista desde la de siempre;
 * - `clear` ([r, g, b]), `sky()` (el lienzo del cielo, pintado para el cilindro de SKY_R × SKY_H), `className`, `label`;
 * - `bloom` (opcional, { strength, radius, threshold }): el resplandor de lo que brilla (luces, neón);
 * - `tick(ahora)` (opcional): anima lo suyo en cada fotograma; si devuelve true, sigue pidiendo fotogramas (a unos 30 por
 *   segundo). Con movimiento reducido no se llama.
 * `dragArea` (opcional): el elemento que recibe el arrastre (por defecto, el lienzo). La app pone encima botones:
 * arrastrar sobre ellos también gira, y un arrastre no cuenta como toque.
 */
export function mountExterior(container, world, { startYaw = 0, startPitch = null, dragArea = null, onLost = () => {}, onFrame = () => {} } = {}) {
  const { eye: EYE, spots: SPOTS, yawMax: YAW_MAX = 0.5, pitchDown: PITCH_DOWN = 0.3, pitchUp: PITCH_UP = 0 } = world;
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  const canvas = renderer.domElement;
  canvas.className = world.className;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', world.label);
  renderer.setPixelRatio(1);
  const top = world.clear;
  renderer.setClearColor((top[0] << 16) | (top[1] << 8) | top[2]);

  const scene = new Scene();
  // El fondo, como parte de la escena (con el resplandor, el color de borrado no pasa por la misma conversión de color)
  scene.background = new Color((top[0] << 16) | (top[1] << 8) | top[2]);
  const camera = new PerspectiveCamera(70, 1, 0.2, 400);
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const stats = world.build(scene, own);
  // El resplandor: se pinta a la misma resolución baja que todo, así que sale en bloques, como el resto
  let composer = null;
  if (world.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(ART_W, ART_W), world.bloom.strength, world.bloom.radius, world.bloom.threshold));
    composer.addPass(new OutputPass());
    own(composer);
  }
  let lastTick = 0;
  const sky = new Mesh(
    own(new CylinderGeometry(SKY_R, SKY_R, SKY_H + 5, 48, 1, true)),
    own(
      new MeshBasicMaterial({
        map: own(texture(world.sky())),
        side: BackSide,
        depthWrite: false,
      }),
    ),
  );
  sky.position.set(SPOTS.home.x, (SKY_H - 5) / 2, SPOTS.home.y);
  sky.renderOrder = -1;
  scene.add(sky);

  let yaw = clamp(startYaw, -YAW_MAX, YAW_MAX);
  // Dónde están los ojos (se mueven solo al andar) y el paseo en curso: { keys: [{ x, y, yaw, pitch }], t0, ms, done }
  const at = { ...SPOTS.home };
  let path = null;
  let pitch = 0;
  let pitchHome = 0;
  const pitchRange = () => [pitchHome - PITCH_DOWN, pitchHome + PITCH_UP];
  let raf = 0;
  let destroyed = false;
  let renders = 0;
  let pitchStart = startPitch;
  // Un paseo de la vista (al llegar): { from: [yaw, pitch], to, t0, ms }
  let glide = null;

  function aim() {
    if (glide) {
      const k = Math.min(1, (performance.now() - glide.t0) / glide.ms);
      const e = 1 - (1 - k) ** 3;
      yaw = glide.from[0] + (glide.to[0] - glide.from[0]) * e;
      pitch = glide.from[1] + (glide.to[1] - glide.from[1]) * e;
      if (k >= 1) glide = null;
    }
    if (path) {
      const k = Math.min(1, (performance.now() - path.t0) / path.ms);
      // Arranca y para despacio; cada tramo dura lo que mide (andar y girar)
      const e = k * k * (3 - 2 * k);
      const { keys, lens, total } = path;
      let dist = e * total;
      let i = 0;
      while (i < lens.length - 1 && dist > lens[i]) {
        dist -= lens[i];
        i += 1;
      }
      const t = lens[i] ? Math.min(1, dist / lens[i]) : 1;
      const a = keys[i];
      const b = keys[i + 1];
      at.x = a.x + (b.x - a.x) * t;
      at.y = a.y + (b.y - a.y) * t;
      yaw = a.yaw + (b.yaw - a.yaw) * t;
      // La vista de siempre se mira al pintar: si el móvil gira a medio paso, se llega a la nueva
      const pa = a.pitch === 'home' ? pitchHome : a.pitch;
      pitch = pa + ((b.pitch === 'home' ? pitchHome : b.pitch) - pa) * t;
      if (k >= 1) {
        const done = path.done;
        path = null;
        done();
      }
    }
    camera.position.set(at.x, EYE.z, at.y);
    sky.position.x = at.x;
    sky.position.z = at.y;
    const d = 10;
    camera.lookAt(at.x + Math.sin(yaw) * d, EYE.z + Math.tan(pitch) * d, at.y - Math.cos(yaw) * d);
  }
  function draw() {
    raf = 0;
    if (destroyed || document.visibilityState === 'hidden') return;
    const now = performance.now();
    const moving = glide || path;
    // Lo que se anima solo va a unos 30 fotogramas por segundo (si no hay nada más moviéndose)
    if (!moving && renders > 0 && world.tick && !reduced() && now - lastTick < 30) {
      invalidate();
      return;
    }
    lastTick = now;
    const more = world.tick && !reduced() ? world.tick(now) : false;
    aim();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    renders += 1;
    onFrame();
    if (moving || more) invalidate();
  }
  function invalidate() {
    if (!raf && !destroyed) raf = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)), false);
    composer?.setSize(ART_W, Math.max(1, Math.round((ART_W * rect.height) / rect.width)));
    camera.aspect = rect.width / rect.height;
    const portrait = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.fov = camera.aspect < 1 ? Math.min(VFOV_MAX, portrait) : VFOV_LANDSCAPE;
    camera.updateProjectionMatrix();
    const was = pitch - pitchHome;
    pitchHome = world.homePitch((camera.fov * Math.PI) / 180);
    pitch = clamp(pitchHome + was, ...pitchRange());
    if (pitchStart != null) {
      pitch = clamp(pitchHome + pitchStart, ...pitchRange());
      pitchStart = null;
    }
    invalidate();
  }

  // Mirar: arrastrar (a los lados gira; arriba y abajo, solo hasta la vista de siempre) o las flechas
  const stop = new AbortController();
  const on = { signal: stop.signal };
  let press = null;
  const pad = dragArea ?? canvas;
  // Tras un arrastre, el «click» que el navegador manda al soltar no es un toque
  let dragged = false;
  pad.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true, signal: stop.signal },
  );
  pad.addEventListener(
    'pointerdown',
    (e) => {
      if (press) return;
      press = {
        x: e.clientX,
        y: e.clientY,
        yaw,
        pitch,
        id: e.pointerId,
        moved: false,
      };
      dragged = false;
    },
    on,
  );
  pad.addEventListener(
    'pointermove',
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) {
        press.moved = true;
        dragged = true;
        glide = null;
        try {
          pad.setPointerCapture?.(e.pointerId);
        } catch {
          // Sin captura, se sigue mientras el dedo esté encima
        }
      }
      if (!press.moved || path) return;
      yaw = clamp(press.yaw + (e.clientX - press.x) * DRAG, -YAW_MAX, YAW_MAX);
      pitch = clamp(press.pitch + (e.clientY - press.y) * DRAG, ...pitchRange());
      invalidate();
    },
    on,
  );
  const release = (e) => {
    if (press && e.pointerId === press.id) press = null;
  };
  pad.addEventListener('pointerup', release, on);
  pad.addEventListener('pointercancel', release, on);
  canvas.addEventListener(
    'keydown',
    (e) => {
      const k = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowUp: [0, KEY_STEP],
        ArrowDown: [0, -KEY_STEP],
      }[e.key];
      if (!k || path) return;
      e.preventDefault();
      yaw = clamp(yaw + k[0], -YAW_MAX, YAW_MAX);
      pitch = clamp(pitch + k[1], ...pitchRange());
      invalidate();
    },
    on,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      onLost();
    },
    on,
  );
  document.addEventListener('visibilitychange', invalidate, on);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.append(canvas);
  resize();

  const tmp = new Vector3();
  return {
    canvas,
    yaw: () => yaw,
    pitch: () => pitch,
    setView(y, p = pitchHome) {
      // Poner la vista de golpe para un giro que estuviera en marcha
      glide = null;
      yaw = clamp(y, -YAW_MAX, YAW_MAX);
      pitch = clamp(p, ...pitchRange());
      invalidate();
    },
    pitchHome: () => pitchHome,
    /**
     * Andar por `keys` ([{ x, y, yaw, pitch }]; `pitch: 'home'` es la vista de siempre, y un punto con `spot` toma su
     * sitio de los del mundo) desde donde estás (o desde `from`). Con movimiento reducido, de golpe. La promesa se
     * cumple al llegar.
     */
    walk(keys, { ms = null, from = null } = {}) {
      glide = null;
      const fix = (k) => {
        const p = k.spot ? SPOTS[k.spot] : k;
        return { x: p.x, y: p.y, yaw: k.yaw ?? 0, pitch: k.pitch == null ? 'home' : k.pitch };
      };
      if (from) {
        const f = fix(from);
        Object.assign(at, { x: f.x, y: f.y });
        yaw = f.yaw;
        pitch = f.pitch === 'home' ? pitchHome : f.pitch;
      }
      const list = [{ x: at.x, y: at.y, yaw, pitch }, ...keys.map(fix)];
      const lens = list.slice(1).map((b, i) => Math.hypot(b.x - list[i].x, b.y - list[i].y) + Math.abs(b.yaw - list[i].yaw) * 1.3 + 1e-3);
      const total = lens.reduce((a, b) => a + b, 0);
      return new Promise((resolve) => {
        if (reduced()) {
          const last = list[list.length - 1];
          Object.assign(at, { x: last.x, y: last.y });
          yaw = last.yaw;
          pitch = last.pitch === 'home' ? pitchHome : last.pitch;
          invalidate();
          resolve();
          return;
        }
        path = { keys: list, lens, total, t0: performance.now(), ms: ms ?? Math.max(500, total * 420), done: resolve };
        invalidate();
      });
    },
    walking: () => Boolean(path),
    where: () => ({ ...at }),
    /** Llevar la vista poco a poco hasta (yaw, cabeceo respecto a la de siempre). Con movimiento reducido, de golpe. */
    glideTo(y, dp = 0, ms = 1100) {
      const to = [clamp(y, -YAW_MAX, YAW_MAX), clamp(pitchHome + dp, ...pitchRange())];
      if (reduced()) [yaw, pitch] = to;
      else glide = { from: [yaw, pitch], to, t0: performance.now(), ms };
      invalidate();
    },
    settled: () => !glide && !path,
    renders: () => renders,
    /** Cuántas caras y de qué tamaño es el atlas (para vigilar lo que pesa). */
    stats: () => stats,
    /** Dónde cae en la pantalla un punto del mundo de la app (px del contenedor). */
    toScreen(x, y, z) {
      aim();
      tmp.set(x, z, y).project(camera);
      // Con el tamaño sin transformar (al asomarse, la vista se amplía con CSS)
      return {
        x: ((tmp.x + 1) / 2) * container.clientWidth,
        y: ((1 - tmp.y) / 2) * container.clientHeight,
        visible: tmp.z < 1,
      };
    },
    /** Pide un dibujo nuevo (lo que se anima por su cuenta, como las luces del hotel). */
    invalidate,
    reduced,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stop.abort();
      observer.disconnect();
      for (const x of owned) x.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}
