// Ambiente del lienzo (SPEC §12.6–§12.7, 1.18.0): ondas y reflejos dentro del polígono del mar, polvo solo
// en los haces de luz, el velero, las luces del pueblo y las luciérnagas de noche y las burbujas del té. La
// ilustración base no se mueve: todo es una capa fina encima, en coordenadas de la imagen.
//
// Presupuesto: una sola cadena requestAnimationFrame, movimiento por tiempo (delta ≤ 50 ms), acumulador para
// limitar los fps del perfil, sprites pre-renderizados y ninguna asignación por fotograma. Perfiles:
// `balanced` (60 fps, DPR ≤ 1,5), `light` (30 fps, DPR ≤ 1) y `reduced` (un fotograma estático). El perfil se
// adapta midiendo la mediana del intervalo de fotograma; al pausar se conservan las fases y el reloj.
import { useEffect, useRef } from 'react';
import { pointInPolygon } from '../../scene/homography';
import { LITE_SCENE } from '../../scene/renderMode';
import { BOAT_LANE, FAR_COAST, MOON, SCENE_H, SCENE_W, SEA, SUN_PATH, TEA_GLASS, TOWN } from '../../scene/sceneMap';
import { BEAMS } from './beams';

const PROFILES = {
  balanced: { fps: 60, dpr: 1.5, ripples: 12, glints: 10, dust: 14, fireflies: 8, lights: 26, bubbles: 8 },
  light: { fps: 30, dpr: 1, ripples: 6, glints: 5, dust: 6, fireflies: 4, lights: 14, bubbles: 4 },
};

// Adaptación (SPEC §12.7)
const SAMPLE_WINDOW_MS = 3000;
const DOWNGRADE_MEDIAN_MS = 24;
const TRIM_MEDIAN_MS = 40;
const UPGRADE_MEDIAN_MS = 18;
const UPGRADE_AFTER_MS = 15000;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEA_BOX = { x: 497, y: 611, w: 408, h: 154 };
const between = (random, a, b) => a + random() * (b - a);

function seaPoint(random, focusX, spread) {
  for (let i = 0; i < 40; i += 1) {
    const x = focusX !== null ? focusX + (random() - 0.5) * spread : SEA_BOX.x + random() * SEA_BOX.w;
    const y = SEA_BOX.y + 6 + random() * (SEA_BOX.h - 12);
    if (pointInPolygon(x, y, SEA)) return { x, y };
  }
  return { x: 820, y: 680 };
}

/** Un punto dentro de un haz de luz (el polvo solo vive donde hay luz). */
function beamPoint(random, beams) {
  const b = beams[Math.floor(random() * beams.length)];
  const along = (random() - 0.5) * b.len * 0.8;
  const across = (random() - 0.5) * b.w * 1.4;
  return { x: b.x + b.dx * along - b.dy * across, y: b.y + b.dy * along + b.dx * across, beam: b };
}

/** Sprite circular suave pre-renderizado (sin gradientes por fotograma). */
function sprite(size, rgb, core = 0.9) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},${core})`);
  grad.addColorStop(0.45, `rgba(${rgb},${core * 0.35})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Trazo horizontal suave (onda): más claro en el centro y transparente en los extremos. */
function rippleSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 6;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, `rgba(${rgb},0)`);
  grad.addColorStop(0.5, `rgba(${rgb},1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(32, 3, 32, 1.4, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

const TOD = {
  morning: { ripple: '255,255,250', rippleAlpha: [0.08, 0.22], glint: '255,241,196', focus: SUN_PATH.x + SUN_PATH.w / 2, spread: 170 },
  sunset: { ripple: '255,222,186', rippleAlpha: [0.08, 0.2], glint: '255,241,196', focus: 860, spread: 150 },
  night: { ripple: '214,226,250', rippleAlpha: [0.04, 0.12], glint: '220,232,244', focus: MOON.x, spread: 70 },
};

function createSprites() {
  return {
    ripple: { morning: rippleSprite(TOD.morning.ripple), sunset: rippleSprite(TOD.sunset.ripple), night: rippleSprite(TOD.night.ripple) },
    glintDay: sprite(24, '255,241,196'),
    glintNight: sprite(24, '220,232,244'),
    dust: sprite(8, '255,230,171', 1),
    light: sprite(16, '255,206,130', 0.95),
    firefly: sprite(20, '220,255,150', 1),
  };
}

/** Todo lo que se mueve, creado una vez por hora del día con fases deterministas. */
function createWorld(timeOfDay) {
  const tod = TOD[timeOfDay] ?? TOD.morning;
  const random = rng(timeOfDay === 'night' ? 19 : timeOfDay === 'sunset' ? 7 : 3);
  const max = PROFILES.balanced;
  const ripples = Array.from({ length: max.ripples }, () => ({
    ...seaPoint(random, null, 0),
    len: between(random, 12, 38),
    ampX: between(random, 3, 8),
    ampY: between(random, 0.6, 2),
    period: between(random, 4, 7),
    phase: random() * Math.PI * 2,
    alpha: between(random, tod.rippleAlpha[0], tod.rippleAlpha[1]),
  }));
  const glints = Array.from({ length: max.glints }, () => ({
    ...seaPoint(random, tod.focus, tod.spread),
    period: between(random, 3.5, 6),
    phase: random() * Math.PI * 2,
    size: between(random, 7, 12),
  }));
  // Rayos de luz y polvo solo de día (de noche no hay fuente real)
  const beams = timeOfDay === 'night' ? [] : BEAMS.slice(0, 2);
  const dust = beams.length
    ? Array.from({ length: max.dust }, () => {
        const p = beamPoint(random, beams);
        return { ...p, ox: p.x, oy: p.y, r: between(random, 0.5, 1.2), speed: between(random, 2, 5), phase: random() * Math.PI * 2 };
      })
    : [];
  const fireflies =
    timeOfDay === 'night'
      ? Array.from({ length: max.fireflies }, () => ({ x: between(random, 480, 810), y: between(random, 790, 960), phase: random() * Math.PI * 2, period: between(random, 4, 7) }))
      : [];
  const lightsCount = timeOfDay === 'night' ? max.lights : timeOfDay === 'sunset' ? Math.round(max.lights / 2) : 0;
  const lights = Array.from({ length: lightsCount }, (_, i) => {
    const box = i % 4 === 3 ? FAR_COAST : TOWN;
    return { x: box.x + random() * box.w, y: box.y + random() * box.h, phase: random() * Math.PI * 2, size: i % 4 === 3 ? 5 : between(random, 6, 9) };
  });
  const bubbles = Array.from({ length: max.bubbles }, () => ({
    x: TEA_GLASS.x + 8 + random() * (TEA_GLASS.w - 16),
    y: TEA_GLASS.y + random() * TEA_GLASS.h,
    v: between(random, 6, 12),
    r: between(random, 0.6, 1.2),
    phase: random() * Math.PI * 2,
  }));
  return { timeOfDay, tod, ripples, glints, dust, fireflies, lights, bubbles, random };
}

let seaPath = null;
const getSeaPath = () => {
  if (!seaPath) {
    seaPath = new Path2D();
    SEA.forEach(([x, y], i) => (i ? seaPath.lineTo(x, y) : seaPath.moveTo(x, y)));
    seaPath.closePath();
  }
  return seaPath;
};

function drawBoat(c, t, tod) {
  const span = BOAT_LANE.to - BOAT_LANE.from;
  const p = (((t / 140) % 1) + 1) % 1;
  const x = BOAT_LANE.from + span * p;
  const y = BOAT_LANE.y + Math.sin(t * 1.4) * 0.8;
  if (!pointInPolygon(x, y + 2, SEA)) return;
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 0.9) * 0.05);
  c.globalAlpha = tod === 'night' ? 0.5 : 0.9;
  c.fillStyle = tod === 'night' ? '#2a3050' : '#5a3a24';
  c.beginPath();
  c.moveTo(-6, 0);
  c.lineTo(6, 0);
  c.lineTo(4, 2.4);
  c.lineTo(-4, 2.4);
  c.closePath();
  c.fill();
  c.fillStyle = tod === 'sunset' ? '#ffe2c4' : tod === 'night' ? '#aeb8d8' : '#fffdf6';
  c.beginPath();
  c.moveTo(0, -0.5);
  c.lineTo(0, -11);
  c.lineTo(5, -1.2);
  c.closePath();
  c.fill();
  c.restore();
}

/**
 * Un fotograma. Se borra en coordenadas de buffer (transformación identidad) y se restablece la lógica.
 * `count` limita cuántos elementos de cada grupo se dibujan según el perfil.
 */
function draw(c, density, world, sprites, t, count, teaLevel) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  c.setTransform(density, 0, 0, density, 0, 0);
  const tod = world.timeOfDay;
  const TAU = Math.PI * 2;

  // Mar: ondas horizontales y reflejos, recortados al polígono del agua
  c.save();
  c.clip(getSeaPath());
  const rs = sprites.ripple[tod] ?? sprites.ripple.morning;
  for (let i = 0; i < Math.min(count.ripples, world.ripples.length); i += 1) {
    const r = world.ripples[i];
    const w = (TAU * t) / r.period + r.phase;
    const breathe = 0.55 + 0.45 * Math.sin(w * 0.5);
    c.globalAlpha = r.alpha * breathe;
    const x = r.x + Math.sin(w) * r.ampX;
    const y = r.y + Math.cos(w) * r.ampY;
    c.drawImage(rs, x - r.len / 2, y - 1.5, r.len, 3);
  }
  const gs = tod === 'night' ? sprites.glintNight : sprites.glintDay;
  const glintMax = tod === 'night' ? 0.4 : 0.55;
  for (let i = 0; i < Math.min(count.glints, world.glints.length); i += 1) {
    const g = world.glints[i];
    // Ciclo suave (sin destellos bruscos): coseno elevado
    const a = 0.5 - 0.5 * Math.cos((TAU * t) / g.period + g.phase);
    c.globalAlpha = a * a * glintMax;
    c.drawImage(gs, g.x - g.size / 2, g.y - g.size / 4, g.size, g.size / 2);
  }
  c.restore();
  drawBoat(c, t, tod);

  // Polvo: motas lentas que solo brillan dentro de los haces
  // De noche no hay polvo (no hay haces de luz): cada bucle se limita a lo que existe
  for (let i = 0; i < Math.min(count.dust, world.dust.length); i += 1) {
    const d = world.dust[i];
    const a = 0.18 * (0.5 + 0.5 * Math.sin(t * 0.8 + d.phase));
    if (a < 0.02) continue;
    c.globalAlpha = a;
    const s = d.r * 4;
    c.drawImage(sprites.dust, d.x - s / 2, d.y - s / 2, s, s);
  }

  // Luces del pueblo: parpadeo lento
  for (let i = 0; i < Math.min(count.lights, world.lights.length); i += 1) {
    const l = world.lights[i];
    c.globalAlpha = 0.65 + 0.25 * Math.sin(t * 1.1 + l.phase);
    c.drawImage(sprites.light, l.x - l.size / 2, l.y - l.size / 2, l.size, l.size);
  }

  // Luciérnagas entre las flores del balcón
  for (let i = 0; i < Math.min(count.fireflies, world.fireflies.length); i += 1) {
    const f = world.fireflies[i];
    const pulse = 0.5 - 0.5 * Math.cos((TAU * t) / f.period + f.phase);
    c.globalAlpha = pulse * 0.7;
    const x = f.x + Math.sin(t * 0.35 + f.phase) * 18;
    const y = f.y + Math.cos(t * 0.27 + f.phase) * 10;
    c.drawImage(sprites.firefly, x - 8, y - 8, 16, 16);
  }

  // Burbujas del té helado (bajo el nivel cuando se está vaciando)
  const teaTop = teaLevel === null ? 0 : TEA_GLASS.y + TEA_GLASS.h * (1 - teaLevel);
  c.strokeStyle = 'rgba(255,248,225,0.7)';
  c.lineWidth = 0.5;
  for (let i = 0; i < Math.min(count.bubbles, world.bubbles.length); i += 1) {
    const b = world.bubbles[i];
    const span = TEA_GLASS.h;
    const y = TEA_GLASS.y + span - (((b.v * t + b.phase * 20) % span) + span) % span;
    if (y < teaTop) continue;
    c.globalAlpha = 0.45 + 0.3 * Math.sin(t * 2 + b.phase);
    c.beginPath();
    c.arc(b.x + Math.sin(t * 1.6 + b.phase) * 0.8, y, b.r, 0, TAU);
    c.stroke();
  }
  c.globalAlpha = 1;
}

/** El polvo deriva despacio a lo largo de su haz (2–5 px/s) y vuelve a empezar dentro de la luz. */
function step(world, dt) {
  for (const d of world.dust) {
    d.x += -d.beam.dx * d.speed * dt;
    d.y += -d.beam.dy * d.speed * dt;
    if (Math.hypot(d.x - d.ox, d.y - d.oy) > 90) {
      d.x = d.ox;
      d.y = d.oy;
    }
  }
}

function median(buf, n) {
  const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? 0;
}

export function RoomAtmosphereCanvas({ timeOfDay, scale, paused, reducedMotion, teaLevelRef }) {
  const ref = useRef(null);
  // Estado persistente del motor: perfil, reloj lógico, mundo y sprites (sobrevive a pausas y modales)
  const engine = useRef(null);
  if (!engine.current) {
    engine.current = {
      profile: LITE_SCENE ? 'light' : 'balanced',
      trim: false,
      clock: 0,
      world: null,
      sprites: null,
      density: 1,
      lastChange: 0,
      downgrades: 0,
      samples: new Float32Array(240),
      sampleCount: 0,
      sampleStart: 0,
      calm: 0,
    };
  }

  // Tamaño del buffer: solo cambia con la escala o el perfil, nunca por fotograma
  const sizeCanvas = () => {
    const canvas = ref.current;
    const e = engine.current;
    if (!canvas) return;
    const cap = PROFILES[e.profile]?.dpr ?? 1;
    e.density = Math.max(0.2, scale) * Math.min(window.devicePixelRatio || 1, cap);
    const w = Math.round(SCENE_W * e.density);
    const h = Math.round(SCENE_H * e.density);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.dataset.profile = reducedMotion ? 'reduced' : e.profile;
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : e.profile;
  };

  useEffect(() => {
    const e = engine.current;
    if (!e.world || e.world.timeOfDay !== timeOfDay) e.world = createWorld(timeOfDay);
    e.sprites ??= createSprites();
  }, [timeOfDay]);

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    const e = engine.current;
    if (!canvas || !c) return undefined;
    e.world ??= createWorld(timeOfDay);
    e.sprites ??= createSprites();
    sizeCanvas();
    const counts = () => {
      const p = PROFILES[e.profile];
      return e.trim ? { ...p, dust: Math.ceil(p.dust / 2), glints: Math.ceil(p.glints / 2) } : p;
    };
    let count = counts();
    draw(c, e.density, e.world, e.sprites, e.clock, count, teaLevelRef?.current ?? null);
    // Movimiento reducido o pausa (librería, modal): fotograma quieto, sin cadena de animación
    if (reducedMotion || paused) return undefined;

    let frame = 0;
    let last = 0;
    let acc = 0;
    const restartSampling = (now) => {
      e.sampleCount = 0;
      e.sampleStart = now;
    };
    const setProfile = (next, now) => {
      if (next === e.profile) return;
      e.profile = next;
      e.lastChange = now;
      sizeCanvas();
      count = counts();
      restartSampling(now);
    };
    const adapt = (now, interval) => {
      if (e.sampleCount < e.samples.length) e.samples[e.sampleCount++] = interval;
      if (now - e.sampleStart < SAMPLE_WINDOW_MS) return;
      const m = median(e.samples, e.sampleCount);
      canvas.dataset.median = m.toFixed(1);
      if (e.profile === 'balanced' && m > DOWNGRADE_MEDIAN_MS) {
        e.downgrades += 1;
        setProfile('light', now);
      } else if (e.profile === 'light' && m > TRIM_MEDIAN_MS && !e.trim) {
        e.trim = true;
        count = counts();
      } else if (e.profile === 'light' && m <= UPGRADE_MEDIAN_MS) {
        e.calm += now - e.sampleStart;
        // Solo se sube tras 15 s seguidos con margen y 15 s desde el último cambio (sin oscilar)
        if (e.calm >= UPGRADE_AFTER_MS && now - e.lastChange >= UPGRADE_AFTER_MS && e.downgrades < 2) {
          e.calm = 0;
          setProfile('balanced', now);
        }
      } else e.calm = 0;
      restartSampling(now);
    };
    const loop = (now) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden) {
        last = 0;
        return;
      }
      if (!last) {
        // Primer fotograma o vuelta de una pausa: sin salto de tiempo
        last = now;
        restartSampling(now);
        return;
      }
      const interval = now - last;
      last = now;
      adapt(now, interval);
      const dt = Math.min(0.05, interval / 1000);
      acc += dt;
      const minStep = 1 / PROFILES[e.profile].fps;
      if (acc + 0.002 < minStep) return;
      const stepDt = Math.min(0.05, acc);
      acc = 0;
      e.clock += stepDt;
      step(e.world, stepDt);
      draw(c, e.density, e.world, e.sprites, e.clock, count, teaLevelRef?.current ?? null);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOfDay, scale, paused, reducedMotion]);

  return <canvas ref={ref} className="room-canvas" aria-hidden="true" />;
}
