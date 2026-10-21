// Motor de partículas a 60 fps (SPEC §2.2): destellos solares sobre la bahía, polen y polvo dorado en
// los haces de luz, luciérnagas del balcón y luces del pueblo al anochecer. Dibuja en coordenadas de
// la imagen; el lienzo tiene la resolución real en pantalla (escala × DPR) para verse nítido.
import { useEffect, useRef } from 'react';
import { LITE_SCENE } from '../../scene/renderMode';
import { pointInPolygon } from '../../scene/homography';
import { BOAT_LANE, FAR_COAST, MOON, SCENE_H, SCENE_W, SEA, SUN_PATH, TEA_GLASS, TOWN } from '../../scene/sceneMap';
import { BEAMS } from './beams';

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

function seaPoint(random, focusX, spread) {
  for (let i = 0; i < 40; i += 1) {
    const x = focusX !== null && random() < 0.7 ? focusX + (random() - 0.5) * spread : SEA_BOX.x + random() * SEA_BOX.w;
    const y = SEA_BOX.y + random() * SEA_BOX.h;
    if (pointInPolygon(x, y, SEA)) return { x, y };
  }
  return { x: 820, y: 680 };
}

function beamLight(x, y) {
  let light = 0;
  for (const b of BEAMS) {
    const dx = x - b.x;
    const dy = y - b.y;
    const along = dx * b.dx + dy * b.dy;
    const across = dx * -b.dy + dy * b.dx;
    if (along < -b.len / 2 || along > b.len / 2) continue;
    light = Math.max(light, Math.exp(-(across * across) / (2 * b.w * b.w)) * b.strength);
  }
  return light;
}

function createWorld(timeOfDay) {
  const random = rng(timeOfDay === 'night' ? 19 : timeOfDay === 'sunset' ? 7 : 3);
  const focus = timeOfDay === 'morning' ? SUN_PATH.x + SUN_PATH.w / 2 : timeOfDay === 'sunset' ? 860 : MOON.x;
  const glintCount = timeOfDay === 'night' ? 60 : timeOfDay === 'sunset' ? 130 : 180;
  const glints = Array.from({ length: glintCount }, () => ({
    ...seaPoint(random, focus, timeOfDay === 'night' ? 70 : 170),
    phase: random() * Math.PI * 2,
    speed: 1.4 + random() * 2.6,
    size: 1.6 + random() * 2.8,
  }));
  const dustCount = timeOfDay === 'night' ? 0 : timeOfDay === 'sunset' ? 50 : 110;
  const dust = Array.from({ length: dustCount }, () => ({
    x: random() * SCENE_W,
    y: 380 + random() * 1150,
    vx: (random() - 0.5) * 6,
    vy: -2 - random() * 5,
    phase: random() * Math.PI * 2,
    size: 0.8 + random() * 1.9,
  }));
  const fireflies =
    timeOfDay === 'night'
      ? Array.from({ length: 14 }, () => ({
          x: 480 + random() * 330,
          y: 790 + random() * 170,
          vx: (random() - 0.5) * 10,
          vy: (random() - 0.5) * 6,
          phase: random() * Math.PI * 2,
        }))
      : [];
  const lightsCount = timeOfDay === 'night' ? 40 : timeOfDay === 'sunset' ? 14 : 0;
  const lights = Array.from({ length: lightsCount }, (_, i) => {
    const far = i % 4 === 3;
    const box = far ? FAR_COAST : TOWN;
    return {
      x: box.x + random() * box.w,
      y: box.y + random() * box.h,
      phase: random() * Math.PI * 2,
      size: far ? 0.9 : 1.2 + random() * 1.1,
    };
  });
  // Crestas de ola: trazos claros que nacen en el horizonte y avanzan hacia la orilla
  const crests = Array.from({ length: 46 }, () => ({
    ...seaPoint(random, null, 0),
    len: 10 + random() * 26,
    speed: 2.5 + random() * 4,
    phase: random() * Math.PI * 2,
  }));
  // Pétalos blancos y rosados que la brisa arranca de la pérgola
  const petals = Array.from({ length: timeOfDay === 'night' ? 8 : 26 }, () => ({
    x: 420 + random() * 560,
    y: random() * 1500,
    vx: -10 - random() * 16,
    vy: 22 + random() * 22,
    rot: random() * Math.PI * 2,
    spin: (random() - 0.5) * 3,
    phase: random() * Math.PI * 2,
    pink: random() < 0.35,
    size: 2 + random() * 2.2,
  }));
  const butterflies =
    timeOfDay === 'night'
      ? []
      : Array.from({ length: 3 }, (_, i) => ({
          x: 500 + random() * 280,
          y: 820 + random() * 120,
          tx: 600,
          ty: 880,
          phase: random() * Math.PI * 2,
          color: ['255,236,150', '255,250,240', '255,178,96'][i],
          retarget: 0,
        }));
  // Motas doradas que flotan perezosas delante de la estantería
  const shelfMotes = Array.from({ length: timeOfDay === 'night' ? 18 : 30 }, () => ({
    x: 4 + random() * 250,
    y: 40 + random() * 760,
    vy: -2 - random() * 4,
    phase: random() * Math.PI * 2,
    size: 0.9 + random() * 1.6,
  }));

  // Burbujitas que suben entre el hielo del té
  const bubbles = Array.from({ length: 12 }, () => ({
    x: TEA_GLASS.x + random() * TEA_GLASS.w,
    y: TEA_GLASS.y + random() * TEA_GLASS.h,
    v: 6 + random() * 10,
    r: 0.6 + random() * 1.1,
    phase: random() * Math.PI * 2,
  }));
  return { glints, dust, fireflies, lights, crests, petals, butterflies, bubbles, shelfMotes, timeOfDay, random };
}

const GLINT = {
  morning: ['255,255,250', '255,236,170'],
  sunset: ['255,214,150', '255,170,90'],
  night: ['225,235,255', '200,215,255'],
};

const CREST = { morning: '255,255,255', sunset: '255,214,170', night: '205,220,255' };

function drawBoat(c, t, tod) {
  const span = BOAT_LANE.to - BOAT_LANE.from;
  const p = ((t / 140) % 1 + 1) % 1;
  const x = BOAT_LANE.from + span * p;
  const y = BOAT_LANE.y + Math.sin(t * 1.4) * 0.8;
  if (!pointInPolygon(x, y + 2, SEA)) return;
  const tilt = Math.sin(t * 0.9) * 0.06;
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.globalAlpha = tod === 'night' ? 0.55 : 0.95;
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
  c.beginPath();
  c.moveTo(-0.8, -1);
  c.lineTo(-0.8, -8);
  c.lineTo(-4.6, -1.2);
  c.closePath();
  c.fill();
  // Estela
  c.globalAlpha = 0.35;
  c.strokeStyle = '#ffffff';
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(-6, 2.6);
  c.lineTo(-18, 3.4);
  c.stroke();
  c.restore();
}

function draw(c, world, t, teaLevel = null) {
  c.clearRect(0, 0, SCENE_W, SCENE_H);
  const colors = GLINT[world.timeOfDay];

  // Crestas de las olas avanzando hacia la orilla
  const crestColor = CREST[world.timeOfDay];
  c.lineCap = 'round';
  for (const k of world.crests) {
    const a = (0.5 + 0.5 * Math.sin(t * 0.8 + k.phase)) * (world.timeOfDay === 'night' ? 0.25 : 0.6);
    if (a < 0.04) continue;
    const grad = c.createLinearGradient(k.x - k.len / 2, k.y, k.x + k.len / 2, k.y);
    grad.addColorStop(0, `rgba(${crestColor},0)`);
    grad.addColorStop(0.5, `rgba(${crestColor},${a})`);
    grad.addColorStop(1, `rgba(${crestColor},0)`);
    c.strokeStyle = grad;
    c.lineWidth = 1.1 + (k.y - 611) / 90;
    c.beginPath();
    c.moveTo(k.x - k.len / 2, k.y);
    c.quadraticCurveTo(k.x, k.y - 1.2, k.x + k.len / 2, k.y);
    c.stroke();
  }
  drawBoat(c, t, world.timeOfDay);

  // Destellos: estrellas de 4 puntas que se encienden y se apagan con fase propia
  for (const g of world.glints) {
    const s = Math.sin(t * g.speed + g.phase);
    const a = Math.pow(Math.max(0, s), 6);
    if (a < 0.03) continue;
    const r = g.size * (0.6 + a * 0.8);
    const color = colors[g.phase > Math.PI ? 1 : 0];
    c.globalAlpha = a * (world.timeOfDay === 'night' ? 0.7 : 0.95);
    const glow = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, r * 1.5);
    glow.addColorStop(0, `rgba(${color},0.9)`);
    glow.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = glow;
    c.fillRect(g.x - r * 1.5, g.y - r * 1.5, r * 3, r * 3);
    c.strokeStyle = `rgba(${color},0.95)`;
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(g.x - r * 2.2, g.y);
    c.lineTo(g.x + r * 2.2, g.y);
    c.moveTo(g.x, g.y - r * 1.3);
    c.lineTo(g.x, g.y + r * 1.3);
    c.stroke();
  }

  // Polen y polvo: solo brillan dentro de los haces de sol
  const dustColor = world.timeOfDay === 'sunset' ? '255,190,120' : '255,226,150';
  for (const d of world.dust) {
    const light = beamLight(d.x, d.y);
    if (light < 0.06) continue;
    const twinkle = 0.55 + 0.45 * Math.sin(t * 1.7 + d.phase);
    c.globalAlpha = light * twinkle * 0.9;
    c.fillStyle = `rgba(${dustColor},1)`;
    c.beginPath();
    c.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    c.fill();
  }

  // Luces del pueblo con su reflejo tembloroso en el agua
  for (const l of world.lights) {
    const flicker = 0.75 + 0.25 * Math.sin(t * 2.3 + l.phase);
    c.globalAlpha = flicker;
    const glow = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.size * 3.4);
    glow.addColorStop(0, 'rgba(255,214,130,0.95)');
    glow.addColorStop(1, 'rgba(255,170,70,0)');
    c.fillStyle = glow;
    c.fillRect(l.x - l.size * 3.4, l.y - l.size * 3.4, l.size * 6.8, l.size * 6.8);
    if (world.timeOfDay === 'night' && l.y > 680 && l.y < 700 && pointInPolygon(l.x, l.y + 14, SEA)) {
      c.globalAlpha = 0.35 * flicker;
      c.fillStyle = 'rgba(255,200,120,1)';
      for (let k = 0; k < 4; k += 1) {
        c.fillRect(l.x - 1.2 + Math.sin(t * 3 + k + l.phase) * 1.2, l.y + 10 + k * 5, 2.4, 2.2);
      }
    }
  }

  // Luciérnagas entre las flores del balcón
  for (const f of world.fireflies) {
    const pulse = Math.pow(Math.max(0, Math.sin(t * 1.3 + f.phase)), 3);
    if (pulse < 0.05) continue;
    c.globalAlpha = pulse;
    const glow = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
    glow.addColorStop(0, 'rgba(236,255,160,1)');
    glow.addColorStop(0.3, 'rgba(200,255,120,0.5)');
    glow.addColorStop(1, 'rgba(180,255,100,0)');
    c.fillStyle = glow;
    c.fillRect(f.x - 9, f.y - 9, 18, 18);
  }

  // Motas de la estantería: brillo cálido que respira
  for (const m of world.shelfMotes) {
    const a = 0.25 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9 + m.phase), 2);
    c.globalAlpha = a;
    const glow = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 3);
    glow.addColorStop(0, 'rgba(255,236,180,0.95)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = glow;
    c.fillRect(m.x - m.size * 3, m.y - m.size * 3, m.size * 6, m.size * 6);
  }

  // Burbujas del té helado
  c.strokeStyle = 'rgba(255,248,225,0.75)';
  c.lineWidth = 0.5;
  const teaTop = teaLevel === null ? 0 : TEA_GLASS.y + TEA_GLASS.h * (1 - teaLevel);
  for (const b of world.bubbles) {
    if (b.y < teaTop) continue;
    c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + b.phase);
    c.beginPath();
    c.arc(b.x + Math.sin(t * 2 + b.phase) * 0.8, b.y, b.r, 0, Math.PI * 2);
    c.stroke();
  }

  // Pétalos girando en la brisa
  for (const p of world.petals) {
    const fade = p.y > 1250 ? Math.max(0, 1 - (p.y - 1250) / 200) : 1;
    c.globalAlpha = 0.9 * fade * (world.timeOfDay === 'night' ? 0.5 : 1);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + p.phase)));
    c.fillStyle = p.pink ? '#ffc9d6' : '#fffaf2';
    c.beginPath();
    c.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Mariposas: dos alas que baten y un cuerpo fino
  for (const b of world.butterflies) {
    const flap = Math.abs(Math.sin(t * 11 + b.phase));
    c.globalAlpha = 0.95;
    c.save();
    c.translate(b.x, b.y);
    c.rotate(Math.sin(t * 2 + b.phase) * 0.3);
    c.fillStyle = `rgba(${b.color},1)`;
    c.strokeStyle = 'rgba(80,50,20,0.6)';
    c.lineWidth = 0.4;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(side * 2.6 * (0.3 + flap * 0.7), -1, 3 * (0.25 + flap * 0.75), 2.4, side * 0.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.fillStyle = '#3b2a1e';
    c.fillRect(-0.4, -2.4, 0.8, 4.4);
    c.restore();
  }
  c.globalAlpha = 1;
}

function step(world, dt, t) {
  for (const k of world.crests) {
    k.y += k.speed * dt;
    k.x += Math.sin(t * 0.3 + k.phase) * 2 * dt;
    if (!pointInPolygon(k.x, k.y, SEA)) Object.assign(k, seaPoint(world.random, null, 0), { y: 612 + world.random() * 30 });
  }
  for (const m of world.shelfMotes) {
    m.y += m.vy * dt;
    m.x += Math.sin(t * 0.5 + m.phase) * 5 * dt;
    if (m.y < 30) {
      m.y = 800;
      m.x = 4 + world.random() * 250;
    }
  }
  for (const b of world.bubbles) {
    b.y -= b.v * dt;
    if (b.y < TEA_GLASS.y) {
      b.y = TEA_GLASS.y + TEA_GLASS.h;
      b.x = TEA_GLASS.x + world.random() * TEA_GLASS.w;
    }
  }
  // Ráfaga de brisa sincronizada con la sombra de nube (cada 35 s): los pétalos vuelan más y más rápido
  const cycle = (t - 6) % 35;
  const gust = t > 6 && cycle > 22 && cycle < 32 ? 1 : 0;
  for (const p of world.petals) {
    p.x += (p.vx * (1 + gust * 2.4) + Math.sin(t * 1.2 + p.phase) * 14) * dt;
    p.y += p.vy * (1 + gust * 0.6) * dt;
    p.rot += p.spin * dt;
    if (p.y > 1460 || p.x < -10) {
      p.x = 440 + world.random() * 540;
      p.y = world.random() * 260;
    }
  }
  for (const b of world.butterflies) {
    if (t > b.retarget) {
      b.tx = 470 + world.random() * 360;
      b.ty = 780 + world.random() * (world.random() < 0.25 ? 380 : 170);
      b.retarget = t + 2 + world.random() * 3;
    }
    b.x += ((b.tx - b.x) * 0.6 + Math.sin(t * 3 + b.phase) * 22) * dt;
    b.y += ((b.ty - b.y) * 0.6 + Math.cos(t * 4 + b.phase) * 18) * dt;
  }
  for (const d of world.dust) {
    d.x += (d.vx + Math.sin(t * 0.4 + d.phase) * 4) * dt;
    d.y += (d.vy + Math.cos(t * 0.3 + d.phase) * 2) * dt;
    if (d.y < 360) d.y = 1530;
    if (d.x < 0) d.x = SCENE_W;
    if (d.x > SCENE_W) d.x = 0;
  }
  for (const f of world.fireflies) {
    f.vx += (Math.sin(t * 0.7 + f.phase * 3) * 8 - f.vx) * dt;
    f.vy += (Math.cos(t * 0.9 + f.phase * 2) * 6 - f.vy) * dt;
    f.x = Math.min(820, Math.max(470, f.x + f.vx * dt));
    f.y = Math.min(965, Math.max(785, f.y + f.vy * dt));
  }
}

export function RoomAtmosphereCanvas({ timeOfDay, scale, paused, reducedMotion, teaLevelRef }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return undefined;
    // Buffer al tamaño mostrado (escena × escala) por la densidad de pantalla; en móvil, como mucho 1,5
    const dpr = Math.min(window.devicePixelRatio || 1, LITE_SCENE ? 1.5 : 2);
    const density = Math.max(0.2, scale) * dpr;
    canvas.width = Math.round(SCENE_W * density);
    canvas.height = Math.round(SCENE_H * density);
    c.setTransform(density, 0, 0, density, 0, 0);
    const world = createWorld(timeOfDay);
    const start = performance.now();
    draw(c, world, 0.6);
    if (reducedMotion || paused) return undefined;

    let frame = 0;
    let last = start;
    const loop = (now) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      step(world, dt, t);
      draw(c, world, t, teaLevelRef?.current ?? null);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [timeOfDay, scale, paused, reducedMotion]);

  return <canvas ref={ref} className="room-canvas" aria-hidden="true" />;
}
