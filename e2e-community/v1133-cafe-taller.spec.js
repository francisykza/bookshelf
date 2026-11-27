// 1.133 (SPEC §133; docs/qa/cafe-libreria.md §16.3, bloque 2 de §16.6, cifras de Francisco del 14-11-2026) · El taller de la
// trastienda: desde el nivel 3, la puerta de detrás de la barra lleva al banco de don Celestino. El primer encargo es siempre el
// Quijote con polvo, pliegue y título borrado, y don Celestino lo enseña; cada daño se arregla con su gesto sobre el libro (la
// brocha, la plegadera, el hierro con el pan de oro; la goma de miga y el canto de la mano; la cola y la prensa), después va el
// ex libris en la guarda y la ficha «antes / después». Paga 6 / 9 / 12 granos y 15 / 22 / 30 de reputación según las
// estrellas. El servidor simulado aplica las reglas de `20261220120000_cafe_taller.sql`. Capturas y vídeos en qa-report/v1133/.
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simularCafe } from './cafeMock';
import { quieto } from './cafeBarra';
import { createMockSupabase } from './mockSupabase';
import { ANA } from './sobreShop';
import { PLANO_INICIAL, cuenta } from '../src/features/edificio/cafe/cafeCatalogo';
import { generoDe } from '../src/features/edificio/cafe/cafeClientes';
import { letrasTapa, manchasDe, semillaEncargo } from '../src/features/edificio/cafe/cafeTallerGestos';
import { dayKey } from '../src/domain/dates';
import { alEdificio } from './entrada';

const DIR = join('qa-report', 'v1133');
const tam = (info) => info.project.name.replace(/^(chromium|webkit)-/, '$1-');
const HOY = dayKey();
const AYER = dayKey(new Date(Date.now() - 86400000));
const libro = (id, title, extra = {}) => ({
  id,
  title,
  author: `Autoría ${id}`,
  status: 'read',
  pageCount: 320,
  currentPage: 320,
  cover: '',
  categories: [],
  publishedDate: '2012',
  addedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: '2026-10-20T10:00:00.000Z',
  quotes: [],
  ...extra,
});
const LIBROS = [
  libro('f', 'El dragón del muelle', { categories: ['Fantasy'] }),
  libro('m', 'Crimen en la lonja', { categories: ['Mystery'] }),
  libro('a', 'Cartas de amor al puerto', { categories: ['Romance'] }),
];
const BALDA = { bienvenida: true, libros: LIBROS.map((b) => ({ clave: b.id, titulo: b.title, genero: generoDe(b), caja: 0, balda: 1 })) };
const SONIDO = { v: 1, on: true, decided: true, legacy: false, effects: 40, ambience: 15, music: 40, master: 80, ambienceId: 'none', musicId: 'tarde', lastAmbience: 'none', lastMusic: 'tarde' };
const sonidos = (page) => page.evaluate(() => window.__cafeSonidos ?? []);
const semillas = (s, n) => Array.from({ length: n }, (_, k) => s + k * 7919);

test.use({ video: { mode: 'on', size: { width: 390, height: 844 } } });

// ── El sonido de las evidencias (Francisco, tras ver la 1.133: los vídeos de Playwright no tienen sonido) ──
/**
 * Antes de cargar la app: todo lo que la página manda a los altavoces se manda también a una grabadora (MediaRecorder, opus).
 * No cambia lo que suena ni cómo; solo escucha. Se apunta cuándo empezó, para cuadrarlo con el vídeo.
 */
async function grabarSonido(page) {
  await page.addInitScript(() => {
    const destinos = new WeakMap();
    const g = (window.__grabacion = { trozos: [], inicio: 0, rec: null });
    const conectar = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destino, ...resto) {
      const r = conectar.call(this, destino, ...resto);
      try {
        if (destino instanceof AudioDestinationNode && typeof this.context.createMediaStreamDestination === 'function') {
          let md = destinos.get(this.context);
          if (!md) {
            md = this.context.createMediaStreamDestination();
            destinos.set(this.context, md);
            if (!g.rec) {
              g.rec = new MediaRecorder(md.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
              g.rec.ondataavailable = (e) => e.data.size && g.trozos.push(e.data);
              g.rec.start(1000);
              g.inicio = Date.now();
            }
          }
          conectar.call(this, md);
        }
      } catch {
        /* sin grabadora, la prueba sigue igual */
      }
      return r;
    };
  });
}
/** Para la grabadora y devuelve el sonido (base64) y cuándo empezó (ms de la época), o null si no sonó nada. */
async function sonidoGrabado(page) {
  return page.evaluate(async () => {
    const g = window.__grabacion;
    if (!g?.rec) return null;
    await new Promise((r) => {
      g.rec.onstop = r;
      g.rec.stop();
    });
    const blob = new Blob(g.trozos, { type: 'audio/webm' });
    const url = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
    return { b64: String(url).split(',')[1], inicio: g.inicio };
  });
}
/** El ffmpeg que trae Playwright (solo copia pistas, no codifica), o null. */
function ffmpeg() {
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  try {
    const dir = readdirSync(base)
      .filter((d) => d.startsWith('ffmpeg-'))
      .sort()
      .pop();
    const exe = dir && join(base, dir, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux');
    return exe && existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}
/**
 * Guarda el vídeo en `destino` con su sonido: el vídeo, tal cual; el sonido, desplazado lo que tardó en empezar a sonar desde
 * que empezó el vídeo (`t0`, al empezar la prueba). Sin sonido o sin ffmpeg, el vídeo mudo, como siempre.
 */
async function guardarConSonido(video, destino, sonido, t0) {
  const mudo = destino.replace(/\.webm$/, '.mudo.webm');
  await video.saveAs(mudo);
  const exe = ffmpeg();
  if (!sonido || !exe) return renameSync(mudo, destino);
  const pista = destino.replace(/\.webm$/, '.sonido.webm');
  writeFileSync(pista, Buffer.from(sonido.b64, 'base64'));
  try {
    const desfase = Math.max(0, (sonido.inicio - t0) / 1000).toFixed(3);
    execFileSync(exe, ['-y', '-loglevel', 'error', '-i', mudo, '-itsoffset', desfase, '-i', pista, '-map', '0:v', '-map', '1:a', '-c', 'copy', destino]);
    unlinkSync(mudo);
  } catch {
    renameSync(mudo, destino);
  } finally {
    unlinkSync(pista);
  }
}

async function alCafe(page, estado, taller) {
  const mock = createMockSupabase({
    edificio_vecinos: [],
    piso_cuentas: { [ANA.id]: { inicio_elegido: true, tickets: 120, sin_raro: 3 } },
    piso_inventario: { [ANA.id]: { sillon: 1 } },
  });
  mock.db.profiles.push({ user_id: ANA.id, alias: 'Ana lectora', avatar_id: 'gato-lector', community_enabled: true });
  mock.db.libraries.push({ user_id: ANA.id, data: { books: LIBROS }, updated_at: new Date().toISOString(), version: 5 });
  await page.addInitScript(
    ({ books, sonido }) => {
      localStorage.setItem('bookshelf:signs-hint-done', 'true');
      localStorage.setItem('bookshelf:sonido:v1', JSON.stringify(sonido));
      if (!localStorage.getItem('bookshelf:v1'))
        localStorage.setItem('bookshelf:v1', JSON.stringify({ books, settings: { sound: true, sfx: true, uiVolume: 0.4 }, progress: { readingLog: [], pomodoros: [], claimed: {} } }));
    },
    { books: LIBROS, sonido: SONIDO },
  );
  await mock.attach(page, ANA);
  const plano = structuredClone(PLANO_INICIAL);
  const c = await simularCafe(
    page,
    { inaugurado: true, nombre: 'Taza y Lomo', inventario: cuenta(plano), libros: BALDA, nivel: 3, reputacion: 1100, granos: 30, cobrados: [1, 2, 3], ...estado, plano },
    { clientes: { hoy: HOY, semillas: semillas(2100, 5), quienes: [3], frases: [10] }, taller },
  );
  await page.goto('/');
  await alEdificio(page);
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await portal.getByRole('button', { name: 'Entrar en el café-librería del bajo' }).click({ timeout: 15000 });
  const cafe = page.getByRole('dialog', { name: 'El café-librería del bajo' });
  await expect(cafe.locator('.cf3[data-ready="true"]')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.__cafe3d?.settled() && window.__cafe3d.renders() > 0);
  return { cafe, c };
}

/** Delante de la barra, mirando a la puerta del taller; se toca su letrero y se entra. */
async function entrar(page, cafe, texto = 'El taller') {
  const tag = cafe.locator('.cf3-tags button', { hasText: 'El taller' });
  // Primero, que haya llegado el encargo del día (el letrero ya lo dice)
  await expect(tag).toHaveText(texto, { timeout: 10000 });
  // Si los datos del día llegan justo después de ponerse delante, la escena vuelve a colocar al jugador (lo que hace al montar
  // lo colocado); entonces se vuelve a poner. Con movimiento reducido no hay paseo que lo disimule y pasaba una vez de cada tres.
  await expect(async () => {
    await page.evaluate(() => window.__cafe3d.place(6.55, 6.75, Math.PI / 2));
    await quieto(page);
    await expect(tag).not.toHaveAttribute('data-off', 'true', { timeout: 1500 });
  }).toPass({ timeout: 20000 });
  await tag.click();
  await page.waitForFunction(() => window.__cafe3d.enTaller(), null, { timeout: 20000 });
  await quieto(page);
  return cafe.locator('.cf3-franja--taller');
}

const marca = (page, nombre) => page.evaluate((n) => window.__cafe3d.tallerMarca(n), nombre);
const enPantalla = (page, sup, uvs) => page.evaluate(([s, l]) => l.map(([u, v]) => window.__cafe3d.tallerMarca(`${s}:${u}:${v}`)), [sup, uvs]);

/** Un trazo con el ratón (como el dedo), punto a punto, en pasos de `px` píxeles: despacio y con mimo. */
async function trazo(page, puntos, { px = 4, dedo = 0 } = {}) {
  const m = page.mouse;
  await m.move(puntos[0].x, puntos[0].y);
  await m.down();
  let ant = puntos[0];
  for (const p of puntos.slice(1)) {
    const largo = Math.hypot(p.x - ant.x, p.y - ant.y);
    if (dedo > 0) {
      // A ritmo de dedo: `dedo` px por cuadro, un cuadro cada 16 ms (el vídeo se ve a la velocidad de verdad)
      const n = Math.max(1, Math.ceil(largo / dedo));
      for (let i = 1; i <= n; i += 1) {
        await m.move(ant.x + ((p.x - ant.x) * i) / n, ant.y + ((p.y - ant.y) * i) / n);
        await page.waitForTimeout(16);
      }
    } else await m.move(p.x, p.y, { steps: Math.max(1, Math.ceil(largo / px)) });
    ant = p;
  }
  await m.up();
}
/** Apretar y mantener sobre un punto. */
async function mantener(page, p, ms) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
/** Espera a que el paso del taller sea `tipo` y se pueda tocar (la cámara ya ha llegado). */
async function alPaso(page, franja, tipo) {
  await expect(franja).toHaveAttribute('data-fase', 'gesto', { timeout: 15000 });
  await expect(franja).toHaveAttribute('data-paso', tipo, { timeout: 15000 });
  await expect(page.locator('.cf3-taller[data-activo="true"]')).toBeVisible({ timeout: 15000 });
  await quieto(page, 300);
}
/** Repite un gesto hasta que el paso cambia (el polvo con moho pide más de una pasada). */
async function hastaQueCambie(page, franja, tipo, hacer, veces = 5) {
  for (let k = 0; k < veces; k += 1) {
    await hacer(k);
    await page.waitForTimeout(250);
    if ((await franja.getAttribute('data-fase')) !== 'gesto' || (await franja.getAttribute('data-paso')) !== tipo) return;
  }
  throw new Error(`El gesto ${tipo} no termina`);
}

// ── Los gestos de cada daño ──
async function quitarPolvo(page, franja, foto) {
  await hastaQueCambie(page, franja, 'polvo', async (k) => {
    // Cuatro pasadas largas de lado a lado (y una quinta por el borde de abajo), a ritmo de dedo
    const filas = [];
    [0.1, 0.34, 0.58, 0.8, 0.95].forEach((v, f) => filas.push(...(f % 2 ? [[1.02, v], [-0.02, v]] : [[-0.02, v], [1.02, v]])));
    const puntos = await enPantalla(page, 'tapa', filas);
    if (k === 0 && foto) {
      // A medias: la brocha en la mano y el polvo que se levanta
      await trazo(page, puntos.slice(0, 4), { dedo: 9 });
      await foto();
      await trazo(page, puntos.slice(3), { dedo: 9 });
    } else await trazo(page, puntos, { dedo: 9 });
  });
}
async function alisarPliegue(page, franja) {
  await hastaQueCambie(page, franja, 'arrugas', async () => {
    const a = await marca(page, 'pliegue:a');
    const b = await marca(page, 'pliegue:b');
    await trazo(page, [a, b, a], { px: 3 });
  });
}
async function dorar(page, franja, tapa, foto) {
  const n = letrasTapa(tapa).length;
  for (let k = 0; k < n; k += 1) {
    const p = await marca(page, `letra:${k}`);
    await mantener(page, p, 600);
    if (k === 2) await foto?.();
  }
  await expect(franja).not.toHaveAttribute('data-paso', 'dorado', { timeout: 5000 });
}
async function borrarManchas(page, franja, encargo, foto) {
  const ms = manchasDe(semillaEncargo(encargo));
  for (const [k, m] of ms.entries()) {
    // Dos círculos y medio sobre cada mancha, a ritmo de dedo
    const circ = [];
    for (let i = 0; i <= 60; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      circ.push([m.u + (Math.cos(a) * 0.018) / 0.52, m.v + (Math.sin(a) * 0.018) / 0.36]);
    }
    await trazo(page, await enPantalla(page, 'pliego', circ), { dedo: 5 });
    if (k === 0) await foto?.('goma');
  }
  // Barrer las migas con el canto de la mano, de lado a lado
  await expect(page.locator('.cf3-taller[data-gesto="barrer"]')).toBeVisible({ timeout: 5000 });
  await quieto(page, 300);
  await foto?.('barrer');
  await trazo(page, await enPantalla(page, 'pliego', [[0.12, 0.55], [0.88, 0.55]]), { px: 4 });
}
/** La cola: `deMas`, frotar la cabeza del lomo una y otra vez antes de cubrir el resto (rezuma: se podía mejorar). */
async function encolar(page, { deMas = false } = {}) {
  const lista = [];
  if (deMas) for (let k = 0; k < 6; k += 1) lista.push([0.07, k % 2 ? 0.4 : -0.01]);
  lista.push([0.07, -0.01], [0.07, 1.01], [0.07, -0.01]);
  await trazo(page, await enPantalla(page, 'tapa', lista), { px: 3 });
}
async function prensar(page, foto) {
  const c = await marca(page, 'husillo');
  const R = 46;
  const vuelta = [];
  for (let i = 0; i <= 120; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    vuelta.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R * 0.8 });
  }
  await trazo(page, vuelta.slice(0, 60), { dedo: 7 });
  await foto?.();
  await trazo(page, vuelta.slice(59), { dedo: 7 });
}
async function exLibris(page, franja, foto) {
  const p = await marca(page, 'guarda');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await foto?.();
  await page.waitForTimeout(550);
  await page.mouse.up();
  await expect(franja).toHaveAttribute('data-fase', 'ficha', { timeout: 15000 });
}
/** Seguir tras un daño arreglado (lo que dice don Celestino y el sello). */
async function seguir(page, cafe, franja, foto) {
  await expect(franja).toHaveAttribute('data-fase', 'respiro', { timeout: 15000 });
  await foto?.();
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
}

test('nivel 3: el taller de la trastienda, el primer encargo con don Celestino, el ex libris y la ficha', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(300000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `taller-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, {}, { encargos: [], siguientes: [] });
  // La puerta de detrás de la barra, con su letrero y el encargo que espera
  await page.evaluate(() => window.__cafe3d.place(6.55, 6.75, Math.PI / 2));
  await quieto(page);
  await foto('puerta');
  const franja = await entrar(page, cafe, 'El taller · un encargo');
  expect(c.taller.encargos).toHaveLength(1);
  // Don Celestino se presenta (dos frases) y enseña el primer encargo
  await expect(franja).toHaveAttribute('data-fase', 'primera');
  await expect(franja).toContainText('Soy Celestino');
  await foto('celestino');
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(franja).toContainText('esto no es la barra');
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(franja).toHaveAttribute('data-fase', 'encargo');
  await expect(franja).toContainText('Mira, tu primer encargo: lo ha traído una vecina del tercero');
  await expect(franja).toContainText('Don Quijote de la Mancha');
  await expect(franja.locator('.cf3-encargo__danos li')).toHaveText(['Polvo y moho', 'Página arrugada', 'Título borrado']);
  await quieto(page);
  await foto('encargo');
  await cafe.getByRole('button', { name: 'Empezar', exact: true }).click();
  // 1. El polvo y el moho, con la brocha (nivel 3: la «!» solo si te quedas parado)
  await alPaso(page, franja, 'polvo');
  await expect(cafe.locator('.cf3-taller .cf3-gesto__pista')).toBeVisible();
  await expect(cafe.locator('.cf3-taller .cf3-gesto__nota')).toContainText('Pasadas largas y suaves');
  await foto('brocha');
  await expect(franja).toHaveAttribute('data-ayuda', 'true', { timeout: 9000 });
  await expect(cafe.locator('.cf3-taller .cf3-ayuda--gesto')).toBeVisible();
  await foto('ayuda');
  await quitarPolvo(page, franja, () => foto('polvo-a-medias'));
  await seguir(page, cafe, franja, () => foto('polvo-hecho'));
  // 2. El pliegue, con la plegadera de hueso
  await alPaso(page, franja, 'arrugas');
  await foto('plegadera');
  await alisarPliegue(page, franja);
  await seguir(page, cafe, franja, () => foto('pliegue-hecho'));
  // 3. El título, letra a letra, con el hierro y el pan de oro
  await alPaso(page, franja, 'dorado');
  await foto('hierro');
  await dorar(page, franja, 'QUIJOTE', () => foto('oro'));
  await seguir(page, cafe, franja);
  // 4. El ex libris del taller en la guarda; el libro se cierra y llega la ficha
  await alPaso(page, franja, 'exlibris');
  await foto('guarda');
  await exLibris(page, franja, () => foto('sello'));
  await quieto(page, 900);
  await expect(cafe.locator('.cf3-cartulina')).toBeVisible();
  await expect(cafe.locator('.cf3-cartulina img')).toHaveCount(2);
  const e = c.taller.encargos[0];
  expect(e.hecho).toBe(true);
  expect(e.mimo).toHaveLength(3);
  const estrellas = e.estrellas;
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', `${estrellas} de 3 estrellas`);
  const pago = { 1: [6, 15], 2: [9, 22], 3: [12, 30] }[estrellas];
  await expect(franja.locator('.cf3-dado')).toHaveText(`+${pago[0]} granos+${pago[1]} reputación`);
  expect([c.granos, c.reputacion]).toEqual([30 + pago[0], 1100 + pago[1]]);
  await foto('ficha');
  await expect.poll(async () => (await sonidos(page)).includes('entregaTaller'), { timeout: 5000 }).toBe(true);
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['tallerPuerta', 'celestino', 'herramienta', 'alisado', 'hierro', 'oro', 'exlibris', 'danoHecho', 'libroAbre', 'ficha', 'entregaTaller']));
  // De vuelta al café; el taller ya no tiene encargo hoy
  await cafe.getByRole('button', { name: 'Volver al café', exact: true }).click();
  await expect(franja).toHaveCount(0);
  await page.waitForFunction(() => !window.__cafe3d.enTaller() && !window.__cafe3d.yendoTaller(), null, { timeout: 15000 });
  await quieto(page);
  await foto('de-vuelta');
  const franja2 = await entrar(page, cafe, 'El taller');
  await expect(franja2).toHaveAttribute('data-fase', 'sin');
  await expect(franja2).toContainText('Por hoy no hay más encargos');
  await expect(franja2).toContainText('Hoy restauraste Don Quijote de la Mancha');
  await foto('sin-encargo');
  await cafe.getByRole('button', { name: 'Volver al café', exact: true }).click();
  await page.waitForFunction(() => !window.__cafe3d.enTaller() && !window.__cafe3d.yendoTaller(), null, { timeout: 15000 });
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  if (conSonido) expect(sonido?.b64?.length ?? 0).toBeGreaterThan(1000);
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR, `taller-primer-encargo-${tam(info)}.webm`), sonido, t0);
});

test('otro día: manchas y lomo (la goma, barrer las migas, la cola y la prensa); la cola de más se puede mejorar', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(300000);
  const t0 = Date.now();
  await grabarSonido(page);
  mkdirSync(DIR, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR, `segundo-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const ayer = { n: 1, llega: AYER, libro: 0, quien: 0, danos: ['polvo', 'arrugas', 'dorado'], hecho: true, dia_hecho: AYER, estrellas: 3, mimo: [2, 2, 2], granos: 12, reputacion: 30 };
  const { cafe, c } = await alCafe(page, {}, { encargos: [ayer], siguientes: [{ libro: 9, quien: 3, danos: ['manchas', 'lomo'] }] });
  const franja = await entrar(page, cafe, 'El taller · un encargo');
  // Sin presentación: don Celestino ya solo comenta
  await expect(franja).toHaveAttribute('data-fase', 'encargo');
  await expect(franja).toContainText('Te han dejado un libro en el banco: lo ha traído el cartero del muelle');
  await expect(franja).toContainText('La isla del tesoro');
  await expect(franja.locator('.cf3-encargo__danos li')).toHaveText(['Manchas y lápiz', 'Lomo despegado']);
  await foto('encargo');
  await cafe.getByRole('button', { name: 'Empezar', exact: true }).click();
  const encargo = c.taller.encargos[1];
  // 1. Las manchas con la goma de miga y, después, barrer las migas
  await alPaso(page, franja, 'manchas');
  await foto('manchas');
  await borrarManchas(page, franja, encargo, foto);
  await seguir(page, cafe, franja, () => foto('manchas-hechas'));
  // 2. El lomo: cola de más (frotando la cabeza una y otra vez) y la prensa hasta el tope
  await alPaso(page, franja, 'cola');
  await foto('cola');
  await encolar(page, { deMas: true });
  await alPaso(page, franja, 'prensa');
  await foto('prensa');
  await prensar(page, () => foto('husillo'));
  await seguir(page, cafe, franja, () => foto('lomo-mejorable'));
  await expect(franja).not.toHaveAttribute('data-fase', 'respiro');
  // 3. El ex libris y la ficha: 2 estrellas, con el consejo en ámbar
  await alPaso(page, franja, 'exlibris');
  await exLibris(page, franja);
  await quieto(page, 900);
  const e = c.taller.encargos[1];
  expect(e.mimo).toEqual([2, 1]);
  expect(e.estrellas).toBe(2);
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '2 de 3 estrellas');
  await expect(franja.locator('.cf3-repaso li[data-ok="mejor"]')).toContainText('Lomo despegado · Una capa más fina');
  await expect(franja.locator('.cf3-dado')).toHaveText('+9 granos+22 reputación');
  expect([c.granos, c.reputacion]).toEqual([39, 1122]);
  await foto('ficha');
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['manchaFuera', 'migas', 'husillo', 'tope']));
  await cafe.getByRole('button', { name: 'Volver al café', exact: true }).click();
  await page.waitForFunction(() => !window.__cafe3d.enTaller() && !window.__cafe3d.yendoTaller(), null, { timeout: 15000 });
  expect(errors).toEqual([]);
  const sonido = await sonidoGrabado(page);
  const video = page.video();
  await page.close();
  if (video) await guardarConSonido(video, join(DIR, `taller-segundo-encargo-${tam(info)}.webm`), sonido, t0);
});

test('con movimiento reducido, cada gesto de un toque; «Luego» a medias y se sigue donde se dejó', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(240000);
  mkdirSync(DIR, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const foto = async (nombre) => page.screenshot({ path: join(DIR, `reducido-${nombre}-${tam(info)}.png`) });
  const { cafe, c } = await alCafe(page, {}, { encargos: [], siguientes: [] });
  let franja = await entrar(page, cafe, 'El taller · un encargo');
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await cafe.getByRole('button', { name: 'Empezar', exact: true }).click();
  // Sin animaciones: el botón del atajo hace el gesto de una vez, y queda bien
  await alPaso(page, franja, 'polvo');
  await foto('polvo');
  await cafe.getByRole('button', { name: 'Cepillar', exact: true }).click();
  await seguir(page, cafe, franja);
  await alPaso(page, franja, 'arrugas');
  // Irse a medias: el polvo ya está hecho
  await cafe.getByRole('button', { name: 'Luego', exact: true }).click();
  await page.waitForFunction(() => !window.__cafe3d.enTaller() && !window.__cafe3d.yendoTaller(), null, { timeout: 15000 });
  expect(c.taller.encargos[0].hecho).toBe(false);
  franja = await entrar(page, cafe, 'El taller · un encargo');
  await expect(franja).toHaveAttribute('data-fase', 'encargo');
  await expect(franja).toContainText('Lo dejaste a medias y aquí sigue, esperándote. Te falta: página arrugada y título borrado.');
  await expect(franja.locator('.cf3-encargo__danos li').first()).toHaveText('✓ Polvo y moho');
  await foto('a-medias');
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await alPaso(page, franja, 'arrugas');
  // Con el teclado, Intro sobre el libro también lo hace de una vez
  await page.locator('.cf3-taller[data-activo="true"]').focus();
  await page.keyboard.press('Enter');
  await seguir(page, cafe, franja);
  await alPaso(page, franja, 'dorado');
  await cafe.getByRole('button', { name: 'Dorar el título', exact: true }).click();
  await seguir(page, cafe, franja);
  await alPaso(page, franja, 'exlibris');
  await cafe.getByRole('button', { name: 'Poner el ex libris', exact: true }).click();
  await expect(franja).toHaveAttribute('data-fase', 'ficha', { timeout: 15000 });
  expect(c.taller.encargos[0].mimo).toEqual([2, 2, 2]);
  await expect(franja.locator('.cf3-estrellas')).toHaveAttribute('aria-label', '3 de 3 estrellas');
  await expect(franja.locator('.cf3-dado')).toHaveText('+12 granos+30 reputación');
  await foto('ficha');
  await cafe.getByRole('button', { name: 'Volver al café', exact: true }).click();
  await page.waitForFunction(() => !window.__cafe3d.enTaller() && !window.__cafe3d.yendoTaller(), null, { timeout: 15000 });
  expect(errors).toEqual([]);
});

test('la música del taller, aparte: suena (guitarra, violonchelo, lluvia y brasas) y se guarda para escucharla', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'a 390');
  test.setTimeout(120000);
  mkdirSync(DIR, { recursive: true });
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const { renderTallerMusica } = await import('/src/features/edificio/cafe/cafeTallerMusica.js');
    const buf = await renderTallerMusica(48);
    const [l, rr] = [buf.getChannelData(0), buf.getChannelData(1)];
    // Mono a 22 050 Hz (media de cada dos muestras) y 16 bits
    const n = Math.floor(l.length / 2);
    const pcm = new Int16Array(n);
    let pico = 0;
    let suma = 0;
    for (let i = 0; i < n; i += 1) {
      const v = (l[2 * i] + rr[2 * i] + l[2 * i + 1] + rr[2 * i + 1]) / 4;
      pico = Math.max(pico, Math.abs(v));
      suma += v * v;
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    const cab = new DataView(new ArrayBuffer(44));
    const txt = (o, s) => [...s].forEach((c, k) => cab.setUint8(o + k, c.charCodeAt(0)));
    txt(0, 'RIFF');
    cab.setUint32(4, 36 + n * 2, true);
    txt(8, 'WAVEfmt ');
    cab.setUint32(16, 16, true);
    cab.setUint16(20, 1, true);
    cab.setUint16(22, 1, true);
    cab.setUint32(24, 22050, true);
    cab.setUint32(28, 44100, true);
    cab.setUint16(32, 2, true);
    cab.setUint16(34, 16, true);
    txt(36, 'data');
    cab.setUint32(40, n * 2, true);
    const blob = new Blob([cab.buffer, pcm.buffer], { type: 'audio/wav' });
    const url = await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.readAsDataURL(blob);
    });
    return { b64: String(url).split(',')[1], pico, rms: Math.sqrt(suma / n) };
  });
  // Suena, sin saturar y sin quedarse en un susurro
  expect(r.pico).toBeGreaterThan(0.05);
  expect(r.pico).toBeLessThan(1);
  expect(r.rms).toBeGreaterThan(0.005);
  writeFileSync(join(DIR, 'musica-taller.wav'), Buffer.from(r.b64, 'base64'));
});

test('por debajo del nivel 3 no hay letrero del taller', async ({ page }, info) => {
  test.skip(!/chromium-390x844$/.test(info.project.name), 'a 390');
  const { cafe } = await alCafe(page, { nivel: 2, reputacion: 400, cobrados: [1, 2] }, { encargos: [], siguientes: [] });
  await page.evaluate(() => window.__cafe3d.place(6.55, 6.75, Math.PI / 2));
  await quieto(page);
  await expect(cafe.locator('.cf3-tags button', { hasText: 'El taller' })).toHaveCount(0);
});

// ── 1.133.2 (Francisco, tras ver la 1.133.1: «la de arrugar las paginas, el sello necesito que sea mas impactante y al pasar de
// quitar al polvo a arrugar las paginas se glitchea la pagina») · La página ya no parpadea al abrir el libro (el bloque de hojas
// estaba a la misma altura que la primera página y la tapaba a trozos); el pliegue se ve levantado y baja por tramos bajo la
// plegadera, sin perder nada al soltar; y el ex libris, del tamaño de la marca y con el nombre del café, cae de golpe (suena
// hondo, la vista se sacude, salta el polvillo y sale en grande). Capturas y vídeo en qa-report/v1133-2/.
const DIR2 = join('qa-report', 'v1133-2');
/** El ex libris pintado tal cual en la guarda (sin el render de la escena), ampliado, con varios nombres de café, uno al lado del otro. */
async function exlibrisPintados(page, nombres) {
  const url = await page.evaluate(async (lista) => {
    const T = await import('/src/features/edificio/cafe/cafeTaller.js');
    const P = await import('/src/features/edificio/cafe/cafeTallerPintura.js');
    const enc = T.encargoDe({ n: 1, libro: 0, quien: 0, danos: ['polvo', 'arrugas', 'dorado'] });
    const X = 4;
    const out = document.createElement('canvas');
    out.width = lista.length * 80 * X + (lista.length - 1) * 12;
    out.height = 110 * X;
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1c1410';
    g.fillRect(0, 0, out.width, out.height);
    lista.forEach((nombre, i) => {
      const c = P.pintarPliego(document.createElement('canvas'), enc, { ...P.vistasHechas(enc), nombre });
      g.drawImage(c, 0, 0, 80, 110, i * (80 * X + 12), 0, 80 * X, 110 * X);
    });
    return out.toDataURL('image/png');
  }, nombres);
  return Buffer.from(url.split(',')[1], 'base64');
}

test('1.133.2: la página no parpadea al abrir el libro, el pliegue se ve y baja por tramos, y el ex libris da un golpe', async ({ page }, info) => {
  test.skip(!/chromium-(360x800|390x844)$/.test(info.project.name), 'a 360 y 390');
  test.setTimeout(300000);
  const t0 = Date.now();
  const conSonido = /390x844/.test(info.project.name);
  if (conSonido) await grabarSonido(page);
  mkdirSync(DIR2, { recursive: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(DIR2, `arreglos-${String(n).padStart(2, '0')}-${nombre}-${tam(info)}.png`) });
  };
  const { cafe, c } = await alCafe(page, {}, { encargos: [], siguientes: [] });
  const franja = await entrar(page, cafe, 'El taller · un encargo');
  for (let k = 0; k < 2; k += 1) await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(franja).toHaveAttribute('data-fase', 'encargo');
  await cafe.getByRole('button', { name: 'Empezar', exact: true }).click();
  await alPaso(page, franja, 'polvo');
  await quitarPolvo(page, franja);
  await expect(franja).toHaveAttribute('data-fase', 'respiro', { timeout: 15000 });
  // Del polvo al pliegue: la tapa se abre, cuadro a cuadro, y la página sale entera (la plegadera, en el banco hasta que acaba)
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  for (let k = 0; k < 4; k += 1) {
    await page.waitForTimeout(160);
    await foto(`abre-${k + 1}`);
  }
  await alPaso(page, franja, 'arrugas');
  await expect(cafe.locator('.cf3-taller .cf3-gesto__nota')).toContainText('Desliza la plegadera por encima del pliegue');
  await foto('pliegue-cresta');
  // Una pasada de punta a punta, con la foto a mitad (el dedo apretado); al soltar, cada tramo se queda a la mitad
  const a = await marca(page, 'pliegue:a');
  const b = await marca(page, 'pliegue:b');
  const m = page.mouse;
  await m.move(a.x, a.y);
  await m.down();
  const N = 48;
  for (let i = 1; i <= N; i += 1) {
    await m.move(a.x + ((b.x - a.x) * i) / N, a.y + ((b.y - a.y) * i) / N);
    await page.waitForTimeout(16);
    if (i === N / 2) await foto('plegadera-apretando');
  }
  await m.up();
  await expect(franja).toHaveAttribute('data-paso', 'arrugas');
  const medio = Number(await franja.getAttribute('data-progreso'));
  expect(medio).toBeGreaterThan(35);
  expect(medio).toBeLessThan(65);
  await quieto(page, 300);
  await foto('pliegue-a-medias');
  // Se suelta y no se pierde nada: la vuelta lo deja plano, con una nota que sube por cada tramo
  await trazo(page, [b, a], { dedo: 6 });
  await expect(franja).toHaveAttribute('data-fase', 'respiro', { timeout: 15000 });
  await quieto(page, 300);
  await foto('pliegue-liso');
  const son1 = await sonidos(page);
  expect(son1.filter((s) => s === 'aplana').length).toBeGreaterThanOrEqual(8);
  expect(son1.filter((s) => s === 'liso').length).toBeGreaterThanOrEqual(8);
  await cafe.getByRole('button', { name: 'Seguir', exact: true }).click();
  await alPaso(page, franja, 'dorado');
  await dorar(page, franja, 'QUIJOTE');
  await seguir(page, cafe, franja);
  // El ex libris: el sello grande sobre la guarda; al apretar, baja; al sellar, el golpe, el ex libris en grande y lo que dice
  await alPaso(page, franja, 'exlibris');
  await foto('sello-encima');
  const g = await marca(page, 'guarda');
  await m.move(g.x, g.y);
  await m.down();
  await page.waitForTimeout(350);
  await foto('sello-apretando');
  await expect(cafe.locator('.cf3-gesto__sellado')).toBeVisible({ timeout: 3000 });
  await m.up();
  await expect(cafe.locator('.cf3-gesto__sellado')).toContainText('Ex libris');
  await expect(cafe.locator('.cf3-gesto__sellado')).toContainText('Taza y Lomo');
  await foto('golpe');
  await expect(franja).toContainText('¡Eso es! Ya lleva la marca de la casa.');
  await page.waitForTimeout(450);
  await foto('sello-se-levanta');
  await page.waitForTimeout(650);
  await foto('marca-fresca');
  await expect(franja).toHaveAttribute('data-fase', 'ficha', { timeout: 15000 });
  await quieto(page, 900);
  await foto('ficha');
  expect(c.taller.encargos[0].hecho).toBe(true);
  expect(await sonidos(page)).toEqual(expect.arrayContaining(['selloApoya', 'exlibris', 'selloLevanta', 'celestino', 'ficha']));
  // El ex libris tal cual, con nombres largos, con tildes y sin nombre
  writeFileSync(join(DIR2, `exlibris-nombres-${tam(info)}.png`), await exlibrisPintados(page, ['Taza y Lomo', 'La Biblioteca de Pilar', 'Té y Página', null]));
  // El golpe suena hondo pero no más fuerte que el resto (Francisco, 1.128: «algunos sonidos suenan muy fuerte»)
  const nivel = await page.evaluate(async () => {
    const S = await import('/src/features/edificio/cafe/cafeSfx.js');
    return S.medirSonidos(['exlibris', 'selloApoya', 'selloLevanta', 'aplana', 'liso', 'alisado', 'sello', 'herramienta', 'danoHecho']);
  });
  writeFileSync(join(DIR2, `sonidos-${tam(info)}.json`), JSON.stringify(nivel, null, 2));
  for (const [nombre, v] of Object.entries(nivel)) expect(v.rms, nombre).toBeLessThan(-30);
  expect(errors).toEqual([]);
  const sonido = conSonido ? await sonidoGrabado(page) : null;
  if (conSonido) expect(sonido?.b64?.length ?? 0).toBeGreaterThan(1000);
  const video = page.video();
  await page.close();
  if (video && conSonido) await guardarConSonido(video, join(DIR2, `taller-arreglos-${tam(info)}.webm`), sonido, t0);
});
